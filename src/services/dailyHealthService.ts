import api from '../utils/api';

// ===== INTERFACES =====

export interface DailyHealthVisit {
  name: string;
  student_id: string;
  student_name: string;
  student_code: string;
  student_photo?: string;
  class_id: string;
  class_name: string;
  visit_date: string;
  reason: string;
  leave_class_time: string;
  arrive_clinic_time?: string;
  leave_clinic_time?: string;
  status: VisitStatus;
  reported_by?: string;
  reported_by_name: string;
  received_by?: string;
  received_by_name?: string;
  creation?: string;
  period?: string;
  checkout_notes?: string;
  transfer_hospital?: string;
  accompanying_teacher?: string;
  accompanying_health_staff?: string;
}

export type VisitStatus = 'left_class' | 'at_clinic' | 'examining' | 'returned' | 'picked_up' | 'transferred';

export interface ExaminationImage {
  name?: string;
  image: string;
  description?: string;
}

export interface HealthExamination {
  name: string;
  student_id: string;
  student_name: string;
  student_code: string;
  examination_date: string;
  visit_id?: string;
  symptoms: string;
  images?: ExaminationImage[];
  disease_classification?: string;
  examination_notes?: string;
  treatment_type?: TreatmentType;
  treatment_details?: string;
  notes?: string;
  checkout_notes?: string;
  diet_history?: string;
  outcome?: VisitOutcome;
  examined_by?: string;
  examined_by_name?: string;
  sent_to_parent?: boolean;
  sent_to_parent_at?: string;
  creation?: string;
  modified?: string;
  // NVYT thăm khám
  medical_staff?: string;
  medical_staff_name?: string;
  // Thời gian vào/về y tế
  clinic_checkin_time?: string;
  clinic_checkout_time?: string;
  // Thăm khám bổ sung
  followup_checkin_time?: string;
  followup_examination?: string;
  followup_treatment_details?: string;
  followup_checkout_time?: string;
  followup_outcome?: string;
  followup_notes?: string;
  followup_transfer_hospital?: string;
  followup_accompanying_teacher?: string;
  followup_accompanying_health_staff?: string;
  followup_clinic_checkin_time?: string;
  followup_clinic_checkout_time?: string;
  followup_is_scheduled_recheck?: number;
  followup_medical_suggestion?: string;
  followup_medical_staff?: string;
  followup_medical_staff_name?: string;
  // Chẩn đoán & điều trị tại bệnh viện
  hospital_insurance?: string;
  hospital_school_coordination?: string;
  hospital_medical_staff?: string;
  hospital_medical_staff_name?: string;
  hospital_diagnosis?: string;
  hospital_treatment?: string;
  hospital_direction?: string;
  hospital_advance_cost?: number;
  hospital_payer?: string;
  hospital_payer_other?: string;
  hospital_transport?: string;
  hospital_transport_other?: string;
  hospital_health_monitoring?: string;
  hospital_notes?: string;
}

export type TreatmentType = 'first_aid' | 'medication' | 'rest' | 'other';
export type VisitOutcome = 'returned' | 'picked_up' | 'transferred';

export interface ReportStudentParams {
  student_id: string;
  class_id: string;
  reason: string;
  leave_class_time?: string;
  period?: string;
  date?: string;
  initial_status?: 'left_class' | 'at_clinic';
}

export interface GetDailyVisitsParams {
  date?: string;
  /** Filter theo cấp học (education stage) - giống Sổ đầu bài */
  education_stage?: string;
  status?: string;
  search?: string;
}

export interface CreateExaminationParams {
  visit_id: string;
  symptoms: string;
  images?: ExaminationImage[];
  disease_classification?: string;
  examination_notes?: string;
  diet_history?: string;
  treatment_type?: TreatmentType;
  treatment_details?: string;
  notes?: string;
  medical_staff?: string;
  clinic_checkin_time?: string;
  clinic_checkout_time?: string;
}

export interface UpdateExaminationParams {
  exam_id: string;
  symptoms?: string;
  images?: ExaminationImage[];
  disease_classification?: string;
  examination_notes?: string;
  diet_history?: string;
  treatment_type?: TreatmentType;
  treatment_details?: string;
  notes?: string;
  medical_staff?: string;
  clinic_checkin_time?: string;
  clinic_checkout_time?: string;
  // Followup fields
  followup_checkin_time?: string;
  followup_examination?: string;
  followup_treatment_details?: string;
  followup_checkout_time?: string;
  followup_outcome?: string;
  followup_notes?: string;
  followup_transfer_hospital?: string;
  followup_accompanying_teacher?: string;
  followup_accompanying_health_staff?: string;
  followup_clinic_checkin_time?: string;
  followup_clinic_checkout_time?: string;
  followup_is_scheduled_recheck?: boolean;
  followup_medical_suggestion?: string;
  followup_medical_staff?: string;
  // Hospital fields
  hospital_insurance?: string;
  hospital_school_coordination?: string;
  hospital_medical_staff?: string;
  hospital_diagnosis?: string;
  hospital_treatment?: string;
  hospital_direction?: string;
  hospital_advance_cost?: number;
  hospital_payer?: string;
  hospital_payer_other?: string;
  hospital_transport?: string;
  hospital_transport_other?: string;
  hospital_health_monitoring?: string;
  hospital_notes?: string;
}

export interface CompleteVisitParams {
  visit_id: string;
  outcome: VisitOutcome;
  leave_clinic_time?: string;
  checkout_notes?: string;
  transfer_hospital?: string;
  accompanying_teacher?: string;
  accompanying_health_staff?: string;
}

export interface GetHealthStatusForPeriodParams {
  class_id: string;
  date: string;
  period: string;
}

export interface HealthStatusForPeriodResponse {
  students: Record<string, {
    visit_id: string;
    status: string;
    leave_class_time: string | null;
    leave_clinic_time: string | null;
  }>;
}

// Interface cho danh sách thăm khám theo lớp (Teacher Health module)
export interface ClassHealthExamStudent {
  student_id: string;
  student_name: string;
  student_code: string;
  student_photo?: string;
  visits?: DailyHealthVisit[];
  examinations: HealthExamination[];
}

export interface GetClassHealthExamParams {
  class_id: string;
  date?: string;
}

export interface MedicalStaffUser {
  name: string;
  full_name: string;
  email?: string;
}

// ===== SERVICE =====

const BASE_URL = '/method/erp.api.erp_sis.daily_health';
const USER_URL = '/method/erp.api.erp_common_user.user_management';

const dailyHealthService = {
  /**
   * Lấy danh sách NVYT (role SIS Medical) - giống Web: getUsers({ role: 'SIS Medical', active: 1, limit: 200 })
   */
  async getMedicalStaffList(): Promise<MedicalStaffUser[]> {
    try {
      const response = await api.get(`${USER_URL}.get_users`, {
        params: { role: 'SIS Medical', active: 1, limit: 200 },
      });
      // API trả về { message: { users: [...], pagination } } hoặc { users: [...] }
      const messageData = response.data?.message;
      const users = messageData?.users || response.data?.users || [];
      return (Array.isArray(users) ? users : []).map((u: any) => ({
        name: u.name || u.email,
        full_name: u.full_name || u.name,
        email: u.email || u.name,
      }));
    } catch (error) {
      console.error('Error fetching medical staff:', error);
      return [];
    }
  },

  /**
   * Lấy danh sách lượt xuống Y tế
   */
  async getDailyHealthVisits(params: GetDailyVisitsParams = {}): Promise<DailyHealthVisit[]> {
    try {
      const response = await api.get(`${BASE_URL}.get_daily_health_visits`, { params });
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        return messageData.data.data || messageData.data;
      }
      if (response.data?.success && response.data?.data) {
        return response.data.data.data || response.data.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching daily health visits:', error);
      return [];
    }
  },

  /**
   * Báo cáo học sinh xuống Y tế (Giáo viên gọi)
   */
  async reportStudentToClinic(params: ReportStudentParams): Promise<{ success: boolean; data?: DailyHealthVisit; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.report_student_to_clinic`, params);
      const messageData = response.data?.message;
      if (messageData?.success) {
        return { success: true, data: messageData.data };
      }
      if (response.data?.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Báo Y tế thất bại' };
    } catch (error: any) {
      console.error('Error reporting student to clinic:', error);
      return { success: false, message: error.response?.data?.message || error.message || 'Báo Y tế thất bại' };
    }
  },

  /**
   * GV hủy đơn báo Y tế (học sinh quay lại lớp / trốn đi chơi)
   */
  async cancelHealthVisit(visitId: string, reason?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.cancel_health_visit`, {
        visit_id: visitId,
        reason: reason || '',
      });
      const messageData = response.data?.message;
      if (messageData?.success || response.data?.success) {
        return { success: true };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Hủy đơn thất bại' };
    } catch (error: any) {
      console.error('Error cancelling health visit:', error);
      return { success: false, message: error.response?.data?.message || error.message || 'Hủy đơn thất bại' };
    }
  },

  /**
   * Y tế từ chối tiếp nhận (chuyển về status returned, không revert attendance)
   */
  async rejectHealthVisit(visitId: string, rejectReason?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.reject_health_visit`, {
        visit_id: visitId,
        reject_reason: rejectReason || '',
      });
      const messageData = response.data?.message;
      if (messageData?.success || response.data?.success) {
        return { success: true };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Từ chối thất bại' };
    } catch (error: any) {
      console.error('Error rejecting health visit:', error);
      return { success: false, message: error.response?.data?.message || error.message || 'Từ chối thất bại' };
    }
  },

  /**
   * Tiếp nhận học sinh tại phòng Y tế
   */
  async receiveStudentAtClinic(visitId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.receive_student_at_clinic`, { visit_id: visitId });
      const messageData = response.data?.message;
      if (messageData?.success || response.data?.success) {
        return { success: true };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Tiếp nhận thất bại' };
    } catch (error: any) {
      console.error('Error receiving student at clinic:', error);
      return { success: false, message: error.response?.data?.message || error.message || 'Tiếp nhận thất bại' };
    }
  },

  /**
   * Bắt đầu khám (chuyển status sang 'examining')
   */
  async startExamination(visitId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.start_examination`, { visit_id: visitId });
      const messageData = response.data?.message;
      if (messageData?.success || response.data?.success) {
        return { success: true };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Bắt đầu khám thất bại' };
    } catch (error: any) {
      console.error('Error starting examination:', error);
      return { success: false, message: error.response?.data?.message || error.message || 'Bắt đầu khám thất bại' };
    }
  },

  /**
   * Tạo hồ sơ thăm khám mới
   */
  async createHealthExamination(params: CreateExaminationParams): Promise<{ success: boolean; data?: HealthExamination; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.create_health_examination`, params);
      const messageData = response.data?.message;
      if (messageData?.success) {
        return { success: true, data: messageData.data };
      }
      if (response.data?.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Tạo hồ sơ thất bại' };
    } catch (error: any) {
      console.error('Error creating health examination:', error);
      return { success: false, message: error.response?.data?.message || error.message || 'Tạo hồ sơ thất bại' };
    }
  },

  /**
   * Cập nhật hồ sơ thăm khám
   */
  async updateHealthExamination(params: UpdateExaminationParams): Promise<{ success: boolean; data?: HealthExamination; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.update_health_examination`, params);
      const messageData = response.data?.message;
      if (messageData?.success) {
        return { success: true, data: messageData.data };
      }
      if (response.data?.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Cập nhật hồ sơ thất bại' };
    } catch (error: any) {
      console.error('Error updating health examination:', error);
      const errData = error.response?.data;
      const errMsg =
        (typeof errData?.message === 'string' ? errData.message : null) ||
        errData?.exception ||
        error.message ||
        'Cập nhật hồ sơ thất bại';
      return { success: false, message: errMsg };
    }
  },

  /**
   * Lấy lịch sử thăm khám của học sinh
   */
  async getStudentExaminationHistory(studentId: string, limit: number = 10): Promise<HealthExamination[]> {
    try {
      const response = await api.get(`${BASE_URL}.get_student_examination_history`, {
        params: { student_id: studentId, limit }
      });
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        return messageData.data.data || messageData.data;
      }
      if (response.data?.success && response.data?.data) {
        return response.data.data.data || response.data.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching examination history:', error);
      return [];
    }
  },

  /**
   * Hoàn thành lượt xuống Y tế (checkout)
   */
  async completeHealthVisit(params: CompleteVisitParams): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.complete_health_visit`, params);
      const messageData = response.data?.message;
      if (messageData?.success || response.data?.success) {
        return { success: true };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Checkout thất bại' };
    } catch (error: any) {
      console.error('Error completing health visit:', error);
      return { success: false, message: error.response?.data?.message || error.message || 'Checkout thất bại' };
    }
  },

  /**
   * Lấy trạng thái Y tế theo tiết học (cho ClassLog)
   */
  async getHealthStatusForPeriod(params: GetHealthStatusForPeriodParams): Promise<HealthStatusForPeriodResponse> {
    try {
      const response = await api.get(`${BASE_URL}.get_health_status_for_period`, { params });
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        return messageData.data;
      }
      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
      return { students: {} };
    } catch (error) {
      console.error('Error fetching health status for period:', error);
      return { students: {} };
    }
  },

  /**
   * Lấy danh sách thăm khám theo lớp (cho Teacher Health module)
   */
  async getClassHealthExaminations(params: GetClassHealthExamParams): Promise<ClassHealthExamStudent[]> {
    try {
      const response = await api.get(`${BASE_URL}.get_class_health_examinations`, {
        params: {
          class_id: params.class_id,
          date: params.date || new Date().toISOString().split('T')[0],
        },
      });
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        return messageData.data.data || messageData.data || [];
      }
      if (response.data?.success && response.data?.data) {
        return response.data.data.data || response.data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching class health examinations:', error);
      return [];
    }
  },

  /**
   * Cập nhật lý do báo cáo Y tế
   */
  async updateVisitReason(visitId: string, reason: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.update_visit_reason`, { visit_id: visitId, reason });
      const messageData = response.data?.message;
      if (messageData?.success || response.data?.success) {
        return { success: true };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Cập nhật thất bại' };
    } catch (error: any) {
      console.error('Error updating visit reason:', error);
      return { success: false, message: error.response?.data?.message || error.message || 'Cập nhật thất bại' };
    }
  },

  /**
   * Lấy chi tiết một visit theo ID — gọi API get_visit_by_id trực tiếp (1 request).
   */
  async getVisitDetail(visitId: string): Promise<DailyHealthVisit | null> {
    try {
      const response = await api.get(`${BASE_URL}.get_visit_by_id`, {
        params: { visit_id: visitId }
      });
      const messageData = response.data?.message;
      const data = messageData?.data || response.data?.data;
      if (data) {
        return data as DailyHealthVisit;
      }
      return null;
    } catch (error) {
      console.error('Error fetching visit detail:', error);
      return null;
    }
  },

  /**
   * Gửi hồ sơ thăm khám đến phụ huynh
   */
  async sendExamToParent(examIds: string[]): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.send_exam_to_parent`, { exam_ids: examIds });
      const messageData = response.data?.message;
      if (messageData?.success || response.data?.success) {
        return { success: true, message: 'Đã gửi hồ sơ đến phụ huynh' };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Gửi hồ sơ thất bại' };
    } catch (error: any) {
      console.error('Error sending exam to parent:', error);
      return { success: false, message: error.response?.data?.message || error.message || 'Gửi hồ sơ thất bại' };
    }
  },

  /**
   * Thu hồi hồ sơ thăm khám đã gửi đến phụ huynh
   */
  async recallExamFromParent(examIds: string[]): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.recall_exam_from_parent`, { exam_ids: examIds });
      const messageData = response.data?.message;
      if (messageData?.success || response.data?.success) {
        return { success: true, message: 'Đã thu hồi hồ sơ' };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Thu hồi hồ sơ thất bại' };
    } catch (error: any) {
      console.error('Error recalling exam from parent:', error);
      return { success: false, message: error.response?.data?.message || error.message || 'Thu hồi hồ sơ thất bại' };
    }
  },

  /**
   * Upload file lên server
   */
  async uploadFile(file: { uri: string; name: string; type: string }): Promise<{ success: boolean; file_url?: string; message?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
      formData.append('is_private', '0');

      const response = await api.post('/method/upload_file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const messageData = response.data?.message;
      if (messageData?.file_url || response.data?.file_url) {
        return { success: true, file_url: messageData?.file_url || response.data?.file_url };
      }
      return { success: false, message: 'Upload thất bại' };
    } catch (error: any) {
      console.error('Error uploading file:', error);
      return { success: false, message: error.message || 'Upload thất bại' };
    }
  },
};

export default dailyHealthService;
