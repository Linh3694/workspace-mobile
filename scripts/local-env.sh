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
