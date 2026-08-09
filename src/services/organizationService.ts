/**
 * Sơ đồ tổ chức (ERP Organization Unit) — nguồn phòng ban cho Vấn đề chung & Ticket Hành chính.
 *
 * Thay thế `erp.api.crm.issue_department.*` (doctype CRM Issue Department đã bị gỡ khỏi
 * backend). Xem `erp/api/crm/issue.py`: "Phong ban = don vi So do to chuc".
 *
 * Đồng bộ `frappe-sis-frontend/packages/core/src/services/organizationService.ts`.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';

const BASE = '/api/method/erp.api.erp_organization.organization';

/** Cây tổ chức đổi rất ít; giữ tạm để màn danh sách không gọi lại mỗi lần focus. */
const TREE_CACHE_MS = 5 * 60 * 1000;

const getAxiosConfig = async () => {
  const token = await AsyncStorage.getItem('authToken');
  return {
    baseURL: BASE_URL,
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};

function unwrap<T>(response: any): { success: boolean; data?: T; message?: string } {
  const msg = response?.data?.message ?? response?.data;
  if (msg?.success === true) {
    return { success: true, data: msg.data as T, message: msg.message };
  }
  return { success: false, message: msg?.message || response?.data?.exc || 'Lỗi API' };
}

/** Lãnh đạo / thành viên của đơn vị */
export interface OrgUnitPerson {
  user: string;
  full_name?: string;
  emp_code?: string;
  position?: string;
  sort_order?: number;
  user_image?: string | null;
}

export interface OrgUnitType {
  name: string;
  title_vn: string;
  title_en?: string;
  type_order?: number;
  is_active?: number;
}

export interface OrgTreeNode {
  name: string;
  unit_name_vn: string;
  unit_name_en?: string;
  unit_code?: string;
  unit_type?: string;
  parent_organization_unit?: string | null;
  is_group?: number;
  is_active?: number;
  leaders?: OrgUnitPerson[];
  member_count?: number;
  children?: OrgTreeNode[];
}

export interface OrgUnitDetail extends OrgTreeNode {
  members?: OrgUnitPerson[];
}

export interface OrgTreeResponse {
  tree: OrgTreeNode[];
  flat: OrgTreeNode[];
}

/** Đơn vị cho picker Phòng ban / Nhóm liên quan của Vấn đề chung */
export interface IssueUnitOption {
  name: string;
  department_name: string;
  parent: string | null;
  unit_type: string | null;
  /** Loại đơn vị là "Phòng" — chỉ cấp này được chọn ở ô Phòng ban liên quan */
  is_department: boolean;
}

let treeCache: { at: number; data: OrgTreeResponse } | null = null;
let treeInflight: Promise<{ success: boolean; data?: OrgTreeResponse; message?: string }> | null =
  null;

/** Xoá cache cây tổ chức — gọi sau khi biết dữ liệu đơn vị vừa đổi. */
export function invalidateOrgTreeCache(): void {
  treeCache = null;
}

export async function getOrgTree(): Promise<{
  success: boolean;
  data?: OrgTreeResponse;
  message?: string;
}> {
  if (treeCache && Date.now() - treeCache.at < TREE_CACHE_MS) {
    return { success: true, data: treeCache.data };
  }
  if (treeInflight) return treeInflight;

  treeInflight = (async () => {
    try {
      const config = await getAxiosConfig();
      const response = await axios.get(`${BASE}.get_org_tree`, config);
      const out = unwrap<OrgTreeResponse>(response);
      if (out.success && out.data) {
        treeCache = { at: Date.now(), data: out.data };
      }
      return out;
    } catch (e: any) {
      return {
        success: false,
        message: e?.response?.data?.message || e?.message || 'Không tải được sơ đồ tổ chức',
      };
    } finally {
      treeInflight = null;
    }
  })();

  return treeInflight;
}

export async function getOrgUnitTypes(
  includeInactive = true
): Promise<{ success: boolean; data?: OrgUnitType[]; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(
      `${BASE}.get_org_unit_types?include_inactive=${includeInactive ? 1 : 0}`,
      config
    );
    return unwrap<OrgUnitType[]>(response);
  } catch (e: any) {
    return {
      success: false,
      message: e?.response?.data?.message || e?.message || 'Không tải được loại đơn vị',
    };
  }
}

export async function getOrgUnitDetail(
  name: string
): Promise<{ success: boolean; data?: OrgUnitDetail; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(
      `${BASE}.get_org_unit_detail?name=${encodeURIComponent(name)}`,
      config
    );
    return unwrap<OrgUnitDetail>(response);
  } catch (e: any) {
    return {
      success: false,
      message: e?.response?.data?.message || e?.message || 'Không tải được chi tiết đơn vị',
    };
  }
}

function stripDiacritics(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Loại đơn vị cấp "Phòng" (Department) — khớp nhãn cấu hình ở Sơ đồ tổ chức. */
function isDepartmentUnitType(type: OrgUnitType): boolean {
  const vn = stripDiacritics(type.title_vn || '')
    .toLowerCase()
    .trim();
  const en = (type.title_en || '').toLowerCase().trim();
  return vn === 'phong' || vn.startsWith('phong ') || en === 'department';
}

/**
 * Đơn vị phẳng cho picker Phòng ban + Nhóm liên quan.
 * Giữ `parent` để lọc nhóm con của phòng ban đang chọn mà không phải gọi thêm API.
 */
export async function getIssueUnitOptions(): Promise<{
  success: boolean;
  data: IssueUnitOption[];
  message?: string;
}> {
  const [res, typeRes] = await Promise.all([getOrgTree(), getOrgUnitTypes(true)]);
  if (!res.success || !res.data) {
    return { success: false, data: [], message: res.message };
  }
  const types = typeRes.success && Array.isArray(typeRes.data) ? typeRes.data : [];
  const departmentTypes = new Set(types.filter(isDepartmentUnitType).map((t) => t.name));
  // Chưa khai loại "Phòng" (đổi tên / chưa cấu hình) → coi mọi đơn vị là chọn được,
  // thà rộng còn hơn picker trống không chọn nổi gì.
  const noDepartmentType = departmentTypes.size === 0;

  return {
    success: true,
    data: (res.data.flat || []).map((u) => ({
      name: u.name,
      department_name: u.unit_name_vn,
      parent: u.parent_organization_unit ?? null,
      unit_type: u.unit_type ?? null,
      is_department: noDepartmentType || (!!u.unit_type && departmentTypes.has(u.unit_type)),
    })),
  };
}

/**
 * Như `getIssueUnitOptions` nhưng rút gọn về shape cũ `{ name, department_name }`
 * để chỗ dùng cũ (Ticket Hành chính) không phải sửa theo.
 */
export async function getIssueDepartmentOptions(): Promise<{
  success: boolean;
  data: { name: string; department_name: string }[];
  message?: string;
}> {
  const res = await getOrgTree();
  if (!res.success || !res.data) {
    return { success: false, data: [], message: res.message };
  }
  return {
    success: true,
    data: (res.data.flat || []).map((u) => ({
      name: u.name,
      department_name: u.unit_name_vn,
    })),
  };
}

/** Nhãn đơn vị theo docname — dựng một lần rồi tra, tránh gọi chi tiết từng đơn vị. */
export async function getOrgUnitLabelMap(): Promise<Record<string, string>> {
  const res = await getOrgTree();
  const map: Record<string, string> = {};
  for (const u of res.data?.flat || []) {
    map[u.name] = u.unit_name_vn || u.name;
  }
  return map;
}

/** Email lãnh đạo + thành viên của một đơn vị (bỏ trùng, giữ thứ tự lãnh đạo trước). */
export async function getOrgUnitMemberEmails(name: string): Promise<string[]> {
  const res = await getOrgUnitDetail(name);
  if (!res.success || !res.data) return [];
  const emails: string[] = [];
  const seen = new Set<string>();
  for (const row of [...(res.data.leaders || []), ...(res.data.members || [])]) {
    const u = (row.user || '').trim();
    if (u && !seen.has(u)) {
      seen.add(u);
      emails.push(u);
    }
  }
  return emails;
}

/** Lãnh đạo + thành viên của một đơn vị (bỏ trùng theo user). */
export async function getOrgUnitPeople(name: string): Promise<OrgUnitPerson[]> {
  const res = await getOrgUnitDetail(name);
  if (!res.success || !res.data) return [];
  const rows: OrgUnitPerson[] = [];
  const seen = new Set<string>();
  for (const row of [...(res.data.leaders || []), ...(res.data.members || [])]) {
    const u = (row.user || '').trim();
    if (u && !seen.has(u)) {
      seen.add(u);
      rows.push(row);
    }
  }
  return rows;
}
