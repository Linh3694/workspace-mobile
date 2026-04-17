import type { CRMIssue } from '../types/crmIssue';

/** Tạo issue đi thẳng Đã duyệt — khớp backend DIRECT_ISSUE_ROLES */
export const CRM_ISSUE_DIRECT_ISSUE_ROLES = [
  'SIS Sales Care',
  'SIS Sales Care Admin',
  'SIS Sales',
  'SIS Sales Admin',
] as const;

/** Roles Sales — đồng bộ web CRM_ISSUE_SALES_STATUS_ROLES — chỉ nhóm này đổi Trạng thái / Kết quả xử lý */
export const CRM_ISSUE_SALES_STATUS_ROLES = [
  'SIS Sales',
  'SIS Sales Admin',
  'SIS Sales Care',
  'SIS Sales Care Admin',
] as const;

/** Role được ghi / xử lý vấn đề — khớp backend ISSUE_WRITE_ROLES + web CRM_ISSUE_WRITE_ROLES */
export const CRM_ISSUE_WRITE_ROLES = [
  'SIS Sales',
  'SIS Sales Care',
  'SIS Sales Care Admin',
  'SIS Sales Admin',
  'SIS BOD',
  'System Manager',
] as const;

/** @deprecated dùng CRM_ISSUE_SALES_STATUS_ROLES */
export const SALES_ROLES = CRM_ISSUE_SALES_STATUS_ROLES;

/** Roles được gọi API CRM (khớp erp.api.crm.utils.ALLOWED_ROLES) */
export const CRM_ALLOWED_ROLES = [
  'System Manager',
  'SIS Manager',
  'Registrar',
  'SIS Sales',
  'SIS Sales Care',
  'SIS Sales Care Admin',
  'SIS Sales Admin',
  'SIS BOD',
] as const;

const ADMISSION_ISSUES_EXTRA_ROLES = [
  'SIS Manager',
  'SIS Teacher',
  'SIS Marcom',
  'SIS Administrative',
  'SIS IT',
  'SIS User',
  'SIS Library',
  'SIS AI Manager',
  'SIS Supervisory',
  'SIS Supervisory Admin',
] as const;

export function hasRole(roles: string[], role: string): boolean {
  return roles.includes(role);
}

function hasCampusAccess(roles: string[]): boolean {
  return roles.some((r) => r.startsWith('Campus '));
}

/** Quyền vào module Vấn đề CRM (danh sách, mở màn…) */
export function hasCrmAccess(roles: string[]): boolean {
  if (hasCampusAccess(roles)) return true;
  if (CRM_ALLOWED_ROLES.some((r) => roles.includes(r))) return true;
  return ADMISSION_ISSUES_EXTRA_ROLES.some((r) => roles.includes(r));
}

/**
 * Ghi / sửa / thêm log / duyệt từ chối khi chờ duyệt: một trong CRM_ISSUE_WRITE_ROLES hoặc email thuộc phòng ban issue.
 * Khớp web canWriteCrmIssue + backend _can_write_issue_ops.
 */
export function canWriteCrmIssue(
  sessionUserId: string,
  departmentMemberEmails: string[],
  roles: string[]
): boolean {
  // Ưu tiên role ghi — khớp web (user thiếu email vẫn có quyền khi có role)
  if (CRM_ISSUE_WRITE_ROLES.some((r) => roles.includes(r))) return true;
  const uid = (sessionUserId || '').trim();
  if (!uid) return false;
  const set = new Set(departmentMemberEmails.map((e) => e.trim()).filter(Boolean));
  return set.has(uid);
}

/** Chỉ Sales — đổi trạng thái xử lý / kết quả sau khi đã duyệt */
export function canEditSalesStatusResult(roles: string[]): boolean {
  return CRM_ISSUE_SALES_STATUS_ROLES.some((r) => roles.includes(r));
}

export const PIC_CHANGE_ROLES = [
  'System Manager',
  'SIS Sales Care Admin',
  'SIS Sales Admin',
] as const;

export function canChangeIssuePic(roles: string[]): boolean {
  return PIC_CHANGE_ROLES.some((r) => roles.includes(r));
}

/** Docname phòng ban từ issue — ưu tiên issue_departments */
export function getIssueDepartmentDocnames(issue: Pick<CRMIssue, 'department' | 'issue_departments'>): string[] {
  const rows = issue.issue_departments ?? [];
  const fromRows = rows.map((r) => r.department).filter(Boolean) as string[];
  if (fromRows.length > 0) return fromRows;
  const d = (issue.department || '').trim();
  return d ? [d] : [];
}
