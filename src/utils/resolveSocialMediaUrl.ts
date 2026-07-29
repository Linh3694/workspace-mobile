/**
 * Chuẩn hoá URL media social (ảnh/video Bảng tin).
 *
 * Backend (CDN on) trả URL tuyệt đối đã ký; CDN off trả path `/api/social/uploads/...`.
 * Phải giữ nguyên http(s) — không ghép base (tránh URL kép).
 *
 * Đồng bộ logic với frappe-sis-frontend `packages/core/src/utils/resolveSocialMediaUrl.ts`.
 */
export function resolveSocialMediaUrl(
  path: string | null | undefined,
  baseUrl: string
): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
