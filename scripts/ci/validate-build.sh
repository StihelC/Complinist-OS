#!/bin/bash

##############################################################################
# Build Validation Script
#
# This script validates that build artifacts were created successfully
# and meet minimum quality requirements.
#
# Usage: ./validate-build.sh
##############################################################################

set -e

echo "========================================"
echo "Build Artifact Validation"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation results
ERRORS=0
WARNINGS=0

# Function to check if file exists
check_file() {
    local file=$1
    local required=$2

    if [ -f "$file" ]; then
        local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        echo -e "${GREEN}✓${NC} Found: $file ($(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo "$size bytes"))"
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}✗${NC} Missing required file: $file"
            ((ERRORS++))
        else
            echo -e "${YELLOW}⚠${NC} Missing optional file: $file"
            ((WARNINGS++))
        fi
        return 1
    fi
}

echo ""
echo "Checking Linux build artifacts..."
echo "-----------------------------------"
check_file "dist/*.AppImage" "true" || true
check_file "dist/*.deb" "false" || true
check_file "dist/*.rpm" "false" || true
check_file "dist/latest-linux.yml" "false" || true

echo ""
echo "Checking Windows build artifacts..."
echo "-----------------------------------"
check_file "dist/*.exe" "true" || true
check_file "dist/latest.yml" "false" || true

echo ""
echo "========================================"
echo "Validation Summary"
echo "========================================"
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}Build validation FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Build validation PASSED${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}Note: $WARNINGS warnings detected${NC}"
    fi
    exit 0
fi
