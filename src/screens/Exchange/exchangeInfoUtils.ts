/**
 * Helper dùng chung cho các màn Thông tin hội thoại (info / members / attachments).
 */
import type { ChatAttachment, ChatConversation, ChatMessage } from '../../types/chat';
import { formatChatDisplayName } from './exchangeChatThreadUtils';
import { resolveParticipantAvatarUrl } from './lib/chatMemberAvatar';

export type InfoMember = {
  key: string;
  name: string;
  avatar: string;
  role: string;
  pill: string | null;
  isGuardian: boolean;
  guardianId?: string;
  teacherId?: string;
  /** GV bộ môn thêm thủ công → gỡ được (chỉ GVCN thấy nút gỡ). */
  removable?: boolean;
};

export type MemberRoleLabels = {
  teacher: string;
  subjectTeacher: string;
  parent: string;
};

/** Danh sách thành viên từ conversation.teachers[] + guardians[] (GV trước, PH sau). */
export function buildConversationMembers(
  conversation: ChatConversation | null,
  labels: MemberRoleLabels
): InfoMember[] {
  const teachers = (conversation?.teachers || [])
    .filter((tt) => !tt.removedAt) // GV đã gỡ mềm → không hiển thị (giống web)
    .map((tt, i) => {
      const subjects = (tt.subjects || [])
        .map((s) => s?.title)
        .filter(Boolean)
        .join(', ');
      return {
        key: `t:${tt.teacherId || tt.email || tt.name || i}`,
        name: formatChatDisplayName(tt.name) || tt.email || labels.teacher,
        avatar: resolveParticipantAvatarUrl(tt.avatarUrl, tt.email || tt.name || 'gv'),
        role: subjects ? `${labels.subjectTeacher} • ${subjects}` : labels.teacher,
        pill: 'GV' as const,
        isGuardian: false,
        teacherId: tt.teacherId,
        removable: Boolean(tt.manualAdd),
      };
    });
  const guardians = (conversation?.guardians || [])
    .filter((g) => !g.removedAt) // PH đã rời nhóm → không hiển thị (giống web)
    .map((g, i) => ({
      key: `g:${g.guardianId || g.email || g.name || i}`,
      name: formatChatDisplayName(g.name) || g.email || labels.parent,
      avatar: resolveParticipantAvatarUrl(g.avatarUrl, g.email || g.name || 'ph'),
      role: labels.parent,
      pill: null,
      isGuardian: true,
      guardianId: g.guardianId,
    }));
  return [...teachers, ...guardians];
}

/**
 * teacherId của người xem trong hội thoại — có nghĩa là "GV có quyền chat" ở lớp này.
 * Rỗng nếu người xem không phải participant GV (vd BOD observer) → không mở 1-1.
 */
export function resolveCallerTeacherId(
  conversation: ChatConversation | null,
  viewerEmail?: string | null
): string {
  const e = String(viewerEmail || '')
    .trim()
    .toLowerCase();
  if (!e || !conversation) return '';
  const found = (conversation.teachers || []).find(
    (tt) => String(tt.email || '').trim().toLowerCase() === e
  );
  return found?.teacherId || '';
}

/**
 * Người xem có phải GVCN/Phó CN của nhóm không → được quản lý (thêm/gỡ) GV bộ môn.
 * Chỉ áp dụng nhóm lớp (class_general). Khớp email trong teachers[] với manualAdd falsy & chưa gỡ.
 */
export function isViewerHomeroom(
  conversation: ChatConversation | null,
  viewerEmail?: string | null
): boolean {
  if (!conversation || conversation.type !== 'class_general') return false;
  const e = String(viewerEmail || '')
    .trim()
    .toLowerCase();
  if (!e) return false;
  return (conversation.teachers || []).some(
    (tt) => !tt.removedAt && !tt.manualAdd && String(tt.email || '').trim().toLowerCase() === e
  );
}

export type DatedAttachment = ChatAttachment & { createdAt: string };

/** Gom attachment kèm thời điểm gửi (message.createdAt) để chia nhóm theo ngày. */
export function collectDatedAttachments(messages: ChatMessage[]): DatedAttachment[] {
  return messages.flatMap((m) =>
    (m.attachments || []).map((a) => ({ ...a, createdAt: m.createdAt }))
  );
}

export type AttachmentDayGroup = {
  dayKey: string;
  label: string;
  items: DatedAttachment[];
};

function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function dayLabelOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Chia danh sách attachment theo ngày gửi, mới nhất trước. */
export function groupAttachmentsByDay(items: DatedAttachment[]): AttachmentDayGroup[] {
  const byDay = new Map<string, AttachmentDayGroup>();
  for (const it of items) {
    const key = dayKeyOf(it.createdAt);
    if (!key) continue;
    let g = byDay.get(key);
    if (!g) {
      g = { dayKey: key, label: dayLabelOf(it.createdAt), items: [] };
      byDay.set(key, g);
    }
    g.items.push(it);
  }
  return Array.from(byDay.values()).sort((a, b) => {
    const ta = new Date(a.items[0]?.createdAt || 0).getTime();
    const tb = new Date(b.items[0]?.createdAt || 0).getTime();
    return tb - ta;
  });
}
