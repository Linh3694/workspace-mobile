/**
 * Tòa nhà hành chính — erp.api.erp_administrative.building
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

const BASE = '/api/method/erp.api.erp_administrative.building';

export interface Building {
  name: string;
  title_vn?: string;
  title_en?: string;
  short_title?: string;
}

function unwrapBuildings(response: {
  data?: { message?: { success?: boolean; data?: Building[] }; exc?: string };
}): Building[] {
  const msg = response?.data?.message ?? response?.data;
  if (msg && typeof msg === 'object' && 'success' in msg && (msg as { success?: boolean }).success === true) {
    const data = (msg as { data?: Building[] }).data;
    return Array.isArray(data) ? data : [];
  }
  return [];
}

export async function getAllBuildings(): Promise<Building[]> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${BASE}.get_all_buildings`, config);
    return unwrapBuildings(response);
  } catch (e) {
    console.error('getAllBuildings', e);
    return [];
  }
}
