import { API_BASE_URL } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LeaveRequest {
  name: string;
  student_name: string;
  parent_name: string;
  creator_name?: string;
  creator_role?: string;
  is_created_by_parent?: boolean;
  owner?: string;
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

export interface CreateLeaveRequestData {
  student_id: string;
  reason: 'sick_child' | 'family_matters' | 'other';
  other_reason?: string;
  start_date: string;
  end_date: string;
  description?: string;
  creator_name?: string;
  creator_role?: string;
  creator_user_id?: string;
  is_created_by_parent?: boolean;
}

export interface CreateLeaveRequestResponse {
  success: boolean;
  data?: {
    id: string;
    student_id: string;
    student_name: string;
    message: string;
  };
  message?: string;
}

export interface ClassStudent {
  name: string;
  student_id: string;
  student_name: string;
  student_code: string;
}

export interface ClassStudentsResponse {
  success: boolean;
  data?: ClassStudent[];
  message?: string;
}

export interface SingleLeaveRequestResponse {
  success: boolean;
  data?: LeaveRequest & { class_id?: string };
  message?: string;
}

class LeaveService {
  /**
   * Get a single leave request by ID
   */
  async getLeaveRequestById(leaveRequestId: string): Promise<SingleLeaveRequestResponse> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/method/erp.api.erp_sis.leave.get_leave_request?leave_request_id=${encodeURIComponent(leaveRequestId)}`,
        { headers }
      );

      const result = await response.json();
      const actualResult = result.message || result;

      return {
        success: actualResult.success === true,
        data: actualResult.data,
        message: actualResult.message,
      };
    } catch (error) {
      console.error('Error fetching leave request by ID:', error);
      return {
        success: false,
        message: 'Không thể tải thông tin đơn nghỉ phép',
      };
    }
  }

  /**
   * Create leave request for a student (teacher view)
   */
  async createLeaveRequest(data: CreateLeaveRequestData): Promise<CreateLeaveRequestResponse> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/method/erp.api.erp_sis.leave.create_leave_request`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        }
      );

      const result = await response.json();

      // Handle Frappe API response format
      const actualResult = result.message || result;

      return {
        success: actualResult.success === true,
        data: actualResult.data,
        message: actualResult.message,
      };
    } catch (error) {
      console.error('Error creating leave request:', error);
      return {
        success: false,
        message: 'Không thể tạo đơn nghỉ phép',
      };
    }
  }

  /**
   * Get students in a class (with full student details)
   */
  async getClassStudents(classId: string): Promise<ClassStudentsResponse> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Step 1: Get class students (student IDs)
      const classStudentsResponse = await fetch(
        `${API_BASE_URL}/api/method/erp.api.erp_sis.class_student.get_all_class_students_no_pagination?class_id=${encodeURIComponent(classId)}`,
        { headers }
      );

      const classStudentsResult = await classStudentsResponse.json();
      const classStudentsData = classStudentsResult.message || classStudentsResult;

      if (!classStudentsData.success || !classStudentsData.data) {
        return {
          success: false,
          message: classStudentsData.message || 'Không thể tải danh sách học sinh',
        };
      }

      // Extract student IDs
      const studentIds = classStudentsData.data.map((cs: any) => cs.student_id);

      if (studentIds.length === 0) {
        return {
          success: true,
          data: [],
          message: 'Lớp không có học sinh',
        };
      }

      // Step 2: Get student details using batch API
      const studentsResponse = await fetch(
        `${API_BASE_URL}/api/method/erp.api.erp_sis.student.batch_get_students`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ student_ids: studentIds }),
        }
      );

      const studentsResult = await studentsResponse.json();
      const studentsData = studentsResult.message || studentsResult;

      if (!studentsData.success || !studentsData.data) {
        return {
          success: false,
          message: studentsData.message || 'Không thể tải thông tin học sinh',
        };
      }

      // Map to ClassStudent format
      const students: ClassStudent[] = studentsData.data.map((student: any) => ({
        name: student.name,
        student_id: student.name,
        student_name: student.student_name || '',
        student_code: student.student_code || '',
      }));

      return {
        success: true,
        data: students,
        message: 'Tải danh sách học sinh thành công',
      };
    } catch (error) {
      console.error('Error fetching class students:', error);
      return {
        success: false,
        message: 'Không thể tải danh sách học sinh',
      };
    }
  }

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
          },
        };
      }

      // Fetch leave requests for all classes
      const promises = classIds.map((classId) => this.getClassLeaveRequests(classId, params));

      const responses = await Promise.all(promises);

      // Combine all successful responses
      const allLeaveRequests: LeaveRequest[] = [];
      let totalCount = 0;

      responses.forEach((response) => {
        if (response.success && response.data) {
          allLeaveRequests.push(...(response.data.leave_requests || []));
          totalCount += response.data.total || 0;
        }
      });

      // Sort by creation date (newest first) and apply pagination
      allLeaveRequests.sort(
        (a, b) =>
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
        },
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
