/**
 * Fetch tới API Frappe cho luồng đăng nhập / OAuth mà không gửi cookie session cũ.
 * Tránh lỗi resume session với user=null ("User None is disabled") khi sid trong cookie jar bị hỏng.
 */
export async function fetchAuthNoCookies(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, { ...init, credentials: 'omit' });
}
