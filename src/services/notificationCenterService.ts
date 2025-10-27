/**
 * Notification Center Service for Mobile App (Staff/Employee)
 * Gọi Frappe API để lấy notifications từ notification-service
 */

import { API_BASE_URL } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export interface NotificationData {
  _id?: string; // MongoDB ID
  id?: string; // Frappe ID (backend trả về 'id' thay vì '_id')
  title: string | { vi: string; en: string };
  message: string | { vi: string; en: string };
  data: any;
  read: boolean;
  createdAt: string;
  eventTimestamp?: string;
  type: string;
  student_name?: string;
}

export interface NotificationListResponse {
  success: boolean;
  data: {
    notifications: NotificationData[];
    unread_count: number;
    total: number;
  };
  message?: string;
}

export interface GetNotificationsParams {
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
  include_read?: boolean;
}

class NotificationCenterService {
  private baseUrl = '/api/method/erp.api.parent_portal.notification_center';

  /**
   * Lấy danh sách thông báo cho staff/employee
   */
  async getNotifications(params: GetNotificationsParams = {}): Promise<NotificationListResponse> {
    try {
      const authToken = await AsyncStorage.getItem('authToken');

      if (!authToken) {
        console.warn('⚠️ No auth token found');
        return {
          success: false,
          data: {
            notifications: [],
            unread_count: 0,
            total: 0,
          },
          message: 'No authentication token',
        };
      }

      console.log('📤 [NotificationCenter] Fetching notifications with params:', params);

      const response = await axios.post<{ message: NotificationListResponse }>(
        `${API_BASE_URL}${this.baseUrl}.get_notifications`,
        {
          type: params.type,
          status: params.status,
          limit: params.limit || 200,
          offset: params.offset || 0,
          include_read: params.include_read !== undefined ? params.include_read : true,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📥 [NotificationCenter] Response:', response.data);

      return response.data.message;
    } catch (error: any) {
      console.error('❌ [NotificationCenter] Error fetching notifications:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);

      return {
        success: false,
        data: {
          notifications: [],
          unread_count: 0,
          total: 0,
        },
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Lấy số lượng thông báo chưa đọc
   */
  async getUnreadCount(): Promise<{ success: boolean; data: { unread_count: number } }> {
    try {
      const authToken = await AsyncStorage.getItem('authToken');

      if (!authToken) {
        return {
          success: false,
          data: { unread_count: 0 },
        };
      }

      const response = await axios.post<{
        message: { success: boolean; data: { unread_count: number } };
      }>(
        `${API_BASE_URL}${this.baseUrl}.get_unread_count`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.message;
    } catch (error) {
      console.error('❌ [NotificationCenter] Error fetching unread count:', error);
      return {
        success: false,
        data: { unread_count: 0 },
      };
    }
  }

  /**
   * Đánh dấu một thông báo là đã đọc
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Validate notificationId
      if (!notificationId) {
        console.error(
          '❌ [NotificationCenter] notificationId is required but got:',
          notificationId
        );
        return {
          success: false,
          message: 'notification_id is required',
        };
      }

      const authToken = await AsyncStorage.getItem('authToken');

      if (!authToken) {
        return {
          success: false,
          message: 'No authentication token',
        };
      }

      console.log('📤 [NotificationCenter] Marking as read:', notificationId);
      console.log('📤 [NotificationCenter] Request body:', { notification_id: notificationId });

      const response = await axios.post<{ message: { success: boolean; message?: string } }>(
        `${API_BASE_URL}${this.baseUrl}.mark_as_read`,
        { notification_id: notificationId },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📥 [NotificationCenter] markAsRead response:', response.data);

      return response.data.message;
    } catch (error: any) {
      console.error('❌ [NotificationCenter] Error marking as read:', error);
      console.error('❌ [NotificationCenter] Error response:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Unknown error',
      };
    }
  }

  /**
   * Đánh dấu tất cả thông báo là đã đọc
   */
  async markAllAsRead(): Promise<{ success: boolean; message?: string }> {
    try {
      const authToken = await AsyncStorage.getItem('authToken');

      if (!authToken) {
        return {
          success: false,
          message: 'No authentication token',
        };
      }

      console.log('📤 [NotificationCenter] Marking all as read');

      const response = await axios.post<{ message: { success: boolean; message?: string } }>(
        `${API_BASE_URL}${this.baseUrl}.mark_all_as_read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📥 [NotificationCenter] markAllAsRead response:', response.data);

      return response.data.message;
    } catch (error) {
      console.error('❌ [NotificationCenter] Error marking all as read:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Xóa một thông báo
   */
  async deleteNotification(
    notificationId: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const authToken = await AsyncStorage.getItem('authToken');

      if (!authToken) {
        return {
          success: false,
          message: 'No authentication token',
        };
      }

      console.log('📤 [NotificationCenter] Deleting notification:', notificationId);

      const response = await axios.post<{ message: { success: boolean; message?: string } }>(
        `${API_BASE_URL}${this.baseUrl}.delete_notification`,
        { notification_id: notificationId },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📥 [NotificationCenter] deleteNotification response:', response.data);

      return response.data.message;
    } catch (error) {
      console.error('❌ [NotificationCenter] Error deleting notification:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const notificationCenterService = new NotificationCenterService();
export default notificationCenterService;
