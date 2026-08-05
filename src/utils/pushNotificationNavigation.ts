import type { NavigationContainerRef } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROUTES } from '../constants/routes';
import type { RootStackParamList } from '../navigation/AppNavigator';

/**
 * `data.type` của thông báo cần mở màn Trao đổi.
 * Giá trị phải khớp payload backend gửi:
 *   - social-service/services/chatStreamNotify.js — LUỒNG ĐANG CHẠY (chat_new_message,
 *     chat_reaction, chat_message_recalled, chat_poll_*)
 *   - erp/api/notification/exchange.py — luồng webhook Frappe cũ (chat_message,
 *     chat_message_reaction). Giữ lại để không vỡ nếu SOCIAL_NOTIFY_TRANSPORT quay về 'frappe'.
 * Ngoài danh sách này, `isChatEvent` còn nhận prefix `chat*` và `action: 'open_chat'` — giống
 * web SIS (resolveNotificationRoute) và parent-portal-mobile, để loại chat mới thêm ở backend
 * không chết lặng nữa (SIS-180).
 */
export const CHAT_NOTIFICATION_TYPES: readonly string[] = [
  'chat_message',
  'chat',
  'chat_poll_reminder',
  'chat_poll_closed',
  'chat_message_reaction',
  'chat_new_message',
  'chat_reaction',
  'chat_message_recalled',
];

/**
 * Ticket IT (Frappe) + Ticket Hành chính (Frappe) + ticket-service cũ.
 *
 * Hai module đặt tên sự kiện ở HAI chỗ khác nhau, nên tập này được so với CẢ `type` LẪN
 * `action` (xem `eventKeys`):
 *   - Ticket IT   — erp/api/erp_it_support/notifications.py::_it_ticket_payload → đặt ở `type`,
 *                   KHÔNG có `action`.
 *   - Ticket HC   — erp/api/erp_administrative/administrative_ticket.py::_hc_ticket_payload →
 *                   `type: "ticket"` + tên sự kiện ở `action`.
 *   - ticket-service cũ — đặt ở `action`.
 */
const TICKET_EVENTS: readonly string[] = [
  // Chung / ticket-service cũ
  'ticket',
  'new_ticket',
  'ticket_update',
  'ticket_created',
  'ticket_updated',
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
  // Ticket IT — tên sự kiện nằm ở `type`
  'ticket_creation_confirmation',
  'ticket_pickup',
  'ticket_user_reply',
  'ticket_feedback',
  // Ticket Hành chính — nhận xử lý, công việc con, nhắc sự kiện (đều mang ticketId)
  'ticket_picked_up',
  'subtask_assigned',
  'subtask_status_changed',
  'event_facility_reminder',
];

const FEEDBACK_EVENTS: readonly string[] = [
  'feedback_created',
  'feedback_new',
  'feedback_reply',
  'feedback_updated',
  'new_feedback',
  'guardian_reply',
  'feedback_assigned',
];

const CRM_ISSUE_EVENTS: readonly string[] = [
  'crm_issue_created',
  'crm_issue_approved',
  'crm_issue_rejected',
  'crm_issue_status_changed',
  'crm_issue_pic_changed',
  'crm_issue_log_added',
  'crm_issue_sla_warning',
  'crm_issue_sla_breached',
  'crm_issue_department_added',
];

const LEAVE_EVENTS: readonly string[] = ['leave_request', 'leave', 'new_leave_from_parent'];

const ATTENDANCE_REMINDER_EVENTS: readonly string[] = ['attendance_reminder'];

const ATTENDANCE_EVENTS: readonly string[] = ['attendance', 'staff_attendance'];

const HEALTH_EVENTS: readonly string[] = [
  'daily_health',
  'health_visit_created',
  'health_visit_received',
  'health_visit_completed',
  'health_visit_escalation',
  'health_visit_cancelled',
  'health_visit_rejected',
];

/**
 * Wislife đã ẩn khỏi bottom tab (SIS-109) — nhận diện để KHÔNG điều hướng vào tab không còn
 * hiển thị. Giữ danh sách để bật lại khi mở lại module.
 */
const WISLIFE_EVENTS: readonly string[] = [
  'wislife_new_post',
  'wislife_post_reaction',
  'wislife_post_comment',
  'wislife_comment_reply',
  'wislife_comment_reaction',
  'wislife_mention',
];

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
  conversationId?: string;
  conversation_id?: string;
  /** Tin nhắn được nhắc tới — dùng để cuộn thẳng tới bubble trong ExchangeChatScreen */
  messageId?: string;
  message_id?: string;
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

/** Màn đích đã phân giải xong; `null` = không có màn riêng, caller tự quyết. */
export type NotificationTarget = {
  screen: string;
  params?: Record<string, unknown>;
};

export const PENDING_PUSH_NOTIFICATION_DATA_KEY = 'pending_push_notification_data_v1';

const str = (value: unknown): string => String(value ?? '').trim();

/**
 * Mọi khoá nhận diện của một payload. Backend KHÔNG thống nhất chỗ đặt tên sự kiện — module
 * này để ở `type`, module kia để ở `action` — nên luôn so cả hai (SIS-180).
 */
function eventKeys(data: PushNotificationPayload): string[] {
  return [str(data?.type), str(data?.action)].filter(Boolean);
}

function matchesEvent(data: PushNotificationPayload, events: readonly string[]): boolean {
  return eventKeys(data).some((key) => events.includes(key));
}

/**
 * Thông báo chat: danh sách tường minh, HOẶC prefix `chat*`, HOẶC `action: 'open_chat'`.
 * Prefix + action là lưới an toàn cho loại chat backend thêm sau này.
 */
export function isChatEvent(data: PushNotificationPayload): boolean {
  if (str(data?.action) === 'open_chat') return true;
  return eventKeys(data).some(
    (key) => CHAT_NOTIFICATION_TYPES.includes(key) || /^chat([_-]|$)/i.test(key)
  );
}

/** Chọn màn ticket detail theo role Mobile IT */
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

/**
 * Payload thông báo → màn đích. NGUỒN DUY NHẤT cho cả hai đường sống:
 *   1. bấm trong màn Thông báo  — NotificationsScreen.handleNotificationPress
 *   2. bấm push                 — App.tsx → navigateFromPushNotificationData
 *
 * Trước SIS-180 mỗi đường tự giữ một bản ánh xạ và hai bản đã lệch nhau (ticket_picked_up,
 * crm_issue_sla_* chỉ có ở bản push). Thêm loại thông báo mới ⇒ sửa DUY NHẤT ở đây.
 *
 * Trả `null` khi không có màn đích riêng: caller tự quyết (push đưa về Trung tâm thông báo,
 * còn màn Thông báo thì đứng yên vì người dùng đang ở đó rồi).
 */
export async function resolveNotificationTarget(
  data: PushNotificationPayload
): Promise<NotificationTarget | null> {
  if (!data) return null;

  // === CHAT / Trao đổi ===
  if (isChatEvent(data)) {
    const convId = str(data.conversationId) || str(data.conversation_id) || str(data.chatId);
    if (!convId) return null;
    return {
      screen: ROUTES.SCREENS.EXCHANGE_CHAT,
      params: {
        conversationId: convId,
        classId: str(data.classId) || str(data.class_id) || undefined,
        // Cuộn thẳng tới tin nhắn được nhắc trong thông báo (SIS-180).
        messageId: str(data.messageId) || str(data.message_id) || undefined,
      },
    };
  }

  // === TICKET — IT (microservice cũ / Frappe) vs Hành chính (Frappe) ===
  if (matchesEvent(data, TICKET_EVENTS)) {
    const ticketId = str(data.ticketId) || str(data.ticket_id);
    if (!ticketId) return null;
    const isAdministrative =
      str(data.ticket_kind) === 'administrative' || str(data.ticketKind) === 'administrative';
    const screen = isAdministrative
      ? await getAdministrativeTicketDetailScreenName()
      : await getTicketDetailScreenName();
    return { screen, params: { ticketId } };
  }

  // === FEEDBACK / Góp ý ===
  if (matchesEvent(data, FEEDBACK_EVENTS)) {
    const feedbackId = str(data.feedbackId) || str(data.feedback_id);
    if (!feedbackId) return null;
    return { screen: ROUTES.SCREENS.FEEDBACK_DETAIL, params: { feedbackId } };
  }

  // === CRM ISSUE / Vấn đề ===
  if (matchesEvent(data, CRM_ISSUE_EVENTS)) {
    const issueId = str(data.issueId) || str(data.issue_id);
    if (!issueId) return null;
    return { screen: ROUTES.SCREENS.CRM_ISSUE_DETAIL, params: { issueId } };
  }

  // === ĐƠN NGHỈ PHÉP ===
  if (matchesEvent(data, LEAVE_EVENTS)) {
    return {
      screen: ROUTES.SCREENS.LEAVE_REQUESTS,
      params: {
        classId: str(data.class_id) || str(data.classId) || undefined,
        leaveRequestId: str(data.leave_request_id) || str(data.leaveRequestId) || undefined,
        fromNotification: true,
      },
    };
  }

  // === ĐIỂM DANH ===
  if (matchesEvent(data, ATTENDANCE_REMINDER_EVENTS) || matchesEvent(data, ATTENDANCE_EVENTS)) {
    return {
      screen: ROUTES.SCREENS.ATTENDANCE_HOME,
      params: { initialTab: str(data.tab) || 'GVCN' },
    };
  }

  // === Y TẾ HẰNG NGÀY ===
  if (matchesEvent(data, HEALTH_EVENTS)) {
    const visitId = str(data.visit_id) || str(data.visitId);
    switch (str(data.type)) {
      case 'health_visit_created':
      case 'health_visit_escalation':
      case 'health_visit_cancelled':
      case 'health_visit_rejected':
        return { screen: ROUTES.SCREENS.DAILY_HEALTH, params: {} };
      default:
        return visitId
          ? { screen: ROUTES.SCREENS.HEALTH_EXAM, params: { visitId } }
          : { screen: ROUTES.SCREENS.DAILY_HEALTH, params: {} };
    }
  }

  // === Bảng tin lớp (khác Wislife toàn trường đã ẩn) → Hoạt động lớp ===
  if (
    str(data.type) === 'wislife_class_post' ||
    str(data.action) === 'open_class_newsfeed'
  ) {
    return {
      screen: ROUTES.SCREENS.CLASS_ACTIVITY,
      params: {
        classId: str(data.classId) || str(data.class_id) || undefined,
        postId: str(data.postId) || undefined,
        fromNotification: true,
      },
    };
  }

  // === WISLIFE — module đã ẩn khỏi bottom tab (SIS-109) ===
  if (matchesEvent(data, WISLIFE_EVENTS)) {
    return null;
  }

  return null;
}

export async function persistPendingPushNotificationData(
  data: PushNotificationPayload
): Promise<void> {
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

  const target = await resolveNotificationTarget(data);
  if (target) {
    nav(target.screen, target.params);
    return;
  }

  // Không có màn đích (loại chưa hỗ trợ, wislife đã ẩn, hoặc payload thiếu id) → Trung tâm thông báo.
  console.log('📝 Không có màn đích cho thông báo:', data?.type, data?.action);
  nav(ROUTES.SCREENS.MAIN, {
    screen: ROUTES.MAIN.NOTIFICATIONS,
    params: data?.notificationId ? { notificationId: data.notificationId } : undefined,
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
