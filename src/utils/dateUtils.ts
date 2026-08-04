/** "YYYY-MM-DD" hoặc "YYYY-MM-DD HH:mm:ss[.ffffff]" (định dạng Frappe trả về) */
const SERVER_DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?/;

/**
 * Dựng Date từ chuỗi server theo giờ máy, không đi qua UTC.
 *
 * `new Date('2026-08-03')` được JS hiểu là 00:00 UTC nên máy ở múi giờ âm hiển
 * thị lùi 1 ngày; chuỗi "YYYY-MM-DD HH:mm:ss" thì Hermes có thể trả Invalid Date.
 * Server gửi ngày-thuần và giờ VN dạng "wall clock" → lấy đúng thành phần y/m/d.
 */
export const parseServerDate = (value?: string | null): Date | null => {
  if (!value) return null;

  const trimmed = value.trim();
  // Chuỗi có sẵn timezone (…Z hoặc …+07:00) là mốc tuyệt đối — để JS tự xử lý
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const match = hasTimezone ? null : SERVER_DATE_RE.exec(trimmed);

  if (!match) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, y, m, d, hh, mm, ss] = match;
  const date = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh ?? 0),
    Number(mm ?? 0),
    Number(ss ?? 0)
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatRelativeTime = (dateString: string): string => {
  const date = parseServerDate(dateString) ?? new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffMs / 604800000);
  const diffMonths = Math.floor(diffMs / 2629746000);
  const diffYears = Math.floor(diffMs / 31556952000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffWeeks < 4) return `${diffWeeks} tuần trước`;
  if (diffMonths < 12) return `${diffMonths} tháng trước`;
  if (diffYears >= 1) return `${diffYears} năm trước`;
  
  return date.toLocaleDateString('vi-VN');
};

export const formatFullDate = (dateString: string): string => {
  const date = parseServerDate(dateString) ?? new Date(dateString);
  return date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatShortDate = (dateString: string): string => {
  const date = parseServerDate(dateString) ?? new Date(dateString);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/** Chuẩn hóa thời gian về HH:MM (vd: "9:58:00" -> "09:58", "20:4" -> "20:04") */
export const formatTimeHHMM = (timeStr?: string | null): string => {
  if (!timeStr || !timeStr.trim()) return '';
  const trimmed = timeStr.trim();
  // Hỗ trợ cả phút 1 chữ số (20:4 -> 20:04) và 2 chữ số (20:40)
  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})/);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    return `${h}:${m}`;
  }
  return trimmed;
};

/** Chuẩn hóa thời gian HH:mm hoặc HH:mm:ss thành HH:mm:ss (Frappe Time field) - bỏ dấu : thừa (vd: "8:50:" -> "08:50:00") */
export const normalizeTimeForApi = (timeStr?: string | null): string | undefined => {
  if (!timeStr || !timeStr.trim()) return undefined;
  const trimmed = timeStr.trim();
  const cleaned = trimmed.replace(/:+$/, ''); // Bỏ dấu : thừa ở cuối
  const m = cleaned.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return undefined;
  const h = m[1].padStart(2, '0');
  const min = m[2].padStart(2, '0');
  const sec = (m[3] || '00').padStart(2, '0');
  return `${h}:${min}:${sec}`;
}; 