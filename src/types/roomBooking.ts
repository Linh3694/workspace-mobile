/**
 * Đặt phòng (ERP Room Booking) — types cho mobile.
 * Đồng bộ logic web frappe-sis-frontend (trang "Đặt phòng").
 */

/** Thứ trong tuần (Monday = Thứ 2) */
export type RoomBookingWeekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

/** Khung giờ khả dụng theo từng thứ (ERP Room Booking Availability) */
export interface RoomAvailabilityDay {
  day_of_week: RoomBookingWeekday;
  is_closed: number;
  start_time: string; // "HH:mm:ss"
  end_time: string; // "HH:mm:ss"
}

/** Phòng đang mở đặt — trả từ get_bookable_rooms (chỉ phòng có config is_active=1) */
export interface BookableRoom {
  name: string;
  title_vn?: string;
  title_en?: string;
  short_title?: string;
  room_type?: string;
  capacity?: number | null;
  building_id: string;
  building_title_vn?: string;
  building_title_en?: string;
  config_name?: string;
  yearly_assignment_display?: string | null;
  yearly_assignment_display_en?: string | null;
  availability: RoomAvailabilityDay[];
}

/**
 * Trạng thái một lượt đặt phòng.
 *
 * `Pending Approval` GIỮ CHỖ y như lượt đã chốt (backend tính là trùng giờ), nên vẫn
 * phải vẽ trên lịch — nhưng vẽ khác hẳn, nếu không người đặt tưởng đã xong còn người
 * khác tưởng phòng đã bị lấy mất hẳn.
 */
export type RoomBookingStatus =
  | 'Booked'
  | 'Pending Approval'
  | 'Rejected'
  | 'Expired'
  | 'Cancelled';

/** Người tham dự của một booking */
export interface RoomBookingAttendee {
  user?: string;
  email?: string;
  full_name?: string;
  department?: string;
}

/**
 * Một lịch đặt phòng — trả từ get_room_bookings.
 * Lưu ý: endpoint này trả thời gian dưới tên event_start_time/event_end_time
 * (khác với create_room_booking trả start_time/end_time).
 */
export interface RoomBooking {
  name: string;
  title: string;
  booked_by?: string;
  booked_by_email?: string;
  booked_by_department?: string;
  booked_by_employee_code?: string;
  event_start_time: string; // MySQL "YYYY-MM-DD HH:mm:ss"
  event_end_time: string;
  status: RoomBookingStatus | string;
  /** Trạng thái của engine duyệt — `status` mới là nguồn sự thật cho lịch */
  workflow_state?: string;
  /** Tên bước đang chờ, vd "Phòng IT" — chỉ có khi status = Pending Approval */
  pending_step_label?: string;
  submitted_by?: string;
  source?: string; // "room_booking_page" | "admin_ticket"
  source_ticket?: string | null;
  attendees?: RoomBookingAttendee[];
}

/** Payload tạo booking thường (create_room_booking) */
export interface CreateRoomBookingPayload {
  title: string;
  description?: string;
  building_id: string;
  room_id: string;
  start_time: string; // MySQL "YYYY-MM-DD HH:mm:ss"
  end_time: string;
  attendees?: string[]; // danh sách email
}

/** Một yêu cầu đang chờ CHÍNH TÔI duyệt — get_pending_room_bookings_for_me */
export interface PendingRoomBooking {
  name: string;
  title: string;
  description?: string;
  building_id?: string;
  room_id: string;
  room_title: string;
  start_time: string; // MySQL "YYYY-MM-DD HH:mm:ss"
  end_time: string;
  requested_by: string;
  requested_by_email?: string;
  requested_by_department?: string;
  submitted_at?: string;
  /** Bước đang chờ tôi, vd "Phòng IT" */
  step_label?: string;
  step_node_id?: string;
  deadline_at?: string;
  /** 1 = đã quá hạn xử lý; hệ thống chỉ gắn cờ, không tự quyết thay ai */
  overdue?: number;
  source?: string;
  source_ticket?: string;
}
