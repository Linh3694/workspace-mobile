import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';

// Helper function to get axios config with auth token
const getAxiosConfig = async (additionalConfig: { headers?: Record<string, string> } = {}) => {
  const token = await AsyncStorage.getItem('authToken');
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const mergedHeaders = {
    ...defaultHeaders,
    ...(additionalConfig.headers || {}),
  };

  return {
    baseURL: BASE_URL,
    timeout: 30000,
    ...additionalConfig,
    headers: mergedHeaders,
  };
};

// Types
export interface GuardianInfo {
  name: string;
  phone_number?: string;
  email?: string;
  students: {
    name: string;
    student_id: string;
    relationship?: string;
    class_name?: string;
    program?: string;
    photo?: string;
    photo_title?: string;
  }[];
}

export interface FeedbackReply {
  content: string;
  reply_by: string;
  reply_by_type: 'Guardian' | 'Staff';
  reply_by_full_name?: string;
  reply_date: string;
  is_internal?: boolean;
  attachments?: string;
}

export interface Feedback {
  name: string;
  feedback_type: 'Góp ý' | 'Đánh giá';
  title?: string;
  content?: string;
  status: string;
  priority?: string;
  department?: string;
  rating?: number;
  rating_comment?: string;
  guardian: string;
  guardian_name?: string;
  guardian_info?: GuardianInfo;
  assigned_to?: string;
  assigned_to_full_name?: string;
  assigned_to_jobtitle?: string;
  assigned_to_avatar?: string;
  assigned_date?: string;
  submitted_at: string;
  last_updated?: string;
  closed_at?: string;
  conversation_count?: number;
  resolution_rating?: number;
  resolution_comment?: string;
  deadline?: string;
  sla_status?: 'On time' | 'Warning' | 'Overdue';
  first_response_date?: string;
  replies?: FeedbackReply[];
}

export interface FeedbackListParams {
  page?: number;
  page_length?: number;
  feedback_type?: string;
  status?: string;
  department?: string;
  priority?: string;
  assigned_to?: string;
  search?: string;
}

export interface FeedbackListResponse {
  success: boolean;
  data?: {
    data: Feedback[];
    total: number;
    page: number;
    page_length: number;
  };
  message?: string;
}

export interface FeedbackDetailResponse {
  success: boolean;
  data?: Feedback;
  message?: string;
}

export interface SupportTeamUser {
  name: string;
  email: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  user_image?: string;
  employee_code?: string;
  employee_id?: string;
  user_id?: string;
}

// Feedback Service
const FEEDBACK_API = '/api/method/erp.api.erp_sis.feedback';

/**
 * Get list of feedback (admin)
 */
export const getFeedbackList = async (
  params?: FeedbackListParams
): Promise<FeedbackListResponse> => {
  try {
    const config = await getAxiosConfig();

    // Build query params
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_length) queryParams.append('page_length', params.page_length.toString());
    if (params?.feedback_type) queryParams.append('feedback_type', params.feedback_type);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.department) queryParams.append('department', params.department);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.assigned_to) queryParams.append('assigned_to', params.assigned_to);
    if (params?.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const url = `${FEEDBACK_API}.admin_list${queryString ? '?' + queryString : ''}`;

    console.log('[getFeedbackList] Requesting:', url);

    const response = await axios.get(url, config);

    console.log('[getFeedbackList] Response:', JSON.stringify(response.data, null, 2));

    // Frappe response structure: { message: { success, data, message } }
    if (response.data?.message?.success) {
      return {
        success: true,
        data: response.data.message.data,
      };
    }

    return {
      success: false,
      message: response.data?.message?.message || 'Lỗi khi lấy danh sách feedback',
    };
  } catch (error: any) {
    console.error('[getFeedbackList] Error:', error?.response?.data || error?.message);
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Lỗi kết nối',
    };
  }
};

/**
 * Get feedback detail (admin)
 */
export const getFeedbackDetail = async (feedbackName: string): Promise<FeedbackDetailResponse> => {
  try {
    const config = await getAxiosConfig();
    const url = `${FEEDBACK_API}.admin_get?name=${encodeURIComponent(feedbackName)}`;

    console.log('[getFeedbackDetail] Requesting:', url);

    const response = await axios.get(url, config);

    console.log('[getFeedbackDetail] Response:', JSON.stringify(response.data, null, 2));

    // Frappe response structure: { message: { success, data, message } }
    if (response.data?.message?.success) {
      return {
        success: true,
        data: response.data.message.data,
      };
    }

    return {
      success: false,
      message: response.data?.message?.message || 'Không tìm thấy feedback',
    };
  } catch (error: any) {
    console.error('[getFeedbackDetail] Error:', error?.response?.data || error?.message);
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Lỗi kết nối',
    };
  }
};

/**
 * Assign feedback to user
 */
export const assignFeedback = async (
  feedbackName: string,
  assignedTo: string,
  priority?: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const config = await getAxiosConfig();
    const url = `${FEEDBACK_API}.assign`;

    const body: any = {
      name: feedbackName,
      assigned_to: assignedTo,
    };
    if (priority) {
      body.priority = priority;
    }

    console.log('[assignFeedback] Posting:', url, body);

    const response = await axios.post(url, body, config);

    console.log('[assignFeedback] Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.message?.success) {
      return { success: true };
    }

    return {
      success: false,
      message: response.data?.message?.message || 'Lỗi khi phân công feedback',
    };
  } catch (error: any) {
    console.error('[assignFeedback] Error:', error?.response?.data || error?.message);
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Lỗi kết nối',
    };
  }
};

interface MediaFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * Add reply to feedback (staff only)
 * Supports file attachments (images/videos)
 */
export const addFeedbackReply = async (
  feedbackName: string,
  content: string,
  isInternal: boolean = false,
  attachments: MediaFile[] = []
): Promise<{ success: boolean; message?: string }> => {
  try {
    const config = await getAxiosConfig();
    const url = `${FEEDBACK_API}.add_reply`;

    // Use FormData if there are attachments
    if (attachments && attachments.length > 0) {
      const formData = new FormData();
      formData.append('name', feedbackName);
      formData.append('content', content);
      formData.append('is_internal', isInternal ? '1' : '0');

      // Add files
      attachments.forEach((file, index) => {
        if (file.uri && file.name && file.type) {
          formData.append('attachments', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        }
      });

      console.log('[addFeedbackReply] Posting with files:', url);

      const response = await axios.post(url, formData, {
        ...config,
        headers: {
          ...config.headers,
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('[addFeedbackReply] Response:', JSON.stringify(response.data, null, 2));

      if (response.data?.message?.success) {
        return { success: true };
      }

      return {
        success: false,
        message: response.data?.message?.message || 'Lỗi khi thêm phản hồi',
      };
    }

    // No attachments, use regular JSON body
    const body = {
      name: feedbackName,
      content: content,
      is_internal: isInternal,
    };

    console.log('[addFeedbackReply] Posting:', url, body);

    const response = await axios.post(url, body, config);

    console.log('[addFeedbackReply] Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.message?.success) {
      return { success: true };
    }

    return {
      success: false,
      message: response.data?.message?.message || 'Lỗi khi thêm phản hồi',
    };
  } catch (error: any) {
    console.error('[addFeedbackReply] Error:', error?.response?.data || error?.message);
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Lỗi kết nối',
    };
  }
};

/**
 * Update feedback status
 */
export const updateFeedbackStatus = async (
  feedbackName: string,
  status: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const config = await getAxiosConfig();
    const url = `${FEEDBACK_API}.update_status`;

    const body = {
      name: feedbackName,
      status: status,
    };

    console.log('[updateFeedbackStatus] Posting:', url, body);

    const response = await axios.post(url, body, config);

    console.log('[updateFeedbackStatus] Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.message?.success) {
      return { success: true };
    }

    return {
      success: false,
      message: response.data?.message?.message || 'Lỗi khi cập nhật trạng thái',
    };
  } catch (error: any) {
    console.error('[updateFeedbackStatus] Error:', error?.response?.data || error?.message);
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Lỗi kết nối',
    };
  }
};

/**
 * Close feedback
 */
export const closeFeedback = async (
  feedbackName: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const config = await getAxiosConfig();
    const url = `${FEEDBACK_API}.close_feedback`;

    const body = {
      name: feedbackName,
    };

    console.log('[closeFeedback] Posting:', url, body);

    const response = await axios.post(url, body, config);

    console.log('[closeFeedback] Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.message?.success) {
      return { success: true };
    }

    return {
      success: false,
      message: response.data?.message?.message || 'Lỗi khi đóng feedback',
    };
  } catch (error: any) {
    console.error('[closeFeedback] Error:', error?.response?.data || error?.message);
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Lỗi kết nối',
    };
  }
};

/**
 * Get users for assignment (SIS IT role)
 */
export const getUsersForAssignment = async (): Promise<{
  success: boolean;
  data?: SupportTeamUser[];
  message?: string;
}> => {
  try {
    const config = await getAxiosConfig();
    const url = `${FEEDBACK_API}.get_users_for_assignment`;

    console.log('[getUsersForAssignment] Requesting:', url);

    const response = await axios.get(url, config);

    console.log('[getUsersForAssignment] Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.message?.success) {
      return {
        success: true,
        data: response.data.message.data,
      };
    }

    return {
      success: false,
      message: response.data?.message?.message || 'Lỗi khi lấy danh sách người xử lý',
    };
  } catch (error: any) {
    console.error('[getUsersForAssignment] Error:', error?.response?.data || error?.message);
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Lỗi kết nối',
    };
  }
};

/**
 * Update priority
 */
export const updateFeedbackPriority = async (
  feedbackName: string,
  priority: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const config = await getAxiosConfig();
    const url = `${FEEDBACK_API}.update_priority`;

    const body = {
      name: feedbackName,
      priority: priority,
    };

    console.log('[updateFeedbackPriority] Posting:', url, body);

    const response = await axios.post(url, body, config);

    console.log('[updateFeedbackPriority] Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.message?.success) {
      return { success: true };
    }

    return {
      success: false,
      message: response.data?.message?.message || 'Lỗi khi cập nhật độ ưu tiên',
    };
  } catch (error: any) {
    console.error('[updateFeedbackPriority] Error:', error?.response?.data || error?.message);
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Lỗi kết nối',
    };
  }
};

/**
 * Update assignment (both assigned_to and priority)
 */
export const updateFeedbackAssignment = async (
  feedbackName: string,
  assignedTo?: string,
  priority?: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const config = await getAxiosConfig();
    const url = `${FEEDBACK_API}.update_assignment`;

    const body: any = {
      name: feedbackName,
    };
    if (assignedTo) body.assigned_to = assignedTo;
    if (priority) body.priority = priority;

    console.log('[updateFeedbackAssignment] Posting:', url, body);

    const response = await axios.post(url, body, config);

    console.log('[updateFeedbackAssignment] Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.message?.success) {
      return { success: true };
    }

    return {
      success: false,
      message: response.data?.message?.message || 'Lỗi khi cập nhật phân công',
    };
  } catch (error: any) {
    console.error('[updateFeedbackAssignment] Error:', error?.response?.data || error?.message);
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Lỗi kết nối',
    };
  }
};

/**
 * Delete feedback
 */
export const deleteFeedback = async (
  feedbackName: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const config = await getAxiosConfig();
    const url = `${FEEDBACK_API}.delete_feedback`;

    const body = {
      name: feedbackName,
    };

    console.log('[deleteFeedback] Posting:', url, body);

    const response = await axios.post(url, body, config);

    console.log('[deleteFeedback] Response:', JSON.stringify(response.data, null, 2));

    if (response.data?.message?.success) {
      return { success: true };
    }

    return {
      success: false,
      message: response.data?.message?.message || 'Lỗi khi xóa feedback',
    };
  } catch (error: any) {
    console.error('[deleteFeedback] Error:', error?.response?.data || error?.message);
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Lỗi kết nối',
    };
  }
};

export default {
  getFeedbackList,
  getFeedbackDetail,
  assignFeedback,
  addFeedbackReply,
  updateFeedbackStatus,
  closeFeedback,
  getUsersForAssignment,
  updateFeedbackPriority,
  updateFeedbackAssignment,
  deleteFeedback,
};
