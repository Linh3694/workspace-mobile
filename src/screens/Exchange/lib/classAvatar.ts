/**
 * Nhãn + màu nền vòng tròn avatar lớp — đồng bộ 1-1 với `GroupChatAvatar` bên web
 * (frappe-sis-frontend), để một lớp trông giống nhau ở cả web và app.
 */

/** Bảng màu ổn định cho avatar lớp (chọn theo hash classId). */
const CLASS_AVATAR_COLORS = [
  '#F97316',
  '#2563EB',
  '#16A34A',
  '#9333EA',
  '#DB2777',
  '#0891B2',
  '#CA8A04',
  '#EA580C',
];

export function classAvatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CLASS_AVATAR_COLORS[h % CLASS_AVATAR_COLORS.length];
}

/** Chữ cái đầu của từ đầu + từ cuối (tối đa 2 ký tự) — giống `getInitials` bên web. */
function getInitials(fullname?: string | null): string {
  const trimmed = String(fullname || '').trim();
  if (!trimmed) return '??';
  const words = trimmed.split(' ').filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) {
    return words[0].length >= 2
      ? words[0].substring(0, 2).toUpperCase()
      : `${words[0].charAt(0).toUpperCase()}?`;
  }
  return `${words[0].charAt(0).toUpperCase()}${words[words.length - 1].charAt(0).toUpperCase()}`;
}

/** Nhãn ngắn cho avatar lớp: mã lớp ngắn hiển thị nguyên (11AI); tên dài → initials. */
export function classAvatarLabel(className?: string): string {
  const raw = (className || '').replace(/^Lớp\s+/i, '').trim();
  if (!raw) return 'L';
  if (raw.length <= 5) return raw.toUpperCase();
  return getInitials(raw);
}

/** Cỡ chữ theo độ dài nhãn để không tràn khung (giống web). */
export function classAvatarFontSize(size: number, label: string): number {
  const ratio = label.length >= 5 ? 0.24 : label.length === 4 ? 0.3 : 0.36;
  return Math.round(size * ratio);
}
