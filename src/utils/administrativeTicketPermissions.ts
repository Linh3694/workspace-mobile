/**
 * Quyền staff Ticket Hành chính.
 *
 * PHẢI khớp `_STAFF_ROLES` trong
 * `frappe-backend/apps/erp/erp/api/erp_administrative/administrative_ticket.py`.
 * Lệch nhau là kịch bản hỏng tệ nhất của module này: mobile mở màn Ticket Admin
 * đầy đủ nút trong khi backend coi người dùng là khách ⇒ danh sách rỗng (403 ở
 * `get_all_tickets`), nhận ticket bị chặn, và đổi trạng thái thì `update_ticket`
 * BỎ QUA ÂM THẦM nhưng vẫn trả success (nhánh `if staff and "status" in data`).
 */
export const ADMIN_TICKET_STAFF_ROLES = [
  'System Manager',
  'SIS Administrative',
  'SIS BOD',
  'Mobile Administrative',
] as const;

/** Nhân viên HC: xem mọi ticket, nhận ticket, đổi trạng thái, quản lý công việc con. */
export function isAdminTicketStaff(roles?: unknown): boolean {
  if (!Array.isArray(roles)) return false;
  return ADMIN_TICKET_STAFF_ROLES.some((role) => roles.includes(role));
}
