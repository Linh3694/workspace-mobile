/**
 * Danh bạ user nội bộ — picker "Người liên quan" của Vấn đề chung.
 *
 * Danh bạ rất dài nên tìm ở server, không tải hết về lọc client
 * (đồng bộ web `useUserPickerOptions`). Backend: `erp.api.erp_common_user.user_management`.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';
import { formatPersonDisplayName } from '../utils/nameFormatter';

const BASE = '/api/method/erp.api.erp_common_user.user_management';

export interface DirectoryUser {
  /** Docname User = email trong Frappe */
  name: string;
  email: string;
  /** Nguyên văn từ Frappe — thứ tự có thể sai (xem `display_name`) */
  full_name?: string;
  /**
   * Tên để HIỂN THỊ. Frappe đồng bộ từ Microsoft/AD nên `full_name` hay đảo thành
   * "Tên + Họ đệm" ("Hiếu Nguyễn Duy"); đây là bản đã nắn về Họ Đệm Tên, fallback
   * local-part email khi không có tên.
   */
  display_name: string;
  user_image?: string | null;
  job_title?: string | null;
}

const getAxiosConfig = async () => {
  const token = await AsyncStorage.getItem('authToken');
  return {
    baseURL: BASE_URL,
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};

/** Số user mỗi lần tải — picker cuộn tới đáy thì xin trang kế */
export const USER_PAGE_SIZE = 30;

/**
 * Tìm user đang hoạt động theo tên / email, có phân trang.
 * Bỏ trống `searchTerm` thì trả về vài user đầu để picker không rỗng khi vừa mở.
 *
 * LƯU Ý HÌNH DẠNG PHẢN HỒI: `erp.api.erp_common_user.user_management.get_users` KHÔNG đi qua
 * `success_response`/`paginated_response` như phần lớn API khác — nó trả thẳng
 * `{ status: 'success', users: [...], pagination: {...} }`. Bản trước đọc theo khuôn chung
 * (`msg.success === true && msg.data.users`) nên KHÔNG BAO GIỜ khớp: picker "Người liên quan"
 * luôn báo "Không có lựa chọn nào" dù server trả đủ. Ở đây chấp nhận cả hai khuôn.
 */
export async function searchUsersForPicker(
  searchTerm = '',
  page = 1,
  limit = USER_PAGE_SIZE
): Promise<{ success: boolean; data: DirectoryUser[]; hasMore: boolean; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const q = new URLSearchParams();
    q.append('page', String(page));
    q.append('limit', String(limit));
    q.append('active', '1');
    const term = (searchTerm || '').trim();
    if (term) q.append('search', term);

    const response = await axios.get(`${BASE}.get_users?${q.toString()}`, config);
    const msg = response?.data?.message ?? response?.data;
    const payload = Array.isArray(msg?.users) ? msg : (msg?.data ?? msg);
    const rows: any[] = Array.isArray(payload?.users) ? payload.users : [];

    const totalPages = Number(payload?.pagination?.total_pages ?? 0);
    const hasMore = totalPages > 0 ? page < totalPages : rows.length >= limit;

    return {
      success: true,
      hasMore,
      data: rows
        .filter((u) => String(u?.email || '').trim())
        .map((u) => {
          const email = String(u.email).trim();
          const fullName = (u.full_name || '').trim() || undefined;
          return {
            name: String(u.name || email).trim(),
            email,
            full_name: fullName,
            display_name: formatPersonDisplayName(fullName, email),
            user_image: u.user_image || null,
            job_title: u.job_title || null,
          };
        }),
    };
  } catch (e: any) {
    return {
      success: false,
      data: [],
      hasMore: false,
      message: e?.response?.data?.message || e?.message || 'Không tìm được người dùng',
    };
  }
}
