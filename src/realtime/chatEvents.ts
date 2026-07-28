/**
 * Sự kiện Socket.IO chat (social-service) — đồng bộ parent-portal / web SIS
 */
export const CHAT_EVENTS = {
  JOIN: 'chat:join',
  MESSAGE: 'chat:message',
  TYPING: 'chat:typing',
  REACTION: 'chat:message:reaction',
  RECALLED: 'chat:message:recalled',
  /** Ghim/bỏ ghim conversation — broadcast `pinnedMessage`. */
  PINNED: 'chat:conversation:pinned',
  /** GVCN/phó khóa nhóm về "chỉ GV được nhắn" — broadcast `writeMode`. */
  WRITE_MODE: 'chat:conversation:write_mode',
  /** Bỏ phiếu / kết thúc bình chọn — broadcast cho mọi thành viên, KHÔNG kèm `myVote`. */
  POLL: 'chat:message:poll',
  /** Danh tính người bầu của bình chọn ẩn danh — CHỈ phát vào room giáo viên. */
  POLL_VOTERS: 'chat:message:poll:voters',
  ERROR: 'chat:error',
} as const;
