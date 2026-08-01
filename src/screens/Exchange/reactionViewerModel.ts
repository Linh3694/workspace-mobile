import type { ChatConversation, ChatMessage, ChatReaction } from '../../types/chat';

import { formatChatDisplayName } from './exchangeChatThreadUtils';

export type ChatReactionViewer = {
  key: string;
  /** Rỗng ⇒ không tra được ai (dữ liệu cũ chỉ có id), UI tự thay bằng nhãn "Thành viên". */
  name: string;
  avatarUrl?: string;
  emoji: string;
  createdAt: string;
  role: 'teacher' | 'guardian' | 'unknown';
  isSelf: boolean;
};

function normEmail(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

/**
 * Ghép danh sách cảm xúc của một tin với roster hội thoại để lấy tên + ảnh đại diện + vai trò.
 *
 * Backend chỉ chắc chắn trả `user`/`email` trong mỗi reaction; `name` có thể thiếu ở dữ liệu cũ.
 * Vì vậy ưu tiên tra theo email trong roster rồi mới rơi về `name`/`email` của chính reaction.
 * Code twin của `reactionViewerModel` bên parent-portal (web + app PH) và frappe-sis-frontend.
 */
export function listMessageReactionViewers(
  message: ChatMessage | null | undefined,
  conversation: ChatConversation | null | undefined,
  viewerEmail?: string,
): ChatReactionViewer[] {
  const reactions: ChatReaction[] = message?.reactions || [];
  if (!reactions.length) return [];

  const byEmail = new Map<
    string,
    { name: string; avatarUrl?: string; role: 'teacher' | 'guardian' }
  >();
  for (const teacher of (conversation?.teachers || []).filter((x) => !x?.removedAt)) {
    const email = normEmail(teacher.email);
    if (email && !byEmail.has(email)) {
      byEmail.set(email, {
        name: teacher.name || '',
        avatarUrl: teacher.avatarUrl,
        role: 'teacher',
      });
    }
  }
  for (const guardian of (conversation?.guardians || []).filter((x) => !x?.removedAt)) {
    const email = normEmail(guardian.email);
    if (email && !byEmail.has(email)) {
      byEmail.set(email, {
        name: guardian.name || '',
        avatarUrl: guardian.avatarUrl,
        role: 'guardian',
      });
    }
  }

  const viewerEmailNorm = normEmail(viewerEmail);

  return reactions
    .map((reaction, index) => {
      const email = normEmail(reaction.email);
      const member = email ? byEmail.get(email) : undefined;
      return {
        // Một người có thể thả nhiều emoji ⇒ key kèm emoji + index cho chắc.
        key: `${reaction.user || email || 'unknown'}:${reaction.emoji}:${index}`,
        name: formatChatDisplayName(member?.name || reaction.name || reaction.email || ''),
        avatarUrl: member?.avatarUrl,
        emoji: String(reaction.emoji),
        createdAt: reaction.createdAt,
        role: member?.role ?? ('unknown' as const),
        isSelf: !!email && !!viewerEmailNorm && email === viewerEmailNorm,
      };
    })
    .sort((a, b) => {
      // Mới nhất lên trước; thiếu `createdAt` (dữ liệu cũ) thì giữ nguyên thứ tự server trả.
      const ta = Date.parse(a.createdAt || '') || 0;
      const tb = Date.parse(b.createdAt || '') || 0;
      return tb - ta;
    });
}
