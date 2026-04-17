/**
 * Service Kỷ luật - Ghi nhận lỗi
 * Tương thích với API erp.api.erp_sis.discipline
 */
import api from '../utils/api';
import { normalizeCampusIdForBackend } from '../utils/campusIdUtils';

const BASE_URL = '/method/erp.api.erp_sis.discipline';

/** Điểm trừ nhập tay per đối tượng (đồng bộ Select backend) */
export type DisciplineDeductionPoints = '1' | '5' | '10' | '15';

// Bản ghi ghi nhận lỗi
export interface DisciplineRecordItem {
  name: string;
  date: string;
  classification: string;
  classification_title?: string;
  violation_count?: number;
  target_type: 'class' | 'student' | 'mixed';
  target_student?: string;
  target_student_ids?: string[];
  target_students?: Array<{
    student_id: string;
    student_name?: string;
    student_code?: string;
    student_class_title?: string;
    student_photo_url?: string | null;
    /** Điểm trừ đã lưu (1/5/10/15) */
    deduction_points?: DisciplineDeductionPoints | string;
  }>;
  target_class_ids?: string[];
  /** Chi tiết điểm trừ theo lớp */
  target_class_entries?: Array<{
    class_id: string;
    deduction_points?: DisciplineDeductionPoints | string;
  }>;
  target_class_titles?: string[];
  student_name?: string;
  student_code?: string;
  student_class_title?: string;
  student_photo_url?: string | null;
  violation: string;
  violation_title?: string;
  severity_level?: string;
  form: string;
  form_title?: string;
  penalty_points?: string;
  /** Điểm trừ khi import Excel — legacy */
  historical_deduction_points?: number | null;
  time_slot?: string;
  time_slot_id?: string;
  time_slot_title?: string;
  record_time?: string;
  description?: string;
  owner?: string;
  /** Người tạo bản ghi (Frappe) — ưu tiên khi so khớp quyền sửa/xóa */
  record_creator?: string;
  owner_name?: string;
  modified?: string;
  campus?: string;
}

export interface DisciplineRecordsResponse {
  data: DisciplineRecordItem[];
  total: number;
}

export interface CreateDisciplineRecordParams {
  date: string;
  classification: string;
  target_type: 'class' | 'student' | 'mixed';
  target_student?: string;
  target_student_ids?: string[];
  target_class_ids?: string[];
  /** Map student_id -> điểm trừ (1|5|10|15) */
  target_student_points?: Record<string, DisciplineDeductionPoints | string>;
  /** Map class_id -> điểm trừ */
  target_class_points?: Record<string, DisciplineDeductionPoints | string>;
  violation: string;
  form: string;
  time_slot_id?: string;
  record_time?: string;
  description?: string;
  proof_images?: { image: string }[];
  campus: string;
}

export interface UpdateDisciplineRecordParams extends CreateDisciplineRecordParams {
  name: string;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

// Phân loại, vi phạm, hình thức - dùng cho form Add/Edit
export interface DisciplineClassificationItem {
  name: string;
  title: string;
}
export interface DisciplineViolationItem {
  name: string;
  title: string;
  classification?: string;
  severity_level?: string;
}
export interface DisciplineFormItem {
  name: string;
  title: string;
}

class DisciplineRecordService {
  /** Lấy danh sách phân loại kỷ luật */
  async getClassifications(campus?: string): Promise<{
    success: boolean;
    data?: DisciplineClassificationItem[];
  }> {
    try {
      const normalized = normalizeCampusIdForBackend(campus);
      const params = normalized ? { campus: normalized } : {};
      const response = await api.get(`${BASE_URL}.get_discipline_classifications`, {
        params,
      });
      const res = response.data?.message ?? response.data;
      const data = res?.data?.data ?? res?.data ?? [];
      return { success: true, data: Array.isArray(data) ? data : [] };
    } catch {
      return { success: false, data: [] };
    }
  }

  /** Lấy danh sách vi phạm */
  async getViolations(campus?: string): Promise<{
    success: boolean;
    data?: DisciplineViolationItem[];
  }> {
    try {
      const normalized = normalizeCampusIdForBackend(campus);
      const params = normalized ? { campus: normalized } : {};
      const response = await api.get(`${BASE_URL}.get_discipline_violations`, {
        params,
      });
      const res = response.data?.message ?? response.data;
      const data = res?.data?.data ?? res?.data ?? [];
      return { success: true, data: Array.isArray(data) ? data : [] };
    } catch {
      return { success: false, data: [] };
    }
  }

  /** Lấy danh sách hình thức kỷ luật */
  async getForms(campus?: string): Promise<{
    success: boolean;
    data?: DisciplineFormItem[];
  }> {
    try {
      const normalized = normalizeCampusIdForBackend(campus);
      const params = normalized ? { campus: normalized } : {};
      const response = await api.get(`${BASE_URL}.get_discipline_forms`, {
        params,
      });
      const res = response.data?.message ?? response.data;
      const data = res?.data?.data ?? res?.data ?? [];
      return { success: true, data: Array.isArray(data) ? data : [] };
    } catch {
      return { success: false, data: [] };
    }
  }

  /** Lấy danh sách tiết (Discipline Time) - dùng cho picker Tiết */
  async getTimes(campus?: string): Promise<{
    success: boolean;
    data?: { name: string; title?: string }[];
    message?: string;
  }> {
    try {
      const normalized = normalizeCampusIdForBackend(campus);
      const params = normalized ? { campus: normalized } : {};
      const response = await api.get(`${BASE_URL}.get_discipline_times`, { params });
      const res = response.data?.message ?? response.data;
      const raw = res?.data?.data ?? [];
      const data = Array.isArray(raw)
        ? raw.map((r: any) => ({ name: r.name, title: r.title || r.name }))
        : [];
      return { success: res?.success !== false, data };
    } catch {
      return { success: false, data: [] };
    }
  }

  /** Lấy năm học đang enable */
  async getEnabledSchoolYear(campus?: string): Promise<{
    success: boolean;
    data?: { name: string | null };
    message?: string;
  }> {
    try {
      const normalized = normalizeCampusIdForBackend(campus);
      const params = normalized ? { campus: normalized } : {};
      const response = await api.get(`${BASE_URL}.get_enabled_school_year`, {
        params,
      });
      const res = response.data?.message ?? response.data;
      if (res?.success) {
        return {
          success: true,
          data: res.data || { name: null },
          message: res.message,
        };
      }
      return { success: false, message: res?.message || 'Không thể lấy năm học' };
    } catch {
      return { success: false, message: 'Không thể lấy năm học' };
    }
  }

  /** Lấy danh sách lớp (theo năm học, campus) - tương thích format response web/attendanceService */
  async getAllClasses(
    schoolYearId: string,
    campusId?: string
  ): Promise<{ success: boolean; data?: { name: string; title?: string }[] }> {
    try {
      const params: Record<string, string> = { school_year_id: schoolYearId };
      const normalizedCampus = normalizeCampusIdForBackend(campusId);
      if (normalizedCampus) params.campus_id = normalizedCampus;
      const response = await api.get(
        '/method/erp.api.erp_sis.sis_class.get_all_classes',
        { params }
      );
      // Parse response: Frappe có thể trả về message.data, data, hoặc message trực tiếp (như attendanceService)
      const raw = response.data;
      let rows: unknown[] = [];
      if (raw?.message?.data) {
        rows = Array.isArray(raw.message.data) ? raw.message.data : [raw.message.data];
      } else if (raw?.data) {
        rows = Array.isArray(raw.data) ? raw.data : [];
      } else if (raw?.message && Array.isArray(raw.message)) {
        rows = raw.message;
      }
      const data = rows
        .filter((r): r is { name: string; title?: string } => r != null && typeof (r as any)?.name === 'string')
        .map((r) => ({ name: (r as any).name, title: (r as any).title }));
      return {
        success: (raw?.message?.success ?? raw?.success) !== false,
        data,
      };
    } catch {
      return { success: false, data: [] };
    }
  }

  /** Tìm học sinh theo năm học */
  async searchStudentsBySchoolYear(
    query: string,
    schoolYearId: string
  ): Promise<{
    success: boolean;
    data?: {
      name: string;
      student_name?: string;
      student_code?: string;
      current_class_title?: string;
      current_class?: { name?: string; title?: string };
      photo?: string;
      user_image?: string;
    }[];
  }> {
    try {
      const response = await api.get(
        '/method/erp.api.erp_sis.student.search_students_by_school_year',
        {
          params: { search_term: query || '', school_year_id: schoolYearId },
        }
      );
      // Frappe gói response trong response.data.message
      const res = response.data?.message ?? response.data;
      const data = res?.data ?? [];
      return {
        success: res?.success !== false,
        data: Array.isArray(data) ? data : [],
      };
    } catch {
      return { success: false, data: [] };
    }
  }

  /** Upload ảnh minh chứng */
  async uploadFile(file: {
    uri: string;
    name: string;
    type: string;
  }): Promise<{ success: boolean; file_url?: string; message?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
      formData.append('is_private', '0');
      formData.append('folder', 'Home/Discipline');

      const response = await api.post('/method/upload_file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const res = response.data?.message || response.data;
      const fileUrl = res?.file_url || (response.data as any)?.file_url;
      if (fileUrl) {
        return { success: true, file_url: fileUrl };
      }
      return { success: false, message: res?.message || 'Upload thất bại' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Upload thất bại';
      return { success: false, message: msg };
    }
  }

  /** Lấy danh sách ghi nhận lỗi */
  async getRecords(
    ownerOnly: boolean,
    campus?: string
  ): Promise<{ success: boolean; data?: DisciplineRecordsResponse; message?: string }> {
    try {
      const params: Record<string, string> = {
        owner_only: ownerOnly ? '1' : '0',
      };
      const normalized = normalizeCampusIdForBackend(campus);
      if (normalized) params.campus = normalized;

      const response = await api.get(`${BASE_URL}.get_discipline_records`, { params });

      // Frappe trả về response.data.message hoặc response.data
      const messageData = response.data?.message;
      const res = messageData || response.data;
      if (res?.success && res.data) {
        return { success: true, data: res.data, message: res.message };
      }
      return {
        success: false,
        message: res?.message || 'Không thể tải danh sách ghi nhận lỗi',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không thể tải danh sách ghi nhận lỗi';
      return { success: false, message: msg };
    }
  }

  /** Lấy chi tiết 1 bản ghi */
  async getRecord(
    name: string
  ): Promise<{ success: boolean; data?: DisciplineRecordItem; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.get_discipline_record`, { name });

      const messageData = response.data?.message;
      const res = messageData || response.data;
      if (res?.success && res.data) {
        return { success: true, data: res.data, message: res.message };
      }
      return {
        success: false,
        message: res?.message || 'Không thể tải bản ghi',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không thể tải bản ghi';
      return { success: false, message: msg };
    }
  }

  /** Tạo mới ghi nhận lỗi */
  async create(
    params: CreateDisciplineRecordParams
  ): Promise<{ success: boolean; data?: { name: string }; message?: string }> {
    try {
      const payload = {
        ...params,
        campus: params.campus ? normalizeCampusIdForBackend(params.campus) : params.campus,
      };
      const response = await api.post(`${BASE_URL}.create_discipline_record`, payload);
      const messageData = response.data?.message;
      const res = messageData || response.data;
      if (res?.success) {
        return {
          success: true,
          data: res.data || { name: '' },
          message: res.message || 'Tạo ghi nhận lỗi thành công',
        };
      }
      return {
        success: false,
        message: res?.message || 'Không thể tạo ghi nhận lỗi',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không thể tạo ghi nhận lỗi';
      return { success: false, message: msg };
    }
  }

  /** Cập nhật ghi nhận lỗi */
  async update(
    params: UpdateDisciplineRecordParams
  ): Promise<{ success: boolean; data?: { name: string }; message?: string }> {
    try {
      const payload = {
        ...params,
        campus: params.campus ? normalizeCampusIdForBackend(params.campus) : params.campus,
      };
      const response = await api.post(`${BASE_URL}.update_discipline_record`, payload);
      const messageData = response.data?.message;
      const res = messageData || response.data;
      if (res?.success) {
        return {
          success: true,
          data: res.data || { name: params.name },
          message: res.message || 'Cập nhật ghi nhận lỗi thành công',
        };
      }
      return {
        success: false,
        message: res?.message || 'Không thể cập nhật ghi nhận lỗi',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không thể cập nhật ghi nhận lỗi';
      return { success: false, message: msg };
    }
  }

  /** Thống kê vi phạm của lớp cho 1 loại vi phạm (tùy chọn date_from/date_to, giống backend) */
  async getClassViolationStats(
    classId: string,
    violationId: string,
    options?: { date_from?: string; date_to?: string }
  ): Promise<{
    success: boolean;
    data?: { count: number; level: string; level_label: string; points: number };
    message?: string;
  }> {
    try {
      const response = await api.post(`${BASE_URL}.get_class_violation_stats`, {
        class_id: classId,
        violation_id: violationId,
        ...(options?.date_from ? { date_from: options.date_from } : {}),
        ...(options?.date_to ? { date_to: options.date_to } : {}),
      });
      const res = response.data?.message ?? response.data;
      if (res?.success && res.data) {
        return { success: true, data: res.data };
      }
      return {
        success: false,
        message: res?.message || 'Không thể lấy thống kê',
        data: { count: 0, level: '1', level_label: 'Cấp độ 1', points: 0 },
      };
    } catch {
      return {
        success: false,
        message: 'Không thể lấy thống kê',
        data: { count: 0, level: '1', level_label: 'Cấp độ 1', points: 0 },
      };
    }
  }

  /** Thống kê vi phạm của học sinh (tùy chọn date_from/date_to, giống backend) */
  async getStudentViolationStats(
    studentId: string,
    violationId: string,
    options?: { date_from?: string; date_to?: string }
  ): Promise<{
    success: boolean;
    data?: { count: number; level: string; level_label: string; points: number };
    message?: string;
  }> {
    try {
      const response = await api.post(`${BASE_URL}.get_student_violation_stats`, {
        student_id: studentId,
        violation_id: violationId,
        ...(options?.date_from ? { date_from: options.date_from } : {}),
        ...(options?.date_to ? { date_to: options.date_to } : {}),
      });
      const res = response.data?.message ?? response.data;
      if (res?.success && res.data) {
        return { success: true, data: res.data };
      }
      return {
        success: false,
        message: res?.message || 'Không thể lấy thống kê',
        data: { count: 0, level: '1', level_label: 'Cấp độ 1', points: 0 },
      };
    } catch {
      return {
        success: false,
        message: 'Không thể lấy thống kê',
        data: { count: 0, level: '1', level_label: 'Cấp độ 1', points: 0 },
      };
    }
  }

  /** Xóa ghi nhận lỗi */
  async delete(
    name: string
  ): Promise<{ success: boolean; data?: { name: string }; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.delete_discipline_record`, { name });

      const messageData = response.data?.message;
      const res = messageData || response.data;
      if (res?.success) {
        return { success: true, data: res.data || { name }, message: res.message };
      }
      return {
        success: false,
        message: res?.message || 'Không thể xóa ghi nhận lỗi',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Không thể xóa ghi nhận lỗi';
      return { success: false, message: msg };
    }
  }
}

const disciplineRecordService = new DisciplineRecordService();
export default disciplineRecordService;
