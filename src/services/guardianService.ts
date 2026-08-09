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

/**
 * Tìm phụ huynh theo tên / SĐT. Dưới 2 ký tự thì không gọi API (khớp web).
 */
export async function searchGuardiansForPicker(
  searchTerm: string,
  limit = 20
): Promise<{ success: boolean; data: GuardianPickerItem[]; message?: string }> {
  const term = (searchTerm || '').trim();
  if (term.length < 2) return { success: true, data: [] };

  try {
    const config = await getAxiosConfig();
    const url = `${BASE}.search_guardians?search_term=${encodeURIComponent(term)}&limit=${limit}`;
    const response = await axios.get(url, config);
    const msg = response?.data?.message ?? response?.data;
    const raw: any[] = msg?.success === true && Array.isArray(msg.data) ? msg.data : [];
    return {
      success: true,
      data: raw
        .filter((r) => r?.name)
        .map((r) => ({
          name: r.name,
          guardian_name: r.guardian_name || '',
          phone_number: r.phone_number || '',
          email: r.email || '',
        })),
    };
  } catch (e: any) {
    return {
      success: false,
      data: [],
      message: e?.response?.data?.message || e?.message || 'Không tìm được phụ huynh',
    };
  }
}
