import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';

interface PushNotificationData {
  type?: string;
  employeeCode?: string;
  employeeName?: string;
  timestamp?: string;
  deviceName?: string;
  ticketId?: string;
  chatId?: string;
  messageId?: string;
}

interface NotificationResponse {
  notification: Notifications.Notification;
  actionIdentifier: string;
}

class PushNotificationService {
  private isInitialized = false;
  private notificationListener?: Notifications.Subscription;
  private responseListener?: Notifications.Subscription;
  private foregroundSubscription?: Notifications.Subscription;

  // Callback để handle attendance notifications
  private onAttendanceNotification?: (data: PushNotificationData) => void;

  constructor() {
    // Set default notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
    });
  }

  async initialize(): Promise<string | null> {
    if (this.isInitialized) {
      return await AsyncStorage.getItem('pushToken');
    }

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('🚫 Push notification permissions denied');
        return null;
      }

      // Get push token
      const pushToken = await this.getPushToken();
      if (!pushToken) {
        console.log('❌ Failed to get push token');
        return null;
      }

      // Register push token with backend
      await this.registerPushToken(pushToken);

      // Setup notification listeners
      this.setupNotificationListeners();

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await this.setupAndroidChannel();
      }

      this.isInitialized = true;
      console.log('✅ Push notifications initialized successfully');

      return pushToken;
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
      return null;
    }
  }

  private async getPushToken(): Promise<string | null> {
    try {
      // Check if running on physical device
      if (!Device.isDevice) {
        console.log('⚠️ Push notifications only work on physical devices');
        return null;
      }

      // Get cached token first
      const cachedToken = await AsyncStorage.getItem('pushToken');
      if (cachedToken) {
        // Verify token is still valid
        try {
          const projectId = await Notifications.getExpoPushTokenAsync({
            projectId: 'f6365a6d-3c57-4b54-aaa8-119f05e3698e',
          });
          if (projectId.data === cachedToken) {
            console.log('📱 Using cached push token');
            return cachedToken;
          }
        } catch (error) {
          console.log('🔄 Cached token invalid, getting new one');
        }
      }

      // Get new token
      const expoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId: 'f6365a6d-3c57-4b54-aaa8-119f05e3698e',
      });

      const token = expoPushToken.data;

      // Cache the token
      await AsyncStorage.setItem('pushToken', token);
      console.log('📱 New push token generated and cached');

      return token;
    } catch (error) {
      console.error('❌ Error getting push token:', error);
      return null;
    }
  }

  private async registerPushToken(token: string): Promise<void> {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        console.log('⚠️ No auth token, skipping push token registration');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/notification/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          deviceToken: token,
          platform: 'expo',
        }),
      });

      if (response.ok) {
        console.log('✅ Push token registered successfully');
        await AsyncStorage.setItem('pushTokenRegistered', 'true');
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to register push token:', errorText);
      }
    } catch (error) {
      console.error('❌ Error registering push token:', error);
    }
  }

  private setupNotificationListeners(): void {
    // Listen for notifications received while app is foregrounded
    this.foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📱 Notification received in foreground:', notification);
      this.handleNotification(notification, false);
    });

    // Listen for user interactions with notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response: NotificationResponse) => {
        console.log('👆 Notification tapped:', response);
        this.handleNotification(response.notification, true);
      }
    );

    console.log('👂 Notification listeners setup complete');
  }

  private async setupAndroidChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('attendance', {
        name: 'Chấm công',
        description: 'Thông báo chấm công và điểm danh',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFCE02',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mặc định',
        description: 'Thông báo chung',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  }

  private handleNotification(notification: Notifications.Notification, wasOpened: boolean): void {
    const data = notification.request.content.data as PushNotificationData;

    console.log('🔔 Processing notification:', {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data,
      wasOpened,
    });

    // Handle different notification types
    switch (data?.type) {
      case 'attendance':
        this.handleAttendanceNotification(data, wasOpened);
        break;
      case 'ticket_created':
      case 'ticket_updated':
      case 'ticket_assigned':
        this.handleTicketNotification(data, wasOpened);
        break;
      case 'chat_message':
        this.handleChatNotification(data, wasOpened);
        break;
      default:
        console.log('📝 General notification received');
    }
  }

  private handleAttendanceNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('⏰ Attendance notification:', data);

    // Trigger attendance refresh callback
    if (this.onAttendanceNotification) {
      this.onAttendanceNotification(data);
    }

    // If user tapped notification, navigate to home screen
    if (wasOpened) {
      // This will be handled by navigation service
      this.navigateToScreen('Main', { refreshAttendance: true });
    }
  }

  private handleTicketNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('🎫 Ticket notification:', data);

    if (wasOpened && data.ticketId) {
      this.navigateToScreen('TicketDetail', { ticketId: data.ticketId });
    }
  }

  private handleChatNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('💬 Chat notification:', data);

    if (wasOpened && data.chatId) {
      this.navigateToScreen('ChatDetail', { chatId: data.chatId });
    }
  }

  private navigateToScreen(screenName: string, params?: any): void {
    // This will be implemented by navigation service
    console.log(`🧭 Navigate to ${screenName} with params:`, params);
    // TODO: Integrate with navigation service
  }

  // Public methods

  setOnAttendanceNotification(callback: (data: PushNotificationData) => void): void {
    this.onAttendanceNotification = callback;
  }

  async scheduleLocalNotification(title: string, body: string, data: any = {}): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('❌ Error scheduling local notification:', error);
    }
  }

  async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('❌ Error getting badge count:', error);
      return 0;
    }
  }

  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('❌ Error setting badge count:', error);
    }
  }

  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('🧹 All notifications cleared');
    } catch (error) {
      console.error('❌ Error clearing notifications:', error);
    }
  }

  cleanup(): void {
    this.foregroundSubscription?.remove();
    this.responseListener?.remove();
    this.notificationListener?.remove();
    this.isInitialized = false;
    console.log('🧹 Push notification service cleaned up');
  }

  // Check if push notifications are supported and enabled
  async isSupported(): Promise<boolean> {
    if (!Device.isDevice) {
      return false;
    }

    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  async getStatus(): Promise<{
    isSupported: boolean;
    isRegistered: boolean;
    token: string | null;
  }> {
    const isSupported = await this.isSupported();
    const token = await AsyncStorage.getItem('pushToken');
    const isRegistered = (await AsyncStorage.getItem('pushTokenRegistered')) === 'true';

    return {
      isSupported,
      isRegistered,
      token,
    };
  }
}

export default new PushNotificationService();
