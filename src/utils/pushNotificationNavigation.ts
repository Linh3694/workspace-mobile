import type { NavigationContainerRef } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROUTES } from '../constants/routes';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { postService } from '../services/postService';

/** Dữ liệu payload từ FCM/Expo (data của notification) */
export type PushNotificationPayload = {
  ticketId?: string;
  /** Một số payload FCM/backend gửi snake_case */
  ticket_id?: string;
  /** Ticket Hành chính (Frappe) — khác Ticket IT microservice */
  ticket_kind?: 'administrative' | string;
  ticketKind?: 'administrative' | string;
  ticketCode?: string;
  chatId?: string;
  type?: string;
  action?: string;
  screen?: string;
  tab?: string;
  senderId?: string;
  employeeCode?: string;
  notificationId?: string;
  feedbackId?: string;
  feedback_id?: string;
  feedbackCode?: string;
  leaveRequestId?: string;
  leave_request_id?: string;
  studentId?: string;
  student_id?: string;
  visitId?: string;
  visit_id?: string;
  classId?: string;
  class_id?: string;
  issueId?: string;
  issue_id?: string;
  postId?: string;
  commentId?: string;
};

export const PENDING_PUSH_NOTIFICATION_DATA_KEY = 'pending_push_notification_data_v1';

/** Chọn màn ticket detail theo role Mobile IT (giống NotificationsScreen) */
export async function getTicketDetailScreenName(): Promise<
  typeof ROUTES.SCREENS.TICKET_ADMIN_DETAIL | typeof ROUTES.SCREENS.TICKET_GUEST_DETAIL
> {
  try {
    const storedRolesStr = await AsyncStorage.getItem('userRoles');
    const storedRoles: string[] = storedRolesStr ? JSON.parse(storedRolesStr) : [];
    const hasMobileIT = storedRoles.includes('Mobile IT');
    return hasMobileIT ? ROUTES.SCREENS.TICKET_ADMIN_DETAIL : ROUTES.SCREENS.TICKET_GUEST_DETAIL;
  } catch {
    return ROUTES.SCREENS.TICKET_GUEST_DETAIL;
  }
}

/** Chi tiết Ticket Hành chính — staff all tickets vs my tickets (khớp HomeScreen) */
export async function getAdministrativeTicketDetailScreenName(): Promise<
  | typeof ROUTES.SCREENS.ADMINISTRATIVE_TICKET_ADMIN_DETAIL
  | typeof ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST_DETAIL
> {
  try {
    const storedRolesStr = await AsyncStorage.getItem('userRoles');
    const storedRoles: string[] = storedRolesStr ? JSON.parse(storedRolesStr) : [];
    const staff =
      storedRoles.includes('Mobile Administrative') ||
      storedRoles.includes('SIS Administrative') ||
      storedRoles.includes('SIS BOD');
    return staff
      ? ROUTES.SCREENS.ADMINISTRATIVE_TICKET_ADMIN_DETAIL
      : ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST_DETAIL;
  } catch {
    return ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST_DETAIL;
  }
}

export async function persistPendingPushNotificationData(data: PushNotificationPayload): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_PUSH_NOTIFICATION_DATA_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('⚠️ Không lưu được pending notification:', e);
  }
}

async function shouldDeferNavigation(
  navigationRef: NavigationContainerRef<RootStackParamList> | null
): Promise<boolean> {
  if (!navigationRef?.isReady()) return true;
  const token = await AsyncStorage.getItem('authToken');
  if (!token) return true;
  return false;
}

/**
 * Điều hướng từ payload push/in-app notification.
 * Nếu navigation chưa sẵn sàng hoặc chưa có token → lưu pending để PendingPushNotificationConsumer xử lý sau.
 */
export async function navigateFromPushNotificationData(
  data: PushNotificationPayload,
  navigationRef: NavigationContainerRef<RootStackParamList> | null
): Promise<void> {
  if (await shouldDeferNavigation(navigationRef)) {
    await persistPendingPushNotificationData(data);
    return;
  }

  const nav = (name: string, params?: object) => {
    (navigationRef as any).navigate(name, params);
  };

  const ticketId = data.ticketId || data.ticket_id;
  const feedbackId = data.feedbackId || data.feedback_id;
  const isAdministrativeTicket =
    data.ticket_kind === 'administrative' || data.ticketKind === 'administrative';

  // === TICKET (IT microservice hoặc HC Frappe — phân nhánh theo ticket_kind) ===
  const ticketTypes = ['new_ticket', 'ticket_update', 'ticket_created', 'ticket_updated'];
  const ticketActions = [
    'ticket_status_changed',
    'ticket_assigned',
    'ticket_processing',
    'ticket_waiting',
    'ticket_done',
    'ticket_closed',
    'ticket_cancelled',
    'new_ticket_admin',
    'user_reply',
    'ticket_cancelled_admin',
    'completion_confirmed',
    'ticket_feedback_received',
  ];

  if (ticketTypes.includes(data?.type || '') || ticketActions.includes(data?.action || '')) {
    if (ticketId) {
      const screen = isAdministrativeTicket
        ? await getAdministrativeTicketDetailScreenName()
        : await getTicketDetailScreenName();
      nav(screen, { ticketId });
      return;
    }
  }

  // === FEEDBACK ===
  const feedbackTypes = ['feedback_created', 'feedback_new', 'feedback_reply', 'feedback_updated'];
  const feedbackActions = [
    'new_feedback',
    'feedback_created',
    'feedback_reply',
    'guardian_reply',
    'feedback_assigned',
  ];

  if (feedbackTypes.includes(data?.type || '') || feedbackActions.includes(data?.action || '')) {
    if (feedbackId) {
      nav(ROUTES.SCREENS.FEEDBACK_DETAIL, { feedbackId });
      return;
    }
  }

  // === LEAVE ===
  const leaveTypes = ['leave_request', 'leave'];
  if (leaveTypes.includes(data?.type || '')) {
    const leaveRequestId = data.leave_request_id || data.leaveRequestId;
    const classId = data.class_id || data.classId;
    nav(ROUTES.SCREENS.LEAVE_REQUESTS, {
      classId: classId || undefined,
      leaveRequestId: leaveRequestId || undefined,
      fromNotification: true,
    });
    return;
  }

  // === ATTENDANCE ===
  if (data?.type === 'attendance_reminder') {
    nav(ROUTES.SCREENS.ATTENDANCE_HOME, {
      initialTab: data.tab || 'GVCN',
    });
    return;
  }

  if (data?.type === 'attendance' || data?.type === 'staff_attendance') {
    nav(ROUTES.SCREENS.MAIN, {
      screen: ROUTES.MAIN.NOTIFICATIONS,
      params: data.notificationId ? { notificationId: data.notificationId } : undefined,
    });
    return;
  }

  // === CHAT — module Chat chưa gắn vào stack chính: mở tab thông báo ===
  if (data?.type === 'chat_message' && data.chatId) {
    nav(ROUTES.SCREENS.MAIN, {
      screen: ROUTES.MAIN.NOTIFICATIONS,
      params: { notificationId: data.notificationId },
    });
    return;
  }

  // === DAILY HEALTH (đồng bộ logic với pushNotificationService) ===
  const healthTypes = [
    'daily_health',
    'health_visit_created',
    'health_visit_received',
    'health_visit_completed',
    'health_visit_escalation',
    'health_visit_cancelled',
    'health_visit_rejected',
  ];
  if (healthTypes.includes(data?.type || '')) {
    const visitId = data.visit_id || data.visitId;
    const notificationType = data.type;

    switch (notificationType) {
      case 'health_visit_created':
      case 'health_visit_escalation':
        nav(ROUTES.SCREENS.DAILY_HEALTH, {});
        return;
      case 'health_visit_received':
      case 'health_visit_completed':
        if (visitId) {
          nav(ROUTES.SCREENS.HEALTH_EXAM, { visitId });
        } else {
          nav(ROUTES.SCREENS.DAILY_HEALTH, {});
        }
        return;
      case 'health_visit_cancelled':
      case 'health_visit_rejected':
        nav(ROUTES.SCREENS.DAILY_HEALTH, {});
        return;
      default:
        if (visitId) {
          nav(ROUTES.SCREENS.HEALTH_EXAM, { visitId });
        } else {
          nav(ROUTES.SCREENS.DAILY_HEALTH, {});
        }
        return;
    }
  }

  // === CRM ISSUE ===
  const crmIssueTypes = [
    'crm_issue_created',
    'crm_issue_approved',
    'crm_issue_rejected',
    'crm_issue_status_changed',
    'crm_issue_pic_changed',
    'crm_issue_log_added',
    'crm_issue_sla_warning',
    'crm_issue_sla_breached',
  ];
  if (crmIssueTypes.includes(data?.type || '')) {
    const issueId = data.issueId || data.issue_id;
    if (issueId) {
      nav(ROUTES.SCREENS.CRM_ISSUE_DETAIL, { issueId });
      return;
    }
  }

  // === WISLIFE — tab thực tế là ROUTES.MAIN.WISLIFE = 'Social' ===
  const wislifeTypes = [
    'wislife_new_post',
    'wislife_post_reaction',
    'wislife_post_comment',
    'wislife_comment_reply',
    'wislife_comment_reaction',
    'wislife_mention',
  ];
  if (wislifeTypes.includes(data?.type || '') && data.postId) {
    try {
      const post = await postService.getPostById(data.postId);
      nav('PostDetail', { post });
      return;
    } catch (e) {
      console.warn('⚠️ Wislife: không tải được post, mở tab Social:', e);
      nav(ROUTES.SCREENS.MAIN, {
        screen: ROUTES.MAIN.WISLIFE,
        params: { postId: data.postId, commentId: data.commentId },
      });
      return;
    }
  }

  // === DEFAULT ===
  console.log('📝 Unhandled notification type, mở trung tâm thông báo:', data?.type, data?.action);
  nav(ROUTES.SCREENS.MAIN, {
    screen: ROUTES.MAIN.NOTIFICATIONS,
    params: data.notificationId ? { notificationId: data.notificationId } : undefined,
  });
}

/**
 * Gọi sau khi đăng nhập + navigation ready để xử lý payload đã lưu khi cold start.
 */
export async function consumePendingPushNotificationIfAny(
  navigationRef: NavigationContainerRef<RootStackParamList> | null
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_PUSH_NOTIFICATION_DATA_KEY);
    if (!raw) return;
    await AsyncStorage.removeItem(PENDING_PUSH_NOTIFICATION_DATA_KEY);
    const data = JSON.parse(raw) as PushNotificationPayload;
    await navigateFromPushNotificationData(data, navigationRef);
  } catch (e) {
    console.warn('⚠️ consumePendingPushNotificationIfAny:', e);
  }
}
