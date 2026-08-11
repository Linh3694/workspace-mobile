import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';
import type {
  CRMIssue,
  CRMIssueDepartment,
  CRMIssueDeptMember,
  CRMIssueModule,
  CRMIssueResult,
  CRMIssueStatus,
  CreateIssueData,
  CrmPagination,
  IssueParticipantsResult,
  IssuePicCandidate,
  IssueRelatedUsersResult,
  LinkedFeedbackPayload,
  LinkedCrmIssueSummary,
} from '../types/crmIssue';
import { addFeedbackReply } from './feedbackService';
import { getIssueDepartmentDocnames } from '../utils/crmIssuePermissions';
import {
  getIssueDepartmentOptions,
  getOrgUnitDetail,
  getOrgUnitMemberEmails,
} from './organizationService';

const getAxiosConfig = async (additionalConfig: { headers?: Record<string, string> } = {}) => {
  const token = await AsyncStorage.getItem('authToken');
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return {
    baseURL: BASE_URL,
    timeout: 60000,
    ...additionalConfig,
    headers: { ...defaultHeaders, ...(additionalConfig.headers || {}) },
  };
};

const ISSUE_BASE = '/api/method/erp.api.crm.issue';
const MODULE_BASE = '/api/method/erp.api.crm.issue_module';
const GROUP_BASE = '/api/method/erp.api.crm.issue_group';
// Phòng ban KHÔNG còn doctype riêng: `erp.api.crm.issue_department` đã bị gỡ khỏi backend,
// nay là đơn vị Sơ đồ tổ chức — xem `organizationService`.

/** Chuẩn hoá 1 dòng issue từ API (snake_case / camelCase tuỳ proxy) */
function normalizeCrmIssueRow(raw: Record<string, unknown>): CRMIssue {
  const o = { ...raw };
  if (o.created_by_name == null && o.createdByName != null) o.created_by_name = o.createdByName;
  if (o.created_by_user == null && o.createdByUser != null) o.created_by_user = o.createdByUser;
  if (o.source_feedback == null && o.sourceFeedback != null) o.source_feedback = o.sourceFeedback;
  if (o.sla_started_at == null && o.slaStartedAt != null) o.sla_started_at = o.slaStartedAt;
  if (o.first_response_at == null && o.firstResponseAt != null) o.first_response_at = o.firstResponseAt;
  if (o.sla_status == null && o.slaStatus != null) o.sla_status = o.slaStatus;
  if (o.owner == null && o.Owner != null) o.owner = o.Owner;
  delete o.createdByName;
  delete o.createdByUser;
  delete o.sourceFeedback;
  delete o.slaStartedAt;
  delete o.firstResponseAt;
  delete o.slaStatus;
  delete o.Owner;
  return o as unknown as CRMIssue;
}

function mapIssueList(data: CRMIssue[] | undefined): CRMIssue[] | undefined {
  if (!data?.length) return data;
  return data.map((row) => normalizeCrmIssueRow(row as unknown as Record<string, unknown>));
}

/** Trích payload chuẩn từ response Frappe */
function unwrap<T>(response: any): {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: CrmPagination;
  /** Field phụ từ message (không nằm trong data) — gộp vào issue khi get_issue */
  can_see_pending_queue_scope?: boolean;
  /** get_issues: user có thuộc đơn vị liên quan nào không — quyết định tab "Liên quan" */
  is_department_member?: boolean;
} {
  const msg = response?.data?.message ?? response?.data;
  if (msg?.success === true) {
    const scope = msg.can_see_pending_queue_scope;
    const isDeptMember = msg.is_department_member;
    return {
      success: true,
      data: msg.data as T,
      message: msg.message,
      pagination: msg.pagination,
      ...(typeof scope === 'boolean' ? { can_see_pending_queue_scope: scope } : {}),
      ...(typeof isDeptMember === 'boolean' ? { is_department_member: isDeptMember } : {}),
    };
  }
  return {
    success: false,
    message: msg?.message || response?.data?.exc || 'Lỗi API',
  };
}

export interface GetIssuesParams {
  student_id?: string;
  lead_name?: string;
  status?: CRMIssueStatus;
  issue_module?: string;
  department?: string;
  /** Docname SIS School Year */
  school_year_id?: string;
  /** Chỉ issue có phòng ban mà user là thành viên — tab Liên quan (khớp web) */
  only_my_departments?: boolean | number | string;
  /** Tab "Của tôi": user là PIC HOẶC người tạo (server đọc theo session) */
  mine?: boolean | number | string;
  /** Lọc riêng theo người thực hiện */
  pic?: string;
  approval_status?: string;
  /** Tìm theo mã / tiêu đề / học sinh / phụ huynh trên TOÀN BỘ dữ liệu (server-side) */
  search?: string;
  page?: number;
  per_page?: number;
}

export async function getIssues(params?: GetIssuesParams): Promise<{
  success: boolean;
  data?: CRMIssue[];
  pagination?: CrmPagination;
  message?: string;
  is_department_member?: boolean;
}> {
  try {
    const config = await getAxiosConfig();
    const q = new URLSearchParams();
    if (params?.student_id) q.append('student_id', params.student_id);
    if (params?.lead_name) q.append('lead_name', params.lead_name);
    if (params?.status) q.append('status', params.status);
    if (params?.issue_module) q.append('issue_module', params.issue_module);
    if (params?.department) q.append('department', params.department);
    if (params?.school_year_id) q.append('school_year_id', params.school_year_id);
    if (params?.pic) q.append('pic', params.pic);
    if (params?.only_my_departments != null && params.only_my_departments !== false) {
      q.append('only_my_departments', '1');
    }
    if (params?.mine != null && params.mine !== false) q.append('mine', '1');
    if (params?.search?.trim()) q.append('search', params.search.trim());
    if (params?.approval_status) q.append('approval_status', params.approval_status);
    if (params?.page) q.append('page', String(params.page));
    if (params?.per_page) q.append('per_page', String(params.per_page));
    const qs = q.toString();
    const url = `${ISSUE_BASE}.get_issues${qs ? `?${qs}` : ''}`;
    const response = await axios.get(url, config);
    const out = unwrap<CRMIssue[]>(response);
    if (out.success && out.data) {
      return { ...out, data: mapIssueList(out.data) };
    }
    return out;
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

export async function getPendingIssues(params?: {
  page?: number;
  per_page?: number;
  search?: string;
}): Promise<{ success: boolean; data?: CRMIssue[]; pagination?: CrmPagination; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const q = new URLSearchParams();
    if (params?.page) q.append('page', String(params.page));
    if (params?.per_page) q.append('per_page', String(params.per_page));
    if (params?.search?.trim()) q.append('search', params.search.trim());
    const qs = q.toString();
    const url = `${ISSUE_BASE}.get_pending_issues${qs ? `?${qs}` : ''}`;
    const response = await axios.get(url, config);
    const out = unwrap<CRMIssue[]>(response);
    if (out.success && out.data) {
      return { ...out, data: mapIssueList(out.data) };
    }
    return out;
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

/** Gom email thành viên tất cả phòng ban gắn issue — dùng cho canWriteCrmIssue */
export async function collectDepartmentMemberEmailsForIssue(
  issue: Pick<CRMIssue, 'department' | 'issue_departments'>
): Promise<string[]> {
  const ids = getIssueDepartmentDocnames(issue as CRMIssue);
  // Các đơn vị độc lập nhau → gọi song song thay vì tuần tự như trước.
  const lists = await Promise.all(
    ids.map((id) => getOrgUnitMemberEmails(id).catch(() => [] as string[]))
  );
  const emails = new Set<string>();
  for (const list of lists) {
    for (const email of list) emails.add(email.trim());
  }
  return [...emails];
}

export async function getIssue(
  name: string
): Promise<{ success: boolean; data?: CRMIssue; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const url = `${ISSUE_BASE}.get_issue?name=${encodeURIComponent(name)}`;
    const response = await axios.get(url, config);
    const out = unwrap<CRMIssue>(response);
    if (out.success && out.data) {
      let row = normalizeCrmIssueRow(out.data as unknown as Record<string, unknown>);
      // Giữ cờ scope hàng chờ nếu BE trả ngoài data (khớp web)
      if (typeof out.can_see_pending_queue_scope === 'boolean') {
        row = { ...row, can_see_pending_queue_scope: out.can_see_pending_queue_scope };
      }
      return {
        ...out,
        data: row,
      };
    }
    return out;
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

export async function createIssue(
  data: CreateIssueData
): Promise<{ success: boolean; data?: CRMIssue; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`${ISSUE_BASE}.create_issue`, data, config);
    return unwrap<CRMIssue>(response);
  } catch (e: any) {
    return {
      success: false,
      message: e?.response?.data?.message || e?.message || 'Lỗi tạo vấn đề',
    };
  }
}

export async function updateIssue(
  // `related_users` khi ĐỌC là CRMIssueRelatedUser[]; khi GHI chỉ gửi danh sách email.
  data: Omit<Partial<CRMIssue>, 'related_users'> & {
    name: string;
    students?: string[];
    guardians?: string[];
    departments?: string[];
    /** Nhóm liên quan — đơn vị con của phòng ban đã chọn */
    related_groups?: string[];
    /** Người liên quan chọn tay */
    related_users?: string[];
  }
): Promise<{ success: boolean; data?: CRMIssue; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`${ISSUE_BASE}.update_issue`, data, config);
    return unwrap<CRMIssue>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi cập nhật' };
  }
}

/**
 * Duyệt vấn đề. Backend BẮT BUỘC `departments` và `issue_group` — thiếu là 400,
 * nên UI phải chốt hai field này trước khi gọi (xem ApproveIssueSheet).
 */
export async function approveIssue(
  name: string,
  data?: {
    departments?: string[];
    department?: string;
    /** Nhóm liên quan — đơn vị con của phòng ban đã chọn */
    related_groups?: string[];
    /** Người liên quan chọn tay */
    related_users?: string[];
    pic?: string;
    priority?: string;
    issue_group?: string;
  }
): Promise<{ success: boolean; data?: CRMIssue; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`${ISSUE_BASE}.approve_issue`, { name, ...(data || {}) }, config);
    return unwrap<CRMIssue>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi duyệt' };
  }
}

export async function rejectIssue(
  name: string,
  reason?: string
): Promise<{ success: boolean; data?: CRMIssue; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`${ISSUE_BASE}.reject_issue`, { name, reason }, config);
    return unwrap<CRMIssue>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi từ chối' };
  }
}

export async function changeIssueStatus(
  name: string,
  status: CRMIssueStatus,
  result?: CRMIssueResult | '',
  /** Ghi chú kèm theo — backend ghi thành một dòng log "Cập nhật xử lý" */
  note?: string,
): Promise<{ success: boolean; data?: CRMIssue; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const payload: Record<string, unknown> = { name, status };
    if (result !== undefined) payload.result = result;
    if (note?.trim()) payload.note = note.trim();
    const response = await axios.post(`${ISSUE_BASE}.change_issue_status`, payload, config);
    return unwrap<CRMIssue>(response);
  } catch (e: any) {
    return {
      success: false,
      message: e?.response?.data?.message || e?.message || 'Lỗi đổi trạng thái',
    };
  }
}

export async function addProcessLog(data: {
  issue_name: string;
  title?: string;
  content: string;
  logged_at?: string;
  assignees?: string;
  attachment?: string;
}): Promise<{ success: boolean; data?: CRMIssue; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`${ISSUE_BASE}.add_process_log`, data, config);
    return unwrap<CRMIssue>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi thêm log' };
  }
}

/** Cập nhật log xử lý — đồng bộ web IssueDetail */
export async function updateProcessLog(data: {
  issue_name: string;
  log_name?: string;
  log_idx?: number;
  title?: string;
  content?: string;
  assignees?: string;
  attachment?: string;
}): Promise<{ success: boolean; data?: CRMIssue; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`${ISSUE_BASE}.update_process_log`, data, config);
    return unwrap<CRMIssue>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi cập nhật log' };
  }
}

/**
 * Ứng viên PIC. Truyền `issue` để server bổ sung Team phòng ban của vấn đề đó (khớp web).
 */
export async function getIssuePicCandidates(issue?: string): Promise<{
  success: boolean;
  data?: IssuePicCandidate[];
  message?: string;
}> {
  try {
    const config = await getAxiosConfig();
    const url = issue
      ? `${ISSUE_BASE}.get_issue_pic_candidates?issue=${encodeURIComponent(issue)}`
      : `${ISSUE_BASE}.get_issue_pic_candidates`;
    const response = await axios.get(url, config);
    const msg = response?.data?.message ?? response?.data;
    if (msg?.success === true && Array.isArray(msg.data)) {
      return { success: true, data: msg.data as IssuePicCandidate[] };
    }
    if (Array.isArray(msg)) {
      return { success: true, data: msg as IssuePicCandidate[] };
    }
    return { success: false, message: msg?.message || 'Không lấy được danh sách PIC' };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

export async function getModules(): Promise<{
  success: boolean;
  data?: CRMIssueModule[];
  message?: string;
}> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${MODULE_BASE}.get_modules?is_active=1`, config);
    const msg = response?.data?.message ?? response?.data;
    if (msg?.success === true && Array.isArray(msg.data)) {
      return { success: true, data: msg.data as CRMIssueModule[] };
    }
    return { success: false, message: msg?.message || 'Không lấy được loại vấn đề' };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

/**
 * Danh sách Nhóm vấn đề đang bật.
 *
 * Nhóm là dữ liệu cấu hình (doctype `CRM Issue Group`), KHÔNG phải hằng số. Trước đây sheet
 * duyệt trên mobile hiện cứng "Góp ý / Sự vụ" nên mọi nhóm admin tự tạo (vd "Hỗ trợ") không
 * chọn được, và vấn đề đang mang nhóm đó không duyệt được từ mobile.
 */
export async function getIssueGroups(): Promise<{
  success: boolean;
  data?: { name: string; group_name: string; group_name_en?: string }[];
  message?: string;
}> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${GROUP_BASE}.get_groups?is_active=1`, config);
    const msg = response?.data?.message ?? response?.data;
    if (msg?.success === true && Array.isArray(msg.data)) {
      return { success: true, data: msg.data };
    }
    return { success: false, message: msg?.message || 'Không lấy được nhóm vấn đề' };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

export async function getModule(
  name: string
): Promise<{ success: boolean; data?: CRMIssueModule; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(
      `${MODULE_BASE}.get_module?name=${encodeURIComponent(name)}`,
      config
    );
    return unwrap<CRMIssueModule>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

/**
 * Danh sách phòng ban — nay là đơn vị Sơ đồ tổ chức.
 * Giữ nguyên shape `CRMIssueDepartment` để nơi gọi không phải sửa theo.
 */
export async function getDepartments(): Promise<{
  success: boolean;
  data?: CRMIssueDepartment[];
  message?: string;
}> {
  const res = await getIssueDepartmentOptions();
  if (!res.success) {
    return { success: false, message: res.message || 'Không lấy được phòng ban' };
  }
  return {
    success: true,
    data: res.data.map((u) => ({
      name: u.name,
      department_name: u.department_name,
      is_active: 1 as const,
    })),
  };
}

/** Chi tiết một phòng ban (đơn vị) kèm thành viên — lãnh đạo xếp trước. */
export async function getDepartment(
  name: string
): Promise<{ success: boolean; data?: CRMIssueDepartment; message?: string }> {
  const res = await getOrgUnitDetail(name);
  if (!res.success || !res.data) {
    return { success: false, message: res.message || 'Không lấy được phòng ban' };
  }
  const unit = res.data;
  const members: CRMIssueDeptMember[] = [];
  const seen = new Set<string>();
  for (const row of [...(unit.leaders || []), ...(unit.members || [])]) {
    const u = (row.user || '').trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    members.push({
      user: u,
      full_name: row.full_name,
      user_image: row.user_image || undefined,
      // Lãnh đạo đơn vị = quản lý phòng ban (bảng `leaders` của ERP Organization Unit)
      is_manager: (unit.leaders || []).some((l) => (l.user || '').trim() === u) ? 1 : 0,
    });
  }
  return {
    success: true,
    data: {
      name: unit.name,
      department_name: unit.unit_name_vn || unit.name,
      is_active: unit.is_active === 0 ? 0 : 1,
      members,
      member_count: members.length,
      manager_count: members.filter((m) => m.is_manager === 1).length,
    },
  };
}

/**
 * Xem trước người sẽ nhận thông báo theo lựa chọn đang nhập (chưa lưu).
 * Server tính bằng đúng logic gửi thật nên preview không lệch thực tế.
 */
export async function previewIssueParticipants(data: {
  departments?: string[];
  related_groups?: string[];
  related_users?: string[];
}): Promise<{ success: boolean; data?: IssueParticipantsResult; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`${ISSUE_BASE}.preview_issue_participants`, data, config);
    return unwrap<IssueParticipantsResult>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

/** Nhóm người liên quan của vấn đề + có quyền sửa nhóm hay không */
export async function getIssueRelatedUsers(name: string): Promise<{
  success: boolean;
  data?: IssueRelatedUsersResult;
  message?: string;
}> {
  try {
    const config = await getAxiosConfig();
    const url = `${ISSUE_BASE}.get_issue_related_users?name=${encodeURIComponent(name)}`;
    const response = await axios.get(url, config);
    return unwrap<IssueRelatedUsersResult>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

/** Ghi đè toàn bộ nhóm người liên quan chọn tay (danh sách email user) */
export async function setIssueRelatedUsers(
  name: string,
  users: string[]
): Promise<{ success: boolean; data?: IssueRelatedUsersResult; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(
      `${ISSUE_BASE}.set_issue_related_users`,
      { name, users },
      config
    );
    return unwrap<IssueRelatedUsersResult>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

/** Đơn vị Sơ đồ tổ chức mà user hiện tại thuộc — tab "Liên quan" (1 lời gọi, khớp web). */
export async function getMyIssueUnits(): Promise<{
  success: boolean;
  data?: string[];
  message?: string;
}> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${ISSUE_BASE}.get_my_issue_units`, config);
    return unwrap<string[]>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

/** Kết quả tìm CRM Student — có lớp hiện tại (khớp web) */
export type CrmStudentSearchHit = {
  name: string;
  student_name: string;
  student_code: string;
  /** Tên lớp hiện tại — field `current_class_title` trên CRM Student */
  current_class_title?: string;
};

/** Tìm CRM Student — dùng whitelisted API giống web (tránh 417 permission) */
export async function searchCrmStudents(searchTerm: string): Promise<{
  success: boolean;
  data: CrmStudentSearchHit[];
  message?: string;
}> {
  const term = (searchTerm || '').trim();
  if (term.length < 2) {
    return { success: true, data: [] };
  }
  try {
    const config = await getAxiosConfig();
    const url = `/api/method/erp.api.erp_sis.student.search_students?search_term=${encodeURIComponent(term)}`;
    const response = await axios.get(url, config);
    const msg = response?.data?.message ?? response?.data;
    const raw: any[] = msg?.success === true && Array.isArray(msg.data) ? msg.data : [];

    const data: CrmStudentSearchHit[] = raw
      .filter((r: any) => r?.name)
      .map((r: any) => ({
        name: r.name,
        student_name: r.student_name || '',
        student_code: r.student_code || '',
        current_class_title:
          typeof r.current_class_title === 'string' && r.current_class_title.trim()
            ? r.current_class_title.trim()
            : undefined,
      }));

    return { success: true, data };
  } catch (e: any) {
    console.warn('searchCrmStudents:', e?.message);
    return { success: false, data: [], message: e?.message || 'Không tìm được học sinh CRM' };
  }
}

/** Upload file đính kèm — trả về đường dẫn/file URL cho field attachment */
export async function uploadIssueAttachment(
  uri: string,
  fileName: string,
  mimeType?: string
): Promise<{ success: boolean; fileUrl?: string; message?: string }> {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: fileName || 'upload.jpg',
      type: mimeType || 'application/octet-stream',
    } as any);
    formData.append('is_private', '1');

    const response = await axios.post(`${BASE_URL}/api/method/upload_file`, formData, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000,
    });

    const msg = response?.data?.message;
    const fileUrl = typeof msg === 'object' && msg?.file_url ? msg.file_url : msg;
    if (fileUrl) {
      return { success: true, fileUrl: String(fileUrl) };
    }
    return { success: false, message: 'Không nhận được URL file' };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi upload' };
  }
}

/**
 * Lấy lịch sử trao đổi với phụ huynh (Feedback) khi CRM Issue có source_feedback.
 */
export async function getLinkedFeedbackReplies(issueName: string): Promise<{
  success: boolean;
  data?: LinkedFeedbackPayload;
  message?: string;
}> {
  try {
    const config = await getAxiosConfig();
    const url = `${ISSUE_BASE}.get_linked_feedback_replies?issue_name=${encodeURIComponent(issueName)}`;
    const response = await axios.get(url, config);
    return unwrap<LinkedFeedbackPayload>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

/**
 * CRM Issue có source_feedback = feedback_name (web/mobile Feedback detail).
 */
export async function getLinkedIssue(feedbackName: string): Promise<{
  success: boolean;
  data?: LinkedCrmIssueSummary | null;
  message?: string;
}> {
  try {
    const config = await getAxiosConfig();
    const url = `${ISSUE_BASE}.get_linked_issue?feedback_name=${encodeURIComponent(feedbackName)}`;
    const response = await axios.get(url, config);
    return unwrap<LinkedCrmIssueSummary | null>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

/**
 * Gửi phản hồi tới phụ huynh qua Feedback (staff) — reuse API erp_sis.feedback.add_reply.
 */
export async function addStaffReplyToFeedback(
  feedbackName: string,
  content: string,
  attachments?: { uri: string; name: string; type: string }[],
): Promise<{ success: boolean; message?: string }> {
  return addFeedbackReply(feedbackName, content, false, attachments || []);
}
