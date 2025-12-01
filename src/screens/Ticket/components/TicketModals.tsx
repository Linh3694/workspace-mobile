import React from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { TouchableOpacity, ActionSheet } from '../../../components/Common';
import { useTicketStore, useTicketUI, useTicketUIActions, useSupportTeam } from '../../../hooks/useTicketStore';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import { getStatusLabel } from '../../../config/ticketConstants';
import type { SupportTeamMember, SubTask } from '../../../services/ticketService';

// ============================================================================
// Confirm Assign Modal (Nhận ticket cho bản thân)
// ============================================================================

interface ConfirmAssignModalProps {
  onConfirm: () => void;
}

export const ConfirmAssignModal: React.FC<ConfirmAssignModalProps> = ({ onConfirm }) => {
  const { showConfirmAssignModal } = useTicketUI();
  const { closeConfirmAssignModal } = useTicketUIActions();
  const actionLoading = useTicketStore((state) => state.actionLoading);

  return (
    <Modal
      visible={showConfirmAssignModal}
      transparent
      animationType="fade"
      onRequestClose={closeConfirmAssignModal}>
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="mx-5 w-[85%] rounded-2xl bg-white p-5">
          <Text className="mb-4 text-center font-semibold text-lg">Xác nhận</Text>
          <Text className="mb-6 text-center text-base text-gray-600">
            Bạn có chắc chắn muốn nhận ticket này?
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={closeConfirmAssignModal}
              disabled={actionLoading}
              className="flex-1 items-center rounded-xl bg-gray-200 py-3">
              <Text className="font-medium text-gray-700">Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={actionLoading}
              className="flex-1 items-center rounded-xl bg-orange-600 py-3">
              {actionLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="font-medium text-white">Xác nhận</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// Support Team Modal (Chuyển ticket cho người khác)
// ============================================================================

interface SupportTeamModalProps {
  onSelect: (member: SupportTeamMember) => void;
}

export const SupportTeamModal: React.FC<SupportTeamModalProps> = ({ onSelect }) => {
  const { showAssignModal } = useTicketUI();
  const { closeAssignModal } = useTicketUIActions();
  const { members, loading } = useSupportTeam();
  const actionLoading = useTicketStore((state) => state.actionLoading);

  return (
    <Modal
      visible={showAssignModal}
      transparent
      animationType="slide"
      onRequestClose={closeAssignModal}>
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="mx-5 max-h-[70%] w-[85%] rounded-2xl bg-white p-5">
          <Text className="mb-4 text-center font-semibold text-lg">Chọn nhân viên hỗ trợ</Text>
          {loading ? (
            <View className="py-8">
              <ActivityIndicator size="large" color="#002855" />
            </View>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => item._id}
              className="max-h-[300px]"
              ItemSeparatorComponent={() => <View className="h-px bg-gray-200" />}
              ListEmptyComponent={() => (
                <Text className="py-4 text-center text-gray-500">Không có nhân viên nào</Text>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => onSelect(item)}
                  disabled={actionLoading}
                  className="py-3">
                  <Text className="text-center text-base">
                    {normalizeVietnameseName(item.fullname)}
                  </Text>
                  {item.email && (
                    <Text className="text-center text-sm text-gray-500">{item.email}</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
          <TouchableOpacity
            onPress={closeAssignModal}
            disabled={actionLoading}
            className="mt-4 items-center rounded-xl bg-gray-200 py-3">
            <Text className="font-medium text-gray-700">Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// Cancel Ticket Modal
// ============================================================================

interface CancelTicketModalProps {
  onConfirm: () => void;
}

export const CancelTicketModal: React.FC<CancelTicketModalProps> = ({ onConfirm }) => {
  const { showCancelModal, cancelReason } = useTicketUI();
  const { closeCancelModal, setCancelReason } = useTicketUIActions();
  const actionLoading = useTicketStore((state) => state.actionLoading);

  return (
    <Modal
      visible={showCancelModal}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!actionLoading) {
          closeCancelModal();
        }
      }}>
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="mx-5 w-[85%] rounded-2xl bg-white p-5">
          <Text className="mb-4 text-center font-semibold text-lg">Lý do hủy ticket</Text>
          <TextInput
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder="Nhập lý do hủy..."
            multiline
            numberOfLines={3}
            className="mb-4 rounded-xl bg-gray-100 p-3 text-base"
            style={{ minHeight: 80, textAlignVertical: 'top' }}
            editable={!actionLoading}
          />
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={closeCancelModal}
              disabled={actionLoading}
              className="flex-1 items-center rounded-xl bg-gray-200 py-3">
              <Text className="font-medium text-gray-700">Đóng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={actionLoading}
              className="flex-1 items-center rounded-xl bg-red-600 py-3">
              {actionLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="font-medium text-white">Xác nhận hủy</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// Ticket Status Action Sheet
// ============================================================================

interface TicketStatusSheetProps {
  currentStatus: string;
  onSelect: (status: string) => void;
}

const ADMIN_STATUS_OPTIONS = ['Processing', 'Done', 'Cancelled'];

export const TicketStatusSheet: React.FC<TicketStatusSheetProps> = ({
  currentStatus,
  onSelect,
}) => {
  const { showTicketStatusSheet } = useTicketUI();
  const { closeTicketStatusSheet } = useTicketUIActions();

  const getStatusItems = () => {
    const normalizedCurrent = currentStatus.toLowerCase();

    // If ticket is closed, include current status
    if (normalizedCurrent === 'closed') {
      return [
        { label: getStatusLabel('Closed'), value: 'Closed' },
        ...ADMIN_STATUS_OPTIONS.map((s) => ({
          label: getStatusLabel(s),
          value: s,
        })),
      ];
    }

    return ADMIN_STATUS_OPTIONS.map((s) => ({
      label: getStatusLabel(s),
      value: s,
    }));
  };

  return (
    <ActionSheet
      visible={showTicketStatusSheet}
      options={getStatusItems()}
      title="Chọn trạng thái"
      onSelect={(value) => {
        onSelect(value);
        closeTicketStatusSheet();
      }}
      onCancel={closeTicketStatusSheet}
    />
  );
};

// ============================================================================
// SubTask Status Action Sheet
// ============================================================================

interface SubTaskStatusSheetProps {
  subTask: SubTask | null;
  allSubTasks: SubTask[];
  onSelect: (status: string) => void;
}

export const SubTaskStatusSheet: React.FC<SubTaskStatusSheetProps> = ({
  subTask,
  allSubTasks,
  onSelect,
}) => {
  const { showSubTaskStatusModal } = useTicketUI();
  const { closeSubTaskStatusModal } = useTicketUIActions();

  if (!subTask) return null;

  const inProgressTasks = allSubTasks.filter((t) => t.status === 'In Progress');
  const isFirstInProgress = inProgressTasks.length > 0 && inProgressTasks[0]._id === subTask._id;

  const options = [
    {
      label: isFirstInProgress ? 'Đang xử lý' : 'Chờ xử lý',
      value: 'In Progress',
    },
    {
      label: 'Hoàn thành',
      value: 'Completed',
    },
    {
      label: 'Huỷ',
      value: 'Cancelled',
    },
  ];

  return (
    <ActionSheet
      visible={showSubTaskStatusModal}
      options={options}
      title="Cập nhật trạng thái"
      onSelect={(value) => {
        onSelect(value);
        closeSubTaskStatusModal();
      }}
      onCancel={closeSubTaskStatusModal}
    />
  );
};

// ============================================================================
// Combined Modals Component for Admin
// ============================================================================

interface TicketAdminModalsProps {
  onAssignToMe: () => void;
  onAssignToUser: (member: SupportTeamMember) => void;
  onCancelTicket: () => void;
}

export const TicketAdminModals: React.FC<TicketAdminModalsProps> = ({
  onAssignToMe,
  onAssignToUser,
  onCancelTicket,
}) => {
  return (
    <>
      <ConfirmAssignModal onConfirm={onAssignToMe} />
      <SupportTeamModal onSelect={onAssignToUser} />
      <CancelTicketModal onConfirm={onCancelTicket} />
    </>
  );
};

export default TicketAdminModals;

