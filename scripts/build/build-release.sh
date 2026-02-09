#!/bin/bash
# Build Release Script for CompliFlow
# For local development builds. For official releases, use GitHub Actions CI/CD.

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate version number
validate_version() {
    [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]
}

echo ""
echo "========================================"
echo "  CompliFlow Local Build Script"
echo "========================================"
echo ""
echo "NOTE: For official releases, use GitHub Actions by pushing a version tag:"
echo "      git tag v1.0.0 && git push origin v1.0.0"
echo ""

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
print_info "Current version: ${CURRENT_VERSION}"

# Prompt for version
echo ""
read -p "Enter version [${CURRENT_VERSION}]: " NEW_VERSION
NEW_VERSION=${NEW_VERSION:-$CURRENT_VERSION}

if ! validate_version "$NEW_VERSION"; then
    print_error "Invalid version format. Use semantic versioning (e.g., 1.0.1 or 1.0.0-beta.1)"
    exit 1
fi

# Update version in package.json
if [ "$NEW_VERSION" != "$CURRENT_VERSION" ]; then
    print_info "Updating version to ${NEW_VERSION}..."
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.version = '${NEW_VERSION}';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    print_success "Version updated"
fi

# Select build target
echo ""
echo "Select build target:"
echo "  1) Linux AppImage"
echo "  2) Windows only (requires Wine on Linux)"
echo "  3) Both platforms"
echo "  4) Current platform only"
read -p "Choice [1]: " BUILD_CHOICE
BUILD_CHOICE=${BUILD_CHOICE:-1}

case $BUILD_CHOICE in
    1) BUILD_FLAGS="--linux" 
       BUILD_FORMAT="appimage" ;;
    2) BUILD_FLAGS="--win" 
       BUILD_FORMAT="win" ;;
    3) BUILD_FLAGS="--linux --win" 
       BUILD_FORMAT="both" ;;
    4) BUILD_FLAGS="" 
       BUILD_FORMAT="auto" ;;
    *) print_error "Invalid choice"; exit 1 ;;
esac

# Check icons
if [ ! -f "build/icon.png" ] || [ ! -f "build/icon.ico" ]; then
    print_warning "Icons not found. Generating..."
    npm run create-icons || { print_error "Failed to create icons"; exit 1; }
    print_success "Icons created"
fi

# Rebuild native modules for system Node.js first (needed for init-database.js)
print_info "Rebuilding native modules for system Node.js..."
npm rebuild better-sqlite3 || { print_error "System Node.js rebuild failed"; exit 1; }
print_success "Native modules rebuilt for system Node.js"

# Build frontend
print_info "Building frontend..."
npx vite build || { print_error "Frontend build failed"; exit 1; }
print_success "Frontend built"

# Rebuild native modules for Electron (needed for packaged app)
print_info "Rebuilding native modules for Electron..."
npm run electron:rebuild || { print_error "Electron rebuild failed"; exit 1; }
print_success "Native modules rebuilt for Electron"

# Build Electron app
echo ""
print_info "Building Electron app..."
npx electron-builder $BUILD_FLAGS --publish never || { print_error "Electron build failed"; exit 1; }

# Create release archives
echo ""
print_info "Creating release archives..."
node scripts/create-release-archive.js --platform=$(echo $BUILD_FLAGS | grep -q "\-\-linux" && echo "linux" || (echo $BUILD_FLAGS | grep -q "\-\-win" && echo "win" || echo "all")) || { print_error "Archive creation failed"; exit 1; }

# Generate checksums
echo ""
print_info "Generating checksums..."
cd release
if ls *.tar.gz *.zip 2>/dev/null | head -1 > /dev/null; then
    sha256sum *.tar.gz *.zip 2>/dev/null > checksums.txt || true
    print_success "Checksums saved to release/checksums.txt"
fi
cd ..

# List output
echo ""
print_success "Build completed!"
echo ""
print_info "Generated archives in release/:"
ls -lh release/*.tar.gz release/*.zip 2>/dev/null | awk '{print $9, "("$5")"}' || print_warning "No archives found"

# Ask about S3 upload
echo ""
read -p "Upload installers to S3? (y/N): " UPLOAD_S3
if [[ $UPLOAD_S3 =~ ^[Yy]$ ]]; then
    echo ""
    print_info "Uploading installers to S3..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Install it first:"
        echo "  pip install awscli"
        echo "  or: brew install awscli"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured"
        print_info "Run: aws configure"
        exit 1
    fi
    
    # Get bucket name
    echo "Enter S3 bucket name (e.g., complinist-releases):"
    read -p "Bucket name: " BUCKET_NAME
    
    if [ -z "$BUCKET_NAME" ]; then
        print_error "Bucket name is required"
        exit 1
    fi
    
    # Get region
    echo "Enter AWS region (e.g., us-east-2) [default from AWS config]:"
    read -p "Region: " REGION
    
    # Determine version path
    VERSION_TAG="v${NEW_VERSION}"
    S3_BASE_PATH="releases/${VERSION_TAG}"
    
    echo ""
    print_info "Upload configuration:"
    print_info "  Bucket: $BUCKET_NAME"
    print_info "  Region: ${REGION:-default}"
    print_info "  Version: $VERSION_TAG"
    print_info "  S3 path: s3://${BUCKET_NAME}/${S3_BASE_PATH}/"
    echo ""
    
    # Confirm upload
    read -p "Proceed with upload? (y/N): " CONFIRM_UPLOAD
    if [[ ! $CONFIRM_UPLOAD =~ ^[Yy]$ ]]; then
        print_info "Upload cancelled"
    else
        # Upload each installer
        UPLOADED_COUNT=0
        for installer in release/*.{exe,AppImage}; do
            if [ -f "$installer" ]; then
                INSTALLER_NAME=$(basename "$installer")
                S3_PATH="${S3_BASE_PATH}/${INSTALLER_NAME}"
                S3_URI="s3://${BUCKET_NAME}/${S3_PATH}"
                
                print_info "Uploading $INSTALLER_NAME..."
                
                if [ -n "$REGION" ]; then
                    aws s3 cp "$installer" "$S3_URI" --region "$REGION" || {
                        print_warning "Failed to upload $INSTALLER_NAME"
                        continue
                    }
                else
                    aws s3 cp "$installer" "$S3_URI" || {
                        print_warning "Failed to upload $INSTALLER_NAME"
                        continue
                    }
                fi
                
                # Set public-read permissions
                if [ -n "$REGION" ]; then
                    aws s3api put-object-acl --bucket "$BUCKET_NAME" --key "$S3_PATH" --acl public-read --region "$REGION" 2>/dev/null || print_warning "Failed to set public-read for $INSTALLER_NAME"
                else
                    aws s3api put-object-acl --bucket "$BUCKET_NAME" --key "$S3_PATH" --acl public-read 2>/dev/null || print_warning "Failed to set public-read for $INSTALLER_NAME"
                fi
                
                ((UPLOADED_COUNT++))
                print_success "✓ $INSTALLER_NAME"
            fi
        done
        
        # Upload checksums if they exist
        if [ -f "release/checksums.txt" ]; then
            print_info "Uploading checksums.txt..."
            S3_PATH="${S3_BASE_PATH}/checksums.txt"
            S3_URI="s3://${BUCKET_NAME}/${S3_PATH}"
            
            if [ -n "$REGION" ]; then
                aws s3 cp "release/checksums.txt" "$S3_URI" --region "$REGION" && \
                aws s3api put-object-acl --bucket "$BUCKET_NAME" --key "$S3_PATH" --acl public-read --region "$REGION" 2>/dev/null && \
                print_success "✓ checksums.txt"
            else
                aws s3 cp "release/checksums.txt" "$S3_URI" && \
                aws s3api put-object-acl --bucket "$BUCKET_NAME" --key "$S3_PATH" --acl public-read 2>/dev/null && \
                print_success "✓ checksums.txt"
            fi
        fi
        
        # Get bucket region for URLs
        if [ -n "$REGION" ]; then
            BUCKET_REGION="$REGION"
        else
            BUCKET_REGION=$(aws s3api get-bucket-location --bucket "$BUCKET_NAME" --query 'LocationConstraint' --output text 2>/dev/null || echo "us-east-1")
            if [ "$BUCKET_REGION" == "None" ] || [ -z "$BUCKET_REGION" ]; then
                BUCKET_REGION="us-east-1"
            fi
        fi
        
        # Generate download URLs
        echo ""
        print_success "Upload completed! ($UPLOADED_COUNT file(s))"
        echo ""
        print_info "Download URLs:"
        for installer in release/*.{exe,AppImage}; do
            if [ -f "$installer" ]; then
                INSTALLER_NAME=$(basename "$installer")
                DOWNLOAD_URL="https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${S3_BASE_PATH}/${INSTALLER_NAME}"
                echo "  $INSTALLER_NAME:"
                echo "    $DOWNLOAD_URL"
            fi
        done
        echo ""
        print_info "Base URL for this release:"
        echo "  https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${S3_BASE_PATH}/"
    fi
fi

echo ""
print_success "Done! 🎉"
echo ""

