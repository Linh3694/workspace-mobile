import React from 'react';
import { View } from 'react-native';

import { AppText, Avatar, Card, Icon, IconButton } from '@atoms';

import { resolveFileUrl } from '../../../services/projectManagementService';
import type { PMTask } from '../../../types/projectManagement';
import { color, radius, space } from '../../../theme/tokens';
import { TASK_PRIORITY, TASK_TYPE, TASK_TYPE_ICON, toneColor } from '../pmStatus';

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

/** Chip nhỏ trong thân thẻ — nền nhạt cùng màu chữ, giống chip tag của Cloud V. */
const Chip: React.FC<{ label: string; tint: string }> = ({ label, tint }) => (
  <View
    style={{
      paddingHorizontal: space[8],
      paddingVertical: space[2],
      borderRadius: radius[6],
      backgroundColor: `${tint}14`,
    }}>
    <AppText variant="caption" style={{ color: tint }} numberOfLines={1}>
      {label}
    </AppText>
  </View>
);

/** Cụm icon + số ở chân thẻ. */
const Meta: React.FC<{ icon: string; label: string; danger?: boolean }> = ({
  icon,
  label,
  danger,
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
    <Icon name={icon} size={13} tone={danger ? 'danger' : 'description'} />
    <AppText variant="caption" tone={danger ? 'danger' : 'description'}>
      {label}
    </AppText>
  </View>
);

export interface PMTaskCardProps {
  task: PMTask;
  onPress: () => void;
  /** Mở bảng chọn cột. Không truyền = ẩn nút (vai trò chỉ xem). */
  onMove?: () => void;
}

/**
 * Thẻ công việc trên bảng — theo khuôn `BoardItem` của Cloud V:
 * dòng meta mờ ở trên, tiêu đề, dải chip, một đường kẻ mảnh, rồi hàng chân thẻ
 * (số liệu bên trái · người thực hiện bên phải).
 *
 * So hạn bằng CHUỖI ngày `YYYY-MM-DD` chứ không dựng `Date`: `due_date` là
 * ngày-thuần, đưa qua `new Date()` là bị quy về UTC rồi lệch một ngày với máy ở
 * múi giờ dương — lỗi chỉ lộ ra ở đúng vài giờ trong ngày nên rất khó bắt.
 */
const PMTaskCard: React.FC<PMTaskCardProps> = ({ task, onPress, onMove }) => {
  const due = task.due_date?.slice(0, 10);
  const overdue = !!due && task.status !== 'done' && due < todayISO();
  const typeInfo = TASK_TYPE[task.type];
  const priorityInfo = TASK_PRIORITY[task.priority];
  const assignees = task.assignees ?? [];
  const subtaskTotal = task.subtask_count ?? 0;

  return (
    <Card padding={space[16]} style={{ marginBottom: space[10] }}>
      {/* Dòng meta: loại + mã task, và nút chuyển cột nếu có quyền */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name={TASK_TYPE_ICON[task.type] ?? 'list-check'} size={13} tone="description" />
        <AppText
          variant="caption"
          tone="description"
          style={{ flex: 1, marginLeft: space[6] }}
          numberOfLines={1}>
          {task.name}
        </AppText>
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

      <View style={{ height: space[8] }} />

      <AppText variant="headline" tone="emphasized" numberOfLines={3} onPress={onPress}>
        {task.title}
      </AppText>

      <View style={{ height: space[10] }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6], flexWrap: 'wrap' }}>
        <Chip label={typeInfo?.label ?? task.type} tint={toneColor(typeInfo?.tone)} />
        <Chip label={priorityInfo?.label ?? task.priority} tint={toneColor(priorityInfo?.tone)} />
        {task.requirement_title ? (
          <Chip label={task.requirement_title} tint={color.neutral[500]} />
        ) : null}
      </View>

      <View
        style={{
          height: 1,
          backgroundColor: color.line.subtle,
          marginTop: space[12],
          marginBottom: space[8],
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[10] }}>
        {due ? <Meta icon="calendar" label={formatDue(due)} danger={overdue} /> : null}
        {subtaskTotal > 0 ? (
          <Meta icon="list-check" label={`${task.subtask_done_count ?? 0}/${subtaskTotal}`} />
        ) : null}
        {task.comment_count ? <Meta icon="chat" label={String(task.comment_count)} /> : null}

        <View style={{ flex: 1 }} />

        {/* Tối đa 3 avatar rồi "+n": nhiều hơn là tràn ngang trong cột 280pt. */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {assignees.slice(0, 3).map((a, i) => (
            <Avatar
              key={a.user_id}
              uri={resolveFileUrl(a.user_image)}
              name={a.full_name || a.user_id}
              size="sm"
              style={i > 0 ? { marginLeft: -space[8] } : undefined}
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
