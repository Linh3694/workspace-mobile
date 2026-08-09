/**
 * Quan hệ cha–con giữa các đơn vị Sơ đồ tổ chức, dùng cho cặp picker
 * "Phòng ban liên quan" ↔ "Nhóm liên quan".
 *
 * Port từ `frappe-sis-frontend/src/pages/Admission/Issues/shared/issueOrgUnits.ts`.
 */

import type { IssueUnitOption } from '../../../services/organizationService';

/**
 * Mọi đơn vị nằm DƯỚI các phòng ban đang chọn (đệ quy, không gồm chính phòng ban).
 * Đây là tập hợp lệ cho ô "Nhóm liên quan".
 */
export function descendantUnitsOf(
  units: IssueUnitOption[],
  parentIds: string[]
): IssueUnitOption[] {
  if (parentIds.length === 0) return [];

  const childrenByParent = new Map<string, IssueUnitOption[]>();
  for (const u of units) {
    if (!u.parent) continue;
    const list = childrenByParent.get(u.parent);
    if (list) list.push(u);
    else childrenByParent.set(u.parent, [u]);
  }

  const out: IssueUnitOption[] = [];
  const seen = new Set<string>(parentIds);
  const queue = [...parentIds];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of childrenByParent.get(current) || []) {
      if (seen.has(child.name)) continue;
      seen.add(child.name);
      out.push(child);
      queue.push(child.name);
    }
  }

  return out;
}

/**
 * Giữ lại những nhóm còn nằm dưới các phòng ban đang chọn.
 * Bỏ một phòng ban thì nhóm con của nó cũng phải rời khỏi lựa chọn.
 */
export function keepGroupsUnderDepartments(
  units: IssueUnitOption[],
  departmentIds: string[],
  groupIds: string[]
): string[] {
  if (groupIds.length === 0) return groupIds;
  const allowed = new Set(descendantUnitsOf(units, departmentIds).map((u) => u.name));
  return groupIds.filter((id) => allowed.has(id));
}
