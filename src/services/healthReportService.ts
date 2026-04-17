import api from '../utils/api';

export interface PorridgeDate {
  date: string; // YYYY-MM-DD
  breakfast: boolean;
  lunch: boolean;
  afternoon: boolean;
}

export interface HealthReport {
  name: string;
  student_id: string;
  student_name: string;
  student_code: string;
  class_id: string;
  class_name?: string;
  description: string;
  porridge_registration: boolean;
  porridge_dates: PorridgeDate[];
  porridge_note?: string;
  created_at: string;
  created_by: string;
  created_by_name?: string;
}

export interface ClassHealthReportsParams {
  class_id: string;
  date?: string;
}

export interface CreateHealthReportParams {
  student_id: string;
  class_id: string;
  description: string;
  porridge_registration: boolean;
  porridge_dates?: PorridgeDate[];
  porridge_note?: string;
}

export interface UpdateHealthReportParams {
  report_id: string;
  description: string;
  porridge_registration: boolean;
  porridge_dates?: PorridgeDate[];
  porridge_note?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

const BASE_URL = '/method/erp.api.health';

class HealthReportService {
  async getClassHealthReports(
    params: ClassHealthReportsParams
  ): Promise<ApiResponse<{ data: HealthReport[]; total: number }>> {
    try {
      const response = await api.get(`${BASE_URL}.get_class_health_reports`, {
        params: {
          class_id: params.class_id,
          date: params.date || new Date().toISOString().split('T')[0],
        },
      });

      const result = response.data?.message || response.data;

      if (result?.success === false) {
        return { success: false, message: result?.message || 'Lỗi khi tải danh sách' };
      }

      // Backend trả: { success, data: { data: [...reports], total } }
      const innerData = result?.data;
      const reports = innerData?.data || innerData || [];
      const total = innerData?.total || 0;
      return {
        success: true,
        data: {
          data: Array.isArray(reports) ? reports : [],
          total: typeof total === 'number' ? total : 0,
        },
      };
    } catch (error: any) {
      console.error('Error fetching class health reports:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Lỗi khi tải danh sách báo cháo',
      };
    }
  }

  async createHealthReport(params: CreateHealthReportParams): Promise<ApiResponse<{ name: string }>> {
    try {
      const response = await api.post(`${BASE_URL}.create_health_report`, {
        student_id: params.student_id,
        class_id: params.class_id,
        description: params.description,
        porridge_registration: params.porridge_registration ? 1 : 0,
        porridge_dates: params.porridge_dates ? JSON.stringify(params.porridge_dates) : undefined,
        porridge_note: params.porridge_note,
      });

      const result = response.data?.message || response.data;

      if (result?.success === false) {
        return {
          success: false,
          message: result?.message || 'Tạo báo cháo thất bại',
        };
      }

      return {
        success: true,
        data: { name: result?.data?.name || result?.name },
      };
    } catch (error: any) {
      console.error('Error creating health report:', error);
      const errMsg =
        error.response?.data?.message?.message ||
        error.response?.data?.message ||
        error.response?.data?._server_messages ||
        error.message ||
        'Lỗi khi tạo báo cháo';
      return { success: false, message: typeof errMsg === 'string' ? errMsg : 'Lỗi khi tạo báo cháo' };
    }
  }

  async updateHealthReport(params: UpdateHealthReportParams): Promise<ApiResponse<{ name: string }>> {
    try {
      const response = await api.post(`${BASE_URL}.update_health_report`, {
        report_id: params.report_id,
        description: params.description,
        porridge_registration: params.porridge_registration ? 1 : 0,
        porridge_dates: params.porridge_dates ? JSON.stringify(params.porridge_dates) : undefined,
        porridge_note: params.porridge_note,
      });

      const result = response.data?.message || response.data;

      if (result?.success === false) {
        return {
          success: false,
          message: result?.message || 'Cập nhật thất bại',
        };
      }

      return {
        success: true,
        data: { name: result?.data?.name || result?.name },
      };
    } catch (error: any) {
      console.error('Error updating health report:', error);
      const errMsg =
        error.response?.data?.message?.message ||
        error.response?.data?.message ||
        error.message ||
        'Lỗi khi cập nhật báo cháo';
      return { success: false, message: typeof errMsg === 'string' ? errMsg : 'Lỗi khi cập nhật báo cháo' };
    }
  }

  async deleteHealthReport(reportId: string): Promise<ApiResponse<{ name: string }>> {
    try {
      const response = await api.post(`${BASE_URL}.delete_health_report`, {
        report_id: reportId,
      });

      const result = response.data?.message || response.data;

      if (result?.success === false) {
        return {
          success: false,
          message: result?.message || 'Xóa thất bại',
        };
      }

      return {
        success: true,
        data: { name: result?.data?.name || result?.name },
      };
    } catch (error: any) {
      console.error('Error deleting health report:', error);
      const errMsg =
        error.response?.data?.message?.message ||
        error.response?.data?.message ||
        error.message ||
        'Lỗi khi xóa báo cháo';
      return { success: false, message: typeof errMsg === 'string' ? errMsg : 'Lỗi khi xóa báo cháo' };
    }
  }
}

export const healthReportService = new HealthReportService();
export default healthReportService;
