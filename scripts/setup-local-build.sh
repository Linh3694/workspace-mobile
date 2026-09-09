#!/usr/bin/env bash
# Cài 1 lần các công cụ để build local (không tốn credit EAS cloud).
# Dùng: ./scripts/setup-local-build.sh
set -e
cd "$(dirname "$0")/.."

echo "▶ Homebrew packages (fastlane, openjdk@17, android-commandlinetools)…"
brew list fastlane >/dev/null 2>&1 || brew install fastlane
brew list openjdk@17 >/dev/null 2>&1 || brew install openjdk@17
brew list --cask android-commandlinetools >/dev/null 2>&1 || brew install --cask android-commandlinetools
command -v pod >/dev/null || brew install cocoapods

source ./scripts/local-env.sh

# Lấy compileSdk / NDK từ app.json (expo-build-properties) để khớp với cloud build
COMPILE_SDK=$(node -p "(require('./app.json').expo.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-build-properties')||[])[1]?.android?.compileSdkVersion ?? 36")
NDK=$(node -p "(require('./app.json').expo.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-build-properties')||[])[1]?.android?.ndkVersion ?? '27.0.12077973'")

echo "▶ Android SDK: platform $COMPILE_SDK, NDK $NDK…"
yes | sdkmanager --licenses >/dev/null 2>&1 || true
sdkmanager "platform-tools" "platforms;android-${COMPILE_SDK}" "build-tools;${COMPILE_SDK}.0.0" "ndk;${NDK}" "cmake;3.22.1"

echo "▶ Kiểm tra:"
java -version 2>&1 | head -1
fastlane --version 2>/dev/null | tail -1
pod --version
eas whoami
echo "✅ Sẵn sàng. Build bằng: ./scripts/release-local.sh"
