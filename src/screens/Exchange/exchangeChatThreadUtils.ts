/**
 * Hàng FlatList thread chat — tin hoặc chip thời gian (đồng bộ GuardianChatScreen).
 */
import type { ChatConversation, ChatEmoji, ChatMessage } from '../../types/chat';
import {
  humanizeChatWislifeStickerForPreview,
  parseChatWislifeStickerContent,
} from '../../utils/chatWislifeSticker';
import { getEmojiFallbackText } from '../../utils/emojiUtils';

/** Trang đầu khi mở thread. */
export const CHAT_INITIAL_PAGE_LIMIT = 30;
/** Mỗi lần cuộn lên load thêm. */
export const CHAT_LOAD_MORE_LIMIT = 20;
/** Chèn separator khi hai tin cách nhau > ngưỡng hoặc khác ngày. */
export const CHAT_TIME_SEPARATOR_GAP_MS = 30 * 60 * 1000;

/** Bubble của GV (teal) — khớp PH portal. */
export const MY_MESSAGE_BUBBLE_BG = '#0D9488';

export const CHAT_BUBBLE_MAX_WIDTH_RATIO = 0.7;

export const SWIPE_REPLY_THRESHOLD_PX = 52;
export const SWIPE_REPLY_MAX_DRAG_PX = 72;

export const RECALL_WINDOW_MS = 15 * 60 * 1000;

export const REMOTE_TYPING_TTL_MS = 4500;

export type ChatListRow =
  | { kind: 'message'; key: string; message: ChatMessage }
  | { kind: 'separator'; key: string; label: string };

export type MessageThreadMeta = { showAvatar: boolean; showTimestamp: boolean };

export function replyQuoteSnippet(m: ChatMessage): string {
  if (m.recalledAt) return 'Tin nhắn đã thu hồi';
  const stickerLabel = humanizeChatWislifeStickerForPreview(m.content);
  if (stickerLabel) return stickerLabel;
  const c = (m.content || '').trim();
  if (c) return c;
  const atts = m.attachments || [];
  if (atts.some((a) => a.kind === 'image')) return '[Hình ảnh]';
  if (atts.some((a) => a.kind === 'video')) return '[Video]';
  if (atts.length) return '[Tệp đính kèm]';
  return '';
}

function calendarDayKeyVi(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDateSeparatorVi(now: Date, messageDate: Date): string {
  const d = messageDate;
  const tMs = d.getTime();
  if (!Number.isFinite(tMs)) return '';
  const hhmm = d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const msgDay = calendarDayKeyVi(d);
  const today = calendarDayKeyVi(now);
  const yesterday = calendarDayKeyVi(new Date(now.getTime() - 86400000));
  if (msgDay === today) return `Hôm nay ${hhmm}`;
  if (msgDay === yesterday) return `Hôm qua ${hhmm}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  let weekday = d.toLocaleDateString('vi-VN', { weekday: 'long' });
  if (weekday) weekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const dm = d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
  if (sameYear) {
    return `${weekday}, ${dm} ${hhmm}`;
  }
  const full = d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${full} ${hhmm}`;
}

/** Chuẩn hóa _id từ Mongo / Socket.IO JSON (string, ObjectId, { $oid }). */
export function normalizeMongoId(id: unknown): string {
  if (id == null || id === '') return '';
  if (typeof id === 'string') return id.trim();
  if (typeof id === 'object' && id !== null) {
    const o = id as { $oid?: string; _id?: unknown };
    if (typeof o.$oid === 'string') return o.$oid.trim();
    if (o._id != null) return normalizeMongoId(o._id);
  }
  try {
    const s = String(id).trim();
    return s === '[object Object]' ? '' : s;
  } catch {
    return '';
  }
}

export function mergeOlderMessagesDeduped(
  olderChunk: ChatMessage[],
  existing: ChatMessage[]
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of olderChunk) map.set(normalizeMongoId(m._id), m);
  for (const m of existing) map.set(normalizeMongoId(m._id), m);
  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    const fa = Number.isFinite(ta) ? ta : 0;
    const fb = Number.isFinite(tb) ? tb : 0;
    if (fa !== fb) return fa - fb;
    return normalizeMongoId(a._id).localeCompare(normalizeMongoId(b._id));
  });
}

/** Gộp tin từ API (trang mới nhất) với state hiện có — ưu tiên bản incoming khi trùng _id. */
export function mergeIncomingMessagesPage(
  incoming: ChatMessage[],
  existing: ChatMessage[]
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of existing) map.set(normalizeMongoId(m._id), m);
  for (const m of incoming) map.set(normalizeMongoId(m._id), m);
  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    const fa = Number.isFinite(ta) ? ta : 0;
    const fb = Number.isFinite(tb) ? tb : 0;
    if (fa !== fb) return fa - fb;
    return normalizeMongoId(a._id).localeCompare(normalizeMongoId(b._id));
  });
}

export function buildChatRows(
  chronologicalMessages: ChatMessage[],
  now: Date
): ChatListRow[] {
  const rows: ChatListRow[] = [];
  let prevMs: number | null = null;
  let prevDayKey: string | null = null;
  let sepSeq = 0;
  for (let i = 0; i < chronologicalMessages.length; i++) {
    const m = chronologicalMessages[i];
    const d = new Date(m.createdAt);
    const ms = d.getTime();
    const ok = Number.isFinite(ms);
    const dayKey = ok ? calendarDayKeyVi(d) : '';
    let needsSep = false;
    if (i === 0) {
      needsSep = ok;
    } else if (ok && prevMs !== null) {
      const gapExceeded = ms - prevMs > CHAT_TIME_SEPARATOR_GAP_MS;
      const diffDay = !!prevDayKey && dayKey !== '' && prevDayKey !== dayKey;
      needsSep = gapExceeded || diffDay;
    }
    if (needsSep && ok) {
      const label = formatDateSeparatorVi(now, d);
      if (label) {
        sepSeq += 1;
        rows.push({
          kind: 'separator',
          key: `sep:${String(m._id)}:${sepSeq}`,
          label,
        });
      }
    }
    rows.push({ kind: 'message', key: `m:${String(m._id)}`, message: m });
    if (ok) {
      prevMs = ms;
      prevDayKey = dayKey;
    }
  }
  return rows;
}

export function senderKeyForThread(message: ChatMessage): string {
  const email = message.senderSnapshot?.email?.toLowerCase()?.trim();
  if (email) return `e:${email}`;
  const name = (message.senderSnapshot?.name || '').trim();
  const role = message.senderSnapshot?.role || '';
  return `n:${name}|${role}`;
}

export function buildMessageThreadMeta(
  chronologicalMessages: ChatMessage[]
): Map<string, MessageThreadMeta> {
  const map = new Map<string, MessageThreadMeta>();
  const n = chronologicalMessages.length;
  for (let i = 0; i < n; i++) {
    const m = chronologicalMessages[i];
    const prev = i > 0 ? chronologicalMessages[i - 1] : null;
    const next = i < n - 1 ? chronologicalMessages[i + 1] : null;
    const key = senderKeyForThread(m);
    const samePrev = !!prev && senderKeyForThread(prev) === key;
    const sameNext = !!next && senderKeyForThread(next) === key;
    map.set(m._id, {
      showAvatar: !samePrev,
      showTimestamp: !sameNext,
    });
  }
  return map;
}

export function formatChatTimeVi(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function classShortName(className?: string) {
  return (className || 'lớp').replace(/^Lớp\s+/i, '').trim();
}

/** Tên phụ huynh (đối phương) cho cuộc GV↔PH — danh sách & header WIS. */
export function teacherGuardianChatCounterpartTitle(c: ChatConversation): string {
  for (const g of c.guardians || []) {
    const n = String(g?.name || '').trim();
    if (n) return n;
  }
  const t = c.title?.trim() || '';
  for (const sep of [' — ', ' – ', ' - ', '—', '–']) {
    if (t.includes(sep)) {
      const parts = t.split(sep);
      const last = parts[parts.length - 1]?.trim();
      if (last) return last;
    }
  }
  return t;
}

/** Tin do chính GV đang xem danh sách/thread gửi (khớp unread socket). */
export function isMessageFromTeacherViewer(
  message: ChatMessage,
  viewerEmail: string | undefined
): boolean {
  const e = String(viewerEmail || '').trim().toLowerCase();
  const m = String(message.senderSnapshot?.email || '').trim().toLowerCase();
  return message.senderSnapshot?.role === 'teacher' && !!e && !!m && e === m;
}

/** Đồng bộ unread khi nhận socket (chiếu mirror logic GuardianChat: fromGuardian ↔ fromTeacherSelf). */
export function mergeUnreadCountOnSocketMessage(
  incoming: ChatConversation,
  prevLocal: ChatConversation | null | undefined,
  fromTeacherSelf: boolean,
  viewingThisThread: boolean
): number {
  const prevUnread = Math.max(0, Number(prevLocal?.unreadCount ?? 0));
  const serverUnread = Math.max(0, Number(incoming.unreadCount ?? 0));
  if (fromTeacherSelf) {
    return serverUnread;
  }
  if (viewingThisThread) {
    return 0;
  }
  return Math.max(prevUnread + 1, serverUnread);
}

export function conversationHeaderTitle(c: ChatConversation | null): string {
  if (!c) return '';
  if (c.type === 'class_general') {
    return c.title?.trim() || `Nhóm chung lớp ${classShortName(c.className)}`;
  }
  if (String(c.type || '').startsWith('teacher_guardian')) {
    const counterpart = teacherGuardianChatCounterpartTitle(c);
    if (counterpart) return counterpart;
  }
  if (c.title?.trim()) return c.title.trim();
  return `GVCN lớp ${classShortName(c.className)}`;
}

export function conversationSubtitle(c: ChatConversation, locked: boolean): string {
  if (locked) return 'Chỉ đọc lịch sử';
  // Chat 1-1 GV↔PH: subtitle theo tên HS (BE snapshot `studentNames`), không lặp tên PH.
  if (String(c.type || '').startsWith('teacher_guardian')) {
    const raw = (c.guardians || [])
      .flatMap((g) => g.studentNames || [])
      .map((n) => String(n || '').trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const names: string[] = [];
    for (const n of raw) {
      const k = n.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      names.push(n);
    }
    if (names.length) {
      return names.length === 1
        ? `Phụ huynh của ${names[0]}`
        : `Phụ huynh của ${names.join(', ')}`;
    }
    const cn = classShortName(c.className);
    return cn ? `Lớp ${cn}` : '';
  }
  const guardians = c.guardians?.map((g) => g.name).filter(Boolean) as string[];
  if (guardians.length) return guardians.join(', ');
  const cn = classShortName(c.className);
  return cn ? `Lớp ${cn}` : '';
}

export function chatReactionsKey(reactions: ChatMessage['reactions'] | undefined): string {
  if (!reactions?.length) return '';
  return `${reactions.length}:${reactions.map((r) => String(r.emoji)).sort().join(',')}`;
}

export function chatAttachmentsKey(attachments: ChatMessage['attachments'] | undefined): string {
  if (!attachments?.length) return '';
  return attachments.map((a) => `${a.kind}:${a.url}`).join('|');
}

/** Nội dản sao chép / preview overlay — hỗ trợ sticker wire. */
export function overlayPreviewPlainText(content: string | undefined, recalledAt?: string): string {
  if (recalledAt) return 'Tin nhắn đã thu hồi';
  const wl = parseChatWislifeStickerContent(content);
  if (wl) return getEmojiFallbackText(wl);
  return String(content || '');
}

/** Optimistic reaction — chờ server (giống GuardianChatScreen). */
export function applyLocalReactionToggleViewer(
  prev: ChatMessage[],
  messageId: string,
  emoji: ChatEmoji,
  viewerEmails: Set<string>,
  displayName: string
): ChatMessage[] {
  return prev.map((m) => {
    if (m._id !== messageId) return m;
    const reactions = [...(m.reactions || [])];
    const idx = reactions.findIndex(
      (r) => r.email && viewerEmails.has(String(r.email).toLowerCase().trim())
    );
    if (idx >= 0) {
      if (reactions[idx].emoji === emoji) {
        reactions.splice(idx, 1);
      } else {
        reactions[idx] = {
          ...reactions[idx],
          emoji,
          createdAt: new Date().toISOString(),
        };
      }
    } else {
      const primary = [...viewerEmails][0] || '';
      reactions.push({
        emoji,
        email: primary,
        name: displayName,
        createdAt: new Date().toISOString(),
      });
    }
    return { ...m, reactions };
  });
}
