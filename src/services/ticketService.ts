/**
 * IT Ticket — gọi Frappe erp.api.erp_it_support.ticket (đồng bộ web frappe-sis-frontend)
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';
import { getAllCategoryMappings } from '../config/ticketConstants';
import { parseFrappeApiError } from './administrativeTicketService';

const IT_API = '/api/method/erp.api.erp_it_support.ticket';
const IT_TEAM_API = '/api/method/erp.api.erp_it_support.support_team';

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

async function frappeGet<T>(method: string): Promise<T> {
  const config = await getAxiosConfig();
  const response = await axios.get(`${IT_API}.${method}`, config);
  const out = unwrap<T>(response);
  if (!out.success) throw new Error(out.message || 'Request failed');
  return out.data as T;
}

async function frappePost<T>(method: string, data?: Record<string, unknown>): Promise<T> {
  const config = await getAxiosConfig();
  const response = await axios.post(`${IT_API}.${method}`, data ?? {}, config);
  const out = unwrap<T>(response);
  if (!out.success) throw new Error(out.message || 'Request failed');
  return out.data as T;
}

export interface Feedback {
  assignedTo?: string;
  rating?: number;
  comment?: string;
  badges?: string[];
}

export interface Message {
  _id: string;
  sender: {
    _id: string;
    fullname: string;
    email: string;
    avatarUrl?: string;
    jobTitle?: string;
    department?: string;
  };
  text: string;
  images?: string[];
  timestamp: string;
  type: 'text' | 'image' | 'text_with_images';
  tempId?: string;
}

export interface SubTask {
  _id: string;
  title: string;
  description?: string;
  status: 'In Progress' | 'Completed' | 'Cancelled';
  assignedTo?: {
    _id: string;
    fullname: string;
    email: string;
    avatarUrl?: string;
    department?: string;
    jobTitle?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TicketHistoryEntry {
  _id?: string;
  timestamp: string;
  action: string;
  user?: {
    _id: string;
    fullname: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface Ticket {
  _id: string;
  title: string;
  description?: string;
  ticketCode: string;
  status: string;
  creator: {
    _id: string;
    fullname: string;
    email: string;
    avatarUrl?: string;
    jobTitle?: string;
    department?: string;
  };
  creatorEmail: string;
  assignedTo?: {
    _id: string;
    fullname: string;
    email: string;
    avatarUrl?: string;
    department?: string;
    jobTitle?: string;
  } | null;
  priority?: string;
  category?: string;
  notes?: string;
  cancellationReason?: string;
  feedback?: Feedback;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  subTasks?: SubTask[];
  messages?: Message[];
  history?: TicketHistoryEntry[];
  attachments?: {
    filename: string;
    url: string;
  }[];
}

export interface TicketCategory {
  value: string;
  label: string;
}

export interface TicketResponse {
  success: boolean;
  data?: {
    tickets: Ticket[];
  };
  message?: string;
}

export interface FeedbackStats {
  averageRating: number;
  totalFeedbacks: number;
  badges: string[];
  badgeCounts: Record<string, number>;
}

export interface SupportTeamMember {
  _id: string;
  userId?: string;
  email: string;
  fullname: string;
  avatarUrl?: string;
  department?: string;
  roles?: string[];
}

/** Lấy danh sách ticket của user đang đăng nhập */
export const getMyTickets = async (): Promise<Ticket[]> => {
  try {
    const data = await frappeGet<{ tickets: Ticket[] }>('get_my_tickets');
    return data?.tickets || [];
  } catch (error) {
    console.error('Error fetching my tickets:', error);
    throw error;
  }
};

/** Lấy tất cả ticket (dành cho admin/support team) */
export const getAllTickets = async (): Promise<Ticket[]> => {
  try {
    const data = await frappeGet<{ tickets: Ticket[] }>('get_all_tickets');
    return data?.tickets || [];
  } catch (error) {
    console.error('Error fetching all tickets:', error);
    throw error;
  }
};

/** Lấy chi tiết ticket */
export const getTicketDetail = async (ticketId: string): Promise<Ticket | null> => {
  try {
    const data = await frappePost<Ticket>('get_ticket', { ticket_id: ticketId });
    return data || null;
  } catch (error) {
    console.error('Error fetching ticket detail:', error);
    throw error;
  }
};

/** Tạo ticket mới với file upload */
export const createTicket = async (ticketData: {
  title: string;
  description: string;
  category: string;
  notes?: string;
  priority?: string;
  files?: any[];
}): Promise<Ticket> => {
  const maxRetries = 3;

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('title', ticketData.title);
    formData.append('description', ticketData.description);
    formData.append('category', ticketData.category);
    formData.append('notes', ticketData.notes || '');
    formData.append('priority', ticketData.priority || 'Medium');
    formData.append('source', 'mobile');
    if (ticketData.files?.length) {
      ticketData.files.forEach((file) => {
        if (file.uri && file.name && file.type) {
          formData.append('attachments', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        }
      });
    }
    return formData;
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const formData = buildFormData();
      const response = await axios.post(`${IT_API}.create_ticket`, formData, {
        baseURL: BASE_URL,
        timeout: 120000,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'multipart/form-data',
        },
        validateStatus: (status) => status >= 200 && status < 600,
      });

      if (response.status >= 400) {
        throw new Error(parseFrappeApiError(response.data));
      }

      const out = unwrap<Ticket>(response);
      if (!out.success || !out.data) {
        throw new Error(out.message || 'Failed to create ticket');
      }
      return out.data;
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (attempt < maxRetries && err?.message?.includes('Trùng')) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        continue;
      }
      console.error(`Error creating ticket (attempt ${attempt}):`, error);
      throw error;
    }
  }

  throw new Error('Failed to create ticket after multiple attempts');
};

/** Cập nhật ticket */
export const updateTicket = async (ticketId: string, updates: Partial<Ticket> & { status?: string }): Promise<Ticket> => {
  try {
    const payload: Record<string, unknown> = { ticket_id: ticketId };
    if (updates.title) payload.title = updates.title;
    if (updates.description) payload.description = updates.description;
    if (updates.category) payload.category = updates.category;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.priority) payload.priority = updates.priority;
    if (updates.status) payload.status = updates.status;
    return frappePost<Ticket>('update_ticket', payload);
  } catch (error) {
    console.error('Error updating ticket:', error);
    throw error;
  }
};

/** Xóa ticket */
export const deleteTicket = async (ticketId: string): Promise<void> => {
  try {
    await frappePost('delete_ticket', { ticket_id: ticketId });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    throw error;
  }
};

/** Gửi message vào ticket */
export const sendMessage = async (
  ticketId: string,
  messageData: {
    text?: string;
    images?: any[];
  }
): Promise<Message> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const formData = new FormData();
    formData.append('ticket_id', ticketId);
    if (messageData.text) {
      formData.append('text', messageData.text);
    }
    if (messageData.images?.length) {
      messageData.images.forEach((image) => {
        if (image.uri && image.name && image.type) {
          formData.append('files', {
            uri: image.uri,
            name: image.name,
            type: image.type,
          } as any);
        }
      });
    }

    const response = await axios.post(`${IT_API}.send_comment`, formData, {
      baseURL: BASE_URL,
      timeout: 120000,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'multipart/form-data',
      },
      validateStatus: (status) => status >= 200 && status < 600,
    });

    if (response.status >= 400) {
      throw new Error(parseFrappeApiError(response.data));
    }

    const out = unwrap<{
      messageData?: Message;
      success?: boolean;
    }>(response);

    if (!out.success) {
      throw new Error(out.message || 'Không thể gửi tin nhắn');
    }

    const data = out.data as { messageData?: Message } | Message | undefined;
    if (data && typeof data === 'object' && 'messageData' in data && data.messageData?._id) {
      return data.messageData;
    }
    if (data && typeof data === 'object' && '_id' in data) {
      return data as Message;
    }

    throw new Error('Không thể gửi tin nhắn');
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[sendMessage] Error:', err?.message || error);
    throw new Error(err?.message || 'Không thể gửi tin nhắn');
  }
};

/** Lấy messages của ticket */
export const getTicketMessages = async (ticketId: string): Promise<Message[]> => {
  try {
    const data = await frappePost<{ messages: Message[] }>('get_comments', { ticket_id: ticketId });
    return data?.messages || [];
  } catch (error) {
    console.error('[getTicketMessages] Error:', error);
    return [];
  }
};

/** Lấy lịch sử ticket */
export const getTicketHistory = async (ticketId: string): Promise<TicketHistoryEntry[]> => {
  try {
    const data = await frappePost<TicketHistoryEntry[]>('get_history', { ticket_id: ticketId });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching ticket history:', error);
    return [];
  }
};

/** Nhận ticket (assign to me) */
export const assignTicketToMe = async (ticketId: string): Promise<Ticket> => {
  try {
    return frappePost<Ticket>('assign_ticket', { ticket_id: ticketId });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    throw error;
  }
};

/** Chuyển ticket cho nhân viên IT khác */
export const assignTicketToUser = async (ticketId: string, userId: string): Promise<Ticket> => {
  try {
    return frappePost<Ticket>('reassign_ticket', {
      ticket_id: ticketId,
      assignedTo: userId,
    });
  } catch (error) {
    console.error('Error assigning ticket to user:', error);
    throw error;
  }
};

/** Hủy ticket kèm lý do */
export const cancelTicket = async (ticketId: string, reason: string): Promise<Ticket> => {
  try {
    return frappePost<Ticket>('cancel_ticket', { ticket_id: ticketId, cancelReason: reason });
  } catch (error) {
    console.error('Error canceling ticket:', error);
    throw error;
  }
};

/** Mở lại ticket */
export const reopenTicket = async (ticketId: string): Promise<Ticket> => {
  try {
    const data = await frappePost<{ ticket?: Ticket }>('reopen_ticket', { ticket_id: ticketId });
    if (data && typeof data === 'object' && 'ticket' in data && data.ticket) {
      return data.ticket;
    }
    return data as unknown as Ticket;
  } catch (error) {
    console.error('Error reopening ticket:', error);
    throw error;
  }
};

/** Lấy danh sách categories */
export const getTicketCategories = async (): Promise<TicketCategory[]> => {
  try {
    const data = await frappeGet<TicketCategory[]>('get_ticket_categories');
    return Array.isArray(data) ? data : getAllCategoryMappings();
  } catch (error) {
    console.error('Error fetching ticket categories:', error);
    return getAllCategoryMappings();
  }
};

/** Lấy danh sách sub-tasks */
export const getSubTasks = async (ticketId: string): Promise<SubTask[]> => {
  try {
    const data = await frappePost<{ subTasks: SubTask[] }>('get_subtasks', { ticket_id: ticketId });
    return data?.subTasks || [];
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    throw error;
  }
};

/** Tạo sub-task mới */
export const createSubTask = async (
  ticketId: string,
  subTaskData: {
    title: string;
    description?: string;
    assignedTo?: string;
  }
): Promise<SubTask> => {
  try {
    const result = await frappePost<{ ticket: Ticket }>('create_subtask', {
      ticket_id: ticketId,
      ...subTaskData,
    });
    const subTasks = result?.ticket?.subTasks || [];
    const last = subTasks[subTasks.length - 1];
    if (!last) throw new Error('Failed to create subtask');
    return last;
  } catch (error) {
    console.error('Error creating subtask:', error);
    throw error;
  }
};

/** Cập nhật sub-task status */
export const updateSubTaskStatus = async (
  ticketId: string,
  subTaskId: string,
  status: string
): Promise<void> => {
  try {
    await frappePost('update_subtask', {
      ticket_id: ticketId,
      sub_task_id: subTaskId,
      status,
    });
  } catch (error) {
    console.error('Error updating subtask:', error);
    throw error;
  }
};

/** Gửi feedback */
export const acceptFeedback = async (ticketId: string, feedbackData: Feedback): Promise<Ticket> => {
  try {
    const data = await frappePost<{ ticket?: Ticket }>('accept_feedback', {
      ticket_id: ticketId,
      rating: feedbackData.rating,
      comment: feedbackData.comment || '',
      badges: feedbackData.badges || [],
    });
    if (data && typeof data === 'object' && 'ticket' in data && data.ticket) {
      return data.ticket;
    }
    return data as unknown as Ticket;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[acceptFeedback] Error:', err?.message || error);
    throw new Error(err?.message || 'Không thể gửi đánh giá');
  }
};

/** Lấy feedback stats của team member */
export const getTeamMemberFeedbackStats = async (email: string): Promise<FeedbackStats> => {
  try {
    const data = await frappePost<{
      summary?: { feedbackCount?: number };
      feedback?: {
        averageRating?: number;
        badges?: string[];
        badgeCounts?: Record<string, number>;
      };
    }>('get_feedback_stats', { email });

    const feedbackData = data?.feedback;
    const summaryData = data?.summary;

    return {
      averageRating: feedbackData?.averageRating || 0,
      totalFeedbacks: summaryData?.feedbackCount || 0,
      badges: feedbackData?.badges || [],
      badgeCounts: feedbackData?.badgeCounts || {},
    };
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    return {
      averageRating: 0,
      totalFeedbacks: 0,
      badges: [],
      badgeCounts: {},
    };
  }
};

/** Lấy danh sách support team members */
export const getSupportTeamMembers = async (): Promise<SupportTeamMember[]> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`${IT_TEAM_API}.get_all_team_members`, config);
    const out = unwrap<{ members?: SupportTeamMember[] }>(response);
    if (out.success && out.data?.members) {
      return out.data.members.map((m) => ({
        ...m,
        userId: m.userId || m._id,
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching support team members:', error);
    throw error;
  }
};
