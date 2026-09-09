import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, ButtonGhost, Icon, Spinner } from '@atoms';
import { FilterChipRow, type FilterChipItem } from '@molecules';
import { AppSheet, EmptyState, useSheetQueue } from '@organisms';
import { SCREEN_PADDING } from '@templates';

import { getBoardTasks, moveTask } from '../../services/projectManagementService';
import type { PMTask, TaskStatus, TasksByStatus } from '../../types/projectManagement';
import { emptyTasksByStatus } from '../../types/projectManagement';
import { color, radius, space } from '../../theme/tokens';
import PMAddTaskSheet from './components/PMAddTaskSheet';
import PMTaskCard from './components/PMTaskCard';
import { BOARD_COLUMN_ORDER, TASK_STATUS, i18nKey, toneColor } from './pmStatus';

/**
 * Bề ngang một cột. 280 là con số của `BoardColumn` bên Cloud V: trên màn 402pt
 * nó chừa lại ~100pt cho cột kế — vừa đủ để mắt biết còn cột nữa mà không phải
 * vuốt thử. Đổi số này là mất luôn tín hiệu đó.
 */
const COLUMN_WIDTH = 280;

export interface PMKanbanTabProps {
  projectId: string;
  /** Vai trò không đủ quyền sửa → ẩn nút chuyển cột và nút thêm, vẫn xem được. */
  canEdit: boolean;
  onOpenTask: (task: PMTask) => void;
}

/**
 * Bảng công việc của một dự án — dựng theo khuôn `PlanBoardView` của Cloud V.
 *
 * Cấu trúc: một trang cuộn DỌC, bên trong là dải cuộn NGANG các cột rộng cố
 * định. Không phân trang từng cột: cuộn tự do nên lúc nào cũng thấy hé cột bên
 * cạnh, và người dùng không phải đoán còn bao nhiêu cột nữa. (Bản trước dùng
 * `pagingEnabled` — mỗi lần chỉ thấy đúng một cột, nhìn như app chỉ có một danh
 * sách.)
 *
 * KHÔNG kéo-thả giữa các cột — giống Cloud V, vốn tắt hẳn drag-and-drop trên
 * mobile. Năm cột trên màn hẹp biến thao tác kéo thành trò may rủi: thả trượt
 * một cột là đổi nhầm trạng thái việc của người khác, mà không có nút hoàn tác.
 * Đổi cột đi qua bảng chọn mở từ thẻ.
 */
const PMKanbanTab: React.FC<PMKanbanTabProps> = ({ projectId, canEdit, onOpenTask }) => {
  const { t } = useTranslation();
  const sheet = useSheetQueue<'move' | 'add'>();

  const [grouped, setGrouped] = useState<TasksByStatus>(emptyTasksByStatus());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<PMTask | null>(null);
  const [addingTo, setAddingTo] = useState<TaskStatus>('todo');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

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

  const assigneeChips = useMemo<FilterChipItem<string>[]>(
    () => [
      { value: 'all', label: t('common.all', 'Tất cả') },
      ...assignees.map((a) => ({ value: a.value, label: a.label })),
      { value: 'none', label: t('project_management.chua_giao', 'Chưa giao') },
    ],
    [assignees, t]
  );

  /**
   * Chuyển task sang cột khác.
   *
   * Dùng `moveTask` chứ KHÔNG phải `updateTask({status})`: chỉ `move_task` mới
   * phân biệt được "đổi cột" với "sắp xếp lại trong cùng cột", nên chỉ nó bắn
   * đúng một thông báo `pm_task_status_changed`.
   *
   * Cập nhật lạc quan rồi tải lại: `order_index` do server quyết định, đoán ở
   * client sẽ lệch thứ tự ngay lần sau.
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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </View>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="issue"
        title={t('common.error', 'Đã có lỗi')}
        description={error}
        actionLabel={t('common.retry', 'Thử lại')}
        onAction={() => load()}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {assignees.length > 0 ? (
        <View style={{ paddingTop: space[8], paddingBottom: space[4] }}>
          <FilterChipRow<string>
            items={assigneeChips}
            value={assigneeFilter}
            onChange={setAssigneeFilter}
          />
        </View>
      ) : null}

      {/* Cuộn dọc bọc ngoài, dải cột cuộn ngang bên trong — đúng thứ tự lồng của
          `PlanBoardView`: cột nào dài thì cả trang cuộn theo, không cuộn riêng. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={{ paddingBottom: space[32] }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: SCREEN_PADDING,
            paddingTop: space[8],
            gap: space[12],
            // Cột co theo nội dung, không kéo dài bằng cột cao nhất — tương
            // đương `HStack(alignment: .top)` của Cloud V. Mặc định của RN là
            // 'stretch', khiến cột trống cũng cao bằng cột dài nhất.
            alignItems: 'flex-start',
          }}>
          {BOARD_COLUMN_ORDER.map((status) => {
            const tasks = visible[status] ?? [];
            const info = TASK_STATUS[status];
            const tint = toneColor(info?.tone);

            return (
              <View
                key={status}
                style={{
                  width: COLUMN_WIDTH,
                  borderRadius: radius[24],
                  borderWidth: 1,
                  borderColor: color.line.subtle,
                  backgroundColor: color.surface.subtle,
                  overflow: 'hidden',
                }}>
                {/* Header hai dòng: số lượng ở trên, tên cột + chấm màu ở dưới */}
                <View style={{ paddingHorizontal: space[16], paddingVertical: space[12] }}>
                  <AppText variant="caption" tone="description">
                    {tasks.length} {t('project_management.cong_viec', 'công việc')}
                  </AppText>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[8],
                      marginTop: space[2],
                    }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: radius.full,
                        backgroundColor: tint,
                      }}
                    />
                    <AppText variant="title3" tone="emphasized">
                      {t(i18nKey.taskStatus(status), info?.label ?? status)}
                    </AppText>
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: color.line.subtle }} />

                <View style={{ padding: space[12], minHeight: 120 }}>
                  {tasks.map((task) => (
                    <PMTaskCard
                      key={task.name}
                      task={task}
                      onPress={() => onOpenTask(task)}
                      onMove={
                        canEdit
                          ? () => {
                              setMoving(task);
                              sheet.open('move');
                            }
                          : undefined
                      }
                    />
                  ))}

                  {/* Nút thêm viền đứt cuối mỗi cột — `DashedAddButton` của Cloud V.
                      Task tạo ra rơi thẳng vào cột này, không phải kéo lại. */}
                  {canEdit ? (
                    <View
                      style={{
                        borderRadius: radius[16],
                        borderWidth: 2,
                        borderStyle: 'dashed',
                        borderColor: color.line.subtle,
                      }}>
                      <ButtonGhost
                        label={t('project_management.them_cong_viec', 'Thêm công việc')}
                        icon="plus"
                        block
                        onPress={() => {
                          setAddingTo(status);
                          sheet.open('add');
                        }}
                      />
                    </View>
                  ) : tasks.length === 0 ? (
                    <View
                      style={{ alignItems: 'center', paddingVertical: space[16], gap: space[6] }}>
                      <Icon name="board" size={20} tone="disabled" />
                      <AppText variant="caption" tone="disabled">
                        {t('project_management.cot_trong', 'Cột này đang trống')}
                      </AppText>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </ScrollView>

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
          {BOARD_COLUMN_ORDER.map((s) => (
            <View
              key={s}
              style={{
                borderRadius: radius[12],
                backgroundColor: moving?.status === s ? color.surface.subtle : 'transparent',
              }}>
              <ButtonGhost
                label={t(i18nKey.taskStatus(s), TASK_STATUS[s]?.label ?? s)}
                block
                onPress={() => (moving ? doMove(moving, s) : undefined)}
              />
            </View>
          ))}
        </View>
      </AppSheet>

      <PMAddTaskSheet
        visible={sheet.isOpen('add')}
        projectId={projectId}
        status={addingTo}
        onClose={sheet.close}
        onClosed={sheet.handleClosed}
        onCreated={() => load(true)}
      />
    </View>
  );
};

export default PMKanbanTab;
