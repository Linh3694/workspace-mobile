import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';
import type {
  CRMIssue,
  CRMIssueDepartment,
  CRMIssueModule,
  CRMIssueResult,
  CRMIssueStatus,
  CreateIssueData,
  CrmPagination,
  IssuePicCandidate,
  LinkedFeedbackPayload,
  LinkedCrmIssueSummary,
} from '../types/crmIssue';
import { addFeedbackReply } from './feedbackService';
import { getIssueDepartmentDocnames } from '../utils/crmIssuePermissions';

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
const DEPT_BASE = '/api/method/erp.api.crm.issue_department';

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
} {
  const msg = response?.data?.message ?? response?.data;
  if (msg?.success === true) {
    const scope = msg.can_see_pending_queue_scope;
    return {
      success: true,
      data: msg.data as T,
      message: msg.message,
      pagination: msg.pagination,
      ...(typeof scope === 'boolean' ? { can_see_pending_queue_scope: scope } : {}),
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
  /** Chỉ issue có phòng ban mà user là thành viên — tab Liên quan (khớp web) */
  only_my_departments?: boolean | number | string;
  approval_status?: string;
  page?: number;
  per_page?: number;
}

export async function getIssues(params?: GetIssuesParams): Promise<{
  success: boolean;
  data?: CRMIssue[];
  pagination?: CrmPagination;
  message?: string;
}> {
  try {
    const config = await getAxiosConfig();
    const q = new URLSearchParams();
    if (params?.student_id) q.append('student_id', params.student_id);
    if (params?.lead_name) q.append('lead_name', params.lead_name);
    if (params?.status) q.append('status', params.status);
    if (params?.issue_module) q.append('issue_module', params.issue_module);
    if (params?.department) q.append('department', params.department);
    if (params?.only_my_departments != null && params.only_my_departments !== false) {
      q.append('only_my_departments', '1');
    }
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
}): Promise<{ success: boolean; data?: CRMIssue[]; pagination?: CrmPagination; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const q = new URLSearchParams();
    if (params?.page) q.append('page', String(params.page));
    if (params?.per_page) q.append('per_page', String(params.per_page));
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
  const emails = new Set<string>();
  for (const id of ids) {
    try {
      const dep = await getDepartment(id);
      if (dep.success && dep.data?.members) {
        for (const m of dep.data.members) {
          if (m.user) emails.add(String(m.user).trim());
        }
      }
    } catch {
      /* bỏ qua phòng ban lỗi */
    }
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
  data: Partial<CRMIssue> & { name: string; students?: string[]; departments?: string[] }
): Promise<{ success: boolean; data?: CRMIssue; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`${ISSUE_BASE}.update_issue`, data, config);
    return unwrap<CRMIssue>(response);
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi cập nhật' };
  }
}

export async function approveIssue(
  name: string
): Promise<{ success: boolean; data?: CRMIssue; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`${ISSUE_BASE}.approve_issue`, { name }, config);
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
): Promise<{ success: boolean; data?: CRMIssue; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const payload: Record<string, unknown> = { name, status };
    if (result !== undefined) payload.result = result;
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
  title: string;
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

export async function getIssuePicCandidates(): Promise<{
  success: boolean;
  data?: IssuePicCandidate[];
  message?: string;
}> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${ISSUE_BASE}.get_issue_pic_candidates`, config);
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

export async function getDepartments(): Promise<{
  success: boolean;
  data?: CRMIssueDepartment[];
  message?: string;
}> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${DEPT_BASE}.get_departments?is_active=1`, config);
    const msg = response?.data?.message ?? response?.data;
    if (msg?.success === true && Array.isArray(msg.data)) {
      return { success: true, data: msg.data as CRMIssueDepartment[] };
    }
    return { success: false, message: msg?.message || 'Không lấy được phòng ban' };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e?.message || 'Lỗi kết nối' };
  }
}

export async function getDepartment(
  name: string
): Promise<{ success: boolean; data?: CRMIssueDepartment; message?: string }> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(
      `${DEPT_BASE}.get_department?name=${encodeURIComponent(name)}`,
      config
    );
    return unwrap<CRMIssueDepartment>(response);
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
