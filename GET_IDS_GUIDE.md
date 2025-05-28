# 🔍 Hướng dẫn lấy App Store Connect App ID và Apple Team ID

## ✅ Đã có sẵn:
- **Apple ID**: `developer@wellspring.edu.vn` 
- **Apple Team ID**: `2D237L9M35` (đã lấy từ EAS CLI)

## 🔄 Còn cần lấy:

### **App Store Connect App ID** (`ascAppId`)

#### Cách 1: Từ App Store Connect (Nếu app đã có trên App Store)
1. **Đăng nhập**: https://appstoreconnect.apple.com
2. **Vào My Apps** → Chọn app "Wiswork"
3. **Xem App Information** 
4. **Tìm Apple ID** trong thông tin app
5. **Copy số ID** (thường là 10 chữ số)

**Ví dụ URL:** `https://appstoreconnect.apple.com/apps/1234567890/appstore`
→ App ID = `1234567890`

#### Cách 2: Nếu app chưa có trên App Store
1. **Tạo app record mới** trong App Store Connect:
   - Vào My Apps → Click (+) → New App
   - Điền thông tin app
   - Sau khi tạo, App ID sẽ được generate tự động

#### Cách 3: Từ EAS CLI (Nếu đã submit trước đó)
```bash
# Kiểm tra submission history
eas submit:list --platform ios

# Hoặc check build info
eas build:list --platform ios
```

## 📝 Cập nhật eas.json

Sau khi có App Store Connect App ID, cập nhật file `eas.json`:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "developer@wellspring.edu.vn",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID_HERE",
        "appleTeamId": "2D237L9M35"
      }
    }
  }
}
```

## 🚀 Sau khi có đủ thông tin

### 1. Cập nhật GitHub Secrets
Vào GitHub repo → Settings → Secrets → Actions, thêm:
- `EXPO_TOKEN`: Token từ Expo
- `APPLE_ID`: `developer@wellspring.edu.vn`
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password từ Apple ID

### 2. Tạo App-Specific Password
1. Vào https://appleid.apple.com
2. Sign In & Security → App-Specific Passwords
3. Generate password cho "EAS CLI" hoặc "GitHub Actions"
4. Copy password và thêm vào GitHub Secrets

### 3. Test deployment
```bash
# Test build local trước
eas build --platform ios --profile production

# Nếu thành công, deploy với GitHub Actions
npm run deploy
```

## 🔍 Troubleshooting

### Nếu không tìm thấy App Store Connect App ID:
1. **App chưa được tạo**: Tạo app record mới trong App Store Connect
2. **Không có quyền truy cập**: Kiểm tra role trong Apple Developer Program
3. **App thuộc team khác**: Đảm bảo đang dùng đúng Apple ID

### Nếu Apple Team ID không đúng:
```bash
# Kiểm tra lại team
eas device:list

# Hoặc check từ Apple Developer Portal
# https://developer.apple.com/account → Membership
```

## 📞 Liên hệ hỗ trợ

Nếu gặp khó khăn:
1. Kiểm tra Apple Developer Program membership
2. Đảm bảo có quyền App Manager hoặc Admin
3. Liên hệ Apple Developer Support nếu cần 