#!/bin/bash
# CompliFlow Launcher Script
# Ensures --no-sandbox flag is passed for Linux compatibility

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
exec "$SCRIPT_DIR/compliflow-desktop" --no-sandbox "$@"
