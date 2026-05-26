import type { TeacherClass } from '../services/timetableService';

/** Một lớp chủ nhiệm / phó chủ nhiệm để picker + feed */
export type HomeroomClassOption = {
  id: string;
  title: string;
  shortTitle?: string;
  schoolYearId: string;
  /** Chủ nhiệm hoặc phó — hiển thị badge UI */
  roleLabel: 'homeroom' | 'vice';
};

function norm(s: unknown): string {
  return String(s ?? '').trim();
}

/** So khớp user hiện tại với GVCN / phó của lớp (theo sis_class payload) */
export function resolveHomeroomRole(
  cls: TeacherClass,
  teacherUserId: string,
  teacherEmail?: string
): HomeroomClassOption['roleLabel'] | null {
  const uid = norm(teacherUserId);
  const email = norm(teacherEmail).toLowerCase();

  const matchesInfo = (info?: { user_id?: string; email?: string }) => {
    if (!info) return false;
    const u = norm(info.user_id);
    const em = norm(info.email).toLowerCase();
    if (uid && u && (u === uid || email && em && email === em)) return true;
    return false;
  };

  if (matchesInfo(cls.homeroom_teacher_info)) return 'homeroom';
  if (matchesInfo(cls.vice_homeroom_teacher_info)) return 'vice';
  return null;
}

/** Chỉ lớp regular; server đã gắn homeroom_teacher nhưng vẫn lọc an toàn */
export function homeroomClassesToOptions(
  homeroomClasses: TeacherClass[],
  teacherUserId: string,
  teacherEmail?: string
): HomeroomClassOption[] {
  const out: HomeroomClassOption[] = [];
  for (const c of homeroomClasses || []) {
    if (norm(c.class_type) && norm(c.class_type) !== 'regular') continue;
    const role = resolveHomeroomRole(c, teacherUserId, teacherEmail);
    if (!role) continue;
    const sy = norm(c.school_year_id);
    if (!sy) continue;
    out.push({
      id: norm(c.name),
      title: norm(c.title || c.short_title || c.name),
      shortTitle: c.short_title ? norm(c.short_title) : undefined,
      schoolYearId: sy,
      roleLabel: role,
    });
  }
  return out;
}
