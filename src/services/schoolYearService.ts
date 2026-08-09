/**
 * Năm học (SIS School Year) — form Vấn đề chung bắt buộc chọn năm học như web.
 * Backend: `erp.api.erp_sis.school_year`.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';

const BASE = '/api/method/erp.api.erp_sis.school_year';

export interface SchoolYear {
  name: string;
  title_vn?: string;
  title_en?: string;
  start_date?: string;
  end_date?: string;
  is_enable?: 0 | 1;
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

/** Nhãn hiển thị năm học — ưu tiên tiếng Việt, fallback docname */
export function schoolYearLabel(y: Pick<SchoolYear, 'name' | 'title_vn' | 'title_en'>): string {
  return (y.title_vn || y.title_en || y.name || '').trim() || y.name;
}

/**
 * Danh sách năm học, mới nhất trước (theo `start_date` giảm dần) — khớp thứ tự web IssueFormV2.
 */
export async function getAllSchoolYears(): Promise<{
  success: boolean;
  data: SchoolYear[];
  message?: string;
}> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${BASE}.get_all_school_years`, config);
    const msg = response?.data?.message ?? response?.data;
    if (msg?.success === true && Array.isArray(msg.data)) {
      const years = [...(msg.data as SchoolYear[])].sort((a, b) =>
        (b.start_date || '').localeCompare(a.start_date || '')
      );
      return { success: true, data: years };
    }
    return { success: false, data: [], message: msg?.message || 'Không tải được năm học' };
  } catch (e: any) {
    return {
      success: false,
      data: [],
      message: e?.response?.data?.message || e?.message || 'Lỗi kết nối',
    };
  }
}

/** Năm học đang bật; không có thì lấy năm mới nhất. */
export function pickDefaultSchoolYear(years: SchoolYear[]): SchoolYear | undefined {
  return years.find((y) => y.is_enable) || years[0];
}
