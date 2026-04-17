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

/** Số ảnh đính kèm tối đa khi tạo ticket HC (tách biệt Ticket IT) */
export const ADMIN_TICKET_MAX_IMAGES_UPLOAD = 5;
