import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import api from '../utils/api';
import * as SecureStore from 'expo-secure-store';
import { disconnectAllSockets } from '../services/socketService';

// Khóa cho thông tin đăng nhập sinh trắc học
const CREDENTIALS_KEY = 'WELLSPRING_SECURE_CREDENTIALS';

type AuthContextType = {
    isAuthenticated: boolean;
    loading: boolean;
    user: any;
    login: (token: string, userData: any) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<boolean>;
    clearBiometricCredentials: () => Promise<void>;
    refreshUserData: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async (): Promise<boolean> => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');

            if (!token) {
                setLoading(false);
                return false;
            }

            // Kiểm tra token còn hạn không
            try {
                const decoded: any = jwtDecode(token);
                const currentTime = Date.now() / 1000;

                if (decoded.exp && decoded.exp < currentTime) {
                    // Token đã hết hạn
                    await logout();
                    setLoading(false);
                    return false;
                }

                // Nếu token còn hạn, lấy thông tin user từ AsyncStorage
                const userStr = await AsyncStorage.getItem('user');
                if (userStr) {
                    const userData = JSON.parse(userStr);
                    setUser(userData);
                    setLoading(false);
                    return true;
                } else {
                    // Nếu không có thông tin user, lấy từ API
                    try {
                        const response = await api.get('/users');

                        if (response.data.success) {
                            const userData = response.data.user;
                            setUser(userData);
                            await AsyncStorage.setItem('user', JSON.stringify(userData));
                            await AsyncStorage.setItem('userId', userData._id);
                            await AsyncStorage.setItem('userFullname', userData.fullname);
                            await AsyncStorage.setItem('userRole', userData.role || 'user');
                            await AsyncStorage.setItem('userJobTitle', userData.jobTitle || 'N/A');
                            await AsyncStorage.setItem('userEmployeeCode', userData.employeeCode || '');
                            await AsyncStorage.setItem('userAvatarUrl', userData.avatarUrl || '');
                            setLoading(false);
                            return true;
                        }
                    } catch (error) {
                        console.error('Lỗi khi lấy thông tin người dùng:', error);
                        await logout();
                        setLoading(false);
                        return false;
                    }
                }
            } catch (error) {
                console.error('Token decode error:', error);
                await logout();
                setLoading(false);
                return false;
            }
        } catch (error) {
            console.error('Lỗi kiểm tra trạng thái auth:', error);
            await logout();
            setLoading(false);
            return false;
        }

        setLoading(false);
        return false;
    };

    const login = async (token: string, userData: any) => {
        try {
            setLoading(true);
            // Lưu token
            await AsyncStorage.setItem('authToken', token);

            // Lưu thông tin user
            if (userData) {
                await AsyncStorage.setItem('user', JSON.stringify(userData));
                await AsyncStorage.setItem('userId', userData._id || userData.id);
                await AsyncStorage.setItem('userFullname', userData.fullname);
                await AsyncStorage.setItem('userEmployeeCode', userData.employeeCode || '');
                const role = userData.role || 'user';
                await AsyncStorage.setItem('userRole', role);
                await AsyncStorage.setItem('userAvatarUrl', userData.avatarUrl || '');
                setUser(userData);
            }
        } catch (error) {
            console.error('Lỗi khi đăng nhập:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            setLoading(true);
            // Disconnect tất cả socket connections
            disconnectAllSockets();
            
            // Xóa các thông tin
            await AsyncStorage.removeItem('authToken');
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('userId');
            await AsyncStorage.removeItem('userFullname');
            await AsyncStorage.removeItem('userRole');
            await AsyncStorage.removeItem('userEmployeeCode');
            await AsyncStorage.removeItem('userAvatarUrl');
            setUser(null);
        } catch (error) {
            console.error('Lỗi khi đăng xuất:', error);
        } finally {
            setLoading(false);
        }
    };

    // Hàm xóa thông tin đăng nhập sinh trắc học (chỉ gọi khi muốn xóa thủ công)
    const clearBiometricCredentials = async () => {
        try {
            await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
            console.log('Đã xóa thông tin đăng nhập FaceID/TouchID');
        } catch (error) {
            console.error('Lỗi khi xóa thông tin đăng nhập FaceID/TouchID:', error);
        }
    };

    const refreshUserData = async () => {
        try {
            console.log('=== Refreshing User Data ===');
            const response = await api.get('/users');
            console.log('Refresh API response:', response.data);
            if (response.data.success) {
                const userData = response.data.user;
                console.log('Refreshed user data:', userData);
                console.log('Refreshed avatar URL:', userData.avatarUrl);
                setUser(userData);
                await AsyncStorage.setItem('user', JSON.stringify(userData));
                await AsyncStorage.setItem('userId', userData._id);
                await AsyncStorage.setItem('userFullname', userData.fullname);
                await AsyncStorage.setItem('userRole', userData.role || 'user');
                await AsyncStorage.setItem('userJobTitle', userData.jobTitle || 'N/A');
                await AsyncStorage.setItem('userEmployeeCode', userData.employeeCode || '');
            }
        } catch (error) {
            console.error('Lỗi khi lấy thông tin người dùng:', error);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAuthenticated: !!user,
            login,
            logout,
            checkAuth,
            clearBiometricCredentials,
            refreshUserData
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth phải được sử dụng trong AuthProvider');
    }
    return context;
};
