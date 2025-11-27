import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';

interface ClassData {
  name: string;
  title?: string;
  short_title?: string;
  campus_id?: string;
  school_year_id?: string;
  education_grade?: string;
  academic_program?: string;
  homeroom_teacher?: string;
  vice_homeroom_teacher?: string;
  room?: string;
  class_type?: string;
  creation?: string;
  modified?: string;
}

interface TimetableEntry {
  name: string;
  date: string;
  day_of_week: string;
  timetable_column_id: string;
  class_id: string;
  subject_id: string;
  room_id: string;
  subject_title: string;
  timetable_subject_title_vn?: string;
  timetable_subject_title_en?: string;
  class_title: string;
  room_name?: string;
  room_type?: string;
}

interface TeacherClassesResponse {
  homeroom_classes: ClassData[];
  teaching_classes: ClassData[];
  teacher_user_id: string;
  school_year_id?: string;
  week_range?: {
    start: string;
    end: string;
  };
}

class AttendanceApiService {
  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem('authToken');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch teacher classes (homeroom and teaching classes)
   */
  async fetchTeacherClasses(
    teacherUserId: string
  ): Promise<{ success: boolean; data?: TeacherClassesResponse; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.teacher_dashboard.get_teacher_classes_optimized?teacher_user_id=${encodeURIComponent(teacherUserId)}`,
        { headers }
      );

      if (!response.ok) {
        console.error('Failed to fetch teacher classes:', response.status);
        return {
          success: false,
          error: `Failed to fetch teacher classes: ${response.status}`,
        };
      }

      const data = await response.json();
      if (data.message?.data) {
        return {
          success: true,
          data: data.message.data,
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format',
        };
      }
    } catch (error) {
      console.error('Error fetching teacher classes:', error);
      return {
        success: false,
        error: `Error fetching teacher classes: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Fetch teacher weekly timetable (original - for both GVCN and GVBM)
   */
  async fetchTeacherTimetable(
    teacherId: string,
    weekStart: string,
    weekEnd: string,
    educationStage?: string
  ): Promise<{ success: boolean; data?: TimetableEntry[]; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      let url = `${BASE_URL}/api/method/erp.api.erp_sis.teacher_dashboard.get_teacher_week_optimized?teacher_id=${encodeURIComponent(teacherId)}&week_start=${weekStart}&week_end=${weekEnd}`;

      if (educationStage) {
        url += `&education_stage=${encodeURIComponent(educationStage)}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.error('Failed to fetch teacher timetable:', response.status);
        return {
          success: false,
          error: `Failed to fetch teacher timetable: ${response.status}`,
        };
      }

      const data = await response.json();
      if (data.message?.data) {
        return {
          success: true,
          data: data.message.data,
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format',
        };
      }
    } catch (error) {
      console.error('Error fetching teacher timetable:', error);
      return {
        success: false,
        error: `Error fetching teacher timetable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get all timetable entries for a specific date (each entry represents a period/class combination)
   */
  getTimetableEntriesForDate(timetableData: TimetableEntry[], date: string): TimetableEntry[] {
    // Handle both flat array and GVBM response format
    const entries = Array.isArray(timetableData) ? timetableData : (timetableData as any)?.entries || [];
    return entries.filter((entry) => entry.date === date);
  }

  /**
   * Fetch teacher weekly timetable for GVBM (subject teachers only)
   */
  async fetchTeacherTimetableGvbm(
    teacherId: string,
    weekStart: string,
    weekEnd: string,
    educationStage?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      let url = `${BASE_URL}/api/method/erp.api.erp_sis.teacher_dashboard.get_teacher_week_gvbm?teacher_id=${encodeURIComponent(teacherId)}&week_start=${weekStart}&week_end=${weekEnd}`;

      if (educationStage) {
        url += `&education_stage=${encodeURIComponent(educationStage)}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.error('Failed to fetch GVBM teacher timetable:', response.status);
        return {
          success: false,
          error: `Failed to fetch GVBM teacher timetable: ${response.status}`,
        };
      }

      const result = await response.json();

      if (result.message?.data) {
        return {
          success: true,
          data: result.message.data,
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format',
        };
      }
    } catch (error) {
      console.error('Error fetching GVBM teacher timetable:', error);
      return {
        success: false,
        error: `Error fetching GVBM teacher timetable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get unique classes for a specific date from timetable data (legacy method)
   * @deprecated Use getTimetableEntriesForDate for period-specific entries
   */
  getClassesForDate(timetableData: TimetableEntry[], date: string): ClassData[] {
    const dayClasses = timetableData.filter((entry) => entry.date === date);

    // Get unique classes for the current day
    const uniqueClasses = new Map<string, ClassData>();
    dayClasses.forEach((entry) => {
      if (!uniqueClasses.has(entry.class_id)) {
        uniqueClasses.set(entry.class_id, {
          name: entry.class_id,
          title: entry.class_title,
          // Add additional fields if available
        });
      }
    });

    return Array.from(uniqueClasses.values());
  }

  /**
   * Get class information by name
   */
  async getClassInfo(className: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.sis_class.get_class?name=${encodeURIComponent(className)}`,
        { headers }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch class info: ${response.status}`,
        };
      }

      const data = await response.json();
      if (data.message?.data || data.data) {
        return {
          success: true,
          data: data.message?.data || data.data,
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error fetching class info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get education stage by grade name
   */
  async getEducationStage(
    gradeName: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.event_class_attendance.get_education_stage?name=${encodeURIComponent(gradeName)}`,
        { headers }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch education stage: ${response.status}`,
        };
      }

      const data = await response.json();
      if (data.message?.data || data.data) {
        return {
          success: true,
          data: data.message?.data || data.data,
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error fetching education stage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get all students for a class
   */
  async getClassStudents(
    classId: string,
    page: number = 1,
    limit: number = 1000
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const qs = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        class_id: String(classId),
      });

      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.class_student.get_all_class_students?${qs.toString()}`,
        { headers }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch class students: ${response.status}`,
        };
      }

      const data = await response.json();
      const students = (data?.data?.data || data?.message?.data || [])
        .map((r: any) => r.student_id)
        .filter(Boolean);

      return {
        success: true,
        data: students,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error fetching class students: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get batch student details
   */
  async getBatchStudents(
    studentIds: string[]
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.student.batch_get_students`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ student_ids: studentIds }),
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch batch students: ${response.status}`,
        };
      }

      const data = await response.json();
      const students = (data?.message?.data || data?.data || []) as any[];

      return {
        success: true,
        data: students,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error fetching batch students: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get class attendance data (single period)
   */
  async getClassAttendance(
    classId: string,
    date: string,
    period: string
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.attendance.get_class_attendance?class_id=${encodeURIComponent(classId)}&date=${date}&period=${encodeURIComponent(period)}`,
        { headers }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch class attendance: ${response.status}`,
        };
      }

      const data = await response.json();
      if (data.message?.data || data.data) {
        return {
          success: true,
          data: data.message?.data || data.data,
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error fetching class attendance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get batch class attendance data (multiple periods)
   */
  async getBatchClassAttendance(
    classId: string,
    date: string,
    periods: string[]
  ): Promise<{ success: boolean; data?: Record<string, any[]>; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.attendance.batch_get_class_attendance`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            class_id: String(classId),
            date: date,
            periods: periods,
          }),
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch batch class attendance: ${response.status}`,
        };
      }

      const data = await response.json();
      if (data.message?.data || data.data) {
        return {
          success: true,
          data: data.message?.data || data.data,
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error fetching batch class attendance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get event attendance statuses
   */
  async getEventAttendanceStatuses(
    classId: string,
    date: string,
    period: string,
    educationStageId: string
  ): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const qs = new URLSearchParams({
        class_id: String(classId),
        date: date,
        period: period,
        education_stage_id: educationStageId,
      });

      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.event_class_attendance.get_event_attendance_statuses?${qs.toString()}`,
        { headers }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch event attendance statuses: ${response.status}`,
        };
      }

      const data = await response.json();
      const evStatuses = (data?.message?.data || data?.data || {}) as Record<string, any>;

      return {
        success: true,
        data: evStatuses,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error fetching event attendance statuses: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get events by class period
   */
  async getEventsByClassPeriod(
    classId: string,
    date: string,
    period: string,
    educationStageId: string
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const qs = new URLSearchParams({
        class_id: String(classId),
        date: date,
        period: period,
        education_stage_id: educationStageId,
      });

      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.event_class_attendance.get_events_by_class_period?${qs.toString()}`,
        { headers }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch events: ${response.status}`,
        };
      }

      const data = await response.json();
      const eventsList = (data?.message?.data || data?.data || []) as any[];

      return {
        success: true,
        data: eventsList,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error fetching events: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get active leaves for class
   */
  async getActiveLeaves(
    classId: string,
    date: string
  ): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.leave.batch_get_active_leaves`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            class_id: String(classId),
            date: date,
          }),
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch active leaves: ${response.status}`,
        };
      }

      const data = await response.json();
      const leaves = (data?.message?.data || data?.data || {}) as Record<string, any>;

      return {
        success: true,
        data: leaves,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error fetching active leaves: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get students day attendance map
   */
  async getStudentsDayMap(
    studentCodes: string[],
    date: string
  ): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.attendance.query.get_students_day_map`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            date: date,
            codes: studentCodes,
          }),
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch students day map: ${response.status}`,
        };
      }

      const data = await response.json();
      if (data.message?.data || data.data) {
        return {
          success: true,
          data: data.message?.data || data.data,
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error fetching students day map: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Save class attendance
   */
  async saveClassAttendance(
    items: any[],
    overwrite: boolean = true
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('🔄 [API] saveClassAttendance: Starting save with', items.length, 'items');
      console.log('🔄 [API] saveClassAttendance: Sample item:', items[0]);

      const headers = await this.getAuthHeaders();
      const requestBody = { items, overwrite };
      console.log(
        '🔄 [API] saveClassAttendance: Request body:',
        JSON.stringify(requestBody, null, 2)
      );

      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.erp_sis.attendance.save_class_attendance`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        }
      );

      console.log('📡 [API] saveClassAttendance: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] saveClassAttendance: Response not ok:', errorText);
        return {
          success: false,
          error: `Failed to save attendance: ${response.status} - ${errorText}`,
        };
      }

      const data = await response.json();
      console.log('📦 [API] saveClassAttendance: Response data:', data);

      if (data.success || data.message) {
        console.log('✅ [API] saveClassAttendance: Save successful');
        return {
          success: true,
          data: data,
        };
      } else {
        console.log('❌ [API] saveClassAttendance: Save failed with response:', data);
        return {
          success: false,
          error: data.message || 'Save failed',
        };
      }
    } catch (error) {
      console.error('❌ [API] saveClassAttendance: Exception:', error);
      return {
        success: false,
        error: `Error saving attendance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Calculate week range from a given date
   */
  calculateWeekRange(date: Date): { weekStart: string; weekEnd: string } {
    const now = new Date(date);
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); // Monday of current week
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // Sunday of current week
    sunday.setHours(23, 59, 59, 999);

    return {
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: sunday.toISOString().split('T')[0],
    };
  }
}

export const attendanceApiService = new AttendanceApiService();
export default attendanceApiService;
