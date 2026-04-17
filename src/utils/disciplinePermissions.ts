/**
 * Quyền module Kỷ luật trên mobile: cổng Mobile Supervisory + logic UI giống web (SIS Supervisory / SIS Supervisory Admin).
 */

import type { DisciplineRecordItem } from '../services/disciplineRecordService';

/** Role bắt buộc để mở module Kỷ luật trên app mobile */
export const MOBILE_SUPERVISORY_ROLE = 'Mobile Supervisory';

const SIS_SUPERVISORY = 'SIS Supervisory';
const SIS_SUPERVISORY_ADMIN = 'SIS Supervisory Admin';

function normalizeRoleName(r: string): string {
  return (r || '').trim();
}

function hasRole(userRoles: string[], role: string): boolean {
  if (!userRoles?.length) return false;
  const want = normalizeRoleName(role);
  return userRoles.some((x) => normalizeRoleName(x) === want);
}

function hasAnyRole(userRoles: string[], roles: string[]): boolean {
  return roles.some((r) => hasRole(userRoles, r));
}

/**
 * User ID Frappe để so khớp trường owner / record_creator trên bản ghi.
 * get_current_user mobile không luôn có `name`; User.name trong Frappe thường trùng email.
 */
export function getDisciplineSessionOwnerId(user: {
  email?: string;
  name?: string;
  username?: string;
  _id?: string;
} | null): string {
  if (!user) return '';
  return (user.email || user.name || user._id || user.username || '').trim();
}

/** So khớp owner bản ghi (Frappe) với user phiên đăng nhập — giống web + không phân biệt hoa thường */
export function disciplineRecordOwnerMatchesSession(
  recordOwner: string | undefined,
  sessionOwnerId: string
): boolean {
  const o = (recordOwner || '').trim();
  const sid = (sessionOwnerId || '').trim();
  if (!o || !sid) return false;
  if (o === sid) return true;
  if (o.toLowerCase() === sid.toLowerCase()) return true;
  return false;
}

/** User ID người tạo bản ghi — giống web disciplineRecordCreatorId */
export function disciplineRecordCreatorId(
  item: Pick<DisciplineRecordItem, 'owner'> & { record_creator?: string }
): string {
  return ((item as { record_creator?: string }).record_creator ?? item.owner ?? '').trim();
}

/** Có quyền mở module Kỷ luật trên mobile (cần gán role Mobile Supervisory trên Frappe) */
export function hasMobileDisciplineAccess(userRoles: string[] | undefined): boolean {
  return hasRole(userRoles || [], MOBILE_SUPERVISORY_ROLE);
}

/**
 * Có quyền thao tác ghi nhận lỗi trên UI mobile: SIS Supervisory / Admin hoặc Mobile Supervisory (cổng app).
 * Mobile Supervisory tương đương SIS Supervisory cho thao tác trên chính bản ghi của mình.
 */
export function hasDisciplineSupervisoryUiRole(userRoles: string[]): boolean {
  return hasAnyRole(userRoles, [
    SIS_SUPERVISORY,
    SIS_SUPERVISORY_ADMIN,
    MOBILE_SUPERVISORY_ROLE,
  ]);
}

/**
 * Quyền sửa/xóa bản ghi trên UI: Admin = mọi bản ghi; Supervisory hoặc Mobile Supervisory = chỉ bản ghi mình tạo.
 */
export function canModifyDisciplineRecordInSupervisoryUi(
  userRoles: string[],
  recordOwner: string | undefined,
  sessionOwnerId: string
): boolean {
  if (!hasDisciplineSupervisoryUiRole(userRoles)) return false;
  if (hasRole(userRoles, SIS_SUPERVISORY_ADMIN)) return true;
  if (hasRole(userRoles, SIS_SUPERVISORY) || hasRole(userRoles, MOBILE_SUPERVISORY_ROLE)) {
    return disciplineRecordOwnerMatchesSession(recordOwner, sessionOwnerId);
  }
  return false;
}
