import type { NewsfeedClass } from '../services/classNewsfeedService';
import type { TeacherClass } from '../services/timetableService';

/** Một lớp được đăng bài bảng tin để dựng picker + feed */
export type HomeroomClassOption = {
  id: string;
  title: string;
  shortTitle?: string;
  schoolYearId: string;
  /**
   * Vai trò với lớp — hiển thị badge UI.
   * `poster` = GV bộ môn được GVCN cấp quyền đăng bài; `bod` = BOD xem toàn trường.
   */
  roleLabel: 'homeroom' | 'vice' | 'poster' | 'bod';
};

function norm(s: unknown): string {
  return String(s ?? '').trim();
}

/** So khớp user hiện tại với GVCN / phó của lớp (theo sis_class payload) */
export function resolveHomeroomRole(
  cls: TeacherClass,
  teacherUserId: string,
  teacherEmail?: string
): 'homeroom' | 'vice' | null {
  const uid = norm(teacherUserId);
  const email = norm(teacherEmail).toLowerCase();

  const matchesInfo = (info?: { user_id?: string; email?: string }) => {
    if (!info) return false;
    const u = norm(info.user_id);
    const em = norm(info.email).toLowerCase();
    if (uid && u && (u === uid || (email && em && email === em))) return true;
    return false;
  };

  if (matchesInfo(cls.homeroom_teacher_info)) return 'homeroom';
  if (matchesInfo(cls.vice_homeroom_teacher_info)) return 'vice';
  return null;
}

/**
 * Map danh sách quyền đăng bài từ server sang option cho picker + feed.
 *
 * Không lọc lại theo GVCN: server đã quyết định ai đăng được lớp nào, lọc thêm ở
 * client chính là chỗ GV bộ môn từng bị rơi mất.
 */
export function newsfeedClassesToOptions(classes: NewsfeedClass[]): HomeroomClassOption[] {
  const out: HomeroomClassOption[] = [];
  for (const c of classes || []) {
    if (norm(c.classType) && norm(c.classType) !== 'regular') continue;
    const id = norm(c.classId);
    const sy = norm(c.schoolYearId);
    if (!id || !sy) continue;
    out.push({
      id,
      title: norm(c.title || c.shortTitle || c.classId),
      shortTitle: c.shortTitle ? norm(c.shortTitle) : undefined,
      schoolYearId: sy,
      roleLabel:
        c.role === 'homeroom' ? 'homeroom' : c.role === 'vice_homeroom' ? 'vice' : 'poster',
    });
  }
  return out;
}

/**
 * BOD xem tất cả lớp regular của năm học — roleLabel 'bod',
 * trừ khi user chính là GVCN/phó lớp đó (giữ badge đúng vai trò).
 */
export function allClassesToOptions(
  classes: TeacherClass[],
  teacherUserId?: string,
  teacherEmail?: string
): HomeroomClassOption[] {
  const out: HomeroomClassOption[] = [];
  for (const c of classes || []) {
    if (norm(c.class_type) && norm(c.class_type) !== 'regular') continue;
    const sy = norm(c.school_year_id);
    if (!sy) continue;
    const role =
      teacherUserId ? resolveHomeroomRole(c, teacherUserId, teacherEmail) : null;
    out.push({
      id: norm(c.name),
      title: norm(c.title || c.short_title || c.name),
      shortTitle: c.short_title ? norm(c.short_title) : undefined,
      schoolYearId: sy,
      roleLabel: role ?? 'bod',
    });
  }
  return out;
}
