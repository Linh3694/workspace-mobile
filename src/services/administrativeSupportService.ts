/**
 * Phân công PIC / khu vực CSVC — erp.api.erp_administrative.administrative_support
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';

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

const BASE = '/api/method/erp.api.erp_administrative.administrative_support';

export interface AdministrativeSupportAssignment {
  name: string;
  area_title: string;
  support_category: string;
  support_category_title: string;
  pic: string;
  pic_fullname: string;
  pic_email?: string;
  pic_user_image?: string;
}

function unwrapAssignments(response: {
  data?: { message?: { success?: boolean; data?: AdministrativeSupportAssignment[] }; exc?: string };
}): AdministrativeSupportAssignment[] {
  const msg = response?.data?.message ?? response?.data;
  if (msg && typeof msg === 'object' && 'success' in msg && (msg as { success?: boolean }).success === true) {
    const data = (msg as { data?: AdministrativeSupportAssignment[] }).data;
    return Array.isArray(data) ? data : [];
  }
  return [];
}

export async function getAllAdministrativeAssignments(): Promise<AdministrativeSupportAssignment[]> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${BASE}.get_all_assignments`, config);
    return unwrapAssignments(response);
  } catch (e) {
    console.error('getAllAdministrativeAssignments', e);
    return [];
  }
}
