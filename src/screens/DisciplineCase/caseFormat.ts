/**
 * Định dạng dùng chung cho màn Sự vụ kỷ luật — để danh sách và chi tiết
 * không hiện cùng một dữ liệu theo hai kiểu khác nhau (port từ web caseFormat.ts).
 */
import type { DisciplineCaseStatus } from '../../services/disciplineCaseService';

/**
 * `month_key` backend lưu dạng `YYYY-MM` (khoá sắp xếp), người đọc quen `MM/YYYY`.
 * Cắt chuỗi theo vị trí, không qua `new Date()`: chuỗi không có ngày/giờ bị hiểu là UTC
 * rồi quy về giờ máy, sang tháng khác ở các múi giờ phía tây.
 */
export function fmtMonthKey(raw?: string | null): string {
  const value = String(raw || '').trim();
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return m ? `${m[2]}/${m[1]}` : value || '—';
}

/** Datetime backend → dd/mm/yyyy HH:MM */
export function fmtTime(raw?: string | null): string {
  if (!raw) return '';
  const d = new Date(String(raw).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(
    d.getMonth() + 1
  )}/${d.getFullYear()}`;
}

/**
 * Điểm phục hồi là 30% điểm trừ nên gần như luôn lẻ. Bỏ số 0 thừa ở đuôi để
 * không thành "1.20" / "3.00", nhưng giữ nguyên phần thập phân có nghĩa.
 */
export function fmtPoints(value: number | undefined | null): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * 100) / 100);
}

/**
 * Ngày-thuần YYYY-MM-DD → dd/mm/yyyy. Cắt chuỗi theo y/m/d, KHÔNG qua `new Date()`:
 * ngày không có giờ bị hiểu là UTC rồi quy về giờ máy, lệch một ngày.
 */
export function fmtDateOnly(raw?: string | null): string {
  const value = String(raw || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value || '—';
}

export interface CaseStatusTone {
  bg: string;
  text: string;
}

/** Trạng thái → màu chip (tương đương tone StatusBadge của web) */
const STATUS_TONES: Record<DisciplineCaseStatus, CaseStatusTone> = {
  'Tiếp nhận': { bg: '#FEF3C7', text: '#B45309' },
  'Đang xử lý': { bg: '#E8EDF3', text: '#002855' },
  'Hoàn thành': { bg: '#DCFCE7', text: '#15803D' },
};

const NEUTRAL_TONE: CaseStatusTone = { bg: '#F3F4F6', text: '#4B5563' };

export function resolveCaseStatusTone(status: string | undefined): CaseStatusTone {
  if (!status) return NEUTRAL_TONE;
  return STATUS_TONES[status as DisciplineCaseStatus] ?? NEUTRAL_TONE;
}

/** Nhãn hành động trong nhật ký — khớp `action` backend ghi ở SIS Discipline Case Log */
export const CASE_ACTION_LABEL: Record<string, string> = {
  created: 'Tạo sự vụ',
  assigned: 'Đổi người tiếp nhận',
  status_changed: 'Đổi trạng thái',
  note: 'Ghi chú',
  notified: 'Gửi thông báo',
  recovery_granted: 'Duyệt điểm phục hồi',
};

/** Việc người dùng tự viết ra — tách khỏi mốc hệ thống, cùng quy ước tab của web */
export const CASE_COMMENT_ACTIONS = new Set(['note']);
