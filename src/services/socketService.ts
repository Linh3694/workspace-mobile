/**
 * Socket Service for Real-time Notifications
 * Kết nối với notification-service qua Socket.IO
 */

import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Kết nối Socket.IO
   */
  async connect(userId: string) {
    try {
      if (this.socket?.connected) {
        console.log('🔌 [Socket] Already connected');
        return;
      }

      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        console.warn('⚠️ [Socket] No auth token found');
        return;
      }

      this.userId = userId;

      console.log('🔌 [Socket] Connecting to:', API_BASE_URL);

      this.socket = io(API_BASE_URL, {
        transports: ['websocket', 'polling'],
        auth: {
          token: authToken,
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      this.setupEventListeners();

      // Join user room sau khi connect
      this.socket.on('connect', () => {
        console.log('✅ [Socket] Connected, joining user room:', userId);
        this.socket?.emit('join_user_room', { userId });
        this.reconnectAttempts = 0;
      });
    } catch (error) {
      console.error('❌ [Socket] Connection error:', error);
    }
  }

  /**
   * Setup các event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ [Socket] Connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ [Socket] Connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ [Socket] Max reconnect attempts reached');
        this.disconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ [Socket] Error:', error);
    });

    // Log các notification events
    this.socket.on('new_notification', (data) => {
      console.log('📨 [Socket] New notification received:', data);
    });

    this.socket.on('notification_read', (data) => {
      console.log('✅ [Socket] Notification marked as read:', data);
    });
  }

  /**
   * Lắng nghe notification mới
   */
  onNewNotification(callback: (notification: any) => void) {
    this.socket?.on('new_notification', callback);
  }

  /**
   * Lắng nghe notification đã đọc
   */
  onNotificationRead(callback: (data: { notificationId: string }) => void) {
    this.socket?.on('notification_read', callback);
  }

  /**
   * Đánh dấu notification là đã đọc (qua socket)
   */
  markNotificationRead(notificationId: string) {
    if (this.socket?.connected && this.userId) {
      this.socket.emit('mark_notification_read', {
        notificationId,
        userId: this.userId,
      });
    }
  }

  /**
   * Ngắt kết nối
   */
  disconnect() {
    if (this.socket) {
      if (this.userId) {
        this.socket.emit('leave_user_room', { userId: this.userId });
        this.socket.emit('user_offline', { userId: this.userId });
      }
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
      console.log('🔌 [Socket] Disconnected');
    }
  }

  /**
   * Kiểm tra trạng thái kết nối
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Set user online
   */
  setUserOnline() {
    if (this.socket?.connected && this.userId) {
      this.socket.emit('user_online', { userId: this.userId });
    }
  }

  /**
   * Set user offline
   */
  setUserOffline() {
    if (this.socket?.connected && this.userId) {
      this.socket.emit('user_offline', { userId: this.userId });
    }
  }

  /**
   * Xóa listener
   */
  removeListener(event: string) {
    this.socket?.off(event);
  }

  /**
   * Xóa tất cả listeners
   */
  removeAllListeners() {
    this.socket?.removeAllListeners();
  }
}

export const socketService = new SocketService();

/**
 * Helper function để disconnect tất cả sockets
 * Sử dụng cho logout
 */
export const disconnectAllSockets = () => {
  socketService.disconnect();
};

export default socketService;
