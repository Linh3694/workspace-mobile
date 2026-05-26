import type { ChatConversation } from '../../../types/chat';

/** Thành viên ghép từ teachers + guardians (đã gỡ trùng). */
export type GroupChatMember = {
  key: string;
  emailNorm: string;
  name: string;
  avatarUrl?: string;
  role: 'teacher' | 'guardian';
};

function memberKey(
  m: {
    email?: string;
    guardianId?: string;
    teacherId?: string;
    name?: string;
  },
  role: 'teacher' | 'guardian'
) {
  const e = m.email?.trim().toLowerCase();
  if (e) return `e:${e}`;
  if (role === 'teacher' && m.teacherId) return `t:${String(m.teacherId).trim()}`;
  if (m.guardianId) return `g:${String(m.guardianId).trim()}`;
  return `n:${(m.name || '').trim()}|${role}`;
}

export function listGroupChatMembers(conversation: ChatConversation): GroupChatMember[] {
  const map = new Map<string, GroupChatMember>();

  for (const t of conversation.teachers || []) {
    const role = 'teacher' as const;
    const key = memberKey(t, role);
    if (map.has(key)) continue;
    map.set(key, {
      key,
      emailNorm: t.email?.trim().toLowerCase() || '',
      name: t.name || t.email || '',
      avatarUrl: t.avatarUrl,
      role,
    });
  }

  for (const g of conversation.guardians || []) {
    const role = 'guardian' as const;
    const key = memberKey(g, role);
    if (map.has(key)) continue;
    map.set(key, {
      key,
      emailNorm: g.email?.trim().toLowerCase() || '',
      name: g.name || g.email || '',
      avatarUrl: g.avatarUrl,
      role,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.role !== b.role) return a.role === 'teacher' ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '', 'vi');
  });
}

export type GroupAvatarDisplay =
  | { kind: 'single'; members: GroupChatMember[] }
  | { kind: 'triple'; members: GroupChatMember[] }
  | { kind: 'quad'; members: GroupChatMember[] }
  | {
      kind: 'overflow';
      members: GroupChatMember[];
      overflowCount: number;
    };

export function getGroupAvatarDisplay(
  conversation: ChatConversation,
  viewerEmailsNorm: Set<string>
): GroupAvatarDisplay {
  const members = listGroupChatMembers(conversation);
  const n = members.length;

  if (n === 0) {
    return { kind: 'single', members: [] };
  }
  if (n === 1) {
    return { kind: 'single', members: [members[0]] };
  }
  if (n === 2) {
    const notSelf = members.filter((m) => !m.emailNorm || !viewerEmailsNorm.has(m.emailNorm));
    const pick = notSelf[0] ?? members[0];
    return { kind: 'single', members: pick ? [pick] : [] };
  }
  if (n === 3) {
    return { kind: 'triple', members: members.slice(0, 3) };
  }
  if (n === 4) {
    return { kind: 'quad', members: members.slice(0, 4) };
  }
  return {
    kind: 'overflow',
    members: members.slice(0, 3),
    overflowCount: n - 3,
  };
}
