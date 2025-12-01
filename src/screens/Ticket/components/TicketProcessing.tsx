import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TextInput, ScrollView, RefreshControl } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import LottieView from 'lottie-react-native';

// Lottie animations for feedback stars
const ratingAnimations = [
  require('../../../assets/emoji/1star.json'),
  require('../../../assets/emoji/2star.json'),
  require('../../../assets/emoji/3star.json'),
  require('../../../assets/emoji/4star.json'),
  require('../../../assets/emoji/5star.json'),
];

// Store & Hooks
import {
  useTicketStore,
  useTicketData,
  useTicketActions,
  useTicketUIActions,
  useTicketSubTasks,
} from '../../../hooks/useTicketStore';

// Utils & Constants
import { toast } from '../../../utils/toast';
import { getStatusLabel } from '../../../config/ticketConstants';

// Components
import { TicketStatusSheet, SubTaskStatusSheet } from './TicketModals';

import type { SubTask } from '../../../services/ticketService';
import type { SubTaskStatus, TicketStatus } from '../../../hooks/useTicketStore';

interface TicketProcessingProps {
  ticketId: string;
  ticketCode?: string;
}

// Admin can only choose these statuses
const ADMIN_STATUS_OPTIONS = ['Processing', 'Done', 'Cancelled'];

// Helper function - defined outside component to avoid recreation
const normalizeStatus = (status = '') => {
  const lower = status.toLowerCase().replace(/_/g, ' ');
  // "waiting for customer" được xử lý như "Processing" để UI đồng nhất cho guest
  if (lower === 'processing' || lower === 'waiting for customer') return 'Processing';
  if (lower === 'done' || lower === 'completed') return 'Done';
  if (lower === 'cancelled') return 'Cancelled';
  if (lower === 'closed') return 'Closed';
  if (lower === 'assigned') return 'Assigned';
  return status;
};

// Helper function for rating text
const getRatingText = (rating: number): string => {
  switch (rating) {
    case 1:
      return 'Rất không hài lòng';
    case 2:
      return 'Không hài lòng';
    case 3:
      return 'Bình thường';
    case 4:
      return 'Hài lòng';
    case 5:
      return 'Rất hài lòng';
    default:
      return '';
  }
};

const TicketProcessing: React.FC<TicketProcessingProps> = ({ ticketId }) => {
  const [showAddSubTask, setShowAddSubTask] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [showCancelReasonInput, setShowCancelReasonInput] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Processing');

  // Global store - ticket đã được fetch từ parent (TicketAdminDetail)
  const { ticket, loading, refreshing } = useTicketData();
  const { subTasks, hasIncompleteSubTasks } = useTicketSubTasks();
  const { updateStatus, addSubTask, updateSubTaskStatus, refreshTicket } = useTicketActions();
  const { openTicketStatusSheet, openSubTaskStatusModal } = useTicketUIActions();
  const actionLoading = useTicketStore((state) => state.actionLoading);
  const ui = useTicketStore((state) => state.ui);

  // Sync selected status with ticket status
  useEffect(() => {
    if (ticket?.status) {
      setSelectedStatus(normalizeStatus(ticket.status));
    }
  }, [ticket?.status]);

  const ticketStatus = normalizeStatus(ticket?.status || '');
  const isTerminalStatus = ticketStatus === 'Cancelled' || ticketStatus === 'Closed';

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleUpdateStatus = async (newStatus: string) => {
    // Validate: không thể Done nếu còn subtask In Progress
    if (newStatus === 'Done' && subTasks.some((t) => t.status === 'In Progress')) {
      toast.error('Cần xử lý hết subtask trước');
      return;
    }

    // Cần nhập lý do nếu Cancel
    if (newStatus === 'Cancelled' && !cancelReason.trim()) {
      setShowCancelReasonInput(true);
      return;
    }

    await updateStatusAPI(newStatus, newStatus === 'Cancelled' ? cancelReason : '');
  };

  const updateStatusAPI = async (newStatus: string, reason = '') => {
    try {
      // Nếu có lý do cancel, cần gọi cancelTicket API thay vì updateStatus
      if (newStatus === 'Cancelled' && reason) {
        const cancelTicketFn = useTicketStore.getState().cancelTicket;
        const success = await cancelTicketFn(reason);
        if (success) {
          toast.success('Cập nhật thành công!');
          setCancelReason('');
          setShowCancelReasonInput(false);
        } else {
          toast.error('Không thể cập nhật');
        }
      } else {
        const success = await updateStatus(newStatus as TicketStatus);
        if (success) {
          toast.success('Cập nhật thành công!');
        } else {
          if (newStatus === 'Done' && hasIncompleteSubTasks) {
            toast.error('Cần xử lý hết subtask trước');
          } else {
            toast.error('Không thể cập nhật');
          }
        }
      }
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái:', err);
      toast.error('Không thể cập nhật');
    }
  };

  const confirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Vui lòng nhập lý do huỷ');
      return;
    }
    await updateStatusAPI('Cancelled', cancelReason.trim());
  };

  const handleAddSubTask = async () => {
    if (!newSubTaskTitle.trim()) {
      toast.error('Tiêu đề không được để trống');
      return;
    }

    const success = await addSubTask(newSubTaskTitle);
    if (success) {
      setNewSubTaskTitle('');
      setShowAddSubTask(false);
      toast.success('Thêm thành công!');
    } else {
      toast.error('Lỗi thêm subtask');
    }
  };

  const handleUpdateSubTaskStatus = async (subTaskId: string, newStatus: string) => {
    const success = await updateSubTaskStatus(subTaskId, newStatus as SubTaskStatus);
    if (success) {
      toast.success('Cập nhật thành công!');
    } else {
      toast.error('Lỗi cập nhật subtask');
    }
  };

  const handleSubTaskPress = (task: SubTask) => {
    if (isTerminalStatus) return;
    openSubTaskStatusModal(task);
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderFeedback = () => {
    if (ticketStatus !== 'Closed' || !ticket?.feedback) return null;

    return (
      <View className="mt-4 rounded-2xl bg-[#FFFBE8] p-4">
        <Text className="mb-3 text-center font-semibold text-lg text-[#F5AA1E]">Phản hồi</Text>

        {/* Lottie Star with Glow Effect */}
        <View className="mb-3 items-center">
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              padding: 3,
              borderWidth: 2,
              borderColor: '#F5AA1E',
              shadowColor: '#F5AA1E',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 10,
              elevation: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <View
              style={{
                width: 62,
                height: 62,
                borderRadius: 31,
                backgroundColor: '#FFFBE8',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <LottieView
                source={ratingAnimations[(ticket.feedback?.rating || 1) - 1]}
                autoPlay
                loop
                style={{ width: 48, height: 48 }}
              />
            </View>
          </View>
          {/* Badge below */}
          <View className="mt-2 items-center">
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 6,
                borderRightWidth: 6,
                borderBottomWidth: 6,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderBottomColor: '#F5AA1E',
              }}
            />
            <View
              style={{
                backgroundColor: '#F5AA1E',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 4,
              }}>
              <Text className="text-center text-sm font-semibold text-white">
                {getRatingText(ticket.feedback?.rating || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Comment */}
        {ticket.feedback.comment && (
          <View className="mb-3 rounded-xl bg-white p-3">
            <Text className="text-center italic text-gray-700">&ldquo;{ticket.feedback.comment}&rdquo;</Text>
          </View>
        )}

        {/* Badges */}
        {ticket.feedback.badges && ticket.feedback.badges.length > 0 && (
          <View className="flex-row flex-wrap justify-center">
            {ticket.feedback.badges.map((badge, index) => (
              <View
                key={index}
                style={{
                  margin: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: '#FFF3D6',
                  borderWidth: 1,
                  borderColor: '#F5AA1E',
                }}>
                <Text style={{ color: '#F5AA1E', fontWeight: '600', fontSize: 12 }}>
                  {badge}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderSubTask = (task: SubTask) => {
    const inProgressTasks = subTasks.filter((t) => t.status === 'In Progress');
    const isFirstInProgress = inProgressTasks.length > 0 && inProgressTasks[0]._id === task._id;

    // Style based on status
    let bgColor = '#fff';
    let textColor = '#222';
    let textDecorationLine: 'none' | 'line-through' = 'none';

    if (task.status === 'Completed') {
      bgColor = '#E4EFE6';
      textColor = '#009483';
    } else if (task.status === 'Cancelled') {
      bgColor = '#EBEBEB';
      textColor = '#757575';
      textDecorationLine = 'line-through';
    } else if (task.status === 'In Progress') {
      if (isFirstInProgress) {
        bgColor = '#E6EEF6';
        textColor = '#002855';
      } else {
        bgColor = '#EBEBEB';
        textColor = '#757575';
      }
    }

    const statusLabel =
      task.status === 'In Progress'
        ? isFirstInProgress
          ? 'Đang xử lý'
          : 'Chờ xử lý'
        : task.status === 'Completed'
          ? 'Hoàn thành'
          : 'Đã huỷ';

    return (
      <TouchableOpacity
        key={task._id}
        onPress={() => handleSubTaskPress(task)}
        disabled={isTerminalStatus}
        style={{
          marginBottom: 10,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: bgColor,
          opacity: isTerminalStatus ? 0.5 : 1,
        }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <Text className="font-semibold text-lg" style={{ color: textColor, textDecorationLine }}>
            {task.title}
          </Text>
          <Text className="font-semibold text-lg" style={{ color: textColor }}>
            {statusLabel}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#002855" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white p-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshTicket} colors={['#F05023']} tintColor="#F05023" />
      }>
      {/* STATUS BAR */}
      <View
        className="mb-2 mt-4 h-auto flex-col items-start justify-center gap-4 rounded-2xl bg-[#f8f8f8] p-4"
        style={{ position: 'relative', zIndex: 1 }}>
        <Text className="mr-2 font-semibold text-lg">Trạng thái:</Text>
        <View style={{ width: '100%' }}>
          <TouchableOpacity
            onPress={openTicketStatusSheet}
            disabled={isTerminalStatus}
            style={{
              backgroundColor: '#fff',
              borderRadius: 25,
              height: 50,
              justifyContent: 'center',
              paddingHorizontal: 16,
              opacity: isTerminalStatus ? 0.6 : 1,
            }}>
            <Text style={{ fontSize: 16 }}>{getStatusLabel(selectedStatus)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CANCEL REASON INPUT */}
      {showCancelReasonInput && (
        <View className="rounded-lg p-4">
          <Text className="mb-2 font-medium">Lý do huỷ ticket:</Text>
          <TextInput
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder="Nhập lý do huỷ..."
            className="mb-2 rounded-lg bg-[#f8f8f8] p-3 font-medium"
            multiline
          />
          <View className="flex-row justify-end">
            <TouchableOpacity
              onPress={() => {
                setCancelReason('');
                setShowCancelReasonInput(false);
              }}
              className="mr-2 rounded-lg bg-gray-200 px-4 py-2">
              <Text className="font-medium">Huỷ bỏ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmCancel}
              disabled={actionLoading}
              className="rounded-lg bg-red-500 px-4 py-2">
              {actionLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="font-medium text-white">Xác nhận</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* CANCELLATION REASON DISPLAY */}
      {ticketStatus === 'Cancelled' && ticket?.cancellationReason && (
        <View className="mt-4 rounded-lg bg-red-100 p-4">
          <Text className="font-bold text-red-600">Lý do huỷ ticket:</Text>
          <Text className="font-medium text-red-600">{ticket.cancellationReason}</Text>
        </View>
      )}

      {/* FEEDBACK DISPLAY */}
      {renderFeedback()}

      {/* SUBTASKS OR COMPLETION BANNER */}
      {!isTerminalStatus &&
        (ticketStatus === 'Done' ? (
          <View className="mb-2 mt-2 rounded-2xl bg-[#f3f4f6] p-4">
            <Text className="text-center text-gray-600" style={{ fontSize: 16, lineHeight: 24 }}>
              Vui lòng thông báo tới người dùng kiểm tra kết quả và chất lượng phục vụ
            </Text>
          </View>
        ) : (
          <View className="mb-2 mt-6 rounded-2xl bg-[#f8f8f8] p-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-semibold text-lg">Danh sách công việc</Text>
              <TouchableOpacity onPress={() => setShowAddSubTask(true)} className="rounded-lg px-4">
                <Text className="font-medium text-3xl text-primary">+</Text>
              </TouchableOpacity>
            </View>

            {/* Add subtask input */}
            {showAddSubTask && (
              <View className="mb-3 flex-row items-center">
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
                  }}
                  className="rounded-lg bg-gray-400 px-3 py-2">
                  <Text className="font-medium text-white">Huỷ</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Subtask list */}
            {subTasks.length > 0 ? (
              subTasks.map(renderSubTask)
            ) : (
              <Text className="text-center font-medium text-sm text-gray-500">Không có subtask</Text>
            )}
          </View>
        ))}

      {/* Action Sheets */}
      <TicketStatusSheet
        currentStatus={ticketStatus}
        onSelect={(value) => {
          handleUpdateStatus(value);
          setSelectedStatus(value);
        }}
      />

      <SubTaskStatusSheet
        subTask={ui.selectedSubTask}
        allSubTasks={subTasks}
        onSelect={(value) => {
          if (ui.selectedSubTask) {
            handleUpdateSubTaskStatus(ui.selectedSubTask._id, value);
          }
        }}
      />
    </ScrollView>
  );
};

export default TicketProcessing;
