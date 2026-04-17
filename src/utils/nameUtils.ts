/**
 * Chuẩn hoá tên tiếng Việt: đảo thứ tự nếu phát hiện pattern "Tên Họ" → "Họ Tên".
 * Port gọn từ frappe-sis-frontend/src/utils/userUtils.ts — normalizeVietnameseNameEnhanced.
 */

const COMMON_VN_SURNAMES = new Set([
  'Nguyễn','Trần','Phạm','Hoàng','Huỳnh','Vũ','Võ','Trương','Bùi','Đặng','Đỗ','Ngô',
  'Dương','Đinh','Trịnh','Lê','Phan','Đoàn','Mai','Lý','Tôn','Vương','Hà','Cao','Châu',
  'Chu','Đào','Hồ','Lâm','Lưu','Tạ','Từ','Bạch','Diệp','Hứa','Khúc','Kiều','Lại',
  'Liên','Liêu','Lương','Mã','Mạc','Nghiêm','Nhan','Ninh','Phùng','Quách','Tống','Triệu',
  'Trình','Ung','Văn','Viên','La','Bá','Kim','Giáp','Thái','Thạch','Kha','Khương',
  'Sơn','Tăng','Tiêu',
]);

export function normalizeVietnameseName(fullName: string | null | undefined): string {
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) return '';

  const trimmed = fullName.trim();
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 2) return trimmed;

  if (words.length >= 3) {
    if (COMMON_VN_SURNAMES.has(words[1])) {
      return `${words.slice(1).join(' ')} ${words[0]}`;
    }
    const lastW = words[words.length - 1];
    if (COMMON_VN_SURNAMES.has(lastW) && !COMMON_VN_SURNAMES.has(words[0])) {
      return `${lastW} ${words.slice(0, -1).join(' ')}`;
    }
    return trimmed;
  }

  if (COMMON_VN_SURNAMES.has(words[1])) {
    return `${words[1]} ${words[0]}`;
  }
  return trimmed;
}

/** Hiển thị tên PIC: normalize tên VN + fallback email */
export function getPicDisplayName(
  fullName: string | null | undefined,
  email?: string | null,
): string {
  if (fullName?.trim()) return normalizeVietnameseName(fullName);
  if (email?.trim()) {
    const local = email.split('@')[0];
    return local
      .split(/[._-]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
  }
  return '';
}

/**
 * Chuẩn hóa tên người trên chi tiết issue (banner duyệt/từ chối, người tạo, PIC, log).
 * Khớp logic web IssueDetail.formatIssuePersonDisplayName — ưu tiên Họ Đệm Tên, fallback local-part email.
 */
export function formatIssuePersonDisplayName(opts: {
  fullName?: string | null;
  userId?: string | null;
}): string {
  const name = (opts.fullName ?? '').trim();
  const uid = (opts.userId ?? '').trim();
  if (!name && !uid) return '—';
  const fromPic = getPicDisplayName(name || undefined, uid || undefined);
  return fromPic || '—';
}
