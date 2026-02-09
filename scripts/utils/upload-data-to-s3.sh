#!/bin/bash
# Upload CompliNist data archive to S3

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
ARCHIVE_FILE="$PROJECT_ROOT/complinist-data.tar.gz"

echo ""
echo "========================================"
echo "  Upload CompliNist Data to S3"
echo "========================================"
echo ""

# Check if archive exists
if [ ! -f "$ARCHIVE_FILE" ]; then
    print_error "Archive not found: $ARCHIVE_FILE"
    print_info "Run 'npm run package-data' first to create the archive"
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

# Get bucket name
echo "Enter S3 bucket name (e.g., complinist-releases):"
read -p "Bucket name: " BUCKET_NAME

if [ -z "$BUCKET_NAME" ]; then
    print_error "Bucket name is required"
    exit 1
fi

# Get region (optional, will use default if not provided)
echo "Enter AWS region (e.g., us-east-1) [default from AWS config]:"
read -p "Region: " REGION

# Get S3 path
echo "Enter S3 path (e.g., data/complinist-data.tar.gz) [data/complinist-data.tar.gz]:"
read -p "S3 path: " S3_PATH
S3_PATH=${S3_PATH:-data/complinist-data.tar.gz}

# Construct S3 URI
S3_URI="s3://${BUCKET_NAME}/${S3_PATH}"

echo ""
print_info "Upload configuration:"
print_info "  Archive: $ARCHIVE_FILE"
print_info "  Bucket: $BUCKET_NAME"
print_info "  Region: ${REGION:-default}"
print_info "  S3 path: $S3_PATH"
echo ""

# Confirm upload
read -p "Proceed with upload? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    print_info "Upload cancelled"
    exit 0
fi

# Upload file
print_info "Uploading to S3..."
UPLOAD_CMD="aws s3 cp \"$ARCHIVE_FILE\" \"$S3_URI\""

if [ -n "$REGION" ]; then
    UPLOAD_CMD="$UPLOAD_CMD --region $REGION"
fi

# Add progress option if available
if aws s3 cp --help 2>&1 | grep -q "\-\-no-progress"; then
    UPLOAD_CMD="$UPLOAD_CMD --no-progress"
fi

eval $UPLOAD_CMD || {
    print_error "Upload failed"
    exit 1
}

# Set public-read permissions
print_info "Setting public-read permissions..."
aws s3api put-object-acl \
    --bucket "$BUCKET_NAME" \
    --key "$S3_PATH" \
    --acl public-read \
    ${REGION:+--region "$REGION"} || {
    print_warning "Failed to set public-read permissions"
    print_info "You may need to set bucket policy manually"
}

# Generate download URL
if [ -n "$REGION" ]; then
    DOWNLOAD_URL="https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${S3_PATH}"
else
    # Try to get region from bucket location
    BUCKET_REGION=$(aws s3api get-bucket-location --bucket "$BUCKET_NAME" --query 'LocationConstraint' --output text 2>/dev/null || echo "us-east-1")
    if [ "$BUCKET_REGION" == "None" ] || [ -z "$BUCKET_REGION" ]; then
        BUCKET_REGION="us-east-1"
    fi
    DOWNLOAD_URL="https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${S3_PATH}"
fi

echo ""
print_success "Upload completed!"
echo ""
print_info "Download URL:"
echo "  $DOWNLOAD_URL"
echo ""
print_info "Add this URL as GitHub secret:"
echo "  Secret name: COMPLINIST_DATA_URL"
echo "  Secret value: $DOWNLOAD_URL"
echo ""
print_info "Or use this in your GitHub Actions workflow:"
echo "  COMPLINIST_DATA_URL: $DOWNLOAD_URL"
echo ""




















