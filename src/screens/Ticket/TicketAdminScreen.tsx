import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
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

interface TicketAdminScreenProps {
  isFromTab?: boolean;
}

const TicketAdminScreen = ({ isFromTab = false }: TicketAdminScreenProps) => {
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
  const skipNextFetchRef = React.useRef(false);

  useEffect(() => {
    const loadUserId = async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);
    };
    loadUserId();
  }, []);

  useEffect(() => {
    // Skip nếu đã fetch từ toggleTab để tránh duplicate
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    if (userId) {
      fetchTickets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterRole, activeTab, userId]);

  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        fetchTickets();
      }
    }, [filterStatus, filterRole, activeTab, userId])
  );

  const fetchTickets = async (
    showLoading: boolean = true,
    options?: {
      overrideTab?: string;
      overrideSearch?: string;
      overrideStatus?: string;
    }
  ) => {
    try {
      if (showLoading) setLoading(true);

      // Sử dụng override nếu có, nếu không dùng state hiện tại
      const currentTab = options?.overrideTab ?? activeTab;
      const currentSearch = options?.overrideSearch ?? searchTerm;
      const currentStatus = options?.overrideStatus ?? filterStatus;

      console.log('Fetching all tickets...');
      console.log('Active Tab:', currentTab);

      const allTickets = await getAllTickets();

      // Apply client-side filtering
      let filteredTickets = allTickets;

      // Filter by status if specified
      if (currentStatus) {
        filteredTickets = filteredTickets.filter((ticket) => ticket.status === currentStatus);
      }

      // Filter by search term
      if (currentSearch) {
        const searchLower = currentSearch.toLowerCase();
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
      if (currentTab === 'assigned') {
        // Show tickets created by current user
        if (!userId) {
          tabFilteredTickets = [];
        } else {
          tabFilteredTickets = formattedTickets.filter((ticket) => {
            const matchById = ticket.creator && ticket.creator._id === userId;
            const matchByEmail = ticket.creator && ticket.creator.email === userId;
            return matchById || matchByEmail;
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
    // Nếu đang ở tab "Ticket của tôi", user đóng vai trò guest (người tạo ticket cần hỗ trợ)
    // nên navigate đến TicketGuestDetail thay vì TicketAdminDetail
    if (activeTab === 'assigned') {
      navigation.navigate('TicketGuestDetail', { ticketId });
    } else {
      navigation.navigate('TicketAdminDetail', { ticketId });
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleCreateTicket = () => {
    navigation.navigate('TicketCreate');
  };

  const toggleTab = (tab: string) => {
    if (activeTab !== tab) {
      // Đặt lại các filter khi chuyển tab
      setFilterStatus('');
      setFilterRole('');
      setShowFilters(false);
      setShowRoleFilters(false);
      setSearchTerm('');
      setActiveTab(tab);

      // Fetch ngay với override options để đảm bảo sử dụng giá trị mới
      if (userId) {
        // Skip useEffect fetch vì đã fetch ở đây
        skipNextFetchRef.current = true;
        fetchTickets(true, {
          overrideTab: tab,
          overrideSearch: '',
          overrideStatus: '',
        });
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
        {!isFromTab ? (
          <TouchableOpacity onPress={handleGoBack} className="p-2">
            <Ionicons name="chevron-back" size={24} color="#0A2240" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text className="flex-1 text-center text-2xl font-bold text-[#0A2240]">Ticket</Text>
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
                  <Text className="text-lg font-medium text-[#E84A37]">{item.title}</Text>
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="mt-1 text-sm font-medium text-gray-500">
                      {item.ticketCode || `Ticket-${item._id.slice(-3).padStart(3, '0')}`}
                    </Text>
                    <View>
                      <Text className="text-right text-base font-medium text-[#757575]">
                        {item.assignedTo
                          ? normalizeVietnameseName(item.assignedTo.fullname)
                          : 'Chưa phân công'}
                      </Text>
                    </View>
                  </View>
                  <View
                    className="mt-2 flex-row items-center justify-between"
                    style={{ flexWrap: 'nowrap' }}>
                    <Text
                      className="mr-3 flex-1 text-lg font-medium text-primary"
                      numberOfLines={1}
                      ellipsizeMode="tail">
                      {item.creator
                        ? normalizeVietnameseName(item.creator.fullname)
                        : 'Không xác định'}
                    </Text>
                    <View
                      className={`${getStatusColor(item.status)} rounded-lg px-3 py-1`}
                      style={{ flexShrink: 0, minWidth: 90 }}>
                      <Text
                        className="text-center text-base font-medium text-white"
                        numberOfLines={1}>
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
          className="absolute bottom-[10%] right-[5%] h-14 w-14 items-center justify-center rounded-full bg-orange-500 shadow-lg"
          onPress={handleCreateTicket}>
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default TicketAdminScreen;
