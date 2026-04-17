import api from '../utils/api';

// ===== INTERFACES =====

export interface DiseaseClassificationItem {
  name: string;
  title: string;
  description?: string;
  campus?: string;
}

export interface MedicineItem {
  name: string;
  title: string;
  description?: string;
  unit?: string;
  campus?: string;
}

export interface FirstAidItem {
  name: string;
  title: string;
  description?: string;
  unit?: string;
  campus?: string;
}

// ===== SERVICE =====

const BASE_URL = '/method/erp.api.erp_sis.daily_health';

const healthConfigService = {
  /**
   * Lấy danh sách phân loại bệnh
   */
  async getDiseaseClassifications(campus?: string): Promise<DiseaseClassificationItem[]> {
    try {
      const params = campus ? { campus } : {};
      const response = await api.get(`${BASE_URL}.get_disease_classifications`, { params });
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        // Backend trả về { data: { data: [...], total: n } }
        return messageData.data.data || messageData.data || [];
      }
      if (response.data?.success && response.data?.data) {
        return response.data.data.data || response.data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching disease classifications:', error);
      return [];
    }
  },

  /**
   * Lấy danh sách thuốc
   */
  async getMedicines(campus?: string): Promise<MedicineItem[]> {
    try {
      const params = campus ? { campus } : {};
      const response = await api.get(`${BASE_URL}.get_medicines`, { params });
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        return messageData.data.data || messageData.data || [];
      }
      if (response.data?.success && response.data?.data) {
        return response.data.data.data || response.data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching medicines:', error);
      return [];
    }
  },

  /**
   * Lấy danh sách vật tư sơ cứu
   */
  async getFirstAidItems(campus?: string): Promise<FirstAidItem[]> {
    try {
      const params = campus ? { campus } : {};
      const response = await api.get(`${BASE_URL}.get_first_aid_items`, { params });
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        return messageData.data.data || messageData.data || [];
      }
      if (response.data?.success && response.data?.data) {
        return response.data.data.data || response.data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching first aid items:', error);
      return [];
    }
  },
};

export default healthConfigService;
