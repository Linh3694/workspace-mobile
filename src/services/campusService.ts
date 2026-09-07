/**
 * API campus (erp.api.erp_sis.campus.*) — nguồn dữ liệu cho CampusContext.
 *
 * Ba việc: danh sách campus user được vào, campus đang chọn trên server (SIS User Campus
 * Preference), và đặt campus đang chọn. Web admin dùng đúng 3 endpoint này; mobile trước
 * đây chỉ gọi get_campuses nên preference trên server không bao giờ được mobile cập nhật.
 */
import api from '../utils/api';
import type { CampusRow } from '../utils/campusStore';

const BASE = '/method/erp.api.erp_sis.campus';

/** Frappe bọc giá trị hàm trả về trong `message`; erp lại bọc `{ success, data }`. Bóc cả hai. */
const unwrap = (json: any): { ok: boolean; data: any; message?: string } => {
  const envelope = json && json.message && typeof json.message === 'object' ? json.message : json;
  if (!envelope || typeof envelope !== 'object') return { ok: false, data: null };
  const ok = envelope.success === true || envelope.status === 'success';
  const data = envelope.data !== undefined ? envelope.data : envelope;
  const message =
    typeof envelope.message === 'string'
      ? envelope.message
      : typeof envelope.error === 'string'
        ? envelope.error
        : undefined;
  return { ok, data, message };
};

const isCampusRow = (r: any): r is CampusRow => !!r && typeof r.name === 'string';

export const campusService = {
  /** Campus user được truy cập (backend tự fallback từ role nếu thiếu SIS Campus). */
  async getCampuses(): Promise<CampusRow[]> {
    const res = await api.get(`${BASE}.get_campuses`, { skipCampus: true } as any);
    const { ok, data } = unwrap(res.data);
    const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    return ok || rows.length ? rows.filter(isCampusRow) : [];
  },

  /** Campus đang chọn lưu trên server; null nếu chưa chọn bao giờ. */
  async getCurrentCampus(): Promise<CampusRow | null> {
    try {
      const res = await api.get(`${BASE}.get_current_campus`, { skipCampus: true } as any);
      const { data } = unwrap(res.data);
      return isCampusRow(data) ? data : null;
    } catch (e) {
      console.warn('[campusService] getCurrentCampus lỗi:', e);
      return null;
    }
  },

  /**
   * Đặt campus đang chọn trên server. Backend từ chối (throw) nếu user không có quyền campus.
   * Gửi cả query lẫn form body — cách Frappe đọc tham số ổn định nhất (giống web).
   */
  async setCurrentCampus(
    campusId: string
  ): Promise<{ ok: boolean; campus?: CampusRow; message?: string }> {
    const id = (campusId || '').trim();
    if (!id) return { ok: false, message: 'Campus ID không hợp lệ' };
    try {
      const body = new URLSearchParams({ campus: id }).toString();
      const res = await api.post(
        `${BASE}.set_current_campus?campus=${encodeURIComponent(id)}`,
        body,
        {
          skipCampus: true,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        } as any
      );
      const { ok, data, message } = unwrap(res.data);
      const campus = isCampusRow(data?.campus) ? data.campus : undefined;
      if (ok) return { ok: true, campus, message: data?.message || message };
      return { ok: false, message: message || 'Không đổi được campus' };
    } catch (e: any) {
      const serverMsg =
        e?.response?.data?.message ||
        e?.response?.data?._server_messages ||
        e?.response?.data?.exception ||
        e?.message;
      return {
        ok: false,
        message: typeof serverMsg === 'string' ? serverMsg : 'Không đổi được campus',
      };
    }
  },
};

export default campusService;
