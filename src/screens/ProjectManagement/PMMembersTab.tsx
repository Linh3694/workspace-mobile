import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, ButtonGhost } from '@atoms';
import { ListRow, resolveStatus } from '@molecules';
import { AppSheet, EmptyState, RefreshableList, useSheetQueue } from '@organisms';
import { SCREEN_PADDING } from '@templates';

import {
  cancelInvitation,
  getProjectInvitations,
  getProjectMembers,
  removeMember,
  updateMemberRole,
} from '../../services/projectManagementService';
import type {
  PMProjectInvitation,
  PMProjectMember,
  ProjectRole,
} from '../../types/projectManagement';
import { space } from '../../theme/tokens';
import { INVITATION_STATUS, PROJECT_ROLE, i18nKey } from './pmStatus';

export interface PMMembersTabProps {
  projectId: string;
  /** Vai trò của chính người đang xem — quyết định hiện nút nào. */
  myRole?: ProjectRole;
}

/** Vai trò gán được. `owner` không có ở đây: đổi chủ đi qua `transfer_ownership`. */
const ASSIGNABLE: Exclude<ProjectRole, 'owner'>[] = ['manager', 'member', 'viewer'];

type Row =
  | { kind: 'member'; member: PMProjectMember }
  | { kind: 'invitation'; invitation: PMProjectInvitation }
  | { kind: 'header'; label: string };

/**
 * Thành viên dự án + lời mời đang chờ.
 *
 * Chỉ CHỦ dự án mới đổi được vai trò và xoá được thành viên — khớp đúng
 * `update_member_role` và `remove_member` của backend (cả hai chặn `role != owner`).
 * Hiện nút cho người không đủ quyền là mời họ bấm vào để nhận 403.
 */
const PMMembersTab: React.FC<PMMembersTabProps> = ({ projectId, myRole }) => {
  const { t } = useTranslation();
  const sheet = useSheetQueue<'role'>();

  const [members, setMembers] = useState<PMProjectMember[]>([]);
  const [invitations, setInvitations] = useState<PMProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PMProjectMember | null>(null);

  const isOwner = myRole === 'owner';

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [memRes, invRes] = await Promise.all([
        getProjectMembers(projectId),
        getProjectInvitations(projectId),
      ]);
      if (!mounted.current) return;

      if (memRes.success) {
        setMembers(memRes.data ?? []);
        setError(null);
      } else {
        setError(memRes.message ?? 'Không tải được danh sách thành viên');
      }
      // Lời mời chỉ owner/manager đọc được — thất bại ở đây là chuyện bình thường.
      setInvitations(invRes.success ? (invRes.data ?? []).filter((i) => i.status === 'pending') : []);

      setLoading(false);
      setRefreshing(false);
    },
    [projectId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = useCallback(
    async (member: PMProjectMember, role: Exclude<ProjectRole, 'owner'>) => {
      sheet.close();
      if (role === member.role) return;
      const res = await updateMemberRole(projectId, member.user_id, role);
      if (!mounted.current) return;
      if (res.success) load(true);
      else
        Alert.alert(
          t('common.error', 'Đã có lỗi'),
          res.message ?? t('common.try_again', 'Vui lòng thử lại')
        );
    },
    [projectId, load, sheet, t]
  );

  const confirmRemove = useCallback(
    (member: PMProjectMember) => {
      Alert.alert(
        t('project_management.xoa_thanh_vien', 'Xoá thành viên'),
        t('project_management.xoa_thanh_vien_hoi', 'Xoá {{name}} khỏi dự án?', {
          name: member.full_name || member.user_id,
        }),
        [
          { text: t('common.cancel', 'Huỷ'), style: 'cancel' },
          {
            text: t('common.delete', 'Xoá'),
            style: 'destructive',
            onPress: async () => {
              const res = await removeMember(projectId, member.user_id);
              if (!mounted.current) return;
              if (res.success) load(true);
              else
                Alert.alert(
                  t('common.error', 'Đã có lỗi'),
                  res.message ?? t('common.try_again', 'Vui lòng thử lại')
                );
            },
          },
        ]
      );
    },
    [projectId, load, t]
  );

  const cancelInvite = useCallback(
    async (invitation: PMProjectInvitation) => {
      const res = await cancelInvitation(invitation.name);
      if (!mounted.current) return;
      if (res.success) load(true);
      else
        Alert.alert(
          t('common.error', 'Đã có lỗi'),
          res.message ?? t('common.try_again', 'Vui lòng thử lại')
        );
    },
    [load, t]
  );

  const rows: Row[] = [
    ...members.map((member) => ({ kind: 'member' as const, member })),
    ...(invitations.length
      ? [
          {
            kind: 'header' as const,
            label: t('project_management.dang_cho_phan_hoi', 'Đang chờ phản hồi'),
          },
          ...invitations.map((invitation) => ({ kind: 'invitation' as const, invitation })),
        ]
      : []),
  ];

  if (error && !members.length) {
    return (
      <EmptyState
        icon="alert-circle"
        title={t('common.error', 'Đã có lỗi')}
        description={error}
        actionLabel={t('common.retry', 'Thử lại')}
        onAction={() => load()}
      />
    );
  }

  return (
    <>
      <RefreshableList
        data={rows}
        keyExtractor={(row, i) =>
          row.kind === 'member'
            ? row.member.name
            : row.kind === 'invitation'
              ? row.invitation.name
              : `h-${i}`
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
              <View style={{ paddingTop: space[12], paddingBottom: space[6] }}>
                <AppText variant="footnote" tone="description">
                  {item.label}
                </AppText>
              </View>
            );
          }
          if (item.kind === 'invitation') {
            const inv = item.invitation;
            const status = resolveStatus(inv.status, INVITATION_STATUS);
            return (
              <ListRow
                title={inv.invitee_full_name || inv.invitee_id}
                subtitle={inv.invitee_email || inv.invitee_id}
                avatarUri={inv.invitee_image}
                avatarName={inv.invitee_full_name || inv.invitee_id}
                status={{
                  label: t(i18nKey.invitationStatus(inv.status), status.label),
                  tone: status.tone,
                }}
                footer={
                  isOwner ? (
                    <ButtonGhost
                      label={t('project_management.huy_loi_moi', 'Huỷ lời mời')}
                      size="sm"
                      onPress={() => cancelInvite(inv)}
                    />
                  ) : undefined
                }
              />
            );
          }

          const member = item.member;
          const role = resolveStatus(member.role, PROJECT_ROLE);
          const canManage = isOwner && member.role !== 'owner';
          return (
            <ListRow
              title={member.full_name || member.user_id}
              subtitle={member.email || member.user_id}
              avatarUri={member.user_image}
              avatarName={member.full_name || member.user_id}
              status={{ label: t(i18nKey.role(member.role), role.label), tone: role.tone }}
              footer={
                canManage ? (
                  <View style={{ flexDirection: 'row', gap: space[8] }}>
                    <ButtonGhost
                      label={t('project_management.doi_vai_tro', 'Đổi vai trò')}
                      size="sm"
                      onPress={() => {
                        setEditing(member);
                        sheet.open('role');
                      }}
                    />
                    <ButtonGhost
                      label={t('common.delete', 'Xoá')}
                      size="sm"
                      onPress={() => confirmRemove(member)}
                    />
                  </View>
                ) : undefined
              }
            />
          );
        }}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        contentPadding={SCREEN_PADDING}
        empty={{
          icon: 'users',
          title: t('project_management.chua_co_thanh_vien', 'Chưa có thành viên'),
        }}
      />

      <AppSheet
        visible={sheet.isOpen('role')}
        onClose={sheet.close}
        onClosed={sheet.handleClosed}
        title={t('project_management.doi_vai_tro', 'Đổi vai trò')}>
        <View style={{ gap: space[4] }}>
          {editing ? (
            <AppText variant="footnote" tone="description" style={{ marginBottom: space[4] }}>
              {editing.full_name || editing.user_id}
            </AppText>
          ) : null}
          {ASSIGNABLE.map((r) => (
            <ButtonGhost
              key={r}
              label={t(i18nKey.role(r), PROJECT_ROLE[r]?.label ?? r)}
              block
              onPress={() => (editing ? changeRole(editing, r) : undefined)}
            />
          ))}
        </View>
      </AppSheet>
    </>
  );
};

export default PMMembersTab;
