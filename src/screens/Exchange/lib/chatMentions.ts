/**
 * Nhắc tên (@) trong chat — logic thuần cho ô soạn tin và phần hiển thị (SIS-179).
 *
 * KHÔNG chứa luật phân quyền: server trả `conversation.viewerMentionPermissions` (ai được tag
 * nhóm nào) và app chỉ vẽ theo. Thêm phân loại thành viên hay vai trò mới về sau chỉ sửa backend.
 *
 * LƯU Ý: bản sao của file này nằm ở frappe-sis-frontend (bản gốc), parent-portal và
 * parent-portal-mobile — sửa một nơi thì sửa cả bốn, lệch nhau sẽ tô đậm sai chỗ.
 */
import type { ChatConversation, ChatMention, ChatMentionSegment } from '../../../types/chat';
import { formatChatDisplayName } from '../exchangeChatThreadUtils';

export type ChatMentionCandidate = {
  key: string;
  type: ChatMention['type'];
  segment?: ChatMentionSegment;
  userId?: string;
  email?: string;
  /** Tên sẽ chèn vào ô nhập (không kèm '@'). */
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  isGroup: boolean;
};

export type ChatMentionTrigger = { start: number; end: number; query: string };

export const CHAT_MENTION_SUGGESTION_LIMIT = 8;

const MENTION_QUERY_MAX = 40;

export function normalizeMentionSearch(value: string): string {
  return (value || '')
    .normalize('NFD')
    // Dải dấu thanh tổ hợp — KHÔNG dùng `\p{M}` vì Hermes (React Native) hỗ trợ không đồng đều.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Token `@…` mà con trỏ đang đứng trong đó. `@` phải đứng đầu dòng hoặc sau khoảng trắng —
 * "email@ws.edu.vn" không kích hoạt gợi ý.
 */
export function findMentionTrigger(text: string, caret: number): ChatMentionTrigger | null {
  const pos = Math.max(0, Math.min(caret, text.length));
  for (let i = pos - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch === '@') {
      const prev = i > 0 ? text[i - 1] : '';
      if (prev && !/\s/.test(prev)) return null;
      const query = text.slice(i + 1, pos);
      if (query.length > MENTION_QUERY_MAX) return null;
      return { start: i, end: pos, query };
    }
    if (ch === '\n') return null;
    if (pos - i > MENTION_QUERY_MAX + 1) return null;
  }
  return null;
}

export function mentionSegmentLabel(segment: ChatMentionSegment): string {
  if (segment === 'teachers') return 'Giáo viên';
  if (segment === 'guardians') return 'Phụ huynh';
  return String(segment);
}

export const MENTION_EVERYONE_LABEL = 'Tất cả';

type MemberRow = {
  name?: string;
  email?: string;
  avatarUrl?: string;
  removedAt?: string | null;
  studentNames?: string[];
};

function matchesQuery(name: string, email: string, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const n = normalizeMentionSearch(name);
  const e = normalizeMentionSearch(email);
  if (n.includes(normalizedQuery) || e.includes(normalizedQuery)) return true;
  return n.split(/\s+/).some((word) => word.startsWith(normalizedQuery));
}

function rankOf(name: string, normalizedQuery: string): number {
  if (!normalizedQuery) return 1;
  const n = normalizeMentionSearch(name);
  if (n.startsWith(normalizedQuery)) return 0;
  if (n.split(/\s+/).some((word) => word.startsWith(normalizedQuery))) return 1;
  return 2;
}

export function buildMentionCandidates(args: {
  conversation: ChatConversation | null | undefined;
  query: string;
  viewerEmail?: string;
  limit?: number;
}): ChatMentionCandidate[] {
  const { conversation, query, viewerEmail, limit = CHAT_MENTION_SUGGESTION_LIMIT } = args;
  if (!conversation) return [];

  const q = normalizeMentionSearch(query);
  const viewer = normalizeMentionSearch(viewerEmail || '');
  const permissions = conversation.viewerMentionPermissions;
  const groups: ChatMentionCandidate[] = [];

  if (permissions?.canMentionEveryone && matchesQuery(MENTION_EVERYONE_LABEL, '', q)) {
    groups.push({
      key: 'everyone',
      type: 'everyone',
      name: MENTION_EVERYONE_LABEL,
      subtitle: 'Nhắc mọi thành viên trong nhóm',
      isGroup: true,
    });
  }
  for (const segment of permissions?.allowedSegments || []) {
    const label = mentionSegmentLabel(segment);
    if (!matchesQuery(label, '', q)) continue;
    groups.push({
      key: `segment:${segment}`,
      type: 'segment',
      segment,
      name: label,
      subtitle: segment === 'teachers' ? 'Nhắc tất cả giáo viên' : 'Nhắc tất cả phụ huynh',
      isGroup: true,
    });
  }

  const people: { candidate: ChatMentionCandidate; rank: number }[] = [];
  const seen = new Set<string>();
  const pushPerson = (row: MemberRow, subtitle: string) => {
    if (!row || row.removedAt) return;
    const email = String(row.email || '').trim();
    const name = formatChatDisplayName(row.name) || email;
    if (!name) return;
    const emailKey = normalizeMentionSearch(email);
    if (emailKey && emailKey === viewer) return;
    if (emailKey && seen.has(emailKey)) return;
    if (!matchesQuery(name, email, q)) return;
    if (emailKey) seen.add(emailKey);
    people.push({
      candidate: {
        key: `user:${emailKey || name}`,
        type: 'user',
        email,
        name,
        subtitle,
        avatarUrl: row.avatarUrl,
        isGroup: false,
      },
      rank: rankOf(name, q),
    });
  };

  for (const teacher of conversation.teachers || []) pushPerson(teacher, 'Giáo viên');
  for (const guardian of conversation.guardians || []) {
    const studentNames = (guardian.studentNames || []).filter(Boolean);
    pushPerson(guardian, studentNames.length ? `PH ${studentNames.join(', ')}` : 'Phụ huynh');
  }

  people.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.candidate.name.localeCompare(b.candidate.name)));
  return [...groups, ...people.map((p) => p.candidate)].slice(0, limit);
}

export type ChatMentionInsertResult = { text: string; caret: number; mention: ChatMention };

export function insertMention(
  text: string,
  trigger: ChatMentionTrigger,
  candidate: ChatMentionCandidate,
): ChatMentionInsertResult {
  const token = `@${candidate.name}`;
  const before = text.slice(0, trigger.start);
  const after = text.slice(trigger.end);
  const needsSpace = !after.startsWith(' ');
  return {
    text: `${before}${token}${needsSpace ? ' ' : ''}${after}`,
    caret: before.length + token.length + 1,
    mention: {
      type: candidate.type,
      segment: candidate.segment,
      userId: candidate.userId,
      email: candidate.email,
      name: candidate.name,
      start: before.length,
      length: token.length,
    },
  };
}

/** Neo lại offset sau khi nội dung đổi; tag bị sửa/xoá chữ thì loại luôn. */
export function syncMentions(text: string, mentions: ChatMention[]): ChatMention[] {
  if (!mentions.length) return mentions;
  const content = text || '';
  const kept: ChatMention[] = [];
  const taken: { start: number; length: number }[] = [];

  for (const mention of mentions) {
    const token = `@${mention.name}`;
    let start = -1;
    if (content.substr(mention.start, token.length) === token) {
      start = mention.start;
    } else {
      const first = content.indexOf(token);
      if (first >= 0 && content.indexOf(token, first + 1) < 0) start = first;
    }
    if (start < 0) continue;
    const overlaps = taken.some((r) => start < r.start + r.length && r.start < start + token.length);
    if (overlaps) continue;
    taken.push({ start, length: token.length });
    kept.push({ ...mention, start, length: token.length });
  }

  return kept.sort((a, b) => a.start - b.start);
}

export type ChatMentionTextPart = { text: string; mention?: ChatMention };

export function splitMentionParts(text: string, mentions?: ChatMention[] | null): ChatMentionTextPart[] {
  const content = text || '';
  const marks = syncMentions(content, (mentions || []).filter(Boolean));
  if (!marks.length) return [{ text: content }];

  const parts: ChatMentionTextPart[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start > cursor) parts.push({ text: content.slice(cursor, mark.start) });
    parts.push({ text: content.slice(mark.start, mark.start + mark.length), mention: mark });
    cursor = mark.start + mark.length;
  }
  if (cursor < content.length) parts.push({ text: content.slice(cursor) });
  return parts;
}
