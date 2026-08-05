import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, type Socket } from 'socket.io-client';

import { BASE_URL } from '../config/constants';
import { normalizeCampusIdForBackend } from '../utils/campusIdUtils';
import type {
  AddableTeacher,
  ChatAttachment,
  ChatAttachmentKind,
  ChatConversation,
  ChatConversationAttachmentsData,
  ChatConversationWriteMode,
  ChatEmoji,
  ChatMessage,
  ChatMessageReadersData,
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

/** Thông tin phân trang social-service trả kèm danh sách hội thoại. */
export type ChatPageMeta = {
  page: number;
  limit: number;
  hasMore: boolean;
  total: number;
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

  /**
   * Bóc envelope `{ success, data, meta }` nhưng GIỮ nguyên `meta` — cần cho phân trang
   * danh sách hội thoại. `parseJson` bọc lại hàm này nên mọi caller cũ không đổi hành vi.
   */
  private async parseEnvelope<T>(res: Response): Promise<{ data: T; meta?: ChatPageMeta }> {
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
      return {
        data: wrapped.data as T,
        meta: (wrapped as { meta?: ChatPageMeta }).meta,
      };
    }
    return { data: body as T };
  }

  private async parseJson<T>(res: Response): Promise<T> {
    const envelope = await this.parseEnvelope<T>(res);
    return envelope.data;
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
    const page = await this.getConversationsPage(params);
    return page.items;
  }

  /**
   * Một TRANG danh sách hội thoại. Từ khoá và pill lọc chạy SERVER-SIDE trên toàn bộ hội thoại —
   * lọc trên mảng đã tải sẽ bỏ sót phần chưa tải tới (SIS-166).
   * Không truyền `page`/`limit` ⇒ backend trả full list như hợp đồng cũ.
   */
  async getConversationsPage(params?: {
    classId?: string;
    schoolYearId?: string;
    /** Backend khớp không dấu trên tên nhóm/lớp và tên PH/GV. */
    q?: string;
    /** `parent` là alias của `direct` phía backend — giữ nguyên nhãn pill hiện có. */
    filter?: 'all' | 'group' | 'parent' | 'unread';
    page?: number;
    limit?: number;
    /**
     * `list` ⇒ payload rút gọn: bỏ roster chi tiết (SĐT, quan hệ HS↔PH, môn dạy) mà danh sách
     * không vẽ tới. Với BOD một trang toàn nhóm lớp nên khác biệt là vài MB. Màn nào cần bản
     * đầy đủ thì gọi `getMessages`/`getConversation` cho đúng hội thoại đang mở.
     */
    fields?: 'list';
    /**
     * `member` ⇒ chỉ hội thoại người gọi là thành viên. Bắt buộc cho các màn dựng dữ liệu từ
     * nhóm lớp CỦA CHÍNH GV: BOD mặc định được trả toàn trường, tải về rồi loại sạch ở client.
     */
    scope?: 'member';
  }): Promise<{ items: ChatConversation[]; hasMore: boolean; total: number }> {
    const headers = await this.getAuthHeaders();
    const q = new URLSearchParams();
    const cid = String(params?.classId || '').trim();
    const syid = String(params?.schoolYearId || '').trim();
    const needle = String(params?.q || '').trim();
    if (cid) q.set('classId', cid);
    if (syid) q.set('schoolYearId', syid);
    if (needle) q.set('q', needle);
    if (params?.filter && params.filter !== 'all') q.set('filter', params.filter);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.fields) q.set('fields', params.fields);
    if (params?.scope) q.set('scope', params.scope);
    const qs = q.toString();
    const url = `${BASE_URL}/api/social/chat/conversations${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers });
    const envelope = await this.parseEnvelope<ChatConversation[]>(res);
    const items = envelope.data || [];
    return {
      items,
      // Backend cũ chưa trả `meta` ⇒ coi như đã nhận đủ, tránh onEndReached gọi lặp vô hạn.
      hasMore: Boolean(envelope.meta?.hasMore),
      total: envelope.meta?.total ?? items.length,
    };
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

  /**
   * `opts.around` — mở từ thông báo: server nạp liền mạch từ tin mới nhất xuống hết trang chứa
   * tin đó, và trả `pagination.aroundResolved` cho biết có tới được tin đích không (SIS-180).
   * Bỏ qua `page` khi có `around`. social-service cũ chưa hiểu tham số này thì trả trang đầu
   * như thường — thoái lui êm, không lỗi.
   */
  async getMessages(
    conversationId: string,
    page = 1,
    limit = 50,
    opts?: { around?: string }
  ): Promise<ChatMessagesData> {
    const headers = await this.getAuthHeaders();
    const around = String(opts?.around || '').trim();
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (around) q.set('around', around);
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/messages?${q.toString()}`,
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

  /** Danh sách người đã đọc một tin — chỉ GV (BE 403 với PH). */
  async getMessageReaders(
    conversationId: string,
    messageId: string
  ): Promise<ChatMessageReadersData> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/readers`,
      { headers }
    );
    return this.parseJson<ChatMessageReadersData>(res);
  }

  /** Kho tệp/ảnh/video trong hội thoại + tìm theo tên. */
  async listAttachments(
    conversationId: string,
    opts: {
      q?: string;
      /** media = ảnh+video; còn lại theo ChatAttachmentKind */
      kind?: ChatAttachmentKind | 'media' | '';
      page?: number;
      limit?: number;
    } = {}
  ): Promise<ChatConversationAttachmentsData> {
    const headers = await this.getAuthHeaders();
    const query = new URLSearchParams();
    if (opts.q?.trim()) query.set('q', opts.q.trim());
    if (opts.kind) query.set('kind', opts.kind);
    if (opts.page) query.set('page', String(opts.page));
    if (opts.limit) query.set('limit', String(opts.limit));
    const qs = query.toString();
    const res = await fetch(
      `${BASE_URL}/api/social/chat/conversations/${encodeURIComponent(conversationId)}/attachments${qs ? `?${qs}` : ''}`,
      { headers }
    );
    return this.parseJson<ChatConversationAttachmentsData>(res);
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
