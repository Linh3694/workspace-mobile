import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';

interface AttendanceRecord {
  _id: string;
  employeeCode: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalCheckIns: number;
  status: string;
  user?: {
    fullname: string;
    email: string;
    employeeCode: string;
  };
  rawData?: {
    timestamp: string;
    deviceId: string;
    recordedAt: string;
  }[];
}

interface AttendanceResponse {
  status: string;
  data: {
    records: AttendanceRecord[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalRecords: number;
      hasMore: boolean;
    };
  };
}

interface AttendanceServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  retryCount?: number;
}

interface AttendanceStats {
  totalDays: number;
  totalCheckIns: number;
  avgCheckInsPerDay: number;
  daysWithSingleCheckIn: number;
  daysWithMultipleCheckIns: number;
}

class AttendanceService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 phút

  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem('authToken');
    console.log(
      '🔑 [getAuthHeaders] Token exists:',
      !!token,
      token ? '***' + token.slice(-10) : 'null'
    );
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // Helper method để retry API calls
  private async retryApiCall<T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error as Error;
        console.warn(`API call attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          // Exponential backoff
          const waitTime = delay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          console.error(`All ${maxRetries} attempts failed`);
        }
      }
    }

    throw lastError!;
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  // Helper method để set cache
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  // Clear cache manually
  clearCache(): void {
    this.cache.clear();
  }

  // Clear old cache entries for different dates
  clearOldDateCache(employeeCode: string): void {
    const currentDate = this.getCurrentVNDateString();
    const keysToDelete: string[] = [];

    for (const [key] of this.cache) {
      if (key.startsWith(`today-attendance-${employeeCode}-`) && !key.includes(currentDate)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
    });
  }

  // Method để force refresh data (clear cache và fetch lại)
  async forceRefreshTodayAttendance(employeeCode: string): Promise<AttendanceRecord | null> {
    const todayDateString = this.getCurrentVNDateString();
    const cacheKey = `today-attendance-${employeeCode}-${todayDateString}`;

    // Clear cache cho ngày hiện tại
    this.cache.delete(cacheKey);

    // Clear tất cả cache cũ cho employee này
    this.clearOldDateCache(employeeCode);

    // Fetch lại data
    return await this.getTodayAttendance(employeeCode);
  }

  // Validate attendance record data
  private validateAttendanceRecord(record: any): record is AttendanceRecord {
    return (
      record &&
      typeof record._id === 'string' &&
      typeof record.employeeCode === 'string' &&
      typeof record.date === 'string' &&
      typeof record.totalCheckIns === 'number' &&
      typeof record.status === 'string'
    );
  }

  // Sanitize attendance data và remove duplicates
  private sanitizeAttendanceRecord(record: any): AttendanceRecord | null {
    if (!this.validateAttendanceRecord(record)) {
      console.warn('Invalid attendance record format:', record);
      return null;
    }

    // Remove duplicates from rawData if present
    let cleanRawData = Array.isArray(record.rawData) ? record.rawData : [];

    if (cleanRawData.length > 0) {
      const uniqueMap = new Map();
      const originalCount = cleanRawData.length;

      cleanRawData = cleanRawData.filter((item) => {
        const timestamp = new Date(item.timestamp).getTime();
        const deviceId = item.deviceId;
        const key = `${timestamp}-${deviceId}`;

        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, true);
          return true;
        }
        return false;
      });
    }

    // Recalculate totalCheckIns based on clean rawData
    const actualCheckIns = cleanRawData.length;

    // Recalculate check-in and check-out times based on clean data
    let checkInTime = record.checkInTime;
    let checkOutTime = record.checkOutTime;

    if (cleanRawData.length > 0) {
      const sortedData = cleanRawData.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      checkInTime = sortedData[0].timestamp;
      checkOutTime = sortedData[sortedData.length - 1].timestamp;

      if (sortedData.length === 1) {
        // If only one time entry, check-out same as check-in for now
        checkOutTime = checkInTime;
      }
    }

    return {
      ...record,
      checkInTime,
      checkOutTime,
      totalCheckIns: actualCheckIns, // Use actual count after deduplication
      rawData: cleanRawData,
    };
  }

  // Get current VN date string (YYYY-MM-DD)
  private getCurrentVNDateString(): string {
    const now = new Date();
    // Lấy thời gian VN hiện tại (UTC + 7h)
    const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);

    const year = vnTime.getUTCFullYear();
    const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(vnTime.getUTCDate()).padStart(2, '0');

    const dateString = `${year}-${month}-${day}`;

    return dateString;
  }

  // Lấy dữ liệu chấm công chi tiết với tất cả các lần check-in
  async getTodayAttendanceWithDetails(employeeCode: string): Promise<AttendanceRecord | null> {
    try {
      const headers = await this.getAuthHeaders();

      const todayDateString = this.getCurrentVNDateString();

      // Fix: Use correct BE API endpoint
      const response = await fetch(
        `${BASE_URL}/api/method/erp.api.attendance.query.get_employee_attendance_range` +
          `?employee_code=${encodeURIComponent(employeeCode)}&start_date=${todayDateString}&end_date=${todayDateString}&limit=1&include_raw_data=true`,
        { headers }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Failed to fetch detailed attendance: ${response.status}`);
      }

      const data = await response.json();

      // Fix: Parse response correctly - data is in message.data.records[0] (BE wraps in message object)
      const record = data?.message?.data?.records?.[0] || data?.data?.records?.[0] || null;

      return record;
    } catch (error) {
      console.error('Error fetching detailed attendance:', error);
      return null;
    }
  }

  // Lấy dữ liệu chấm công của nhân viên hiện tại cho ngày hôm nay (có cache)
  async getTodayAttendance(
    employeeCode: string,
    forceRefresh: boolean = false
  ): Promise<AttendanceRecord | null> {
    const todayDateString = this.getCurrentVNDateString();
    const cacheKey = `today-attendance-${employeeCode}-${todayDateString}`;

    // Check cache first (shorter cache for today data - 1 minute) - UNLESS force refresh
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 60000) {
        return cached.data;
      }
    } else {
      this.cache.delete(cacheKey);
    }

    try {
      const rawRecord = await this.retryApiCall(async () => {
        const headers = await this.getAuthHeaders();

        // Fix: Use correct BE API endpoint
        const apiUrl =
          `${BASE_URL}/api/method/erp.api.attendance.query.get_employee_attendance_range` +
          `?employee_code=${encodeURIComponent(employeeCode)}&start_date=${todayDateString}&end_date=${todayDateString}&limit=1`;

        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        // Fix: Parse response correctly - data is in message.data.records[0] (BE wraps in message object)
        const record = data?.message?.data?.records?.[0] || data?.data?.records?.[0] || null;

        return record;
      });

      // Sanitize and validate the record
      const record = rawRecord ? this.sanitizeAttendanceRecord(rawRecord) : null;

      // Cache the result
      this.setCachedData(cacheKey, record);

      return record;
    } catch (error) {
      return null;
    }
  }

  // Lấy dữ liệu chấm công theo khoảng thời gian
  async getAttendanceRecords(
    startDate?: string,
    endDate?: string,
    employeeCode?: string,
    page: number = 1,
    limit: number = 100
  ): Promise<AttendanceResponse | null> {
    try {
      const headers = await this.getAuthHeaders();

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy: 'date',
        sortOrder: 'desc',
      });

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (employeeCode) params.append('employeeCode', employeeCode);

      const response = await fetch(`${BASE_URL}/api/attendance/records?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch attendance records');
      }

      const data: AttendanceResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      return null;
    }
  }

  // Format thời gian hiển thị theo timezone VN
  formatTime(timeString?: string): string {
    if (!timeString) return '--:--';

    try {
      const date = new Date(timeString);

      // Kiểm tra nếu date không hợp lệ
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', timeString);
        return '--:--';
      }

      // FIXED: Backend now correctly returns UTC timestamps
      // Simple conversion: UTC + 7 hours = VN time
      const utcTime = new Date(timeString);
      const vnTime = new Date(utcTime.getTime() + 7 * 60 * 60 * 1000); // Add 7 hours

      const vnHours = vnTime.getUTCHours(); // Use UTC methods because we already added offset
      const vnMinutes = vnTime.getUTCMinutes();

      const result = `${String(vnHours).padStart(2, '0')}:${String(vnMinutes).padStart(2, '0')}`;

      return result;
    } catch (error) {
      console.error('Error formatting time:', error);
      return '--:--';
    }
  }

  // Format ngày hiển thị (YYYY-MM-DD -> DD/MM/YYYY)
  formatDate(dateString?: string): string {
    if (!dateString) return '--/--/----';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '--/--/----';
      }

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '--/--/----';
    }
  }

  // Format thời gian đầy đủ với ngày (DD/MM/YYYY HH:MM)
  formatDateTime(timeString?: string): string {
    if (!timeString) return '--/--/---- --:--';

    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) {
        return '--/--/---- --:--';
      }

      // Convert về VN time
      const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);

      const day = String(vnTime.getUTCDate()).padStart(2, '0');
      const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
      const year = vnTime.getUTCFullYear();
      const hours = String(vnTime.getUTCHours()).padStart(2, '0');
      const minutes = String(vnTime.getUTCMinutes()).padStart(2, '0');

      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      console.error('Error formatting datetime:', error);
      return '--/--/---- --:--';
    }
  }

  // Lấy tất cả timestamps từ rawData và format (đã remove duplicates)
  getRawAttendanceTimes(record: AttendanceRecord): string[] {
    if (!record.rawData || record.rawData.length === 0) {
      return [];
    }

    // Remove duplicates bằng cách dùng Set theo formatted time
    const uniqueTimes = new Set(record.rawData.map((item) => this.formatTime(item.timestamp)));

    return Array.from(uniqueTimes).sort(); // Sắp xếp theo thời gian
  }

  // Lấy raw timestamps với thông tin chi tiết để debug duplicates
  getRawAttendanceDetails(record: AttendanceRecord): {
    time: string;
    timestamp: string;
    deviceId: string;
    recordedAt: string;
  }[] {
    if (!record.rawData || record.rawData.length === 0) {
      return [];
    }

    return record.rawData
      .map((item) => ({
        time: this.formatTime(item.timestamp),
        timestamp: item.timestamp,
        deviceId: item.deviceId,
        recordedAt: item.recordedAt,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // Tính toán working hours (giờ làm việc)
  calculateWorkingHours(record: AttendanceRecord): string {
    if (!record.checkInTime || !record.checkOutTime) {
      return '--:--';
    }

    try {
      const checkIn = new Date(record.checkInTime);
      const checkOut = new Date(record.checkOutTime);

      if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
        return '--:--';
      }

      const diffMs = checkOut.getTime() - checkIn.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      return `${String(diffHours).padStart(2, '0')}:${String(diffMinutes).padStart(2, '0')}`;
    } catch (error) {
      console.error('Error calculating working hours:', error);
      return '--:--';
    }
  }

  // Force clear ALL attendance cache (for fixing data issues)
  forceCleanAllAttendanceCache(): void {
    const attendanceKeys: string[] = [];

    for (const [key] of this.cache) {
      if (key.includes('attendance-') || key.includes('today-attendance-')) {
        attendanceKeys.push(key);
      }
    }

    for (const key of attendanceKeys) {
      this.cache.delete(key);
    }
  }

  // ===== Teacher class assignments (homeroom/vice/teaching) =====
  async fetchCampuses(): Promise<{ name: string; title_vn?: string; title_en?: string }[]> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${BASE_URL}/api/method/erp.api.erp_sis.campus.get_campuses`, {
        headers,
      });
      if (!res.ok) return [];
      const data = await res.json();
      const rows = data?.data || data || [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      return [];
    }
  }
  async getAllClassesForCurrentCampus(): Promise<
    { name: string; title?: string; short_title?: string; class_name?: string }[]
  > {
    try {
      const headers = await this.getAuthHeaders();
      const campusId = (await AsyncStorage.getItem('currentCampusId')) || '';
      const url = new URL(`${BASE_URL}/api/method/erp.api.erp_sis.sis_class.get_all_classes`);
      // Note: get_all_classes doesn't accept page/limit parameters
      if (campusId) url.searchParams.set('campus_id', campusId);

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        const text = await res.text();
        return [];
      }
      const json = await res.json();

      // Parse response: check multiple possible locations
      let rows = [];
      if (json?.message?.data) {
        rows = json.message.data;
      } else if (json?.data) {
        rows = json.data;
      } else if (json?.message && Array.isArray(json.message)) {
        rows = json.message;
      }

      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      return [];
    }
  }
  async fetchTeacherClassAssignments(userId?: string): Promise<{
    homeroom_class_ids: string[];
    vice_homeroom_class_ids: string[];
    teaching_class_ids: string[];
  } | null> {
    try {
      const headers = await this.getAuthHeaders();
      const url = new URL(
        `${BASE_URL}/api/method/erp.api.erp_sis.teacher.get_teacher_class_assignments`
      );
      if (userId) url.searchParams.set('user_id', userId);
      try {
        const campusId = await AsyncStorage.getItem('currentCampusId');
        const selectedCampus = await AsyncStorage.getItem('selectedCampus');
      } catch {}
      const res = await fetch(url.toString(), { method: 'GET', headers });
      if (!res.ok) {
        const text = await res.text();
        return null;
      }
      const data = await res.json();
      try {
        const payload = (data && (data.data || data.message?.data)) || data;
        const out = {
          homeroom_class_ids: payload?.homeroom_class_ids || [],
          vice_homeroom_class_ids: payload?.vice_homeroom_class_ids || [],
          teaching_class_ids: payload?.teaching_class_ids || [],
        };
        if (
          out.homeroom_class_ids.length === 0 &&
          out.vice_homeroom_class_ids.length === 0 &&
          out.teaching_class_ids.length === 0
        ) {
          // Force fallback to FE-like logic when BE returns empty
          return null;
        }
        return out;
      } catch (e) {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  // FE-like logic: derive assignments by calling class list + teacher week
  private getCurrentWeekRange() {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const toIso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { weekStart: toIso(monday), weekEnd: toIso(sunday) };
  }

  async syncTeacherAssignmentsLikeWeb(userEmail: string): Promise<{
    homeroom_class_ids: string[];
    vice_homeroom_class_ids: string[];
    teaching_class_ids: string[];
    teacher_id?: string;
  } | null> {
    try {
      const headers = await this.getAuthHeaders();
      const campusId = (await AsyncStorage.getItem('currentCampusId')) || '';

      // 1) Resolve teacher_id by user email via get_all_teachers
      const tRes = await fetch(`${BASE_URL}/api/method/erp.api.erp_sis.teacher.get_all_teachers`, {
        headers,
      });
      if (!tRes.ok) {
        const txt = await tRes.text();
        return null;
      }
      const tJson = await tRes.json();
      const teacherList = (tJson && (tJson.data || tJson.message?.data)) || [];
      const norm = (s: any) =>
        String(s || '')
          .trim()
          .toLowerCase();
      const teacher = Array.isArray(teacherList)
        ? teacherList.find(
            (t: any) => norm(t?.user_id) === norm(userEmail) || norm(t?.email) === norm(userEmail)
          )
        : null;
      const teacherId: string = teacher?.name || teacher?.id || '';

      // 2) Fetch classes (all or large page)
      const classesUrl = new URL(
        `${BASE_URL}/api/method/erp.api.erp_sis.sis_class.get_all_classes`
      );
      classesUrl.searchParams.set('page', '1');
      classesUrl.searchParams.set('limit', '500');
      if (campusId) classesUrl.searchParams.set('campus_id', campusId);
      const cRes = await fetch(classesUrl.toString(), { headers });
      if (!cRes.ok) {
        const txt = await cRes.text();
        return null;
      }
      const cJson = await cRes.json();
      const classes = (cJson && (cJson.data || cJson.message?.data)) || [];

      // 3) Filter homeroom/vice by teacherId
      const homeroom_class_ids = classes
        .filter((c: any) => c?.homeroom_teacher === teacherId)
        .map((c: any) => String(c?.name || ''))
        .filter(Boolean);
      const vice_homeroom_class_ids = classes
        .filter((c: any) => c?.vice_homeroom_teacher === teacherId)
        .map((c: any) => String(c?.name || ''))
        .filter(Boolean);

      // 4) Fetch teacher week to compute teaching classes
      const { weekStart, weekEnd } = this.getCurrentWeekRange();
      const weekUrl = new URL(`${BASE_URL}/api/method/erp.api.erp_sis.timetable.get_teacher_week`);
      // FE passes user.email; BE resolves via user_id mapping
      weekUrl.searchParams.set('teacher_id', userEmail || teacherId);
      weekUrl.searchParams.set('week_start', weekStart);
      weekUrl.searchParams.set('week_end', weekEnd);
      if (campusId) weekUrl.searchParams.set('campus_id', campusId);
      const wRes = await fetch(weekUrl.toString(), { headers });
      let teaching_class_ids: string[] = [];
      if (wRes.ok) {
        const wJson = await wRes.json();
        try {
        } catch {}
        const entries = (wJson && (wJson.data || wJson.message?.data)) || [];
        teaching_class_ids = Array.from(
          new Set(entries.map((e: any) => String(e?.class_id || '')).filter(Boolean))
        );
      } else {
        const txt = await wRes.text();
      }

      const out = {
        homeroom_class_ids,
        vice_homeroom_class_ids,
        teaching_class_ids,
        teacher_id: teacherId,
      };
      return out;
    } catch (e) {
      return null;
    }
  }
}

export default new AttendanceService();
