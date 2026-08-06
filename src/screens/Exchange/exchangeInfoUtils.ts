/**
 * Helper dùng chung cho các màn Thông tin hội thoại (info / members / attachments).
 */
import type { ChatAttachment, ChatConversation, ChatMessage } from '../../types/chat';
import { formatChatDisplayName } from './exchangeChatThreadUtils';
import { resolveParticipantAvatarUrl } from './lib/chatMemberAvatar';

/** Một liên kết HS↔PH: "PH chính" thuộc về liên kết chứ không thuộc về con người. */
export type InfoMemberStudent = {
  studentId?: string;
  name: string;
  keyPerson: boolean;
};

export type InfoMember = {
  key: string;
  name: string;
  avatar: string;
  role: string;
  pill: string | null;
  /** Chip quan hệ cạnh tên PH (Mẹ / Bố / Người giám hộ…) — GV không có. */
  relationPill?: string;
  /** SĐT liên hệ — GV lẫn PH đều có thể có (snapshot backend). */
  phone?: string;
  /** Email liên lạc hiển thị được (đã loại địa chỉ portal sinh tự động). */
  email?: string;
  /** Các con của PH kèm cờ PH chính; GV luôn rỗng. */
  students: InfoMemberStudent[];
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
  /** Nhãn GVCN — thiếu (bản dịch cũ) thì rơi về `teacher`. */
  homeroom?: string;
  /** Nhãn Phó GVCN — trước đây phó CN bị hiển thị chung nhãn với GVCN. */
  viceHomeroom?: string;
};

/**
 * Nhãn vai trò một GV: ưu tiên `homeroomRole` từ snapshot backend (nguồn sự thật
 * SIS Class.homeroom_teacher / vice_homeroom_teacher). Hội thoại cũ chưa sync lại không có
 * field này ⇒ giữ hành vi cũ (có môn dạy ⇒ "GV bộ môn • <môn>", còn lại ⇒ nhãn chung).
 */
function teacherRoleText(
  teacher: NonNullable<ChatConversation['teachers']>[number],
  subjects: string,
  labels: MemberRoleLabels,
): string {
  if (teacher.homeroomRole === 'vice_homeroom') return labels.viceHomeroom || labels.teacher;
  if (teacher.homeroomRole === 'homeroom') return labels.homeroom || labels.teacher;
  return subjects ? `${labels.subjectTeacher} • ${subjects}` : labels.homeroom || labels.teacher;
}

/**
 * Thứ tự nhóm thành viên: GVCN → Phó GVCN → GVBM → PH chính → PH thường (mỗi nhóm A→Z).
 * Giữ khớp với bản web (`classChatUtils.buildChatMemberRows`) để hai nền hiện cùng thứ tự.
 */
const MEMBER_GROUP_RANK = {
  homeroom: 0,
  viceHomeroom: 1,
  subjectTeacher: 2,
  keyGuardian: 3,
  guardian: 4,
} as const;

/**
 * Sắp tên tiếng Việt: tên → họ → đệm (cùng luật `sortVietnameseName` dùng ở các màn khác).
 * Luật đó chỉ so ký tự ĐẦU mỗi phần nên tên cùng chữ cái đầu sẽ hoà — so thêm nguyên chuỗi
 * để ra A→Z thật sự và thứ tự ổn định.
 */
function compareVietnameseName(nameA: string, nameB: string): number {
  const partsA = nameA.trim().split(' ').filter(Boolean);
  const partsB = nameB.trim().split(' ').filter(Boolean);
  if (!partsA.length && !partsB.length) return 0;
  if (!partsA.length) return 1;
  if (!partsB.length) return -1;

  const firstChars = (parts: string[]) => parts.map((p) => p.charAt(0).toLowerCase());
  const charsA = firstChars(partsA);
  const charsB = firstChars(partsB);

  const byGivenName = (charsA[charsA.length - 1] || '').localeCompare(
    charsB[charsB.length - 1] || '',
    'vi'
  );
  if (byGivenName !== 0) return byGivenName;

  const byFamilyName = (charsA[0] || '').localeCompare(charsB[0] || '', 'vi');
  if (byFamilyName !== 0) return byFamilyName;

  if (charsA.length >= 3 && charsB.length >= 3) {
    const byMiddle = (charsA[1] || '').localeCompare(charsB[1] || '', 'vi');
    if (byMiddle !== 0) return byMiddle;
  } else if (charsA.length >= 3) return -1;
  else if (charsB.length >= 3) return 1;

  return nameA.localeCompare(nameB, 'vi');
}

/** Chữ cái đầu cho avatar chữ của học sinh (họ + tên gọi), giống `getInitials` bên web. */
export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const last = parts[parts.length - 1]?.[0] || '';
  const first = parts.length > 1 ? parts[0]?.[0] || '' : '';
  return `${first}${last}`.toUpperCase() || '?';
}

type ChatGuardian = NonNullable<ChatConversation['guardians']>[number];

/** Địa chỉ portal sinh tự động khi PH chưa khai email — không phải email thật, không hiển thị. */
const PORTAL_EMAIL_DOMAIN = '@parent.wellspring.edu.vn';

/**
 * Email hiển thị: lấy từ bảng con `CRM Guardian Email` (`contactEmail`).
 * `guardian.email` chỉ là email định danh nên chỉ dùng khi KHÔNG phải địa chỉ portal.
 */
export function displayGuardianEmail(guardian?: ChatGuardian): string {
  const contact = String(guardian?.contactEmail || '').trim();
  if (contact) return contact;
  const identity = String(guardian?.email || '').trim();
  return identity.toLowerCase().endsWith(PORTAL_EMAIL_DOMAIN) ? '' : identity;
}

/**
 * Các con của một PH: ưu tiên `studentLinks` (có quan hệ + cờ PH chính theo từng HS);
 * snapshot cũ chỉ có `studentNames` thì vẫn hiện tên, không có cờ PH chính.
 */
function studentLinksOf(guardian: ChatGuardian): InfoMemberStudent[] {
  const links = guardian.studentLinks || [];
  if (links.length) {
    return links
      .map((l) => ({
        // Tên HS lấy từ hồ sơ SIS (đã đúng thứ tự tiếng Việt) → KHÔNG chuẩn hoá lại như tên AD.
        studentId: l.studentId,
        name: String(l.studentName || '').trim(),
        keyPerson: Boolean(l.keyPerson),
      }))
      .filter((l) => l.name);
  }
  return (guardian.studentNames || [])
    .map((n) => ({ name: String(n || '').trim(), keyPerson: false }))
    .filter((l) => l.name);
}

/** Quan hệ hiển thị cạnh tên PH — quan hệ đầu tiên khác rỗng trong các liên kết. */
function relationshipCodeOf(guardian: ChatGuardian): string {
  return (guardian.studentLinks || []).map((l) => String(l.relationship || '').trim()).find(Boolean) || '';
}

/**
 * Danh sách thành viên từ conversation.teachers[] + guardians[], sắp theo
 * {@link MEMBER_GROUP_RANK}: GVCN → Phó GVCN → GVBM → PH chính → PH thường (mỗi nhóm A→Z).
 *
 * Rank GV bám ĐÚNG luật của {@link teacherRoleText} (kể cả nhánh fallback khi thiếu
 * `homeroomRole`) để thứ tự luôn khớp nhãn vai trò đang hiện. "PH chính" = PH có cờ
 * `keyPerson` ở ít nhất một liên kết học sinh.
 *
 * `translateRelationship` dịch mã quan hệ ('mother') sang nhãn hiển thị — truyền từ màn hình
 * để dùng đúng ngôn ngữ đang chọn; thiếu thì bỏ chip quan hệ chứ không in mã EN ra UI.
 */
export function buildConversationMembers(
  conversation: ChatConversation | null,
  labels: MemberRoleLabels,
  translateRelationship?: (raw: string) => string
): InfoMember[] {
  const teachers = (conversation?.teachers || [])
    .filter((tt) => !tt.removedAt) // GV đã gỡ mềm → không hiển thị (giống web)
    .map((tt, i) => {
      const subjects = (tt.subjects || [])
        .map((s) => s?.title)
        .filter(Boolean)
        .join(', ');
      const rank =
        tt.homeroomRole === 'vice_homeroom'
          ? MEMBER_GROUP_RANK.viceHomeroom
          : tt.homeroomRole === 'homeroom'
            ? MEMBER_GROUP_RANK.homeroom
            : subjects
              ? MEMBER_GROUP_RANK.subjectTeacher
              : MEMBER_GROUP_RANK.homeroom;
      return {
        rank,
        member: {
          key: `t:${tt.teacherId || tt.email || tt.name || i}`,
          name: formatChatDisplayName(tt.name) || tt.email || labels.teacher,
          avatar: resolveParticipantAvatarUrl(tt.avatarUrl, tt.email || tt.name || 'gv'),
          role: teacherRoleText(tt, subjects, labels),
          pill: 'GV' as const,
          phone: String(tt.phoneNumber || '').trim() || undefined,
          students: [] as InfoMemberStudent[],
          isGuardian: false,
          teacherId: tt.teacherId,
          removable: Boolean(tt.manualAdd),
        },
      };
    });
  const guardians = (conversation?.guardians || [])
    .filter((g) => !g.removedAt) // PH đã rời nhóm → không hiển thị (giống web)
    .map((g, i) => {
      const relationCode = relationshipCodeOf(g);
      const students = studentLinksOf(g);
      return {
        rank: students.some((s) => s.keyPerson)
          ? MEMBER_GROUP_RANK.keyGuardian
          : MEMBER_GROUP_RANK.guardian,
        member: {
          key: `g:${g.guardianId || g.email || g.name || i}`,
          name: formatChatDisplayName(g.name) || g.email || labels.parent,
          avatar: resolveParticipantAvatarUrl(g.avatarUrl, g.email || g.name || 'ph'),
          role: labels.parent,
          pill: null,
          relationPill: (relationCode && translateRelationship?.(relationCode)) || undefined,
          phone: String(g.phoneNumber || '').trim() || undefined,
          email: displayGuardianEmail(g) || undefined,
          students,
          isGuardian: true,
          guardianId: g.guardianId,
        },
      };
    });
  return [...teachers, ...guardians]
    .sort((a, b) => a.rank - b.rank || compareVietnameseName(a.member.name, b.member.name))
    .map((item) => item.member);
}

/** Chuẩn hoá chuỗi tìm kiếm: bỏ dấu + thường hoá. */
function searchNormalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

/** Lọc thành viên theo tên GV/PH, vai trò, quan hệ, tên học sinh hoặc số điện thoại (giống web). */
export function filterInfoMembers(members: InfoMember[], keyword: string): InfoMember[] {
  const needle = searchNormalize(keyword);
  if (!needle) return members;
  const digits = needle.replace(/\D/g, '');
  return members.filter((m) => {
    if (searchNormalize(`${m.name} ${m.role} ${m.relationPill || ''}`).includes(needle)) return true;
    if (m.students.some((s) => searchNormalize(s.name).includes(needle))) return true;
    const phoneDigits = (m.phone || '').replace(/\D/g, '');
    return Boolean(digits) && phoneDigits.includes(digits);
  });
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
