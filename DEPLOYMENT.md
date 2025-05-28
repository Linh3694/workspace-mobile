# 🚀 Hướng dẫn Deploy Wiswork với GitHub Actions

## 📋 Yêu cầu trước khi bắt đầu

### 1. Tài khoản cần thiết
- [x] Tài khoản GitHub
- [x] Tài khoản Expo/EAS
- [x] Apple Developer Account (cho iOS)
- [x] Google Play Console (cho Android - tùy chọn)

### 2. Cài đặt EAS CLI
```bash
npm install -g @expo/eas-cli
eas login
```

## 🔧 Cấu hình GitHub Secrets

Vào GitHub repository → Settings → Secrets and variables → Actions, thêm các secrets sau:

### Required Secrets:
1. **EXPO_TOKEN**: 
   ```bash
   # Tạo token từ Expo
   eas whoami
   # Vào https://expo.dev/accounts/[username]/settings/access-tokens
   # Tạo token mới và copy vào GitHub Secrets
   ```

### Cho iOS (TestFlight):
2. **APPLE_ID**: Email Apple ID của bạn
3. **APPLE_APP_SPECIFIC_PASSWORD**: App-specific password
4. **APPLE_TEAM_ID**: Team ID từ Apple Developer

### Cho Android (tùy chọn):
5. **GOOGLE_SERVICE_ACCOUNT_KEY**: JSON key cho Google Play Console

## 📱 Cấu hình ứng dụng

### 1. Cập nhật eas.json
Sửa file `eas.json` với thông tin của bạn:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id", 
        "appleTeamId": "your-apple-team-id"
      }
    }
  }
}
```

### 2. Lấy thông tin cần thiết

#### Apple Team ID:
```bash
# Cách 1: Từ Apple Developer Portal
# Vào https://developer.apple.com/account → Membership

# Cách 2: Từ EAS CLI
eas device:list
```

#### App Store Connect App ID:
```bash
# Vào App Store Connect → Apps → [Your App] → App Information
# Copy số ID từ URL: https://appstoreconnect.apple.com/apps/[APP_ID]/appstore
```

## 🚀 Cách sử dụng

### 1. Build tự động khi push code
```bash
git add .
git commit -m "feat: thêm tính năng mới"
git push origin main
```

### 2. Build thủ công
1. Vào GitHub repository
2. Actions → "Build và Deploy App"
3. Click "Run workflow"
4. Chọn platform (iOS/Android/All)
5. Chọn có submit lên store hay không

### 3. Build chỉ APK
1. Actions → "Build APK"
2. Click "Run workflow"
3. APK sẽ có trong Artifacts và GitHub Releases

## 📥 Tải APK

### Cách 1: Từ GitHub Releases
1. Vào repository → Releases
2. Tải file `.apk` từ Assets

### Cách 2: Từ GitHub Actions
1. Vào Actions → Build job đã hoàn thành
2. Scroll xuống "Artifacts"
3. Tải file APK

## 📱 Cài đặt APK trên Android

1. **Bật "Unknown Sources"**:
   - Settings → Security → Unknown Sources (Android < 8)
   - Settings → Apps → Special Access → Install Unknown Apps (Android 8+)

2. **Cài đặt**:
   - Tải APK về máy
   - Mở file APK
   - Nhấn "Install"

## 🍎 TestFlight cho iOS

1. **Tự động**: Khi push code lên main/master
2. **Thủ công**: Run workflow với option "Submit to store"
3. **Kiểm tra**: Vào App Store Connect → TestFlight

## 🔍 Troubleshooting

### Lỗi thường gặp:

#### 1. "EXPO_TOKEN is not set"
```bash
# Kiểm tra token
eas whoami
# Tạo token mới tại: https://expo.dev/settings/access-tokens
```

#### 2. "Apple credentials not found"
- Kiểm tra APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD trong GitHub Secrets
- Đảm bảo App-specific password được tạo đúng

#### 3. "Build failed"
```bash
# Kiểm tra logs trong GitHub Actions
# Thường do:
# - Dependencies không tương thích
# - Cấu hình sai trong app.json/eas.json
# - Thiếu permissions
```

#### 4. "APK download failed"
- Kiểm tra build có thành công không
- Đảm bảo có quyền truy cập EAS builds

## 📊 Monitoring

### Kiểm tra build status:
```bash
# Từ local
eas build:list

# Hoặc vào Expo dashboard
# https://expo.dev/accounts/[username]/projects/[project]/builds
```

### GitHub Actions logs:
- Vào repository → Actions
- Click vào workflow run để xem chi tiết

## 🔄 Tự động hóa nâng cao

### 1. Auto-increment version
Thêm vào `eas.json`:
```json
{
  "build": {
    "production": {
      "autoIncrement": true
    }
  }
}
```

### 2. Conditional deployment
- Push lên `main/master`: Auto deploy
- Push lên `develop`: Build preview
- Create tag `v*`: Create release với APK

### 3. Notifications
Có thể thêm Slack/Discord notifications vào workflow để thông báo khi build xong.

## 📞 Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra GitHub Actions logs
2. Kiểm tra EAS build logs
3. Đọc Expo documentation: https://docs.expo.dev/
4. Tạo issue trong repository này 