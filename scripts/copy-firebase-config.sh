#!/bin/bash

# Script to copy Firebase configuration files to native directories
# This ensures Firebase/FCM works correctly for push notifications

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔥 Checking Firebase configuration files..."

# ============================================
# Android: google-services.json
# ============================================
GOOGLE_SERVICES_SRC="./google-services.json"
GOOGLE_SERVICES_DEST="./android/app/google-services.json"

if [ -f "$GOOGLE_SERVICES_SRC" ]; then
    if [ -d "./android/app" ]; then
        cp "$GOOGLE_SERVICES_SRC" "$GOOGLE_SERVICES_DEST"
        echo -e "${GREEN}✅ [Android] Copied google-services.json to android/app/${NC}"
    else
        echo -e "${YELLOW}⚠️  [Android] android/app/ directory not found. Will be created during prebuild.${NC}"
    fi
else
    echo -e "${RED}❌ [Android] google-services.json not found in project root!${NC}"
    echo -e "${RED}   Download from Firebase Console > Project Settings > Android app${NC}"
fi

# ============================================
# iOS: GoogleService-Info.plist (if exists)
# ============================================
GOOGLE_SERVICE_PLIST_SRC="./GoogleService-Info.plist"
GOOGLE_SERVICE_PLIST_DEST="./ios/Wis/GoogleService-Info.plist"

if [ -f "$GOOGLE_SERVICE_PLIST_SRC" ]; then
    if [ -d "./ios/Wis" ]; then
        cp "$GOOGLE_SERVICE_PLIST_SRC" "$GOOGLE_SERVICE_PLIST_DEST"
        echo -e "${GREEN}✅ [iOS] Copied GoogleService-Info.plist to ios/Wis/${NC}"
    else
        echo -e "${YELLOW}⚠️  [iOS] ios/Wis/ directory not found. Will be created during prebuild.${NC}"
    fi
else
    echo -e "${YELLOW}ℹ️  [iOS] GoogleService-Info.plist not found (optional for Expo push notifications)${NC}"
fi

echo ""
echo "🔥 Firebase configuration check completed!"








