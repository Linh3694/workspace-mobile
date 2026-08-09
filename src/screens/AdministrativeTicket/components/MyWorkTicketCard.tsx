import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';

import {
  getAdminTicketStatusLabel,
  getAdminTicketStatusColorClass,
  getAdminSubTaskStatusLabel,
  getAdminSubTaskStatusStyle,
} from '../../../config/administrativeTicketConstants';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import type {
  MyAdminSubTask,
  MyAdminSubTaskTicketGroup,
} from '../../../services/administrativeTicketService';

/** Số công việc con hiện sẵn trước khi phải bấm "Xem thêm". */
const VISIBLE_SUBTASK_LIMIT = 3;

interface MyWorkTicketCardProps {
  group: MyAdminSubTaskTicketGroup;
  /** Id công việc con đang chờ kết quả cập nhật (hiện spinner thay nhãn trạng thái). */
  pendingSubTaskId?: string | null;
  onPressSubTask: (subTask: MyAdminSubTask) => void;
  /** Bỏ trống => ẩn nút "Mở ticket" (user không có quyền đọc ticket cha, sẽ 403). */
  onOpenTicket?: (ticketId: string) => void;
}

/**
 * Một ticket hành chính có chứa công việc con được giao cho tôi.
 *
 * Các công việc con render thẳng trong thẻ chứ không giấu sau expand: ở đây chỉ có
 * subtask CỦA TÔI nên số lượng nhỏ, mà mục đích của tab là thấy được việc cần làm
 * với 0 thao tác.
 */
const MyWorkTicketCard: React.FC<MyWorkTicketCardProps> = ({
  group,
  pendingSubTaskId,
  onPressSubTask,
  onOpenTicket,
}) => {
  const [expanded, setExpanded] = useState(false);

  const allDone = group.openCount === 0;
  const visibleSubTasks =
    expanded || group.subTasks.length <= VISIBLE_SUBTASK_LIMIT
      ? group.subTasks
      : group.subTasks.slice(0, VISIBLE_SUBTASK_LIMIT);
  const hiddenCount = group.subTasks.length - visibleSubTasks.length;

  const renderSubTask = (task: MyAdminSubTask) => {
    // Không tái tạo quy tắc "In Progress đầu tiên = Đang xử lý, còn lại = Chờ xử lý"
    // của màn chi tiết: ở đây mảng đã bị lọc còn mỗi việc của tôi nên "đầu tiên"
    // không còn nghĩa là "việc đang được làm trên ticket".
    const { bgColor, textColor, textDecorationLine } = getAdminSubTaskStatusStyle(task.status);
    const isPending = pendingSubTaskId === task._id;

    return (
      <TouchableOpacity
        key={task._id}
        onPress={() => onPressSubTask(task)}
        disabled={isPending}
        style={{
          marginTop: 8,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: bgColor,
          opacity: isPending ? 0.6 : 1,
        }}>
        <View className="flex-row items-center justify-between">
          <Text
            className="mr-3 flex-1 text-base font-semibold"
            style={{ color: textColor, textDecorationLine }}
            numberOfLines={2}>
            {task.title}
          </Text>
          {isPending ? (
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            <View className="flex-row items-center">
              <Text className="text-sm font-semibold" style={{ color: textColor }}>
                {getAdminSubTaskStatusLabel(task.status)}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={textColor} style={{ marginLeft: 2 }} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="mb-3 rounded-xl bg-[#F8F8F8] p-4">
      {/* Ticket cha */}
      <Text className="text-lg font-medium text-[#E84A37]" numberOfLines={2}>
        {group.title}
      </Text>
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="mr-3 flex-1 text-sm font-medium text-gray-500" numberOfLines={1}>
          {group.ticketCode}
          {group.creator?.fullname
            ? ` · ${normalizeVietnameseName(group.creator.fullname)}`
            : ''}
        </Text>
        <View
          className={`${getAdminTicketStatusColorClass(group.status)} rounded-lg px-2.5 py-1`}
          style={{ flexShrink: 0 }}>
          <Text className="text-center text-sm font-medium text-white" numberOfLines={1}>
            {getAdminTicketStatusLabel(group.status) || group.status}
          </Text>
        </View>
      </View>

      {/* Tiến độ việc của tôi trong ticket này */}
      <View className="mt-2 flex-row">
        <View
          className="rounded-lg px-2.5 py-1"
          style={{ backgroundColor: allDone ? '#E4EFE6' : '#FDE8E1' }}>
          <Text
            className="text-sm font-semibold"
            style={{ color: allDone ? '#009483' : '#E84A37' }}>
            {allDone
              ? 'Đã xong việc của bạn'
              : `${group.openCount}/${group.totalCount} việc chưa xong`}
          </Text>
        </View>
      </View>

      {/* Công việc con của tôi */}
      {visibleSubTasks.map(renderSubTask)}

      {hiddenCount > 0 ? (
        <TouchableOpacity onPress={() => setExpanded(true)} className="mt-2 py-1">
          <Text className="text-sm font-medium text-[#002855]">Xem thêm {hiddenCount} việc</Text>
        </TouchableOpacity>
      ) : null}

      {onOpenTicket ? (
        <TouchableOpacity
          onPress={() => onOpenTicket(group._id)}
          className="mt-3 flex-row items-center">
          <Text className="text-sm font-medium text-[#002855]">Mở ticket</Text>
          <Ionicons name="chevron-forward" size={14} color="#002855" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default MyWorkTicketCard;
