import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL } from '../config/constants';

// Tạo instance axios
const api = axios.create({
    baseURL: `${API_BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Thêm interceptor request để tự động thêm token vào mọi request
api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
            // Kiểm tra token hết hạn trước khi gửi request
            try {
                const decoded = jwtDecode(token);
                const currentTime = Date.now() / 1000;

                // Nếu token đã hết hạn, chuyển hướng về trang login
                if (decoded.exp && decoded.exp < currentTime) {
                    // Xóa token đã hết hạn
                    await AsyncStorage.removeItem('authToken');
                    await AsyncStorage.removeItem('user');
                    await AsyncStorage.removeItem('userId');
                    await AsyncStorage.removeItem('userFullname');
                    await AsyncStorage.removeItem('userRole');

                    // TODO: Chuyển hướng về trang đăng nhập (cần thiết lập hệ thống navigation global)
                    throw new Error('TOKEN_EXPIRED');
                }

                config.headers.Authorization = `Bearer ${token}`;
            } catch (error) {
                console.error('Token validation error:', error);
                // Không thêm token nếu không hợp lệ
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Thêm interceptor response để xử lý lỗi 401 (Unauthorized)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Nếu lỗi 401 (Unauthorized) và chưa thử lại
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Xóa token cũ
            await AsyncStorage.removeItem('authToken');
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('userId');
            await AsyncStorage.removeItem('userFullname');
            await AsyncStorage.removeItem('userRole');

            // TODO: Chuyển hướng về trang đăng nhập (cần thiết lập hệ thống navigation global)
            // Có thể sử dụng event hoặc context để thông báo cho app cần đăng xuất

            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

export default api;
