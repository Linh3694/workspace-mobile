import { API_BASE_URL } from '../config/constants.js';

export const getAvatar = (user: { fullname: string; avatarUrl?: string } | null) => {
    if (!user) {
        return 'https://ui-avatars.com/api/?name=Unknown&background=F97316&color=ffffff';
    }
    if (user.avatarUrl) {
        const fullAvatarUrl = `${API_BASE_URL}/uploads/Avatar/${user.avatarUrl}`;
        return fullAvatarUrl;
    }
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullname)}&background=F97316&color=ffffff`;
    return fallbackUrl;
};