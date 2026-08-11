import { notifySessionExpired } from './sessionExpiry';

/**
 * Fetch tới API Frappe cho luồng đăng nhập / OAuth mà không gửi cookie session cũ.
 * Tránh lỗi resume session với user=null ("User None is disabled") khi sid trong cookie jar bị hỏng.
 */
export async function fetchAuthNoCookies(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, { ...init, credentials: 'omit' });

  // Đây là chokepoint DUY NHẤT của màn Điểm danh: `attendanceApiService` và
  // `attendanceService` đi qua đây, còn `AttendanceHome` không có một lời gọi axios nào
  // — nên nếu không báo phiên chết ở đây thì giáo viên đang mở màn Điểm danh lúc token
  // bị từ chối sẽ ở lại đó vô thời hạn với danh sách rỗng, không có đường nào về đăng
  // nhập. `attendanceApiService` nuốt `!response.ok` thành `{success:false}`, không ném.
  //
  // Đặt ở đây thay vì trong từng service vì cả hai service đều nuốt lỗi theo cách riêng.
  // An toàn cho luồng đăng nhập (SignInScreen, microsoftAuthService): sai mật khẩu cũng
  // ra 401, nhưng handler trong AuthContext bỏ qua khi chưa có user đăng nhập.
  if (response.status === 401) {
    notifySessionExpired('fetchAuthNoCookies');
  }

  return response;
}
