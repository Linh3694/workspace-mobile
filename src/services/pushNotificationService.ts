import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';
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
        bundleId: Constants.expoConfig?.ios?.bundleIdentifier || 'com.wellspring.workspace',
      };

      console.log(
        '📤 Registering push token with device info:',
        JSON.stringify(deviceInfo, null, 2)
      );

      // Use new mobile device registration API
      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.mobile_push_notification.register_device_token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(deviceInfo),
        }
      );

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Push token registered successfully for', appType);
        console.log('📥 Server response:', JSON.stringify(responseData, null, 2));
        await AsyncStorage.setItem('pushTokenRegistered', 'true');
        await AsyncStorage.setItem('pushTokenAppType', appType);
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
        this.handleTicketNotification(data, wasOpened);
        break;
      case 'chat_message':
        this.handleChatNotification(data, wasOpened);
        break;
      // Feedback notifications
      case 'feedback_created':
      case 'feedback_new':
        this.handleNewFeedbackNotification(data, wasOpened);
        break;
      case 'feedback_reply':
      case 'feedback_updated':
        this.handleFeedbackUpdateNotification(data, wasOpened);
        break;
      // Leave request notifications (from parent portal)
      case 'leave_request':
        this.handleLeaveRequestNotification(data, wasOpened);
        break;
      // Leave notification (from teacher to parent - already handled in mobile_push_notification)
      case 'leave':
        this.handleLeaveNotification(data, wasOpened);
        break;
      // Wislife notifications
      case 'wislife_new_post':
      case 'wislife_post_reaction':
      case 'wislife_post_comment':
      case 'wislife_comment_reply':
      case 'wislife_comment_reaction':
      case 'wislife_mention':
        this.handleWislifeNotification(data, wasOpened);
        break;
      // Daily health notifications
      case 'daily_health':
      case 'health_visit_created':
      case 'health_visit_received':
      case 'health_visit_completed':
      case 'health_visit_escalation':
      case 'health_visit_cancelled':
      case 'health_visit_rejected':
        this.handleDailyHealthNotification(data, wasOpened);
        break;
      case 'crm_issue_created':
      case 'crm_issue_approved':
      case 'crm_issue_rejected':
      case 'crm_issue_status_changed':
      case 'crm_issue_pic_changed':
      case 'crm_issue_log_added':
        this.handleCRMIssueNotification(data, wasOpened);
        break;
      default:
        // Handle action-based notifications (from ticket-service)
        switch (data?.action) {
          case 'ticket_status_changed':
            this.handleTicketStatusChangeNotification(data, wasOpened);
            break;
          case 'ticket_assigned':
            this.handleTicketAssignmentNotification(data, wasOpened);
            break;
          case 'ticket_processing':
          case 'ticket_waiting':
          case 'ticket_done':
          case 'ticket_closed':
          case 'ticket_cancelled':
            this.handleTicketStatusChangeNotification(data, wasOpened);
            break;
          // Admin notifications
          case 'new_ticket_admin':
            this.handleNewTicketAdminNotification(data, wasOpened);
            break;
          case 'user_reply':
            this.handleUserReplyNotification(data, wasOpened);
            break;
          case 'ticket_cancelled_admin':
            this.handleTicketCancelledAdminNotification(data, wasOpened);
            break;
          case 'completion_confirmed':
            this.handleCompletionConfirmedNotification(data, wasOpened);
            break;
          case 'ticket_feedback_received':
            this.handleFeedbackReceivedNotification(data, wasOpened);
            break;
          // Parent Portal Feedback actions
          case 'new_feedback':
          case 'feedback_created':
            this.handleNewFeedbackNotification(data, wasOpened);
            break;
          case 'feedback_reply':
          case 'guardian_reply':
            this.handleFeedbackUpdateNotification(data, wasOpened);
            break;
          case 'feedback_assigned':
            this.handleFeedbackAssignedNotification(data, wasOpened);
            break;
          default:
            console.log('📝 General notification received:', data);
        }
        break;
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

  private handleTicketStatusChangeNotification(
    data: PushNotificationData,
    wasOpened: boolean
  ): void {
    console.log('🎫 Ticket status change notification:', data);

    if (wasOpened && data.ticketId) {
      this.navigateToTicketDetail(data.ticketId);
    }
  }

  private handleTicketAssignmentNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('👤 Ticket assignment notification:', data);

    if (wasOpened && data.ticketId) {
      this.navigateToTicketDetail(data.ticketId);
    }
  }

  // Admin notification handlers
  private handleNewTicketAdminNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('🆕 New ticket admin notification:', data);

    // Phát sound custom (ticket_create.wav) — IT & Ticket Hành chính dùng chung action new_ticket_admin
    if (!wasOpened) {
      soundService.playTicketCreatedSound();
    }

    const tid = data.ticketId || data.ticket_id;
    if (wasOpened && tid) {
      this.navigateToTicketDetail(tid);
    }
  }

  private handleUserReplyNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('💬 User reply notification:', data);

    if (wasOpened && data.ticketId) {
      this.navigateToTicketDetail(data.ticketId);
    }
  }

  private handleTicketCancelledAdminNotification(
    data: PushNotificationData,
    wasOpened: boolean
  ): void {
    console.log('❌ Ticket cancelled admin notification:', data);

    if (wasOpened && data.ticketId) {
      this.navigateToTicketDetail(data.ticketId);
    }
  }

  private handleCompletionConfirmedNotification(
    data: PushNotificationData,
    wasOpened: boolean
  ): void {
    console.log('✅ Completion confirmed notification:', data);

    if (wasOpened && data.ticketId) {
      this.navigateToTicketDetail(data.ticketId);
    }
  }

  private handleFeedbackReceivedNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('⭐ Feedback received notification:', data);

    if (wasOpened && data.ticketId) {
      this.navigateToTicketDetail(data.ticketId);
    }
  }

  private handleChatNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('💬 Chat notification:', data);

    if (wasOpened && data.chatId) {
      this.navigateToScreen('ChatDetail', { chatId: data.chatId });
    }
  }

  // Feedback notification handlers
  private handleNewFeedbackNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('📝 New feedback notification:', data);

    if (wasOpened && data.feedbackId) {
      this.navigateToFeedbackDetail(data.feedbackId);
    }
  }

  private handleFeedbackUpdateNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('📝 Feedback update notification:', data);

    if (wasOpened && data.feedbackId) {
      this.navigateToFeedbackDetail(data.feedbackId);
    }
  }

  private navigateToFeedbackDetail(feedbackId: string): void {
    console.log(`🧭 Navigate to Feedback Detail: ${feedbackId}`);
    this.navigateToScreen('FeedbackDetail', { feedbackId });
  }

  private handleFeedbackAssignedNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('👤 Feedback assigned notification:', data);

    if (wasOpened && data.feedbackId) {
      this.navigateToFeedbackDetail(data.feedbackId);
    }
  }

  // Leave request notification handler (from parent portal to teacher)
  private handleLeaveRequestNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('📝 Leave request notification (from parent):', data);

    if (wasOpened) {
      // Navigate to leave requests screen
      this.navigateToLeaveRequests(data);
    }
  }

  // Leave notification handler (from teacher to parent - workspace-mobile created)
  private handleLeaveNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('📝 Leave notification:', data);

    if (wasOpened) {
      // Navigate to leave requests screen
      this.navigateToLeaveRequests(data);
    }
  }

  // Wislife notification handler
  private handleWislifeNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('📱 Wislife notification:', data);

    if (wasOpened && data.postId) {
      // Tap được xử lý ở App.tsx (navigateFromPushNotificationData)
      this.navigateToScreen('Main', {
        screen: 'Social',
        params: { postId: data.postId, commentId: data.commentId },
      });
    }
  }

  // Daily health notification handler
  private handleDailyHealthNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('🏥 Daily health notification:', data);

    if (wasOpened) {
      const visitId = data.visit_id || data.visitId;
      const notificationType = data.type;

      switch (notificationType) {
        case 'health_visit_created':
        case 'health_visit_escalation':
          // Y tế / GV nhận báo mới hoặc nhắc nhở -> mở danh sách Y tế
          this.navigateToScreen('DailyHealth', {});
          break;

        case 'health_visit_received':
        case 'health_visit_completed':
          // Tiếp nhận / checkout -> mở chi tiết visit nếu có visitId
          if (visitId) {
            this.navigateToScreen('HealthExam', { visitId });
          } else {
            this.navigateToScreen('DailyHealth', {});
          }
          break;

        case 'health_visit_cancelled':
        case 'health_visit_rejected':
          // GV hủy / Y tế từ chối -> mở danh sách Y tế để refresh (visit đã bị xóa)
          this.navigateToScreen('DailyHealth', {});
          break;

        default:
          // Fallback cho 'daily_health' hoặc type không xác định
          if (visitId) {
            this.navigateToScreen('HealthExam', { visitId });
          } else {
            this.navigateToScreen('DailyHealth', {});
          }
          break;
      }
    }
  }

  private handleCRMIssueNotification(data: PushNotificationData, wasOpened: boolean): void {
    console.log('📋 CRM Issue notification:', data);
    if (wasOpened) {
      const issueId = data.issueId || data.issue_id;
      if (issueId) {
        this.navigateToScreen('CRMIssueDetail', { issueId });
      }
    }
  }

  private navigateToLeaveRequests(data: PushNotificationData): void {
    const studentId = data.student_id || data.studentId;
    const leaveRequestId = data.leave_request_id || data.leaveRequestId;
    const classId = data.class_id || data.classId;

    console.log(
      `🧭 Navigate to Leave Requests - Class: ${classId}, Student: ${studentId}, LeaveRequest: ${leaveRequestId}`
    );
    this.navigateToScreen('LeaveRequests', {
      classId,
      studentId,
      leaveRequestId,
      fromNotification: true,
    });
  }

  private navigateToScreen(screenName: string, params?: any): void {
    // This will be implemented by navigation service
    console.log(`🧭 Navigate to ${screenName} with params:`, params);
    // TODO: Integrate with navigation service
  }

  private navigateToTicketDetail(ticketId: string): void {
    // Navigate to ticket detail screen
    console.log(`🧭 Navigate to Ticket Detail: ${ticketId}`);
    // Use the same navigation pattern as existing ticket notifications
    this.navigateToScreen('TicketDetail', { ticketId });
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
