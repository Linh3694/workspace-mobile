import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, ButtonGhost } from '@atoms';
import { FilterChipRow, type FilterChipItem } from '@molecules';
import { AppSheet, EmptyState, RefreshableList, useSheetQueue } from '@organisms';
import { SCREEN_PADDING } from '@templates';

import { getBoardTasks, moveTask } from '../../services/projectManagementService';
import type { PMTask, TaskStatus, TasksByStatus } from '../../types/projectManagement';
import { emptyTasksByStatus } from '../../types/projectManagement';
import { color, radius, space } from '../../theme/tokens';
import PMTaskCard from './components/PMTaskCard';
import { BOARD_COLUMN_ORDER, TASK_STATUS, i18nKey } from './pmStatus';

export interface PMKanbanTabProps {
  projectId: string;
  /** Vai trò không đủ quyền sửa → ẩn nút chuyển cột, vẫn xem được. */
  canEdit: boolean;
  onOpenTask: (task: PMTask) => void;
}

/**
 * Bảng công việc của một dự án.
 *
 * KHÔNG kéo-thả giữa các cột (quyết định 08/09/2026). Năm cột trên màn 375px
 * biến thao tác kéo thành trò may rủi: thả trượt một cột là đổi nhầm trạng thái
 * việc của người khác, và không có nút hoàn tác. Thay bằng: vuốt ngang để đổi
 * cột đang xem, chọn cột đích trong bảng chọn mở từ thẻ.
 *
 * Cột dựng bằng `FlatList` `pagingEnabled` — không thêm thư viện pager cho một
 * hành vi mà nền tảng đã có sẵn.
 */
const PMKanbanTab: React.FC<PMKanbanTabProps> = ({ projectId, canEdit, onOpenTask }) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const sheet = useSheetQueue<'move'>();

  const [grouped, setGrouped] = useState<TasksByStatus>(emptyTasksByStatus());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [column, setColumn] = useState<TaskStatus>('todo');
  const [moving, setMoving] = useState<PMTask | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  const pagerRef = useRef<FlatList<TaskStatus>>(null);
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

      const res = await getBoardTasks(projectId);
      if (!mounted.current) return;

      if (res.success && res.data) {
        setGrouped({ ...emptyTasksByStatus(), ...res.data.grouped });
        setError(null);
      } else {
        setError(res.message ?? 'Không tải được bảng công việc');
      }
      setLoading(false);
      setRefreshing(false);
    },
    [projectId]
  );

  useEffect(() => {
    load();
  }, [load]);

  /** Người được gán, gom từ mọi cột — nguồn cho dải chip lọc. */
  const assignees = useMemo(() => {
    const seen = new Map<string, string>();
    BOARD_COLUMN_ORDER.forEach((s) =>
      (grouped[s] ?? []).forEach((task) =>
        (task.assignees ?? []).forEach((a) => {
          if (!seen.has(a.user_id)) seen.set(a.user_id, a.full_name || a.user_id);
        })
      )
    );
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [grouped]);

  const visible = useMemo(() => {
    if (assigneeFilter === 'all') return grouped;
    const out = emptyTasksByStatus();
    BOARD_COLUMN_ORDER.forEach((s) => {
      out[s] = (grouped[s] ?? []).filter((task) =>
        assigneeFilter === 'none'
          ? !task.assignees?.length
          : task.assignees?.some((a) => a.user_id === assigneeFilter)
      );
    });
    return out;
  }, [grouped, assigneeFilter]);

  const columnChips = useMemo<FilterChipItem<TaskStatus>[]>(
    () =>
      BOARD_COLUMN_ORDER.map((s) => ({
        value: s,
        label: t(i18nKey.taskStatus(s), TASK_STATUS[s]?.label ?? s),
        count: visible[s]?.length ?? 0,
      })),
    [visible, t]
  );

  const assigneeChips = useMemo<FilterChipItem<string>[]>(
    () => [
      { value: 'all', label: t('common.all', 'Tất cả') },
      ...assignees.map((a) => ({ value: a.value, label: a.label })),
      { value: 'none', label: t('project_management.chua_giao', 'Chưa giao') },
    ],
    [assignees, t]
  );

  /** Đổi cột đang xem: cập nhật state VÀ cuộn pager, để chip và trang không lệch nhau. */
  const goToColumn = useCallback(
    (next: TaskStatus) => {
      setColumn(next);
      const index = BOARD_COLUMN_ORDER.indexOf(next);
      if (index >= 0) pagerRef.current?.scrollToIndex({ index, animated: true });
    },
    []
  );

  /**
   * Chuyển task sang cột khác.
   *
   * Dùng `moveTask` chứ KHÔNG phải `updateTask({status})`: chỉ `move_task` mới
   * phân biệt được "đổi cột" với "sắp xếp lại trong cùng cột", nên chỉ nó bắn
   * đúng một thông báo `pm_task_status_changed`.
   *
   * Cập nhật lạc quan rồi tải lại: `order_index` do server quyết định, đoán ở
   * client sẽ lệch thứ tự ngay lần kéo sau.
   */
  const doMove = useCallback(
    async (task: PMTask, to: TaskStatus) => {
      sheet.close();
      if (to === task.status) return;

      setGrouped((prev) => {
        const next = { ...prev };
        next[task.status] = (prev[task.status] ?? []).filter((x) => x.name !== task.name);
        next[to] = [{ ...task, status: to }, ...(prev[to] ?? [])];
        return next;
      });

      const res = await moveTask({
        task_id: task.name,
        from_status: task.status,
        to_status: to,
        new_order_index: 0,
      });
      if (!mounted.current) return;

      if (!res.success) {
        Alert.alert(
          t('common.error', 'Đã có lỗi'),
          res.message ?? t('common.try_again', 'Vui lòng thử lại')
        );
      }
      load(true);
    },
    [load, sheet, t]
  );

  const renderColumn = useCallback(
    ({ item: status }: { item: TaskStatus }) => (
      <View style={{ width }}>
        <RefreshableList
          data={visible[status] ?? []}
          keyExtractor={(task) => task.name}
          renderItem={({ item }) => (
            <PMTaskCard
              task={item}
              onPress={() => onOpenTask(item)}
              onMove={
                canEdit
                  ? () => {
                      setMoving(item);
                      sheet.open('move');
                    }
                  : undefined
              }
            />
          )}
          refreshing={refreshing}
          onRefresh={() => load(true)}
          contentPadding={SCREEN_PADDING}
          empty={{
            icon: 'inbox',
            title: t('project_management.cot_trong', 'Cột này đang trống'),
          }}
        />
      </View>
    ),
    [visible, width, refreshing, load, onOpenTask, canEdit, sheet, t]
  );

  if (loading) {
    return (
      <View style={{ flex: 1, paddingTop: space[24] }}>
        <RefreshableList data={[]} keyExtractor={() => ''} renderItem={() => null} loading />
      </View>
    );
  }

  if (error) {
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
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: space[8], gap: space[8] }}>
        <FilterChipRow<TaskStatus>
          items={columnChips}
          value={column}
          onChange={goToColumn}
          tone="brand"
        />
        {assignees.length > 0 ? (
          <FilterChipRow<string>
            items={assigneeChips}
            value={assigneeFilter}
            onChange={setAssigneeFilter}
          />
        ) : null}
      </View>

      <FlatList
        ref={pagerRef}
        data={BOARD_COLUMN_ORDER as TaskStatus[]}
        keyExtractor={(s) => s}
        renderItem={renderColumn}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // Bắt buộc khi dùng scrollToIndex trên danh sách ngang: không có nó thì
        // RN phải đo từng trang và scrollToIndex ném lỗi khi trang chưa render.
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          const next = BOARD_COLUMN_ORDER[index];
          if (next && next !== column) setColumn(next);
        }}
        style={{ flex: 1 }}
      />

      <AppSheet
        visible={sheet.isOpen('move')}
        onClose={sheet.close}
        onClosed={sheet.handleClosed}
        title={t('project_management.chuyen_cot', 'Chuyển cột')}>
        <View style={{ gap: space[4] }}>
          {moving ? (
            <AppText variant="footnote" tone="description" style={{ marginBottom: space[4] }}>
              {moving.title}
            </AppText>
          ) : null}
          {BOARD_COLUMN_ORDER.map((s) => {
            const active = moving?.status === s;
            return (
              <View
                key={s}
                style={{
                  borderRadius: radius[12],
                  backgroundColor: active ? color.surface.subtle : 'transparent',
                }}>
                <ButtonGhost
                  label={t(i18nKey.taskStatus(s), TASK_STATUS[s]?.label ?? s)}
                  block
                  onPress={() => (moving ? doMove(moving, s) : undefined)}
                />
              </View>
            );
          })}
        </View>
      </AppSheet>
    </View>
  );
};

export default PMKanbanTab;
