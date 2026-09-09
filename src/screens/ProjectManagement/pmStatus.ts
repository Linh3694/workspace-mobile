import type { IconV2Name } from '../../components/ui-v2/level-0-atoms/media/iconRegistry';
import type { StatusMap } from '@molecules';

import { color } from '../../theme/tokens';
import type {
  InvitationStatus,
  ProjectRole,
  RequirementStatus,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '../../types/projectManagement';

/**
 * Bảng tra NGHIỆP VỤ của module Quản lý dự án: mã trạng thái → nhãn + tone màu.
 *
 * Cùng quy ước với `screens/Devices/deviceStatus.ts`: tone là TOKEN chứ không
 * phải hex, nên đổi bộ nhận diện thì màu đi theo. Bản web của module này giữ một
 * bảng `BRAND_COLORS` hex riêng — cố ý không bê sang.
 *
 * Nhãn để nguyên tiếng Việt ở đây và bọc `t(key, fallback)` tại nơi render;
 * đóng băng chuỗi đã dịch ở module-load thì đổi ngôn ngữ không có tác dụng cho
 * tới khi khởi động lại app.
 */

export const TASK_STATUS: StatusMap = {
  backlog: { label: 'Chờ xử lý', tone: 'neutral' },
  todo: { label: 'Cần làm', tone: 'info' },
  in_progress: { label: 'Đang làm', tone: 'warning' },
  review: { label: 'Đang review', tone: 'brandSecondary' },
  done: { label: 'Hoàn thành', tone: 'success' },
};

export const TASK_PRIORITY: StatusMap = {
  low: { label: 'Thấp', tone: 'neutral' },
  medium: { label: 'Trung bình', tone: 'info' },
  high: { label: 'Cao', tone: 'warning' },
  critical: { label: 'Khẩn cấp', tone: 'danger' },
};

export const TASK_TYPE: StatusMap = {
  task: { label: 'Công việc', tone: 'brandSecondary' },
  bug: { label: 'Lỗi', tone: 'danger' },
  story: { label: 'Tính năng', tone: 'info' },
};

export const REQUIREMENT_STATUS: StatusMap = {
  new: { label: 'Mới', tone: 'info' },
  approved: { label: 'Đã duyệt', tone: 'success' },
  rejected: { label: 'Từ chối', tone: 'danger' },
};

export const PROJECT_ROLE: StatusMap = {
  owner: { label: 'Chủ dự án', tone: 'brand' },
  manager: { label: 'Quản lý', tone: 'brandSecondary' },
  member: { label: 'Thành viên', tone: 'info' },
  viewer: { label: 'Người xem', tone: 'neutral' },
};

export const INVITATION_STATUS: StatusMap = {
  pending: { label: 'Đang chờ', tone: 'warning' },
  accepted: { label: 'Đã tham gia', tone: 'success' },
  declined: { label: 'Đã từ chối', tone: 'neutral' },
  expired: { label: 'Hết hạn', tone: 'danger' },
};

/** Khoá i18n theo từng mã — dùng `t(key, fallbackTuNhungBangTren)` tại nơi render. */
export const i18nKey = {
  taskStatus: (s: TaskStatus) => `project_management.trang_thai_${s}`,
  priority: (p: TaskPriority) => `project_management.uu_tien_${p}`,
  taskType: (t: TaskType) => `project_management.loai_${t}`,
  requirementStatus: (s: RequirementStatus) => `project_management.yeu_cau_${s}`,
  role: (r: ProjectRole) => `project_management.vai_tro_${r}`,
  invitationStatus: (s: InvitationStatus) => `project_management.loi_moi_${s}`,
};

/**
 * Icon cho từng loại issue.
 *
 * Kiểu là `IconV2Name` chứ KHÔNG phải `string`: tên không có trong bộ icon-v2 sẽ
 * rơi xuống Ionicons, và Ionicons vẽ ra một dấu "?" thay vì báo lỗi — sai tên thì
 * chỉ phát hiện được bằng mắt trên máy thật. Ràng buộc kiểu ở đây để tsc chặn từ
 * lúc gõ. (Muốn dùng icon của Ionicons thì truyền `set="ion"` ngay tại chỗ render.)
 */
export const TASK_TYPE_ICON: Record<TaskType, IconV2Name> = {
  task: 'list-check',
  bug: 'issue',
  story: 'star',
};

/**
 * Thứ tự cột trên bảng. Trùng với `BOARD_STATUSES` bên types nhưng giữ riêng ở
 * đây vì đây là thứ tự TRÌNH BÀY — đảo cột trên app không được đụng tới danh
 * sách trạng thái hợp lệ mà backend nhận.
 */
export const BOARD_COLUMN_ORDER: readonly TaskStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done',
] as const;


/**
 * Tone (token) → mã màu, để vẽ chip/nhãn tự pha nền nhạt.
 *
 * `StatusBadge` tự lo phần này, nhưng thẻ trên bảng cần màu THÔ để tô nền ở độ
 * mờ riêng (khuôn chip của Cloud V), nên phải tra ra giá trị thật. Vẫn đi qua
 * token, không viết hex.
 */
export function toneColor(tone?: string): string {
  switch (tone) {
    case 'brand':
      return color.brand.DEFAULT;
    case 'brandSecondary':
      return color.brandSecondary.DEFAULT;
    case 'accent':
      return color.accent.DEFAULT;
    case 'success':
      return color.success.DEFAULT;
    case 'danger':
      return color.danger.DEFAULT;
    case 'warning':
      return color.warning.DEFAULT;
    case 'info':
      return color.info.DEFAULT;
    default:
      return color.neutral[500];
  }
}
