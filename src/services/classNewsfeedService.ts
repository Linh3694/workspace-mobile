import api from '../utils/api';
// `homeroomClassUtils` chỉ import NGƯỢC lại type NewsfeedClass (`import type`, bị xoá
// khi biên dịch) nên hai file không tạo vòng lặp lúc chạy.
import { resolveHomeroomRole } from '../utils/homeroomClassUtils';
import timetableService from './timetableService';
import type { TeacherClass } from './timetableService';

/**
 * Lớp mà người dùng hiện tại được đăng bài lên bảng tin (Hoạt động lớp).
 *
 * Không phải chỉ lớp chủ nhiệm: GVCN/phó có quyền mặc định, còn GV bộ môn được
 * GVCN thêm vào `SIS Class Newsfeed Poster` cũng đăng được. Quyền đó chỉ server
 * biết, nên danh sách phải hỏi server chứ không suy ra từ lớp chủ nhiệm.
 */
export type NewsfeedClassRole = 'homeroom' | 'vice_homeroom' | 'poster';

export type NewsfeedClass = {
  classId: string;
  title: string;
  shortTitle?: string;
  schoolYearId: string;
  campusId?: string;
  classType?: string;
  role: NewsfeedClassRole;
};

function norm(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeRole(raw: unknown): NewsfeedClassRole {
  const value = norm(raw);
  if (value === 'homeroom' || value === 'vice_homeroom' || value === 'poster') return value;
  return 'poster';
}

function toNewsfeedClass(raw: Record<string, unknown>): NewsfeedClass | null {
  const classId = norm(raw?.classId);
  const schoolYearId = norm(raw?.schoolYearId);
  if (!classId || !schoolYearId) return null;
  return {
    classId,
    title: norm(raw?.title) || norm(raw?.shortTitle) || classId,
    shortTitle: norm(raw?.shortTitle) || undefined,
    schoolYearId,
    campusId: norm(raw?.campusId) || undefined,
    classType: norm(raw?.classType) || undefined,
    role: normalizeRole(raw?.role),
  };
}

/**
 * Suy danh sách từ lớp chủ nhiệm — CHỈ dùng khi endpoint quyền bảng tin không gọi
 * được (backend chưa deploy, mạng lỗi). Nhánh này bỏ sót GV bộ môn theo đúng thiết
 * kế cũ; nó tồn tại để GVCN không mất chức năng, không phải để thay thế.
 */
async function fallbackFromHomeroomClasses(teacherEmail?: string): Promise<NewsfeedClass[]> {
  const data = await timetableService.getTeacherClasses();
  const teacherUserId = norm(data?.teacher_user_id);
  if (!teacherUserId) return [];

  const out: NewsfeedClass[] = [];
  for (const cls of (data?.homeroom_classes || []) as TeacherClass[]) {
    const schoolYearId = norm(cls.school_year_id);
    const classId = norm(cls.name);
    if (!schoolYearId || !classId) continue;

    const homeroomRole = resolveHomeroomRole(cls, teacherUserId, teacherEmail);
    if (!homeroomRole) continue;
    const role: NewsfeedClassRole = homeroomRole === 'vice' ? 'vice_homeroom' : 'homeroom';

    out.push({
      classId,
      title: norm(cls.title) || norm(cls.short_title) || classId,
      shortTitle: norm(cls.short_title) || undefined,
      schoolYearId,
      campusId: norm(cls.campus_id) || undefined,
      classType: norm(cls.class_type) || undefined,
      role,
    });
  }
  return out;
}

const classNewsfeedService = {
  /**
   * Danh sách lớp được đăng bài của chính người đang đăng nhập.
   *
   * `teacherEmail` chỉ phục vụ nhánh fallback (khớp GVCN theo email khi thiếu user_id).
   */
  async getMyNewsfeedClasses(teacherEmail?: string): Promise<NewsfeedClass[]> {
    try {
      const response = await api.get(
        '/method/erp.api.erp_sis.newsfeed_poster.get_my_newsfeed_classes'
      );
      const message = response.data?.message ?? response.data;
      if (message?.success && message?.data) {
        const rows = Array.isArray(message.data.classes) ? message.data.classes : [];
        return rows
          .map((row: Record<string, unknown>) => toNewsfeedClass(row))
          .filter((row: NewsfeedClass | null): row is NewsfeedClass => row !== null);
      }
      // success=false là câu trả lời hợp lệ ("chưa có lớp nào"), không phải sự cố —
      // fallback ở đây sẽ dựng lại danh sách cũ và che mất kết quả thật của server.
      console.warn('[classNewsfeedService] get_my_newsfeed_classes trả success=false');
      return [];
    } catch (error) {
      console.warn(
        '[classNewsfeedService] get_my_newsfeed_classes lỗi, fallback lớp chủ nhiệm:',
        error
      );
      try {
        return await fallbackFromHomeroomClasses(teacherEmail);
      } catch (fallbackError) {
        console.error('[classNewsfeedService] fallback lỗi:', fallbackError);
        return [];
      }
    }
  },
};

export default classNewsfeedService;
