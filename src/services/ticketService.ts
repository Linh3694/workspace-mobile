import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';
import { getAllCategoryMappings } from '../config/ticketConstants';

// Helper function to get axios config with auth token
const getAxiosConfig = async (additionalConfig: { headers?: Record<string, string> } = {}) => {
  const token = await AsyncStorage.getItem('authToken');
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Merge headers properly to avoid overriding Authorization
  const mergedHeaders = {
    ...defaultHeaders,
    ...(additionalConfig.headers || {}),
  };

  return {
    baseURL: API_BASE_URL,
    timeout: 30000,
    ...additionalConfig,
    headers: mergedHeaders,
  };
};

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
  type: 'text' | 'image';
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
  timestamp: string;
  action: string;
  user: {
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

/**
 * Lấy danh sách ticket của user đang đăng nhập
 */
export const getMyTickets = async (): Promise<Ticket[]> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get<any>('/api/ticket/my-tickets', config);

    if (response.data?.success && response.data?.data?.tickets) {
      return response.data.data.tickets;
    }

    return [];
  } catch (error) {
    console.error('Error fetching my tickets:', error);
    throw error;
  }
};

/**
 * Lấy tất cả ticket (dành cho admin/support team)
 */
export const getAllTickets = async (): Promise<Ticket[]> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get<any>('/api/ticket/all-tickets', config);

    if (response.data?.success && response.data?.data?.tickets) {
      return response.data.data.tickets;
    }

    return [];
  } catch (error) {
    console.error('Error fetching all tickets:', error);
    throw error;
  }
};

/**
 * Lấy chi tiết ticket
 */
export const getTicketDetail = async (ticketId: string): Promise<Ticket | null> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get<any>(`/api/ticket/${ticketId}`, config);

    if (response.data?.success && response.data?.data) {
      const ticket = response.data.data;
      // Debug log for feedback
      if (ticket.feedback) {
        console.log('[getTicketDetail] Ticket feedback:', JSON.stringify(ticket.feedback, null, 2));
      }
      return ticket;
    }

    return null;
  } catch (error) {
    console.error('Error fetching ticket detail:', error);
    throw error;
  }
};

/**
 * Tạo ticket mới với file upload
 */
export const createTicket = async (ticketData: {
  title: string;
  description: string;
  category: string;
  notes?: string;
  priority?: string;
  files?: any[]; // React Native file objects
}): Promise<Ticket> => {
  try {
    const formData = new FormData();

    formData.append('title', ticketData.title);
    formData.append('description', ticketData.description);
    formData.append('category', ticketData.category);

    if (ticketData.notes) {
      formData.append('notes', ticketData.notes);
    }

    if (ticketData.priority) {
      formData.append('priority', ticketData.priority);
    }

    // Handle file uploads for React Native
    if (ticketData.files && ticketData.files.length > 0) {
      ticketData.files.forEach((file, index) => {
        if (file.uri && file.name && file.type) {
          formData.append('attachments', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        }
      });
    }

    const config = await getAxiosConfig({
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const response = await axios.post('/api/ticket', formData, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error('Failed to create ticket');
  } catch (error) {
    console.error('Error creating ticket:', error);
    throw error;
  }
};

/**
 * Cập nhật ticket
 */
export const updateTicket = async (ticketId: string, updates: Partial<Ticket>): Promise<Ticket> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.put(`/api/ticket/${ticketId}`, updates, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error('Failed to update ticket');
  } catch (error) {
    console.error('Error updating ticket:', error);
    throw error;
  }
};

/**
 * Xóa ticket
 */
export const deleteTicket = async (ticketId: string): Promise<void> => {
  try {
    const config = await getAxiosConfig();
    await axios.delete(`/api/ticket/${ticketId}`, config);
  } catch (error) {
    console.error('Error deleting ticket:', error);
    throw error;
  }
};

/**
 * Gửi message vào ticket
 */
export const sendMessage = async (
  ticketId: string,
  messageData: {
    text?: string;
    images?: any[]; // React Native file objects
  }
): Promise<Message> => {
  try {
    const formData = new FormData();

    if (messageData.text) {
      formData.append('text', messageData.text);
    }

    // Handle image uploads
    if (messageData.images && messageData.images.length > 0) {
      messageData.images.forEach((image, index) => {
        if (image.uri && image.name && image.type) {
          formData.append('files', {
            uri: image.uri,
            name: image.name,
            type: image.type,
          } as any);
        }
      });
    }

    const config = await getAxiosConfig({
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('[sendMessage] Sending to:', `/api/ticket/${ticketId}/messages`);
    console.log('[sendMessage] Text:', messageData.text);
    console.log('[sendMessage] Images count:', messageData.images?.length || 0);

    const response = await axios.post(`/api/ticket/${ticketId}/messages`, formData, config);

    console.log('[sendMessage] Response:', JSON.stringify(response.data, null, 2));

    // Handle different response formats
    // API returns { success: true, messageData: {...} }
    if (response.data?.success && response.data?.messageData) {
      return response.data.messageData;
    }

    // Fallback: { success: true, data: {...} }
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    // If response has _id, it might be the message itself
    if (response.data?._id) {
      return response.data;
    }

    console.error('[sendMessage] Unexpected response format:', response.data);
    throw new Error('Không thể gửi tin nhắn');
  } catch (error: any) {
    console.error('[sendMessage] Error:', error?.response?.data || error?.message || error);
    const errorMsg = error?.response?.data?.message || error?.message || 'Không thể gửi tin nhắn';
    throw new Error(errorMsg);
  }
};

/**
 * Lấy messages của ticket
 */
export const getTicketMessages = async (ticketId: string): Promise<Message[]> => {
  try {
    const config = await getAxiosConfig();
    console.log('[getTicketMessages] Fetching messages for ticket:', ticketId);
    const response = await axios.get(`/api/ticket/${ticketId}/messages`, config);

    console.log('[getTicketMessages] Response:', JSON.stringify(response.data, null, 2));

    // Handle different response formats
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    // Some APIs return messages directly in array
    if (Array.isArray(response.data)) {
      return response.data;
    }

    // Check if messages is in response.data.messages
    if (response.data?.messages && Array.isArray(response.data.messages)) {
      return response.data.messages;
    }

    console.log('[getTicketMessages] No messages found in response');
    return [];
  } catch (error: any) {
    console.error('[getTicketMessages] Error:', error?.response?.data || error?.message || error);
    // Don't throw, return empty array to prevent crash
    return [];
  }
};

/**
 * Lấy lịch sử ticket
 */
export const getTicketHistory = async (ticketId: string): Promise<TicketHistoryEntry[]> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`/api/ticket/${ticketId}/history`, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return [];
  } catch (error) {
    console.error('Error fetching ticket history:', error);
    throw error;
  }
};

/**
 * Assign ticket to me (for support team)
 * Backend: PUT /api/ticket/:ticketId/assign
 */
export const assignTicketToMe = async (ticketId: string): Promise<Ticket> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.put(`/api/ticket/${ticketId}/assign`, {}, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error('Failed to assign ticket');
  } catch (error) {
    console.error('Error assigning ticket:', error);
    throw error;
  }
};

/**
 * Cancel ticket with reason
 * Backend: PUT /api/ticket/:ticketId/cancel
 */
export const cancelTicket = async (ticketId: string, reason: string): Promise<Ticket> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.put(
      `/api/ticket/${ticketId}/cancel`,
      { cancelReason: reason },
      config
    );

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error('Failed to cancel ticket');
  } catch (error) {
    console.error('Error canceling ticket:', error);
    throw error;
  }
};

/**
 * Reopen ticket
 */
export const reopenTicket = async (ticketId: string): Promise<Ticket> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`/api/ticket/${ticketId}/reopen`, {}, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error('Failed to reopen ticket');
  } catch (error) {
    console.error('Error reopening ticket:', error);
    throw error;
  }
};

/**
 * Lấy danh sách categories
 */
export const getTicketCategories = async (): Promise<TicketCategory[]> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get('/api/ticket/categories', config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    // Fallback to default categories
    return getAllCategoryMappings();
  } catch (error) {
    console.error('Error fetching ticket categories:', error);
    // Fallback to default categories
    return getAllCategoryMappings();
  }
};

/**
 * Lấy danh sách sub-tasks
 */
export const getSubTasks = async (ticketId: string): Promise<SubTask[]> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`/api/ticket/${ticketId}/subtasks`, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return [];
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    throw error;
  }
};

/**
 * Tạo sub-task mới
 */
export const createSubTask = async (
  ticketId: string,
  subTaskData: {
    title: string;
    description?: string;
    assignedTo?: string;
  }
): Promise<SubTask> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`/api/ticket/${ticketId}/subtasks`, subTaskData, config);

    // Backend trả về ticket object, lấy subtask mới nhất
    if (response.data?.success && response.data?.ticket) {
      const subTasks = response.data.ticket.subTasks || [];
      return subTasks[subTasks.length - 1];
    }

    throw new Error('Failed to create subtask');
  } catch (error) {
    console.error('Error creating subtask:', error);
    throw error;
  }
};

/**
 * Cập nhật sub-task status
 */
export const updateSubTaskStatus = async (
  ticketId: string,
  subTaskId: string,
  status: string
): Promise<void> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.put(
      `/api/ticket/${ticketId}/subtasks/${subTaskId}`,
      { status },
      config
    );

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Failed to update subtask');
    }
  } catch (error) {
    console.error('Error updating subtask:', error);
    throw error;
  }
};

/**
 * Submit feedback
 */
export const acceptFeedback = async (ticketId: string, feedbackData: Feedback): Promise<Ticket> => {
  try {
    const config = await getAxiosConfig();
    console.log('[acceptFeedback] Submitting feedback for ticket:', ticketId, feedbackData);

    const response = await axios.post(`/api/ticket/${ticketId}/feedback`, feedbackData, config);
    console.log('[acceptFeedback] Response:', JSON.stringify(response.data, null, 2));

    // Handle different response formats
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    // Some backends return data directly
    if (response.data?.ticket || response.data?._id) {
      return response.data.ticket || response.data;
    }

    // If response status is OK but no expected data structure
    if (response.status === 200 || response.status === 201) {
      console.log('[acceptFeedback] Response OK but unexpected format, returning response.data');
      return response.data;
    }

    const errorMsg = response.data?.message || response.data?.error || 'Failed to submit feedback';
    throw new Error(errorMsg);
  } catch (error: any) {
    console.error('[acceptFeedback] Error:', error?.response?.data || error?.message || error);
    const errorMessage =
      error?.response?.data?.message || error?.message || 'Không thể gửi đánh giá';
    throw new Error(errorMessage);
  }
};

/**
 * Lấy feedback stats của team member
 */
export const getTeamMemberFeedbackStats = async (email: string): Promise<any> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`/api/ticket/feedback-stats/${email}`, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    return null; // Return null instead of throwing to avoid breaking UI
  }
};

/**
 * Lấy technical stats by user ID
 */
export const getTechnicalStatsByUserId = async (userId: string): Promise<any> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`/api/ticket/technical-stats/${userId}`, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    console.error('Error fetching technical stats by user ID:', error);
    return null; // Return null instead of throwing to avoid breaking UI
  }
};

export interface SupportTeamMember {
  _id: string;
  email: string;
  fullname: string;
  avatarUrl?: string;
  department?: string;
  roles?: string[];
  userObjectId?: string; // User's ObjectId (dùng khi assign ticket)
}

/**
 * Lấy danh sách support team members
 */
export const getSupportTeamMembers = async (): Promise<SupportTeamMember[]> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get('/api/ticket/support-team', config);

    if (response.data?.success && response.data?.data?.members) {
      return response.data.data.members;
    }

    return [];
  } catch (error) {
    console.error('Error fetching support team members:', error);
    throw error;
  }
};

/**
 * Assign ticket cho user khác
 */
export const assignTicketToUser = async (ticketId: string, userId: string): Promise<Ticket> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.put(`/api/ticket/${ticketId}`, { assignedTo: userId }, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error('Failed to assign ticket');
  } catch (error) {
    console.error('Error assigning ticket:', error);
    throw error;
  }
};
