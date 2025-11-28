import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons, MaterialIcons, AntDesign, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import { API_BASE_URL } from '../../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TicketInformation from './components/TicketInformation';
import TicketHistory from './components/TicketHistory';
import TicketProcessingGuest from './components/TicketProcessingGuest';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTicketDetail } from '../../hooks/useTicketHooks';
import type { Ticket } from '../../services/ticketService';

type TicketDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'TicketDetail'
>;

interface RouteParams {
  ticketId: string;
}


const TicketGuestDetail = () => {
  const navigation = useNavigation<TicketDetailScreenNavigationProp>();
  const route = useRoute();
  const { ticketId } = route.params as RouteParams;
  const [activeTab, setActiveTab] = useState('information');
  const insets = useSafeAreaInsets();

  // Use new hooks for data fetching
  const { ticket, loading, error, refetch } = useTicketDetail(ticketId);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'information':
        return <TicketInformation ticketId={ticketId} activeTab="information" />;
      case 'processing':
        return <TicketProcessingGuest ticketId={ticketId} />;
      case 'messaging':
        return <TicketInformation ticketId={ticketId} activeTab="messaging" />;
      case 'history':
        return <TicketHistory ticketId={ticketId} />;
      default:
        return null;
    }
  };

  const statusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'assigned':
        return 'bg-[#002855]';
      case 'processing':
        return 'bg-[#F59E0B]';
      case 'done':
        return 'bg-[#BED232]';
      case 'closed':
        return 'bg-[#009483]';
      case 'cancelled':
        return 'bg-[#F05023]';
      default:
        return 'bg-gray-500';
    }
  };

  const statusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'assigned':
        return 'Đã tiếp nhận';
      case 'processing':
        return 'Đang xử lý';
      case 'done':
        return 'Đã xử lý';
      case 'closed':
        return 'Đã đóng';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status;
    }
  };

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
            <Text className="font-medium text-lg text-black">{ticket.ticketCode}</Text>
            <TouchableOpacity onPress={handleGoBack}>
              <AntDesign name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>

          <View className="mb-4 px-4">
            <Text className="font-medium text-xl text-[#E84A37]">{ticket.title}</Text>
          </View>
        </View>
      ) : null}

      {/* Tab Navigation */}
      <View className="flex-row pl-5 ">
        <TouchableOpacity
          key="information-tab"
          onPress={() => setActiveTab('information')}
          className={`mr-6 py-3 ${activeTab === 'information' ? 'border-b-2 border-black' : ''}`}>
          <Text
            className={activeTab === 'information' ? 'font-bold text-[#002855]' : 'font-medium text-gray-400'}>
            Thông tin
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          key="messaging-tab"
          onPress={() => setActiveTab('messaging')}
          className={`mr-6 py-3 ${activeTab === 'messaging' ? 'border-b-2 border-black' : ''}`}>
          <Text
            className={activeTab === 'messaging' ? 'font-bold text-[#002855]' : 'font-medium text-gray-400'}>
            Trao đổi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          key="processing-tab"
          onPress={() => setActiveTab('processing')}
          className={`mr-6 py-3 ${activeTab === 'processing' ? 'border-b-2 border-black' : ''}`}>
          <Text
            className={activeTab === 'processing' ? 'font-bold text-[#002855]' : 'font-medium text-gray-400'}>
            Tiến trình
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          key="history-tab"
          onPress={() => setActiveTab('history')}
          className={`py-3 ${activeTab === 'history' ? 'border-b-2 border-black' : ''}`}>
          <Text
            className={activeTab === 'history' ? 'font-bold text-[#002855]' : 'font-medium text-gray-400'}>
            Lịch sử
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View className="flex-1">{renderContent()}</View>
    </SafeAreaView>
  );
};

export default TicketGuestDetail;
