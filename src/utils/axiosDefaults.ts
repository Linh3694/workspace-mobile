/**
 * React Native vẫn có thể gửi cookie session Frappe (sid) cùng Bearer → resume session hỏng (user=null) → HTTP 417.
 * API mobile chỉ cần Authorization; tắt credentials để axios không đính kèm cookie.
 */
import axios from 'axios';
import { API_BASE_URL } from '../config/constants';
import { notifySessionExpired } from './sessionExpiry';

axios.defaults.withCredentials = false;

/**
 * Bắt 401 ở tầng axios GLOBAL.
 *
 * Nhiều service (busService, ticketService, feedbackService, roomBookingService…)
 * gọi thẳng `axios.get/post` chứ không qua instance trong utils/api.ts, nên trước đây
 * 401 của chúng bị nuốt và chỉ hiện ra dưới dạng danh sách rỗng. File này được import
 * ngay dòng đầu App.tsx nên interceptor phủ được toàn bộ nhóm đó.
 *
 * LÝ DO: khi backend xoay jwt_secret, token cũ còn nguyên `exp` hợp lệ nên client
 * không tự biết nó chết — chỉ backend trả 401 mới biết. Nếu bỏ qua tín hiệu này,
 * app kẹt ở trạng thái "trông như đã đăng nhập nhưng mọi dữ liệu rỗng"; giáo viên
 * sẽ tin là lớp thật sự chưa điểm danh. Đẩy về màn hình đăng nhập là trung thực hơn.
 */
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || '';
    const baseURL: string = error?.config?.baseURL || '';
    // Chỉ xử lý 401 của CHÍNH backend mình, tránh 401 từ dịch vụ khác làm văng phiên.
    //
    // Cố ý KHÔNG coi "mọi URL tương đối" là backend mình: notification-service có thể
    // được trỏ sang host khác qua EXPO_PUBLIC_NOTIFICATION_API_BASE_URL và nó xác thực
    // bằng secret riêng — hôm nay hai URL trùng nhau nên vô hại, nhưng ngày nào đó tách
    // ra thì 401 của dịch vụ đó sẽ đá giáo viên ra khỏi một phiên đang hoàn toàn tốt.
    const isOwnBackend =
      `${baseURL}${url}`.startsWith(API_BASE_URL) ||
      (url.startsWith('/') && baseURL.startsWith(API_BASE_URL));
    if (status === 401 && isOwnBackend) {
      notifySessionExpired('axios global interceptor');
    }
    return Promise.reject(error);
  }
);
