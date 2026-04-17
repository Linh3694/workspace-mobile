import { API_BASE_URL } from '../config/constants.js';

/**
 * Chuẩn hoá user_image từ Frappe (/files/..., files/..., Avatar/...) → URL đầy đủ cho <Image source={{ uri }} />.
 * Trả rỗng nếu không có path (UI dùng chữ cái thay thế).
 */
export function resolveFrappeUserImageUrl(path?: string | null): string {
  if (!path?.trim()) return '';
  const raw = path.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`;
  if (raw.startsWith('files/')) return `${API_BASE_URL}/${raw}`;
  if (raw.startsWith('Avatar/')) return `${API_BASE_URL}/files/${raw}`;
  if (raw.includes('/')) {
    const normalized =
      raw.startsWith('files/') || raw.startsWith('public/files/') ? raw : `files/${raw}`;
    return `${API_BASE_URL}/${normalized}`;
  }
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(raw)) return `${API_BASE_URL}/files/${raw}`;
  return `${API_BASE_URL}/files/Avatar/${raw}`;
}

export const getAvatar = (
  user: { fullname: string; avatarUrl?: string; avatar?: string } | null
) => {
  if (!user) {
    return 'https://ui-avatars.com/api/?name=Unknown&background=F97316&color=ffffff';
  }

  const maybeAddCacheBust = (url: string) => {
    try {
      const cacheBust = (user as any).avatar_cache_bust || (user as any).avatarVersion;
      if (!cacheBust) return url;
      const hasQuery = url.includes('?');
      const sep = hasQuery ? '&' : '?';
      return `${url}${sep}v=${encodeURIComponent(String(cacheBust))}`;
    } catch {
      return url;
    }
  };

  // Support both avatarUrl and avatar fields for backward compatibility
  const avatarPath =
    (user as any).avatarUrl ||
    (user as any).avatar_url ||
    (user as any).user_image ||
    (user as any).avatar;

  if (avatarPath && avatarPath.trim()) {
    const raw = avatarPath.trim();

    // Full URL already
    if (/^https?:\/\//i.test(raw)) {
      return maybeAddCacheBust(raw);
    }

    // Already absolute path
    if (raw.startsWith('/')) {
      return maybeAddCacheBust(`${API_BASE_URL}${raw}`);
    }

    // Starts with files/...
    if (raw.startsWith('files/')) {
      return maybeAddCacheBust(`${API_BASE_URL}/${raw}`);
    }

    // Starts with Avatar/... (missing files prefix)
    if (raw.startsWith('Avatar/')) {
      return maybeAddCacheBust(`${API_BASE_URL}/files/${raw}`);
    }

    // If it already contains a path segment, just prefix with base
    if (raw.includes('/')) {
      // Ensure it has files/ prefix if looks like a frappe file path without leading directory
      const normalized =
        raw.startsWith('files/') || raw.startsWith('public/files/') ? raw : `files/${raw}`;
      return maybeAddCacheBust(`${API_BASE_URL}/${normalized}`);
    }

    // Plain filename (no path): prefer /files/<filename>
    // Detect common image extensions
    const isLikelyImageFile = /\.(png|jpe?g|gif|webp|svg)$/i.test(raw);
    if (isLikelyImageFile) {
      return maybeAddCacheBust(`${API_BASE_URL}/files/${raw}`);
    }

    // Fallback default location under files/Avatar
    return maybeAddCacheBust(`${API_BASE_URL}/files/Avatar/${raw}`);
  }

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullname)}&background=F97316&color=ffffff`;
  return maybeAddCacheBust(fallbackUrl);
};
