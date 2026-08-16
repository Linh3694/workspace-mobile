/**
 * Khớp tên tiết giữa client và dữ liệu đã lưu.
 *
 * Cột `period` trong `SIS Class Attendance` là chuỗi tự do nên có biến thể
 * `"Tiết 8"` / `"Tiết 8 "` / `"8"`. Hàm này đồng bộ với `_period_name_matches`
 * ở backend (`erp/api/erp_sis/attendance.py`) và `periodNameMatches` bên
 * frappe-sis-frontend: so khớp sau khi trim + bỏ phân biệt hoa thường, rồi mới
 * thử so theo số tiết.
 */
export function periodNameMatches(a?: string | null, b?: string | null): boolean {
  const left = (a ?? '').trim();
  const right = (b ?? '').trim();
  if (!left || !right) return false;
  if (left.toLowerCase() === right.toLowerCase()) return true;

  const leftNum = left.match(/\d+/)?.[0];
  const rightNum = right.match(/\d+/)?.[0];
  return !!leftNum && leftNum === rightNum;
}
