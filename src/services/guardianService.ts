/**
 * Phụ huynh (CRM Guardian) — picker "Phụ huynh liên quan" của Vấn đề chung.
 * Backend: `erp.api.erp_sis.guardian.search_guardians`.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';

const BASE = '/api/method/erp.api.erp_sis.guardian';

export interface GuardianPickerItem {
  name: string;
  guardian_name?: string;
  phone_number?: string;
  email?: string;
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

/** Số phụ huynh mỗi lần tải — picker cuộn tới đáy thì xin trang kế */
export const GUARDIAN_PAGE_SIZE = 20;

/**
 * Tìm phụ huynh theo tên / SĐT, có phân trang. Dưới 2 ký tự thì không gọi API (khớp web).
 *
 * `erp.api.erp_sis.guardian.search_guardians` nhận `page`/`limit` và trả `pagination`
 * (current_page / total_pages / total_count), nên `hasMore` đọc thẳng từ đó.
 */
export async function searchGuardiansForPicker(
  searchTerm: string,
  page = 1,
  limit = GUARDIAN_PAGE_SIZE
): Promise<{
  success: boolean;
  data: GuardianPickerItem[];
  hasMore: boolean;
  message?: string;
}> {
  const term = (searchTerm || '').trim();
  if (term.length < 2) return { success: true, data: [], hasMore: false };

  try {
    const config = await getAxiosConfig();
    const url = `${BASE}.search_guardians?search_term=${encodeURIComponent(term)}&page=${page}&limit=${limit}`;
    const response = await axios.get(url, config);
    const msg = response?.data?.message ?? response?.data;
    const raw: any[] = msg?.success === true && Array.isArray(msg.data) ? msg.data : [];
    const rows = raw
      .filter((r) => r?.name)
      .map((r) => ({
        name: r.name,
        guardian_name: r.guardian_name || '',
        phone_number: r.phone_number || '',
        email: r.email || '',
      }));
    const totalPages = Number(msg?.pagination?.total_pages ?? 0);
    // Thiếu `pagination` (bản backend cũ) thì suy từ số dòng: đủ trần nghĩa là còn nữa
    const hasMore = totalPages > 0 ? page < totalPages : rows.length >= limit;
    return { success: true, data: rows, hasMore };
  } catch (e: any) {
    return {
      success: false,
      data: [],
      hasMore: false,
      message: e?.response?.data?.message || e?.message || 'Không tìm được phụ huynh',
    };
  }
}
