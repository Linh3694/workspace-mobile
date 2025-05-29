import { API_BASE_URL } from '../config/constants.js';

export const getAvatar = (user: { fullname: string; avatarUrl?: string; avatar?: string } | null) => {
    if (!user) {
        return 'https://ui-avatars.com/api/?name=Unknown&background=F97316&color=ffffff';
    }
    
    // Support both avatarUrl and avatar fields for backward compatibility
    const avatarPath = user.avatarUrl || user.avatar;
    
    if (avatarPath) {
        const fullAvatarUrl = `${API_BASE_URL}/uploads/Avatar/${avatarPath}`;
        return fullAvatarUrl;
    }
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullname)}&background=F97316&color=ffffff`;
    return fallbackUrl;
};