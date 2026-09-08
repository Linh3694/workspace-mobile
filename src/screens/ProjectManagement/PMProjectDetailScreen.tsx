import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { Spinner } from '@atoms';
import { FilterChipRow, type FilterChipItem } from '@molecules';
import { EmptyState } from '@organisms';
import { ListScreen } from '@templates';

import { ROUTES } from '../../constants/routes';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getProject } from '../../services/projectManagementService';
import type { PMProject, PMTask } from '../../types/projectManagement';
import { EDIT_ROLES } from '../../types/projectManagement';
import { color, space } from '../../theme/tokens';
import PMKanbanTab from './PMKanbanTab';
import PMMembersTab from './PMMembersTab';
import {
  PMLogsTab,
  PMMeetingsTab,
  PMRequirementsTab,
  PMResourcesTab,
} from './PMSimpleTabs';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRoute = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.PM_PROJECT_DETAIL>;

/**
 * Các tab của một dự án. Thứ tự cố ý: Bảng đứng đầu vì đó là thứ người ta mở dự
 * án để xem; Nhật ký đứng cuối vì hầu như chỉ dùng khi đi truy vết.
 */
export type PMProjectTab =
  | 'board'
  | 'requirements'
  | 'meetings'
  | 'resources'
  | 'members'
  | 'logs';

/**
 * Khung chi tiết dự án: header + dải tab + vùng nội dung.
 *
 * Tab dựng bằng `FilterChipRow` (cuộn ngang, đã có sẵn) thay vì thêm thư viện
 * tab-view — sáu tab trên màn 375px không vừa một hàng cố định, mà chèn thêm một
 * dependency chỉ để cuộn ngang thì không đáng.
 *
 * Nội dung từng tab nạp LƯỜI: chỉ tab đang xem mới render. Nạp cả sáu là sáu
 * lượt gọi API mỗi lần mở một dự án, trong khi phần lớn phiên chỉ xem tab Bảng.
 */
const PMProjectDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<ScreenRoute>();
  const { t } = useTranslation();

  const projectId = route.params?.projectId ?? '';
  const [project, setProject] = useState<PMProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PMProjectTab>(route.params?.initialTab ?? 'board');

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!projectId) {
      setError('Thiếu mã dự án');
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await getProject(projectId);
    if (!mounted.current) return;
    if (res.success && res.data) {
      setProject(res.data);
      setError(null);
    } else {
      setError(res.message ?? 'Không tải được dự án');
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Quyền sửa suy từ vai trò của chính người đang xem. Backend vẫn chặn thật
   * (`check_task_permission`); đây chỉ để không hiện nút mà bấm vào chỉ nhận 403.
   */
  const canEdit = !!project?.current_user_role && EDIT_ROLES.includes(project.current_user_role);

  const tabs = useMemo<FilterChipItem<PMProjectTab>[]>(
    () => [
      { value: 'board', label: t('project_management.tab_bang', 'Bảng'), icon: 'layout' },
      {
        value: 'requirements',
        label: t('project_management.tab_yeu_cau', 'Yêu cầu'),
        icon: 'list',
      },
      { value: 'meetings', label: t('project_management.tab_hop', 'Họp'), icon: 'calendar' },
      {
        value: 'resources',
        label: t('project_management.tab_tai_lieu', 'Tài liệu'),
        icon: 'paperclip',
      },
      {
        value: 'members',
        label: t('project_management.tab_thanh_vien', 'Thành viên'),
        icon: 'users',
        count: project?.member_count,
      },
      { value: 'logs', label: t('project_management.tab_nhat_ky', 'Nhật ký'), icon: 'clock' },
    ],
    [project?.member_count, t]
  );

  const body = () => {
    if (loading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner />
        </View>
      );
    }
    if (error || !project) {
      return (
        <EmptyState
          icon="alert-circle"
          title={t('common.error', 'Đã có lỗi')}
          description={error ?? undefined}
          actionLabel={t('common.retry', 'Thử lại')}
          onAction={load}
        />
      );
    }

    if (tab === 'board') {
      return (
        <PMKanbanTab
          projectId={projectId}
          canEdit={canEdit}
          onOpenTask={(task: PMTask) =>
            navigation.navigate(ROUTES.SCREENS.PM_TASK_DETAIL, { taskId: task.name })
          }
        />
      );
    }

    if (tab === 'requirements') return <PMRequirementsTab projectId={projectId} />;
    if (tab === 'meetings') return <PMMeetingsTab projectId={projectId} />;
    if (tab === 'resources') return <PMResourcesTab projectId={projectId} />;
    if (tab === 'members')
      return <PMMembersTab projectId={projectId} myRole={project.current_user_role} />;
    return <PMLogsTab projectId={projectId} />;
  };

  return (
    <ListScreen
      header={{
        title: project?.title || route.params?.projectTitle || t('project_management.title', 'Dự án'),
        subtitle: project?.description || undefined,
        onBack: () => navigation.goBack(),
      }}
      toolbar={
        <View style={{ paddingBottom: space[4], borderBottomWidth: 1, borderBottomColor: color.line.subtle }}>
          {/* Chỉ định generic tường minh: truyền thẳng `setTab` thì TS suy T thành
              `string` và mất kiểu PMProjectTab. */}
          <FilterChipRow<PMProjectTab>
            items={tabs}
            value={tab}
            onChange={(next) => setTab(next)}
          />
        </View>
      }
    >
      {body()}
    </ListScreen>
  );
};

export default PMProjectDetailScreen;
