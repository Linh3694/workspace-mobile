#!/usr/bin/env bash
# Môi trường để build local (eas build --local) trên macOS.
# Dùng: source ./scripts/local-env.sh
# Cài 1 lần: brew install fastlane openjdk@17 && brew install --cask android-commandlinetools
#            rồi chạy ./scripts/setup-local-build.sh để tải SDK/NDK.

# JDK 17 (Gradle của React Native 0.81 chưa chạy ổn với Java 24)
if [ -d "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
elif [ -d "$HOME/.gradle/jdks/eclipse_adoptium-17-aarch64-os_x.2" ]; then
  export JAVA_HOME="$(ls -d "$HOME"/.gradle/jdks/eclipse_adoptium-17-aarch64-os_x.2/*/Contents/Home | head -1)"
fi
[ -n "$JAVA_HOME" ] && export PATH="$JAVA_HOME/bin:$PATH"

# Android SDK (cask android-commandlinetools đặt SDK root ở đây)
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# EAS local build: giữ lại thư mục tạm khi lỗi để soi log
export EAS_LOCAL_BUILD_SKIP_CLEANUP="${EAS_LOCAL_BUILD_SKIP_CLEANUP:-0}"

# fastlane / CocoaPods yêu cầu locale UTF-8
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

# Prebuilt React Native (core + dependencies) lấy từ cache local nếu có.
# Lý do: 2026-09-10 Maven Central chuyển hướng sang repo.reactnative.dev và tarball 0.81.5 trả 404,
# RN quay về build từ source và fmt 11.0.2 không compile được với clang 21 (Xcode 26.6).
# Tarball lấy từ ios/Pods/ReactNativeDependencies-artifacts + ReactNativeCore-artifacts của một lần
# pod install thành công, copy vào ~/.rn-prebuilt/<rn-version>/. Chỉ dùng bản release (không hoán đổi debug/release).
_RN_VER=$(node -p "try{require('react-native/package.json').version}catch(e){''}" 2>/dev/null)
_RN_PRE="$HOME/.rn-prebuilt/$_RN_VER"
if [ -n "$_RN_VER" ] && [ -f "$_RN_PRE/reactnative-dependencies-$_RN_VER-release.tar.gz" ] && [ -f "$_RN_PRE/reactnative-core-$_RN_VER-release.tar.gz" ]; then
  export RCT_USE_LOCAL_RN_DEP="$_RN_PRE/reactnative-dependencies-$_RN_VER-release.tar.gz"
  export RCT_TESTONLY_RNCORE_TARBALL_PATH="$_RN_PRE/reactnative-core-$_RN_VER-release.tar.gz"
fi
unset _RN_VER _RN_PRE
