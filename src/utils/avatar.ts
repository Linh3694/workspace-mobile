import { API_BASE_URL } from '../config/constants.js';

export const getAvatar = (
  user: { fullname: string; avatarUrl?: string; avatar?: string } | null
) => {
  if (!user) {
    return 'https://ui-avatars.com/api/?name=Unknown&background=F97316&color=ffffff';
  }

  // Support both avatarUrl and avatar fields for backward compatibility
  const avatarPath = user.avatarUrl || user.avatar;

  // Only log once per user to avoid spam
  if (!user.__avatarLogged) {
    console.log('🖼️ [getAvatar] User avatar data:', {
      fullname: user.fullname,
      avatarUrl: user.avatarUrl,
      avatar: user.avatar,
      avatarPath,
    });
    user.__avatarLogged = true;
  }

  if (avatarPath && avatarPath.trim()) {
    // If it's already a full URL (starts with http), return as is
    if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
      return avatarPath;
    }

    // If it starts with /files/, it's already a full path from backend
    if (avatarPath.startsWith('/files/')) {
      return `${API_BASE_URL}${avatarPath}`;
    }

    // Legacy support for old format
    if (avatarPath.includes('/Avatar/')) {
      return `${API_BASE_URL}${avatarPath}`;
    }

    // Default format for new backend API
    const fullAvatarUrl = `${API_BASE_URL}/files/Avatar/${avatarPath}`;
    return fullAvatarUrl;
  }

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullname)}&background=F97316&color=ffffff`;
  return fallbackUrl;
};
