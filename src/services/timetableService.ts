import api from '../utils/api';

// Types
export interface TeacherClass {
  name: string;
  title: string;
  short_title?: string;
  campus_id?: string;
  school_year_id?: string;
  education_grade?: string;
  academic_program?: string;
  homeroom_teacher?: string;
  vice_homeroom_teacher?: string;
  room?: string;
  class_type?: string;
  homeroom_teacher_info?: {
    user_id: string;
    full_name: string;
  };
  vice_homeroom_teacher_info?: {
    user_id: string;
    full_name: string;
  };
}

export interface TeacherClassesResponse {
  homeroom_classes: TeacherClass[];
  teaching_classes: TeacherClass[];
  teacher_user_id: string;
  school_year_id: string;
  week_range: {
    start: string;
    end: string;
  };
}

export interface TimetableEntry {
  name?: string;
  timetable_column_id?: string;
  class_id: string;
  class_title?: string;
  subject_id?: string;
  subject_title?: string;
  teacher_1_id?: string;
  teacher_2_id?: string;
  teacher_ids?: string[];
  room_id?: string;
  room_name?: string;
  room_title?: string;
  period_id?: string;
  period_name?: string;
  period_type?: string;
  period_priority?: number;
  start_time?: string;
  end_time?: string;
  day_of_week?: string;
  date?: string;
  curriculum_id?: string;
}

export interface TeacherInfo {
  name: string;
  teacher_name?: string;
  full_name?: string;
  gender?: string;
  avatar_url?: string;
  user_id?: string;
  email?: string;
}

// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to get Monday of current week
export const getMondayOfWeek = (date: Date = new Date()): Date => {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + daysToMonday);
  return d;
};

// Helper function to get week range
export const getWeekRange = (date: Date = new Date()): { startDate: string; endDate: string } => {
  const monday = getMondayOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    startDate: formatDate(monday),
    endDate: formatDate(sunday),
  };
};

const timetableService = {
  /**
   * Get list of classes where teacher is homeroom/vice-homeroom
   */
  async getTeacherClasses(teacherUserId?: string): Promise<TeacherClassesResponse | null> {
    try {
      const params = teacherUserId ? `?teacher_user_id=${teacherUserId}` : '';
      console.log('📚 Calling get_teacher_classes API...');
      const response = await api.get(`/method/erp.api.erp_sis.sis_class.get_teacher_classes${params}`);
      
      console.log('📚 API Response:', JSON.stringify(response.data, null, 2));
      
      // Handle Frappe response structure: response.data.message.data
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        console.log('📚 Homeroom classes:', messageData.data.homeroom_classes?.length || 0);
        console.log('📚 Teaching classes:', messageData.data.teaching_classes?.length || 0);
        return messageData.data;
      }
      
      // Fallback: check direct response.data structure
      if (response.data?.success && response.data?.data) {
        console.log('📚 (fallback) Homeroom classes:', response.data.data.homeroom_classes?.length || 0);
        return response.data.data;
      }
      
      console.log('📚 API returned no data or success=false');
      return null;
    } catch (error) {
      console.error('📚 Error fetching teacher classes:', error);
      return null;
    }
  },

  /**
   * Get timetable entries for a class in a week range
   */
  async getClassTimetable(
    classId: string,
    startDate: string,
    endDate: string
  ): Promise<TimetableEntry[]> {
    try {
      console.log('📅 Fetching timetable for class:', classId, 'from', startDate, 'to', endDate);
      const response = await api.get(
        `/method/erp.api.erp_sis.timetable.weeks.get_class_week`,
        {
          params: {
            class_id: classId,
            week_start: startDate,
            week_end: endDate,
          },
        }
      );

      console.log('📅 Timetable response:', JSON.stringify(response.data, null, 2).substring(0, 500));

      // Handle Frappe response structure: response.data.message.data
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        console.log('📅 Found', messageData.data.length, 'timetable entries');
        return messageData.data;
      }
      
      // Fallback: check direct response.data structure  
      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
      
      console.log('📅 No timetable data found');
      return [];
    } catch (error) {
      console.error('📅 Error fetching class timetable:', error);
      return [];
    }
  },

  /**
   * Get teacher info by IDs
   */
  async getTeacherInfo(teacherIds: string[]): Promise<Record<string, TeacherInfo>> {
    try {
      if (!teacherIds || teacherIds.length === 0) {
        console.log('👨‍🏫 No teacher IDs provided, skipping');
        return {};
      }

      // Filter out empty/null IDs
      const validIds = teacherIds.filter(id => id && id.trim());
      if (validIds.length === 0) {
        console.log('👨‍🏫 No valid teacher IDs after filtering');
        return {};
      }

      console.log('👨‍🏫 Fetching teacher info for:', validIds.length, 'teachers');
      console.log('👨‍🏫 Teacher IDs:', validIds);
      
      // Thử POST trước, nếu fail thì fallback sang GET
      let response;
      try {
        // POST request với body JSON
        response = await api.post(
          `/method/erp.api.erp_sis.teacher.get_teacher_info_batch`,
          {
            teacher_ids: validIds
          }
        );
      } catch (postError) {
        console.log('👨‍🏫 POST failed, trying GET with query params...');
        // Fallback: GET request với teacher_ids là JSON string trong query
        response = await api.get(
          `/method/erp.api.erp_sis.teacher.get_teacher_info_batch`,
          {
            params: {
              teacher_ids: JSON.stringify(validIds)
            }
          }
        );
      }

      console.log('👨‍🏫 Teacher info response:', JSON.stringify(response.data, null, 2).substring(0, 500));

      // Handle Frappe response structure: response.data.message.data
      const messageData = response.data?.message;
      if (messageData?.success && messageData?.data) {
        const teacherCount = Object.keys(messageData.data).length;
        console.log('👨‍🏫 Got teacher info for', teacherCount, 'teachers');
        return messageData.data;
      }
      
      // Fallback: check direct response.data structure
      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
      
      console.log('👨‍🏫 No teacher data in response');
      return {};
    } catch (error) {
      console.error('👨‍🏫 Error fetching teacher info:', error);
      return {};
    }
  },
};

export default timetableService;

