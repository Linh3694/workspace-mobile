import React from 'react';
import { View } from 'react-native';

import { AppText, Avatar, Card, Icon, IconButton } from '@atoms';
import { StatusBadge, resolveStatus } from '@molecules';

import type { PMTask } from '../../../types/projectManagement';
import { color, radius, space } from '../../../theme/tokens';
import { TASK_PRIORITY, TASK_TYPE, TASK_TYPE_ICON } from '../pmStatus';

/** Ngày ISO của hôm nay theo giờ máy — dùng để so hạn. */
const todayISO = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

/** `dd/MM` — đủ để liếc; năm chỉ thêm khi khác năm hiện tại. */
const formatDue = (due: string): string => {
  const [y, m, d] = due.slice(0, 10).split('-');
  if (!y || !m || !d) return due;
  const thisYear = String(new Date().getFullYear());
  return y === thisYear ? `${d}/${m}` : `${d}/${m}/${y}`;
};

export interface PMTaskCardProps {
  task: PMTask;
  onPress: () => void;
  /** Mở bảng chọn cột. Không truyền = ẩn nút (vai trò chỉ xem). */
  onMove?: () => void;
}

/**
 * Thẻ công việc trên bảng.
 *
 * So hạn bằng CHUỖI ngày `YYYY-MM-DD` chứ không dựng `Date`: `due_date` là
 * ngày-thuần, đưa qua `new Date()` là bị quy về UTC rồi lệch một ngày với máy ở
 * múi giờ dương — lỗi chỉ lộ ra ở đúng vài giờ trong ngày nên rất khó bắt.
 */
const PMTaskCard: React.FC<PMTaskCardProps> = ({ task, onPress, onMove }) => {
  const due = task.due_date?.slice(0, 10);
  const overdue = !!due && task.status !== 'done' && due < todayISO();
  const typeInfo = resolveStatus(task.type, TASK_TYPE);
  const assignees = task.assignees ?? [];
  const subtaskTotal = task.subtask_count ?? 0;

  return (
    <Card onPress={onPress} style={{ marginBottom: space[8] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6] }}>
        <Icon name={TASK_TYPE_ICON[task.type] ?? 'check-square'} size={14} colorOverride={typeInfo.tone === 'danger' ? color.danger.DEFAULT : undefined} />
        <AppText variant="caption" tone="description" style={{ flex: 1 }} numberOfLines={1}>
          {task.name}
        </AppText>
        <StatusBadge status={task.priority} map={TASK_PRIORITY} dot />
        {onMove ? (
          <IconButton
            name="more-horizontal"
            size={16}
            surface="none"
            tone="description"
            accessibilityLabel="Chuyển cột"
            onPress={onMove}
          />
        ) : null}
      </View>

      <AppText variant="headline" style={{ marginTop: space[6] }} numberOfLines={3}>
        {task.title}
      </AppText>

      {task.requirement_title ? (
        <View
          style={{
            marginTop: space[6],
            alignSelf: 'flex-start',
            paddingHorizontal: space[6],
            paddingVertical: space[2],
            borderRadius: radius[6],
            backgroundColor: color.surface.subtle,
          }}>
          <AppText variant="caption" tone="description" numberOfLines={1}>
            {task.requirement_title}
          </AppText>
        </View>
      ) : null}

      <View
        style={{
          marginTop: space[10],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[10],
        }}>
        {due ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <Icon name="calendar" size={13} tone={overdue ? 'danger' : 'description'} />
            <AppText variant="caption" tone={overdue ? 'danger' : 'description'}>
              {formatDue(due)}
            </AppText>
          </View>
        ) : null}

        {subtaskTotal > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <Icon name="check-square" size={13} tone="description" />
            <AppText variant="caption" tone="description">
              {task.subtask_done_count ?? 0}/{subtaskTotal}
            </AppText>
          </View>
        ) : null}

        {task.comment_count ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <Icon name="message-circle" size={13} tone="description" />
            <AppText variant="caption" tone="description">
              {task.comment_count}
            </AppText>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        {/* Tối đa 3 avatar rồi "+n": nhiều hơn là tràn ngang trên màn 375px. */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {assignees.slice(0, 3).map((a, i) => (
            <Avatar
              key={a.user_id}
              uri={a.user_image}
              name={a.full_name || a.user_id}
              size="sm"
              style={i > 0 ? { marginLeft: -space[6] } : undefined}
            />
          ))}
          {assignees.length > 3 ? (
            <AppText variant="caption" tone="description" style={{ marginLeft: space[4] }}>
              +{assignees.length - 3}
            </AppText>
          ) : null}
        </View>
      </View>
    </Card>
  );
};

export default PMTaskCard;
