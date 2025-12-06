#!/bin/bash

# Script tự động tăng version, build và submit iOS app lên App Store Connect
# Usage: ./scripts/build-ios.sh [--no-submit] [--no-bump]
#   --no-submit: Chỉ build, không submit lên App Store
#   --no-bump: Không tăng version (dùng khi muốn build lại cùng version với Android)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse flags
NO_SUBMIT=false
NO_BUMP=false
for arg in "$@"; do
    case $arg in
        --no-submit)
            NO_SUBMIT=true
            ;;
        --no-bump)
            NO_BUMP=true
            ;;
    esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   iOS Build & Submit Script${NC}"
echo -e "${BLUE}========================================${NC}"

# Get current version from app.json
CURRENT_VERSION=$(node -p "require('./app.json').expo.version")
echo -e "${YELLOW}Current version: ${CURRENT_VERSION}${NC}"

if [ "$NO_BUMP" = true ]; then
    NEW_VERSION=$CURRENT_VERSION
    echo -e "${YELLOW}Version bump skipped (--no-bump flag)${NC}"
else
    # Increment patch version (1.2.7 -> 1.2.8)
    IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
    MAJOR=${VERSION_PARTS[0]}
    MINOR=${VERSION_PARTS[1]}
    PATCH=${VERSION_PARTS[2]}
    NEW_PATCH=$((PATCH + 1))
    NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"

    echo -e "${GREEN}New version: ${NEW_VERSION}${NC}"

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
    git commit -m "chore: bump version to ${NEW_VERSION} [ios]" || echo -e "${YELLOW}No changes to commit${NC}"
fi

echo ""
echo -e "${BLUE}🔨 Building iOS app with EAS...${NC}"
echo ""

# Build iOS
eas build --platform ios --profile production --non-interactive

if [ "$NO_SUBMIT" = false ]; then
    echo ""
    echo -e "${BLUE}📤 Submitting to App Store Connect...${NC}"
    echo ""
    
    # Submit to App Store Connect
    eas submit --platform ios --latest --non-interactive
    
    echo ""
    echo -e "${GREEN}✅ iOS build and submit completed!${NC}"
    echo -e "${GREEN}   Version: ${NEW_VERSION}${NC}"
    echo -e "${YELLOW}💡 Don't forget to push: git push${NC}"
else
    echo ""
    echo -e "${GREEN}✅ iOS build completed! (Submit skipped)${NC}"
    echo -e "${GREEN}   Version: ${NEW_VERSION}${NC}"
fi

