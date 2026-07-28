/**
 * Helpers cho tính năng Đặt phòng — port từ web
 * frappe-sis-frontend/packages/core/src/services/roomBookingConfigService.ts
 * (availability / weekday / time) + tiện ích nhóm & sắp xếp lịch cho UI danh sách.
 */
import type {
  BookableRoom,
  RoomAvailabilityDay,
  RoomBooking,
  RoomBookingWeekday,
} from '../../types/roomBooking';
import { formatPersonDisplayName } from '../../utils/nameFormatter';

export const ROOM_BOOKING_WEEKDAYS: RoomBookingWeekday[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const WEEKDAY_LABELS_VI: Record<RoomBookingWeekday, string> = {
  Monday: 'Thứ 2',
  Tuesday: 'Thứ 3',
  Wednesday: 'Thứ 4',
  Thursday: 'Thứ 5',
  Friday: 'Thứ 6',
  Saturday: 'Thứ 7',
  Sunday: 'Chủ nhật',
};

/** Chuẩn hoá chuỗi để so sánh/tìm không phân biệt dấu (tiếng Việt) */
function normalizeSearchText(s?: string | null): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Tên phòng để hiển thị — ưu tiên tên theo năm học (yearly assignment) giống web,
 * vì title_vn của ERP Administrative Room chỉ là mã phòng (legacy/display fallback).
 */
export function getRoomLabel(r: BookableRoom): string {
  const candidates = [
    r.yearly_assignment_display,
    r.yearly_assignment_display_en,
    r.title_vn,
    r.short_title,
    r.name,
  ];
  return (candidates.find((v) => String(v || '').trim()) || '').toString().trim();
}

/** Mã phòng hiển thị kèm tên (bỏ qua khi trùng chính tên đang hiển thị) */
export function getRoomCode(r: BookableRoom): string {
  const code = (r.short_title || r.title_vn || '').trim();
  if (!code) return '';
  return normalizeSearchText(code) === normalizeSearchText(getRoomLabel(r)) ? '' : code;
}

/** Nhãn toà nhà của phòng */
export function getRoomBuildingLabel(r: BookableRoom): string {
  return (r.building_title_vn || r.building_title_en || '').trim();
}

/** Khớp phòng với từ khoá tìm kiếm (theo tên, mã phòng, toà nhà — không phân biệt dấu) */
export function matchesRoomQuery(r: BookableRoom, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return [
    getRoomLabel(r),
    r.yearly_assignment_display,
    r.yearly_assignment_display_en,
    r.title_vn,
    r.title_en,
    r.short_title,
    r.building_title_vn,
    r.building_title_en,
  ].some((v) => normalizeSearchText(v).includes(q));
}

/** Dữ liệu tối thiểu để hiển thị/tìm một CBGVNV (người tham dự, người đặt phòng) */
export interface RoomBookingPerson {
  full_name?: string | null;
  email?: string | null;
  department_name?: string | null;
}

/** Tên CBGVNV hiển thị — chuẩn hoá Họ Đệm Tên tiếng Việt, fallback local-part email */
export function getPersonLabel(p: RoomBookingPerson): string {
  return formatPersonDisplayName(p.full_name, p.email);
}

/**
 * Khớp CBGVNV với từ khoá (tên gốc + tên đã chuẩn hoá + email + phòng ban,
 * không phân biệt dấu) — để tìm được cả khi gõ theo tên đang hiển thị.
 */
export function matchesPersonQuery(p: RoomBookingPerson, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return [getPersonLabel(p), p.full_name, p.email, p.department_name].some((v) =>
    normalizeSearchText(v).includes(q)
  );
}

/** Index thứ (0=Monday) từ Date */
export function getWeekdayIndex(date: Date): number {
  const js = date.getDay(); // 0=Sunday
  return js === 0 ? 6 : js - 1;
}

export function getWeekdayName(date: Date): RoomBookingWeekday {
  return ROOM_BOOKING_WEEKDAYS[getWeekdayIndex(date)];
}

/** Parse "HH:mm[:ss]" → phút trong ngày */
export function parseTimeToMinutes(timeStr?: string | null): number {
  const m = String(timeStr || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** "HH:mm:ss" | "HH:mm" → "HH:mm" (zero-pad) */
export function timeToInputValue(value?: string | null): string {
  if (!value) return '';
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** Parse "YYYY-MM-DD HH:mm[:ss]" hoặc ISO → Date (đọc theo giờ local/wall time) */
export function parseWallTime(input?: string | null): Date | null {
  const v = (input || '').trim();
  if (!v) return null;
  const normalized = v.includes('T') ? v : v.replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Kết hợp ngày (Date) + "HH:mm" → Date */
export function combineDateAndTime(date: Date, hhmm: string): Date {
  const [h, m] = (hhmm || '00:00').split(':').map((x) => Number(x) || 0);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
}

const fmtHM = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/**
 * Kiểm tra khung giờ [start, end] có đặt được theo availability của phòng không.
 * Trả lý do (chuỗi VI) nếu KHÔNG đặt được (ngày đóng cửa / khác ngày / ngoài giờ);
 * null nếu hợp lệ (hoặc phòng chưa cấu hình availability → không chặn client-side).
 */
export function getAvailabilityViolation(
  start: Date,
  end: Date,
  availability: RoomAvailabilityDay[] | undefined
): string | null {
  if (!availability?.length) return null;
  const row = availability.find((a) => a.day_of_week === getWeekdayName(start));
  if (!row || row.is_closed) {
    return 'Phòng đóng cửa vào ngày này — vui lòng chọn ngày khác';
  }
  const openStart = parseTimeToMinutes(row.start_time);
  const openEnd = parseTimeToMinutes(row.end_time);
  const sameDay = start.toDateString() === end.toDateString();
  const startMins = start.getHours() * 60 + start.getMinutes();
  const endMins = sameDay ? end.getHours() * 60 + end.getMinutes() : 24 * 60;
  if (!sameDay || startMins < openStart || endMins > openEnd) {
    return `Ngoài giờ khả dụng (${fmtHM(openStart)}–${fmtHM(openEnd)}) — vui lòng chọn giờ khác`;
  }
  return null;
}

/** Nhãn giờ mở cửa của phòng cho một ngày ("07:00–18:00" hoặc "Đóng cửa") */
export function getOpenHoursLabel(
  date: Date,
  availability: RoomAvailabilityDay[] | undefined
): string {
  if (!availability?.length) return '';
  const row = availability.find((a) => a.day_of_week === getWeekdayName(date));
  if (!row || row.is_closed) return 'Đóng cửa';
  return `${timeToInputValue(row.start_time)}–${timeToInputValue(row.end_time)}`;
}

/** Tình trạng phòng hiện tại cho badge */
export function getRoomBookingStatus(
  now: Date,
  availability: RoomAvailabilityDay[] | undefined,
  activeBookings: { start: Date; end: Date }[]
): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  const row = availability?.find((a) => a.day_of_week === getWeekdayName(now));
  const nowMins = now.getHours() * 60 + now.getMinutes();
  if (!row || row.is_closed) return { label: 'Ngoài giờ khả dụng', tone: 'neutral' };
  const openStart = parseTimeToMinutes(row.start_time);
  const openEnd = parseTimeToMinutes(row.end_time);
  if (nowMins < openStart || nowMins >= openEnd) {
    return { label: 'Ngoài giờ khả dụng', tone: 'neutral' };
  }
  for (const b of activeBookings) {
    if (b.start <= now && now < b.end) {
      return { label: `Đang dùng đến ${fmtHM(b.end.getHours() * 60 + b.end.getMinutes())}`, tone: 'warning' };
    }
  }
  return { label: 'Đang trống', tone: 'success' };
}

/** "HH:mm – HH:mm" từ 2 chuỗi datetime */
export function formatTimeRange(startStr: string, endStr: string): string {
  const s = parseWallTime(startStr);
  const e = parseWallTime(endStr);
  const fmt = (d: Date | null) =>
    d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '--:--';
  return `${fmt(s)} – ${fmt(e)}`;
}

/** Nhãn ngày cho header nhóm: "Thứ 2, 15/07/2026" */
export function formatDayHeader(date: Date): string {
  const wd = WEEKDAY_LABELS_VI[getWeekdayName(date)];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${wd}, ${dd}/${mm}/${date.getFullYear()}`;
}

export interface BookingDayGroup {
  key: string;
  date: Date;
  label: string;
  items: RoomBooking[];
}

/** Nhóm bookings theo ngày, sắp theo thời gian tăng dần (ngày & giờ) */
export function groupBookingsByDay(bookings: RoomBooking[]): BookingDayGroup[] {
  const sorted = [...bookings].sort((a, b) => {
    const sa = parseWallTime(a.event_start_time)?.getTime() ?? 0;
    const sb = parseWallTime(b.event_start_time)?.getTime() ?? 0;
    return sa - sb;
  });
  const groups: Record<string, BookingDayGroup> = {};
  const order: string[] = [];
  for (const b of sorted) {
    const d = parseWallTime(b.event_start_time);
    if (!d) continue;
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        label: formatDayHeader(d),
        items: [],
      };
      order.push(key);
    }
    groups[key].items.push(b);
  }
  return order.map((k) => groups[k]);
}
