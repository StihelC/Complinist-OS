#!/bin/bash
# Upload CompliNist installers to S3

set -e

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

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$PROJECT_ROOT/release"

echo ""
echo "========================================"
echo "  Upload CompliNist Installers to S3"
echo "========================================"
echo ""

# Check if release directory exists
if [ ! -d "$RELEASE_DIR" ]; then
    print_error "Release directory not found: $RELEASE_DIR"
    print_info "Build the app first using: npm run electron:build"
    exit 1
fi

# Check if installers exist
INSTALLERS=$(find "$RELEASE_DIR" -type f \( -name "*.exe" -o -name "*.AppImage" -o -name "*.rpm" \) 2>/dev/null)

if [ -z "$INSTALLERS" ]; then
    print_error "No installers found in $RELEASE_DIR"
    exit 1
fi

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

# Get version from package.json
VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version" 2>/dev/null || echo "unknown")

# Get bucket name
echo "Enter S3 bucket name (e.g., complinist-releases):"
read -p "Bucket name: " BUCKET_NAME

if [ -z "$BUCKET_NAME" ]; then
    print_error "Bucket name is required"
    exit 1
fi

# Get region
echo "Enter AWS region (e.g., us-east-1) [default from AWS config]:"
read -p "Region: " REGION

# Determine version path
echo "Enter version tag (e.g., v1.0.0) [v${VERSION}]:"
read -p "Version tag: " VERSION_TAG
VERSION_TAG=${VERSION_TAG:-v${VERSION}}

# Base S3 path
S3_BASE_PATH="releases/${VERSION_TAG}"

echo ""
print_info "Upload configuration:"
print_info "  Release directory: $RELEASE_DIR"
print_info "  Bucket: $BUCKET_NAME"
print_info "  Region: ${REGION:-default}"
print_info "  Version: $VERSION_TAG"
print_info "  S3 path: s3://${BUCKET_NAME}/${S3_BASE_PATH}/"
echo ""

# List installers to upload
echo "Installers to upload:"
for installer in $INSTALLERS; do
    INSTALLER_NAME=$(basename "$installer")
    INSTALLER_SIZE=$(stat -f%z "$installer" 2>/dev/null || stat -c%s "$installer" 2>/dev/null)
    print_info "  $INSTALLER_NAME ($(numfmt --to=iec-i --suffix=B $INSTALLER_SIZE))"
done
echo ""

# Confirm upload
read -p "Proceed with upload? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    print_info "Upload cancelled"
    exit 0
fi

# Upload each installer
UPLOADED_COUNT=0
for installer in $INSTALLERS; do
    INSTALLER_NAME=$(basename "$installer")
    S3_PATH="${S3_BASE_PATH}/${INSTALLER_NAME}"
    S3_URI="s3://${BUCKET_NAME}/${S3_PATH}"
    
    print_info "Uploading $INSTALLER_NAME..."
    
    UPLOAD_CMD="aws s3 cp \"$installer\" \"$S3_URI\""
    if [ -n "$REGION" ]; then
        UPLOAD_CMD="$UPLOAD_CMD --region $REGION"
    fi
    
    if aws s3 cp --help 2>&1 | grep -q "\-\-no-progress"; then
        UPLOAD_CMD="$UPLOAD_CMD --no-progress"
    fi
    
    eval $UPLOAD_CMD || {
        print_error "Failed to upload $INSTALLER_NAME"
        continue
    }
    
    # Set public-read permissions
    aws s3api put-object-acl \
        --bucket "$BUCKET_NAME" \
        --key "$S3_PATH" \
        --acl public-read \
        ${REGION:+--region "$REGION"} || {
        print_warning "Failed to set public-read for $INSTALLER_NAME"
    }
    
    ((UPLOADED_COUNT++))
    print_success "✓ $INSTALLER_NAME"
done

# Upload checksums if they exist
if [ -f "$RELEASE_DIR/checksums.txt" ]; then
    print_info "Uploading checksums.txt..."
    S3_PATH="${S3_BASE_PATH}/checksums.txt"
    S3_URI="s3://${BUCKET_NAME}/${S3_PATH}"
    
    UPLOAD_CMD="aws s3 cp \"$RELEASE_DIR/checksums.txt\" \"$S3_URI\""
    if [ -n "$REGION" ]; then
        UPLOAD_CMD="$UPLOAD_CMD --region $REGION"
    fi
    
    eval $UPLOAD_CMD && {
        aws s3api put-object-acl \
            --bucket "$BUCKET_NAME" \
            --key "$S3_PATH" \
            --acl public-read \
            ${REGION:+--region "$REGION"} || true
        print_success "✓ checksums.txt"
    }
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
for installer in $INSTALLERS; do
    INSTALLER_NAME=$(basename "$installer")
    DOWNLOAD_URL="https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${S3_BASE_PATH}/${INSTALLER_NAME}"
    echo "  $INSTALLER_NAME:"
    echo "    $DOWNLOAD_URL"
done
echo ""
print_info "Base URL for this release:"
echo "  https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${S3_BASE_PATH}/"
echo ""



