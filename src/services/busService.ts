/**
 * Bus Service
 * API service for Bus module in mobile app
 * Handles daily trips, attendance, face recognition
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
  monitor_code: string;
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

export interface FaceRecognitionResult {
  recognized: boolean;
  checked_in: boolean;
  message: string;
  student?: {
    student_id: string;
    student_code: string;
    student_name: string;
    class_name?: string;
    current_status: string;
  };
  recognition?: {
    similarity: number;
    confidence: 'high' | 'medium' | 'low';
  };
  new_status?: string;
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

  /**
   * Recognize student face (without auto check-in)
   */
  async recognizeStudentFace(
    imageBase64: string,
    campusId: string,
    schoolYearId: string,
    tripId?: string
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.face_recognition.recognize_student_face`,
        {
          image: imageBase64,
          campus_id: campusId,
          school_year_id: schoolYearId,
          trip_id: tripId,
        },
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Recognize face error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Nhận diện khuôn mặt thất bại',
      };
    }
  }

  /**
   * Verify student face and auto check-in
   */
  async verifyAndCheckin(
    imageBase64: string,
    tripId: string,
    autoCheckin: boolean = true
  ): Promise<{ success: boolean; message?: string; data?: FaceRecognitionResult }> {
    try {
      console.log('========================================');
      console.log('[BusService] 🚀 CALLING verify_and_checkin API');
      console.log('========================================');
      console.log(`[BusService] Trip ID: ${tripId}`);
      console.log(`[BusService] Auto checkin: ${autoCheckin}`);
      console.log(`[BusService] Image data length: ${imageBase64?.length || 0} chars`);
      
      const config = await getAxiosConfig();
      const apiUrl = `${config.baseURL}${BUS_API}.face_recognition.verify_and_checkin`;
      console.log(`[BusService] API URL: ${apiUrl}`);
      
      const response = await axios.post(
        apiUrl,
        {
          image: imageBase64,
          trip_id: tripId,
          auto_checkin: autoCheckin,
        },
        config
      );

      console.log('----------------------------------------');
      console.log('[BusService] 📥 RAW API RESPONSE:');
      console.log('----------------------------------------');
      console.log('[BusService] Status:', response.status);
      console.log('[BusService] Data:', JSON.stringify(response.data, null, 2));
      console.log('----------------------------------------');

      const result = response.data?.message || response.data;
      
      console.log('[BusService] Extracted result:', JSON.stringify(result, null, 2));
      
      return result;
    } catch (error: any) {
      console.log('========================================');
      console.log('[BusService] ❌ API ERROR');
      console.log('========================================');
      console.error('[BusService] Error:', error.message);
      console.error('[BusService] Error status:', error.response?.status);
      console.error('[BusService] Error response data:', JSON.stringify(error.response?.data, null, 2));
      
      // Get detailed error message
      const errorData = error.response?.data;
      let errorMessage = 'Điểm danh thất bại';
      
      if (errorData) {
        console.log('[BusService] Parsing error data...');
        if (errorData.message?.message) {
          errorMessage = errorData.message.message;
          console.log('[BusService] Found nested message:', errorMessage);
        } else if (errorData.message) {
          errorMessage = typeof errorData.message === 'string' ? errorData.message : JSON.stringify(errorData.message);
          console.log('[BusService] Found message:', errorMessage);
        } else if (errorData.exc_type) {
          errorMessage = `${errorData.exc_type}: ${errorData._server_messages || ''}`;
          console.log('[BusService] Found exception:', errorMessage);
        }
      }
      
      console.log('[BusService] Final error message:', errorMessage);
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Check student in trip manually
   */
  async checkStudentIn(
    studentId: string,
    tripId: string,
    method: 'face_recognition' | 'manual' = 'manual'
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.face_recognition.check_student_in_trip`,
        {
          student_id: studentId,
          trip_id: tripId,
          method,
        },
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Check in error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Điểm danh thất bại',
      };
    }
  }

  /**
   * Mark student as absent
   */
  async markStudentAbsent(
    studentId: string,
    tripId: string,
    reason: 'Nghỉ học' | 'Nghỉ ốm' | 'Nghỉ phép' | 'Lý do khác'
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      const config = await getAxiosConfig();
      const response = await axios.post(
        `${config.baseURL}${BUS_API}.face_recognition.mark_student_absent`,
        {
          student_id: studentId,
          trip_id: tripId,
          reason,
        },
        config
      );

      const result = response.data?.message || response.data;
      return result;
    } catch (error: any) {
      console.error('Mark absent error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể đánh dấu vắng',
      };
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

