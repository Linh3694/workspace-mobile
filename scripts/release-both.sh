#!/bin/bash

# Script release cả iOS và Android với CÙNG MỘT VERSION
# Tránh tình trạng version bị tăng 2 lần khi chạy riêng từng platform
# Usage: ./scripts/release-both.sh [--no-submit]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if --no-submit flag is passed
NO_SUBMIT=""
if [[ "$1" == "--no-submit" ]]; then
    NO_SUBMIT="--no-submit"
fi

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   📱 Release Both Platforms Script${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Get current version from app.json
CURRENT_VERSION=$(node -p "require('./app.json').expo.version")
echo -e "${YELLOW}Current version: ${CURRENT_VERSION}${NC}"

# Increment patch version (1.2.7 -> 1.2.8)
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"

echo -e "${GREEN}New version for both platforms: ${NEW_VERSION}${NC}"
echo ""

# Update version in app.json
node -e "
const fs = require('fs');
const appJson = require('./app.json');
appJson.expo.version = '${NEW_VERSION}';
fs.writeFileSync('./app.json', JSON.stringify(appJson, null, 2) + '\n');
console.log('✅ Updated app.json');
"

# Update version in package.json
node -e "
const fs = require('fs');
const packageJson = require('./package.json');
packageJson.version = '${NEW_VERSION}';
fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2) + '\n');
console.log('✅ Updated package.json');
"

# Git commit version bump
echo -e "${BLUE}📝 Committing version bump...${NC}"
git add app.json package.json
git commit -m "chore: bump version to ${NEW_VERSION} [ios + android]" || echo -e "${YELLOW}No changes to commit${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🍎 Building iOS...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Build iOS với --no-bump vì đã bump ở trên
./scripts/build-ios.sh --no-bump $NO_SUBMIT

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🤖 Building Android...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Build Android với --no-bump vì đã bump ở trên
./scripts/build-android.sh --no-bump $NO_SUBMIT

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   ✅ Both Platforms Released!${NC}"
echo -e "${CYAN}   Version: ${NEW_VERSION}${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}💡 Don't forget to push: git push${NC}"

