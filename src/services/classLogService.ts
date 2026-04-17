import api from '../utils/api';

// ===== INTERFACES =====

export interface ClassLogStudent {
  student_id: string;
  class_student_id?: string;
  // Các field đánh giá (lưu bằng option.name)
  homework?: string;
  behavior?: string;
  participation?: string;
  issues?: string; // Comma-separated list of issue names
  is_top_performance?: number; // 0 hoặc 1
  specific_comment?: string;
  value?: number;
  // Legacy fields (for backward compatibility)
  homework_status?: string;
  issue?: string;
  top_performance?: string;
  notes?: string;
}

export interface ClassLogData {
  name?: string;
  class_id: string;
  date: string;
  period: string;
  timetable_instance?: string;
  lesson_content?: string;
  homework_assigned?: string;
  notes?: string;
  students: ClassLogStudent[];
  creation?: string;
  modified?: string;
}

export interface ClassLogOption {
  name: string;
  type: string;
  title_vn: string;
  title_en: string;
  value: number;
  color?: string;
  education_stage?: string;
  is_default?: number;
}

export interface ClassLogOptionsResponse {
  homework: ClassLogOption[];
  behavior: ClassLogOption[];
  participation: ClassLogOption[];
  issue: ClassLogOption[];
  top_performance: ClassLogOption[];
}

export interface GetClassLogParams {
  class_id: string;
  date: string;
  period: string;
  timetable_instance?: string;
}

export interface SaveClassLogParams {
  class_id: string;
  date: string;
  period: string;
  timetable_instance?: string;
  lesson_content?: string;
  homework_assigned?: string;
  notes?: string;
  students: ClassLogStudent[];
}

// ===== SERVICE =====

const BASE_URL = '/method/erp.api.erp_sis.class_log';

const classLogService = {
  /**
   * Lấy sổ đầu bài của lớp theo tiết
   */
  async getClassLog(params: GetClassLogParams): Promise<ClassLogData | null> {
    try {
      const response = await api.get(`${BASE_URL}.get_class_log`, { params });
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        return messageData.data;
      }
      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching class log:', error);
      return null;
    }
  },

  /**
   * Lấy các options cho sổ đầu bài (homework, behavior, participation, ...)
   */
  async getOptions(educationStage?: string): Promise<ClassLogOptionsResponse | null> {
    try {
      const params = educationStage ? { education_stage: educationStage } : {};
      const response = await api.get(`${BASE_URL}.get_class_log_options`, { params });
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        return messageData.data;
      }
      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching class log options:', error);
      return null;
    }
  },

  /**
   * Lưu sổ đầu bài
   */
  async saveClassLog(params: SaveClassLogParams): Promise<{ success: boolean; data?: ClassLogData; message?: string }> {
    try {
      const response = await api.post(`${BASE_URL}.save_class_log`, params);
      const messageData = response.data?.message;
      if (messageData?.success) {
        return { success: true, data: messageData.data };
      }
      if (response.data?.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: messageData?.message || response.data?.message || 'Lưu sổ đầu bài thất bại' };
    } catch (error: any) {
      console.error('Error saving class log:', error);
      return { success: false, message: error.response?.data?.message || error.message || 'Lưu sổ đầu bài thất bại' };
    }
  },

  /**
   * Cập nhật đánh giá cho một học sinh
   * Sử dụng API save_class_log với mảng students chứa 1 học sinh
   */
  async updateStudentNote(params: {
    class_id: string;
    date: string;
    period: string;
    student_id: string;
    homework?: string;
    behavior?: string;
    participation?: string;
    issues?: string;
    is_top_performance?: number;
    specific_comment?: string;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      // Chuẩn bị payload theo format của save_class_log
      const payload = {
        class_id: params.class_id,
        date: params.date,
        period: params.period,
        students: [
          {
            student_id: params.student_id,
            homework: params.homework,
            behavior: params.behavior,
            participation: params.participation,
            issues: params.issues,
            is_top_performance: params.is_top_performance,
            specific_comment: params.specific_comment,
          },
        ],
      };

      console.log('📝 Saving student note with payload:', JSON.stringify(payload, null, 2));

      const response = await api.post(`${BASE_URL}.save_class_log`, payload);
      const messageData = response.data?.message;

      console.log('📝 Save response:', JSON.stringify(response.data, null, 2));

      if (messageData?.success || response.data?.success) {
        return { success: true };
      }
      return {
        success: false,
        message: messageData?.message || response.data?.message || 'Cập nhật thất bại',
      };
    } catch (error: any) {
      console.error('Error updating student note:', error);
      console.error('Error response:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Cập nhật thất bại',
      };
    }
  },
};

export default classLogService;
