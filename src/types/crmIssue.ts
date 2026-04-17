/**
 * Kiểu dữ liệu CRM Issue (đồng bộ với frappe-sis-frontend / backend erp.api.crm.issue)
 */

export type CRMIssueStatus = 'Cho duyet' | 'Tiep nhan' | 'Dang xu ly' | 'Hoan thanh';

export type CRMIssueResult =
  | 'Hai long'
  | 'Chua hai long'
  | 'Dong y nhung chua hai long'
  | 'Tiep tuc theo doi';

export type CRMIssueApprovalStatus = 'Cho duyet' | 'Da duyet' | 'Tu choi';

/** Trạng thái SLA — khớp backend CRM Issue */
export type CRMIssueSlaStatus = 'On track' | 'Warning' | 'Breached' | 'Passed';

export const CRM_ISSUE_STATUS_LABELS: Record<CRMIssueStatus, string> = {
  'Cho duyet': 'Chờ duyệt',
  'Tiep nhan': 'Tiếp nhận',
  'Dang xu ly': 'Đang xử lý',
  'Hoan thanh': 'Hoàn thành',
};

export const CRM_ISSUE_APPROVAL_LABELS: Record<CRMIssueApprovalStatus, string> = {
  'Cho duyet': 'Chờ duyệt',
  'Da duyet': 'Đã duyệt',
  'Tu choi': 'Từ chối',
};

export const CRM_ISSUE_APPROVAL_COLORS: Record<CRMIssueApprovalStatus, string> = {
  'Cho duyet': '#F59E0B',
  'Da duyet': '#10B981',
  'Tu choi': '#EF4444',
};

/** Màu đặc trưng trạng thái (dot/chữ) — khớp nền badge */
export const CRM_ISSUE_STATUS_COLORS: Record<CRMIssueStatus, string> = {
  'Cho duyet': '#F5AA1E',
  'Tiep nhan': '#002855',
  'Dang xu ly': '#FFCE02',
  'Hoan thanh': '#BED232',
};

/** Badge phê duyệt — pastel (khác badge trạng thái workflow) */
export const CRM_ISSUE_APPROVAL_BADGE_STYLES: Record<CRMIssueApprovalStatus, { bg: string; text: string }> = {
  'Cho duyet': { bg: '#FFF7ED', text: '#C2410C' },
  'Da duyet': { bg: '#D1FAE5', text: '#047857' },
  'Tu choi': { bg: '#FEE2E2', text: '#B91C1C' },
};

/**
 * Badge trạng thái workflow — nền đặc + chữ trắng/đậm như Ticket HC (getAdminTicketStatusColorClass)
 * Vàng #FFCE02 dùng chữ #002855 để đọc rõ trên nền vàng
 */
export const CRM_ISSUE_STATUS_BADGE_STYLES: Record<CRMIssueStatus, { bg: string; text: string }> = {
  'Cho duyet': { bg: '#F5AA1E', text: '#FFFFFF' },
  'Tiep nhan': { bg: '#002855', text: '#FFFFFF' },
  'Dang xu ly': { bg: '#FFCE02', text: '#002855' },
  'Hoan thanh': { bg: '#BED232', text: '#FFFFFF' },
};

export const CRM_ISSUE_RESULT_LABELS: Record<CRMIssueResult, string> = {
  'Hai long': 'Hài lòng',
  'Chua hai long': 'Chưa hài lòng',
  'Dong y nhung chua hai long': 'Đồng ý nhưng chưa hài lòng',
  'Tiep tuc theo doi': 'Tiếp tục theo dõi',
};

/** Thứ tự option trên web/Frappe: dòng đầu trong Select = rỗng → «Chưa có kết quả» */
export const CRM_ISSUE_RESULT_OPTION_ORDER: readonly (CRMIssueResult | '')[] = [
  '',
  'Hai long',
  'Chua hai long',
  'Dong y nhung chua hai long',
  'Tiep tuc theo doi',
] as const;

/** Style badge kết quả — pill Y tế: nền + chữ, không viền */
export const CRM_ISSUE_RESULT_CHIP_STYLES: Record<CRMIssueResult, { bg: string; text: string }> = {
  'Hai long': { bg: '#F0FDF4', text: '#166534' },
  'Chua hai long': { bg: '#FEF2F2', text: '#991B1B' },
  'Dong y nhung chua hai long': { bg: '#FFFBEB', text: '#92400E' },
  'Tiep tuc theo doi': { bg: '#EFF6FF', text: '#1E40AF' },
};

export const CRM_ISSUE_RESULT_NONE_CHIP_STYLE = { bg: '#F3F4F6', text: '#6B7280' };

/** Nhãn hiển thị kết quả (gồm trạng thái rỗng giống web) */
export function labelForCrmIssueResult(
  value: string | null | undefined,
  noneLabel: string,
): string {
  if (value == null || String(value).trim() === '') return noneLabel;
  const v = value as CRMIssueResult;
  return CRM_ISSUE_RESULT_LABELS[v] ?? String(value);
}

export interface CRMIssueModuleMember {
  name?: string;
  user: string;
  full_name?: string;
}

export interface CRMIssueModule {
  name: string;
  module_name: string;
  code: string;
  sla_hours?: number;
  description?: string;
  is_active: 0 | 1;
  members?: CRMIssueModuleMember[];
  modified?: string;
  member_count?: number;
}

export interface CRMIssueDeptMember {
  name?: string;
  user: string;
  full_name?: string;
  /** Đường dẫn ảnh User (Frappe) — API get_department đã enrich */
  user_image?: string;
}

export interface CRMIssueDepartment {
  name: string;
  department_name: string;
  is_active: 0 | 1;
  members?: CRMIssueDeptMember[];
  modified?: string;
  member_count?: number;
}

/** Viền trái log — API get_issue enrich (khớp web) */
export type CRMIssueLogAccent = 'bod' | 'sales' | 'dept' | 'neutral';

export interface CRMIssueLog {
  name?: string;
  title: string;
  content: string;
  logged_at: string;
  logged_by?: string;
  logged_by_name?: string;
  assignees?: string;
  attachment?: string;
  log_accent?: CRMIssueLogAccent;
  /** Nhãn sau tên: BOD / Phòng TS / tên phòng ban */
  log_source_label?: string;
}

export interface CRMIssueStudentRow {
  name?: string;
  student?: string;
  /** Từ API get_issue (enrich CRM Student) */
  student_display_name?: string;
  /** Lớp theo năm học đang bật (SIS Class.title) */
  student_class_title?: string;
}

/** Thông tin guardian từ Feedback liên kết (API get_linked_feedback_replies) */
export interface LinkedFeedbackGuardianInfo {
  name?: string;
  phone_number?: string;
  email?: string;
}

/** Một dòng reply trong cuộc trao đổi Feedback (staff / phụ huynh) */
export interface LinkedFeedbackReplyRow {
  content: string;
  reply_by: string;
  reply_by_type: 'Guardian' | 'Staff';
  reply_by_full_name?: string | null;
  reply_date: string;
  is_internal?: boolean;
}

/** Payload từ erp.api.crm.issue.get_linked_feedback_replies */
export interface LinkedFeedbackPayload {
  source_feedback: string | null;
  replies: LinkedFeedbackReplyRow[];
  guardian_info: LinkedFeedbackGuardianInfo | null;
}

/** CRM Issue tóm tắt — API get_linked_issue (theo feedback_name) */
export interface LinkedCrmIssueSummary {
  name: string;
  issue_code: string;
  title: string;
  status: CRMIssueStatus;
  approval_status?: CRMIssueApprovalStatus;
  source_feedback?: string;
}

export interface CRMIssue {
  name: string;
  issue_code: string;
  title: string;
  issue_module: string;
  /** Feedback gốc khi issue được tạo từ Góp ý phụ huynh (module FB) */
  source_feedback?: string;
  content: string;
  occurred_at: string;
  attachment?: string;
  pic?: string;
  /** Một phòng ban (legacy) — đồng bộ phần tử đầu issue_departments */
  department?: string;
  /** Bảng con — nhiều phòng ban (khớp web / API) */
  issue_departments?: { department: string; name?: string }[];
  /** get_issues enrich: docname các phòng ban */
  departments?: string[];
  status: CRMIssueStatus;
  result?: CRMIssueResult;
  lead?: string;
  student?: string;
  /** Enrich khi chỉ có trường student (legacy) */
  student_display_name?: string;
  student_class_title?: string;
  issue_students?: CRMIssueStudentRow[];
  process_logs?: CRMIssueLog[];
  creation?: string;
  modified?: string;
  /** Frappe owner — fallback khi created_by_user trống (bản ghi cũ) */
  owner?: string;
  approval_status?: CRMIssueApprovalStatus;
  approved_by_user?: string;
  approved_at?: string;
  approved_by_name?: string;
  rejected_by_user?: string;
  rejected_at?: string;
  rejected_by_name?: string;
  sla_hours?: number;
  sla_deadline?: string;
  sla_status?: CRMIssueSlaStatus;
  sla_started_at?: string;
  first_response_at?: string;
  created_by_user?: string;
  rejection_reason?: string;
  pic_full_name?: string;
  pic_user_image?: string;
  created_by_name?: string;
  created_by_image?: string;
  /** get_issue: quyền thực tế từ Frappe session */
  can_approve_reject?: boolean;
  can_write_issue?: boolean;
  can_edit_sales_status?: boolean;
  can_change_pic?: boolean;
  can_change_department?: boolean;
  can_add_process_log?: boolean;
  can_reply_parent?: boolean;
  /** API get_issue: có thấy scope hàng chờ (khi BE trả ngoài data) */
  can_see_pending_queue_scope?: boolean;
}

export interface CreateIssueData {
  title: string;
  content: string;
  issue_module: string;
  occurred_at?: string;
  lead?: string;
  student?: string;
  students?: string[];
  pic?: string;
  department?: string;
  /** Ưu tiên khi gửi — nhiều CRM Issue Department */
  departments?: string[];
  attachment?: string;
}

export interface IssuePicCandidate {
  user_id: string;
  full_name: string;
  email: string;
  user_image?: string | null;
}

export interface CrmPagination {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}
