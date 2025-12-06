#!/bin/bash

# Script tự động tăng version, build và submit Android app lên Google Play
# Usage: ./scripts/build-android.sh [--no-submit] [--no-bump]
#   --no-submit: Chỉ build, không submit lên Google Play
#   --no-bump: Không tăng version (dùng khi muốn build lại cùng version với iOS)

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
echo -e "${BLUE}   Android Build & Submit Script${NC}"
echo -e "${BLUE}========================================${NC}"

# ============================================
# Check and copy google-services.json for Firebase
# ============================================
GOOGLE_SERVICES_SRC="./google-services.json"
GOOGLE_SERVICES_DEST="./android/app/google-services.json"

if [ -f "$GOOGLE_SERVICES_SRC" ]; then
    if [ -d "./android/app" ]; then
        cp "$GOOGLE_SERVICES_SRC" "$GOOGLE_SERVICES_DEST"
        echo -e "${GREEN}✅ Copied google-services.json to android/app/${NC}"
    else
        echo -e "${YELLOW}⚠️  android/app/ directory not found. Run 'expo prebuild' first if needed.${NC}"
    fi
else
    echo -e "${RED}❌ google-services.json not found in project root!${NC}"
    echo -e "${RED}   Firebase push notifications will NOT work on Android.${NC}"
    exit 1
fi

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
    git commit -m "chore: bump version to ${NEW_VERSION} [android]" || echo -e "${YELLOW}No changes to commit${NC}"
fi

echo ""
echo -e "${BLUE}🔨 Building Android app with EAS...${NC}"
echo ""

# Build Android
eas build --platform android --profile production --non-interactive

if [ "$NO_SUBMIT" = false ]; then
    echo ""
    echo -e "${BLUE}📤 Submitting to Google Play...${NC}"
    echo ""
    
    # Submit to Google Play
    eas submit --platform android --latest --non-interactive
    
    echo ""
    echo -e "${GREEN}✅ Android build and submit completed!${NC}"
    echo -e "${GREEN}   Version: ${NEW_VERSION}${NC}"
    echo -e "${YELLOW}💡 Don't forget to push: git push${NC}"
else
    echo ""
    echo -e "${GREEN}✅ Android build completed! (Submit skipped)${NC}"
    echo -e "${GREEN}   Version: ${NEW_VERSION}${NC}"
fi
