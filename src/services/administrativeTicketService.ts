/**
 * Ticket Hành chính — gọi Frappe erp.api.erp_administrative.administrative_ticket (đồng bộ web frappe-sis-frontend)
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';

const getAxiosConfig = async (additionalConfig: { headers?: Record<string, string> } = {}) => {
  const token = await AsyncStorage.getItem('authToken');
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return {
    baseURL: BASE_URL,
    timeout: 120000,
    ...additionalConfig,
    headers: { ...defaultHeaders, ...(additionalConfig.headers || {}) },
  };
};

const BASE = '/api/method/erp.api.erp_administrative.administrative_ticket';
const USER_MGMT = '/api/method/erp.api.erp_common_user.user_management';

/**
 * Frappe trả HTTP 417 cho ValidationError; body có exc / _server_messages / exception.
 * Dùng để hiển thị thông báo thật thay vì "Request failed with status code 417".
 */
export function parseFrappeApiError(data: unknown): string {
  if (data == null) return 'Lỗi API';
  if (typeof data === 'string') {
    try {
      return parseFrappeApiError(JSON.parse(data));
    } catch {
      return data.length > 220 ? `${data.slice(0, 220)}…` : data;
    }
  }
  if (typeof data !== 'object') return 'Lỗi API';
  const d = data as Record<string, unknown>;

  const inner = d.message;
  if (inner && typeof inner === 'object' && inner !== null && 'message' in inner) {
    const m = (inner as { message?: string }).message;
    if (typeof m === 'string' && m.trim()) return m;
  }
  if (typeof d.message === 'string' && d.message.trim()) return d.message;

  if (typeof d.exc === 'string' && d.exc.trim()) {
    try {
      const arr = JSON.parse(d.exc) as unknown;
      if (Array.isArray(arr) && arr.length > 0) {
        const first = arr[0];
        if (typeof first === 'string') return first;
        if (first && typeof first === 'object' && first !== null && 'message' in first) {
          return String((first as { message?: string }).message || 'Lỗi');
        }
      }
    } catch {
      return d.exc.replace(/<[^>]+>/g, '').slice(0, 400);
    }
  }

  if (typeof d.exception === 'string' && d.exception.trim()) {
    const lines = d.exception.split('\n').filter(Boolean);
    const last = lines[lines.length - 1] || d.exception;
    return last.slice(0, 400);
  }

  if (typeof d._server_messages === 'string') {
    try {
      const outer = JSON.parse(d._server_messages) as unknown;
      if (Array.isArray(outer) && outer[0]) {
        const innerMsg = JSON.parse(String(outer[0])) as { message?: string };
        if (typeof innerMsg.message === 'string') return innerMsg.message;
      }
    } catch {
      /* bỏ qua */
    }
  }

  return 'Lỗi API';
}

function unwrap<T>(response: {
  data?: { message?: { success?: boolean; data?: T; message?: string }; exc?: string };
}): { success: boolean; data?: T; message?: string } {
  const msg = response?.data?.message ?? response?.data;
  if (msg && typeof msg === 'object' && 'success' in msg && msg.success === true) {
    return {
      success: true,
      data: msg.data as T,
      message: typeof msg.message === 'string' ? msg.message : undefined,
    };
  }
  const fallback =
    (msg && typeof msg === 'object' && 'message' in msg && typeof (msg as { message?: string }).message === 'string'
      ? (msg as { message: string }).message
      : null) || parseFrappeApiError(response?.data);
  return {
    success: false,
    message: fallback || 'Lỗi API',
  };
}

/** Người dùng (giống IT ticket) */
export interface AdminTicketPerson {
  _id?: string;
  fullname: string;
  email: string;
  avatarUrl?: string;
  department?: string;
  jobTitle?: string;
}

export interface AdminTicketFeedback {
  assignedTo?: string;
  rating?: number;
  comment?: string;
  badges?: string[];
}

export interface AdministrativeTicket {
  _id: string;
  name?: string;
  title: string;
  description?: string;
  ticketCode: string;
  status: string;
  priority?: string;
  category?: string;
  category_label?: string;
  notes?: string;
  cancellationReason?: string;
  creator?: AdminTicketPerson;
  creatorEmail?: string;
  assignedTo?: AdminTicketPerson | null;
  feedback?: AdminTicketFeedback | null;
  closedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  acceptedAt?: string;
  area_title?: string;
  attachment?: string;
  is_event_facility?: boolean;
  event_building_id?: string;
  event_building_label?: string;
  event_room_id?: string;
  event_room_label?: string;
  event_start_time?: string;
  event_end_time?: string;
  room_id?: string;
  room_label?: string;
  related_equipment_id?: string;
  related_equipment_label?: string;
  related_student_ids?: string[] | string;
  related_students?: Array<{
    student_id: string;
    student_name: string;
    student_code: string;
    avatar_url?: string;
  }>;
  /** Gộp từ get_subtasks khi load detail (mobile) */
  subTasks?: AdminSubTask[];
}

export interface AdminTicketCategory {
  value: string;
  label: string;
  ticket_code_prefix?: string;
}

export interface AdminTicketMessage {
  _id: string;
  sender: AdminTicketPerson & { _id?: string };
  text: string;
  timestamp: string;
  type: 'text' | 'image';
  images?: string[];
}

export interface AdminSubTask {
  _id: string;
  title: string;
  description?: string;
  assignedTo?: AdminTicketPerson | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminTicketHistoryEntry {
  _id: string;
  timestamp: string;
  action: string;
  detail?: string;
  user?: AdminTicketPerson;
}

export interface AdminFeedbackData {
  rating: number;
  comment: string;
  badges: string[];
}

export interface AdminFeedbackStats {
  averageRating: number;
  totalFeedbacks: number;
  badges: string[];
  badgeCounts: Record<string, number>;
}

export interface AdminEventRoomOption {
  name: string;
  title_vn?: string;
  title_en?: string;
  short_title?: string;
  room_type?: string;
  capacity?: number;
}

export interface AdminTicketStudentOption {
  student_id: string;
  student_name: string;
  student_code: string;
  avatar_url?: string;
  class_title?: string;
}

export interface AdminTicketEquipmentLine {
  name: string;
  room?: string;
  category?: string;
  category_title?: string;
  equipment_type?: string;
  quantity?: number;
  condition?: string;
}

/** Thành viên gán ticket — map từ get_users (SIS Administrative) */
export interface AdministrativeSupportMember {
  _id: string;
  email: string;
  fullname: string;
  avatarUrl?: string;
  department?: string;
}

export async function getMyAdminTickets(): Promise<AdministrativeTicket[]> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${BASE}.get_my_tickets`, config);
    const out = unwrap<{ tickets?: AdministrativeTicket[] }>(response);
    if (out.success && out.data?.tickets) return out.data.tickets;
    return [];
  } catch (e) {
    console.error('getMyAdminTickets', e);
    return [];
  }
}

export async function getAllAdminTickets(): Promise<AdministrativeTicket[]> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${BASE}.get_all_tickets`, config);
    const out = unwrap<{ tickets?: AdministrativeTicket[] }>(response);
    if (out.success && out.data?.tickets) return out.data.tickets;
    return [];
  } catch (e) {
    console.error('getAllAdminTickets', e);
    return [];
  }
}

export async function getAdminTicketDetail(ticketId: string): Promise<AdministrativeTicket | null> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(
      `${BASE}.get_ticket`,
      { ticket_id: ticketId },
      config
    );
    const out = unwrap<AdministrativeTicket>(response);
    if (out.success && out.data) return out.data;
    return null;
  } catch (e) {
    console.error('getAdminTicketDetail', e);
    return null;
  }
}

export async function getAdminTicketCategories(): Promise<AdminTicketCategory[]> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${BASE}.get_ticket_categories`, config);
    const out = unwrap<{ categories?: AdminTicketCategory[] }>(response);
    if (out.success && out.data?.categories) return out.data.categories;
    return [];
  } catch (e) {
    console.error('getAdminTicketCategories', e);
    return [];
  }
}

/** Upload file đính kèm — folder khớp web */
export async function uploadAdminTicketAttachment(
  uri: string,
  fileName: string,
  mimeType?: string
): Promise<string> {
  const token = await AsyncStorage.getItem('authToken');
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: fileName || 'upload.bin',
    type: mimeType || 'application/octet-stream',
  } as any);
  formData.append('is_private', '0');
  formData.append('folder', 'Home/AdministrativeTicket');

  const response = await axios.post(`${BASE_URL}/api/method/upload_file`, formData, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120000,
    validateStatus: (status) => status >= 200 && status < 600,
  });

  if (response.status >= 400) {
    throw new Error(parseFrappeApiError(response.data));
  }

  const msg = response?.data?.message;
  const d = typeof msg === 'object' && msg ? msg : response?.data;
  const fileUrl =
    (d && typeof d === 'object' && 'file_url' in d && typeof (d as { file_url?: string }).file_url === 'string'
      ? (d as { file_url: string }).file_url
      : null) || (typeof msg === 'string' ? msg : '');
  if (!fileUrl) {
    throw new Error('Không nhận được URL file sau khi upload');
  }
  return fileUrl;
}

export async function getRoomsByBuilding(buildingId: string): Promise<AdminEventRoomOption[]> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(
      `${BASE}.get_rooms_by_building`,
      { building_id: buildingId },
      config
    );
    const out = unwrap<{ rooms?: AdminEventRoomOption[] }>(response);
    if (out.success && out.data?.rooms) return out.data.rooms;
    return [];
  } catch (e) {
    console.error('getRoomsByBuilding', e);
    return [];
  }
}

export async function getRoomEquipmentForTicket(roomId: string): Promise<AdminTicketEquipmentLine[]> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(
      `${BASE}.get_room_equipment_for_ticket`,
      { room_id: roomId },
      config
    );
    const out = unwrap<{ equipment?: AdminTicketEquipmentLine[] }>(response);
    if (out.success && out.data?.equipment) return out.data.equipment;
    return [];
  } catch (e) {
    console.error('getRoomEquipmentForTicket', e);
    return [];
  }
}

export async function getStudentsByRoom(
  roomId: string,
  options?: { school_year_id?: string; campus_id?: string }
): Promise<AdminTicketStudentOption[]> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(
      `${BASE}.get_students_by_room`,
      {
        room_id: roomId,
        ...(options?.school_year_id ? { school_year_id: options.school_year_id } : {}),
        ...(options?.campus_id ? { campus_id: options.campus_id } : {}),
      },
      config
    );
    const out = unwrap<{ students?: AdminTicketStudentOption[] }>(response);
    if (out.success && out.data?.students) return out.data.students;
    return [];
  } catch (e) {
    console.error('getStudentsByRoom', e);
    return [];
  }
}

export async function createAdminTicket(payload: {
  title: string;
  description: string;
  category: string;
  priority?: string;
  notes?: string;
  area_title?: string;
  attachment?: string;
  is_event_facility?: boolean;
  event_building_id?: string;
  event_room_id?: string;
  event_start_time?: string;
  event_end_time?: string;
  room_id?: string;
  related_equipment_id?: string;
  related_student_ids?: string[];
}): Promise<AdministrativeTicket> {
  const config = await getAxiosConfig();
  const response = await axios.post(`${BASE}.create_ticket`, payload, {
    ...config,
    validateStatus: (status) => status >= 200 && status < 600,
  });
  if (response.status >= 400) {
    throw new Error(parseFrappeApiError(response.data));
  }
  const out = unwrap<AdministrativeTicket>(response);
  if (!out.success || !out.data) {
    throw new Error(out.message || parseFrappeApiError(response.data));
  }
  return out.data;
}

export async function updateAdminTicket(payload: {
  ticket_id: string;
  title?: string;
  description?: string;
  category?: string;
  notes?: string;
  priority?: string;
  area_title?: string;
  attachment?: string;
  status?: string;
  assigned_to?: string | null;
  is_event_facility?: boolean;
  event_building_id?: string;
  event_room_id?: string;
  event_start_time?: string;
  event_end_time?: string;
  room_id?: string;
  related_equipment_id?: string;
  related_student_ids?: string[];
}): Promise<AdministrativeTicket> {
  const config = await getAxiosConfig();
  const response = await axios.post(`${BASE}.update_ticket`, payload, config);
  const out = unwrap<AdministrativeTicket>(response);
  if (!out.success || !out.data) {
    throw new Error(out.message || 'updateAdminTicket failed');
  }
  return out.data;
}

export async function assignAdminTicketToMe(ticketId: string): Promise<AdministrativeTicket> {
  const config = await getAxiosConfig();
  const response = await axios.post(
    `${BASE}.assign_ticket`,
    { ticket_id: ticketId },
    config
  );
  const out = unwrap<AdministrativeTicket>(response);
  if (!out.success || !out.data) {
    throw new Error(out.message || 'assignAdminTicket failed');
  }
  return out.data;
}

export async function cancelAdminTicket(
  ticketId: string,
  cancelReason: string
): Promise<AdministrativeTicket> {
  const config = await getAxiosConfig();
  const response = await axios.post(
    `${BASE}.cancel_ticket`,
    { ticket_id: ticketId, cancelReason },
    config
  );
  const out = unwrap<AdministrativeTicket>(response);
  if (!out.success || !out.data) {
    throw new Error(out.message || 'cancelAdminTicket failed');
  }
  return out.data;
}

export async function reopenAdminTicket(ticketId: string): Promise<AdministrativeTicket> {
  const config = await getAxiosConfig();
  const response = await axios.post(`${BASE}.reopen_ticket`, { ticket_id: ticketId }, config);
  const out = unwrap<AdministrativeTicket>(response);
  if (!out.success || !out.data) {
    throw new Error(out.message || 'reopenAdminTicket failed');
  }
  return out.data;
}

export async function acceptAdminFeedback(
  ticketId: string,
  feedbackData: AdminFeedbackData
): Promise<void> {
  const config = await getAxiosConfig();
  const response = await axios.post(
    `${BASE}.accept_feedback`,
    {
      ticket_id: ticketId,
      rating: feedbackData.rating,
      comment: feedbackData.comment,
      badges: feedbackData.badges,
    },
    config
  );
  const out = unwrap<unknown>(response);
  if (!out.success) {
    throw new Error(out.message || 'acceptAdminFeedback failed');
  }
}

export async function getAdminSubTasks(ticketId: string): Promise<AdminSubTask[]> {
  const config = await getAxiosConfig();
  const response = await axios.post(
    `${BASE}.get_subtasks`,
    { ticket_id: ticketId },
    config
  );
  const out = unwrap<{ subTasks?: AdminSubTask[] }>(response);
  if (out.success && out.data?.subTasks) return out.data.subTasks;
  return [];
}

export async function createAdminSubTask(
  ticketId: string,
  data: { title: string; description?: string; assignedTo?: string; status?: string }
): Promise<void> {
  const config = await getAxiosConfig();
  const response = await axios.post(
    `${BASE}.create_subtask`,
    {
      ticket_id: ticketId,
      title: data.title,
      description: data.description,
      assigned_to: data.assignedTo,
      status: data.status,
    },
    config
  );
  const out = unwrap<unknown>(response);
  if (!out.success) {
    throw new Error(out.message || 'createAdminSubTask failed');
  }
}

export async function updateAdminSubTaskStatus(
  ticketId: string,
  subTaskId: string,
  status: string
): Promise<void> {
  const config = await getAxiosConfig();
  const response = await axios.post(
    `${BASE}.update_subtask`,
    {
      ticket_id: ticketId,
      sub_task_id: subTaskId,
      status,
    },
    config
  );
  const out = unwrap<unknown>(response);
  if (!out.success) {
    throw new Error(out.message || 'updateAdminSubTask failed');
  }
}

export async function getAdminTicketMessages(ticketId: string): Promise<AdminTicketMessage[]> {
  const config = await getAxiosConfig();
  const response = await axios.post(
    `${BASE}.get_comments`,
    { ticket_id: ticketId },
    config
  );
  const out = unwrap<{ messages?: AdminTicketMessage[] }>(response);
  if (out.success && out.data?.messages && Array.isArray(out.data.messages)) {
    return out.data.messages;
  }
  return [];
}

/**
 * Gửi bình luận — upload ảnh/video (RN asset) rồi send_comment JSON (khớp web)
 */
export async function sendAdminTicketMessage(
  ticketId: string,
  text: string,
  imageAssets?: { uri: string; name: string; type: string }[]
): Promise<void> {
  const urls: string[] = [];
  if (imageAssets?.length) {
    for (const a of imageAssets) {
      urls.push(await uploadAdminTicketAttachment(a.uri, a.name, a.type));
    }
  }
  const trimmed = (text || '').trim();
  if (!trimmed && urls.length === 0) {
    throw new Error('Vui lòng nhập nội dung hoặc chọn file ảnh/video');
  }
  const config = await getAxiosConfig();
  const response = await axios.post(
    `${BASE}.send_comment`,
    {
      ticket_id: ticketId,
      text: trimmed,
      images: urls,
    },
    config
  );
  const out = unwrap<unknown>(response);
  if (!out.success) {
    throw new Error(out.message || 'sendAdminTicketMessage failed');
  }
}

export async function getAdminTicketHistory(ticketId: string): Promise<AdminTicketHistoryEntry[]> {
  const config = await getAxiosConfig();
  const response = await axios.post(
    `${BASE}.get_history`,
    { ticket_id: ticketId },
    config
  );
  const out = unwrap<AdminTicketHistoryEntry[]>(response);
  if (out.success && Array.isArray(out.data)) return out.data;
  return [];
}

export async function getAdminFeedbackStatsByEmail(email: string): Promise<AdminFeedbackStats> {
  const config = await getAxiosConfig();
  const response = await axios.post(
    `${BASE}.get_feedback_stats`,
    { email },
    config
  );
  const out = unwrap<{
    feedback?: {
      averageRating?: number;
      totalFeedbacks?: number;
      badges?: string[];
      badgeCounts?: Record<string, number>;
    };
    summary?: { feedbackCount?: number };
  }>(response);
  if (!out.success || !out.data?.feedback) {
    return {
      averageRating: 0,
      totalFeedbacks: 0,
      badges: [],
      badgeCounts: {},
    };
  }
  const fb = out.data.feedback;
  const sum = out.data.summary;
  return {
    averageRating: fb.averageRating ?? 0,
    totalFeedbacks: sum?.feedbackCount ?? fb.totalFeedbacks ?? 0,
    badges: fb.badges ?? [],
    badgeCounts: fb.badgeCounts ?? {},
  };
}

/** Danh sách user role SIS Administrative — gán ticket (khớp web fetchAdministrativePicUsers) */
export async function getAdministrativeSupportTeamMembers(): Promise<AdministrativeSupportMember[]> {
  try {
    const config = await getAxiosConfig();
    const byEmail = new Map<string, AdministrativeSupportMember>();
    let page = 1;
    const limit = 500;
    for (;;) {
      const response = await axios.get(`${USER_MGMT}.get_users`, {
        ...config,
        params: { role: 'SIS Administrative', active: 1, page, limit },
      });
      const msg = response?.data?.message ?? response?.data;
      const users = (msg && typeof msg === 'object' && 'users' in msg ? (msg as { users?: unknown[] }).users : null) || [];
      const arr = Array.isArray(users) ? users : [];
      if (arr.length === 0) break;
      for (const raw of arr) {
        const u = raw as Record<string, unknown>;
        const email = String(u.email || u.name || '').trim();
        if (!email) continue;
        byEmail.set(email, {
          _id: String(u.name || email),
          email,
          fullname: String(u.full_name || u.fullname || u.email || email),
          avatarUrl: typeof u.user_image === 'string' ? u.user_image : undefined,
          department: typeof u.department === 'string' ? u.department : undefined,
        });
      }
      const totalPages = (msg as { pagination?: { total_pages?: number } })?.pagination?.total_pages ?? 1;
      if (page >= totalPages) break;
      page += 1;
    }
    return [...byEmail.values()];
  } catch (e) {
    console.error('getAdministrativeSupportTeamMembers', e);
    return [];
  }
}

export async function assignAdminTicketToUser(
  ticketId: string,
  userId: string
): Promise<AdministrativeTicket> {
  return updateAdminTicket({
    ticket_id: ticketId,
    assigned_to: userId,
  });
}
