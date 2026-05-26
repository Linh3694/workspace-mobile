/**
 * Types chat social-service — đồng bộ parent-portal-mobile/services/chatService
 */

export type ChatConversationStatus = 'active' | 'locked';
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
    email?: string;
    guardianId?: string;
    studentIds?: string[];
    /** Từ snapshot social-service — hiển thị subtitle GV */
    studentNames?: string[];
    avatarUrl?: string;
  }>;
  teachers?: Array<{
    name?: string;
    email?: string;
    teacherId?: string;
    avatarUrl?: string;
    /** Môn dạy (GVBM) — từ snapshot social-service. */
    subjects?: Array<{ id?: string; title?: string }>;
  }>;
  /** Tối đa 1 tin ghim trong hội thoại — null nếu không có. */
  pinnedMessage?: PinnedMessageSnapshot | null;
  updatedAt: string;
};

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
  createdAt: string;
  reactions?: ChatReaction[];
  recalledAt?: string;
  recalledBy?: string;
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
  };
};

export type SendChatMessageInput = {
  content?: string;
  replyTo?: string;
  attachments?: ChatAttachment[];
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
