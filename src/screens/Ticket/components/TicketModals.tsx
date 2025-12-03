import React from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { TouchableOpacity, ActionSheet } from '../../../components/Common';
import {
  useTicketStore,
  useTicketUI,
  useTicketUIActions,
  useSupportTeam,
} from '../../../hooks/useTicketStore';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import { getStatusLabel } from '../../../config/ticketConstants';
import type { SupportTeamMember, SubTask } from '../../../services/ticketService';
import LottieView from 'lottie-react-native';

// Lottie animations for rating
const ratingAnimations = [
  require('../../../assets/emoji/1star.json'),
  require('../../../assets/emoji/2star.json'),
  require('../../../assets/emoji/3star.json'),
  require('../../../assets/emoji/4star.json'),
  require('../../../assets/emoji/5star.json'),
];

// Rating descriptions
const getRatingText = (rating: number) => {
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
          <Text className="mb-4 text-center text-lg font-semibold">Xác nhận</Text>
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
          <Text className="mb-4 text-center text-lg font-semibold">Chọn nhân viên hỗ trợ</Text>
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
          <Text className="mb-4 text-center text-lg font-semibold">Lý do hủy ticket</Text>
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
// Complete Ticket Modal (For Guest to close ticket with feedback)
// ============================================================================

const FEEDBACK_BADGES = ['Nhiệt Huyết', 'Chu Đáo', 'Vui Vẻ', 'Tận Tình', 'Chuyên Nghiệp'];

interface CompleteTicketModalProps {
  onConfirm: () => void;
}

export const CompleteTicketModal: React.FC<CompleteTicketModalProps> = ({ onConfirm }) => {
  const { showCompleteModal, feedbackRating, feedbackComment, feedbackBadges } = useTicketUI();
  const { closeCompleteModal, setFeedbackRating, setFeedbackComment, setFeedbackBadges } =
    useTicketUIActions();
  const actionLoading = useTicketStore((state) => state.actionLoading);

  const toggleBadge = (badge: string) => {
    if (feedbackBadges.includes(badge)) {
      setFeedbackBadges(feedbackBadges.filter((b) => b !== badge));
    } else {
      setFeedbackBadges([...feedbackBadges, badge]);
    }
  };

  return (
    <Modal
      visible={showCompleteModal}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!actionLoading) {
          closeCompleteModal();
        }
      }}>
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="mx-5 max-h-[85%] w-[90%] rounded-2xl bg-white p-5">
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="mb-4 text-center text-lg font-bold text-[#002855]">
              Hoàn thành & Đánh giá
            </Text>

            {/* Rating Text */}
            <Text className="mb-4 text-center text-base font-semibold text-[#002855]">
              Cảm nhận của bạn về dịch vụ hỗ trợ
            </Text>

            {/* Lottie Rating Emojis with Glow Effect */}
            <View className="mb-4 flex-row items-start justify-center">
              {[1, 2, 3, 4, 5].map((i) => {
                const isSelected = feedbackRating === i;
                const isAnySelected = feedbackRating > 0;
                return (
                  <View key={i} className="items-center" style={{ marginHorizontal: 6 }}>
                    <TouchableOpacity
                      onPress={() => setFeedbackRating(i)}
                      disabled={actionLoading}
                      style={{
                        transform: [{ scale: isSelected ? 1.1 : 1 }],
                      }}>
                      {/* Outer glow ring - only show when selected */}
                      <View
                        style={{
                          width: isSelected ? 54 : 48,
                          height: isSelected ? 54 : 48,
                          borderRadius: 27,
                          padding: isSelected ? 2 : 0,
                          backgroundColor: 'transparent',
                          ...(isSelected && {
                            borderWidth: 2,
                            borderColor: '#F5AA1E',
                            shadowColor: '#F5AA1E',
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.6,
                            shadowRadius: 8,
                            elevation: 8,
                          }),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        {/* Inner circle background */}
                        <View
                          style={{
                            width: isSelected ? 46 : 44,
                            height: isSelected ? 46 : 44,
                            borderRadius: 23,
                            backgroundColor: isSelected ? '#FFFBE8' : '#E5E7EB',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isAnySelected && !isSelected ? 0.5 : 1,
                          }}>
                          <LottieView
                            source={ratingAnimations[i - 1]}
                            autoPlay
                            loop
                            style={{ width: 36, height: 36 }}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Badge text below selected icon */}
                    {isSelected && (
                      <View className="mt-2 items-center">
                        {/* Arrow pointing up */}
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
                        {/* Badge */}
                        <View
                          style={{
                            backgroundColor: '#F5AA1E',
                            borderRadius: 12,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}>
                          <Text className="text-center text-xs font-semibold text-white">
                            {getRatingText(i)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Feedback Badges */}
            <Text className="mb-2 text-center text-sm font-semibold text-[#002855]">
              Bạn thấy nhân viên hỗ trợ như thế nào?
            </Text>
            <View className="mb-3 flex-row flex-wrap justify-center">
              {FEEDBACK_BADGES.map((badge) => {
                const isSelected = feedbackBadges.includes(badge);
                return (
                  <TouchableOpacity
                    key={badge}
                    onPress={() => toggleBadge(badge)}
                    disabled={actionLoading}
                    style={{
                      margin: 4,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: isSelected ? '#FFF3D6' : '#F3F4F6',
                      borderWidth: isSelected ? 1.5 : 1,
                      borderColor: isSelected ? '#F5AA1E' : '#E5E7EB',
                      ...(isSelected && {
                        shadowColor: '#F5AA1E',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 3,
                      }),
                    }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? '600' : '500',
                        color: isSelected ? '#F5AA1E' : '#6B7280',
                      }}>
                      {badge}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Comment */}
            <TextInput
              value={feedbackComment}
              onChangeText={setFeedbackComment}
              placeholder="Nhận xét của bạn (không bắt buộc)"
              multiline
              numberOfLines={3}
              className="mb-4 rounded-xl border border-gray-300 bg-white p-3 text-base"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
              editable={!actionLoading}
            />

            {/* Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={closeCompleteModal}
                disabled={actionLoading}
                className="flex-1 items-center rounded-xl bg-gray-200 py-3">
                <Text className="font-medium text-gray-700">Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onConfirm}
                disabled={actionLoading || feedbackRating === 0}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  borderRadius: 12,
                  paddingVertical: 12,
                  backgroundColor: feedbackRating === 0 ? '#9CA3AF' : '#FF5733',
                }}>
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="font-bold text-white">Hoàn thành</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
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

// ============================================================================
// Combined Modals Component for Guest
// ============================================================================

interface TicketGuestModalsProps {
  onCompleteTicket: () => void;
  onCancelTicket: () => void;
}

export const TicketGuestModals: React.FC<TicketGuestModalsProps> = ({
  onCompleteTicket,
  onCancelTicket,
}) => {
  return (
    <>
      <CompleteTicketModal onConfirm={onCompleteTicket} />
      <CancelTicketModal onConfirm={onCancelTicket} />
    </>
  );
};

export default TicketAdminModals;
