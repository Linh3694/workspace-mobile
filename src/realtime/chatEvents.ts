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
  ERROR: 'chat:error',
} as const;
