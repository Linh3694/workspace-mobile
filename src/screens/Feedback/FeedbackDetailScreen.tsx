import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, ActivityIndicator, Platform, Alert } from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { AntDesign, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Store & Hooks
import {
  useFeedbackStore,
  useFeedbackData,
  useFeedbackActions,
  useFeedbackUIActions,
} from '../../hooks/useFeedbackStore';

// Utils
import { toast } from '../../utils/toast';
import { getStatusLabel, getStatusColor } from '../../config/feedbackConstants';

// Components
import FeedbackInformation from './components/FeedbackInformation';
import FeedbackProcessing from './components/FeedbackProcessing';
import { FeedbackModals } from './components/FeedbackModals';

import type { SupportTeamUser } from '../../services/feedbackService';

type FeedbackDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'FeedbackDetail'>;

interface RouteParams {
  feedbackId: string;
}

// Helper để hiển thị số sao
const renderStars = (rating: number) => {
  // Rating được lưu dạng normalized (0-1), cần convert về 1-5
  const actualRating = Math.round(rating * 5);
  return '⭐'.repeat(actualRating);
};

const FeedbackDetailScreen = () => {
  const navigation = useNavigation<FeedbackDetailNavigationProp>();
  const route = useRoute();
  const { feedbackId } = route.params as RouteParams;
  const insets = useSafeAreaInsets();

  // Local UI state
  const [activeTab, setActiveTab] = useState('information');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Store
  const { feedback, loading, error } = useFeedbackData();
  const { fetchFeedback, updateAssignment, closeFeedback, deleteFeedback } = useFeedbackActions();
  const { openAssignModal, closeAssignModal } = useFeedbackUIActions();
  const actionLoading = useFeedbackStore((state) => state.actionLoading);
  const resetDetail = useFeedbackStore((state) => state.resetDetail);

  // Check user role (Mobile BOD = read only)
  useEffect(() => {
    const checkUserRole = async () => {
      const rolesStr = await AsyncStorage.getItem('userRoles');
      const userEmail = await AsyncStorage.getItem('userId'); // userId stores email
      setCurrentUserEmail(userEmail);

      if (rolesStr) {
        const roles: string[] = JSON.parse(rolesStr);
        // Mobile BOD can only view, Mobile IT can take actions
        if (roles.includes('Mobile BOD') && !roles.includes('Mobile IT')) {
          setIsReadOnly(true);
        } else {
          setIsReadOnly(false);
        }
      }
    };
    checkUserRole();
  }, []);

  // Fetch feedback on mount
  useEffect(() => {
    fetchFeedback(feedbackId);

    return () => {
      resetDetail();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackId]);

  // Refetch on focus
  useFocusEffect(
    React.useCallback(() => {
      fetchFeedback(feedbackId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feedbackId])
  );

  const handleGoBack = () => {
    navigation.goBack();
  };

  // Check if current user is assigned to this feedback (case-insensitive)
  const isAssignedToMe = feedback?.assigned_to?.toLowerCase() === currentUserEmail?.toLowerCase();

  // Check if feedback is closed
  const isClosed = ['Đóng', 'Tự động đóng', 'Hoàn thành'].includes(feedback?.status || '');

  // Handlers
  const handleAssignToUser = async (member: SupportTeamUser, priority?: string) => {
    const userId = member?.user_id || member?.name;
    if (!userId) {
      toast.error('Không tìm thấy thông tin người dùng');
      return;
    }

    closeAssignModal();
    const success = await updateAssignment(userId, priority);
    if (success) {
      toast.success(`Đã phân công cho ${member.full_name}`);
    } else {
      toast.error('Không thể phân công');
    }
  };

  const handleCloseFeedback = async () => {
    const success = await closeFeedback();
    if (success) {
      toast.success('Đã đóng góp ý');
    } else {
      toast.error('Không thể đóng góp ý');
    }
  };

  const handleDeleteFeedback = () => {
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc chắn muốn xóa feedback "${feedback?.name}" không?\n\nHành động này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteFeedback();
            if (success) {
              toast.success('Đã xóa feedback');
              navigation.goBack();
            } else {
              toast.error('Không thể xóa feedback');
            }
          },
        },
      ]
    );
  };

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'information':
        return <FeedbackInformation feedbackId={feedbackId} />;
      case 'processing':
        return (
          <FeedbackProcessing
            feedbackId={feedbackId}
            isReadOnly={isReadOnly}
            isAssignedToMe={isAssignedToMe}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F05023" />
        </View>
      ) : feedback ? (
        <>
          <View className="bg-white">
            {/* Top bar */}
            <View className="w-full flex-row items-start justify-between px-4 py-4">
              <View className="flex-1 flex-row items-center">
                <Text className="mr-2 text-lg font-medium text-black">{feedback.name}</Text>
                <View
                  className={`self-start rounded-lg px-3 py-1 ${getStatusColor(feedback.status)}`}>
                  <Text className="text-xs font-bold text-white">
                    {getStatusLabel(feedback.status)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={handleGoBack}>
                <AntDesign name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            {/* Title - Hiển thị khác nhau cho Góp ý và Đánh giá */}
            <View className="mb-4 px-4">
              <Text className="text-xl font-medium text-[#E84A37]">
                {feedback.feedback_type === 'Đánh giá'
                  ? `Đánh giá - ${renderStars(feedback.rating || 0)}`
                  : feedback.title || 'Không có tiêu đề'}
              </Text>
            </View>

            {/* Action buttons - Only show for Mobile IT */}
            {!isReadOnly && (
              <View className="mb-6 flex-row items-center gap-4 pl-5">
                {/* Nút phân công người xử lý - chỉ hiện khi chưa đóng */}
                {!isClosed && (
                  <TouchableOpacity
                    onPress={openAssignModal}
                    disabled={actionLoading}
                    className="h-11 w-11 items-center justify-center rounded-full bg-yellow-500">
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <FontAwesome5 name="user-plus" size={16} color="white" />
                    )}
                  </TouchableOpacity>
                )}

                {/* Nút đóng feedback - chỉ hiện khi chưa đóng và đã có người xử lý */}
                {!isClosed && feedback.assigned_to && (
                  <TouchableOpacity
                    onPress={handleCloseFeedback}
                    disabled={actionLoading}
                    className="h-11 w-11 items-center justify-center rounded-full bg-green-600">
                    <AntDesign name="check" size={20} color="white" />
                  </TouchableOpacity>
                )}

                {/* Nút xóa feedback */}
                <TouchableOpacity
                  onPress={handleDeleteFeedback}
                  disabled={actionLoading}
                  className="h-11 w-11 items-center justify-center rounded-full bg-red-500">
                  <Ionicons name="trash-outline" size={20} color="white" />
                </TouchableOpacity>
              </View>
            )}

            {/* Read only badge for Mobile BOD */}
            {isReadOnly && (
              <View className="mx-4 mb-4 rounded-lg bg-gray-100 px-3 py-2">
                <Text className="text-center text-sm text-gray-500">
                  Bạn chỉ có quyền xem (Mobile BOD)
                </Text>
              </View>
            )}
          </View>

          {/* Tab Navigation */}
          <View className="flex-row border-b border-gray-200 pl-5">
            {[
              { key: 'information', label: 'Thông tin' },
              { key: 'processing', label: 'Xử lý' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className={`mr-6 py-3 ${activeTab === tab.key ? 'border-b-2 border-[#002855]' : ''}`}>
                <Text
                  className={activeTab === tab.key ? 'font-bold' : 'font-medium text-gray-400'}
                  style={{ color: activeTab === tab.key ? '#002855' : '#98A2B3' }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          <View className="flex-1">{renderContent()}</View>

          {/* Modals */}
          <FeedbackModals onAssignToUser={handleAssignToUser} />
        </>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-red-500">{error}</Text>
          <TouchableOpacity
            onPress={() => fetchFeedback(feedbackId)}
            className="mt-4 rounded-lg bg-blue-500 px-4 py-2">
            <Text className="font-medium text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

export default FeedbackDetailScreen;
