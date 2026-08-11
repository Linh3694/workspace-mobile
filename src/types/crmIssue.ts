/**
 * Kiểu dữ liệu CRM Issue (đồng bộ với frappe-sis-frontend / backend erp.api.crm.issue)
 */

/**
 * Trạng thái xử lý. `'Dong'` (Đóng) đã BỎ khỏi luồng — "Hoàn thành" là trạng thái cuối.
 * Giá trị vẫn ở đây (và trong labels/colors) để bản ghi cũ hiển thị đúng; đừng chuyển tới nó.
 * Luồng hợp lệ: xem `screens/CRMIssue/shared/issueStatusTransitions`.
 */
export type CRMIssueStatus = 'Cho duyet' | 'Tiep nhan' | 'Dang xu ly' | 'Hoan thanh' | 'Dong';

export type CRMIssueResult = 'Hai long' | 'Chua hai long';

/** Mức độ — khớp doctype CRM Issue.priority (4 lựa chọn, cao nhất là Khẩn cấp) */
export type CRMIssuePriority = 'Khan cap' | 'Cao' | 'Trung binh' | 'Thap';

/** Thứ tự hiển thị mức độ — cao xuống thấp, khớp web IssueFormV2 */
export const CRM_ISSUE_PRIORITY_ORDER: readonly CRMIssuePriority[] = [
  'Khan cap',
  'Cao',
  'Trung binh',
  'Thap',
] as const;

/**
 * Khoá i18n theo mức độ. Tra bảng thay vì if/else — trước đây nhánh `else` cuối
 * trả "Cao" nên vấn đề mức Khẩn cấp hiển thị sai.
 */
export const CRM_ISSUE_PRIORITY_I18N_KEYS: Record<CRMIssuePriority, string> = {
  'Khan cap': 'crm_issue.priority_urgent',
  Cao: 'crm_issue.priority_high',
  'Trung binh': 'crm_issue.priority_medium',
  Thap: 'crm_issue.priority_low',
};

/** Nhãn mức độ đã dịch; giá trị lạ thì trả nguyên văn, rỗng thì trả '—'. */
export function labelForCrmIssuePriority(
  value: string | null | undefined,
  t: (key: string) => string
): string {
  const raw = (value ?? '').trim();
  if (!raw) return '—';
  const key = CRM_ISSUE_PRIORITY_I18N_KEYS[raw as CRMIssuePriority];
  return key ? t(key) : raw;
}

export type CRMIssueApprovalStatus = 'Cho duyet' | 'Da duyet' | 'Tu choi';

/**
 * Nhóm vấn đề — team care bắt buộc điền trước khi duyệt (backend approve_issue chặn nếu trống).
 *
 * KHÔNG phải union cố định: nhóm là dữ liệu cấu hình (doctype `CRM Issue Group`). Union
 * `'Góp ý' | 'Sự vụ'` cũ chặn mọi nhóm admin tự tạo.
 */
export type CRMIssueGroup = string;

/** @deprecated Chỉ là fallback khi chưa tải được danh sách nhóm từ API */
export const CRM_ISSUE_GROUP_OPTIONS: { value: CRMIssueGroup; label: string }[] = [
  { value: 'Góp ý', label: 'Góp ý' },
  { value: 'Sự vụ', label: 'Sự vụ' },
];

/** Trạng thái SLA — khớp backend CRM Issue */
export type CRMIssueSlaStatus = 'On track' | 'Warning' | 'Breached' | 'Passed';

export const CRM_ISSUE_STATUS_LABELS: Record<CRMIssueStatus, string> = {
  'Cho duyet': 'Chờ duyệt',
  'Tiep nhan': 'Tiếp nhận',
  'Dang xu ly': 'Đang xử lý',
  'Hoan thanh': 'Hoàn thành',
  Dong: 'Đóng',
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
  Dong: '#64748B',
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
  Dong: { bg: '#64748B', text: '#FFFFFF' },
};

export const CRM_ISSUE_RESULT_LABELS: Record<CRMIssueResult, string> = {
  'Hai long': 'Hài lòng',
  'Chua hai long': 'Chưa hài lòng',
};

/** Thứ tự option trên web/Frappe: dòng đầu trong Select = rỗng → «Chưa có kết quả» */
export const CRM_ISSUE_RESULT_OPTION_ORDER: readonly (CRMIssueResult | '')[] = [
  '',
  'Hai long',
  'Chua hai long',
] as const;

/** Style badge kết quả — pill Y tế: nền + chữ, không viền */
export const CRM_ISSUE_RESULT_CHIP_STYLES: Record<CRMIssueResult, { bg: string; text: string }> = {
  'Hai long': { bg: '#F0FDF4', text: '#166534' },
  'Chua hai long': { bg: '#FEF2F2', text: '#991B1B' },
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
  is_manager?: 0 | 1;
}

export interface CRMIssueDepartment {
  name: string;
  department_name: string;
  is_active: 0 | 1;
  members?: CRMIssueDeptMember[];
  modified?: string;
  member_count?: number;
  manager_count?: number;
}

/** Viền trái log — API get_issue enrich (khớp web) */
export type CRMIssueLogAccent = 'bod' | 'sales' | 'dept' | 'neutral';

export interface CRMIssueLog {
  name?: string;
  title?: string;
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

export interface CRMIssueGuardianRow {
  name?: string;
  guardian?: string;
  /** Từ API get_issue (enrich CRM Guardian) */
  guardian_display_name?: string;
  guardian_phone?: string;
}

/** Đơn vị con của phòng ban — bảng `issue_related_groups` */
export interface CRMIssueRelatedGroupRow {
  name?: string;
  unit?: string;
  unit_title?: string;
}

/**
 * Người liên quan của vấn đề.
 * `source = 'manual'` là người được chọn tay; `'auto'` do phòng ban / nhóm kéo vào
 * (muốn bỏ thì bỏ đơn vị tương ứng, không sửa trực tiếp ở đây).
 */
export interface CRMIssueRelatedUser {
  user: string;
  full_name?: string;
  user_image?: string;
  source?: 'manual' | 'auto';
  source_label?: string;
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
  /** Nhóm liên quan — đơn vị con của phòng ban đã chọn */
  issue_related_groups?: CRMIssueRelatedGroupRow[];
  /** Người liên quan (đọc): gồm cả người chọn tay và người do đơn vị kéo vào */
  related_users?: CRMIssueRelatedUser[];
  priority?: CRMIssuePriority;
  /** Nhóm vấn đề: Góp ý / Sự vụ */
  issue_group?: CRMIssueGroup;
  /** Năm học của vấn đề */
  school_year_id?: string;
  school_year_title?: string;
  status: CRMIssueStatus;
  result?: CRMIssueResult;
  lead?: string;
  student?: string;
  /** Enrich khi chỉ có trường student (legacy) */
  student_display_name?: string;
  student_class_title?: string;
  issue_students?: CRMIssueStudentRow[];
  guardian?: string;
  issue_guardians?: CRMIssueGuardianRow[];
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
  created_by_title?: string;
  /** get_issue: quyền thực tế từ Frappe session */
  can_approve_reject?: boolean;
  can_write_issue?: boolean;
  can_edit_sales_status?: boolean;
  can_change_pic?: boolean;
  can_change_department?: boolean;
  can_add_process_log?: boolean;
  can_edit_process_log?: boolean;
  can_reply_parent?: boolean;
  /** Tiếp nhận → Đang xử lý (PIC / team Care / Sales) */
  can_start_processing?: boolean;
  /** Đang xử lý → Hoàn thành. CHỈ team Care — PIC ngoài Care chỉ ghi log được */
  can_complete_issue?: boolean;
  /** Hoàn thành → Đang xử lý (chỉ Care Admin) */
  can_reopen_issue?: boolean;
  /** Sửa được danh sách Người liên quan chọn tay */
  can_edit_related_users?: boolean;
  /** API get_issue: có thấy scope hàng chờ (khi BE trả ngoài data) */
  can_see_pending_queue_scope?: boolean;
}

export interface CreateIssueData {
  title?: string;
  content: string;
  issue_module: string;
  occurred_at?: string;
  /** Docname SIS School Year — bắt buộc như web */
  school_year_id?: string;
  /** Nhóm vấn đề: Góp ý / Sự vụ */
  issue_group?: CRMIssueGroup;
  lead?: string;
  student?: string;
  students?: string[];
  guardian?: string;
  guardians?: string[];
  pic?: string;
  department?: string;
  /** Ưu tiên khi gửi — docname đơn vị Sơ đồ tổ chức */
  departments?: string[];
  /** Nhóm liên quan — đơn vị con của phòng ban đã chọn */
  related_groups?: string[];
  /** Người liên quan chọn tay (email user) */
  related_users?: string[];
  priority: CRMIssuePriority;
  attachment?: string;
}

export interface IssuePicCandidate {
  user_id: string;
  full_name: string;
  email: string;
  user_image?: string | null;
  job_title?: string | null;
}

/** Một người sẽ nhận thông báo — server tính từ phòng ban / nhóm / người liên quan */
export interface IssueParticipant {
  user: string;
  full_name: string;
  user_image?: string;
  source: 'department' | 'group' | 'manual';
  /** Tên đơn vị kéo người này vào ('' nếu được thêm tay) */
  source_label?: string;
}

export interface IssueParticipantsResult {
  participants: IssueParticipant[];
  total: number;
}

export interface IssueRelatedUsersResult {
  related_users: CRMIssueRelatedUser[];
  can_edit_related_users: boolean;
}

export interface CrmPagination {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}
