/**
 * Ticket CSVC / Hành chính — hằng số & datetime (khớp web frappe-sis-frontend)
 */
import type { Building } from '../services/buildingService';

/** Trùng ERP Administrative Support Category name trên Frappe */
export const EVENT_FACILITY_CATEGORY = '__event_facility__';

export function getBuildingLabelForAreaTitle(
  areaTitle: string | undefined,
  buildings: Building[]
): string {
  const t = (areaTitle || '').trim();
  if (!t) return '';
  const byId = buildings.find((b) => b.name === t);
  if (byId) return byId.title_vn || byId.name;
  const byLegacy = buildings.find((b) => b.title_vn === t || b.short_title === t);
  if (byLegacy) return byLegacy.title_vn || byLegacy.name;
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
