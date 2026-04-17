/**
 * Hiển thị SLA (còn lại / trễ) — khớp web crmIssueSlaDisplay.
 */

/** Thời gian còn lại đến deadline — danh sách / On track */
export function formatSlaRemainingVi(deadline?: string | null): string {
  if (!deadline) return '—';
  const end = new Date(deadline).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.floor((end - now) / 1000));
  if (sec === 0) return '0 phút';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const d = Math.floor(h / 24);
  if (h >= 48) return `~${d} ngày`;
  if (h > 0) return `~${h} giờ ${m} phút`;
  return `~${m} phút`;
}

/** Đã trễ sau deadline — banner Breached */
export function formatSlaOverdueVi(deadline?: string | null): string {
  if (!deadline) return '';
  const end = new Date(deadline).getTime();
  const now = Date.now();
  if (end >= now) return '';
  const sec = Math.floor((now - end) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const d = Math.floor(h / 24);
  if (h >= 48) return `${d} ngày`;
  if (h > 0) return `${h} giờ ${m} phút`;
  return `${m} phút`;
}
