import api from '../utils/api';

export interface Student {
  name: string;
  student_id?: string;
  student_name: string;
  student_code: string;
  user_image?: string;
  photo?: string;
  class_id?: string;
  class_name?: string;
  education_grade?: string;
  education_stage?: string;
  gender?: string;
  date_of_birth?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

const CLASS_STUDENT_URL = '/method/erp.api.erp_sis.class_student';
const STUDENT_URL = '/method/erp.api.erp_sis.student';

class StudentService {
  // Lấy danh sách học sinh theo lớp (2 bước: lấy class_students → batch get student info)
  async getStudentsByClass(classId: string): Promise<ApiResponse<Student[]>> {
    try {
      // Bước 1: Lấy danh sách student_id từ class_student
      const csResponse = await api.get(`${CLASS_STUDENT_URL}.get_all_class_students`, {
        params: {
          class_id: classId,
          page: 1,
          limit: 1000,
        },
      });

      const csResult = csResponse.data?.message || csResponse.data;
      const classStudents = csResult?.data || [];

      if (!classStudents.length) {
        return { success: true, data: [] };
      }

      // Bước 2: Batch get student info
      const studentIds = classStudents.map((cs: any) => cs.student_id).filter(Boolean);

      if (!studentIds.length) {
        return { success: true, data: [] };
      }

      const batchResponse = await api.post(`${STUDENT_URL}.batch_get_students`, {
        student_ids: studentIds,
      });

      const batchResult = batchResponse.data?.message || batchResponse.data;
      const students = batchResult?.data || batchResult || [];

      return {
        success: true,
        data: Array.isArray(students) ? students : [],
      };
    } catch (error: any) {
      console.error('Error fetching students by class:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Lỗi khi tải danh sách học sinh',
        data: [],
      };
    }
  }

  // Lấy thông tin học sinh theo ID
  async getStudent(studentId: string): Promise<ApiResponse<Student>> {
    try {
      const response = await api.get(`${STUDENT_URL}.get_student`, {
        params: { student_id: studentId },
      });

      const result = response.data?.message || response.data;
      return {
        success: true,
        data: result?.data || result,
      };
    } catch (error: any) {
      console.error('Error fetching student:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Lỗi khi tải thông tin học sinh',
      };
    }
  }
}

const studentService = new StudentService();
export default studentService;
