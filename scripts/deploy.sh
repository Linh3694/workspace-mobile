#!/bin/bash

# Script để deploy ứng dụng Wiswork
# Sử dụng: ./scripts/deploy.sh [platform] [submit]
# platform: ios, android, all (default: all)
# submit: true, false (default: false)

set -e

PLATFORM=${1:-all}
SUBMIT=${2:-false}

echo "🚀 Deploying Wiswork..."
echo "📱 Platform: $PLATFORM"
echo "📤 Submit to store: $SUBMIT"

# Kiểm tra git status
if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️  Có thay đổi chưa commit. Commit trước khi deploy:"
    git status --short
    exit 1
fi

# Lấy branch hiện tại
CURRENT_BRANCH=$(git branch --show-current)
echo "🌿 Current branch: $CURRENT_BRANCH"

# Kiểm tra nếu không phải main/master
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    echo "⚠️  Bạn không ở branch main/master. Tiếp tục? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ Hủy deploy"
        exit 1
    fi
fi

# Push code lên GitHub
echo "📤 Pushing to GitHub..."
git push origin "$CURRENT_BRANCH"

# Tạo tag cho release
VERSION=$(date +"%Y%m%d-%H%M%S")
TAG="v$VERSION"

echo "🏷️  Creating tag: $TAG"
git tag "$TAG"
git push origin "$TAG"

echo "✅ Deploy triggered!"
echo ""
echo "📋 Theo dõi tiến trình:"
echo "   🌐 GitHub Actions: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"
echo "   📱 EAS Builds: https://expo.dev/accounts/$(eas whoami 2>/dev/null || echo '[username]')/projects/workspace/builds"
echo ""
echo "📥 Sau khi build xong:"
echo "   🤖 Android APK: GitHub Releases"
echo "   🍎 iOS: TestFlight (nếu submit = true)"
echo ""
echo "⏱️  Thời gian build dự kiến: 10-15 phút" 