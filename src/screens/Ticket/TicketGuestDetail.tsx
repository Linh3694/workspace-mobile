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
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Store & Hooks
import { useTicketStore, useTicketData, useTicketActions } from '../../hooks/useTicketStore';

// Components
import TicketInformation from './components/TicketInformation';
import TicketHistory from './components/TicketHistory';
import TicketProcessingGuest from './components/TicketProcessingGuest';

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
  const insets = useSafeAreaInsets();

  // Local UI state for tabs
  const [activeTab, setActiveTab] = React.useState('information');

  // Global store
  const { ticket, loading, error } = useTicketData();
  const { fetchTicket } = useTicketActions();
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
              className={activeTab === tab.key ? 'font-bold text-[#002855]' : 'font-medium text-gray-400'}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View className="flex-1">{renderContent()}</View>
    </SafeAreaView>
  );
};

export default TicketGuestDetail;
