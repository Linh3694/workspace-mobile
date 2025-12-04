import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ActivityIndicator,
  FlatList,
  ScrollView,
} from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { useFeedbackStore, useSupportTeam, useFeedbackData } from '../../../hooks/useFeedbackStore';
import type { SupportTeamUser } from '../../../services/feedbackService';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';

interface FeedbackModalsProps {
  onAssignToUser: (member: SupportTeamUser, priority?: string) => void;
}

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'Khẩn cấp', label: 'Khẩn cấp', color: 'bg-red-500' },
  { value: 'Cao', label: 'Cao', color: 'bg-orange-500' },
  { value: 'Trung bình', label: 'Trung bình', color: 'bg-yellow-500' },
  { value: 'Thấp', label: 'Thấp', color: 'bg-green-500' },
];

export const FeedbackModals: React.FC<FeedbackModalsProps> = ({ onAssignToUser }) => {
  const ui = useFeedbackStore((state) => state.ui);
  const closeAssignModal = useFeedbackStore((state) => state.closeAssignModal);
  const actionLoading = useFeedbackStore((state) => state.actionLoading);
  const { members, loading: supportTeamLoading } = useSupportTeam();
  const { feedback } = useFeedbackData();

  // Local state for selected priority
  const [selectedPriority, setSelectedPriority] = useState<string>(feedback?.priority || 'Trung bình');

  // Reset priority when modal opens
  React.useEffect(() => {
    if (ui.showAssignModal) {
      setSelectedPriority(feedback?.priority || 'Trung bình');
    }
  }, [ui.showAssignModal, feedback?.priority]);

  // Handle assign with priority
  const handleAssign = (member: SupportTeamUser) => {
    onAssignToUser(member, selectedPriority);
  };

  return (
    <Modal
      visible={ui.showAssignModal}
      transparent
      animationType="slide"
      onRequestClose={closeAssignModal}>
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="mx-5 max-h-[80%] w-[90%] rounded-2xl bg-white p-5">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold">Phân công xử lý</Text>
            <TouchableOpacity onPress={closeAssignModal}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Priority Selection */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-gray-600">Độ ưu tiên:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row">
                {PRIORITY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setSelectedPriority(option.value)}
                    className={`mr-2 rounded-full px-4 py-2 ${
                      selectedPriority === option.value ? option.color : 'bg-gray-200'
                    }`}>
                    <Text
                      className={`text-sm font-medium ${
                        selectedPriority === option.value ? 'text-white' : 'text-gray-600'
                      }`}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Divider */}
          <View className="mb-4 h-px bg-gray-200" />

          {/* User list */}
          <Text className="mb-2 text-sm font-medium text-gray-600">Chọn người xử lý:</Text>

          {supportTeamLoading ? (
            <View className="py-8">
              <ActivityIndicator size="large" color="#002855" />
            </View>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => item.name || item.email}
              className="max-h-[300px]"
              ItemSeparatorComponent={() => <View className="h-px bg-gray-100" />}
              ListEmptyComponent={() => (
                <Text className="py-4 text-center text-gray-500">Không có nhân viên nào</Text>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleAssign(item)}
                  disabled={actionLoading}
                  className="py-3">
                  <Text className="text-center text-base font-medium">
                    {normalizeVietnameseName(item.full_name || item.email)}
                  </Text>
                  {item.email && (
                    <Text className="text-center text-sm text-gray-500">{item.email}</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}

          {/* Close button */}
          <TouchableOpacity
            onPress={closeAssignModal}
            disabled={actionLoading}
            className="mt-4 items-center rounded-xl bg-gray-200 py-3">
            <Text className="font-medium text-gray-700">Đóng</Text>
          </TouchableOpacity>

          {/* Loading overlay when assigning */}
          {actionLoading && (
            <View
              className="absolute inset-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}>
              <ActivityIndicator size="large" color="#002855" />
              <Text className="mt-2 text-gray-600">Đang phân công...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default FeedbackModals;
