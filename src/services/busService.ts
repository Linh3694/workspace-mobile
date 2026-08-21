/**
 * Bus Service
 * API service for Bus module in mobile app
 * Handles daily trips and attendance
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';

// Helper function to get axios config with auth token
const getAxiosConfig = async (additionalConfig: { headers?: Record<string, string> } = {}) => {
  const token = await AsyncStorage.getItem('authToken');
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const mergedHeaders = {
    ...defaultHeaders,
    ...(additionalConfig.headers || {}),
  };

  return {
    baseURL: API_BASE_URL,
    timeout: 30000,
    ...additionalConfig,
    headers: mergedHeaders,
  };
};

// Types
export interface BusMonitor {
  name: string;
  citizen_id: string;
  full_name: string;
  phone_number: string;
  campus_id: string;
  school_year_id: string;
  contractor?: string;
  address?: string;
}

export interface BusDailyTrip {
  name: string;
  route_id: string;
  route_name: string;
  trip_date: string;
  weekday: string;
  trip_type: 'Đón' | 'Trả';
  trip_status: 'Not Started' | 'In Progress' | 'Completed';
  vehicle_id?: string;
  bus_number?: string;
  license_plate?: string;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  monitor1_id?: string;
  monitor2_id?: string;
  total_students: number;
  boarded_count: number;
  dropped_count: number;
  absent_count: number;
  not_boarded_count: number;
  completion_percentage: number;
  started_at?: string;
  completed_at?: string;
  notes?: string;
}

export interface BusDailyTripStudent {
  name: string;
  daily_trip_id: string;
  student_id: string;
  student_code: string;
  student_name: string;
  class_name?: string;
  photo_url?: string;
  student_status: 'Not Boarded' | 'Boarded' | 'Dropped Off' | 'Absent';
  boarding_time?: string;
  drop_off_time?: string;
  absent_reason?: 'Nghỉ học' | 'Nghỉ ốm' | 'Nghỉ phép' | 'Lý do khác';
  pickup_location?: string;
  drop_off_location?: string;
  pickup_order?: number;
  notes?: string;
}

export interface TripsByDate {
  date: string;
  weekday: string;
  trips: BusDailyTrip[];
}

export interface TripDetailResponse {
  name: string;
  route_id: string;
  route_name: string;
  trip_date: string;
  weekday: string;
  trip_type: 'Đón' | 'Trả';
  trip_status: 'Not Started' | 'In Progress' | 'Completed';
  bus_number?: string;
  license_plate?: string;
  bus_model?: string;
  driver_name?: string;
  driver_phone?: string;
  students: BusDailyTripStudent[];
  statistics: {
    total_students: number;
    not_boarded: number;
    boarded: number;
    dropped_off: number;
    absent: number;
  };
  warnings: string[];
}

/** Năm kết quả của một lượt quét. Cả năm đều về theo đường `success: true` —
 *  `success: false` chỉ dành cho lỗi xác thực, lỗi quyền, và lỗi dịch vụ. */
export type FaceScanResultKind =
  /** Đã điểm danh tự động */
  | 'checked_in'
  /** Có em khớp nhưng chưa đủ chắc — giám sát bấm xác nhận */
  | 'confirm'
  /** Không em nào trong chuyến khớp */
  | 'unknown'
  /** Không thấy khuôn mặt trong ảnh — chụp lại */
  | 'no_face'
  /** Em này đã được điểm danh từ trước */
  | 'already';

export interface FaceScanStudent {
  student_id: string;
  student_name: string;
  student_code: string;
  class_name?: string;
  current_status: string;
}

export interface FaceScanData {
  trip_id: string;
  result: FaceScanResultKind;
  /** `null` ở CẢ `unknown` lẫn `no_face` — backend cố ý không đưa ra một cái tên
   *  gần như chắc chắn sai để giám sát khỏi bấm bừa theo gợi ý của máy. */
  student: FaceScanStudent | null;
  /** Không có ở `no_face` */
  similarity?: number;
  /** `null` khi tập ứng viên chỉ có một em */
  margin?: number | null;
  /** Nguồn ảnh đã đăng ký. Không phải `Bus` thì backend không bao giờ tự động
   *  điểm danh — ảnh hồ sơ/FaceID là ảnh studio đã chỉnh sửa, khác mặt thật. */
  photo_source?: 'Bus' | 'FaceID' | 'SIS' | null;
  reason?: string;
  status?: string;
  method?: string;
  timestamp?: string;
  trip_auto_started?: boolean;
  thresholds?: { high: number; low: number; min_margin: number };
  elapsed_ms?: number | null;
  candidates_searched?: number | null;
  /** Chỉ có ở nhánh lỗi: `manual` = dịch vụ hỏng, chuyển sang điểm danh tay;
   *  `retake` = ảnh không dùng được, chụp lại. */
  fallback?: 'manual' | 'retake';
}

/** Backend trả `message` là chuỗi ở mọi nhánh bình thường, nhưng vài endpoint cũ
 *  lỡ truyền cả dict vào đó. Đưa thẳng một object vào `<Text>` là màn hình trắng
 *  kèm "Objects are not valid as a React child" — chặn ngay tại tầng service. */
function toMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
}

/** Gỡ lớp bọc `message` của Frappe rồi chuẩn hoá envelope. */
function normalizeBusResponse<T>(
  raw: any,
  fallbackMessage: string
): { success: boolean; message?: string; data?: T; code?: string } {
  const result = raw?.message ?? raw;
  return {
    success: Boolean(result?.success),
    message: toMessage(result?.message, fallbackMessage),
    data: result?.data,
    code: typeof result?.code === 'string' ? result.code : undefined,
  };
}

/** Lỗi mạng/timeout cũng phải ra `fallback: 'manual'` — với giám sát đứng trước
 *  cửa xe thì "mất mạng" và "dịch vụ chết" là cùng một việc: chuyển sang bấm tay. */
function busErrorToResult(
  error: any,
  fallbackMessage: string
): { success: boolean; message?: string; data?: FaceScanData; code?: string } {
  const body = error?.response?.data?.message ?? error?.response?.data;
  const coMang = Boolean(error?.response);
  return {
    success: false,
    message: toMessage(body?.message, coMang ? fallbackMessage : 'Mất kết nối tới hệ thống'),
    code: typeof body?.code === 'string' ? body.code : coMang ? undefined : 'NETWORK_ERROR',
    data: { ...(body?.data || {}), fallback: body?.data?.fallback || 'manual' } as FaceScanData,
  };
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    monitor: BusMonitor;
    user: {
      email: string;
      full_name: string;
      roles: string[];
    };
    campus: {
      name: string;
      title_vn: string;
      title_en: string;
      short_title?: string;
    };
    school_year: {
      name: string;
      title_vn: string;
      title_en: string;
    };
    token: string;
    expires_in: number;
  };
  logs?: string[];
}

// API endpoints
const BUS_API = '/api/method/erp.api.bus_application';

class BusService {
  /**
   * Login monitor with phone number and password
   */
  async loginWithPassword(phoneNumber: string, password: string): Promise<LoginResponse> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.auth.login_with_password`,
        { phone_number: phoneNumber, password },
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Đăng nhập thất bại',
      };
    }
  }

  /**
   * Request OTP for phone number login
   */
  async requestOtp(phoneNumber: string): Promise<{ success: boolean; message: string }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.auth.request_otp`,
        { phone_number: phoneNumber },
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Request OTP error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể gửi mã OTP',
      };
    }
  }

  /**
   * Verify OTP and login
   */
  async verifyOtpAndLogin(phoneNumber: string, otp: string): Promise<LoginResponse> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.auth.verify_otp_and_login`,
        { phone_number: phoneNumber, otp },
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Xác thực thất bại',
      };
    }
  }

  /**
   * Get monitor profile
   */
  async getMonitorProfile(): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.get(
        `${config.baseURL}${BUS_API}.auth.get_monitor_profile`,
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Get profile error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể tải thông tin',
      };
    }
  }

  /**
   * Get daily trips for monitor by date range
   */
  async getDailyTripsByDateRange(
    startDate?: string,
    endDate?: string
  ): Promise<{ success: boolean; data?: TripsByDate[]; message?: string }> {
    try {
      const config = await getAxiosConfig();
      const params: Record<string, string> = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await axios.get(
        `${config.baseURL}${BUS_API}.daily_trip.get_monitor_trips_by_date_range`,
        { ...config, params }
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Get trips error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể tải danh sách chuyến xe',
      };
    }
  }

  /**
   * Get daily trips for a specific date
   */
  async getDailyTripsForDate(
    date?: string
  ): Promise<{ success: boolean; data?: BusDailyTrip[]; message?: string }> {
    try {
      const config = await getAxiosConfig();
      const params: Record<string, string> = {};
      if (date) params.date = date;

      const response = await axios.get(
        `${config.baseURL}${BUS_API}.daily_trip.get_monitor_daily_trips`,
        { ...config, params }
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Get daily trips error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể tải danh sách chuyến xe',
      };
    }
  }

  /**
   * Get daily trip detail with students
   */
  async getDailyTripDetail(tripId: string): Promise<{ success: boolean; data?: TripDetailResponse; message?: string }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.get(
        `${config.baseURL}${BUS_API}.daily_trip.get_daily_trip_detail`,
        { ...config, params: { trip_id: tripId } }
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Get trip detail error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể tải chi tiết chuyến xe',
      };
    }
  }

  /**
   * Start a daily trip
   */
  async startTrip(tripId: string): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.daily_trip.start_daily_trip`,
        { trip_id: tripId },
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Start trip error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể bắt đầu chuyến xe',
      };
    }
  }

  /**
   * Complete a daily trip
   */
  async completeTrip(tripId: string, force: boolean = false): Promise<{ 
    success: boolean; 
    message?: string; 
    data?: any;
    warnings?: string[];
    can_force?: boolean;
  }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.daily_trip.complete_daily_trip`,
        { trip_id: tripId, force },
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Complete trip error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể hoàn thành chuyến xe',
      };
    }
  }

  /**
   * Update student status in trip
   */
  async updateStudentStatus(
    dailyTripStudentId: string,
    studentStatus: 'Not Boarded' | 'Boarded' | 'Dropped Off' | 'Absent',
    absentReason?: string,
    notes?: string
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.daily_trip.update_student_status`,
        {
          daily_trip_student_id: dailyTripStudentId,
          student_status: studentStatus,
          absent_reason: absentReason,
          notes,
        },
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Update student status error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể cập nhật trạng thái',
      };
    }
  }

  /** Monitor ghi nhận xét — chỉ sửa `notes`, không đổi trạng thái điểm danh. */
  async updateStudentNotes(
    dailyTripStudentId: string,
    notes: string
  ): Promise<{ success: boolean; message?: string; data?: { notes?: string } }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.daily_trip.update_student_notes`,
        {
          daily_trip_student_id: dailyTripStudentId,
          notes,
        },
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Update student notes error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể lưu nhận xét',
      };
    }
  }

  /**
   * Quét một ảnh và điểm danh nếu hệ thống đủ chắc chắn.
   *
   * `imageBase64` là base64 TRẦN, không kèm tiền tố `data:image/jpeg;base64,`.
   * Dịch vụ nhận diện chấp nhận cả hai dạng, nhưng giới hạn dung lượng được kiểm
   * trên chính chuỗi base64 nên tiền tố chỉ làm ảnh "to" lên vô ích.
   */
  async scanCheckin(
    tripId: string,
    imageBase64: string
  ): Promise<{ success: boolean; message?: string; data?: FaceScanData; code?: string }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.face_scan.scan_checkin`,
        { trip_id: tripId, image: imageBase64 },
        config
      );
      return normalizeBusResponse(response.data, 'Không nhận diện được');
    } catch (error) {
      return busErrorToResult(error, 'Không nhận diện được');
    }
  }

  /**
   * Giám sát bấm xác nhận cho kết quả nằm ở vùng ngờ.
   *
   * Khoá theo `student_id` (docname CRM Student) chứ không phải id dòng con của
   * chuyến — đúng bằng giá trị mà `scanCheckin` trả về trong `data.student`. Đây là
   * hệ khoá thứ ba trong module này, bên cạnh `updateStudentStatus` (khoá theo dòng
   * con) — dễ nhầm nên ghi rõ ở đây.
   */
  async confirmScanCheckin(
    tripId: string,
    studentId: string
  ): Promise<{ success: boolean; message?: string; data?: FaceScanData; code?: string }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.face_scan.confirm_scan_checkin`,
        { trip_id: tripId, student_id: studentId },
        config
      );
      return normalizeBusResponse(response.data, 'Không điểm danh được');
    } catch (error) {
      return busErrorToResult(error, 'Không điểm danh được');
    }
  }

  /**
   * Refresh auth token
   */
  async refreshToken(): Promise<{ success: boolean; data?: { token: string }; message?: string }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.auth.refresh_token`,
        {},
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Refresh token error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể làm mới token',
      };
    }
  }
}

export const busService = new BusService();
export default busService;

