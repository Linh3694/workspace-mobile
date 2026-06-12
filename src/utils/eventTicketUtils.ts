/**
 * Ticket CSVC / Hành chính — hằng số & datetime (khớp web frappe-sis-frontend)
 */
import type { Building } from '../services/buildingService';
import type { AdminRoomBooking } from '../services/administrativeTicketService';

/** Trùng ERP Administrative Support Category name trên Frappe */
export const EVENT_FACILITY_CATEGORY = '__event_facility__';

export function getBuildingLabelForAreaTitle(
  areaTitle: string | undefined,
  buildings: Building[]
): string {
  const formatBuildingLabel = (b: Building): string => {
    const vn = (b.title_vn || b.name || '').trim();
    const en = (b.title_en || '').trim();
    if (!en) return vn;
    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
    return normalize(vn) === normalize(en) ? vn : `${vn} (${en})`;
  };

  const t = (areaTitle || '').trim();
  if (!t) return '';
  const byId = buildings.find((b) => b.name === t);
  if (byId) return formatBuildingLabel(byId);
  const byLegacy = buildings.find((b) => b.title_vn === t || b.short_title === t);
  if (byLegacy) return formatBuildingLabel(byLegacy);
  return t;
}

/** datetime-local → MySQL DATETIME (không timezone) */
export function datetimeLocalToMysql(local: string): string {
  if (!local || !local.trim()) return '';
  const m = local.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return '';
  const sec = (m[4] ?? '00').padStart(2, '0').slice(0, 2);
  return `${m[1]} ${m[2]}:${m[3]}:${sec}`;
}

/** Date → chuỗi datetime-local */
export function dateToDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseFlexibleDate(input: string): Date | null {
  const v = (input || '').trim();
  if (!v) return null;
  const normalized = v.includes('T') ? v : v.replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function hasBookingConflict(
  startLocal: string,
  endLocal: string,
  bookings: AdminRoomBooking[],
  excludeTicketId?: string
): boolean {
  const start = parseFlexibleDate(startLocal);
  const end = parseFlexibleDate(endLocal);
  if (!start || !end || end <= start) return false;

  return bookings.some((b) => {
    if (excludeTicketId && b.name === excludeTicketId) return false;
    const bStart = parseFlexibleDate(b.event_start_time);
    const bEnd = parseFlexibleDate(b.event_end_time);
    if (!bStart || !bEnd || bEnd <= bStart) return false;
    return start < bEnd && end > bStart;
  });
}

export function isLateEventNotice(eventStartTime: string): boolean {
  const start = parseFlexibleDate(eventStartTime);
  if (!start) return false;
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  return diffMs > 0 && diffMs < 72 * 60 * 60 * 1000;
}
