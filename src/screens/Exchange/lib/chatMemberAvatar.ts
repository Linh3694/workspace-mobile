import type { GroupChatMember } from './groupChatAvatarLayout';
import { BASE_URL } from '../../../config/constants';

/**
 * Nối đường dẫn ảnh Frappe (/files/...) thành URL đầy đủ — RN Image không load path tương đối.
 * Có `seedForFallback` ⇒ ui-avatars khi thiếu ảnh (màn thành viên…).
 * Không seed ⇒ trả '' để UI tự vẽ initials (tránh nhầm mã lớp N0/T0).
 */
export function resolveParticipantAvatarUrl(
  raw: string | null | undefined,
  seedForFallback?: string
): string {
  const image = String(raw ?? '').trim();
  if (!image) {
    const seed = String(seedForFallback || '').trim();
    if (!seed) return '';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(seed)}&background=F97316&color=fff`;
  }
  if (/^(https?:|data:)/i.test(image)) return image;
  if (image.startsWith('//')) return `https:${image}`;
  const base = String(BASE_URL || '').replace(/\/+$/, '');
  const path = image.startsWith('/') ? image : `/${image}`;
  return `${base}${path}`;
}

/** URI ảnh thật của thành viên nhóm — rỗng khi không có ảnh (GroupChatAvatar vẽ initials). */
export function memberToAvatarUri(m: GroupChatMember): string {
  return resolveParticipantAvatarUrl(m.avatarUrl);
}
