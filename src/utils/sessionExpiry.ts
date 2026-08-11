/**
 * Cầu nối "phiên đã chết" giữa tầng network (axios interceptor, không phải React)
 * và AuthContext (giữ state `user`).
 *
 * LÝ DO PHẢI CÓ FILE NÀY:
 * Interceptor cũ chỉ xoá AsyncStorage khi gặp 401, nhưng KHÔNG đụng được vào state
 * React. Mà điều hướng của app dựa trên `isAuthenticated = !!user` (AuthContext) —
 * nên storage rỗng mà `user` vẫn còn thì app tiếp tục hiển thị màn hình đã đăng nhập
 * với dữ liệu rỗng. Với giáo viên, "lớp chưa ai điểm danh" / "chưa có tin nhắn" là
 * lời nói dối nguy hiểm hơn hẳn một màn hình đăng nhập: người ta ra quyết định
 * (gọi phụ huynh, báo vắng) dựa trên dữ liệu rỗng đó. Thà bắt đăng nhập lại.
 */

type SessionExpiredHandler = () => void | Promise<void>;

let handler: SessionExpiredHandler | null = null;

/** AuthContext đăng ký hàm xử lý; truyền null khi unmount. */
export const setSessionExpiredHandler = (fn: SessionExpiredHandler | null) => {
  handler = fn;
};

/**
 * Báo cho AuthContext biết token hiện tại đã bị backend từ chối (HTTP 401).
 * Không tự điều hướng ở đây — việc chống lặp (đang ở màn đăng nhập thì thôi)
 * do chính handler trong AuthContext quyết định, vì chỉ nó biết còn token/user hay không.
 */
export const notifySessionExpired = (source: string) => {
  console.warn(`[sessionExpiry] Token bị từ chối (401) tại: ${source}`);
  if (!handler) return;
  try {
    Promise.resolve(handler()).catch((e) =>
      console.warn('[sessionExpiry] handler lỗi:', e)
    );
  } catch (e) {
    console.warn('[sessionExpiry] handler lỗi:', e);
  }
};
