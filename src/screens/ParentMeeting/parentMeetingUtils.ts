/**
 * Helper thuần cho tính năng "Họp phụ huynh 1:1" (SIS PT Meeting) trên app CBGVNV.
 *
 * Backend CỐ TÌNH trả ngày ("YYYY-MM-DD") và giờ ca ("HH:mm") ở hai field chuỗi riêng,
 * không có datetime ISO: Frappe lưu datetime naive theo giờ server (Asia/Ho_Chi_Minh), nên
 * `new Date(chuỗi_không_offset)` trên máy giáo viên đang để múi giờ khác sẽ đẩy ca sang giờ
 * — thậm chí sang ngày — khác. Vì vậy mọi phép so sánh & định dạng dưới đây làm việc trên
 * CHUỖI (hoặc số phút trong ngày), chỉ dựng `Date` khi cần chữ "Thứ mấy" cho tiêu đề nhóm.
 *
 * Type dùng chung khai báo ở `src/types/parentMeeting.ts` (khớp response backend) — file này
 * chỉ thêm những thứ thuộc về TRÌNH BÀY (nhãn, nhóm ngày, sắc thái badge).
 */
import type {
  PTEventStatus,
  PTSlotStatus,
  PTTeacherGroup,
  PTTeacherSlot,
} from '../../types/parentMeeting';

/** Nhãn nhóm giáo viên — chốt trong design contract mục 5, khớp GROUP_LABELS_VN của backend. */
export const PT_TEACHER_GROUP_LABELS: Record<PTTeacherGroup, string> = {
  homeroom: 'Giáo viên chủ nhiệm',
  international: 'Giáo viên Chương trình Quốc tế',
  subject: 'Giáo viên bộ môn',
  psychology: 'Tâm lý học đường',
  ucc: 'UCC',
};

/**
 * Nhãn nhóm GV để hiển thị.
 *
 * Ưu tiên nhãn server gửi kèm (`teacher_group_label_vn`): bốn app cùng đọc một bộ nhãn thì
 * không thể lệch chữ khi nhà trường đổi cách gọi một nhóm. Bảng dịch trên đây chỉ là lưới an
 * toàn cho response cũ. Mã lạ (nhóm mới thêm bên backend) thì trả về nguyên mã thay vì chuỗi
 * rỗng — đọc được "ucc2" vẫn hơn nhìn một ô trống không hiểu là ca gì.
 */
export function getTeacherGroupLabel(
  group?: PTTeacherGroup | null,
  serverLabel?: string | null
): string {
  const label = String(serverLabel || '').trim();
  if (label) return label;
  const key = String(group || '').trim();
  if (!key) return '';
  return PT_TEACHER_GROUP_LABELS[key as PTTeacherGroup] || key;
}

/** Sắc thái hiển thị của badge trạng thái — utils giữ ngữ nghĩa, màn hình chọn mã màu. */
export type PTStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface PTSlotStatusInfo {
  label: string;
  tone: PTStatusTone;
  /** Câu giải thích thêm, chỉ có ở trạng thái dễ bị hiểu sai. */
  description?: string;
}

/**
 * Nhãn trạng thái ca.
 *
 * `auto_cancelled_no_show` được tách hẳn khỏi nhóm "đã huỷ" và kèm câu giải thích: giáo viên
 * nhìn thấy chữ "Đã huỷ" sẽ đinh ninh là phụ huynh huỷ, trong khi thực tế ca mất vì chính họ
 * chưa bấm "Bắt đầu họp" đúng hạn. Hiểu nhầm này khiến GV không sửa được hành vi ở lần sau,
 * còn giáo vụ thì không giải thích nổi khi phụ huynh gọi lên hỏi.
 */
export function getSlotStatusInfo(status?: PTSlotStatus | null): PTSlotStatusInfo {
  switch (status) {
    case 'open':
      return { label: 'Chưa có phụ huynh đăng ký', tone: 'neutral' };
    case 'booked':
      return { label: 'Đã có phụ huynh đăng ký', tone: 'info' };
    case 'in_progress':
      return { label: 'Đang họp', tone: 'success' };
    case 'completed':
      return { label: 'Đã họp xong', tone: 'neutral' };
    case 'cancelled_by_parent':
      return { label: 'Phụ huynh đã huỷ', tone: 'danger' };
    case 'cancelled_by_teacher':
      return { label: 'Bạn đã huỷ ca này', tone: 'danger' };
    case 'cancelled_by_school':
      return { label: 'Nhà trường đã huỷ', tone: 'danger' };
    case 'auto_cancelled_no_show':
      return {
        label: 'Tự huỷ do chưa bắt đầu',
        tone: 'warning',
        description:
          'Hệ thống huỷ ca này vì quá hạn mà chưa bấm "Bắt đầu họp" — không phải phụ huynh huỷ.',
      };
    default:
      return { label: 'Không xác định', tone: 'neutral' };
  }
}

/** Ca đã kết thúc theo hướng huỷ (mọi biến thể) — dùng để tắt nút thao tác. */
export function isSlotCancelled(status?: PTSlotStatus | null): boolean {
  return String(status || '').startsWith('cancelled_') || status === 'auto_cancelled_no_show';
}

/** Riêng ca bị hệ thống tự huỷ — phải hiển thị khác hẳn ca huỷ thường. */
export function isAutoCancelledNoShow(status?: PTSlotStatus | null): boolean {
  return status === 'auto_cancelled_no_show';
}

/** Nhãn trạng thái đợt họp. `Scheduled` phải nói rõ là NHÁP, nếu không BGH tưởng đã xong việc. */
export const PT_EVENT_STATUS_LABELS: Record<PTEventStatus, string> = {
  Draft: 'Nháp',
  RegistrationOpen: 'Đang mở đăng ký',
  RegistrationClosed: 'Đã đóng đăng ký',
  Scheduled: 'Đã xếp lịch (nháp)',
  Published: 'Đã xuất bản',
  Completed: 'Đã hoàn tất',
  Cancelled: 'Đã huỷ',
};

export function getEventStatusLabel(status?: PTEventStatus | null): string {
  const key = String(status || '').trim();
  if (!key) return '';
  return PT_EVENT_STATUS_LABELS[key as PTEventStatus] || key;
}

/** "HH:mm[:ss]" → "HH:mm" (zero-pad). Không đọc được → "". */
export function toHHmm(value?: string | null): string {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** "HH:mm[:ss]" → số phút trong ngày; -1 khi không đọc được (ca lỗi bị đẩy xuống cuối khi sort). */
export function parseTimeToMinutes(value?: string | null): number {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Cộng phút vào "HH:mm", cuộn vòng trong ngày. */
export function addMinutesToHHmm(value: string, minutes: number): string {
  const base = parseTimeToMinutes(value);
  if (base < 0) return '';
  const total = (((base + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** "07:30 – 07:45"; thiếu dữ liệu vẫn giữ chỗ để layout không nhảy. */
export function formatTimeRange(start?: string | null, end?: string | null): string {
  return `${toHHmm(start) || '--:--'} – ${toHHmm(end) || '--:--'}`;
}

/** "YYYY-MM-DD" → Date lúc 00:00 giờ máy (dựng bằng số, không qua UTC, để khỏi lệch ngày). */
export function parseDateOnly(value?: string | null): Date | null {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

const WEEKDAY_LABELS_VI = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Tiêu đề nhóm ngày: "Hôm nay · Thứ 4, 15/07/2026". */
export function formatDayHeader(date: Date, today: Date = new Date()): string {
  const wd = WEEKDAY_LABELS_VI[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const base = `${wd}, ${dd}/${mm}/${date.getFullYear()}`;
  return isSameDay(date, today) ? `Hôm nay · ${base}` : base;
}

/**
 * "YYYY-MM-DD HH:mm:ss" (giờ server) → "HH:mm DD/MM".
 * Cắt chuỗi bằng regex thay vì `new Date()` — xem lý do ở đầu file.
 */
export function formatDateTimeShort(value?: string | null): string {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return '';
  return `${m[4]}:${m[5]} ${m[3]}/${m[2]}`;
}

/** "YYYY-MM-DD" → "15/07/2026" */
export function formatDateShort(value?: string | null): string {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export interface PTSlotDayGroup {
  key: string;
  /** null khi backend không trả `meeting_date` — vẫn giữ nhóm để ca không biến mất */
  date: Date | null;
  label: string;
  items: PTTeacherSlot[];
}

/**
 * Nhóm ca theo ngày họp, sắp tăng dần theo (ngày, giờ bắt đầu).
 *
 * Ca thiếu `meeting_date` KHÔNG bị loại bỏ mà gom vào một nhóm cuối: dữ liệu lỗi mà biến mất
 * khỏi danh sách thì giáo viên tưởng mình rảnh và bỏ họp — hiện ra vẫn hơn im lặng.
 */
export function groupSlotsByDay(slots: PTTeacherSlot[]): PTSlotDayGroup[] {
  const sorted = [...slots].sort((a, b) => {
    const da = String(a.meeting_date || '');
    const db = String(b.meeting_date || '');
    if (da !== db) {
      // Ca không có ngày xếp sau cùng
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : 1;
    }
    return parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time);
  });

  const groups: Record<string, PTSlotDayGroup> = {};
  const order: string[] = [];
  const today = new Date();

  for (const slot of sorted) {
    const key = String(slot.meeting_date || '__unknown__');
    if (!groups[key]) {
      const date = parseDateOnly(slot.meeting_date);
      groups[key] = {
        key,
        date,
        label: date ? formatDayHeader(date, today) : 'Chưa xác định ngày',
        items: [],
      };
      order.push(key);
    }
    groups[key].items.push(slot);
  }

  return order.map((k) => groups[k]);
}

/**
 * Số phút được phép trễ trước khi cron tự huỷ ca.
 *
 * `get_my_teacher_slots` KHÔNG trả field này (nó thuộc về đợt họp) — màn hình phải lấy từ
 * `PTMeetingEvent.auto_cancel_after_minutes` rồi gắn vào ca. Trả `null` khi không có, và
 * TUYỆT ĐỐI không mặc định 10 ở client: giáo vụ chỉnh ngưỡng này theo từng đợt, hiện một con
 * số tự bịa còn tệ hơn không hiện vì giáo viên sẽ căn giờ theo con số sai đó.
 */
export function getAutoCancelMinutes(slot: PTTeacherSlot): number | null {
  const minutes = Number(slot.auto_cancel_after_minutes);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

/** Ngưỡng tự huỷ chung của danh sách (các ca cùng đợt dùng chung một cấu hình). */
export function getAutoCancelMinutesOfList(slots: PTTeacherSlot[]): number | null {
  for (const slot of slots) {
    const minutes = getAutoCancelMinutes(slot);
    if (minutes !== null) return minutes;
  }
  return null;
}

/** Hạn chót bấm "Bắt đầu họp" = giờ vào ca + N phút; "" khi thiếu dữ liệu. */
export function getStartDeadline(slot: PTTeacherSlot): string {
  const minutes = getAutoCancelMinutes(slot);
  const start = toHHmm(slot.start_time);
  if (minutes === null || !start) return '';
  return addMinutesToHHmm(start, minutes);
}

/**
 * Câu nhắc luật tự huỷ hiển thị ở đầu màn hình. Viết dạng mệnh lệnh + hậu quả vì đây là cách
 * duy nhất trong module khiến giáo viên mất ca mà không ai báo trước, và mất rồi thì ca không
 * khôi phục được.
 */
export function getAutoCancelNotice(minutes: number | null): string {
  if (minutes === null) {
    return 'Hãy bấm "Bắt đầu họp" ngay khi vào ca. Quá thời hạn nhà trường quy định mà chưa bấm, hệ thống sẽ TỰ HUỶ ca.';
  }
  return `Hãy bấm "Bắt đầu họp" trong vòng ${minutes} phút kể từ giờ vào ca. Quá ${minutes} phút mà chưa bấm, hệ thống sẽ TỰ HUỶ ca và phụ huynh được báo là ca không diễn ra.`;
}

/** Ca đang chờ giáo viên bấm bắt đầu. */
export function canStartSlot(slot: PTTeacherSlot): boolean {
  return slot.status === 'booked';
}

/** Chỉ ca đang họp mới có gì để kết thúc. */
export function canCompleteSlot(slot: PTTeacherSlot): boolean {
  return slot.status === 'in_progress';
}

/** Ca đã họp xong hoặc đã huỷ thì huỷ tiếp là làm sai lịch sử. */
export function canCancelSlot(slot: PTTeacherSlot): boolean {
  return slot.status === 'booked' || slot.status === 'in_progress';
}

/**
 * Ghi chú sau họp: backend chỉ nhận ca `in_progress` hoặc `completed`, và đợt phải bật
 * `allow_meeting_note`. Mở nút sớm hơn thì giáo viên gõ xong mới ăn lỗi 417.
 */
export function canWriteNote(slot: PTTeacherSlot): boolean {
  if (slot.allow_meeting_note === 0) return false;
  return slot.status === 'in_progress' || slot.status === 'completed';
}

/* ------------------------------------------------------------------------- *
 * Phân quyền màn tổng hợp đợt họp (ParentMeetingAdminScreen)
 * ------------------------------------------------------------------------- */

/**
 * Nhóm ĐỌC tổng hợp đợt + danh sách chờ.
 *
 * Có cả role mobile (`Mobile BOD`) lẫn role backend (`SIS BOD`) vì hai hệ role này được cấp
 * rời nhau trên Frappe: BGH nào chỉ mới có `Mobile BOD` mà chưa được gán `SIS BOD` vẫn phải
 * giữ nguyên lối vào cũ, nếu không bản vá phân quyền này lại thành một lỗi mất quyền mới.
 * Trên mobile `user.roles` là danh sách role Frappe THÔ (chưa lọc tiền tố "Mobile "), nên đối
 * chiếu role backend ở client là hợp lệ — cùng cách `crmIssuePermissions.ts` đang làm.
 *
 * ⚠️ DANH SÁCH NÀY PHẢI NẰM TRỌN trong nhóm được `_report_scope` (backend) cho xem cả đợt:
 * `REPORT_READER_ROLES` của `erp/api/erp_sis/parent_meeting.py` (`System Manager`, `SIS BOD`,
 * `Mobile BOD`) cộng nhóm có quyền GHI trên đợt (`SIS Manager`). Thừa một role ở đây là hỏng theo
 * kiểu tệ nhất: client cho vào màn hình, backend trả 403, và người dùng đọc được một con số
 * sai chứ không phải một thông báo lỗi. Thêm role ở đây thì phải thêm ở đó trước.
 */
export const PT_ADMIN_VIEW_ROLES = [
  'System Manager',
  'SIS Manager',
  'SIS BOD',
  'Mobile BOD',
] as const;

/**
 * Nhóm được XUẤT BẢN lịch — CỐ TÌNH không có BGH.
 *
 * Backend `publish_schedule` chốt bằng `frappe.has_permission("SIS PT Meeting Event", "write")`,
 * mà DocType chỉ cấp `write` cho `System Manager` và `SIS Manager` (giáo vụ); `SIS BOD` là read-only.
 * Đây không phải chi tiết kỹ thuật mà là nghiệp vụ: xuất bản gửi thông báo cho toàn bộ phụ huynh
 * và KHÔNG rút lại được, nên chỉ người nắm tình trạng danh sách chờ (giáo vụ) mới được bấm.
 * Giữ đúng một nguồn phán quyền với web (`roleUtils.canManageParentMeeting`).
 */
export const PT_PUBLISH_ROLES = ['System Manager', 'SIS Manager'] as const;

function hasAnyRole(roles: string[], allowed: readonly string[]): boolean {
  return allowed.some((r) => roles.includes(r));
}

/** Được mở màn tổng hợp đợt (chỉ ĐỌC: số liệu đợt + danh sách chờ). */
export function canViewParentMeetingAdmin(roles: string[]): boolean {
  return hasAnyRole(roles, PT_ADMIN_VIEW_ROLES);
}

/** Được bấm "Xuất bản lịch" — hẹp hơn quyền xem, xem `PT_PUBLISH_ROLES`. */
export function canPublishParentMeetingSchedule(roles: string[]): boolean {
  return hasAnyRole(roles, PT_PUBLISH_ROLES);
}

/** Tên học sinh để hiển thị; ca trống thì nói rõ thay vì để một dòng trắng. */
export function getStudentLabel(slot: PTTeacherSlot): string {
  const name = String(slot.student_name || '').trim();
  if (name) return name;
  return slot.status === 'open' ? 'Chưa có phụ huynh đăng ký' : 'Không rõ học sinh';
}
