#!/bin/bash
# Package CompliNist data (models + ChromaDB) into single archive for S3

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
DATA_DIR="$PROJECT_ROOT/.data"
OUTPUT_FILE="$PROJECT_ROOT/complinist-data.tar.gz"

echo ""
echo "========================================"
echo "  CompliNist Data Packaging"
echo "========================================"
echo ""

# Check if .data directory exists
if [ ! -d "$DATA_DIR" ]; then
    print_error ".data directory not found at $DATA_DIR"
    exit 1
fi

# Check if models directory exists
if [ ! -d "$DATA_DIR/models" ]; then
    print_error "Models directory not found at $DATA_DIR/models"
    exit 1
fi

# Check if chroma_db directory exists
if [ ! -d "$DATA_DIR/chroma_db" ]; then
    print_warning "ChromaDB directory not found at $DATA_DIR/chroma_db"
    print_warning "Archive will only include models"
fi

# Check for model files
MODEL_COUNT=$(find "$DATA_DIR/models" -name "*.gguf" 2>/dev/null | wc -l)
if [ "$MODEL_COUNT" -eq 0 ]; then
    print_error "No .gguf model files found in $DATA_DIR/models"
    exit 1
fi

print_info "Found $MODEL_COUNT model file(s)"
print_info "Models directory: $DATA_DIR/models"
print_info "ChromaDB directory: $DATA_DIR/chroma_db"
echo ""

# Calculate sizes before compression
MODELS_SIZE=$(du -sb "$DATA_DIR/models" 2>/dev/null | cut -f1)
CHROMA_SIZE=$(du -sb "$DATA_DIR/chroma_db" 2>/dev/null | cut -f1 || echo "0")
TOTAL_SIZE=$((MODELS_SIZE + CHROMA_SIZE))

print_info "Total size before compression: $(numfmt --to=iec-i --suffix=B $TOTAL_SIZE)"
echo ""

# Remove existing archive if present
if [ -f "$OUTPUT_FILE" ]; then
    print_warning "Removing existing archive: $OUTPUT_FILE"
    rm -f "$OUTPUT_FILE"
fi

# Create archive
print_info "Creating archive: $OUTPUT_FILE"
cd "$DATA_DIR"

tar -czf "$OUTPUT_FILE" models/ chroma_db/ 2>/dev/null || {
    print_error "Failed to create archive"
    exit 1
}

# Verify archive
if [ ! -f "$OUTPUT_FILE" ]; then
    print_error "Archive was not created"
    exit 1
fi

ARCHIVE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
COMPRESSION_RATIO=$(echo "scale=2; (1 - $ARCHIVE_SIZE / $TOTAL_SIZE) * 100" | bc)

print_success "Archive created successfully!"
echo ""
print_info "Archive size: $(numfmt --to=iec-i --suffix=B $ARCHIVE_SIZE)"
print_info "Compression ratio: ${COMPRESSION_RATIO}%"
echo ""

# Validate archive contents
print_info "Validating archive contents..."
ARCHIVE_CONTENTS=$(tar -tzf "$OUTPUT_FILE" 2>/dev/null | head -20)

if echo "$ARCHIVE_CONTENTS" | grep -q "models/"; then
    print_success "✓ Models directory included"
else
    print_error "✗ Models directory missing from archive"
    exit 1
fi

if echo "$ARCHIVE_CONTENTS" | grep -q "chroma_db/"; then
    print_success "✓ ChromaDB directory included"
else
    print_warning "⚠ ChromaDB directory not in archive (may be empty)"
fi

# List model files in archive
echo ""
print_info "Model files in archive:"
tar -tzf "$OUTPUT_FILE" 2>/dev/null | grep "\.gguf$" | sed 's|^|  |'

echo ""
print_success "Archive ready: $OUTPUT_FILE"
print_info "Next step: Upload to S3 using: npm run upload-data"
echo ""




















