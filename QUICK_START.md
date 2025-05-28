# 🚀 Quick Start - Deploy Wiswork

## ⚡ Setup nhanh (5 phút)

### 1. Tạo Expo Token
```bash
# Đăng nhập EAS
eas login

# Tạo token tại: https://expo.dev/settings/access-tokens
# Copy token và thêm vào GitHub Secrets với tên: EXPO_TOKEN
```

### 2. Thêm GitHub Secrets
Vào GitHub repo → Settings → Secrets → Actions:
- `EXPO_TOKEN`: Token từ bước 1

### 3. Deploy ngay!
```bash
# Cách 1: Dùng script
npm run deploy

# Cách 2: Push code
git add .
git commit -m "setup deployment"
git push origin main

# Cách 3: Manual từ GitHub
# Vào Actions → "Build APK" → Run workflow
```

## 📱 Kết quả

### Android APK:
- **GitHub Releases**: Tự động tạo release với APK
- **GitHub Actions Artifacts**: Tải APK từ build logs
- **Thời gian**: ~10-15 phút

### iOS TestFlight:
- **Cần thêm**: Apple ID credentials trong GitHub Secrets
- **Tự động submit**: Khi push lên main branch
- **Thời gian**: ~15-20 phút

## 🔧 Commands hữu ích

```bash
# Deploy tất cả platforms
npm run deploy

# Deploy chỉ Android
npm run deploy:android

# Deploy chỉ iOS  
npm run deploy:ios

# Deploy và submit lên stores
npm run deploy:submit

# Build local
npm run build:android
npm run build:ios
```

## 📥 Tải APK

1. **GitHub Releases**: `https://github.com/[username]/[repo]/releases`
2. **GitHub Actions**: Repository → Actions → Build job → Artifacts

## ❓ Cần hỗ trợ?

Đọc file `DEPLOYMENT.md` để biết chi tiết hoặc tạo issue trong repo. 