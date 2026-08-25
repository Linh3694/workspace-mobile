/**
 * Service Sự vụ kỷ luật — sinh tự động khi học sinh chạm ngưỡng điểm trừ trong tháng.
 * Tương thích với API erp.api.erp_sis.discipline_case (đồng bộ web disciplineCaseService).
 */
import api from '../utils/api';
import { normalizeCampusIdForBackend } from '../utils/campusIdUtils';

const BASE_URL = '/method/erp.api.erp_sis.discipline_case';

export type DisciplineCaseStatus = 'Tiếp nhận' | 'Đang xử lý' | 'Hoàn thành';

export const DISCIPLINE_CASE_STATUSES: DisciplineCaseStatus[] = [
  'Tiếp nhận',
  'Đang xử lý',
  'Hoàn thành',
];

export interface DisciplineCaseItem {
  name: string;
  case_code?: string;
  student_id: string;
  student_name?: string;
  student_code?: string;
  /** URL tuyệt đối ảnh HS (SIS Photo) — rỗng thì avatar rơi về chữ cái đầu */
  student_photo_url?: string | null;
  month_key: string;
  handler_role?: string;
  handler_role_label?: string;
  severity_order?: number;
  status: DisciplineCaseStatus;
  pic?: string | null;
  trigger_points?: number;
  /** Cờ có/không — số điểm hệ thống tự tính 30%, không nhập tay */
  recovery_granted?: number;
  summary?: string | null;
  resolution_note?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  notified_to?: string | null;
  notified_cc?: string | null;
  notified_at?: string | null;
}

export interface DisciplineCaseLog {
  name: string;
  action: string;
  note?: string | null;
  actor?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  creation?: string;
}

export interface DisciplineRecoveryEntryItem {
  name: string;
  /** Docname băm của vi phạm — KHÔNG hiển thị thẳng, dùng violation_title */
  violation?: string | null;
  violation_code?: string;
  violation_title?: string;
  violation_title_en?: string;
  applied_level?: string | null;
  deducted_points?: number;
  recovery_points?: number;
  status: 'Chờ' | 'Đã hoàn' | 'Huỷ';
  eligible_from?: string | null;
  restored_at?: string | null;
  source?: string | null;
}

export interface DisciplineCaseDetail extends DisciplineCaseItem {
  /** Người tiếp nhận — backend dựng tên đúng thứ tự tiếng Việt */
  pic_display_name?: string;
  pic_avatar?: string;
  pic_job_title?: string;
  logs: DisciplineCaseLog[];
  recovery_entries: DisciplineRecoveryEntryItem[];
  recovery_total_restored: number;
}

export interface DisciplineCasesResponse {
  data: DisciplineCaseItem[];
  total: number;
}

/** Frappe trả về response.data.message hoặc response.data — gom về một chỗ */
function unwrap(response: { data?: { message?: unknown } | unknown }): {
  success?: boolean;
  data?: unknown;
  message?: string;
} {
  const payload = response?.data as { message?: unknown } | undefined;
  return ((payload?.message ?? payload) || {}) as {
    success?: boolean;
    data?: unknown;
    message?: string;
  };
}

class DisciplineCaseService {
  /** Danh sách sự vụ của campus, lọc tùy chọn theo trạng thái / tháng / học sinh */
  async list(
    params: {
      campus?: string;
      status?: string;
      month_key?: string;
      student_id?: string;
    } = {}
  ): Promise<{ success: boolean; data?: DisciplineCasesResponse; message?: string }> {
    try {
      const query: Record<string, string> = {};
      const campus = normalizeCampusIdForBackend(params.campus);
      if (campus) query.campus = campus;
      if (params.status) query.status = params.status;
      if (params.month_key) query.month_key = params.month_key;
      if (params.student_id) query.student_id = params.student_id;

      const response = await api.get(`${BASE_URL}.get_discipline_cases`, { params: query });
      const res = unwrap(response);
      if (res?.success && res.data) {
        return { success: true, data: res.data as DisciplineCasesResponse };
      }
      return { success: false, message: res?.message || 'Không tải được danh sách sự vụ' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không tải được danh sách sự vụ';
      return { success: false, message: msg };
    }
  }

  /** Chi tiết sự vụ kèm nhật ký xử lý và các dòng điểm phục hồi */
  async get(
    name: string
  ): Promise<{ success: boolean; data?: DisciplineCaseDetail; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.get_discipline_case`, { name });
      const res = unwrap(response);
      if (res?.success && res.data) {
        return { success: true, data: res.data as DisciplineCaseDetail };
      }
      return { success: false, message: res?.message || 'Không tải được chi tiết sự vụ' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không tải được chi tiết sự vụ';
      return { success: false, message: msg };
    }
  }

  /** Đổi trạng thái / người tiếp nhận / ghi nhận xử lý */
  async update(payload: {
    name: string;
    status?: DisciplineCaseStatus;
    pic?: string;
    resolution_note?: string;
  }): Promise<{ success: boolean; data?: { name: string }; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.update_discipline_case`, payload);
      const res = unwrap(response);
      if (res?.success) {
        return {
          success: true,
          data: (res.data as { name: string }) || { name: payload.name },
          message: res.message,
        };
      }
      return { success: false, message: res?.message || 'Không cập nhật được sự vụ' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không cập nhật được sự vụ';
      return { success: false, message: msg };
    }
  }

  /** Thêm ghi chú vào nhật ký mà không đổi trạng thái */
  async addNote(
    name: string,
    note: string
  ): Promise<{ success: boolean; data?: { name: string }; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.add_discipline_case_note`, { name, note });
      const res = unwrap(response);
      if (res?.success) {
        return { success: true, data: (res.data as { name: string }) || { name } };
      }
      return { success: false, message: res?.message || 'Không thêm được ghi chú' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không thêm được ghi chú';
      return { success: false, message: msg };
    }
  }

  /** Duyệt điểm phục hồi — chỉ có/không, số điểm server tự tính 30% điểm đã trừ */
  async grantRecovery(name: string): Promise<{
    success: boolean;
    data?: { entries: number; recovery_points: number };
    message?: string;
  }> {
    try {
      const response = await api.post(`${BASE_URL}.grant_case_recovery`, { name });
      const res = unwrap(response);
      if (res?.success) {
        return { success: true, data: res.data as { entries: number; recovery_points: number } };
      }
      return { success: false, message: res?.message || 'Không duyệt được điểm phục hồi' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không duyệt được điểm phục hồi';
      return { success: false, message: msg };
    }
  }

  /** Gửi lại email + thông báo cho người xử lý của sự vụ */
  async resendNotification(
    name: string
  ): Promise<{ success: boolean; data?: { sent: boolean }; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.resend_discipline_case_notification`, { name });
      const res = unwrap(response);
      if (res?.success) {
        return { success: true, data: res.data as { sent: boolean } };
      }
      return { success: false, message: res?.message || 'Không gửi lại được thông báo' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không gửi lại được thông báo';
      return { success: false, message: msg };
    }
  }
}

const disciplineCaseService = new DisciplineCaseService();
export default disciplineCaseService;
