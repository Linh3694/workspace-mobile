import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { AppText, Badge } from '@atoms';
import { ListRow, SearchBar, resolveStatus } from '@molecules';
import { RefreshableList } from '@organisms';
import { ListScreen, SCREEN_PADDING } from '@templates';

import { ROUTES } from '../../constants/routes';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  getMyInvitations,
  getMyProjects,
} from '../../services/projectManagementService';
import type { PMProject } from '../../types/projectManagement';
import { space } from '../../theme/tokens';
import { PROJECT_ROLE, i18nKey } from './pmStatus';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Danh sách dự án — cửa vào module Quản lý dự án trên app.
 *
 * Số lời mời đang chờ hiện ngay ở đây thay vì nằm trong một màn riêng phải tự
 * tìm: `pm_project_invited` là thông báo push, người nhận bấm vào là tới thẳng
 * màn Lời mời, nhưng ai mở app theo đường thường thì phải nhìn thấy nó ở đâu đó.
 */
const PMProjectListScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { t } = useTranslation();

  const [projects, setProjects] = useState<PMProject[]>([]);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    // Hai lời gọi độc lập: lời mời hỏng thì danh sách dự án vẫn phải hiện.
    const [projectRes, inviteRes] = await Promise.all([
      getMyProjects({ status: 'active' }),
      getMyInvitations('pending'),
    ]);

    if (!mounted.current) return;

    if (projectRes.success) setProjects(projectRes.data ?? []);
    else setError(projectRes.message ?? 'Không tải được danh sách dự án');

    setPendingInvites(inviteRes.success ? (inviteRes.data ?? []).length : 0);

    setLoading(false);
    setRefreshing(false);
  }, []);

  // Tải lại mỗi lần quay về: nhận lời mời ở màn kia xong thì dự án mới phải xuất hiện.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.title?.toLowerCase().includes(q));
  }, [projects, query]);

  const openProject = useCallback(
    (project: PMProject) => {
      navigation.navigate(ROUTES.SCREENS.PM_PROJECT_DETAIL, {
        projectId: project.name,
        projectTitle: project.title,
      });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: PMProject }) => {
      const role = item.current_user_role;
      const roleInfo = role ? resolveStatus(role, PROJECT_ROLE) : null;
      const counts = [
        `${item.task_count ?? 0} ${t('project_management.cong_viec', 'công việc')}`,
        `${item.member_count ?? 0} ${t('project_management.thanh_vien', 'thành viên')}`,
      ].join(' · ');

      return (
        <ListRow
          title={item.title}
          subtitle={counts}
          icon="folder"
          status={
            roleInfo && role
              ? { label: t(i18nKey.role(role), roleInfo.label), tone: roleInfo.tone }
              : null
          }
          onPress={() => openProject(item)}
        />
      );
    },
    [openProject, t]
  );

  return (
    <ListScreen
      header={{
        title: t('project_management.title', 'Dự án'),
        align: 'left',
        onBack: () => navigation.goBack(),
      }}
      toolbar={
        <View style={{ paddingHorizontal: SCREEN_PADDING, gap: space[10] }}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={t('project_management.tim_du_an', 'Tìm dự án')}
          />
          {pendingInvites > 0 ? (
            <ListRow
              title={t('project_management.loi_moi_cho', 'Lời mời đang chờ')}
              subtitle={t(
                'project_management.loi_moi_cho_desc',
                'Có lời mời tham gia dự án cần bạn phản hồi'
              )}
              icon="bell"
              trailing={<Badge label={String(pendingInvites)} tone="brand" />}
              onPress={() => navigation.navigate(ROUTES.SCREENS.PM_INVITATIONS)}
            />
          ) : null}
        </View>
      }
    >
      <RefreshableList
        data={filtered}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        contentPadding={SCREEN_PADDING}
        empty={{
          icon: 'folder',
          title: error
            ? t('common.error', 'Đã có lỗi')
            : t('project_management.chua_co_du_an', 'Chưa có dự án nào'),
          description:
            error ??
            t(
              'project_management.chua_co_du_an_desc',
              'Bạn sẽ thấy dự án ở đây sau khi được mời tham gia.'
            ),
          actionLabel: t('common.retry', 'Thử lại'),
          onAction: () => load(true),
        }}
        header={
          error && filtered.length > 0 ? (
            <AppText variant="footnote" tone="danger">
              {error}
            </AppText>
          ) : null
        }
      />
    </ListScreen>
  );
};

export default PMProjectListScreen;
