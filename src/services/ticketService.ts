import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';
import { getAllCategoryMappings } from '../config/ticketCategories';

// Helper function to get axios config with auth token
const getAxiosConfig = async (additionalConfig = {}) => {
  const token = await AsyncStorage.getItem('authToken');
  const defaultHeaders = {
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
      return response.data.data;
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
          formData.append('files', {
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
    const response = await axios.post(`/api/ticket/${ticketId}/messages`, formData, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error('Failed to send message');
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * Lấy messages của ticket
 */
export const getTicketMessages = async (ticketId: string): Promise<Message[]> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`/api/ticket/${ticketId}/messages`, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return [];
  } catch (error) {
    console.error('Error fetching ticket messages:', error);
    throw error;
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
 */
export const assignTicketToMe = async (ticketId: string): Promise<Ticket> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`/api/ticket/${ticketId}/assign-to-me`, {}, config);

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
 */
export const cancelTicket = async (ticketId: string, reason: string): Promise<Ticket> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`/api/ticket/${ticketId}/cancel`, { reason }, config);

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

    if (response.data?.success && response.data?.data) {
      return response.data.data;
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
): Promise<SubTask> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.put(
      `/api/ticket/${ticketId}/subtasks/${subTaskId}`,
      { status },
      config
    );

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error('Failed to update subtask');
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
    const response = await axios.post(`/api/ticket/${ticketId}/feedback`, feedbackData, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error('Failed to submit feedback');
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
};

/**
 * Lấy feedback stats của team member
 */
export const getTeamMemberFeedbackStats = async (email: string): Promise<any> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`/api/ticket/feedback/stats/${email}`, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    throw error;
  }
};

/**
 * Lấy technical stats
 */
export const getTechnicalStats = async (): Promise<any> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get('/api/ticket/stats/technical', config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    console.error('Error fetching technical stats:', error);
    throw error;
  }
};

/**
 * Lấy technical stats by user ID
 */
export const getTechnicalStatsByUserId = async (userId: string): Promise<any> => {
  try {
    const config = await getAxiosConfig();
    const response = await axios.get(`/api/ticket/stats/technical/${userId}`, config);

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    console.error('Error fetching technical stats by user ID:', error);
    throw error;
  }
};
