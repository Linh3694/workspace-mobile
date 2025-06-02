# Tính năng Like và Reply Comment

## Tổng quan
Đã xây dựng hoàn chỉnh tính năng like và reply comment cho ứng dụng WIS, bao gồm cả backend API và frontend UI.

## Các tính năng đã implement

### 1. Like Comment (Reaction Comment)
- ✅ Người dùng có thể like/unlike comment
- ✅ Hỗ trợ nhiều loại reaction (emoji) cho comment
- ✅ Hiển thị số lượng reactions và loại reactions
- ✅ Hiển thị trạng thái đã like/chưa like
- ✅ Real-time update khi có reaction mới

### 2. Reply Comment (Nested Comments)
- ✅ Người dùng có thể reply vào comment
- ✅ Hiển thị replies dưới dạng nested (1 level)
- ✅ Reply indicator hiển thị tên người đang được reply
- ✅ Sắp xếp replies theo thời gian (cũ đến mới)
- ✅ Hỗ trợ @mention trong reply

### 3. UI/UX Improvements
- ✅ Hiển thị reactions với emoji/icon
- ✅ Loading states khi đang xử lý
- ✅ Error handling với thông báo lỗi
- ✅ Responsive design cho mobile
- ✅ Smooth animations và transitions

## Backend Changes

### 1. Database Schema (Post.js)
```javascript
const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  reactions: [reactionSchema],
  // Thêm support cho replies
  parentComment: { type: mongoose.Schema.Types.ObjectId, default: null },
  replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  isDeleted: { type: Boolean, default: false }
});
```

### 2. New API Endpoints
```
POST   /api/posts/:postId/comments/:commentId/reactions    # Thêm reaction cho comment
DELETE /api/posts/:postId/comments/:commentId/reactions    # Xóa reaction khỏi comment  
POST   /api/posts/:postId/comments/:commentId/replies      # Reply comment
```

### 3. New Controllers
- `addCommentReaction()` - Xử lý thêm/cập nhật reaction cho comment
- `removeCommentReaction()` - Xử lý xóa reaction khỏi comment
- `replyComment()` - Xử lý reply comment với validation

### 4. Notification System
- `sendCommentReactionNotification()` - Thông báo khi có người reaction comment
- `sendCommentReplyNotification()` - Thông báo khi có người reply comment

## Frontend Changes

### 1. Service Layer (postService.ts)
```typescript
// Thêm các methods mới
addCommentReaction(postId: string, commentId: string, type: string): Promise<Post>
removeCommentReaction(postId: string, commentId: string): Promise<Post>
replyComment(postId: string, commentId: string, content: string): Promise<Post>
```

### 2. Type Definitions (post.ts)
```typescript
export interface Comment {
  _id: string;
  user: User;
  content: string;
  createdAt: string;
  reactions: Reaction[];
  parentComment?: string | null; // Thêm field mới
}
```

### 3. UI Components (CommentsModal.tsx)
- Cập nhật cách sắp xếp và hiển thị comments
- Thêm nested replies với indent
- Hiển thị reactions với emoji
- Reply indicator với tên người được reply
- Loading states và error handling

## Cách sử dụng

### 1. Like Comment
1. Nhấn vào nút "Thích" dưới comment
2. Hoặc nhấn giữ để chọn emoji reaction khác
3. Nhấn lại để unlike

### 2. Reply Comment  
1. Nhấn vào nút "Trả lời" dưới comment
2. Nhập nội dung reply (có thể @mention)
3. Nhấn Send để gửi reply
4. Nhấn X để hủy reply

### 3. View Reactions
- Reactions hiển thị dưới comment với emoji và số lượng
- Màu sắc khác nhau cho trạng thái đã/chưa reaction

## Technical Notes

### 1. Data Structure
- Comments được tổ chức thành 2 loại: main comments và replies
- Replies có `parentComment` field trỏ đến main comment
- Chỉ hỗ trợ 1 level nesting (reply của reply sẽ thành reply của main comment)

### 2. Performance
- Sử dụng populate để load user data
- Efficient sorting và filtering
- Minimal re-renders với React state management

### 3. Error Handling
- Validation ở cả frontend và backend
- Graceful error messages
- Rollback states khi có lỗi

## Testing
Đã test các scenarios:
- ✅ Like/unlike comment
- ✅ Multiple reactions trên cùng comment
- ✅ Reply comment với @mention
- ✅ Nested replies display
- ✅ Real-time updates
- ✅ Error handling
- ✅ Loading states
- ✅ Notifications

## Future Enhancements
- [ ] Edit/delete replies
- [ ] More reaction types
- [ ] Reaction analytics
- [ ] Comment threading (multiple levels)
- [ ] Rich text formatting in comments 