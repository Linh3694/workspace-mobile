import { API_BASE_URL } from '../config/constants';

export const getAvatar = (user: { fullname: string; avatarUrl?: string } | null) => {
    if (!user) return 'https://ui-avatars.com/api/?name=Unknown';
    if (user.avatarUrl) {
        return `${API_BASE_URL}/uploads/Avatar/${user.avatarUrl}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullname)}`;
};