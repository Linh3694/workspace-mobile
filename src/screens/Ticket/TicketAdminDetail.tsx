import React, { useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons, AntDesign, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Store & Hooks
import {
  useTicketStore,
  useTicketData,
  useTicketActions,
  useTicketUIActions,
} from '../../hooks/useTicketStore';

// Utils
import { toast } from '../../utils/toast';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import { getStatusColor, getStatusLabel } from '../../config/ticketConstants';

// Components
import TicketInformation from './components/TicketInformation';
import TicketProcessing from './components/TicketProcessing';
import TicketHistory from './components/TicketHistory';
import { TicketAdminModals } from './components/TicketModals';

import type { SupportTeamMember } from '../../services/ticketService';

type TicketDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'TicketAdminDetail'
>;

interface RouteParams {
  ticketId: string;
}

const TicketAdminDetail = () => {
  const navigation = useNavigation<TicketDetailScreenNavigationProp>();
  const route = useRoute();
  const { ticketId } = route.params as RouteParams;
  const insets = useSafeAreaInsets();

  // Local UI state for tabs
  const [activeTab, setActiveTab] = React.useState('information');

  // Global store
  const { ticket, loading, error } = useTicketData();
  const { fetchTicket, assignToMe, assignToUser, cancelTicket } = useTicketActions();
  const {
    openConfirmAssignModal,
    closeConfirmAssignModal,
    openAssignModal,
    closeAssignModal,
    openCancelModal,
  } = useTicketUIActions();
  const actionLoading = useTicketStore((state) => state.actionLoading);
  const ui = useTicketStore((state) => state.ui);
  const reset = useTicketStore((state) => state.reset);

  // Fetch ticket on mount
  useEffect(() => {
    fetchTicket(ticketId);

    // Reset store when unmount
    return () => {
      reset();
    };
  }, [ticketId]);

  // Refetch when screen comes back into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchTicket(ticketId);
    }, [ticketId])
  );

  const handleGoBack = () => {
    navigation.goBack();
  };

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleAssignToMe = async () => {
    closeConfirmAssignModal();
    const success = await assignToMe();
    if (success) {
      toast.success('Đã nhận ticket thành công!');
    } else {
      toast.error('Không thể nhận ticket');
    }
  };

  const handleAssignToUser = async (member: SupportTeamMember) => {
    const userId = member?.userObjectId || member?._id;
    if (!userId) {
      toast.error('Không tìm thấy thông tin người dùng');
      return;
    }

    closeAssignModal();
    const success = await assignToUser(userId, member.fullname);
    if (success) {
      const formattedName = normalizeVietnameseName(member.fullname);
      toast.success(`Đã chuyển cho ${formattedName}`);
    } else {
      toast.error('Không thể chuyển ticket');
    }
  };

  const handleCancelTicket = async () => {
    const reason = ui.cancelReason;
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do hủy');
      return;
    }

    const success = await cancelTicket(reason);
    if (success) {
      toast.success('Đã hủy ticket');
    } else {
      toast.error('Không thể hủy ticket');
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  const renderContent = () => {
    switch (activeTab) {
      case 'information':
        return <TicketInformation ticketId={ticketId} activeTab="information" />;
      case 'processing':
        return <TicketProcessing ticketId={ticketId} ticketCode={ticket?.ticketCode} />;
      case 'messaging':
        return <TicketInformation ticketId={ticketId} activeTab="messaging" />;
      case 'history':
        return <TicketHistory ticketId={ticketId} />;
      default:
        return null;
    }
  };

  const isTerminalStatus =
    ticket?.status?.toLowerCase() === 'cancelled' || ticket?.status?.toLowerCase() === 'closed';
  const isAssignedStatus = ticket?.status?.toLowerCase() === 'assigned';

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
      {/* Header */}
      {loading ? (
        <View className="p-4">
          <ActivityIndicator size="large" color="#F05023" />
        </View>
      ) : ticket ? (
        <View className="bg-white">
          <View className="w-full flex-row items-start justify-between px-4 py-4">
            <View className="flex-row items-center">
              <Text className="mr-2 font-medium text-lg text-black">{ticket.ticketCode}</Text>
              {ticket.feedback && ticket.feedback.rating && (
                <View className="flex-row items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FontAwesome
                      key={star}
                      name={star <= (ticket.feedback?.rating ?? 0) ? 'star' : 'star-o'}
                      size={14}
                      color="#FFD700"
                      style={{ marginHorizontal: 1 }}
                    />
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity onPress={handleGoBack}>
              <AntDesign name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>

          <View className="mb-4 px-4">
            <Text className="font-medium text-xl text-[#E84A37]">{ticket.title}</Text>
          </View>

          {/* Action buttons */}
          <View className="mb-6 flex-row items-center gap-4 pl-5">
            {/* Nút nhận ticket - chỉ hiện khi status = Assigned */}
            {isAssignedStatus && (
              <TouchableOpacity
                onPress={openConfirmAssignModal}
                disabled={actionLoading}
                className="h-11 w-11 items-center justify-center rounded-full bg-green-600">
                <Ionicons name="checkmark" size={24} color="white" />
              </TouchableOpacity>
            )}

            {/* Nút chuyển người xử lý */}
            {!isTerminalStatus && (
              <TouchableOpacity
                onPress={openAssignModal}
                disabled={actionLoading}
                className="h-11 w-11 items-center justify-center rounded-full bg-yellow-500">
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <FontAwesome5 name="sync-alt" size={16} color="white" />
                )}
              </TouchableOpacity>
            )}

            {/* Nút hủy ticket */}
            {!isTerminalStatus && (
              <TouchableOpacity
                onPress={openCancelModal}
                disabled={actionLoading}
                className="h-11 w-11 items-center justify-center rounded-full bg-red-600">
                <Ionicons name="square" size={16} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-red-500">{error}</Text>
          <TouchableOpacity
            onPress={() => fetchTicket(ticketId)}
            className="mt-4 rounded-lg bg-blue-500 px-4 py-2">
            <Text className="font-medium text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Tab Navigation */}
      <View className="flex-row pl-5">
        {[
          { key: 'information', label: 'Thông tin' },
          { key: 'processing', label: 'Tiến trình' },
          { key: 'messaging', label: 'Trao đổi' },
          { key: 'history', label: 'Lịch sử' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`mr-6 py-3 ${activeTab === tab.key ? 'border-b-2 border-black' : ''}`}>
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
      <TicketAdminModals
        onAssignToMe={handleAssignToMe}
        onAssignToUser={handleAssignToUser}
        onCancelTicket={handleCancelTicket}
      />
    </SafeAreaView>
  );
};

export default TicketAdminDetail;
