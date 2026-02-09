#!/bin/bash

##############################################################################
# Release Notes Generator
#
# Generates release notes from git commits between tags
#
# Usage: ./generate-release-notes.sh [previous-tag] [current-tag]
##############################################################################

set -e

PREV_TAG=${1:-$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")}
CURR_TAG=${2:-"HEAD"}

echo "# Release Notes"
echo ""
echo "## Version: $(node -p "require('./package.json').version")"
echo "## Date: $(date '+%Y-%m-%d')"
echo ""

if [ -n "$PREV_TAG" ]; then
    echo "## Changes since $PREV_TAG"
    echo ""

    # Features
    echo "### ✨ Features"
    git log $PREV_TAG..$CURR_TAG --pretty=format:"- %s (%h)" --grep="feat:" --grep="feature:" || echo "- No new features"
    echo ""

    # Fixes
    echo "### 🐛 Bug Fixes"
    git log $PREV_TAG..$CURR_TAG --pretty=format:"- %s (%h)" --grep="fix:" --grep="bug:" || echo "- No bug fixes"
    echo ""

    # Other changes
    echo "### 🔧 Other Changes"
    git log $PREV_TAG..$CURR_TAG --pretty=format:"- %s (%h)" --invert-grep --grep="feat:" --grep="fix:" | head -10 || echo "- No other changes"
    echo ""
else
    echo "## Initial Release"
    echo ""
fi

echo "---"
echo "**Full Changelog**: https://gitlab.com/$CI_PROJECT_PATH/-/compare/$PREV_TAG...$CURR_TAG"
