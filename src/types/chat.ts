/**
 * Types chat social-service — đồng bộ parent-portal-mobile/services/chatService
 */

export type ChatConversationStatus = 'active' | 'locked';
/**
 * Chế độ ghi nhóm lớp do GVCN/phó bật: `teachers_only` = chỉ GV được nhắn (PH chỉ đọc).
 * Khác `status = 'locked'` — nhóm lớp/năm học cũ, khóa cứng với cả GV.
 */
export type ChatConversationWriteMode = 'all' | 'teachers_only';
export type ChatConversationType = string;

/** Snapshot tin ghim — đồng bộ social-service `ChatConversation.pinnedMessage`. */
export type PinnedMessageSnapshot = {
  messageId: string;
  contentPreview: string;
  attachmentsCount?: number;
  senderName?: string;
  senderEmail?: string;
  avatarUrl?: string;
  pinnedBy?: string;
  pinnedAt?: string;
};

export type ChatConversation = {
  /** Rỗng khi thread GV↔PH nháp. */
  _id: string;
  type: ChatConversationType;
  title: string;
  classId: string;
  className: string;
  schoolYearId: string;
  schoolYearName?: string;
  studentIds?: string[];
  status: ChatConversationStatus;
  lockedReason?: string;
  /** Vắng mặt = `all` (hội thoại tạo trước tính năng khóa). */
  writeMode?: ChatConversationWriteMode;
  unreadCount?: number;
  isDraft?: boolean;
  draft?: {
    classId: string;
    schoolYearId: string;
    teacherId: string;
    guardianId?: string;
  };
  lastMessage?: {
    messageId?: string;
    content?: string;
    senderName?: string;
    senderEmail?: string;
    createdAt?: string;
  };
  guardians?: Array<{
    name?: string;
    /** Email ĐỊNH DANH (khớp participant) — có thể là địa chỉ portal sinh tự động, đừng hiển thị. */
    email?: string;
    /** Email LIÊN LẠC để hiển thị — bảng con `CRM Guardian Email` (ưu tiên email chính). */
    contactEmail?: string;
    guardianId?: string;
    studentIds?: string[];
    /** Từ snapshot social-service — hiển thị subtitle GV */
    studentNames?: string[];
    /**
     * Liên kết HS↔PH: quan hệ + cờ PH chính thuộc về LIÊN KẾT, không thuộc về người
     * (một PH có thể là PH chính của HS này và PH phụ của HS khác).
     */
    studentLinks?: Array<{
      studentId?: string;
      studentName?: string;
      relationship?: string;
      keyPerson?: boolean;
    }>;
    /** SĐT PH (CRM Guardian.phone_number). */
    phoneNumber?: string;
    avatarUrl?: string;
    /** Có giá trị = đã bị gỡ mềm khỏi nhóm (không hiển thị). */
    removedAt?: string | null;
  }>;
  teachers?: Array<{
    name?: string;
    email?: string;
    teacherId?: string;
    avatarUrl?: string;
    /** SĐT GV (User.mobile_no / phone). */
    phoneNumber?: string;
    /** Môn dạy (GVBM) — từ snapshot social-service. */
    subjects?: Array<{ id?: string; title?: string }>;
    /** true = GV bộ môn được thêm thủ công (gỡ được); false/undefined = GVCN/Phó CN. */
    manualAdd?: boolean;
    /**
     * Vai trò chủ nhiệm: `homeroom` = GVCN, `vice_homeroom` = Phó GVCN, rỗng/thiếu = GVBM
     * hoặc snapshot cũ chưa sync lại. KHÔNG suy vai trò từ thứ tự mảng `teachers`.
     */
    homeroomRole?: 'homeroom' | 'vice_homeroom' | '';
    /** Có giá trị = đã bị gỡ mềm khỏi nhóm (không hiển thị). */
    removedAt?: string | null;
  }>;
  /** Tối đa 1 tin ghim trong hội thoại — null nếu không có. */
  pinnedMessage?: PinnedMessageSnapshot | null;
  /** Ma trận quyền tag nhóm của thành viên thường (Trưởng/Phó nhóm luôn được nên không có mặt). */
  mentionPolicy?: ChatMentionPolicy;
  /** Các phân loại thành viên đang có trong nhóm — nguồn để dựng `@Giáo viên` / `@Phụ huynh`. */
  mentionSegments?: ChatMentionSegment[];
  /**
   * Quyền tag nhóm của CHÍNH người đang đăng nhập. Thiếu (payload broadcast / server cũ) ⇒
   * app coi như không tag nhóm được, chỉ tag từng người — an toàn hơn là đoán mở.
   */
  viewerMentionPermissions?: ChatViewerMentionPermissions;
  updatedAt: string;
};

/**
 * Phân loại thành viên để tag cả nhóm (`@Giáo viên` / `@Phụ huynh`). Chuỗi mở CỐ Ý:
 * server có thể thêm nhóm mới mà bản app cũ không vỡ kiểu.
 */
export type ChatMentionSegment = 'teachers' | 'guardians' | (string & {});

/** Quyền tag cả nhóm của người đang xem — server tính, app chỉ vẽ theo. */
export type ChatViewerMentionPermissions = {
  isGroupAdmin: boolean;
  allowedSegments: ChatMentionSegment[];
  canMentionEveryone: boolean;
};

/** `{ [vai trò]: { [segment]: bật/tắt } }` — thiếu khoá ⇒ được phép. */
export type ChatMentionPolicy = Partial<Record<'teacher' | 'guardian', Record<string, boolean>>>;

/**
 * Một lượt nhắc tên trong tin — khớp `ChatMessage.mentions` của social-service.
 * `content` vẫn là text thuần, mảng này chỉ neo vị trí để tô đậm.
 */
export type ChatMention = {
  type: 'user' | 'segment' | 'everyone';
  segment?: ChatMentionSegment;
  userId?: string;
  email?: string;
  /** Tên đúng như đã gõ trong `content`, không kèm '@'. */
  name: string;
  start: number;
  length: number;
};

/** GV bộ môn có thể thêm vào nhóm (đang phân công dạy lớp, chưa ở trong nhóm). */
export type AddableTeacher = {
  teacherId: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  subjects?: Array<{ id?: string; title?: string }>;
};

/**
 * Trần số đính kèm mỗi tin nhắn.
 *
 * PHẢI KHỚP `CHAT_MAX_ATTACHMENTS` ở `social-service/controllers/chatController.js`.
 * Đặt cao hơn server thì phần dư bị `sanitizeIncomingAttachments` **cắt im lặng**:
 * upload xong hết, tin nhắn chỉ lưu một phần, không lỗi nào nổi lên.
 */
export const CHAT_MAX_ATTACHMENTS = 30;

export type ChatAttachmentKind = 'image' | 'file' | 'video';

export type ChatAttachment = {
  kind: ChatAttachmentKind;
  url: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
};

/** Đồng bộ social-service `ChatMessage.poll` — bình chọn trong nhóm lớp. */
export type ChatPollVoter = {
  userId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role: 'teacher' | 'guardian';
  votedAt: string;
};

export type ChatPollOption = {
  id: string;
  text: string;
  voteCount: number;
  /** Chỉ có khi người xem được phép thấy danh tính (GV luôn thấy, PH không thấy nếu ẩn danh). */
  voters?: ChatPollVoter[];
};

export type ChatPoll = {
  question: string;
  options: ChatPollOption[];
  allowMultiple: boolean;
  /** Ẩn danh với phụ huynh; giáo viên vẫn xem được ai bầu gì. */
  anonymous: boolean;
  closesAt?: string | null;
  closedAt?: string | null;
  /** Số phút nhắc trước hạn (null = không nhắc) — dùng để nạp lại form khi sửa bình chọn. */
  remindBeforeMinutes?: number | null;
  /** Server tính: đã đóng tay hoặc đã quá `closesAt`. */
  isClosed: boolean;
  /** Số NGƯỜI đã bầu (không phải số phiếu) — mẫu số cho %. */
  totalVoters: number;
  canSeeVoters: boolean;
  /**
   * CHỈ có trong REST/getMessages — broadcast socket không kèm. `ChatMessage` ở app này không có
   * field `sender`, nên "mình đã bầu chưa" bắt buộc lấy từ đây chứ không so id ở client.
   */
  myVote?: string[];
  /**
   * false = payload broadcast, đã lược `myVote` và (với poll ẩn danh) `voters` + `canSeeVoters`.
   * applyPollUpdate dựa vào cờ này để giữ lại trường cũ thay vì ghi đè.
   */
  viewerScoped?: boolean;
  rev: number;
};

/** Một thành viên CHƯA bình chọn — chỉ giáo viên nhận được (server lược với phụ huynh). */
export type ChatPollPendingMember = {
  userId: string;
  name: string;
  role: 'teacher' | 'guardian' | string;
  email?: string;
  avatarUrl?: string;
  studentNames?: string[];
};

export type ChatPollVotersData = {
  messageId: string;
  rev: number;
  totalVoters: number;
  options: { id: string; voters: ChatPollVoter[] }[];
  /** CHỈ có với giáo viên — danh sách người chưa bình chọn (đã trừ người tạo). */
  pending?: ChatPollPendingMember[];
  /** Tổng thành viên active (đã trừ người tạo) — mẫu số cho "M/N". */
  participantCount?: number;
};

/**
 * Sửa bình chọn — field KHÔNG gửi lên nghĩa là giữ nguyên.
 * `options` gửi TOÀN BỘ danh sách mong muốn: phần tử có `id` = phương án đang có (khi đã có phiếu
 * thì text phải giữ nguyên), phần tử không `id` = phương án thêm mới.
 */
export type UpdateChatPollPayload = {
  question?: string;
  options?: { id?: string; text: string }[];
  allowMultiple?: boolean;
  anonymous?: boolean;
  closesAt?: string | null;
  remindBeforeMinutes?: number | null;
};

export type CreateChatPollPayload = {
  question: string;
  options: string[];
  allowMultiple?: boolean;
  anonymous?: boolean;
  /** ISO string; bỏ trống = mở tới khi kết thúc thủ công. */
  closesAt?: string | null;
  /** Nhắc thành viên chưa bình chọn trước hạn N phút. Chỉ hợp lệ khi có `closesAt`. */
  remindBeforeMinutes?: number | null;
};

/**
 * Token màu CHỮ — tên màu Wellspring, KHÔNG phải hex (đổi hex chỉ sửa bảng map ở client).
 * Chỉ có hai màu vì chỉ nhóm đậm của bộ Wellspring đủ tương phản để làm chữ 14px.
 */
export type ChatTextColor = "oxford-blue" | "teal";

/**
 * Token nền TÔ SÁNG — nhóm màu tươi của Wellspring. Làm màu chữ thì không đọc được,
 * làm nền với chữ tối đè lên thì tương phản rất tốt.
 */
export type ChatHighlight = "amber" | "lime" | "honey";

/**
 * Một dải chữ được định dạng — khớp `ChatMessage.formats` của social-service.
 * Cùng mô hình với `mentions`: `content` vẫn là text thuần, mảng này chỉ neo vị trí.
 * Server luôn trả các dải RỜI NHAU và đã sắp theo `start`.
 */
export type ChatFormat = {
  start: number;
  length: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: ChatTextColor;
  highlight?: ChatHighlight;
};

export type ChatMessage = {
  _id: string;
  conversation: string;
  senderSnapshot: {
    name: string;
    email?: string;
    role: 'teacher' | 'guardian';
    avatarUrl?: string;
  };
  content: string;
  attachments?: ChatAttachment[];
  replyTo?: {
    messageId: string;
    content: string;
    senderName?: string;
  };
  /** Nhắc tên (@) — rỗng/thiếu với tin không tag ai. */
  mentions?: ChatMention[];
  /** Định dạng chữ — thiếu/rỗng với tin không định dạng. Client cũ bỏ qua và hiện text thuần. */
  formats?: ChatFormat[];
  /** Chỉ GV nhận từ BE — danh sách userId đã đọc. */
  readBy?: Array<{ user: string; readAt: string }>;
  createdAt: string;
  reactions?: ChatReaction[];
  recalledAt?: string;
  recalledBy?: string;
  /** Tin bình chọn — `content` vẫn giữ "[Bình chọn] <câu hỏi>" cho preview/bản app cũ. */
  poll?: ChatPoll | null;
};

/** GET …/messages/:messageId/readers */
export type ChatMessageReader = {
  userId: string;
  name: string;
  role: 'teacher' | 'guardian' | string;
  email?: string;
  studentNames?: string[];
  readAt?: string | null;
};

export type ChatMessageReadersData = {
  messageId: string;
  readers: ChatMessageReader[];
  readerCount: number;
  participantCount: number;
};

/** GET …/attachments — tệp phẳng trong hội thoại. */
export type ChatConversationAttachmentItem = ChatAttachment & {
  messageId: string;
  createdAt?: string | null;
  senderName?: string;
  senderEmail?: string;
  senderRole?: 'teacher' | 'guardian';
};

export type ChatConversationAttachmentsData = {
  items: ChatConversationAttachmentItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
  };
};

export type ChatEmoji = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export type ChatReaction = {
  user?: string;
  email?: string;
  name?: string;
  emoji: ChatEmoji | string;
  createdAt: string;
};

export type ChatMessagesData = {
  messages: ChatMessage[];
  conversation: ChatConversation;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalMessages: number;
    hasNext: boolean;
    /**
     * Chỉ có khi gọi kèm `around`: server có nạp tới được tin đích hay không.
     * false = tin đã xoá/thu hồi hoặc quá cũ (ngoài trần 300 tin) — client báo toast thay vì
     * cuộn hụt trong im lặng. Thiếu field = social-service chưa deploy bản hỗ trợ `around`.
     */
    aroundResolved?: boolean;
  };
};

export type SendChatMessageInput = {
  content?: string;
  replyTo?: string;
  attachments?: ChatAttachment[];
  /** Nhắc tên (@) — server xác thực lại offset/quyền, sai thì bỏ hoặc trả 403. */
  mentions?: ChatMention[];
  /** Định dạng chữ — server clamp/chuẩn hoá lại offset, dải sai bị bỏ chứ không làm hỏng tin. */
  formats?: ChatFormat[];
};

/** Snapshot môn dạy của GV bộ môn — phục vụ hiển thị trong picker. */
export type ClassChatScopeSubject = {
  id: string;
  title: string;
};

export type ClassChatScopeTeacher = {
  teacherId?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  subjects?: ClassChatScopeSubject[];
  userId?: string;
  userName?: string;
};

export type ClassChatScopeStudent = {
  student_id: string;
  student_name?: string;
  student_code?: string;
  family_code?: string;
};

/** Snapshot guardian từ Frappe (CRM Family Relationship). */
export type ClassChatScopeGuardian = {
  name?: string;
  guardian_id?: string;
  guardian_name?: string;
  email?: string;
  portalEmail?: string;
  guardian_image?: string;
  phone_number?: string;
  is_key_person_any?: boolean;
  students?: Array<{
    student_id: string;
    student_name?: string;
    student_code?: string;
    family_code?: string;
    relationship_type?: string;
    /** 1 nếu là người liên hệ chính của HS đó. */
    key_person?: number | boolean;
    access?: string;
    display_order?: number;
  }>;
};

export type ClassChatScopePayload = {
  classId: string;
  className?: string;
  schoolYearId: string;
  schoolYearName?: string;
  classType?: string;
  isActive?: boolean;
  students?: ClassChatScopeStudent[];
  guardians?: ClassChatScopeGuardian[];
  teachers?: ClassChatScopeTeacher[];
  subject_teachers?: ClassChatScopeTeacher[];
  callerTeacherId?: string;
  callerUserName?: string;
};
