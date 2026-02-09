#!/bin/bash

# CompliNist Launch Script
# Simplified launcher for Electron app with in-process AI services

# Note: We don't use 'set -e' here because cleanup operations may fail
# if processes don't exist, which is expected and harmless

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure DISPLAY is set for X11 (GUI) applications
if [ -z "$DISPLAY" ]; then
    export DISPLAY=:0
    echo "DISPLAY not set, defaulting to :0"
fi

# Grant X11 access permissions if xhost is available
if command -v xhost &> /dev/null; then
    xhost +local: 2>/dev/null || true
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

case "${1:-start}" in
    start)
        echo -e "${BLUE}Starting CompliNist...${NC}"
        
        # Kill any existing processes first to ensure clean start
        echo -e "${YELLOW}Cleaning up any existing processes...${NC}"
        
        # Kill Electron processes
        pkill -f "electron.*--no-sandbox" 2>/dev/null || true
        pkill -f "electron.*main.js" 2>/dev/null || true
        pkill -f "electron \." 2>/dev/null || true
        
        # Kill Vite processes (both dev server and build watch)
        pkill -f "vite.*build.*watch" 2>/dev/null || true
        pkill -f "vite$" 2>/dev/null || true
        pkill -f "node.*vite" 2>/dev/null || true
        
        # Kill concurrently processes (used by electron:dev:hmr)
        pkill -f "concurrently" 2>/dev/null || true
        
        # Kill npm processes running electron:dev or electron:dev:hmr
        pkill -f "npm run electron:dev" 2>/dev/null || true
        pkill -f "npm.*electron:dev" 2>/dev/null || true
        
        # Wait a moment for processes to terminate gracefully
        sleep 2
        
        # Force kill any remaining processes
        pkill -9 -f "electron.*--no-sandbox" 2>/dev/null || true
        pkill -9 -f "vite.*build.*watch" 2>/dev/null || true
        pkill -9 -f "concurrently" 2>/dev/null || true
        
        # Clear Vite cache to ensure fresh build with new config
        if [ -d "node_modules/.vite" ]; then
            echo -e "${YELLOW}Clearing Vite cache...${NC}"
            rm -rf node_modules/.vite
        fi
        
        echo -e "${GREEN}Cleanup complete${NC}"
        echo ""
        echo -e "${BLUE}Starting fresh instance...${NC}"
        
        # Use HMR mode by default (supports hot module replacement)
        # Set USE_DEV_MODE=1 environment variable to use regular build mode instead
        if [ "${USE_DEV_MODE:-0}" = "1" ]; then
            echo -e "${YELLOW}Using build mode (electron:dev)...${NC}"
            echo -e "${YELLOW}AI services will initialize on first use${NC}"
            echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
            echo ""
            npm run electron:dev
        else
            echo -e "${YELLOW}Using HMR mode (electron:dev:hmr) with hot module replacement...${NC}"
            echo -e "${YELLOW}AI services will initialize on first use${NC}"
            echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
            echo ""
            npm run electron:dev:hmr
        fi
        ;;
    stop)
        echo -e "${BLUE}Stopping CompliNist...${NC}"
        
        # Kill Electron processes
        pkill -f "electron.*--no-sandbox" 2>/dev/null || true
        pkill -f "electron.*main.js" 2>/dev/null || true
        pkill -f "electron \." 2>/dev/null || true
        
        # Kill Vite processes (both dev server and build watch)
        pkill -f "vite.*build.*watch" 2>/dev/null || true
        pkill -f "vite$" 2>/dev/null || true
        pkill -f "node.*vite" 2>/dev/null || true
        
        # Kill concurrently processes (used by electron:dev:hmr)
        pkill -f "concurrently" 2>/dev/null || true
        
        # Kill npm processes running electron:dev or electron:dev:hmr
        pkill -f "npm run electron:dev" 2>/dev/null || true
        pkill -f "npm.*electron:dev" 2>/dev/null || true
        
        # Wait a moment for processes to terminate gracefully
        sleep 2
        
        # Force kill any remaining processes
        pkill -9 -f "electron.*--no-sandbox" 2>/dev/null || true
        pkill -9 -f "vite.*build.*watch" 2>/dev/null || true
        pkill -9 -f "concurrently" 2>/dev/null || true
        
        echo -e "${GREEN}CompliNist stopped${NC}"
        ;;
    *)
        echo "Usage: $0 {start|stop}"
        echo ""
        echo "Commands:"
        echo "  start   - Start Electron app with HMR (hot module replacement)"
        echo "           Use USE_DEV_MODE=1 $0 start for build mode instead"
        echo "  stop    - Stop all processes"
        echo ""
        echo "Examples:"
        echo "  $0 start                    # Start with HMR mode (default)"
        echo "  USE_DEV_MODE=1 $0 start     # Start with build mode"
        echo "  $0 stop                     # Stop all processes"
        exit 1
        ;;
esac
