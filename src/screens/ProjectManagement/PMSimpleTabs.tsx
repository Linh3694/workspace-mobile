import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { AppText } from '@atoms';
import { ListRow, resolveStatus } from '@molecules';
import { RefreshableList } from '@organisms';
import { SCREEN_PADDING } from '@templates';

import { ROUTES } from '../../constants/routes';
import { BASE_URL } from '../../config/constants';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  getMeetings,
  getProjectLogs,
  getRequirements,
  getResources,
} from '../../services/projectManagementService';
import type {
  PMChangeLog,
  PMMeeting,
  PMRequirement,
  PMResource,
  PMResult,
} from '../../types/projectManagement';
import { space } from '../../theme/tokens';
import { htmlToPlainText } from './pmText';
import { REQUIREMENT_STATUS, i18nKey } from './pmStatus';

/**
 * Bốn tab "chỉ đọc" của dự án dùng chung một khung: tải một danh sách, kéo để
 * làm mới, rỗng thì hiện trạng thái rỗng. Gom lại vì logic giống hệt nhau —
 * viết bốn màn riêng chỉ để đổi `renderItem` là bốn chỗ phải sửa khi đổi cách
 * xử lý lỗi.
 */
function useListTab<T>(fetcher: () => Promise<PMResult<T[]>>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetcher();
      if (!mounted.current) return;
      if (res.success) {
        setItems(res.data ?? []);
        setError(null);
      } else {
        setError(res.message ?? 'Không tải được dữ liệu');
      }
      setLoading(false);
      setRefreshing(false);
    },
    [fetcher]
  );

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, refreshing, error, load };
}

const formatDate = (value?: string): string => {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
};

const formatDateTime = (value?: string): string => {
  if (!value) return '';
  const [datePart, timePart = ''] = value.split(' ');
  return `${formatDate(datePart)}${timePart ? ` ${timePart.slice(0, 5)}` : ''}`;
};

/** `HH:mm` từ field Time — server trả dạng `HH:mm:ss`. */
const formatTime = (value?: string): string => (value ? value.slice(0, 5) : '');

// ==================== YÊU CẦU ====================

export const PMRequirementsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { t } = useTranslation();
  const fetcher = useCallback(() => getRequirements(projectId), [projectId]);
  const { items, loading, refreshing, error, load } = useListTab<PMRequirement>(fetcher);

  return (
    <RefreshableList
      data={items}
      keyExtractor={(item) => item.name}
      renderItem={({ item }) => {
        const status = resolveStatus(item.status, REQUIREMENT_STATUS);
        const done = item.completed_task_count ?? 0;
        const total = item.task_count ?? 0;
        return (
          <ListRow
            title={item.title}
            subtitle={
              [
                item.description ? htmlToPlainText(item.description, 80) : '',
                total ? `${done}/${total} ${t('project_management.cong_viec', 'công việc')}` : '',
              ]
                .filter(Boolean)
                .join(' · ') || null
            }
            icon="list"
            status={{
              label: t(i18nKey.requirementStatus(item.status), status.label),
              tone: status.tone,
            }}
          />
        );
      }}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => load(true)}
      contentPadding={SCREEN_PADDING}
      empty={{
        icon: 'list',
        title: error ? t('common.error', 'Đã có lỗi') : t('project_management.chua_co_yeu_cau', 'Chưa có yêu cầu nào'),
        description: error ?? undefined,
        actionLabel: t('common.retry', 'Thử lại'),
        onAction: () => load(true),
      }}
    />
  );
};

// ==================== CUỘC HỌP ====================

export const PMMeetingsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const fetcher = useCallback(() => getMeetings(projectId), [projectId]);
  const { items, loading, refreshing, error, load } = useListTab<PMMeeting>(fetcher);

  return (
    <RefreshableList
      data={items}
      keyExtractor={(item) => item.name}
      renderItem={({ item }) => (
        <ListRow
          title={item.title}
          subtitle={
            [formatDate(item.meeting_date), formatTime(item.start_time), item.location]
              .filter(Boolean)
              .join(' · ') || null
          }
          icon="calendar"
          trailing={
            item.attendees?.length ? (
              <AppText variant="caption" tone="description">
                {item.attendees.length} {t('project_management.nguoi', 'người')}
              </AppText>
            ) : undefined
          }
          onPress={() =>
            navigation.navigate(ROUTES.SCREENS.PM_MEETING_DETAIL, {
              meetingId: item.name,
              projectId,
            })
          }
        />
      )}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => load(true)}
      contentPadding={SCREEN_PADDING}
      empty={{
        icon: 'calendar',
        title: error ? t('common.error', 'Đã có lỗi') : t('project_management.chua_co_hop', 'Chưa có cuộc họp nào'),
        description: error ?? undefined,
        actionLabel: t('common.retry', 'Thử lại'),
        onAction: () => load(true),
      }}
    />
  );
};

// ==================== TÀI LIỆU ====================

const formatSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const PMResourcesTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { t } = useTranslation();
  const fetcher = useCallback(() => getResources(projectId), [projectId]);
  const { items, loading, refreshing, error, load } = useListTab<PMResource>(fetcher);

  /**
   * Mở tệp bằng trình xử lý của hệ điều hành.
   *
   * `file_url` do Frappe trả về là đường dẫn TƯƠNG ĐỐI (`/files/...`), phải ghép
   * `BASE_URL` — mở thẳng chuỗi đó thì `Linking` không hiểu và im lặng không làm gì.
   */
  const open = useCallback((resource: PMResource) => {
    const url = resource.file_url?.startsWith('http')
      ? resource.file_url
      : `${BASE_URL}${resource.file_url}`;
    Linking.openURL(url).catch(() => undefined);
  }, []);

  return (
    <RefreshableList
      data={items}
      keyExtractor={(item) => item.name}
      renderItem={({ item }) => (
        <ListRow
          title={item.filename}
          subtitle={
            [formatSize(item.file_size), item.uploaded_by_full_name, formatDate(item.creation)]
              .filter(Boolean)
              .join(' · ') || null
          }
          icon="paperclip"
          onPress={() => open(item)}
        />
      )}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => load(true)}
      contentPadding={SCREEN_PADDING}
      empty={{
        icon: 'paperclip',
        title: error ? t('common.error', 'Đã có lỗi') : t('project_management.chua_co_tai_lieu', 'Chưa có tài liệu nào'),
        description: error ?? undefined,
        actionLabel: t('common.retry', 'Thử lại'),
        onAction: () => load(true),
      }}
    />
  );
};

// ==================== NHẬT KÝ ====================

export const PMLogsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { t } = useTranslation();
  const fetcher = useCallback(() => getProjectLogs(projectId, 100), [projectId]);
  const { items, loading, refreshing, error, load } = useListTab<PMChangeLog>(fetcher);

  return (
    <RefreshableList
      data={items}
      keyExtractor={(item) => item.name}
      renderItem={({ item }) => (
        <View style={{ paddingVertical: space[8] }}>
          <AppText variant="footnote">
            {/* `description` do server dựng sẵn; chỉ khi thiếu mới rơi về mã hành động thô. */}
            {item.description || item.action}
          </AppText>
          <AppText variant="caption" tone="description" style={{ marginTop: space[2] }}>
            {[item.actor_full_name || item.actor_id, formatDateTime(item.creation)]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
      )}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => load(true)}
      contentPadding={SCREEN_PADDING}
      empty={{
        icon: 'clock',
        title: error ? t('common.error', 'Đã có lỗi') : t('project_management.chua_co_nhat_ky', 'Chưa có hoạt động nào'),
        description: error ?? undefined,
        actionLabel: t('common.retry', 'Thử lại'),
        onAction: () => load(true),
      }}
    />
  );
};
