/**
 * Họp Phụ huynh 1:1 (SIS PT Meeting) — types cho app giáo viên/BGH.
 *
 * Nguồn sự thật là `erp/api/erp_sis/parent_meeting.py`: mọi tên field dưới đây
 * lấy nguyên xi từ SELECT/payload của endpoint tương ứng, không đổi tên cho
 * "đẹp". Đổi tên ở tầng type nghĩa là phải có một lớp map ở giữa, và lớp map đó
 * là chỗ duy nhất mà TypeScript không bảo vệ được — backend thêm field thì bản
 * map im lặng bỏ qua, backend đổi field thì bản map im lặng trả `undefined`.
 *
 * Quy ước thời gian của backend (hợp đồng mục 0): giờ ca là chuỗi `"HH:mm"`,
 * ngày là `"YYYY-MM-DD"`, và KHÔNG có datetime ISO nào cho giờ hẹn. Frappe lưu
 * datetime naive theo giờ server (Asia/Ho_Chi_Minh); một chuỗi không kèm offset
 * bị `new Date()` hiểu theo múi giờ máy và lệch hẳn nhiều tiếng — lệch giờ hẹn
 * họp là loại sai không sửa được sau khi phụ huynh đã tới trường. Vì vậy các
 * field giờ/ngày ở đây là **chuỗi để hiển thị thẳng**, đừng nhét vào `new Date()`.
 */

/**
 * Trạng thái mà PHỤ HUYNH đang thấy — khác `status` của đợt (ý chí của giáo vụ).
 * Backend trả kèm trong chi tiết đợt để bốn app không phải tự so đồng hồ; tự tính
 * ở client thì mỗi máy lệch giờ một kiểu.
 */
export type PTMeetingPhase =
  | 'not_open'
  | 'open'
  | 'closed'
  | 'scheduling'
  | 'published'
  | 'completed';

/** Nhóm giáo viên mà phụ huynh chọn gặp. */
export type PTTeacherGroup = 'homeroom' | 'international' | 'subject' | 'psychology' | 'ucc';

/**
 * Trạng thái một ca họp.
 *
 * Bốn trạng thái huỷ được tách riêng chứ không gộp thành `cancelled` vì hệ quả
 * khác hẳn nhau: `cancelled_by_parent` nhả ca cho hàng chờ, `cancelled_by_teacher`
 * và `auto_cancelled_no_show` thì KHÔNG (giáo viên vắng — mời gia đình khác tới
 * là hẹn họ tới gặp một cái ghế trống). Màn hình phải nói đúng lý do, nếu không
 * giáo vụ không giải thích nổi khi phụ huynh gọi lên.
 */
export type PTSlotStatus =
  | 'open'
  | 'booked'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_parent'
  | 'cancelled_by_teacher'
  | 'auto_cancelled_no_show'
  | 'cancelled_by_school';

/** Trạng thái đơn đăng ký của một học sinh trong đợt. */
export type PTRegistrationStatus = 'registered' | 'waitlisted' | 'scheduled' | 'cancelled';

/** Trạng thái từng nguyện vọng (một dòng target) bên trong đơn. */
export type PTTargetStatus = 'pending' | 'scheduled' | 'waitlisted' | 'cancelled';

/**
 * Vòng đời một đợt họp. `Scheduled` là bản NHÁP đã xếp xong nhưng phụ huynh
 * chưa thấy gì; chỉ `Published` mới là lịch công khai.
 */
export type PTEventStatus =
  | 'Draft'
  | 'RegistrationOpen'
  | 'RegistrationClosed'
  | 'Scheduled'
  | 'Published'
  | 'Completed'
  | 'Cancelled';

/**
 * Nhãn song ngữ của nhóm giáo viên, do BACKEND sinh (`_group_payload`).
 * Cố ý không dịch ở client: bốn app cùng đọc một bộ nhãn thì không thể lệch chữ
 * giữa web phụ huynh và app giáo viên khi nhà trường đổi cách gọi một nhóm.
 */
export interface PTTeacherGroupLabels {
  teacher_group: PTTeacherGroup | null;
  teacher_group_label_vn: string;
  teacher_group_label_en: string;
}

/**
 * Một đợt họp — shape của `_event_payload` (hợp đồng mục 5.1).
 *
 * `registration_start_datetime` / `registration_end_datetime` là chuỗi
 * `"YYYY-MM-DD HH:mm:ss"` giờ server, cố ý giữ đúng dạng Frappe đang lưu để
 * form giáo vụ nạp ra rồi lưu ngược mà không lệch. App giáo viên chỉ hiển thị.
 */
export interface PTMeetingEvent {
  name: string;
  title_vn: string;
  title_en?: string | null;
  education_stage_id: string;
  education_stage_title?: string | null;
  school_year_id: string;
  school_year_title?: string | null;
  status: PTEventStatus;
  meeting_date: string | null; // "YYYY-MM-DD"
  start_time: string | null; // "HH:mm"
  end_time: string | null; // "HH:mm"
  slot_duration: number; // phút mỗi ca
  location?: string | null;
  room_booking_id?: string | null;
  teacher_selection_mode: 'by_group' | 'by_teacher';
  allow_interpreter: number; // 0 | 1 — Frappe Check trả Int, không phải boolean
  allow_meeting_note: number;
  /** Ca `booked` quá số phút này kể từ start_time mà GV chưa bấm Bắt đầu -> cron tự huỷ. */
  auto_cancel_after_minutes: number;
  slots_generated: number;
  registration_start_datetime: string | null; // "YYYY-MM-DD HH:mm:ss" giờ server
  registration_end_datetime: string | null;
  /** Số ca của khung giờ = sức chứa của MỖI giáo viên (nghiệp vụ đã chốt). */
  total_slots: number;
}

/** Dòng trong danh sách đợt — `get_meeting_events` gắn thêm các con số đếm sẵn. */
export interface PTMeetingEventListItem extends PTMeetingEvent {
  class_count: number;
  teacher_count: number;
  registration_count: number;
  slot_count: number;
  booked_count: number;
}

/** Tham số lọc của `get_meeting_events` — tên khoá đúng như backend đọc bằng `_param`. */
export interface PTMeetingEventQuery {
  page?: number;
  page_size?: number;
  status?: PTEventStatus;
  education_stage_id?: string;
  school_year_id?: string;
  keyword?: string;
}

/**
 * Một ca trong lịch của GIÁO VIÊN ĐANG ĐĂNG NHẬP — `get_my_teacher_slots`.
 *
 * Ngày nằm ở `meeting_date` (lấy từ đợt) chứ không phải `date`: ca không có cột
 * ngày riêng, cả đợt diễn ra trong đúng một ngày.
 *
 * `note` là ghi chú PHỤ HUYNH nhập lúc đăng ký, KHÔNG phải ghi chú sau họp
 * (`SIS PT Meeting Note`, chỉ BGH đọc được — xem `PTMeetingNote`). Hai thứ này
 * trùng tên trong lời nói hằng ngày nên rất dễ hiển thị nhầm chỗ.
 */
export interface PTTeacherSlot extends PTTeacherGroupLabels {
  slot_id: string;
  event_id: string;
  /** 0-based, thứ tự ca trong khung giờ — cũng là khoá sắp xếp trong ngày. */
  slot_index: number;
  start_time: string | null; // "HH:mm"
  end_time: string | null; // "HH:mm"
  status: PTSlotStatus;

  student_id?: string | null;
  student_name?: string | null;
  student_code?: string | null;
  class_id?: string | null;
  class_title?: string | null;
  registration_id?: string | null;

  /** Gia đình cần phiên dịch — 0 | 1. */
  need_interpreter: number;
  /** Ghi chú của phụ huynh lúc đăng ký. */
  note?: string | null;

  event_title_vn?: string | null;
  event_title_en?: string | null;
  event_status: PTEventStatus;
  meeting_date: string | null; // "YYYY-MM-DD"
  location?: string | null;

  /** Đợt có bật ghi chú sau họp hay không — 0 | 1. Tắt thì ẩn hẳn nút ghi chú. */
  allow_meeting_note: number;
  /**
   * Đã có ghi chú sau họp cho ca này chưa (0 | 1). Nút phải biết mình đang TẠO
   * hay SỬA: `slot_id` của bảng ghi chú là `unique`, và backend coi lần gọi thứ
   * hai là sửa chứ không tạo thêm dòng.
   */
  has_note: number;
  note_id?: string | null;

  started_at?: string | null; // "YYYY-MM-DD HH:mm:ss" giờ server
  completed_at?: string | null;

  /**
   * KHÔNG có trong response của `get_my_teacher_slots` (endpoint chỉ trả các
   * field của đợt mà màn hình lịch cần). Để optional vì ngưỡng huỷ no-show là
   * cấu hình của ĐỢT: màn nào muốn đếm ngược "còn N phút trước khi ca tự huỷ"
   * thì lấy `PTMeetingEvent.auto_cancel_after_minutes` rồi gắn vào, đừng hard-code 10.
   */
  auto_cancel_after_minutes?: number;
}

/** Một ca trong bảng lịch chung của đợt — `get_schedule_by_teacher`. Gồm cả ca còn trống. */
export interface PTScheduleSlot {
  slot_id: string;
  slot_index: number;
  start_time: string | null; // "HH:mm"
  end_time: string | null; // "HH:mm"
  status: PTSlotStatus;
  student_id?: string | null;
  student_name?: string | null;
  student_code?: string | null;
  class_title?: string | null;
  registration_id?: string | null;
  need_interpreter: number;
}

/**
 * Lịch gom theo giáo viên — bản "dán trước cửa phòng họp".
 * Cố ý giữ cả ca `open`: một danh sách chỉ có ca đã đặt trông giống hệt một buổi kín lịch.
 */
export interface PTTeacherSchedule extends PTTeacherGroupLabels {
  teacher_id: string;
  teacher_name?: string | null;
  slots: PTScheduleSlot[];
}

/**
 * Một nguyện vọng phải vào hàng chờ — `get_waitlist_report`.
 *
 * Backend trả theo đúng thứ tự nộp đơn (`submitted_at ASC`) và thứ tự đó là dữ
 * liệu, không phải chi tiết trình bày: gọi điện theo đúng trật tự này là cách
 * duy nhất giải thích được với phụ huynh vì sao người kia có lịch mà mình thì
 * không. Đừng sort lại ở client.
 */
export interface PTWaitlistEntry extends PTTeacherGroupLabels {
  target_row_id: string;
  teacher_id?: string | null;
  teacher_name?: string | null;
  status: PTTargetStatus;
  registration_id: string;
  registration_status: PTRegistrationStatus;
  student_id?: string | null;
  student_name?: string | null;
  student_code?: string | null;
  class_id?: string | null;
  class_title?: string | null;
  note?: string | null;
  need_interpreter: number;
  submitted_at: string | null; // "YYYY-MM-DD HH:mm:ss" giờ server
}

/**
 * Ghi chú sau họp (giáo viên -> BGH) — `get_meeting_notes`.
 *
 * Quyền đọc chốt ở BACKEND: `System Manager`/`SIS BOD` đọc mọi ghi chú của đợt,
 * `SIS Teacher` chỉ đọc của chính mình, giáo vụ (`SIS Manager`) không đọc dòng nào.
 * Ẩn nút trên giao diện KHÔNG phải biện pháp bảo vệ — nội dung ở đây là nhận
 * định thẳng thắn về học sinh và gia đình, lộ ra là chuyện không thu hồi được.
 */
export interface PTMeetingNote {
  note_id: string;
  event_id: string;
  slot_id: string;
  teacher_id: string;
  teacher_name?: string | null;
  student_id: string;
  student_name?: string | null;
  student_code?: string | null;
  class_title?: string | null;
  /** Text Editor phía backend -> chuỗi HTML, không phải plain text. */
  content: string;
  slot_index: number;
  start_time: string | null; // "HH:mm"
  end_time: string | null; // "HH:mm"
  slot_status?: PTSlotStatus | null;
  submitted_at: string | null; // "YYYY-MM-DD HH:mm:ss" giờ server
}

/** Kết quả `start_meeting` / `complete_meeting` — lõi trả trạng thái mới của ca. */
export interface PTSlotActionResult {
  slot_id: string;
  status: PTSlotStatus;
  started_at?: string | null;
  completed_at?: string | null;
}

/**
 * Kết quả `teacher_cancel_slot`.
 *
 * `promoted` luôn `null` ở đường này: ca mang dấu `cancelled_by_teacher` nghĩa
 * là NGƯỜI VẮNG LÀ GIÁO VIÊN, nên lõi không mời gia đình nào khác vào khung giờ
 * đó. Field vẫn có mặt vì cùng một hàm lõi phục vụ cả đường huỷ của phụ huynh.
 */
export interface PTCancelSlotResult {
  slot_id: string;
  status: PTSlotStatus;
  registration_id?: string | null;
  promoted: {
    slot_id: string;
    registration_id: string;
    target_row_id: string;
    student_id: string;
  } | null;
}

/** Kết quả `submit_meeting_note` — lần gọi thứ hai trên cùng ca là SỬA, `note_id` giữ nguyên. */
export interface PTSubmitNoteResult {
  note_id: string;
  slot_id: string;
}

/** Kết quả `publish_schedule` — kèm số phụ huynh đã nhận thông báo, để báo lại cho người bấm nút. */
export interface PTPublishScheduleResult {
  event_id: string;
  status: PTEventStatus;
  notified_scheduled: number;
  notified_waitlisted: number;
}
