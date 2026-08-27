/**
 * Họp Phụ huynh 1:1 (SIS PT Meeting) — gọi Frappe `erp.api.erp_sis.parent_meeting`.
 *
 * Dùng Pattern A giống roomBookingService (axios trần + `getAxiosConfig()` +
 * `unwrap` envelope Frappe), KHÔNG đi qua `src/utils/api.ts`. Hệ quả phải biết:
 * pattern này không có interceptor 401 nên hết phiên sẽ rơi vào empty state chứ
 * không tự đăng xuất. Chấp nhận có chủ đích để đồng bộ với các service cùng họ
 * (roomBooking, administrativeTicket) — đổi riêng một file sang Pattern B sẽ tạo
 * ra hai kiểu xử lý lỗi trong cùng một màn hình.
 *
 * Các method `erp_sis` lấy campus theo session nên KHÔNG cần header X-Campus-Id.
 *
 * Quyền đã được chốt ở backend, không phải ở đây: `get_meeting_notes` chỉ trả
 * ghi chú cho BGH (hoặc chính giáo viên viết), các thao tác trên ca chỉ nhận
 * giáo viên đứng ca đó. Ẩn nút ở app là chuyện dễ nhìn, không phải chuyện bảo vệ.
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';
import { parseFrappeApiError } from './administrativeTicketService';
import { normalizeVietnameseName } from '../utils/nameFormatter';
import type {
  PTCancelSlotResult,
  PTMeetingEventListItem,
  PTMeetingEventQuery,
  PTMeetingNote,
  PTPublishScheduleResult,
  PTSlotActionResult,
  PTSubmitNoteResult,
  PTTeacherSchedule,
  PTTeacherSlot,
  PTWaitlistEntry,
} from '../types/parentMeeting';

const getAxiosConfig = async (additionalConfig: { headers?: Record<string, string> } = {}) => {
  const token = await AsyncStorage.getItem('authToken');
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return {
    baseURL: BASE_URL,
    timeout: 120000,
    ...additionalConfig,
    headers: { ...defaultHeaders, ...(additionalConfig.headers || {}) },
  };
};

const PARENT_MEETING = '/api/method/erp.api.erp_sis.parent_meeting';

/**
 * Bóc envelope Frappe: `{ message: { success, data, message } }`.
 *
 * Hai tầng vì `@frappe.whitelist()` bọc giá trị trả về của hàm Python vào khoá
 * `message`, còn `erp.utils.api_response` lại tự có khoá `message` của riêng nó.
 * Fallback `response.data` phòng khi Frappe trả thẳng (lỗi ở tầng framework,
 * chưa vào tới hàm của app).
 */
/**
 * Khoá mang tên GIÁO VIÊN trong payload của module.
 *
 * `homeroom_teacher_name` backend chưa trả (xem ghi chú «CÒN THIẾU» ở
 * `PTWaitlistRow`), khai sẵn ở đây vì nó là tên giáo viên đúng nghĩa: ngày backend
 * nối thêm khoá đó, bảng danh sách chờ sẽ hiển thị đúng thứ tự mà không ai phải nhớ
 * quay lại sửa chỗ này. Khoá không tồn tại thì vòng lặp không bao giờ chạm tới.
 */
const TEACHER_NAME_KEYS = new Set(['teacher_name', 'homeroom_teacher_name']);

/**
 * Chuẩn hoá MỌI tên giáo viên trong payload máy chủ trả về, sửa tại chỗ.
 *
 * Tên giáo viên đi thẳng từ `User.full_name`, mà tài khoản đồng bộ từ Microsoft/AD hay
 * mang thứ tự "Tên + Họ đệm" ("Linh Nguyễn Hải" thay vì "Nguyễn Hải Linh"). Đảo lại ngay
 * tại chỗ NHẬN payload chứ không phải ở từng chỗ hiển thị: module này vẽ tên GV ở lưới
 * lịch, danh sách ca của giáo viên, báo cáo đăng ký và màn biên bản — chỗ thứ N+1 chắc
 * chắn sẽ quên.
 *
 * Chỉ đụng khoá trong `TEACHER_NAME_KEYS`. Cố ý KHÔNG đụng `student_name`: tên học sinh
 * nhập tay theo đúng thứ tự VN rồi, đảo thêm lần nữa là làm hỏng tên đang đúng.
 *
 * Giữ khớp với ba client còn lại (WIS web, parent portal web/app) — cùng một đợt họp mà
 * giáo vụ và phụ huynh đọc ra hai cách viết tên là loại lệch không ai báo lỗi nhưng ai
 * cũng thấy gợn.
 */
function normalizeTeacherNames(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(normalizeTeacherNames);
    return;
  }
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (TEACHER_NAME_KEYS.has(key)) {
      // Chuỗi rỗng / null giữ nguyên: đó là nguyện vọng chọn theo NHÓM, và màn hình đang
      // dựa vào chỗ trống đó để rơi về nhãn nhóm.
      if (typeof value === 'string' && value.trim()) {
        record[key] = normalizeVietnameseName(value);
      }
      continue;
    }
    if (value && typeof value === 'object') normalizeTeacherNames(value);
  }
}

function unwrap<T>(response: {
  data?: { message?: { success?: boolean; data?: T; message?: string }; exc?: string };
}): { success: boolean; data?: T; message?: string } {
  const msg = response?.data?.message ?? response?.data;
  normalizeTeacherNames(msg);
  if (msg && typeof msg === 'object' && 'success' in msg && (msg as { success?: boolean }).success === true) {
    const m = msg as { data?: T; message?: string };
    return { success: true, data: m.data, message: typeof m.message === 'string' ? m.message : undefined };
  }
  const fallback =
    (msg && typeof msg === 'object' && 'message' in msg && typeof (msg as { message?: string }).message === 'string'
      ? (msg as { message: string }).message
      : null) || parseFrappeApiError(response?.data);
  return { success: false, message: fallback || 'Lỗi API' };
}

/**
 * Thân chung của mọi lời gọi GHI.
 *
 * `validateStatus` tới 599 rồi tự đọc body là điểm mấu chốt, không phải chi tiết
 * phong cách: Frappe trả **HTTP 417** cho ValidationError và **403** cho lỗi
 * quyền, kèm message tiếng Việt thật nằm trong body. Để axios tự ném thì tất cả
 * những gì tới tay giáo viên là `"Request failed with status code 417"` — đúng
 * lúc họ đang đứng trước phòng họp và cần biết vì sao không bấm được nút.
 *
 * Gom vào một chỗ để không có endpoint nào lỡ quên `validateStatus`; quên một
 * chỗ thì lỗi chỉ lộ ra đúng vào lần backend từ chối, tức là lúc tệ nhất.
 */
async function writeRequest<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const config = await getAxiosConfig();
  const response = await axios.post(`${PARENT_MEETING}.${method}`, payload, {
    ...config,
    validateStatus: (status) => status >= 200 && status < 600,
  });
  if (response.status >= 400) {
    throw new Error(parseFrappeApiError(response.data));
  }
  const out = unwrap<T>(response);
  if (!out.success || out.data === undefined || out.data === null) {
    throw new Error(out.message || parseFrappeApiError(response.data));
  }
  return out.data;
}

/**
 * Thân chung của mọi lời gọi ĐỌC danh sách.
 *
 * Nuốt lỗi và trả `[]` là quy ước của repo: màn hình chỉ có loading / empty,
 * không có error state riêng, nên một mảng rỗng cho ra đúng khung "chưa có dữ
 * liệu" thay vì màn trắng. Vẫn `console.error` để lỗi thật không biến mất khỏi
 * log khi debug.
 *
 * `list_response` của backend đặt mảng THẲNG vào `data` (không bọc thêm khoá),
 * nên chỉ nhận `Array.isArray`; shape khác nghĩa là backend đã đổi hợp đồng và
 * im lặng dựng một mảng rỗng vẫn tốt hơn là để màn hình vỡ vì `.map` của undefined.
 */
async function readList<T>(
  method: string,
  payload: Record<string, unknown>,
  label: string
): Promise<T[]> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`${PARENT_MEETING}.${method}`, payload, config);
    const out = unwrap<T[]>(response);
    if (out.success && Array.isArray(out.data)) return out.data;
    return [];
  } catch (e) {
    console.error(label, e);
    return [];
  }
}

/**
 * Bản NGHIÊM của `readList`, dùng cho danh sách mà «rỗng» và «hỏng» dẫn tới hai
 * kết luận trái ngược nhau đối với người đọc.
 *
 * `readList` nuốt lỗi để màn hình rơi vào khung "chưa có dữ liệu" — hợp lý với
 * danh sách chỉ để tra cứu. Nhưng hàng chờ thì màn "rỗng" là một KHẲNG ĐỊNH
 * ("không có phụ huynh nào phải chờ") mà Ban Giám hiệu dùng để quyết định có
 * cần đôn đốc hay không. Một lần 403 bị nuốt sẽ hiện đúng câu khẳng định đó
 * trong lúc đợt còn hàng chục nguyện vọng treo — sai lệch im lặng, không ai
 * phát hiện được từ giao diện.
 *
 * `validateStatus` tới 599 vì `forbidden_response` của backend trả HTTP 200 kèm
 * `success: false`, nhưng các lỗi khác (417/500) thì trả đúng mã lỗi; phải bắt
 * được cả hai dạng, và message tiếng Việt thật luôn nằm trong body.
 */
async function readListStrict<T>(
  method: string,
  payload: Record<string, unknown>
): Promise<T[]> {
  const config = await getAxiosConfig();
  const response = await axios.post(`${PARENT_MEETING}.${method}`, payload, {
    ...config,
    validateStatus: (status) => status >= 200 && status < 600,
  });
  if (response.status >= 400) {
    throw new Error(parseFrappeApiError(response.data));
  }
  const out = unwrap<T[]>(response);
  if (!out.success) {
    throw new Error(out.message || parseFrappeApiError(response.data));
  }
  return Array.isArray(out.data) ? out.data : [];
}

// ----------------------------------------------------------------------
// ĐỌC
// ----------------------------------------------------------------------

/**
 * Lịch ca của giáo viên đang đăng nhập.
 *
 * Không truyền gì = NGÀY HÔM NAY (mặc định của backend). Màn hình này được mở
 * ngay trước cửa phòng họp; một danh sách gộp mọi đợt trong lịch sử thì giáo
 * viên phải cuộn đi tìm ca sắp tới. Muốn xem trọn một đợt thì truyền `eventId`
 * — khi có `event_id`, backend bỏ qua bộ lọc ngày.
 */
export async function getMyTeacherSlots(params: { eventId?: string; date?: string } = {}): Promise<
  PTTeacherSlot[]
> {
  const payload: Record<string, unknown> = {};
  if (params.eventId) payload.event_id = params.eventId;
  if (params.date) payload.date = params.date;
  return readList<PTTeacherSlot>('get_my_teacher_slots', payload, 'getMyTeacherSlots');
}

/**
 * Danh sách đợt họp (phân trang phía server).
 *
 * Chỉ trả mảng `data`, bỏ khối `pagination`: app giáo viên dùng danh sách này để
 * chọn đợt chứ không duyệt lịch sử, nên `page_size` mặc định 25 đã phủ hết. Cần
 * cuộn vô hạn thì đọc thêm `pagination.total_pages` từ response — nhớ sửa cả
 * kiểu trả về, đừng đoán "hết trang" bằng cách so độ dài mảng với page_size.
 */
export async function getEvents(query: PTMeetingEventQuery = {}): Promise<PTMeetingEventListItem[]> {
  const payload: Record<string, unknown> = {};
  if (query.page) payload.page = query.page;
  if (query.page_size) payload.page_size = query.page_size;
  if (query.status) payload.status = query.status;
  if (query.education_stage_id) payload.education_stage_id = query.education_stage_id;
  if (query.school_year_id) payload.school_year_id = query.school_year_id;
  if (query.keyword) payload.keyword = query.keyword;
  return readList<PTMeetingEventListItem>('get_meeting_events', payload, 'getEvents');
}

/**
 * Lịch của cả đợt, gom theo giáo viên (bỏ trống `teacherId` để lấy tất cả).
 *
 * Danh sách này CÓ cả ca `open`. Đừng lọc bỏ chúng ở client: giáo viên cần thấy
 * khoảng nào mình rảnh để biết có nhận thêm gia đình đến muộn được không.
 */
export async function getScheduleByTeacher(
  eventId: string,
  teacherId?: string
): Promise<PTTeacherSchedule[]> {
  if (!eventId) return [];
  const payload: Record<string, unknown> = { event_id: eventId };
  if (teacherId) payload.teacher_id = teacherId;
  return readList<PTTeacherSchedule>('get_schedule_by_teacher', payload, 'getScheduleByTeacher');
}

/**
 * Hàng chờ của đợt — danh sách GVCN phải gọi điện.
 *
 * Backend đã xếp theo `submitted_at ASC` (FCFS). Giữ nguyên thứ tự khi hiển thị:
 * gọi đúng trật tự nộp đơn là cách duy nhất giải thích được với phụ huynh vì sao
 * gia đình kia có lịch mà mình thì không.
 *
 * CỐ Ý NÉM LỖI thay vì trả `[]` như các hàm đọc khác (xem `readListStrict`):
 * người gọi phải phân biệt được "không ai phải chờ" với "không đọc được danh
 * sách chờ", vì hai câu đó dẫn tới hai hành động trái ngược nhau.
 */
export async function getWaitlistReport(eventId: string): Promise<PTWaitlistEntry[]> {
  if (!eventId) return [];
  return readListStrict<PTWaitlistEntry>('get_waitlist_report', { event_id: eventId });
}

/**
 * Ghi chú sau họp của một đợt.
 *
 * Trả `[]` khi backend từ chối (403) — đúng thứ ta muốn ở đây: người không có
 * quyền thấy màn trống, không thấy thông báo lỗi ám chỉ "có gì đó đang bị giấu".
 * Truyền `teacherId` của người khác trong khi mình chỉ là giáo viên cũng bị từ
 * chối, nên hãy để trống và để backend tự giới hạn về chính mình.
 */
export async function getMeetingNotes(params: {
  eventId: string;
  teacherId?: string;
  studentId?: string;
}): Promise<PTMeetingNote[]> {
  if (!params.eventId) return [];
  const payload: Record<string, unknown> = { event_id: params.eventId };
  if (params.teacherId) payload.teacher_id = params.teacherId;
  if (params.studentId) payload.student_id = params.studentId;
  return readList<PTMeetingNote>('get_meeting_notes', payload, 'getMeetingNotes');
}

// ----------------------------------------------------------------------
// GHI
// ----------------------------------------------------------------------

/**
 * Giáo viên bấm «Bắt đầu họp».
 *
 * Không chỉ để hiển thị: dấu `started_at` là thứ cứu ca khỏi bị cron huỷ no-show
 * sau `auto_cancel_after_minutes` phút. Bấm muộn vài phút vẫn cứu được, nên đừng
 * chặn nút chỉ vì đã quá giờ trên đồng hồ của máy.
 */
export async function startMeeting(slotId: string): Promise<PTSlotActionResult> {
  return writeRequest<PTSlotActionResult>('start_meeting', { slot_id: slotId });
}

/** Giáo viên bấm «Kết thúc họp». Backend chấp nhận cả ca còn `booked` (quên bấm Bắt đầu) và tự bù `started_at`. */
export async function completeMeeting(slotId: string): Promise<PTSlotActionResult> {
  return writeRequest<PTSlotActionResult>('complete_meeting', { slot_id: slotId });
}

/**
 * Giáo viên huỷ một ca của mình. `reason` là BẮT BUỘC ở backend.
 *
 * Chặn luôn ở đây để giáo viên nhận phản hồi tức thì thay vì chờ một vòng mạng
 * rồi đọc lỗi 417. Ca huỷ theo đường này mang trạng thái `cancelled_by_teacher`
 * — nghĩa là giáo viên vắng, và lõi sẽ KHÔNG mời gia đình trong hàng chờ vào
 * khung giờ đó. Vì vậy màn hình đừng hứa hẹn "slot sẽ được mở lại".
 */
export async function teacherCancelSlot(slotId: string, reason: string): Promise<PTCancelSlotResult> {
  const trimmed = (reason || '').trim();
  if (!trimmed) {
    throw new Error('Vui lòng nhập lý do huỷ ca họp');
  }
  return writeRequest<PTCancelSlotResult>('teacher_cancel_slot', {
    slot_id: slotId,
    reason: trimmed,
  });
}

/**
 * Gửi ghi chú sau họp tới BGH.
 *
 * Gọi lần hai trên cùng một ca là SỬA, không phải tạo mới (`slot_id` là unique ở
 * tầng DB) — nên nút chỉ cần đọc `PTTeacherSlot.has_note` để đổi nhãn, không cần
 * endpoint riêng. Backend chỉ nhận khi ca đã `in_progress` hoặc `completed`:
 * ghi chú về một cuộc gặp chưa diễn ra vẫn đi thẳng lên BGH y như nhận định thật.
 */
export async function submitMeetingNote(slotId: string, content: string): Promise<PTSubmitNoteResult> {
  const trimmed = (content || '').trim();
  if (!trimmed) {
    throw new Error('Vui lòng nhập nội dung ghi chú');
  }
  return writeRequest<PTSubmitNoteResult>('submit_meeting_note', {
    slot_id: slotId,
    content: trimmed,
  });
}

/**
 * Công bố lịch cho phụ huynh (`Scheduled` -> `Published`).
 *
 * Thao tác MỘT CHIỀU: notification đã gửi thì không rút lại được, nên màn hình
 * phải hỏi xác nhận trước khi gọi. Backend chặn công bố hai lần bằng cờ
 * `published_notice_sent`, nhưng đừng dựa vào đó để bỏ bước xác nhận — lần bấm
 * đầu tiên mới là lần không thể hoàn tác.
 */
export async function publishSchedule(eventId: string): Promise<PTPublishScheduleResult> {
  return writeRequest<PTPublishScheduleResult>('publish_schedule', { event_id: eventId });
}
