# Wislife - Social Media Feed

## Tổng quan
Wislife là tính năng mạng xã hội nội bộ cho phép nhân viên chia sẻ, tương tác và kết nối với nhau thông qua các bài viết.

## Tính năng chính

### 1. Xem Newfeed
- Hiển thị danh sách bài viết theo thời gian thực
- Pull-to-refresh để cập nhật bài viết mới
- Infinite scroll để tải thêm bài viết
- Tìm kiếm bài viết theo nội dung

### 2. Tạo bài viết
- Viết nội dung text
- Upload hình ảnh (tối đa 10 file)
- Upload video (tối đa 10 file)
- Chọn từ thư viện hoặc chụp ảnh trực tiếp
- Bài viết công khai cho tất cả nhân viên

### 3. Tương tác với bài viết
- 5 loại reaction: 👍 Like, ❤️ Love, 😂 Haha, 😢 Sad, 😮 Wow
- Bình luận trên bài viết
- Xem chi tiết hình ảnh trong modal
- Phát video với native controls

### 4. Quản lý bài viết
- Tác giả có thể xóa bài viết của mình
- Hiển thị thời gian đăng bài (relative time)
- Đếm số lượt reaction và comment

## Cấu trúc Component

### WislifeScreen
- Component chính hiển thị newfeed
- Quản lý state của danh sách bài viết
- Xử lý pagination và search

### PostCard
- Component hiển thị từng bài viết
- Xử lý reactions và comments
- Modal xem hình ảnh full screen

### CreatePostModal
- Modal tạo bài viết mới
- Image/Video picker integration
- Form validation

## API Integration

### Endpoints sử dụng
- `GET /api/posts/newsfeed` - Lấy danh sách bài viết
- `POST /api/posts` - Tạo bài viết mới
- `POST /api/posts/:id/reactions` - Thêm reaction
- `DELETE /api/posts/:id/reactions` - Xóa reaction
- `POST /api/posts/:id/comments` - Thêm comment
- `DELETE /api/posts/:id` - Xóa bài viết
- `GET /api/posts/search` - Tìm kiếm bài viết

### Authentication
Tất cả API calls đều yêu cầu Bearer token trong header Authorization.

## Dependencies
- `expo-av`: Video player
- `expo-image-picker`: Image/Video picker
- `@expo/vector-icons`: Icons
- `react-native-safe-area-context`: Safe area handling

## Cách sử dụng

1. **Xem bài viết**: Scroll để xem các bài viết, pull down để refresh
2. **Tạo bài viết**: Tap vào "Có gì mới?" hoặc icon search ở header
3. **Thêm media**: Trong modal tạo bài viết, tap "Thêm ảnh/video"
4. **React bài viết**: Tap vào emoji reactions hoặc nút "Thích"
5. **Comment**: Tap "Bình luận" và nhập nội dung
6. **Xem ảnh**: Tap vào ảnh để xem full screen
7. **Tìm kiếm**: Nhập từ khóa vào search bar và tap search

## Lưu ý
- Chỉ tác giả mới có thể xóa bài viết của mình
- Tối đa 10 file media cho mỗi bài viết
- Bài viết hiện tại chỉ ở chế độ công khai
- Video sẽ tự động pause khi scroll ra khỏi màn hình 