import type { GroupChatMember } from './groupChatAvatarLayout';
import { BASE_URL } from '../../../config/constants';

/**
 * Nối đường dẫn ảnh Frappe (/files/...) thành URL đầy đủ — RN Image không load path tương đối.
 */
export function resolveParticipantAvatarUrl(
  raw: string | null | undefined,
  seedForFallback: string
): string {
  const image = String(raw ?? '').trim();
  if (!image) {
    const seed = encodeURIComponent(seedForFallback?.trim() || 'user');
    return `https://ui-avatars.com/api/?name=${seed}&background=F97316&color=fff`;
  }
  if (/^(https?:|data:)/i.test(image)) return image;
  if (image.startsWith('//')) return `https:${image}`;
  const base = String(BASE_URL || '').replace(/\/+$/, '');
  const path = image.startsWith('/') ? image : `/${image}`;
  return `${base}${path}`;
}

/** URI avatar thành viên nhóm — dùng cho header + bubble đối phương. */
export function memberToAvatarUri(m: GroupChatMember): string {
  return resolveParticipantAvatarUrl(m.avatarUrl, m.emailNorm || m.name || 'user');
}
