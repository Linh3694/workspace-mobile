import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';

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
        return {
            'Authorization': `Bearer ${token}`,
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
                    console.log(`Retrying in ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    console.error(`All ${maxRetries} attempts failed`);
                }
            }
        }

        throw lastError!;
    }

    private getCachedData(key: string): any | null {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
            console.log(`Cache hit for key: ${key}`);
            return cached.data;
        }
        return null;
    }

    // Helper method để set cache
    private setCachedData(key: string, data: any): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    // Clear cache manually
    clearCache(): void {
        this.cache.clear();
        console.log('🗑️ Attendance cache cleared');
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

        keysToDelete.forEach(key => {
            this.cache.delete(key);
            console.log(`🗑️ Cleared old cache: ${key}`);
        });

        console.log(`🧹 Cleared ${keysToDelete.length} old cache entries for ${employeeCode}`);
    }

    // Debug method để xem tất cả cache keys
    debugCacheStatus(employeeCode: string): void {
        console.log('🔍 === CACHE DEBUG STATUS ===');
        console.log(`📅 Current VN Date: ${this.getCurrentVNDateString()}`);
        console.log(`👤 Employee Code: ${employeeCode}`);
        console.log(`📊 Total cache entries: ${this.cache.size}`);

        for (const [key, value] of this.cache) {
            if (key.includes(employeeCode)) {
                const age = (Date.now() - value.timestamp) / 1000;
                console.log(`🔑 ${key} | Age: ${age.toFixed(1)}s | Has Data: ${value.data ? 'YES' : 'NO'}`);
            }
        }
        console.log('=========================');
    }

    // Debug method để kiểm tra raw data
    debugAttendanceData(record: AttendanceRecord): void {
        console.log('🔍 === DEBUG ATTENDANCE RECORD ===');
        console.log('📋 Employee Code:', record.employeeCode);
        console.log('📅 Date:', record.date);
        console.log('⏰ Check In Time:', record.checkInTime);
        console.log('🏁 Check Out Time:', record.checkOutTime);
        console.log('🔢 Total Check Ins:', record.totalCheckIns);

        if (record.checkInTime) {
            console.log('🔄 Formatted Check In:', this.formatTime(record.checkInTime));
        }
        if (record.checkOutTime) {
            console.log('🔄 Formatted Check Out:', this.formatTime(record.checkOutTime));
        }

        if (record.rawData && record.rawData.length > 0) {
            console.log('📊 Raw Data Count:', record.rawData.length);
            console.log('📊 First Raw Timestamp:', record.rawData[0].timestamp);
            console.log('📊 Last Raw Timestamp:', record.rawData[record.rawData.length - 1].timestamp);

            // Analyze for duplicates
            this.debugDuplicateAttendance(record);

            // Show unique times
            const uniqueTimes = this.getRawAttendanceTimes(record);
            console.log('✅ Unique formatted times:', uniqueTimes);
        } else {
            console.log('❌ No rawData available');
        }
        console.log('=================================');
    }

    // Method để force refresh data (clear cache và fetch lại)
    async forceRefreshTodayAttendance(employeeCode: string): Promise<AttendanceRecord | null> {
        const todayDateString = this.getCurrentVNDateString();
        const cacheKey = `today-attendance-${employeeCode}-${todayDateString}`;

        console.log(`🔄 Force refreshing attendance for ${employeeCode} on ${todayDateString}`);

        // Clear cache cho ngày hiện tại
        this.cache.delete(cacheKey);
        console.log(`🗑️ Cleared current cache: ${cacheKey}`);

        // Clear tất cả cache cũ cho employee này
        this.clearOldDateCache(employeeCode);

        // Debug cache status
        this.debugCacheStatus(employeeCode);

        // Fetch lại data
        console.log(`📞 Fetching fresh data...`);
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

            cleanRawData = cleanRawData.filter(item => {
                const timestamp = new Date(item.timestamp).getTime();
                const deviceId = item.deviceId;
                const key = `${timestamp}-${deviceId}`;

                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, true);
                    return true;
                }
                return false;
            });

            if (originalCount !== cleanRawData.length) {
                console.log(`🧹 Frontend cleanup: ${originalCount} → ${cleanRawData.length} rawData entries`);
            }
        }

        // Recalculate totalCheckIns based on clean rawData
        const actualCheckIns = cleanRawData.length;

        // Recalculate check-in and check-out times based on clean data
        let checkInTime = record.checkInTime;
        let checkOutTime = record.checkOutTime;

        if (cleanRawData.length > 0) {
            const sortedData = cleanRawData.sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
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
            rawData: cleanRawData
        };
    }

    // Get current VN date string (YYYY-MM-DD)
    private getCurrentVNDateString(): string {
        const now = new Date();

        // Debug current time
        console.log(`🕐 Current UTC time: ${now.toISOString()}`);
        console.log(`🕐 Current local time: ${now.toString()}`);

        // Lấy thời gian VN hiện tại (UTC + 7h)
        const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        console.log(`🇻🇳 VN time: ${vnTime.toISOString()}`);

        const year = vnTime.getUTCFullYear();
        const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(vnTime.getUTCDate()).padStart(2, '0');

        const dateString = `${year}-${month}-${day}`;
        console.log(`📅 Generated VN date string: ${dateString}`);

        return dateString;
    }

    // Lấy dữ liệu chấm công chi tiết với tất cả các lần check-in
    async getTodayAttendanceWithDetails(employeeCode: string): Promise<AttendanceRecord | null> {
        try {
            const headers = await this.getAuthHeaders();
            
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayDateString = `${year}-${month}-${day}`;
            


            const response = await fetch(
                `${API_BASE_URL}/api/attendance/employee/${employeeCode}` +
                `?date=${encodeURIComponent(todayDateString)}&includeRawData=true`,
                { headers }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`Failed to fetch detailed attendance: ${response.status}`);
            }

            const data = await response.json();
            const record = data.data?.records?.[0] || null;
            
            return record;
        } catch (error) {
            console.error('Error fetching detailed attendance:', error);
            return null;
        }
    }

    // Lấy dữ liệu chấm công của nhân viên hiện tại cho ngày hôm nay (có cache)
    async getTodayAttendance(employeeCode: string): Promise<AttendanceRecord | null> {
        const todayDateString = this.getCurrentVNDateString();
        const cacheKey = `today-attendance-${employeeCode}-${todayDateString}`;

        console.log(`🔍 Fetching attendance for employee: ${employeeCode} on date: ${todayDateString}`);
        console.log(`🔑 Cache key: ${cacheKey}`);

        // Check cache first (shorter cache for today data - 1 minute)
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < 60000) { // 1 phút cache cho data hôm nay
            console.log(`✅ Cache hit for today attendance: ${employeeCode}`);
            return cached.data;
        } else if (cached) {
            console.log(`❌ Cache expired for: ${cacheKey}, age: ${(Date.now() - cached.timestamp) / 1000}s`);
        } else {
            console.log(`❌ No cache found for: ${cacheKey}`);
        }

        try {
            console.log(`🌐 Making API call for date: ${todayDateString}`);
            const rawRecord = await this.retryApiCall(async () => {
                const headers = await this.getAuthHeaders();

                const apiUrl = `${API_BASE_URL}/api/attendance/employee/${employeeCode}?date=${encodeURIComponent(todayDateString)}`;
                console.log(`📞 API URL: ${apiUrl}`);

                const response = await fetch(apiUrl, { headers });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API Error ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                console.log(`📊 API Response:`, data);

                const record = data.data?.records?.[0] || null;
                console.log(`📋 Found record:`, record ? 'YES' : 'NO');

                return record;
            });

            // Sanitize and validate the record
            const record = rawRecord ? this.sanitizeAttendanceRecord(rawRecord) : null;

            // Cache the result
            this.setCachedData(cacheKey, record);

            if (record) {
                console.log(`✅ Successfully fetched attendance for ${todayDateString}`);
                this.debugAttendanceData(record);
            } else {
                console.log(`❌ No attendance record found for ${todayDateString}`);
            }

            return record;

        } catch (error) {
            console.error('❌ Error fetching today attendance:', error);
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
                sortOrder: 'desc'
            });

            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (employeeCode) params.append('employeeCode', employeeCode);

            const response = await fetch(
                `${API_BASE_URL}/api/attendance/records?${params.toString()}`,
                { headers }
            );

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
            
            // Debug log để trace vấn đề
            console.log(`🕐 Formatting time: ${timeString}`);
            console.log(`📅 Parsed date: ${date.toISOString()}`);

            // Từ data thực tế, backend đang lưu thời gian VN như UTC
            // Ví dụ: 09:00:20 VN time được lưu thành 2025-05-26T09:00:20.000Z
            // Nên ta chỉ cần lấy UTC hours/minutes trực tiếp
            const hours = date.getUTCHours();
            const minutes = date.getUTCMinutes();

            const result = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            console.log(`⏰ Formatted result: ${result}`);

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
            const vnTime = new Date(date.getTime() + (7 * 60 * 60 * 1000));

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
        const uniqueTimes = new Set(
            record.rawData.map(item => this.formatTime(item.timestamp))
        );

        return Array.from(uniqueTimes).sort(); // Sắp xếp theo thời gian
    }

    // Lấy raw timestamps với thông tin chi tiết để debug duplicates
    getRawAttendanceDetails(record: AttendanceRecord): Array<{
        time: string;
        timestamp: string;
        deviceId: string;
        recordedAt: string;
    }> {
        if (!record.rawData || record.rawData.length === 0) {
            return [];
        }

        return record.rawData.map(item => ({
            time: this.formatTime(item.timestamp),
            timestamp: item.timestamp,
            deviceId: item.deviceId,
            recordedAt: item.recordedAt
        })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }

    // Debug duplicates trong rawData
    debugDuplicateAttendance(record: AttendanceRecord): void {
        if (!record.rawData || record.rawData.length === 0) return;

        console.log('🔍 === DUPLICATE ANALYSIS ===');
        console.log(`👤 Employee: ${record.employeeCode}`);
        console.log(`📅 Date: ${record.date}`);
        console.log(`📊 Total rawData entries: ${record.rawData.length}`);
        console.log(`📊 Reported totalCheckIns: ${record.totalCheckIns}`);

        // Group by formatted time
        const timeGroups = new Map<string, any[]>();

        record.rawData.forEach(item => {
            const formattedTime = this.formatTime(item.timestamp);
            if (!timeGroups.has(formattedTime)) {
                timeGroups.set(formattedTime, []);
            }
            timeGroups.get(formattedTime)!.push(item);
        });

        console.log(`🕐 Unique times: ${timeGroups.size}`);

        // Show duplicates
        for (const [time, items] of timeGroups) {
            if (items.length > 1) {
                console.log(`⚠️  DUPLICATE TIME: ${time} (${items.length} entries)`);
                items.forEach((item, index) => {
                    console.log(`   ${index + 1}. Device: ${item.deviceId}, Recorded: ${item.recordedAt}`);
                });
            }
        }

        console.log('===========================');
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


}

export default new AttendanceService(); 