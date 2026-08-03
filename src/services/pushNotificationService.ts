import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { soundService } from './soundService';

interface PushNotificationData {
  type?: string;
  employeeCode?: string;
  employeeName?: string;
  timestamp?: string;
  deviceName?: string;
  ticketId?: string;
  /** Frappe Ticket Hành chính — cùng sound/channel ticket IT khi new_ticket_admin */
  ticket_kind?: string;
  ticketKind?: string;
  ticket_id?: string;
  chatId?: string;
  conversationId?: string;
  conversation_id?: string;
  messageId?: string;
  action?: string;
  oldStatus?: string;
  newStatus?: string;
  changedBy?: string;
  assignedBy?: string;
  priority?: string;
  ticketCode?: string;
  // Feedback related
  feedbackId?: string;
  feedbackCode?: string;
  guardianName?: string;
  // Leave request related
  leaveRequestId?: string;
  leave_request_id?: string;
  studentId?: string;
  student_id?: string;
  studentName?: string;
  student_name?: string;
  parentName?: string;
  parent_name?: string;
  reason?: string;
  reasonDisplay?: string;
  reason_display?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  // Wislife related
  postId?: string;
  commentId?: string;
  // Daily health related
  visitId?: string;
  visit_id?: string;
  classId?: string;
  class_id?: string;
  // CRM Issue
  issueId?: string;
  issue_id?: string;
  issueCode?: string;
  issue_code?: string;
}

class PushNotificationService {
  private isInitialized = false;
  private notificationListener?: Notifications.Subscription;
  private foregroundSubscription?: Notifications.Subscription;

  // Callback để handle attendance notifications
  private onAttendanceNotification?: (data: PushNotificationData) => void;

  constructor() {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        // Custom sound handling for attendance notifications
        const data = notification.request.content.data as any;
        const isAttendance = data?.type === 'attendance';

        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          // iOS will use default message sound automatically
        };
      },
    });
  }

  async initialize(): Promise<string | null> {
    if (this.isInitialized) {
      return await AsyncStorage.getItem('pushToken');
    }

    try {
      // Skip initialization on simulator - push notifications not supported
      if (!Device.isDevice) {
        console.log('📱 Simulator detected, skipping push notification initialization');
        this.isInitialized = true;
        return null;
      }

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
      // Import Constants để lấy projectId động
      const Constants = require('expo-constants').default;

      const projectId = Constants?.expoConfig?.extra?.eas?.projectId;

      if (!projectId) {
        console.error('❌ Không tìm thấy projectId trong app.json');
        return null;
      }

      // Xác định app type (expo-go vs standalone)
      const isStandalone = Constants.appOwnership !== 'expo';
      const appType = isStandalone ? 'standalone' : 'expo-go';

      console.log(`📱 App type: ${appType}, ProjectId: ${projectId}`);

      // Get cached token first - nhưng kiểm tra app type
      const cachedAppType = await AsyncStorage.getItem('pushTokenAppType');
      const cachedToken = await AsyncStorage.getItem('pushToken');

      // Nếu app type thay đổi (từ expo-go sang standalone hoặc ngược lại), cần lấy token mới
      if (cachedToken && cachedAppType === appType) {
        // Verify token is still valid
        try {
          const tokenResult = await Notifications.getExpoPushTokenAsync({
            projectId,
          });
          if (tokenResult.data === cachedToken) {
            console.log('📱 Using cached push token for', appType);
            return cachedToken;
          }
        } catch (error) {
          console.log('🔄 Cached token invalid, getting new one');
        }
      } else if (cachedAppType && cachedAppType !== appType) {
        console.log(`🔄 App type changed from ${cachedAppType} to ${appType}, getting new token`);
        // Clear old registration status to force re-register
        await AsyncStorage.removeItem('pushTokenRegistered');
      }

      // Get new token
      const expoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const token = expoPushToken.data;

      // Cache the token and app type
      await AsyncStorage.setItem('pushToken', token);
      await AsyncStorage.setItem('pushTokenAppType', appType);
      console.log(`📱 New push token generated for ${appType}:`, token);

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

      // Import Device info
      const Device = require('expo-device');
      const Constants = require('expo-constants').default;
      const { Platform } = require('react-native');

      // Xác định app type (expo-go vs standalone) - QUAN TRỌNG cho iOS TestFlight
      const isStandalone = Constants.appOwnership !== 'expo';
      const appType = isStandalone ? 'standalone' : 'expo-go';

      // Build device info
      const platform =
        Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'expo';
      const deviceName =
        Device.deviceName || `${Device.brand || 'Unknown'} ${Device.modelName || 'Device'}`;
      const osVersion = Device.osVersion || 'Unknown';
      const appVersion = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

      // Tạo unique device identifier để phân biệt Expo Go và standalone app
      const deviceId = `${Device.modelId || Device.modelName || 'unknown'}-${Platform.OS}-${appType}`;

      const deviceInfo = {
        deviceToken: token,
        platform: platform,
        deviceName: deviceName,
        os: Platform.OS,
        osVersion: osVersion,
        appVersion: appVersion,
        language: 'vi',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        // Thêm thông tin để phân biệt app type
        appType: appType, // 'standalone' cho TestFlight/App Store, 'expo-go' cho Expo Go
        deviceId: deviceId, // Unique ID để backend phân biệt các devices
        // Bundle theo đúng platform — Android là package, iOS là bundleIdentifier
        bundleId:
          Platform.OS === 'android'
            ? Constants.expoConfig?.android?.package || 'com.hailinh.n23.workspace'
            : Constants.expoConfig?.ios?.bundleIdentifier || 'com.wellspring.workspace',
      };

      console.log(
        '📤 Registering push token with device info:',
        JSON.stringify(deviceInfo, null, 2)
      );

      const { registerDeviceOnNotificationService } = require('../services/notificationApiClient');
      const response = await registerDeviceOnNotificationService(deviceInfo);

      if (response?.status >= 200 && response?.status < 300) {
        console.log('✅ Push token registered successfully for', appType);
        await AsyncStorage.setItem('pushTokenRegistered', 'true');
        await AsyncStorage.setItem('pushTokenAppType', appType);
      } else {
        console.error(
          '❌ Failed to register push token:',
          response?.status,
          response?.data,
        );
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

    // Tap mở app: chỉ xử lý tại App.tsx (navigateFromPushNotificationData) để tránh trùng / navigateToScreen TODO

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

      await Notifications.setNotificationChannelAsync('ticket', {
        name: 'Ticket hỗ trợ',
        description: 'Thông báo về ticket và yêu cầu hỗ trợ',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4A90D9',
        sound: 'ticket_create.wav', // Custom sound for ticket notifications
      });

      await Notifications.setNotificationChannelAsync('feedback', {
        name: 'Góp ý phụ huynh',
        description: 'Thông báo về góp ý từ phụ huynh',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('chat', {
        name: 'Trao đổi',
        description: 'Tin nhắn giáo viên và phụ huynh',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0EA5E9',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('leave_request', {
        name: 'Đơn xin nghỉ phép',
        description: 'Thông báo về đơn xin nghỉ phép từ phụ huynh',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F59E0B',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('wislife', {
        name: 'Wislife - Mạng xã hội nội bộ',
        description: 'Thông báo về bài viết, bình luận, và tương tác trên Wislife',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8B5CF6',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('daily_health', {
        name: 'Y tế học sinh',
        description: 'Thông báo về y tế học sinh',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#DC2626',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('crm_issue', {
        name: 'Vấn đề CRM',
        description: 'Thông báo vấn đề tuyển sinh / CRM',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E11D48',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mặc định',
        description: 'Thông báo chung',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  }

  /**
   * Chỉ xử lý thông báo NHẬN ĐƯỢC KHI APP ĐANG MỞ (foreground). Việc bấm mở thông báo do
   * App.tsx lo qua `navigateFromPushNotificationData` — service này KHÔNG điều hướng.
   *
   * SIS-180: trước đây ở đây có ~250 dòng switch điều hướng gọi `navigateToScreen`, nhưng hàm
   * đó chỉ console.log (stub kèm "TODO: Integrate with navigation service") và listener tap
   * cũng đã tắt từ trước. Toàn bộ là code chết, đồng thời là một trong các bản ánh xạ lệch
   * nhau khiến 14 loại thông báo bấm vào không mở được gì — đã xoá. Ánh xạ loại thông báo →
   * màn đích giờ nằm DUY NHẤT ở utils/pushNotificationNavigation.ts.
   */
  private handleNotification(notification: Notifications.Notification, wasOpened: boolean): void {
    const data = notification.request.content.data as PushNotificationData;

    console.log('🔔 Processing notification:', {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data,
      wasOpened,
    });

    // Refresh chấm công khi nhận thông báo lúc app đang mở.
    if (data?.type === 'attendance' && this.onAttendanceNotification) {
      this.onAttendanceNotification(data);
    }

    // Tiếng riêng cho ticket mới — IT & Ticket Hành chính dùng chung action new_ticket_admin.
    if (!wasOpened && data?.action === 'new_ticket_admin') {
      soundService.playTicketCreatedSound();
    }
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
