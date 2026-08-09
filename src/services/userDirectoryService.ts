/**
 * Danh bạ user nội bộ — picker "Người liên quan" của Vấn đề chung.
 *
 * Danh bạ rất dài nên tìm ở server, không tải hết về lọc client
 * (đồng bộ web `useUserPickerOptions`). Backend: `erp.api.erp_common_user.user_management`.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';

const BASE = '/api/method/erp.api.erp_common_user.user_management';

export interface DirectoryUser {
  /** Docname User = email trong Frappe */
  name: string;
  email: string;
  full_name?: string;
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

/**
 * Tìm user đang hoạt động theo tên / email.
 * Bỏ trống `searchTerm` thì trả về vài user đầu để picker không rỗng khi vừa mở.
 */
export async function searchUsersForPicker(
  searchTerm = '',
  limit = 40
): Promise<{ success: boolean; data: DirectoryUser[]; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const q = new URLSearchParams();
    q.append('limit', String(limit));
    q.append('active', '1');
    const term = (searchTerm || '').trim();
    if (term) q.append('search', term);

    const response = await axios.get(`${BASE}.get_users?${q.toString()}`, config);
    const msg = response?.data?.message ?? response?.data;
    const rows: any[] =
      msg?.success === true && Array.isArray(msg.data?.users) ? msg.data.users : [];

    return {
      success: true,
      data: rows
        .filter((u) => String(u?.email || '').trim())
        .map((u) => ({
          name: String(u.name || u.email).trim(),
          email: String(u.email).trim(),
          full_name: (u.full_name || '').trim() || undefined,
          user_image: u.user_image || null,
          job_title: u.job_title || null,
        })),
    };
  } catch (e: any) {
    return {
      success: false,
      data: [],
      message: e?.response?.data?.message || e?.message || 'Không tìm được người dùng',
    };
  }
}
