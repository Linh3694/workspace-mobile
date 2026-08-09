/**
 * Ticket Hành chính — map trạng thái/nhãn khớp web (ticketConstants) & backend ERP Administrative Ticket
 */

/** Nhãn tiếng Việt theo giá trị status từ API */
export const ADMIN_TICKET_STATUS_LABELS: Record<string, string> = {
  Open: 'Mở',
  Assigned: 'Đã tiếp nhận',
  'In Progress': 'Đang xử lý',
  Done: 'Đã hoàn thành',
  Resolved: 'Đã xử lý xong',
  'Waiting for Customer': 'Chờ người dùng phản hồi',
  Closed: 'Đã đóng',
  Cancelled: 'Đã hủy',
};

export function getAdminTicketStatusLabel(status?: string): string {
  if (!status) return '';
  if (ADMIN_TICKET_STATUS_LABELS[status]) return ADMIN_TICKET_STATUS_LABELS[status];
  const lower = status.toLowerCase();
  if (lower === 'processing') return ADMIN_TICKET_STATUS_LABELS['In Progress'] || 'Đang xử lý';
  return status;
}

/** Màu nền Tailwind NativeWind (className) — tương đương web getTicketStatusStyle */
export function getAdminTicketStatusColorClass(status?: string): string {
  const s = (status || '').toLowerCase().trim();
  switch (s) {
    case 'open':
      return 'bg-slate-500';
    case 'assigned':
      return 'bg-[#002855]';
    case 'in progress':
    case 'processing':
      return 'bg-[#FFCE02]';
    case 'waiting for customer':
      return 'bg-[#F5AA1E]';
    case 'done':
    case 'resolved':
      return 'bg-[#BED232]';
    case 'closed':
      return 'bg-[#00687F]';
    case 'cancelled':
      return 'bg-[#F05023]';
    default:
      return 'bg-gray-500';
  }
}

/** Cho filter nút trên list (admin) — giá trị API */
export const ADMIN_TICKET_FILTER_STATUSES = {
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
} as const;

/** Cho sheet đổi trạng thái (staff) — giá trị API Frappe */
export const ADMIN_TICKET_STAFF_STATUS_OPTIONS = ['In Progress', 'Done', 'Cancelled'] as const;

// ============================================================================
// Công việc con (subtask) — doctype ERP Administrative Ticket Sub Task
// ============================================================================

/** Trạng thái subtask coi là còn phải làm (khớp _SUBTASK_OPEN_STATUSES ở backend). */
export const ADMIN_SUBTASK_OPEN_STATUSES = ['In Progress'] as const;

export function isAdminSubTaskOpen(status?: string): boolean {
  return (ADMIN_SUBTASK_OPEN_STATUSES as readonly string[]).includes(status || '');
}

/**
 * Nhãn thuần theo trạng thái.
 *
 * LƯU Ý: màn chi tiết (SubTaskSection) hiển thị "Chờ xử lý" cho các subtask
 * `In Progress` KHÔNG phải cái đầu tiên trong hàng đợi của ticket. Đó là thông tin
 * *vị trí*, không phải trạng thái, nên nó nằm ở SubTaskSection chứ không nằm ở đây —
 * ở màn "Việc của tôi" mảng chỉ gồm subtask của tôi nên "cái đầu tiên" là sản phẩm
 * của một bộ lọc khác, gán "Chờ xử lý" theo vị trí sẽ sai.
 */
export const ADMIN_SUBTASK_STATUS_LABELS: Record<string, string> = {
  'In Progress': 'Đang xử lý',
  Completed: 'Hoàn thành',
  Cancelled: 'Đã huỷ',
};

export function getAdminSubTaskStatusLabel(status?: string): string {
  return ADMIN_SUBTASK_STATUS_LABELS[status || ''] || status || '';
}

export interface AdminSubTaskStatusStyle {
  bgColor: string;
  textColor: string;
  textDecorationLine: 'none' | 'line-through';
}

/** Màu nền/chữ theo trạng thái subtask — giữ đúng bảng màu đang dùng ở SubTaskSection. */
export function getAdminSubTaskStatusStyle(status?: string): AdminSubTaskStatusStyle {
  switch (status) {
    case 'Completed':
      return { bgColor: '#E4EFE6', textColor: '#009483', textDecorationLine: 'none' };
    case 'Cancelled':
      return { bgColor: '#EBEBEB', textColor: '#757575', textDecorationLine: 'line-through' };
    case 'In Progress':
      return { bgColor: '#E6EEF6', textColor: '#002855', textDecorationLine: 'none' };
    default:
      return { bgColor: '#fff', textColor: '#222', textDecorationLine: 'none' };
  }
}

/** Style cho subtask `In Progress` đang xếp hàng chờ (chỉ dùng ở màn chi tiết). */
export const ADMIN_SUBTASK_QUEUED_STYLE: AdminSubTaskStatusStyle = {
  bgColor: '#EBEBEB',
  textColor: '#757575',
  textDecorationLine: 'none',
};

export const ADMIN_SUBTASK_QUEUED_LABEL = 'Chờ xử lý';

/** Số ảnh đính kèm tối đa khi tạo ticket HC (tách biệt Ticket IT) */
export const ADMIN_TICKET_MAX_IMAGES_UPLOAD = 5;
