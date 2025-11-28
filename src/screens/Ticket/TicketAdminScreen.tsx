import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllTickets, type Ticket } from '../../services/ticketService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import { getStatusLabel, getStatusColor, TICKET_STATUSES } from '../../config/ticketConstants';

type TicketScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'TicketAdminScreen'
>;

const TicketAdminScreen = () => {
  const navigation = useNavigation<TicketScreenNavigationProp>();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRole, setFilterRole] = useState(''); // 'assigned', 'created', hoặc ''
  const [showFilters, setShowFilters] = useState(false);
  const [showRoleFilters, setShowRoleFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' hoặc 'assigned'
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const loadUserId = async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);
    };
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchTickets();
    }
  }, [filterStatus, filterRole, activeTab, userId]);

  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        fetchTickets();
      }
    }, [filterStatus, filterRole, activeTab, userId])
  );

  const fetchTickets = async (showLoading: boolean = true) => {
    try {
      if (showLoading) setLoading(true);

      console.log('Fetching all tickets...');
      console.log('Active Tab:', activeTab);

      const allTickets = await getAllTickets();

      // Apply client-side filtering
      let filteredTickets = allTickets;

      // Filter by status if specified
      if (filterStatus) {
        filteredTickets = filteredTickets.filter((ticket) => ticket.status === filterStatus);
      }

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredTickets = filteredTickets.filter(
          (ticket) =>
            ticket.title?.toLowerCase().includes(searchLower) ||
            ticket.ticketCode?.toLowerCase().includes(searchLower) ||
            ticket.description?.toLowerCase().includes(searchLower)
        );
      }

      const formattedTickets = filteredTickets.map((ticket) => ({
        id: ticket._id,
        _id: ticket._id,
        ticketCode: ticket.ticketCode || `Ticket-${ticket._id.substring(0, 3)}`,
        title: ticket.title,
        description: ticket.description || '',
        status: ticket.status.toLowerCase(),
        date: new Date(ticket.createdAt).toLocaleDateString('vi-VN'),
        priority: ticket.priority.toLowerCase(),
        requester: ticket.creator
          ? normalizeVietnameseName(
              ticket.creator.fullname || ticket.creator.full_name || ticket.creator.name
            )
          : 'Không xác định',
        creator: ticket.creator,
        assignedTo: ticket.assignedTo,
      }));

      // Apply additional tab filtering
      let tabFilteredTickets = formattedTickets;
      if (activeTab === 'assigned') {
        // Show tickets created by current user

        if (!userId) {
          tabFilteredTickets = [];
        } else {
          tabFilteredTickets = formattedTickets.filter((ticket) => {
            const matchById = ticket.creator && ticket.creator._id === userId;
            const matchByEmail = ticket.creator && ticket.creator.email === userId;
            const match = matchById || matchByEmail;
            console.log(
              '🔍 [TicketAdminScreen] Ticket:',
              ticket._id,
              'Creator ID:',
              ticket.creator?._id,
              'Creator Email:',
              ticket.creator?.email,
              'User ID:',
              userId,
              'Match:',
              match
            );
            return match;
          });
        }
      }

      setTickets(tabFilteredTickets);
    } catch (error) {
      console.error('Lỗi khi gọi API:', error);
      setTickets([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchTickets();
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
    setShowRoleFilters(false);
  };

  const toggleRoleFilters = () => {
    setShowRoleFilters(!showRoleFilters);
    setShowFilters(false);
  };

  const applyFilter = (status: string) => {
    setFilterStatus(status);
    setShowFilters(false);
  };

  const applyRoleFilter = (role: string) => {
    setFilterRole(role);
    setShowRoleFilters(false);
  };

  const handleViewTicketDetail = (ticketId: string) => {
    navigation.navigate('TicketAdminDetail', { ticketId });
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleCreateTicket = () => {
    navigation.navigate('TicketCreate');
  };

  const toggleTab = (tab: string) => {
    if (activeTab !== tab) {
      setActiveTab(tab);
      // Đặt lại các filter khi chuyển tab
      setFilterStatus('');
      setFilterRole('');
      setShowFilters(false);
      setShowRoleFilters(false);
      setSearchTerm('');
      // Gọi lại API để lấy dữ liệu mới (chỉ khi userId đã có)
      if (userId) {
        fetchTickets();
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTickets(false);
    setRefreshing(false);
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
      <View className="mb-5 mt-6 flex-row items-center justify-between px-5">
        <TouchableOpacity onPress={handleGoBack} className="p-2">
          <Ionicons name="chevron-back" size={24} color="#0A2240" />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-bold text-2xl text-[#0A2240]">Ticket</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab Navigation */}
      <View className="flex-row px-4 pb-5 pt-2">
        <View className="flex-1 items-center">
          <TouchableOpacity key="all-tab" onPress={() => toggleTab('all')}>
            <Text
              className={
                activeTab === 'all'
                  ? 'text-center font-bold text-[#002855]'
                  : 'text-center font-medium text-gray-500'
              }>
              Tất cả Ticket
            </Text>
            {activeTab === 'all' && <View className="mt-2 h-0.5 bg-[#002855]" />}
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center">
          <TouchableOpacity key="assigned-tab" onPress={() => toggleTab('assigned')}>
            <Text
              className={
                activeTab === 'assigned'
                  ? 'text-center font-bold text-[#002855]'
                  : 'text-center font-medium text-gray-500'
              }>
              Ticket của tôi
            </Text>
            {activeTab === 'assigned' && <View className="mt-2 h-0.5 bg-[#002855]" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View className="flex-1">
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
                className={`mr-2 rounded-full px-3 py-1 ${filterStatus === TICKET_STATUSES.ASSIGNED ? 'bg-blue-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter(TICKET_STATUSES.ASSIGNED)}>
                <Text
                  className={
                    filterStatus === TICKET_STATUSES.ASSIGNED ? 'text-white' : 'text-gray-700'
                  }>
                  Đã tiếp nhận
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`mr-2 rounded-full px-3 py-1 ${filterStatus === TICKET_STATUSES.PROCESSING ? 'bg-yellow-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter(TICKET_STATUSES.PROCESSING)}>
                <Text
                  className={
                    filterStatus === TICKET_STATUSES.PROCESSING ? 'text-white' : 'text-gray-700'
                  }>
                  Đang xử lý
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`rounded-full px-3 py-1 ${filterStatus === TICKET_STATUSES.DONE ? 'bg-green-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter(TICKET_STATUSES.DONE)}>
                <Text
                  className={
                    filterStatus === TICKET_STATUSES.DONE ? 'text-white' : 'text-gray-700'
                  }>
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
            contentContainerStyle={{ padding: 16 }}
            refreshing={refreshing}
            onRefresh={onRefresh}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="mb-3 rounded-xl bg-[#F8F8F8] p-4"
                onPress={() => handleViewTicketDetail(item._id)}>
                <View>
                  <Text className="font-medium text-lg text-[#E84A37]">{item.title}</Text>
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="mt-1 font-medium text-sm text-gray-500">
                      {item.ticketCode || `Ticket-${item._id.slice(-3).padStart(3, '0')}`}
                    </Text>
                    <View>
                      <Text className="text-right font-medium text-base text-[#757575]">
                        {item.assignedTo
                          ? normalizeVietnameseName(item.assignedTo.fullname)
                          : 'Chưa phân công'}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-2 flex-row items-center justify-between">
                    <View>
                      <Text className="font-medium text-lg text-primary">
                        {item.creator
                          ? normalizeVietnameseName(item.creator.fullname)
                          : 'Không xác định'}
                      </Text>
                    </View>
                    <View className={`${getStatusColor(item.status)} rounded-lg px-3 py-1`}>
                      <Text className="font-medium text-base text-white">
                        {getStatusLabel(item.status) || item.status}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
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
          className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-full bg-orange-500 shadow-lg"
          onPress={handleCreateTicket}>
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default TicketAdminScreen;
