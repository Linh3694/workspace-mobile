/**
 * Module Quản lý dự án (PM) — gọi `erp.api.erp_sis.project_management.*`.
 *
 * Đối chiếu với bản web `frappe-sis-frontend/packages/core/src/services/projectManagementService.ts`:
 * cùng endpoint, cùng tên tham số. Khác ở tầng HTTP (axios + AsyncStorage token,
 * giống administrativeTicketService.ts của app này) và ở chỗ mọi hàm đều trả
 * `PMResult<T>` thay vì ném lỗi.
 *
 * BA CÁI BẪY của backend này, đừng "dọn cho gọn":
 *
 * 1. Backend gói kết quả trong envelope của Frappe: `{ message: { success, data } }`.
 *    Trả thẳng `response.data` ra màn hình là trắng màn hình hoặc danh sách rỗng
 *    im lặng. Mọi lời gọi phải đi qua `unwrap`.
 *
 * 2. Ba kiểu truyền tham số cùng tồn tại và KHÔNG hoán đổi được:
 *    - query string cho phần lớn endpoint POST (`?task_id=...`) — chúng đọc
 *      `frappe.form_dict` / `request.args`;
 *    - JSON body cho các endpoint đọc `json.loads(frappe.request.data)`
 *      (create/update task, project, meeting, requirement, invite_member);
 *    - form-urlencoded cho nhóm bình luận (`create_task_comment`…).
 *    Gửi sai kiểu thì server nhận `None` rồi báo "thiếu tham số bắt buộc".
 *
 * 3. `assign_task` / `unassign_task` nhận `user_ids` là mảng nên phải đi JSON body,
 *    trong khi `task_id` lại nằm ở query string. Trộn hai chỗ là cố ý.
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';
import type {
  AssignTaskResponse,
  BoardTasksResponse,
  CreateMeetingPayload,
  CreateProjectPayload,
  CreateRequirementPayload,
  CreateTaskPayload,
  InviteMemberPayload,
  InviteRole,
  MoveTaskPayload,
  MyTasksFilters,
  MyTasksResponse,
  PMChangeLog,
  PMMeeting,
  PMProject,
  PMProjectInvitation,
  PMProjectMember,
  PMRequirement,
  PMResource,
  PMResult,
  PMTask,
  PMTaskComment,
  ProjectRole,
  RequirementStatus,
  TaskSearchFilters,
  TaskStatus,
  UpdateMeetingPayload,
  UpdateProjectPayload,
  UpdateRequirementPayload,
  UpdateTaskPayload,
} from '../types/projectManagement';
import { emptyTasksByStatus } from '../types/projectManagement';

const PM = '/api/method/erp.api.erp_sis.project_management';

type Params = Record<string, string | number | boolean | undefined>;

async function baseConfig(extra: Record<string, unknown> = {}) {
  const token = await AsyncStorage.getItem('authToken');
  return {
    baseURL: BASE_URL,
    timeout: 60000,
    ...extra,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((extra.headers as Record<string, string>) || {}),
    },
  };
}

/** Bỏ tham số rỗng rồi nối vào query string — Frappe coi "undefined" là chuỗi thật. */
function withQuery(path: string, params?: Params): string {
  if (!params) return path;
  const usable = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (!usable.length) return path;
  const qs = usable
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${path}${path.includes('?') ? '&' : '?'}${qs}`;
}

/**
 * Lấy thông báo lỗi thật của Frappe. HTTP 417 kèm `exc` / `_server_messages`
 * chứ không phải `message`, nên không bóc thì người dùng chỉ thấy
 * "Request failed with status code 417".
 */
function parseError(data: unknown): string {
  if (data == null) return 'Lỗi API';
  if (typeof data === 'string') {
    try {
      return parseError(JSON.parse(data));
    } catch {
      return data.length > 220 ? `${data.slice(0, 220)}…` : data;
    }
  }
  if (typeof data !== 'object') return 'Lỗi API';
  const d = data as Record<string, unknown>;

  const inner = d.message;
  if (inner && typeof inner === 'object' && 'message' in inner) {
    const m = (inner as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m;
  }
  if (typeof d.message === 'string' && d.message.trim()) return d.message;

  if (typeof d.exc === 'string' && d.exc.trim()) {
    try {
      const arr = JSON.parse(d.exc) as unknown;
      if (Array.isArray(arr) && arr.length) {
        const first = arr[0];
        if (typeof first === 'string') return first;
      }
    } catch {
      return d.exc.replace(/<[^>]+>/g, '').slice(0, 400);
    }
  }
  if (typeof d._server_messages === 'string') {
    try {
      const arr = JSON.parse(d._server_messages) as string[];
      if (arr.length) {
        const first = JSON.parse(arr[0]) as { message?: string };
        if (first?.message) return first.message;
      }
    } catch {
      /* rơi xuống mặc định */
    }
  }
  return 'Lỗi API';
}

/** Gỡ envelope `{ message: { success, data } }` của Frappe. Xem bẫy #1 ở đầu file. */
function unwrap<T>(response: { data?: unknown }): PMResult<T> {
  const raw = response?.data as { message?: unknown } | undefined;
  const body = (raw && typeof raw === 'object' && 'message' in raw ? raw.message : raw) as
    | { success?: boolean; data?: T; message?: string }
    | undefined;

  if (body && typeof body === 'object' && body.success === true) {
    return { success: true, data: body.data, message: body.message };
  }
  return { success: false, message: parseError(response?.data) };
}

function fail<T>(where: string, e: unknown): PMResult<T> {
  const payload = (e as { response?: { data?: unknown } })?.response?.data;
  const message = payload ? parseError(payload) : (e as Error)?.message || 'Lỗi kết nối';
  console.error(`[PM] ${where}:`, message);
  return { success: false, message };
}

async function get<T>(path: string, params?: Params): Promise<PMResult<T>> {
  try {
    return unwrap<T>(await axios.get(withQuery(path, params), await baseConfig()));
  } catch (e) {
    return fail<T>(path, e);
  }
}

async function post<T>(path: string, body?: unknown, params?: Params): Promise<PMResult<T>> {
  try {
    return unwrap<T>(
      await axios.post(withQuery(path, params), body ?? {}, await baseConfig())
    );
  } catch (e) {
    return fail<T>(path, e);
  }
}

/** POST form-urlencoded — chỉ dùng cho nhóm bình luận. Xem bẫy #2. */
async function postForm<T>(path: string, fields: Params): Promise<PMResult<T>> {
  try {
    const form = Object.entries(fields)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const config = await baseConfig({
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return unwrap<T>(await axios.post(path, form, config));
  } catch (e) {
    return fail<T>(path, e);
  }
}

/**
 * Ghép `BASE_URL` cho đường dẫn tệp/ảnh của Frappe.
 *
 * Frappe trả đường dẫn TƯƠNG ĐỐI (`/files/Avatar/...`). Trên web trình duyệt tự
 * hiểu, nhưng `<Image source={{ uri: '/files/...' }}>` của React Native thì
 * không — nó không báo lỗi, chỉ vẽ ra một vòng tròn xám. Mọi chỗ nhận
 * `user_image` / `file_url` từ server đều phải đi qua hàm này.
 */
export function resolveFileUrl(path?: string | null): string | undefined {
  const value = (path ?? '').trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `${BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

// ==================== DỰ ÁN ====================

export const getMyProjects = (filters?: { status?: string; visibility?: string }) =>
  get<PMProject[]>(`${PM}.project.get_my_projects`, {
    status: filters?.status,
    visibility: filters?.visibility,
  });

export const getProject = (projectId: string) =>
  get<PMProject>(`${PM}.project.get_project`, { project_id: projectId });

export const createProject = (payload: CreateProjectPayload) =>
  post<PMProject>(`${PM}.project.create_project`, payload);

export const updateProject = (projectId: string, payload: UpdateProjectPayload) =>
  post<PMProject>(`${PM}.project.update_project`, payload, { project_id: projectId });

export const archiveProject = (projectId: string) =>
  post<PMProject>(`${PM}.project.archive_project`, undefined, { project_id: projectId });

export const restoreProject = (projectId: string) =>
  post<PMProject>(`${PM}.project.restore_project`, undefined, { project_id: projectId });

export const deleteProject = (projectId: string) =>
  post<void>(`${PM}.project.delete_project`, undefined, { project_id: projectId });

export const getProjectMembers = (projectId: string) =>
  get<PMProjectMember[]>(`${PM}.project.get_project_members`, { project_id: projectId });

export const updateMemberRole = (
  projectId: string,
  memberUserId: string,
  newRole: Exclude<ProjectRole, 'owner'>
) =>
  post<void>(`${PM}.project.update_member_role`, undefined, {
    project_id: projectId,
    member_user_id: memberUserId,
    new_role: newRole,
  });

// ==================== LỜI MỜI & THÀNH VIÊN ====================

export const inviteMember = (payload: InviteMemberPayload) =>
  post<PMProjectInvitation>(`${PM}.invitation.invite_member`, payload);

export const getMyInvitations = (status: 'pending' | 'accepted' | 'declined' | 'expired' = 'pending') =>
  get<PMProjectInvitation[]>(`${PM}.invitation.get_my_invitations`, { status });

export const getProjectInvitations = (projectId: string) =>
  get<PMProjectInvitation[]>(`${PM}.invitation.get_project_invitations`, {
    project_id: projectId,
  });

export const acceptInvitation = (invitationId: string) =>
  post<void>(`${PM}.invitation.accept_invitation`, undefined, { invitation_id: invitationId });

export const declineInvitation = (invitationId: string) =>
  post<void>(`${PM}.invitation.decline_invitation`, undefined, { invitation_id: invitationId });

export const cancelInvitation = (invitationId: string) =>
  post<void>(`${PM}.invitation.cancel_invitation`, undefined, { invitation_id: invitationId });

export const leaveProject = (projectId: string) =>
  post<void>(`${PM}.invitation.leave_project`, undefined, { project_id: projectId });

export const removeMember = (projectId: string, memberUserId: string) =>
  post<void>(`${PM}.invitation.remove_member`, undefined, {
    project_id: projectId,
    member_user_id: memberUserId,
  });

export const transferOwnership = (projectId: string, newOwnerId: string) =>
  post<void>(`${PM}.invitation.transfer_ownership`, undefined, {
    project_id: projectId,
    new_owner_id: newOwnerId,
  });

// ==================== CÔNG VIỆC ====================

/**
 * Task của bảng Kanban. Chỉ trả task cấp 1 — `get_board_tasks` lọc
 * `parent_task_id` rỗng, nên subtask KHÔNG có ở đây. Muốn mở một subtask thì
 * phải gọi `getTask`.
 */
export const getBoardTasks = async (
  projectId: string,
  status?: TaskStatus
): Promise<PMResult<BoardTasksResponse>> => {
  if (!projectId) {
    return {
      success: false,
      message: 'Thiếu project_id',
      data: { tasks: [], grouped: emptyTasksByStatus(), total: 0 },
    };
  }
  return get<BoardTasksResponse>(`${PM}.task.get_board_tasks`, {
    project_id: projectId,
    status,
  });
};

export const getTask = (taskId: string) => get<PMTask>(`${PM}.task.get_task`, { task_id: taskId });

export const getSubtasks = (taskId: string) =>
  get<PMTask[]>(`${PM}.task.get_subtasks`, { task_id: taskId });

export const createTask = (payload: CreateTaskPayload) =>
  post<PMTask>(`${PM}.task.create_task`, payload);

export const updateTask = (taskId: string, payload: UpdateTaskPayload) =>
  post<PMTask>(`${PM}.task.update_task`, payload, { task_id: taskId });

/**
 * Đổi cột trên bảng. Dùng ĐÚNG endpoint này thay vì `updateTask({status})`:
 * `move_task` chỉ bắn thông báo `pm_task_status_changed` khi cột thật sự đổi,
 * còn kéo sắp xếp lại trong cùng cột thì im.
 */
export const moveTask = (payload: MoveTaskPayload) => post<PMTask>(`${PM}.task.move_task`, payload);

export const deleteTask = (taskId: string) =>
  post<void>(`${PM}.task.delete_task`, undefined, { task_id: taskId });

/** `user_ids` là mảng nên phải nằm ở JSON body, `task_id` vẫn ở query. Xem bẫy #3. */
export const assignTask = (taskId: string, userIds: string[]) =>
  post<AssignTaskResponse>(`${PM}.task.assign_task`, { user_ids: userIds }, { task_id: taskId });

export const unassignTask = (taskId: string, userId: string) =>
  post<void>(`${PM}.task.unassign_task`, undefined, { task_id: taskId, user_id: userId });

export const searchTasks = (projectId: string, filters: TaskSearchFilters = {}) =>
  get<PMTask[]>(`${PM}.task.search_tasks`, {
    project_id: projectId,
    query: filters.query,
    status: filters.status,
    priority: filters.priority,
    assignee_id: filters.assignee_id,
    has_due_date: filters.has_due_date === undefined ? undefined : String(filters.has_due_date),
    overdue: filters.overdue === undefined ? undefined : String(filters.overdue),
  });

/** Task được gán cho tôi trên MỌI dự án — nguồn của màn "Công việc của tôi". */
export const getMyTasks = (filters: MyTasksFilters = {}) =>
  get<MyTasksResponse>(`${PM}.task.get_my_tasks`, {
    project_id: filters.project_id,
    priority: filters.priority,
    due_date_filter:
      filters.due_date_filter && filters.due_date_filter !== 'all'
        ? filters.due_date_filter
        : undefined,
  });

// ==================== BÌNH LUẬN (form-urlencoded) ====================

export const getTaskComments = (taskId: string) =>
  postForm<PMTaskComment[]>(`${PM}.task.get_task_comments`, { task_id: taskId });

/**
 * Gửi bình luận. Nhắc tên phải đúng cú pháp `@[Tên hiển thị](email@domain)` —
 * backend chỉ nhận email nào thuộc dự án, nên chuỗi tự gõ sẽ bị bỏ qua im lặng.
 */
export const createTaskComment = (taskId: string, commentText: string) =>
  postForm<PMTaskComment>(`${PM}.task.create_task_comment`, {
    task_id: taskId,
    comment_text: commentText,
  });

export const updateTaskComment = (commentId: string, commentText: string) =>
  postForm<PMTaskComment>(`${PM}.task.update_task_comment`, {
    comment_id: commentId,
    comment_text: commentText,
  });

export const deleteTaskComment = (commentId: string) =>
  postForm<void>(`${PM}.task.delete_task_comment`, { comment_id: commentId });

export const getTaskCommentCount = (taskId: string) =>
  postForm<{ count: number }>(`${PM}.task.get_task_comment_count`, { task_id: taskId });

// ==================== YÊU CẦU ====================

export const getRequirements = (projectId: string, status?: RequirementStatus) =>
  get<PMRequirement[]>(`${PM}.requirement.get_requirements`, {
    project_id: projectId,
    status,
  });

export const getRequirement = (requirementId: string) =>
  get<PMRequirement>(`${PM}.requirement.get_requirement`, { requirement_id: requirementId });

export const createRequirement = (payload: CreateRequirementPayload) =>
  post<PMRequirement>(`${PM}.requirement.create_requirement`, payload);

export const updateRequirement = (requirementId: string, payload: UpdateRequirementPayload) =>
  post<PMRequirement>(`${PM}.requirement.update_requirement`, payload, {
    requirement_id: requirementId,
  });

export const deleteRequirement = (requirementId: string) =>
  post<void>(`${PM}.requirement.delete_requirement`, undefined, {
    requirement_id: requirementId,
  });

// ==================== CUỘC HỌP ====================

export const getMeetings = (projectId: string) =>
  get<PMMeeting[]>(`${PM}.meeting.get_meetings`, { project_id: projectId });

export const getMeeting = (meetingId: string) =>
  get<PMMeeting>(`${PM}.meeting.get_meeting`, { meeting_id: meetingId });

export const createMeeting = (payload: CreateMeetingPayload) =>
  post<PMMeeting>(`${PM}.meeting.create_meeting`, payload);

export const updateMeeting = (meetingId: string, payload: UpdateMeetingPayload) =>
  post<PMMeeting>(`${PM}.meeting.update_meeting`, payload, { meeting_id: meetingId });

export const deleteMeeting = (meetingId: string) =>
  post<void>(`${PM}.meeting.delete_meeting`, undefined, { meeting_id: meetingId });

// ==================== TÀI LIỆU ====================

export const getResources = (projectId: string, targetType?: string, targetId?: string) =>
  get<PMResource[]>(`${PM}.resource.get_resources`, {
    project_id: projectId,
    target_type: targetType,
    target_id: targetId,
  });

export const getResource = (resourceId: string) =>
  get<PMResource>(`${PM}.resource.get_resource`, { resource_id: resourceId });

/**
 * Tải tệp lên. React Native không có `File` — phần tệp là `{ uri, name, type }`,
 * đúng dạng expo-document-picker trả về. Không đặt `Content-Type` thủ công:
 * ranh giới multipart do runtime sinh, gán tay là mất `boundary` và server
 * không parse được.
 */
export const uploadResource = async (
  projectId: string,
  file: { uri: string; name: string; type?: string },
  targetType: string = 'project',
  targetId?: string
): Promise<PMResult<PMResource>> => {
  try {
    const form = new FormData();
    form.append('project_id', projectId);
    form.append('target_type', targetType);
    if (targetId) form.append('target_id', targetId);
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type || 'application/octet-stream',
    } as unknown as Blob);

    const token = await AsyncStorage.getItem('authToken');
    const response = await axios.post(`${PM}.resource.upload_resource`, form, {
      baseURL: BASE_URL,
      timeout: 120000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return unwrap<PMResource>(response);
  } catch (e) {
    return fail<PMResource>('uploadResource', e);
  }
};

export const deleteResource = (resourceId: string) =>
  post<void>(`${PM}.resource.delete_resource`, undefined, { resource_id: resourceId });

// ==================== NHẬT KÝ ====================

export const getProjectLogs = (projectId: string, limit = 50, offset = 0) =>
  get<PMChangeLog[]>(`${PM}.change_log.get_logs`, {
    project_id: projectId,
    limit,
    offset,
  });

export const getTaskLogs = (taskId: string) =>
  get<PMChangeLog[]>(`${PM}.change_log.get_task_logs`, { task_id: taskId });

export const projectManagementService = {
  getMyProjects,
  getProject,
  createProject,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProject,
  getProjectMembers,
  updateMemberRole,
  inviteMember,
  getMyInvitations,
  getProjectInvitations,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
  leaveProject,
  removeMember,
  transferOwnership,
  getBoardTasks,
  getTask,
  getSubtasks,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  assignTask,
  unassignTask,
  searchTasks,
  getMyTasks,
  getTaskComments,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
  getTaskCommentCount,
  getRequirements,
  getRequirement,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getResources,
  getResource,
  uploadResource,
  deleteResource,
  getProjectLogs,
  getTaskLogs,
};

export default projectManagementService;

export type { InviteRole };
