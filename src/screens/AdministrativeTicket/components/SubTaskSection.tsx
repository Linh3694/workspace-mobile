import React, { useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TextInput, Alert } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';

// Store & Hooks
import {
  useAdministrativeTicketStore,
  useAdministrativeTicketData,
  useAdministrativeTicketActions,
  useAdministrativeTicketUIActions,
  useAdministrativeTicketSubTasks,
} from '../../../hooks/useAdministrativeTicketStore';

// Auth
import { useAuth } from '../../../context/AuthContext';

// Utils
import { toast } from '../../../utils/toast';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import {
  ADMIN_SUBTASK_QUEUED_LABEL,
  ADMIN_SUBTASK_QUEUED_STYLE,
  getAdminSubTaskStatusLabel,
  getAdminSubTaskStatusStyle,
} from '../../../config/administrativeTicketConstants';

// Components
import { SubTaskStatusSheet, SubTaskAssigneeModal, AssigneeSearchSheet } from './TicketModals';

import type {
  AdminSubTask,
  AdministrativeSupportMember,
} from '../../../services/administrativeTicketService';
import type { AdministrativeSubTaskStatusUi } from '../../../hooks/useAdministrativeTicketStore';

interface SubTaskSectionProps {
  /** Tiêu đề thẻ — mặc định "Danh sách công việc". */
  title?: string;
}

/**
 * Khu vực quản lý công việc con (subtask) cho ticket hành chính.
 * Dùng chung cho cả màn người xử lý (TicketProcessing) và màn người tạo
 * khi họ là CBNV hỗ trợ (TicketProcessingGuest) — khớp web: section hiện theo
 * vai trò chứ không theo người tạo ticket.
 */
const SubTaskSection: React.FC<SubTaskSectionProps> = ({ title = 'Danh sách công việc' }) => {
  const [showAddSubTask, setShowAddSubTask] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [newSubTaskAssignee, setNewSubTaskAssignee] = useState<AdministrativeSupportMember | null>(
    null
  );
  // Picker người xử lý cho form thêm công việc con (search dropdown).
  const [showAddAssigneePicker, setShowAddAssigneePicker] = useState(false);

  const { user } = useAuth();
  const { ticket } = useAdministrativeTicketData();
  const { subTasks } = useAdministrativeTicketSubTasks();
  const { addSubTask, updateSubTaskStatus, updateSubTaskAssignee, deleteSubTask } =
    useAdministrativeTicketActions();
  const { openSubTaskStatusModal, openSubTaskAssignModal, closeSubTaskStatusModal } =
    useAdministrativeTicketUIActions();
  const actionLoading = useAdministrativeTicketStore((state) => state.actionLoading);
  const ui = useAdministrativeTicketStore((state) => state.ui);

  // Quyền đánh dấu hoàn thành công việc con: PIC subtask / PIC ticket / System Manager.
  const currentEmail = (user?.email || '').trim().toLowerCase();
  const isSystemManager = Array.isArray(user?.roles) && user.roles.includes('System Manager');
  const ticketPicEmail = (ticket?.assignedTo?.email || '').trim().toLowerCase();
  const canCompleteSubTask = useCallback(
    (task: AdminSubTask) => {
      if (isSystemManager) return true;
      if (!currentEmail) return false;
      const subPic = (task.assignedTo?.email || '').trim().toLowerCase();
      return currentEmail === subPic || currentEmail === ticketPicEmail;
    },
    [isSystemManager, currentEmail, ticketPicEmail]
  );

  // Mở form thêm công việc con (danh sách người xử lý do AssigneeSearchSheet tự nạp khi mở).
  const openAddSubTask = () => {
    setShowAddSubTask(true);
  };

  const handleAddSubTask = async () => {
    if (!newSubTaskTitle.trim()) {
      toast.error('Tiêu đề không được để trống');
      return;
    }

    const success = await addSubTask(newSubTaskTitle, newSubTaskAssignee?._id);
    if (success) {
      setNewSubTaskTitle('');
      setNewSubTaskAssignee(null);
      setShowAddSubTask(false);
      toast.success('Thêm thành công!');
    } else {
      toast.error('Lỗi thêm subtask');
    }
  };

  const handleUpdateSubTaskStatus = async (subTaskId: string, newStatus: string) => {
    if (newStatus === 'Completed') {
      const task = subTasks.find((t) => t._id === subTaskId);
      if (task && !canCompleteSubTask(task)) {
        toast.error(
          'Chỉ người thực hiện công việc con hoặc người xử lý ticket mới được đánh dấu hoàn thành'
        );
        return;
      }
    }
    const success = await updateSubTaskStatus(
      subTaskId,
      newStatus as AdministrativeSubTaskStatusUi
    );
    if (success) {
      toast.success('Cập nhật thành công!');
    } else {
      toast.error('Lỗi cập nhật subtask');
    }
  };

  const handleSubTaskPress = (task: AdminSubTask) => {
    openSubTaskStatusModal(task);
  };

  // Mở picker đổi người xử lý cho công việc con đang chọn.
  // Đóng sheet trạng thái trước rồi mới mở modal đổi người sau khi animation dismiss xong —
  // iOS không cho present modal mới khi modal trước còn đang đóng (nếu mở cùng lúc sẽ "không chạy").
  const handleReassignSubTask = () => {
    const task = ui.selectedSubTask;
    if (!task) return;
    closeSubTaskStatusModal();
    setTimeout(() => openSubTaskAssignModal(task), 320);
  };

  const handleSelectSubTaskAssignee = async (member: AdministrativeSupportMember) => {
    const task = ui.selectedSubTask;
    if (!task) return;
    const success = await updateSubTaskAssignee(task._id, member._id);
    useAdministrativeTicketStore.getState().closeSubTaskAssignModal();
    toast[success ? 'success' : 'error'](success ? 'Đã đổi người xử lý' : 'Lỗi đổi người xử lý');
  };

  const handleUnassignSubTask = async () => {
    const task = ui.selectedSubTask;
    if (!task) return;
    const success = await updateSubTaskAssignee(task._id, '');
    useAdministrativeTicketStore.getState().closeSubTaskAssignModal();
    toast[success ? 'success' : 'error'](success ? 'Đã bỏ gán người xử lý' : 'Lỗi cập nhật');
  };

  const handleDeleteSubTask = () => {
    const task = ui.selectedSubTask;
    if (!task) return;
    const subTaskId = task._id;
    const subTaskTitle = task.title;
    useAdministrativeTicketStore.getState().closeSubTaskStatusModal();
    Alert.alert('Xoá công việc con', `Xoá "${subTaskTitle}"?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          const success = await deleteSubTask(subTaskId);
          toast[success ? 'success' : 'error'](
            success ? 'Đã xoá công việc con' : 'Lỗi xoá subtask'
          );
        },
      },
    ]);
  };

  const renderSubTask = (task: AdminSubTask) => {
    const inProgressTasks = subTasks.filter((t) => t.status === 'In Progress');
    const isFirstInProgress = inProgressTasks.length > 0 && inProgressTasks[0]._id === task._id;

    // Style theo trạng thái, rồi đè bằng style "xếp hàng chờ" cho các subtask
    // In Progress không phải cái đầu tiên — đây là thông tin vị trí trong hàng đợi
    // của riêng ticket này nên nó nằm ở đây chứ không nằm trong helper chung.
    const isQueued = task.status === 'In Progress' && !isFirstInProgress;
    const { bgColor, textColor, textDecorationLine } = isQueued
      ? ADMIN_SUBTASK_QUEUED_STYLE
      : getAdminSubTaskStatusStyle(task.status);
    const statusLabel = isQueued
      ? ADMIN_SUBTASK_QUEUED_LABEL
      : getAdminSubTaskStatusLabel(task.status);

    return (
      <TouchableOpacity
        key={task._id}
        onPress={() => handleSubTaskPress(task)}
        style={{
          marginBottom: 10,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: bgColor,
        }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <Text className="text-lg font-semibold" style={{ color: textColor, textDecorationLine }}>
            {task.title}
          </Text>
          <Text className="text-lg font-semibold" style={{ color: textColor }}>
            {statusLabel}
          </Text>
        </View>
        {task.assignedTo?.fullname ? (
          <Text className="mt-1 text-sm" style={{ color: textColor }}>
            Người xử lý: {normalizeVietnameseName(task.assignedTo.fullname)}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View className="mb-2 mt-6 rounded-2xl bg-[#f8f8f8] p-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-lg font-semibold">{title}</Text>
          <TouchableOpacity onPress={openAddSubTask} className="rounded-lg px-4">
            <Text className="text-3xl font-medium text-primary">+</Text>
          </TouchableOpacity>
        </View>

        {/* Add subtask input */}
        {showAddSubTask && (
          <View className="mb-3">
            <View className="flex-row items-center">
              <TextInput
                value={newSubTaskTitle}
                onChangeText={setNewSubTaskTitle}
                placeholder="Nhập việc cần làm"
                className="mr-2 flex-1 rounded-lg bg-[#ebebeb] p-3"
              />
              <TouchableOpacity
                onPress={handleAddSubTask}
                disabled={actionLoading}
                className="mr-2 rounded-lg bg-[#009483] px-3 py-2">
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="font-medium text-white">Thêm</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowAddSubTask(false);
                  setNewSubTaskTitle('');
                  setNewSubTaskAssignee(null);
                }}
                className="rounded-lg bg-gray-400 px-3 py-2">
                <Text className="font-medium text-white">Huỷ</Text>
              </TouchableOpacity>
            </View>

            {/* Chọn người xử lý cho công việc con (search dropdown) */}
            <View className="mt-2">
              <Text className="mb-1 text-sm font-medium text-gray-600">
                Người xử lý {newSubTaskAssignee ? '' : '(tuỳ chọn)'}
              </Text>
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => setShowAddAssigneePicker(true)}
                  className="flex-1 flex-row items-center justify-between rounded-lg bg-[#ebebeb] px-3 py-3">
                  <Text
                    className={`flex-1 text-base ${
                      newSubTaskAssignee ? 'text-[#1F2937]' : 'text-gray-400'
                    }`}>
                    {newSubTaskAssignee
                      ? normalizeVietnameseName(newSubTaskAssignee.fullname)
                      : 'Chọn người xử lý'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#6B7280" />
                </TouchableOpacity>
                {newSubTaskAssignee ? (
                  <TouchableOpacity
                    onPress={() => setNewSubTaskAssignee(null)}
                    className="ml-2 rounded-full bg-gray-200 p-2">
                    <Ionicons name="close" size={16} color="#6B7280" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* Subtask list */}
        {subTasks.length > 0 ? (
          subTasks.map(renderSubTask)
        ) : (
          <Text className="text-center text-sm font-medium text-gray-500">Không có subtask</Text>
        )}
      </View>

      {/* Action sheets */}
      <SubTaskStatusSheet
        subTask={ui.selectedSubTask}
        allSubTasks={subTasks}
        canComplete={ui.selectedSubTask ? canCompleteSubTask(ui.selectedSubTask) : true}
        onReassign={handleReassignSubTask}
        onDelete={handleDeleteSubTask}
        onSelect={(value) => {
          if (ui.selectedSubTask) {
            handleUpdateSubTaskStatus(ui.selectedSubTask._id, value);
          }
        }}
      />

      <SubTaskAssigneeModal
        onSelect={handleSelectSubTaskAssignee}
        onUnassign={handleUnassignSubTask}
      />

      {/* Picker người xử lý cho form thêm công việc con */}
      <AssigneeSearchSheet
        visible={showAddAssigneePicker}
        title="Chọn người xử lý"
        selectedKey={(newSubTaskAssignee?._id || '').toLowerCase()}
        onSelect={(m) => {
          setNewSubTaskAssignee(m);
          setShowAddAssigneePicker(false);
        }}
        onUnassign={() => {
          setNewSubTaskAssignee(null);
          setShowAddAssigneePicker(false);
        }}
        onClose={() => setShowAddAssigneePicker(false)}
      />
    </>
  );
};

export default SubTaskSection;
