import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyTickets, type Ticket } from '../../services/ticketService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeVietnameseName } from '../../utils/nameFormatter';

type TicketScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Ticket'>;

interface TicketGuestScreenProps {
  isFromTab?: boolean;
}

const TicketGuestScreen = ({ isFromTab = false }: TicketGuestScreenProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchUserTickets();
  }, [filterStatus]);

  const fetchUserTickets = async (showLoading: boolean = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');

      if (!token || !userId) {
        console.log('Không tìm thấy token hoặc userId');
        setTickets([]);
        return;
      }

      const allTickets = await getMyTickets();

      // Apply client-side filtering
      let filteredTickets = allTickets;

      if (filterStatus) {
        filteredTickets = filteredTickets.filter((ticket) => ticket.status === filterStatus);
      }

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredTickets = filteredTickets.filter(
          (ticket) =>
            ticket.title?.toLowerCase().includes(searchLower) ||
            ticket.ticketCode?.toLowerCase().includes(searchLower) ||
            ticket.description?.toLowerCase().includes(searchLower)
        );
      }

      setTickets(filteredTickets);
    } catch (error) {
      console.error('Lỗi khi gọi API:', error);
      setTickets([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Assigned':
        return 'bg-[#002855]';
      case 'Processing':
        return 'bg-[#F59E0B]';
      case 'Done':
        return 'bg-[#BED232]';
      case 'Closed':
        return 'bg-[#009483]';
      case 'Cancelled':
        return 'bg-[#F05023]';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Assigned':
        return 'Đã tiếp nhận';
      case 'processing':
        return 'Đang xử lý';
      case 'Done':
        return 'Đã xử lý';
      case 'Closed':
        return 'Đã đóng';
      case 'Cancelled':
        return 'Đã hủy';
      default:
        return status;
    }
  };

  const handleViewTicketDetail = (ticketId: string) => {
    navigation.navigate('TicketGuestDetail', { ticketId });
  };

  const handleSearch = () => {
    fetchUserTickets();
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const applyFilter = (status: string) => {
    setFilterStatus(status);
    setShowFilters(false);
  };

  const renderItem = ({ item }: { item: Ticket }) => (
    <TouchableOpacity
      className="mb-3 rounded-xl bg-[#F8F8F8] p-4"
      onPress={() => handleViewTicketDetail(item._id)}>
      <View>
        <Text className="text-lg font-medium text-[#E84A37]">{item.title}</Text>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="mt-1 text-sm font-medium text-gray-500">
            {item.ticketCode || `Ticket-${item._id.padStart(3, '0')}`}
          </Text>
          <View>
            <Text className="text-right text-base font-medium text-[#757575]">
              {item.assignedTo
                ? normalizeVietnameseName(item.assignedTo.fullname)
                : 'Chưa phân công'}
            </Text>
          </View>
        </View>
        <View className="mt-2 flex-row items-center justify-between" style={{ flexWrap: 'nowrap' }}>
          <Text
            className="mr-3 flex-1 text-lg font-medium text-primary"
            numberOfLines={1}
            ellipsizeMode="tail">
            {item.creator ? normalizeVietnameseName(item.creator.fullname) : 'Không xác định'}
          </Text>
          <View
            className={`${getStatusColor(item.status)} rounded-lg px-3 py-1`}
            style={{ flexShrink: 0, minWidth: 90 }}>
            <Text className="text-center text-base font-medium text-white" numberOfLines={1}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const handleCreateTicket = () => {
    // Điều hướng đến màn hình tạo ticket
    navigation.navigate('TicketCreate');
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserTickets(false);
    setRefreshing(false);
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
      <View className="w-full flex-1">
        {/* Header với tiêu đề và nút back */}
        <View className="w-full flex-row items-center px-4 py-4">
          {!isFromTab && (
            <TouchableOpacity
              onPress={handleGoBack}
              className="-ml-2 mr-1 items-center justify-center p-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          )}
          <View className="flex-1 items-center justify-center">
            <Text className="text-xl font-medium">Ticket</Text>
          </View>
          {!isFromTab && <View style={{ width: 40 }} />}
        </View>

        {/* Ô tìm kiếm cải tiến với nút lọc */}
        <View className="px-4 py-2">
          <View className="flex-row items-center">
            <View className="flex-1 flex-row items-center rounded-2xl bg-gray-100 px-3 py-2">
              <Ionicons name="search" size={20} color="#666" />
              <TextInput
                placeholder="Tìm kiếm ticket..."
                className="ml-2 flex-1 text-base"
                value={searchTerm}
                onChangeText={setSearchTerm}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {searchTerm ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchTerm('');
                    handleSearch();
                  }}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-gray-100"
              onPress={toggleFilters}>
              <MaterialIcons name="filter-list" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bộ lọc trạng thái */}
        {showFilters && (
          <View className="mb-2 px-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2">
              <TouchableOpacity
                className={`mr-2 rounded-full px-3 py-1 ${filterStatus === '' ? 'bg-blue-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter('')}>
                <Text className={filterStatus === '' ? 'text-white' : 'text-gray-700'}>Tất cả</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`mr-2 rounded-full px-3 py-1 ${filterStatus === 'Open' ? 'bg-blue-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter('Open')}>
                <Text className={filterStatus === 'Open' ? 'text-white' : 'text-gray-700'}>
                  Chưa nhận
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`mr-2 rounded-full px-3 py-1 ${filterStatus === 'Processing' ? 'bg-yellow-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter('Processing')}>
                <Text className={filterStatus === 'Processing' ? 'text-white' : 'text-gray-700'}>
                  Đang xử lý
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`mr-2 rounded-full px-3 py-1 ${filterStatus === 'Waiting for Customer' ? 'bg-orange-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter('Waiting for Customer')}>
                <Text
                  className={
                    filterStatus === 'Waiting for Customer' ? 'text-white' : 'text-gray-700'
                  }>
                  Chờ phản hồi
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`mr-2 rounded-full px-3 py-1 ${filterStatus === 'Closed' ? 'bg-green-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter('Closed')}>
                <Text className={filterStatus === 'Closed' ? 'text-white' : 'text-gray-700'}>
                  Đã xử lý
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Danh sách ticket */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F05023" />
          </View>
        ) : tickets.length > 0 ? (
          <FlatList
            data={tickets}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16 }}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-center font-medium text-gray-500">
              Không tìm thấy ticket nào.
            </Text>
          </View>
        )}

        {/* Nút thêm mới ở dưới cùng */}
        <TouchableOpacity
          className="absolute bottom-[10%] right-[5%] h-14 w-14 items-center justify-center rounded-full bg-[#F05023] shadow-lg"
          onPress={handleCreateTicket}>
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default TicketGuestScreen;
