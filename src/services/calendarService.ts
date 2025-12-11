import api from '../utils/api';

export interface CalendarEvent {
  name: string;
  title: string;
  type: 'holiday' | 'school_event' | 'exam';
  start_date: string;
  end_date: string;
  description?: string;
  school_year_id: string;
  education_stages?: string[];
}

export interface StandardApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

class CalendarService {
  private baseUrl = '/method/erp.api.erp_sis.calendar';

  /**
   * Get calendar events for a date range
   */
  async getCalendarEvents(
    startDate?: string,
    endDate?: string,
    schoolYearId?: string
  ): Promise<StandardApiResponse<CalendarEvent[]>> {
    try {
      const params: Record<string, string> = {
        limit: '500', // Get all events for the year
      };
      if (schoolYearId) params.school_year_id = schoolYearId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const queryString = new URLSearchParams(params).toString();
      const url = `${this.baseUrl}.get_events${queryString ? `?${queryString}` : ''}`;

      console.log('📅 [CalendarService] Fetching events from:', url);

      const response = await api.get(url);

      console.log('📅 [CalendarService] Response status:', response.status);

      const data = response.data;
      const actualData = data.message || data;

      console.log('📅 [CalendarService] Events count:', actualData.data?.length || 0);

      if (actualData.success && actualData.data) {
        return {
          success: true,
          data: actualData.data,
          message: actualData.message,
        };
      }

      return {
        success: false,
        message: actualData.message || 'Không thể lấy dữ liệu lịch',
        data: [],
      };
    } catch (error) {
      console.error('📅 [CalendarService] Error fetching calendar events:', error);
      return {
        success: false,
        message: 'Không thể lấy dữ liệu lịch',
        data: [],
      };
    }
  }
}

export const calendarService = new CalendarService();
export default calendarService;
