import type { NavigationContainerRef } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROUTES } from '../constants/routes';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { isAdminTicketStaff } from './administrativeTicketPermissions';

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

// Bàn giao thiết bị IT — xác nhận / phê duyệt biên bản điện tử
const INVENTORY_HANDOVER_EVENTS: readonly string[] = [
  'inventory_handover_pending_approval',
  'inventory_handover_pending_receiver',
  'inventory_handover_completed',
  'inventory_handover_rejected',
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

/**
 * Sự kiện y tế / sức khoẻ.
 * - NVYT (Mobile Medical) → màn Y tế (DailyHealth / HealthExam — ghi được hồ sơ)
 * - GVCN / còn lại → màn Sức khoẻ (TeacherHealth / StudentHealthDetail — chỉ xem + gửi PH)
 * Backend: daily_health_notification.py — `examination_created` khi publish hồ sơ cho GVCN;
 * các `health_visit_*` cũng gửi cả Mobile Medical lẫn Homeroom.
 */
const HEALTH_EVENTS: readonly string[] = [
  'daily_health',
  'health_examination',
  'examination_created',
  'health_visit_created',
  'health_visit_received',
  'health_visit_completed',
  'health_visit_escalation',
  'health_visit_cancelled',
  'health_visit_rejected',
];

/** Sự kiện chỉ dành cho luồng GVCN (publish hồ sơ) — luôn mở Sức khoẻ, kể cả user có cả Mobile Medical */
const TEACHER_HEALTH_ONLY_EVENTS: readonly string[] = [
  'examination_created',
];

/**
 * Họp phụ huynh 1:1 (SIS PT Meeting).
 *
 * Ba nhóm người nhận rất khác nhau nên một danh sách phẳng là đủ, việc rẽ nhánh để ở
 * `resolveNotificationTarget`:
 *   - `pt_meeting_published`            — lịch vừa xuất bản, gửi cho GV lẫn PH
 *   - `pt_meeting_cancelled_by_parent`  — PH huỷ ca, gửi GV của ca đó
 *   - `pt_meeting_waitlist`             — có PH vào danh sách chờ, gửi BGH/giáo vụ/GVCN
 *   - `pt_meeting_no_show`              — ca tự huỷ do GV không bấm "Bắt đầu họp"
 *   - `pt_meeting_note_required`        — nhắc GV ghi meeting note sau ca họp
 * Tập này được so với CẢ `type` LẪN `action` (xem `eventKeys`) vì backend không thống nhất.
 */
const PT_MEETING_EVENTS: readonly string[] = [
  'pt_meeting_published',
  'pt_meeting_cancelled_by_parent',
  'pt_meeting_waitlist',
  'pt_meeting_no_show',
  'pt_meeting_note_required',
];

/**
 * Sự kiện của luồng điều hành đợt họp, KHÔNG gắn với một ca cụ thể: người nhận cần thấy bức
 * tranh toàn đợt (ai đang chờ slot) chứ không phải lịch dạy của riêng mình.
 */
const PT_MEETING_ADMIN_EVENTS: readonly string[] = ['pt_meeting_waitlist'];

/**
 * Quản lý dự án (PM). Sổ tên gốc: `erp/api/erp_sis/project_management/notify.py`.
 *
 * Chia ba nhóm vì ba nhóm mở ba màn khác nhau. Mọi loại `pm_*` KHÔNG có tên ở
 * đây vẫn được nhận diện qua tiền tố (xem `resolveNotificationTarget`) và mở màn
 * "Công việc của tôi" — thêm loại mới ở backend mà quên khai ở đây thì nó vẫn đi
 * tới một chỗ có nghĩa, không chết lặng như trước (SIS-180).
 */
const PM_PROJECT_EVENTS: readonly string[] = [
  'pm_project_invited',
  'pm_project_invitation_responded',
  'pm_project_member_removed',
  'pm_project_role_changed',
  'pm_project_ownership_transferred',
];

const PM_MEETING_EVENTS: readonly string[] = [
  'pm_meeting_invited',
  'pm_meeting_updated',
  'pm_meeting_cancelled',
  'pm_meeting_reminder',
];

/** Lời mời mở màn Lời mời; các loại còn lại của nhóm dự án mở tab Thành viên. */
const PM_INVITATION_EVENTS: readonly string[] = [
  'pm_project_invited',
  'pm_project_invitation_responded',
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
  /** Biên bản bàn giao thiết bị (ERP Inventory Handover Log, vd INV-HO-00123) */
  handoverId?: string;
  handover_id?: string;
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
  /** Ca họp PH 1:1 (SIS PT Meeting Slot) — có id ca thì mở thẳng màn ghi meeting note */
  slotId?: string;
  slot_id?: string;
  /** Đợt họp PH 1:1 (SIS PT Meeting Event) — dùng cho thông báo cấp đợt (danh sách chờ) */
  eventId?: string;
  event_id?: string;
  /** Quản lý dự án (PM) */
  taskId?: string;
  task_id?: string;
  projectId?: string;
  project_id?: string;
  invitationId?: string;
  invitation_id?: string;
  meetingId?: string;
  meeting_id?: string;
  requirementId?: string;
  requirement_id?: string;
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
 * Khoá đủ để khẳng định payload do backend WIS phát ra. Thêm khoá mới khi
 * backend đổi tên, ĐỪNG nới thành "object không rỗng" — extras của launcher và
 * vỏ FCM cũng là object không rỗng.
 */
const RECOGNIZED_PAYLOAD_KEYS = [
  'type',
  'action',
  'screen',
  'notificationId',
  'conversationId',
  'conversation_id',
  'chatId',
  'ticketId',
  'ticket_id',
  'feedbackId',
  'feedback_id',
  'issueId',
  'issue_id',
  'leaveRequestId',
  'leave_request_id',
  'postId',
  // Họp PH 1:1 — bắt buộc có mặt ở đây, KHÔNG chỉ khai trong PushNotificationPayload.
  // Thiếu thì `isRecognizedNotificationPayload` trả false và cú bấm push lúc Android cold-start
  // bị coi là extras rác rồi bỏ qua im lặng — lỗi chỉ tái hiện được khi app đang tắt hẳn.
  'slotId',
  'slot_id',
  'eventId',
  'event_id',
  // Quản lý dự án — cùng lý do với slotId ở trên: thiếu ở đây thì cú bấm push
  // lúc Android cold-start bị coi là extras rác và bỏ qua im lặng.
  'taskId',
  'task_id',
  'projectId',
  'project_id',
  'invitationId',
  'invitation_id',
  'meetingId',
  'meeting_id',
] as const;

/**
 * Payload này có thật sự là thông báo của WIS không?
 *
 * PHẢI hỏi trước khi điều hướng: "notification response" trên Android không
 * phải lúc nào cũng đến từ việc người dùng bấm thông báo.
 * `ExpoNotificationLifecycleListener.onCreate` của expo-notifications lấy
 * NGUYÊN `activity.getIntent().getExtras()` rồi dựng thành response, không kiểm
 * tra extras đó có phải của thông báo hay không. Cộng với
 * `launchMode="singleTask"` — Android giữ lại Intent khởi chạy của task — nên
 * sau MỘT lần mở app từ thông báo, mọi lần mở lạnh sau đó (bấm icon, mở từ
 * recents) đều đọc lại đúng Intent cũ và phát lại "cú bấm" đó.
 *
 * Triệu chứng: mở app lên là nhảy thẳng vào Trung tâm thông báo thay vì ở trang
 * chủ — payload dựng từ extras lạ không khớp loại nào nên rơi xuống fallback
 * cuối của `navigateFromPushNotificationData`.
 *
 * LƯU Ý: không thay cho fallback đó. Thông báo THẬT mà app chưa hỗ trợ loại thì
 * vẫn phải mở Trung tâm thông báo — im lặng ở ca đó mới là lỗi.
 */
export function isRecognizedNotificationPayload(
  data: PushNotificationPayload | null | undefined
): boolean {
  if (!data) return false;
  return RECOGNIZED_PAYLOAD_KEYS.some((key) => str(data[key]).length > 0);
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
    return isAdminTicketStaff(storedRoles)
      ? ROUTES.SCREENS.ADMINISTRATIVE_TICKET_ADMIN_DETAIL
      : ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST_DETAIL;
  } catch {
    return ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST_DETAIL;
  }
}

async function getStoredRoles(): Promise<string[]> {
  try {
    const storedRolesStr = await AsyncStorage.getItem('userRoles');
    return storedRolesStr ? JSON.parse(storedRolesStr) : [];
  } catch {
    return [];
  }
}

function todayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Đích Sức khoẻ (GVCN) — không bao giờ mở HealthExam (màn ghi hồ sơ NVYT). */
function resolveTeacherHealthTarget(data: PushNotificationPayload): NotificationTarget {
  const studentId = str(data.student_id) || str(data.studentId);
  const classId = str(data.class_id) || str(data.classId);
  if (studentId && classId) {
    return {
      screen: ROUTES.SCREENS.STUDENT_HEALTH_DETAIL,
      params: {
        classId,
        studentId,
        date: todayDateStr(),
      },
    };
  }
  return { screen: ROUTES.SCREENS.TEACHER_HEALTH, params: {} };
}

/** Đích Y tế (NVYT) — giữ hành vi cũ theo type. */
function resolveMedicalHealthTarget(data: PushNotificationPayload): NotificationTarget {
  const visitId = str(data.visit_id) || str(data.visitId);
  const eventType = str(data.type) || str(data.action);
  switch (eventType) {
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

  // === QUẢN LÝ DỰ ÁN (PM) ===
  // Nhận theo TIỀN TỐ `pm_` chứ không theo danh sách đóng: backend còn thêm loại,
  // và một thông báo mở nhầm màn vẫn hơn một thông báo bấm vào không làm gì.
  if (eventKeys(data).some((key) => /^pm_/i.test(key))) {
    const projectId = str(data.projectId) || str(data.project_id);

    if (matchesEvent(data, PM_MEETING_EVENTS)) {
      const meetingId = str(data.meetingId) || str(data.meeting_id);
      // Huỷ họp: bản ghi đã bị xoá, mở chi tiết chỉ ra lỗi → về danh sách họp.
      if (meetingId && !matchesEvent(data, ['pm_meeting_cancelled'])) {
        return { screen: ROUTES.SCREENS.PM_MEETING_DETAIL, params: { meetingId, projectId } };
      }
      return projectId
        ? {
            screen: ROUTES.SCREENS.PM_PROJECT_DETAIL,
            params: { projectId, initialTab: 'meetings' },
          }
        : { screen: ROUTES.SCREENS.PM_PROJECTS };
    }

    if (matchesEvent(data, PM_INVITATION_EVENTS)) {
      return { screen: ROUTES.SCREENS.PM_INVITATIONS };
    }

    if (matchesEvent(data, PM_PROJECT_EVENTS)) {
      return projectId
        ? { screen: ROUTES.SCREENS.PM_PROJECT_DETAIL, params: { projectId, initialTab: 'members' } }
        : { screen: ROUTES.SCREENS.PM_PROJECTS };
    }

    if (matchesEvent(data, ['pm_requirement_status_changed'])) {
      return projectId
        ? {
            screen: ROUTES.SCREENS.PM_PROJECT_DETAIL,
            params: { projectId, initialTab: 'requirements' },
          }
        : { screen: ROUTES.SCREENS.PM_PROJECTS };
    }

    if (matchesEvent(data, ['pm_resource_uploaded'])) {
      return projectId
        ? {
            screen: ROUTES.SCREENS.PM_PROJECT_DETAIL,
            params: { projectId, initialTab: 'resources' },
          }
        : { screen: ROUTES.SCREENS.PM_PROJECTS };
    }

    // Còn lại là sự kiện cấp task. Có `taskId` thì mở thẳng chi tiết — kể cả
    // subtask, vốn không nằm trên bảng. Không có id (vd nhắc hạn gộp) thì đưa về
    // "Công việc của tôi" chứ không phải bảng của một dự án cụ thể.
    const taskId = str(data.taskId) || str(data.task_id);
    if (taskId) return { screen: ROUTES.SCREENS.PM_TASK_DETAIL, params: { taskId } };
    return { screen: ROUTES.SCREENS.PM_MY_WORK };
  }

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

  // === BÀN GIAO THIẾT BỊ — mở "Tài sản của tôi" đúng hồ sơ ===
  if (matchesEvent(data, INVENTORY_HANDOVER_EVENTS)) {
    const handoverId = str(data.handover_id) || str(data.handoverId);
    return { screen: ROUTES.SCREENS.MY_HANDOVERS, params: { handoverId: handoverId || undefined } };
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

  // === Y TẾ / SỨC KHOẺ — phân nhánh theo role (tránh GVCN vào HealthExam ghi hồ sơ) ===
  if (matchesEvent(data, HEALTH_EVENTS)) {
    // Publish hồ sơ khám → luôn mở Sức khoẻ (đúng người nhận là GVCN)
    if (matchesEvent(data, TEACHER_HEALTH_ONLY_EVENTS)) {
      return resolveTeacherHealthTarget(data);
    }

    const roles = await getStoredRoles();
    const hasMobileMedical = roles.includes('Mobile Medical');
    if (hasMobileMedical) {
      return resolveMedicalHealthTarget(data);
    }
    // GVCN / Giám thị / BOD không có Mobile Medical → Sức khoẻ (read)
    return resolveTeacherHealthTarget(data);
  }

  // === HỌP PHỤ HUYNH 1:1 ===
  if (matchesEvent(data, PT_MEETING_EVENTS)) {
    // Danh sách chờ là thông báo cấp ĐỢT, không phải cấp ca: BGH cần màn tổng hợp để thấy ai
    // đang chờ slot. Người nhận không phải BGH (GVCN) không mở được màn đó — nó tự chặn theo
    // role — nên đưa họ về lịch ca của mình thay vì đá vào một màn hình rỗng.
    if (matchesEvent(data, PT_MEETING_ADMIN_EVENTS)) {
      const roles = await getStoredRoles();
      if (roles.includes('Mobile BOD')) {
        return { screen: ROUTES.SCREENS.PARENT_MEETING_ADMIN };
      }
      return { screen: ROUTES.SCREENS.PARENT_MEETING };
    }

    // Chỉ các sự kiện gắn với một ca cụ thể (`pt_meeting_note_required`, và no-show/huỷ ca khi
    // backend kèm id) mới mang `slot_id`. Có id thì đi thẳng màn ghi note — đây là hành động
    // GV phải làm ngay, bắt họ tự dò lại ca trong danh sách là mất luôn cái note.
    const slotId = str(data.slotId) || str(data.slot_id);
    if (slotId) {
      return { screen: ROUTES.SCREENS.PARENT_MEETING_NOTE, params: { slotId } };
    }
    return { screen: ROUTES.SCREENS.PARENT_MEETING };
  }

  // === Bảng tin lớp (khác Wislife toàn trường đã ẩn) → Hoạt động lớp ===
  if (str(data.type) === 'wislife_class_post' || str(data.action) === 'open_class_newsfeed') {
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
 *
 * @returns `true` khi đã xử lý xong (đã điều hướng, hoặc payload rác không cần giữ lại);
 *          `false` khi phải HOÃN — payload đã được lưu pending và người gọi PHẢI giữ nó lại.
 */
export async function navigateFromPushNotificationData(
  data: PushNotificationPayload,
  navigationRef: NavigationContainerRef<RootStackParamList> | null
): Promise<boolean> {
  // Không mang khoá định tuyến nào ⇒ không phải thông báo của WIS mà là extras
  // của Intent khởi chạy bị expo-notifications dựng nhầm thành response (xem
  // `isRecognizedNotificationPayload`). Đứng yên — điều hướng ở đây là kéo người
  // dùng ra khỏi màn đang xem dù họ không bấm gì.
  if (!isRecognizedNotificationPayload(data)) {
    console.log('📝 Bỏ qua response không nhận diện được:', data);
    return true;
  }

  if (await shouldDeferNavigation(navigationRef)) {
    await persistPendingPushNotificationData(data);
    return false;
  }

  const nav = (name: string, params?: object) => {
    (navigationRef as any).navigate(name, params);
  };

  const target = await resolveNotificationTarget(data);
  if (target) {
    nav(target.screen, target.params);
    return true;
  }

  // Không có màn đích (loại chưa hỗ trợ, wislife đã ẩn, hoặc payload thiếu id) → Trung tâm thông báo.
  console.log('📝 Không có màn đích cho thông báo:', data?.type, data?.action);
  nav(ROUTES.SCREENS.MAIN, {
    screen: ROUTES.MAIN.NOTIFICATIONS,
    params: data?.notificationId ? { notificationId: data.notificationId } : undefined,
  });
  return true;
}

/** Chặn hai đường gọi (onReady + effect theo auth) cùng đọc pending một lúc → điều hướng hai lần. */
let consumingPending = false;

/**
 * Gọi sau khi đăng nhập + navigation ready để xử lý payload đã lưu khi cold start.
 *
 * CHỈ xoá pending khi đã điều hướng THẬT SỰ. Trước đây hàm này xoá trước rồi mới gọi
 * navigate: mở lạnh thì `AppNavigator` còn đang trả `<SplashScreen/>` (~2,9 giây, chưa có
 * Stack nào mount ⇒ `isReady()` false) nên navigate rơi vào nhánh hoãn, payload bị ghi lại
 * và KHÔNG ai đọc nữa trong phiên đó — người dùng bấm thông báo tin nhắn nhưng app đứng ở
 * trang chủ, còn lần mở app SAU thì lại nhảy vào đoạn chat cũ.
 */
export async function consumePendingPushNotificationIfAny(
  navigationRef: NavigationContainerRef<RootStackParamList> | null
): Promise<void> {
  if (consumingPending) return;
  consumingPending = true;
  try {
    const raw = await AsyncStorage.getItem(PENDING_PUSH_NOTIFICATION_DATA_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as PushNotificationPayload;
    const handled = await navigateFromPushNotificationData(data, navigationRef);
    if (handled) {
      await AsyncStorage.removeItem(PENDING_PUSH_NOTIFICATION_DATA_KEY);
    }
  } catch (e) {
    console.warn('⚠️ consumePendingPushNotificationIfAny:', e);
  } finally {
    consumingPending = false;
  }
}
