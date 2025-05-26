import { User } from '../navigation/AppNavigator';
import { API_BASE_URL } from '../config/constants';
import { getAvatar } from './avatar';

export const formatMessageTime = (timestamp: string): string => {
    const messageDate = new Date(timestamp);
    // Format giờ (HH:MM)
    const hours = messageDate.getHours().toString().padStart(2, '0');
    const minutes = messageDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

export const formatMessageDate = (timestamp: string): string => {
    const messageDate = new Date(timestamp);
    const now = new Date();

    // Format ngày tháng
    const day = messageDate.getDate().toString().padStart(2, '0');
    const month = (messageDate.getMonth() + 1).toString().padStart(2, '0');

    if (messageDate.toDateString() === now.toDateString()) {
        return `Hôm nay, ${day} tháng ${month}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
        return `Hôm qua, ${day} tháng ${month}`;
    }

    const diff = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 7) {
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        return `${days[messageDate.getDay()]}, ${day} tháng ${month}`;
    }

    // Hiển thị ngày đầy đủ
    return `Thứ ${messageDate.getDay() + 1}, ${day} tháng ${month}`;
};



// Kiểm tra 2 tin nhắn có khác ngày không
export const isDifferentDay = (timestamp1: string, timestamp2: string): boolean => {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    return date1.toDateString() !== date2.toDateString();
};

// Re-export getAvatar function for backward compatibility
export { getAvatar }; 