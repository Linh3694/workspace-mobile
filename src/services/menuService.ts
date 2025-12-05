import { getApiBaseUrl } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for API response data
export interface MenuCategoryDetails {
  id: string;
  name: string;
  title_vn: string;
  title_en: string;
  display_name: string;
  display_name_en: string;
  image_url: string | null;
  code: string;
}

export interface BuffetEvent {
  date: string;
  name: string;
  type: 'buffet';
}

export interface BreakfastOption {
  menu_category_id: string;
  menu_category_details: MenuCategoryDetails | null;
}

export interface BreakfastOptions {
  option1: BreakfastOption;
  option2: BreakfastOption;
  external: BreakfastOption;
}

export interface LunchConfigItem {
  id: string;
  menu_category_id: string;
  menu_category_details: MenuCategoryDetails | null;
}

export interface LunchSetConfig {
  enabled: boolean;
  items: LunchConfigItem[];
}

export interface BuffetConfig {
  enabled: boolean;
  name_vn: string;
  name_en: string;
  items: LunchConfigItem[];
}

export interface DinnerItem {
  id: string;
  option_type: string;
  menu_category_id: string;
  menu_category_details: MenuCategoryDetails | null;
  education_stage: string;
}

export interface CalorieInfo {
  elementary: number;
  secondary: number;
}

export interface MealData {
  meal_type: string;
  menu_type: string;
  meal_type_reference: string;
  name: string;
  calories?: CalorieInfo;
  breakfast_options?: BreakfastOptions;
  set_a_config?: LunchSetConfig;
  set_au_config?: LunchSetConfig;
  eat_clean_config?: LunchSetConfig;
  buffet_config?: BuffetConfig;
  dinner_items?: DinnerItem[];
}

export interface DailyMenuData {
  name: string;
  menu_date: string;
  meals: MealData[];
}

export interface StandardApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

interface FrappeResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

class MenuService {
  private baseUrl = '/api/method/erp.api.parent_portal';

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem('authToken');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get daily menu by date
   */
  async getDailyMenuByDate(date: Date): Promise<StandardApiResponse<DailyMenuData>> {
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${getApiBaseUrl()}${this.baseUrl}.daily_menu.get_daily_menu_by_date?date=${dateStr}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const actualData = data.message || data;

      if (
        (actualData as FrappeResponse<DailyMenuData>).success &&
        (actualData as FrappeResponse<DailyMenuData>).data
      ) {
        return {
          success: true,
          data: (actualData as FrappeResponse<DailyMenuData>).data,
          message: (actualData as FrappeResponse<DailyMenuData>).message,
        };
      }

      return {
        success: false,
        message:
          (actualData as FrappeResponse<DailyMenuData>).message ||
          'Không thể tải thông tin thực đơn',
      };
    } catch (error: unknown) {
      console.error('Error fetching daily menu by date:', error);
      return {
        success: false,
        message: 'Không thể tải thông tin thực đơn',
      };
    }
  }

  /**
   * Get buffet events for a specific month
   */
  async getBuffetEventsByMonth(date: Date): Promise<StandardApiResponse<BuffetEvent[]>> {
    try {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString();

      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${getApiBaseUrl()}${this.baseUrl}.daily_menu.get_buffet_events_by_month?month=${month}&year=${year}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const actualData = data.message || data;

      if (
        (actualData as FrappeResponse<BuffetEvent[]>).success &&
        (actualData as FrappeResponse<BuffetEvent[]>).data
      ) {
        return {
          success: true,
          data: (actualData as FrappeResponse<BuffetEvent[]>).data,
          message: (actualData as FrappeResponse<BuffetEvent[]>).message,
        };
      }

      return {
        success: false,
        message:
          (actualData as FrappeResponse<BuffetEvent[]>).message || 'Không thể tải thông tin buffet',
      };
    } catch (error: unknown) {
      console.error('Error fetching buffet events:', error);
      return {
        success: false,
        message: 'Không thể tải thông tin buffet',
      };
    }
  }
}

const menuService = new MenuService();

export default menuService;
