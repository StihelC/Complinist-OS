#!/bin/bash
# CompliNist Launcher Script
# Ensures models are synced and launches app with --no-sandbox

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

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Determine if running from AppImage or installed
# First, check if we're being run from inside an AppImage (APPIMAGE env var is set)
if [ -n "$APPIMAGE" ]; then
    # Running from inside AppImage - this shouldn't happen with launcher script
    # but handle it anyway
    APPDIR="$(dirname "$APPIMAGE")"
    APPIMAGE_FILE="$APPIMAGE"
    MODELS_DIR="$APPDIR/models"
    CHROMA_DIR="$APPDIR/chroma_db"
    USE_APPIMAGE=true
# Check if there's an AppImage file in the same directory as this script
elif APPIMAGE_FILE=$(find "$SCRIPT_DIR" -maxdepth 1 -name "*.AppImage" -type f 2>/dev/null | head -1); then
    # Found AppImage in script directory - use it
    APPDIR="$(dirname "$APPIMAGE_FILE")"
    MODELS_DIR="$APPDIR/models"
    CHROMA_DIR="$APPDIR/chroma_db"
    USE_APPIMAGE=true
    print_info "Found AppImage: $(basename "$APPIMAGE_FILE")"
# Check for installed binary
elif [ -f "/opt/CompliNist/complinist-desktop" ]; then
    # Installed via .deb
    BINARY="/opt/CompliNist/complinist-desktop"
    MODELS_DIR="/opt/CompliNist/models"
    CHROMA_DIR="/opt/CompliNist/chroma_db"
    USE_APPIMAGE=false
elif [ -f "$HOME/.local/share/complinist/complinist-desktop" ]; then
    # User installation
    BINARY="$HOME/.local/share/complinist/complinist-desktop"
    MODELS_DIR="$HOME/.local/share/complinist/models"
    CHROMA_DIR="$HOME/.local/share/complinist/chroma_db"
    USE_APPIMAGE=false
else
    # Development mode
    BINARY=""
    MODELS_DIR="$PROJECT_ROOT/.data/models"
    CHROMA_DIR="$PROJECT_ROOT/.data/chroma_db"
    USE_APPIMAGE=false
fi

# Check if binary/AppImage exists
if [ "$USE_APPIMAGE" = true ]; then
    if [ ! -f "$APPIMAGE_FILE" ]; then
        print_error "AppImage not found at: $APPIMAGE_FILE"
        exit 1
    fi
    # Make sure AppImage is executable
    chmod +x "$APPIMAGE_FILE" 2>/dev/null || true
elif [ -n "$BINARY" ] && [ ! -f "$BINARY" ]; then
    print_error "CompliNist binary not found at: $BINARY"
    exit 1
fi

# Check for models
print_info "Checking for AI models..."
if [ ! -d "$MODELS_DIR" ]; then
    print_warning "Models directory not found: $MODELS_DIR"
    print_warning "AI features may not work. Place .gguf model files in: $MODELS_DIR"
else
    MODEL_COUNT=$(find "$MODELS_DIR" -name "*.gguf" 2>/dev/null | wc -l)
    if [ "$MODEL_COUNT" -eq 0 ]; then
        print_warning "No .gguf model files found in: $MODELS_DIR"
        print_warning "AI features will not work. Download models to: $MODELS_DIR"
    else
        print_success "Found $MODEL_COUNT model file(s) in: $MODELS_DIR"
    fi
fi

# Check for ChromaDB
print_info "Checking for ChromaDB..."
if [ ! -d "$CHROMA_DIR" ]; then
    print_warning "ChromaDB directory not found: $CHROMA_DIR"
    print_warning "Vector search features may not work"
else
    print_success "ChromaDB directory found: $CHROMA_DIR"
fi

# Launch the application
print_info "Launching CompliNist..."

if [ "$USE_APPIMAGE" = true ]; then
    # Launch AppImage - set APPIMAGE env var so Electron app can detect it
    # The AppImage runtime will also set this, but we set it explicitly for clarity
    export APPIMAGE="$APPIMAGE_FILE"
    exec "$APPIMAGE_FILE" --no-sandbox "$@"
elif [ -n "$BINARY" ]; then
    # Production mode: run binary with --no-sandbox
    exec "$BINARY" --no-sandbox "$@"
else
    # Development mode: use electron command
    if command -v electron >/dev/null 2>&1; then
        cd "$PROJECT_ROOT"
        exec electron . --no-sandbox "$@"
    else
        print_error "Electron not found. Run: npm install"
        exit 1
    fi
fi

