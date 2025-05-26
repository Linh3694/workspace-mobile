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

class AttendanceService {
    private async getAuthHeaders() {
        const token = await AsyncStorage.getItem('authToken');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
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

    // Lấy dữ liệu chấm công của nhân viên hiện tại cho ngày hôm nay
    async getTodayAttendance(employeeCode: string): Promise<AttendanceRecord | null> {
        try {
            const headers = await this.getAuthHeaders();
            
            // Tạo date range cho ngày hôm nay theo timezone local
            // Không dùng toISOString() để tránh convert sang UTC
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            
            // Tạo date string dạng YYYY-MM-DD để backend có thể parse đúng
            const todayDateString = `${year}-${month}-${day}`;
            


            const response = await fetch(
                `${API_BASE_URL}/api/attendance/employee/${employeeCode}` +
                `?date=${encodeURIComponent(todayDateString)}`,
                { headers }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`Failed to fetch today attendance: ${response.status}`);
            }

            const data = await response.json();
            
            // Trả về record đầu tiên (ngày hôm nay) hoặc null nếu không có
            const record = data.data?.records?.[0] || null;
            return record;
        } catch (error) {
            console.error('Error fetching today attendance:', error);
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

    // Format thời gian hiển thị (từ ISO string thành HH:MM)
    formatTime(timeString?: string): string {
        if (!timeString) return '--:--';

        try {
            const date = new Date(timeString);
            
            // Kiểm tra nếu date không hợp lệ
            if (isNaN(date.getTime())) {
                console.warn('Invalid date string:', timeString);
                return '--:--';
            }
            
            // Vì dữ liệu trong DB có thể là thời gian VN được lưu như UTC
            // Ta cần xử lý đặc biệt: coi thời gian UTC như thời gian VN
            const utcHours = date.getUTCHours();
            const utcMinutes = date.getUTCMinutes();
            
            // Format trực tiếp từ UTC time (vì nó thực ra là VN time)
            return `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
        } catch (error) {
            console.error('Error formatting time:', error);
            return '--:--';
        }
    }


}

export default new AttendanceService(); 