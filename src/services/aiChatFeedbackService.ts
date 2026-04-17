import api from '../utils/api';

/** Khớp Select trên Doctype Frappe + backend DISLIKE_REASONS */
export const AI_CHAT_DISLIKE_REASONS = [
  'Đúng kiến thức',
  'Đúng kiến thức/ Cách trình bày chưa hợp lý',
  'Sai kiến thức',
  'Thiếu kiến thức',
  'Chưa có kiến thức',
  'Dữ liệu sai',
] as const;

export type AiChatAgentType = 'WISers' | 'Receptionist' | 'Parent';
export type AiChatFeedbackType = 'Like' | 'Dislike';

export interface SubmitAiChatFeedbackPayload {
  message_id: string;
  agent_type: AiChatAgentType;
  feedback_type: AiChatFeedbackType;
  user_question: string;
  ai_answer: string;
  user_email?: string;
  user_name?: string;
  dislike_reason?: string;
  dislike_detail?: string;
}

const BASE = '/method/erp.api.ai_chat_feedback';

export interface SubmitFeedbackResult {
  success: boolean;
  message?: string;
  data?: { name: string };
}

/**
 * Ghi nhận like/dislike — backend allow_guest; app vẫn gửi Bearer khi user đã đăng nhập.
 */
async function submitFeedback(payload: SubmitAiChatFeedbackPayload): Promise<SubmitFeedbackResult> {
  try {
    const response = await api.post(`${BASE}.submit_feedback`, payload);
    const messageData = response.data?.message;
    if (messageData?.success) {
      return { success: true, data: messageData.data, message: messageData.message };
    }
    if (response.data?.success) {
      return { success: true, data: response.data.data, message: response.data.message };
    }
    const errMsg =
      messageData?.message ||
      response.data?.message ||
      (typeof messageData === 'string' ? messageData : undefined) ||
      'Không thể gửi phản hồi';
    return { success: false, message: errMsg };
  } catch (error: unknown) {
    const msg =
      (error as { response?: { data?: { message?: { message?: string } | string } } })?.response?.data
        ?.message;
    const extracted =
      typeof msg === 'object' && msg != null && 'message' in msg
        ? (msg as { message: string }).message
        : typeof msg === 'string'
          ? msg
          : error instanceof Error
            ? error.message
            : 'Không thể gửi phản hồi';
    return { success: false, message: extracted };
  }
}

export const aiChatFeedbackService = {
  submitFeedback,
};
