# Chat System Troubleshooting Guide

## 🛠️ Các vấn đề đã được sửa

### 1. ✅ WebSocket Connection Issues
- **Vấn đề**: Socket connection bị ngắt kết nối thường xuyên
- **Giải pháp**: 
  - Cải thiện cơ chế retry với exponential backoff
  - Thêm fallback từ WebSocket sang polling
  - Cải thiện error handling và cleanup
  - Thêm timeout cho các API calls

### 2. ✅ Input Field Not Clearing After Send
- **Vấn đề**: Tin nhắn sau khi gửi thành công nhưng input field không được clear
- **Giải pháp**:
  - Sửa logic trong `sendMessage` để chỉ clear input khi gửi thành công và có `_id`
  - Đảm bảo tất cả error cases return `null` thay vì `undefined`
  - Cải thiện condition check để tránh false positive

### 3. ✅ API Error Handling
- **Vấn đề**: Server trả về 404 HTML response thay vì JSON
- **Giải pháp**:
  - Kiểm tra Content-Type trước khi parse response
  - Thêm alternative endpoints để thử khi endpoint chính fail
  - Cải thiện error messages cho user
  - Thêm timeout cho fetch requests

## 🔧 Các tính năng mới

### Server Health Check
- Tự động kiểm tra server health khi component mount
- Log thông tin debug về các endpoints có sẵn
- Giúp identify server issues nhanh chóng

### Alternative Endpoints
- Tự động thử các endpoint khác nhau nếu endpoint chính fail:
  - `/api/chat/message`
  - `/api/messages`
  - `/api/chats/send-message`

### Enhanced Error Messages
- Error messages được localize sang tiếng Việt
- Phân biệt rõ giữa network error, server error, và timeout
- User-friendly messages thay vì technical errors

## 🚨 Troubleshooting Common Issues

### Lỗi "Failed to send message: 404"
**Nguyên nhân**: Server endpoint không tồn tại hoặc server chưa chạy

**Giải pháp**:
1. Kiểm tra server có đang chạy không
2. Xác nhận endpoint `/api/chats/message` có tồn tại
3. Kiểm tra logs để xem alternative endpoints có hoạt động không

### Socket connection error
**Nguyên nhân**: WebSocket connection bị reject hoặc server không hỗ trợ

**Giải pháp**:
1. Kiểm tra server có hỗ trợ WebSocket không
2. Kiểm tra firewall/proxy settings
3. System sẽ tự động fallback sang polling

### Input không clear sau khi gửi
**Nguyên nhân**: API response không có `_id` hoặc request thất bại

**Giải pháp**:
1. Kiểm tra console logs để xem response
2. Đảm bảo server trả về correct message format
3. Kiểm tra network connection

## 📊 Debug Information

Để bật debug mode, mở console và tìm các log messages:

- `🏥 Checking server health...` - Server health check
- `🔑 Debug send message:` - Send message info
- `📡 Response status:` - API response status
- `🔄 Trying alternative endpoint:` - Alternative endpoint attempts
- `✅ Sent new message:` - Successful message send

## 🔍 Monitoring

Các thống kê quan trọng được log:
- Socket connection status
- API response times
- Error rates
- Alternative endpoint success rates

## 🛠️ Configuration

Trong `src/config/constants.js`:
```javascript
export const API_BASE_URL = 'https://api-dev.wellspring.edu.vn';
```

Đảm bảo URL này đúng và server có thể access được. 