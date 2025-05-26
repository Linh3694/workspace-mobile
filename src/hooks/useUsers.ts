// hooks/useUsers.ts
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';

export interface User {
    _id: string;
    fullname: string;
    avatarUrl?: string;
    department?: string;
}

const USERS_CACHE_KEY = '@users_cache';
const CACHE_EXPIRY = 3600000; // 1 giờ

export const useUsers = (department?: string) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                // Thử lấy từ cache trước
                const cacheKey = department ? `${USERS_CACHE_KEY}_${department}` : USERS_CACHE_KEY;
                const cachedData = await AsyncStorage.getItem(cacheKey);
                if (cachedData) {
                    const { data, timestamp } = JSON.parse(cachedData);
                    if (Date.now() - timestamp < CACHE_EXPIRY) {
                        setUsers(data);
                        setLoading(false);
                        return;
                    }
                }

                // Nếu không có trong cache hoặc cache đã hết hạn, gọi API
                const token = await AsyncStorage.getItem('authToken');
                const url = department
                    ? `${API_BASE_URL}/api/users/department/${department}`
                    : `${API_BASE_URL}/api/users`;
                const response = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                const usersData = data.users || data;
                setUsers(usersData);

                // Lưu vào cache với timestamp
                await AsyncStorage.setItem(cacheKey, JSON.stringify({
                    data: usersData,
                    timestamp: Date.now()
                }));
            } catch (error) {
                console.error('Lỗi khi lấy danh sách người dùng:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, [department]);

    return { users, loading };
};