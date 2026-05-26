/** conversationId đang mở toàn cục — dùng để tránh bắn local notification khi user đang xem thread */
let focusedConversationId: string | null = null;

export function setFocusedChatConversationId(id: string | null): void {
  focusedConversationId = id ? String(id).trim() : null;
}

export function getFocusedChatConversationId(): string | null {
  return focusedConversationId;
}
