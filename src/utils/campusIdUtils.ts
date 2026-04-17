/**
 * Chuẩn hóa campus_id giữa format mobile và backend
 * Mobile/display: campus-1, campus-2
 * Backend/DB: CAMPUS-00001, CAMPUS-00002
 */

/**
 * Chuẩn hóa campus_id cho API backend
 * campus-1 -> CAMPUS-00001, campus-2 -> CAMPUS-00002
 */
export function normalizeCampusIdForBackend(
  campusId: string | undefined | null
): string {
  if (!campusId) return '';

  if (/^CAMPUS-\d{5}$/i.test(campusId)) {
    return campusId.toUpperCase();
  }

  const match = campusId.match(/^campus-(\d+)$/i);
  if (match) {
    return `CAMPUS-${match[1].padStart(5, '0')}`;
  }

  if (/^\d+$/.test(campusId)) {
    return `CAMPUS-${campusId.padStart(5, '0')}`;
  }

  return campusId;
}
