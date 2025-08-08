import { API_BASE_URL } from '../config/constants.js';

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
      const finalUrl = encodeURI(`${raw}`);
      console.log('[Avatar][getAvatar]', {
        raw,
        finalUrl,
        from: {
          avatarUrl: (user as any).avatarUrl,
          avatar_url: (user as any).avatar_url,
          user_image: (user as any).user_image,
          avatar: (user as any).avatar,
        },
      });
      return maybeAddCacheBust(finalUrl);
    }

    // Already absolute path
    if (raw.startsWith('/')) {
      const finalUrl = encodeURI(`${API_BASE_URL}${raw}`);
      console.log('[Avatar][getAvatar]', {
        raw,
        finalUrl,
        from: {
          avatarUrl: (user as any).avatarUrl,
          avatar_url: (user as any).avatar_url,
          user_image: (user as any).user_image,
          avatar: (user as any).avatar,
        },
      });
      return maybeAddCacheBust(finalUrl);
    }

    // Starts with files/...
    if (raw.startsWith('files/')) {
      const finalUrl = encodeURI(`${API_BASE_URL}/${raw}`);
      console.log('[Avatar][getAvatar]', {
        raw,
        finalUrl,
        from: {
          avatarUrl: (user as any).avatarUrl,
          avatar_url: (user as any).avatar_url,
          user_image: (user as any).user_image,
          avatar: (user as any).avatar,
        },
      });
      return maybeAddCacheBust(finalUrl);
    }

    // Starts with Avatar/... (missing files prefix)
    if (raw.startsWith('Avatar/')) {
      const finalUrl = encodeURI(`${API_BASE_URL}/files/${raw}`);
      console.log('[Avatar][getAvatar]', {
        raw,
        finalUrl,
        from: {
          avatarUrl: (user as any).avatarUrl,
          avatar_url: (user as any).avatar_url,
          user_image: (user as any).user_image,
          avatar: (user as any).avatar,
        },
      });
      return maybeAddCacheBust(finalUrl);
    }

    // If it already contains a path segment, just prefix with base
    if (raw.includes('/')) {
      // Ensure it has files/ prefix if looks like a frappe file path without leading directory
      const normalized =
        raw.startsWith('files/') || raw.startsWith('public/files/') ? raw : `files/${raw}`;
      const finalUrl = encodeURI(`${API_BASE_URL}/${normalized}`);
      console.log('[Avatar][getAvatar]', {
        raw,
        finalUrl,
        from: {
          avatarUrl: (user as any).avatarUrl,
          avatar_url: (user as any).avatar_url,
          user_image: (user as any).user_image,
          avatar: (user as any).avatar,
        },
      });
      return maybeAddCacheBust(finalUrl);
    }

    // Plain filename (no path): prefer /files/<filename>
    // Detect common image extensions
    const isLikelyImageFile = /\.(png|jpe?g|gif|webp|svg)$/i.test(raw);
    if (isLikelyImageFile) {
      const finalUrl = encodeURI(`${API_BASE_URL}/files/${raw}`);
      console.log('[Avatar][getAvatar]', {
        raw,
        finalUrl,
        from: {
          avatarUrl: (user as any).avatarUrl,
          avatar_url: (user as any).avatar_url,
          user_image: (user as any).user_image,
          avatar: (user as any).avatar,
        },
      });
      return maybeAddCacheBust(finalUrl);
    }

    // Fallback default location under files/Avatar
    const finalUrl = encodeURI(`${API_BASE_URL}/files/Avatar/${raw}`);
    console.log('[Avatar][getAvatar]', {
      raw,
      finalUrl,
      from: {
        avatarUrl: (user as any).avatarUrl,
        avatar_url: (user as any).avatar_url,
        user_image: (user as any).user_image,
        avatar: (user as any).avatar,
      },
    });
    return maybeAddCacheBust(finalUrl);
  }

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullname)}&background=F97316&color=ffffff`;
  return maybeAddCacheBust(fallbackUrl);
};
