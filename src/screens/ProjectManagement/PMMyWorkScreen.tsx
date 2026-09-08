import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { AppText } from '@atoms';
import { FilterChipRow, type FilterChipItem } from '@molecules';
import { RefreshableList } from '@organisms';
import { ListScreen, SCREEN_PADDING } from '@templates';

import { ROUTES } from '../../constants/routes';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getMyTasks } from '../../services/projectManagementService';
import type { PMTask } from '../../types/projectManagement';
import { space } from '../../theme/tokens';
import PMTaskCard from './components/PMTaskCard';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

/** Nhóm theo hạn, thứ tự cố định — Quá hạn luôn trên cùng. */
type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none';

const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'week', 'later', 'none'];

const BUCKET_LABEL: Record<Bucket, { key: string; fallback: string }> = {
  overdue: { key: 'project_management.nhom_qua_han', fallback: 'Quá hạn' },
  today: { key: 'project_management.nhom_hom_nay', fallback: 'Hôm nay' },
  week: { key: 'project_management.nhom_tuan_nay', fallback: 'Tuần này' },
  later: { key: 'project_management.nhom_sau_do', fallback: 'Sau đó' },
  none: { key: 'project_management.nhom_khong_han', fallback: 'Không có hạn' },
};

const isoDaysFromToday = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

/**
 * Xếp task vào nhóm theo hạn.
 *
 * So sánh trên CHUỖI `YYYY-MM-DD`, không dựng `Date`: `due_date` là ngày-thuần,
 * qua `new Date()` sẽ bị hiểu là UTC rồi lệch một ngày ở múi giờ dương.
 */
const bucketOf = (task: PMTask, today: string, weekEnd: string): Bucket => {
  const due = task.due_date?.slice(0, 10);
  if (!due) return 'none';
  if (due < today) return task.status === 'done' ? 'later' : 'overdue';
  if (due === today) return 'today';
  if (due <= weekEnd) return 'week';
  return 'later';
};

type Row = { kind: 'header'; bucket: Bucket; count: number } | { kind: 'task'; task: PMTask };

/**
 * "Công việc của tôi" — task được gán cho mình trên MỌI dự án.
 *
 * Trên điện thoại đây mới là màn người ta mở, không phải bảng của một dự án cụ
 * thể: câu hỏi thường trực là "hôm nay tôi phải làm gì", không phải "dự án X
 * đang ở đâu". Cũng là màn đích của `pm_task_due_soon` / `pm_task_overdue` khi
 * thông báo không kèm `taskId`.
 */
const PMMyWorkScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { t } = useTranslation();

  const [tasks, setTasks] = useState<PMTask[]>([]);
  const [projects, setProjects] = useState<{ name: string; title: string }[]>([]);
  const [projectFilter, setProjectFilter] = useState('all');
  const [showDone, setShowDone] = useState(false);
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

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const res = await getMyTasks();
    if (!mounted.current) return;

    if (res.success && res.data) {
      setTasks(res.data.tasks ?? []);
      setProjects(res.data.projects ?? []);
      setError(null);
    } else {
      setError(res.message ?? 'Không tải được danh sách công việc');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const rows = useMemo<Row[]>(() => {
    const today = isoDaysFromToday(0);
    const weekEnd = isoDaysFromToday(7);

    const pool = tasks.filter((task) => {
      if (!showDone && task.status === 'done') return false;
      if (projectFilter !== 'all' && task.project_id !== projectFilter) return false;
      return true;
    });

    const byBucket = new Map<Bucket, PMTask[]>();
    pool.forEach((task) => {
      const b = bucketOf(task, today, weekEnd);
      const list = byBucket.get(b) ?? [];
      list.push(task);
      byBucket.set(b, list);
    });

    const out: Row[] = [];
    BUCKET_ORDER.forEach((b) => {
      const list = byBucket.get(b);
      if (!list?.length) return;
      list.sort((a, z) => (a.due_date ?? '9999').localeCompare(z.due_date ?? '9999'));
      out.push({ kind: 'header', bucket: b, count: list.length });
      list.forEach((task) => out.push({ kind: 'task', task }));
    });
    return out;
  }, [tasks, projectFilter, showDone]);

  const projectChips = useMemo<FilterChipItem<string>[]>(
    () => [
      { value: 'all', label: t('common.all', 'Tất cả') },
      ...projects.map((p) => ({ value: p.name, label: p.title })),
    ],
    [projects, t]
  );

  return (
    <ListScreen
      header={{
        title: t('project_management.cong_viec_cua_toi', 'Công việc của tôi'),
        align: 'left',
        onBack: () => navigation.goBack(),
        action: (
          <AppText
            variant="footnote"
            tone={showDone ? 'brand' : 'description'}
            onPress={() => setShowDone((v) => !v)}>
            {showDone
              ? t('project_management.an_hoan_thanh', 'Ẩn xong')
              : t('project_management.hien_hoan_thanh', 'Hiện xong')}
          </AppText>
        ),
      }}
      toolbar={
        projects.length > 1 ? (
          <FilterChipRow<string>
            items={projectChips}
            value={projectFilter}
            onChange={setProjectFilter}
          />
        ) : undefined
      }>
      <RefreshableList
        data={rows}
        keyExtractor={(row, i) => (row.kind === 'task' ? row.task.name : `h-${row.bucket}-${i}`)}
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <View style={{ paddingTop: space[12], paddingBottom: space[6] }}>
              <AppText variant="footnote" tone={item.bucket === 'overdue' ? 'danger' : 'description'}>
                {t(BUCKET_LABEL[item.bucket].key, BUCKET_LABEL[item.bucket].fallback)} ({item.count})
              </AppText>
            </View>
          ) : (
            <PMTaskCard
              task={item.task}
              onPress={() =>
                navigation.navigate(ROUTES.SCREENS.PM_TASK_DETAIL, { taskId: item.task.name })
              }
            />
          )
        }
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        contentPadding={SCREEN_PADDING}
        empty={{
          icon: 'check-circle',
          title: error
            ? t('common.error', 'Đã có lỗi')
            : t('project_management.khong_co_viec', 'Không có việc nào'),
          description:
            error ??
            t('project_management.khong_co_viec_desc', 'Việc được giao cho bạn sẽ hiện ở đây.'),
          actionLabel: t('common.retry', 'Thử lại'),
          onAction: () => load(true),
        }}
      />
    </ListScreen>
  );
};

export default PMMyWorkScreen;
