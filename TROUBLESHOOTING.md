# 🛠️ Hướng dẫn khắc phục lỗi EAS Build

## ❌ Lỗi: "An Expo user account is required to proceed"

### Nguyên nhân:
- Thiếu EXPO_TOKEN trong GitHub Secrets
- EXPO_TOKEN không hợp lệ hoặc đã hết hạn
- Không có quyền truy cập vào project

### Giải pháp:

#### 1. Tạo EXPO_TOKEN mới:
```bash
# Mở trang tạo token
open https://expo.dev/accounts/[username]/settings/access-tokens
```

#### 2. Thêm token vào GitHub:
- Vào: `https://github.com/[username]/[repo]/settings/secrets/actions`
- Tạo secret mới với tên: `EXPO_TOKEN`
- Dán token vừa tạo vào Value

#### 3. Kiểm tra cấu hình dự án:
```bash
# Kiểm tra thông tin project
eas project:info

# Kiểm tra build profiles
eas build:list --limit 5
```

## ⚙️ Cấu hình bổ sung cho iOS

### 1. Cấu hình Apple credentials:
```bash
# Thiết lập credentials cho iOS
eas credentials

# Chọn iOS -> Distribution Certificate -> Generate new certificate
```

### 2. Cập nhật eas.json:
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABC123DEFG"
      }
    }
  }
}
```

### 3. Thêm ASC API Key (tuỳ chọn):
```yaml
env:
  EXPO_ASC_API_KEY_PATH: ${{ secrets.ASC_API_KEY_PATH }}
  EXPO_ASC_KEY_ID: ${{ secrets.ASC_KEY_ID }}
  EXPO_ASC_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
```

## 🔧 Lệnh hữu ích:

```bash
# Build thủ công để test
eas build --platform ios --profile production

# Kiểm tra status của build
eas build:list --status=in-progress

# Login lại nếu cần
eas logout && eas login

# Cập nhật EAS CLI
npm install -g @expo/eas-cli@latest
```

## 📱 Test build local:

```bash
# Build development
eas build --platform ios --profile development

# Build preview
eas build --platform ios --profile preview
```

## 🚨 Lưu ý quan trọng:

1. **EXPO_TOKEN chỉ hiện 1 lần** - lưu ngay sau khi tạo
2. **Apple Developer Account** cần có quyền phù hợp
3. **Bundle Identifier** phải khớp với Apple Developer Portal
4. **Provisioning Profile** cần được tạo cho đúng bundle ID

## 📞 Liên hệ hỗ trợ:

- GitHub Issues: [Tạo issue mới](../../issues/new)
- Expo Forums: https://forums.expo.dev/
- Documentation: https://docs.expo.dev/ 