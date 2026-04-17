/**
 * Chuỗi hiển thị lớp: giữ tên lớp như DB; chỉ gỡ một lần tiền tố nhãn thừa `Lớp:` ở đầu (vd. `Lớp: Lớp 1A5` → `Lớp 1A5`).
 * Đồng bộ với frappe-sis-frontend `normalizeStudentClassTitle`.
 */
export function normalizeStudentClassTitle(raw: string | null | undefined): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const withoutLabel = t.replace(/^Lớp\s*[:：]\s*/i, '').trim();
  return withoutLabel || t;
}
