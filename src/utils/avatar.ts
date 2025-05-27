import { API_BASE_URL } from '../config/constants.js';

export const getAvatar = (user: { fullname: string; avatarUrl?: string } | null) => {
    console.log('=== Avatar Debug ===');
    console.log('User object:', user);
    console.log('API_BASE_URL:', API_BASE_URL);

    if (!user) {
        console.log('No user, returning default avatar');
        return 'https://ui-avatars.com/api/?name=Unknown&background=F97316&color=ffffff';
    }

    console.log('User avatarUrl:', user.avatarUrl);

    if (user.avatarUrl) {
        const fullAvatarUrl = `${API_BASE_URL}/uploads/Avatar/${user.avatarUrl}`;
        console.log('Full avatar URL:', fullAvatarUrl);
        return fullAvatarUrl;
    }

    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullname)}&background=F97316&color=ffffff`;
    console.log('Using fallback URL:', fallbackUrl);
    return fallbackUrl;
};