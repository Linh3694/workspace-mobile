/**
 * Tên người hiển thị ở màn Vấn đề chung (banner duyệt/từ chối, người tạo, PIC, nhật ký).
 *
 * File này TỪNG tự cài một bảng họ riêng, port gọn từ web `normalizeVietnameseNameEnhanced`
 * nhưng BỎ MẤT hai lớp chặn của bản gốc: danh sách họ dùng để đảo phải HẸP, và phải loại
 * đệm (Văn / Thị / Đức…) ra khỏi ứng viên "họ". Thiếu chúng thì bảng họ rộng biến từ đệm
 * thành họ và đảo hỏng cả những tên vốn đã đúng:
 *
 *     "Nguyễn Văn An"    → "Văn An Nguyễn"
 *     "Nguyễn Hoàng Long"→ "Hoàng Long Nguyễn"
 *     "Bùi Thái Sơn"     → "Thái Sơn Bùi"
 *
 * Nay uỷ quyền hết cho `nameFormatter.ts` — thuật toán chọn HỌ PHỔ BIẾN NHẤT trong chuỗi
 * rồi mới quyết định đảo, nên tên đúng thứ tự được giữ nguyên mà tên AD đảo ngược
 * ("Lệ Vũ Thị Nhật") vẫn nắn lại được. Xem `nameFormatter.ts` để biết chi tiết.
 */

import { formatPersonDisplayName, normalizeVietnameseName } from './nameFormatter';

export { normalizeVietnameseName };

/** Hiển thị tên PIC: chuẩn hoá Họ Đệm Tên + fallback local-part email */
export function getPicDisplayName(
  fullName: string | null | undefined,
  email?: string | null,
): string {
  return formatPersonDisplayName(fullName, email);
}

/** Như `getPicDisplayName` nhưng trả "—" khi trống — dùng cho các ô thông tin của vấn đề. */
export function formatIssuePersonDisplayName(opts: {
  fullName?: string | null;
  userId?: string | null;
}): string {
  return formatPersonDisplayName(opts.fullName, opts.userId) || '—';
}
