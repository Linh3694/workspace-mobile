/**
 * Kiểu dữ liệu module Quản lý dự án (PM) cho app.
 *
 * Bản này bám sát `frappe-sis-frontend/packages/core/src/types/projectManagement.ts`
 * — CÙNG một backend, nên tên field phải giống hệt. Sửa một bên mà quên bên kia
 * thì hai client hiểu khác nhau về cùng một bản ghi.
 *
 * File này THUẦN DỮ LIỆU. Nhãn, màu và bảng tra trạng thái nằm ở
 * `screens/ProjectManagement/pmStatus.ts` — cùng quy ước với `deviceStatus.ts`
 * của module Thiết bị. Bản web gộp cả hai vào một file và kèm bảng hex
 * `BRAND_COLORS`; app này white-label nên hex viết thẳng sẽ không đổi theo tenant.
 */

// ==================== ENUM ====================

export type ProjectStatus = 'active' | 'archived';
export type ProjectVisibility = 'private' | 'internal';
export type ProjectRole = 'owner' | 'manager' | 'member' | 'viewer';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Loại issue. Cấp Epic KHÔNG nằm ở đây — Epic là `PM Requirement`, nối vào task
 * qua `requirement_id`. Phân cấp đầy đủ: Requirement (Epic) → Task → Subtask,
 * và chỉ một tầng subtask.
 */
export type TaskType = 'task' | 'bug' | 'story';

export type RequirementStatus = 'new' | 'approved' | 'rejected';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type TargetType = 'project' | 'requirement' | 'task' | 'member';
export type InviteRole = 'manager' | 'member' | 'viewer';
export type DueDateFilter = 'all' | 'overdue' | 'today' | 'this_week' | 'no_deadline';

export const TASK_TYPES: readonly TaskType[] = ['task', 'bug', 'story'] as const;
export const BOARD_STATUSES: readonly TaskStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done',
] as const;

// ==================== DỰ ÁN ====================

export interface PMProject {
  name: string;
  title: string;
  description?: string;
  owner_id: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  campus_id?: string;
  creation: string;
  modified: string;
  // Field server enrich thêm
  owner_full_name?: string;
  owner_image?: string;
  members?: PMProjectMember[];
  member_count?: number;
  task_count?: number;
  current_user_role?: ProjectRole;
}

export interface PMProjectMember {
  name: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  joined_at: string;
  full_name?: string;
  email?: string;
  user_image?: string;
}

// ==================== LỜI MỜI ====================

export interface PMProjectInvitation {
  name: string;
  project_id: string;
  inviter_id: string;
  invitee_id: string;
  role: InviteRole;
  status: InvitationStatus;
  expires_at: string;
  message?: string;
  creation: string;
  project_title?: string;
  inviter_full_name?: string;
  inviter_image?: string;
  invitee_full_name?: string;
  invitee_email?: string;
  invitee_image?: string;
}

// ==================== CÔNG VIỆC ====================

export interface PMTask {
  name: string;
  project_id: string;
  requirement_id?: string;
  /** Có giá trị nghĩa là bản ghi này là subtask. Subtask không có subtask. */
  parent_task_id?: string | null;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  created_by?: string;
  due_date?: string;
  tags?: string;
  order_index: number;
  creation: string;
  modified: string;
  // Field server enrich thêm
  assignees?: PMTaskAssignee[];
  created_by_full_name?: string;
  created_by_image?: string;
  project_title?: string;
  comment_count?: number;
  attachment_count?: number;
  requirement_title?: string;
  requirement_status?: RequirementStatus;
  requirement_priority?: TaskPriority;
  subtask_count?: number;
  subtask_done_count?: number;
  parent_title?: string;
  parent_type?: TaskType;
  parent_status?: TaskStatus;
  /** Chỉ `get_task` trả về — bảng và tìm kiếm không kèm, để tránh N+1. */
  subtasks?: PMTask[];
}

export interface PMTaskAssignee {
  name: string;
  task_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by?: string;
  full_name?: string;
  user_image?: string;
}

export interface PMTaskComment {
  name: string;
  task_id: string;
  /**
   * Nhắc tên nhúng thẳng trong nội dung theo cú pháp `@[Tên hiển thị](email)`.
   * Backend parse đúng cú pháp này (`resolve_mentioned_members`) — gõ khác đi
   * thì người được nhắc không nhận được thông báo.
   */
  comment_text: string;
  created_by: string;
  creation_date: string;
  creation: string;
  modified: string;
  created_by_full_name?: string;
  created_by_image?: string;
  /** Server trả về sau khi đã đối chiếu với thành viên dự án — đừng tin chuỗi thô. */
  mentioned_users?: string[];
}

// ==================== YÊU CẦU (EPIC) ====================

export interface PMRequirement {
  name: string;
  project_id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: RequirementStatus;
  created_by?: string;
  creation: string;
  modified: string;
  created_by_full_name?: string;
  created_by_image?: string;
  resource_count?: number;
  resources?: PMResource[];
  task_count?: number;
  completed_task_count?: number;
}

// ==================== CUỘC HỌP ====================

export interface PMMeetingAttendee {
  user_id: string;
  attended: boolean;
  full_name?: string;
  user_image?: string;
  email?: string;
}

export interface PMMeeting {
  name: string;
  project_id: string;
  title: string;
  description?: string;
  meeting_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  minutes?: string;
  action_items?: string;
  created_by: string;
  creation: string;
  modified: string;
  attendees?: PMMeetingAttendee[];
  created_by_full_name?: string;
  created_by_image?: string;
}

// ==================== TÀI LIỆU ====================

export interface PMResource {
  name: string;
  project_id: string;
  target_type: TargetType;
  target_id?: string;
  filename: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  uploaded_by?: string;
  creation: string;
  uploaded_by_full_name?: string;
  uploaded_by_image?: string;
  file_size_formatted?: string;
}

// ==================== NHẬT KÝ ====================

export interface PMChangeLog {
  name: string;
  project_id: string;
  action: string;
  actor_id: string;
  target_type?: TargetType;
  target_id?: string;
  old_value?: string;
  new_value?: string;
  creation: string;
  actor_full_name?: string;
  actor_image?: string;
  old_value_parsed?: Record<string, unknown>;
  new_value_parsed?: Record<string, unknown>;
  description?: string;
}

// ==================== PAYLOAD ====================

export interface CreateProjectPayload {
  title: string;
  description?: string;
  visibility?: ProjectVisibility;
  campus_id?: string;
}

export interface UpdateProjectPayload {
  title?: string;
  description?: string;
  visibility?: ProjectVisibility;
  campus_id?: string;
}

export interface InviteMemberPayload {
  project_id: string;
  invitee_email: string;
  role?: InviteRole;
  message?: string;
}

export interface CreateTaskPayload {
  project_id: string;
  requirement_id?: string;
  /** Truyền vào để tạo subtask. Cha phải cùng dự án và bản thân không là subtask. */
  parent_task_id?: string | null;
  title: string;
  description?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  tags?: string;
  assignee_ids?: string[];
}

export interface UpdateTaskPayload {
  requirement_id?: string | null;
  /** `null` để tách subtask thành task độc lập. */
  parent_task_id?: string | null;
  title?: string;
  description?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  tags?: string;
  /** Đổi người báo cáo — server chỉ nhận thành viên dự án. */
  created_by?: string;
  assignee_ids?: string[];
}

export interface MoveTaskPayload {
  task_id: string;
  from_status: TaskStatus;
  to_status: TaskStatus;
  new_order_index: number;
}

export interface CreateRequirementPayload {
  project_id: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
}

export interface UpdateRequirementPayload {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: RequirementStatus;
}

export interface CreateMeetingPayload {
  project_id: string;
  title: string;
  description?: string;
  meeting_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  minutes?: string;
  action_items?: string;
  attendee_ids?: string[];
}

export interface UpdateMeetingPayload {
  title?: string;
  description?: string;
  meeting_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  minutes?: string;
  action_items?: string;
  attendee_ids?: string[];
}

export interface TaskSearchFilters {
  query?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  has_due_date?: boolean;
  overdue?: boolean;
}

export interface MyTasksFilters {
  project_id?: string;
  priority?: TaskPriority;
  due_date_filter?: DueDateFilter;
}

// ==================== RESPONSE ====================

export type TasksByStatus = Record<TaskStatus, PMTask[]>;

export interface BoardTasksResponse {
  tasks: PMTask[];
  grouped: TasksByStatus;
  total: number;
}

export interface MyTasksResponse {
  tasks: PMTask[];
  /** `done` chỉ gồm task hoàn thành trong 7 ngày gần nhất. */
  grouped: TasksByStatus;
  total: number;
  projects: { name: string; title: string }[];
}

export interface AssignTaskResponse {
  task: PMTask;
  assigned: string[];
  skipped: { user_id: string; reason: string }[];
}

/** Khung phản hồi chung của service — mọi hàm đều trả về dạng này. */
export interface PMResult<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Vai trò được phép sửa task / quản lý dự án.
 *
 * Ở lại file types chứ không sang `pmStatus.ts`: đây là DỮ LIỆU phân quyền, không
 * phải cấu hình hiển thị. Backend vẫn là chốt chặn thật (`check_task_permission`,
 * `check_project_edit_permission`); hai hằng này chỉ để không hiện nút mà bấm vào
 * chỉ nhận 403.
 */
export const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'manager', 'member'] as const;
export const MANAGE_ROLES: readonly ProjectRole[] = ['owner', 'manager'] as const;

export const emptyTasksByStatus = (): TasksByStatus => ({
  backlog: [],
  todo: [],
  in_progress: [],
  review: [],
  done: [],
});
