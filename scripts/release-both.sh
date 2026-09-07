#!/bin/bash

# Script release cả iOS và Android với CÙNG MỘT VERSION
# Tránh tình trạng version bị tăng 2 lần khi chạy riêng từng platform
# Usage: ./scripts/release-both.sh [--no-submit]

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
OLD_VERSION=$CURRENT_VERSION
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

# Update version and runtimeVersion in app.json
node -e "
const fs = require('fs');
const appJson = require('./app.json');
appJson.expo.version = '${NEW_VERSION}';
appJson.expo.runtimeVersion = '${NEW_VERSION}';
fs.writeFileSync('./app.json', JSON.stringify(appJson, null, 2) + '\n');
console.log('✅ Updated app.json (version + runtimeVersion)');
"

# Update version in package.json
node -e "
const fs = require('fs');
const packageJson = require('./package.json');
packageJson.version = '${NEW_VERSION}';
fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2) + '\n');
console.log('✅ Updated package.json');
"

# Update version in ios/Wis/Info.plist (bare workflow)
if [ -f "./ios/Wis/Info.plist" ]; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${NEW_VERSION}" "./ios/Wis/Info.plist"
    echo -e "${GREEN}✅ Updated ios/Wis/Info.plist (CFBundleShortVersionString)${NC}"
fi

# Update version in android/app/build.gradle (bare workflow)
if [ -f "./android/app/build.gradle" ]; then
    sed -i '' "s/versionName \".*\"/versionName \"${NEW_VERSION}\"/" "./android/app/build.gradle"
    echo -e "${GREEN}✅ Updated android/app/build.gradle (versionName)${NC}"
fi

# runtimeVersion cho expo-updates nằm ở 2 file native nữa. Không bump ở đây thì
# EAS prebuild tự sửa trong lúc build và để lại cây bẩn sau khi script chạy xong
# (đã dính ở bản 1.5.45: pull --rebase bị chặn vì 2 file này chưa commit).
if [ -f "./ios/Wis/Supporting/Expo.plist" ]; then
    /usr/libexec/PlistBuddy -c "Set :EXUpdatesRuntimeVersion ${NEW_VERSION}" "./ios/Wis/Supporting/Expo.plist" 2>/dev/null \
        && echo -e "${GREEN}✅ Updated ios/Wis/Supporting/Expo.plist (EXUpdatesRuntimeVersion)${NC}"
fi
if [ -f "./android/app/src/main/res/values/strings.xml" ]; then
    sed -i '' "s|<string name=\"expo_runtime_version\">.*</string>|<string name=\"expo_runtime_version\">${NEW_VERSION}</string>|" \
        "./android/app/src/main/res/values/strings.xml"
    echo -e "${GREEN}✅ Updated android strings.xml (expo_runtime_version)${NC}"
fi

# Git commit version bump
echo -e "${BLUE}📝 Committing version bump...${NC}"
git add app.json package.json
if [ -f "./ios/Wis/Info.plist" ]; then
    git add ./ios/Wis/Info.plist
fi
if [ -f "./android/app/build.gradle" ]; then
    git add ./android/app/build.gradle
fi
[ -f "./ios/Wis/Supporting/Expo.plist" ] && git add ./ios/Wis/Supporting/Expo.plist
[ -f "./android/app/src/main/res/values/strings.xml" ] && git add ./android/app/src/main/res/values/strings.xml
git commit -m "chore: bump version to ${NEW_VERSION} [ios + android]" || echo -e "${YELLOW}No changes to commit${NC}"

# Function to rollback version on failure
rollback_version() {
    echo -e "${RED}🔄 Rolling back version to ${OLD_VERSION}...${NC}"
    
    # Revert version in app.json
    node -e "
    const fs = require('fs');
    const appJson = require('./app.json');
    appJson.expo.version = '${OLD_VERSION}';
    appJson.expo.runtimeVersion = '${OLD_VERSION}';
    fs.writeFileSync('./app.json', JSON.stringify(appJson, null, 2) + '\n');
    "
    
    # Revert version in package.json
    node -e "
    const fs = require('fs');
    const packageJson = require('./package.json');
    packageJson.version = '${OLD_VERSION}';
    fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2) + '\n');
    "

    # Revert version in ios/Wis/Info.plist (bare workflow)
    if [ -f "./ios/Wis/Info.plist" ]; then
        /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${OLD_VERSION}" "./ios/Wis/Info.plist"
    fi

    # Revert version in android/app/build.gradle (bare workflow)
    if [ -f "./android/app/build.gradle" ]; then
        sed -i '' "s/versionName \".*\"/versionName \"${OLD_VERSION}\"/" "./android/app/build.gradle"
    fi
    
    # Amend the last commit or create revert commit
    git add app.json package.json
    if [ -f "./ios/Wis/Info.plist" ]; then
        git add ./ios/Wis/Info.plist
    fi
    if [ -f "./android/app/build.gradle" ]; then
        git add ./android/app/build.gradle
    fi
    git commit --amend -m "chore: bump version to ${OLD_VERSION} [ios + android] (reverted due to build failure)" --no-edit 2>/dev/null || \
    git commit -m "revert: rollback version to ${OLD_VERSION} due to build failure" 2>/dev/null || true
    
    echo -e "${YELLOW}⚠️  Version rolled back to ${OLD_VERSION}${NC}"
}

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🍎 Building iOS...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Build iOS với --no-bump vì đã bump ở trên
if ! ./scripts/build-ios.sh --no-bump $NO_SUBMIT; then
    echo -e "${RED}❌ iOS build failed!${NC}"
    rollback_version
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🤖 Building Android...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Build Android với --no-bump vì đã bump ở trên
if ! ./scripts/build-android.sh --no-bump $NO_SUBMIT; then
    echo -e "${RED}❌ Android build failed!${NC}"
    echo -e "${YELLOW}⚠️  iOS build succeeded, but Android failed.${NC}"
    echo -e "${YELLOW}⚠️  Version NOT rolled back since iOS was already built.${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   ✅ Both Platforms Released!${NC}"
echo -e "${CYAN}   Version: ${NEW_VERSION}${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}💡 Don't forget to push: git push${NC}"






