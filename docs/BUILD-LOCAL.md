# Build local + submit store (không tốn credit EAS cloud)

Cơ chế: `eas build --local` chạy đúng pipeline của EAS nhưng trên máy Mac, rồi `eas submit --path`
đẩy file lên App Store Connect / Google Play (submit miễn phí). Credentials (cert, provisioning,
keystore) và `buildNumber`/`versionCode` vẫn do EAS quản lý (`appVersionSource: remote`), nên
build local và build cloud dùng chung một dãy số, không xung đột.

## Cài 1 lần
```bash
npm run setup:local-build
```
Cài: fastlane, OpenJDK 17, Android cmdline-tools + platform/NDK khớp `app.json`, CocoaPods. Cần `eas login` sẵn.

## Release
```bash
npm run release:local              # bump patch → build iOS + Android SONG SONG → submit cả hai
npm run release:local:build-only   # chỉ build, file ở build/local/
npm run release:local:ios          # chỉ iOS (bump + build + submit)
npm run release:local:android      # chỉ Android
./scripts/release-local.sh --no-bump --only android   # build lại 1 nền tảng cùng version
./scripts/release-local.sh --submit-only              # chỉ submit file đã build
./scripts/release-local.sh --sequential               # build lần lượt nếu máy yếu
```

Đảm bảo iOS = Android: script bump **một lần** cho cả hai (app.json `version` + `runtimeVersion`,
package.json, Info.plist, build.gradle, Expo.plist, strings.xml) và commit trước khi build.

## Lưu ý
- `eas build --local` đóng gói từ **git**, nên cây phải sạch; script từ chối chạy nếu có thay đổi chưa commit.
- Log từng nền tảng: `build/local/logs/<platform>-<version>.log`. Đặt `EAS_LOCAL_BUILD_SKIP_CLEANUP=1` để giữ thư mục tạm khi lỗi.
- Cả hai nền tảng lỗi → tự hoàn version. Một nền tảng lỗi → giữ version, build lại bằng `--no-bump --only <platform>`.
- Muốn quay lại cloud: `npm run release:both` như cũ.
