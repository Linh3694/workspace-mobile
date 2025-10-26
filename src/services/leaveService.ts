import { API_BASE_URL } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LeaveRequest {
  name: string;
  student_name: string;
  parent_name: string;
  reason: string;
  reason_display: string;
  other_reason?: string;
  student_code: string;
  start_date: string;
  end_date: string;
  total_days: number;
  description?: string;
  submitted_at?: string;
  creation: string;
  modified: string;
  student_id: string;
  parent_id: string;
}

export interface LeaveRequestResponse {
  success: boolean;
  data?: {
    leave_requests: LeaveRequest[];
    total: number;
    total_pages: number;
    page: number;
    limit: number;
    class_name?: string;
  };
  message?: string;
}

export interface StudentPhotoResponse {
  success: boolean;
  data?: {
    photo_url?: string;
    photo_name?: string;
    upload_date?: string;
  };
  message?: string;
}

class LeaveService {
  async getClassLeaveRequests(
    classId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
    }
  ): Promise<LeaveRequestResponse> {
    try {
      const queryParams = new URLSearchParams({
        class_id: classId,
        ...(params?.page && { page: params.page.toString() }),
        ...(params?.limit && { limit: params.limit.toString() }),
        ...(params?.search && { search: params.search }),
      });

      const token = await AsyncStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/method/erp.api.erp_sis.leave.get_class_leave_requests?${queryParams.toString()}`,
        { headers }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching class leave requests:', error);
      return {
        success: false,
        message: 'Không thể tải danh sách đơn nghỉ phép',
      };
    }
  }

  async getAllTeacherLeaveRequests(
    classIds: string[],
    params?: {
      page?: number;
      limit?: number;
      search?: string;
    }
  ): Promise<LeaveRequestResponse> {
    try {
      if (classIds.length === 0) {
        return {
          success: true,
          data: {
            leave_requests: [],
            total: 0,
            total_pages: 1,
            page: 1,
            limit: params?.limit || 20,
          }
        };
      }

      // Fetch leave requests for all classes
      const promises = classIds.map(classId =>
        this.getClassLeaveRequests(classId, params)
      );

      const responses = await Promise.all(promises);

      // Combine all successful responses
      const allLeaveRequests: LeaveRequest[] = [];
      let totalCount = 0;

      responses.forEach(response => {
        if (response.success && response.data) {
          allLeaveRequests.push(...(response.data.leave_requests || []));
          totalCount += response.data.total || 0;
        }
      });

      // Sort by creation date (newest first) and apply pagination
      allLeaveRequests.sort((a, b) =>
        new Date(b.submitted_at || b.creation).getTime() -
        new Date(a.submitted_at || a.creation).getTime()
      );

      // Apply pagination after combining and sorting
      const page = params?.page || 1;
      const limit = params?.limit || 20;
      const offset = (page - 1) * limit;
      const paginatedRequests = allLeaveRequests.slice(offset, offset + limit);
      const totalPages = Math.ceil(allLeaveRequests.length / limit);

      return {
        success: true,
        data: {
          leave_requests: paginatedRequests,
          total: allLeaveRequests.length,
          total_pages: totalPages,
          page,
          limit,
        }
      };
    } catch (error) {
      console.error('Error fetching all teacher leave requests:', error);
      return {
        success: false,
        message: 'Không thể tải danh sách đơn nghỉ phép',
      };
    }
  }

  async getStudentPhoto(studentId: string): Promise<StudentPhotoResponse> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/method/erp.api.erp_sis.leave.get_student_photo?student_id=${studentId}`,
        { headers }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching student photo:', error);
      return {
        success: false,
        message: 'Không thể tải ảnh học sinh',
      };
    }
  }
}

const leaveService = new LeaveService();
export { leaveService };
