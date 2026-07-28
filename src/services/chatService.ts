import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, type Socket } from 'socket.io-client';

import { BASE_URL } from '../config/constants';
import { normalizeCampusIdForBackend } from '../utils/campusIdUtils';
import type {
  AddableTeacher,
  ChatAttachment,
  ChatConversation,
  ChatConversationWriteMode,
  ChatEmoji,
  ChatMessage,
  ChatMessagesData,
  ChatPoll,
  ChatPollVotersData,
  ChatReaction,
  ClassChatScopePayload,
  CreateChatPollPayload,
  PinnedMessageSnapshot,
  SendChatMessageInput,
} from '../types/chat';

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

/** Lỗi HTTP của chat kèm status + mã nghiệp vụ backend trả về. */
export type ChatServiceError = Error & { status?: number; code?: string };

/** URL đầy đủ để tải/xem file chat (`/uploads/chat/...`). */
export function resolveChatAttachmentUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = BASE_URL.replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  if (path.startsWith('/uploads/chat/')) return `${base}/api/social${path}`;
  return `${base}${path}`;
}

class ChatService {
  private socket: Socket | null = null;

  /**
   * Campus đang chọn — social-service relay sang Frappe (has_campus_permission).
   * Thiếu campus → Frappe fallback theo campus role → 403 khi đọc SIS Class/chat scope.
   * Web luôn gửi header này (X-Campus-Id); mobile phải gửi tương tự.
   */
  private async getCampusId(): Promise<string> {
    const raw = (await AsyncStorage.getItem('currentCampusId')) || '';
    return normalizeCampusIdForBackend(raw);
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem('authToken');
    const campusId = await this.getCampusId();
    const h: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (token) h.Authorization = `Bearer ${token}`;
    if (campusId) h['X-Campus-Id'] = campusId;
    return h;
  }

  private async getMultipartHeaders(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem('authToken');
    const campusId = await this.getCampusId();
    const h: Record<string, string> = { Accept: 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    if (campusId) h['X-Campus-Id'] = campusId;
    return h;
  }

  /** Lỗi kèm status + mã nghiệp vụ backend trả về (vd 'TEACHERS_ONLY', 'POLL_CLOSED'). */
  private buildError(message: string, status: number, code?: unknown): ChatServiceError {
    const err = new Error(message) as ChatServiceError;
    err.status = status;
    if (typeof code === 'string') err.code = code;
    return err;
  }

  private async parseJson<T>(res: Response): Promise<T> {
    const text = await res.text();
    let body: ApiResponse<T> | T | Record<string, unknown> = {};
    try {
      body = text ? (JSON.parse(text) as ApiResponse<T>) : {};
    } catch {
      throw this.buildError(`Invalid JSON (${res.status})`, res.status);
    }
    if (!res.ok) {
      throw this.buildError(
        typeof (body as ApiResponse<T>)?.message === 'string'
          ? ((body as ApiResponse<T>).message as string)
          : `HTTP ${res.status}`,
        res.status,
        (body as Record<string, unknown>)?.code
      );
    }
    const wrapped = body as ApiResponse<T>;
    if (wrapped && typeof wrapped === 'object' && 'success' in wrapped && wrapped.success === false) {
      throw this.buildError(
        wrapped.message || 'Request failed',
        res.status,
        (body as Record<string, unknown>)?.code
      );
    }
    if (wrapped && typeof wrapped === 'object' && 'data' in wrapped) {
      return wrapped.data as T;
    }
    return body as T;
  }

  /**
   * GV workspace-mobile: bắt buộc truyền classId (+ schoolYearId) trong query —
   * server chỉ khi đó gọi ensureClassConversations (Frappe Bearer). Không có query
   * thì listConversations lại đi nhánh getGuardianChatScopes (JWT PH) → luôn rỗng.
   */
  async getConversations(params?: {
    classId?: string;
    schoolYearId?: string;
  }): Promise<ChatConversation[]> {
    const headers = await this.getAuthHeaders();
    const q = new URLSearchParams();
    const cid = String(params?.classId || '').trim();
    const syid = String(params?.schoolYearId || '').trim();
    if (cid) q.set('classId', cid);
    if (syid) q.set('schoolYearId', syid);
    const qs = q.toString();
    const url = `${BASE_URL}/api/social/chat/conversations${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers });
    return this.parseJson<ChatConversation[]>(res);
  }

  /**
   * Scope lớp cho GV (homeroom/vice/subject teacher) — gọi method whitelist mới.
   * Trả về danh sách HS, guardian (kèm `key_person`), GVCN/Phó CN/GV bộ môn (kèm `subjects`).
   */
  async getClassChatScope(
    classId: string,
    schoolYearId: string,
  ): Promise<ClassChatScopePayload | null> {
    const token = await AsyncStorage.getItem('authToken');
    const campusId = await this.getCampusId();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (campusId) headers['X-Campus-Id'] = campusId;
    const res = await fetch(
      `${BASE_URL}/api/method/erp.api.erp_sis.chat_scope.get_class_chat_scope_for_teacher`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          class_id: classId,
          school_year_id: schoolYearId,
        }),
      },
    );
    const text = await res.text();
    let parsed: { message?: { success?: boolean; data?: ClassChatScopePayload } } = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Invalid JSON (${res.status})`);
    }
    if (!res.ok) {
      throw new Error(parsed?.message?.data ? 'Request failed' : `HTTP ${res.status}`);
    }
    const msg = parsed?.message;
    if (msg && typeof msg === 'object' && msg.success === false) {
      return null;
    }
    return msg?.data ?? null;
  }

  /**
   * GV mở chat 1-1 với 1 phụ huynh (key_person) — đối xứng với parent-portal.
   */
  async openTeacherGuardianChat(params: {
    teacherId: string;
    guardianId: string;
    classId: string;
    schoolYearId: string;
  }): Promise<ChatConversation> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/teacher-guardian`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          teacherId: params.teacherId,
          guardianId: params.guardianId,
          classId: params.classId,
          schoolYearId: params.schoolYearId,
        }),
      },
    );
    return this.parseJson<ChatConversation>(res);
  }

  /** Gửi tin trong kênh GV↔PH — tạo conversation khi cần (tin đầu). */
  async sendTeacherGuardianMessage(payload: {
    classId: string;
    schoolYearId: string;
    teacherId: string;
    guardianId: string;
    content?: string;
    replyTo?: string;
    attachments?: ChatAttachment[];
  }): Promise<{ message: ChatMessage; conversation: ChatConversation }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/teacher-guardian/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          classId: payload.classId,
          schoolYearId: payload.schoolYearId,
          teacherId: payload.teacherId,
          guardianId: payload.guardianId,
          content: payload.content ?? '',
          replyTo: payload.replyTo,
          attachments: payload.attachments,
        }),
      },
    );
    return this.parseJson(res);
  }

  /** Đính kèm trước khi có Mongo conversationId (thread nháp). */
  async uploadTeacherGuardianAttachments(
    meta: {
      classId: string;
      schoolYearId: string;
      teacherId: string;
      guardianId: string;
    },
    files: { uri: string; name: string; mimeType: string }[],
  ): Promise<ChatAttachment[]> {
    const headers = await this.getMultipartHeaders();
    const form = new FormData();
    form.append('classId', meta.classId);
    form.append('schoolYearId', meta.schoolYearId);
    form.append('teacherId', meta.teacherId);
    form.append('guardianId', meta.guardianId);
    for (const f of files) {
      form.append('files', {
        uri: f.uri,
        name: f.name || 'file',
        type: f.mimeType || 'application/octet-stream',
      } as unknown as Blob);
    }
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/teacher-guardian/attachments`,
      { method: 'POST', headers, body: form as unknown as BodyInit },
    );
    const data = await this.parseJson<{ attachments: ChatAttachment[] }>(res);
    return data.attachments;
  }

  async getMessages(
    conversationId: string,
    page = 1,
    limit = 50
  ): Promise<ChatMessagesData> {
    const headers = await this.getAuthHeaders();
    const q = `page=${page}&limit=${limit}`;
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/messages?${q}`,
      { headers }
    );
    return this.parseJson<ChatMessagesData>(res);
  }

  async sendMessage(
    conversationId: string,
    contentOrPayload: string | SendChatMessageInput,
    replyToLegacy?: string
  ): Promise<{ message: ChatMessage; conversation: ChatConversation }> {
    const headers = await this.getAuthHeaders();
    let body: Record<string, unknown>;
    if (typeof contentOrPayload === 'string') {
      body = { content: contentOrPayload, replyTo: replyToLegacy };
    } else {
      body = {
        content: contentOrPayload.content ?? '',
        replyTo: contentOrPayload.replyTo,
        attachments: contentOrPayload.attachments,
      };
    }
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      { method: 'POST', headers, body: JSON.stringify(body) }
    );
    return this.parseJson(res);
  }

  /** Multipart đính kèm — field `files` */
  async uploadAttachments(
    conversationId: string,
    files: { uri: string; name: string; mimeType: string }[]
  ): Promise<ChatAttachment[]> {
    const headers = await this.getMultipartHeaders();
    const form = new FormData();
    for (const f of files) {
      form.append('files', {
        uri: f.uri,
        name: f.name || 'file',
        type: f.mimeType || 'application/octet-stream',
      } as unknown as Blob);
    }
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/attachments`,
      { method: 'POST', headers, body: form as unknown as BodyInit }
    );
    const data = await this.parseJson<{ attachments: ChatAttachment[] }>(res);
    return data.attachments;
  }

  async markRead(conversationId: string): Promise<ChatConversation> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/read`,
      { method: 'POST', headers, body: '{}' }
    );
    return this.parseJson<ChatConversation>(res);
  }

  /** Ẩn hội thoại khỏi danh sách (soft — server ghi theo user). */
  async hideConversationFromList(conversationId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/hide-from-list`,
      { method: 'POST', headers, body: '{}' }
    );
    await this.parseJson(res);
  }

  /** GV bộ môn có thể thêm vào nhóm (chỉ GVCN/Phó CN gọi được — BE tự chặn 403). */
  async getAddableTeachers(conversationId: string): Promise<AddableTeacher[]> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/members/addable`,
      { headers }
    );
    return this.parseJson<AddableTeacher[]>(res);
  }

  /** Thêm 1 GV bộ môn vào nhóm — trả về conversation đã cập nhật. */
  async addConversationTeacher(
    conversationId: string,
    teacherId: string
  ): Promise<ChatConversation> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/members`,
      { method: 'POST', headers, body: JSON.stringify({ teacherId }) }
    );
    return this.parseJson<ChatConversation>(res);
  }

  /** Gỡ 1 GV bộ môn khỏi nhóm — trả về conversation đã cập nhật. */
  async removeConversationTeacher(
    conversationId: string,
    teacherId: string
  ): Promise<ChatConversation> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(
        conversationId
      )}/members/${encodeURIComponent(teacherId)}`,
      { method: 'DELETE', headers }
    );
    return this.parseJson<ChatConversation>(res);
  }

  /** GVCN/phó bật/tắt chế độ "chỉ GV được nhắn" — trả về conversation đã cập nhật. */
  async setConversationWriteMode(
    conversationId: string,
    writeMode: ChatConversationWriteMode
  ): Promise<ChatConversation> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/write-mode`,
      { method: 'PATCH', headers, body: JSON.stringify({ writeMode }) }
    );
    return this.parseJson<ChatConversation>(res);
  }

  async toggleReaction(
    messageId: string,
    emoji: ChatEmoji
  ): Promise<{ messageId: string; reactions: ChatReaction[] }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/social/chat/messages/${messageId}/reactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ emoji }),
    });
    return this.parseJson(res);
  }

  async recallMessage(
    messageId: string
  ): Promise<{ messageId: string; recalledAt: string; recalledBy: string }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/social/chat/messages/${messageId}/recall`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    return this.parseJson(res);
  }

  // ===== Bình chọn =====

  /** Tạo bình chọn trong nhóm lớp — chỉ GVCN/phó (backend kiểm lại theo scope Frappe). */
  async createPoll(
    conversationId: string,
    payload: CreateChatPollPayload
  ): Promise<{ message: ChatMessage; conversation: ChatConversation }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/polls`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: payload.question,
          options: payload.options,
          allowMultiple: Boolean(payload.allowMultiple),
          anonymous: Boolean(payload.anonymous),
          closesAt: payload.closesAt ?? null,
          remindBeforeMinutes: payload.remindBeforeMinutes ?? null,
        }),
      }
    );
    return this.parseJson(res);
  }

  /** Bỏ/đổi phiếu. Mảng rỗng = rút phiếu. */
  async votePoll(
    messageId: string,
    optionIds: string[]
  ): Promise<{ messageId: string; poll: ChatPoll }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/social/chat/messages/${messageId}/poll/vote`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ optionIds }),
    });
    return this.parseJson(res);
  }

  /** Kết thúc bình chọn sớm — người tạo hoặc GVCN/phó. */
  async closePoll(messageId: string): Promise<{ messageId: string; poll: ChatPoll }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/social/chat/messages/${messageId}/poll/close`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    return this.parseJson(res);
  }

  /** Danh sách người bầu theo phương án — PH nhận 403 khi bình chọn ẩn danh. */
  async getPollVoters(messageId: string): Promise<ChatPollVotersData> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/social/chat/messages/${messageId}/poll/voters`, {
      headers,
    });
    return this.parseJson(res);
  }

  /** Ghim 1 tin (ghi đè ghim cũ). */
  async pinMessage(
    conversationId: string,
    messageId: string
  ): Promise<{ conversation: ChatConversation; pinnedMessage: PinnedMessageSnapshot | null }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/pin`,
      { method: 'POST', headers, body: JSON.stringify({ messageId }) }
    );
    return this.parseJson(res);
  }

  /** Bỏ ghim. */
  async unpinMessage(
    conversationId: string
  ): Promise<{ conversation: ChatConversation; pinnedMessage: null }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/pin`,
      { method: 'DELETE', headers }
    );
    return this.parseJson(res);
  }

  /** Singleton socket — dùng lại trong session */
  async getSocket(): Promise<Socket | null> {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return null;
    const campusId = await this.getCampusId();
    if (!this.socket) {
      this.socket = io(BASE_URL, {
        path: '/api/social/socket.io',
        transports: ['polling', 'websocket'],
        auth: { token, campusId },
        query: { token, campusId },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });
      this.socket.on('connect', () => console.log('[ChatSocket] connected', this.socket?.id));
      this.socket.on('connect_error', (err) =>
        console.warn('[ChatSocket] connect_error', err?.message)
      );
      this.socket.on('chat:error', (payload: unknown) => console.warn('[ChatSocket] chat:error', payload));
    }
    return this.socket;
  }
}

export const chatService = new ChatService();
