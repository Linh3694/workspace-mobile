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
import {
  getAllAdminTickets,
  getMyAdminSubTasks,
  updateAdminSubTaskStatus,
  type AdministrativeTicket,
  type MyAdminSubTask,
  type MyAdminSubTasksResult,
} from '../../services/administrativeTicketService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import {
  getAdminTicketStatusLabel,
  getAdminTicketStatusColorClass,
  isAdminSubTaskOpen,
  ADMIN_TICKET_FILTER_STATUSES,
} from '../../config/administrativeTicketConstants';
import { ROUTES } from '../../constants/routes';
import { toast } from '../../utils/toast';
import MyWorkTicketCard from './components/MyWorkTicketCard';
import { SubTaskStatusSheet } from './components/TicketModals';

type TicketScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.ADMINISTRATIVE_TICKET_ADMIN
>;

/** 'all' = tất cả ticket · 'assigned' = ticket tôi tạo · 'mywork' = ticket có công việc con giao cho tôi */
type AdminTicketTab = 'all' | 'assigned' | 'mywork';

interface TicketAdminScreenProps {
  isFromTab?: boolean;
}

const TicketAdminScreen = ({ isFromTab = false }: TicketAdminScreenProps) => {
  const navigation = useNavigation<TicketScreenNavigationProp>();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  const [tickets, setTickets] = useState<
    Array<{
      id: string;
      _id: string;
      ticketCode: string;
      title: string;
      description: string;
      status: string;
      date: string;
      priority: string;
      requester: string;
      creator?: AdministrativeTicket['creator'];
      assignedTo?: AdministrativeTicket['assignedTo'];
    }>
  >([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRole, setFilterRole] = useState(''); // 'assigned', 'created', hoặc ''
  const [showFilters, setShowFilters] = useState(false);
  const [showRoleFilters, setShowRoleFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTicketTab>('all');
  // Tab "Việc của tôi" — công việc con được giao cho tôi, gom theo ticket cha.
  const [myWorkData, setMyWorkData] = useState<MyAdminSubTasksResult | null>(null);
  const [myWorkError, setMyWorkError] = useState<string | null>(null);
  const [selectedSubTask, setSelectedSubTask] = useState<MyAdminSubTask | null>(null);
  const [pendingSubTaskId, setPendingSubTaskId] = useState<string | null>(null);
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

  // Badge "Việc của tôi" phải hiện kể cả khi user đang đứng ở tab khác, nên nạp
  // riêng. Cố ý KHÔNG gộp vào effect trên: effect đó phụ thuộc filterStatus nên sẽ
  // gọi lại API mỗi lần bấm chip trạng thái của tab "Tất cả". Đọc tab qua ref để
  // khỏi gọi trùng khi chính tab đó đang mở (lúc ấy fetchTickets đã nạp rồi).
  const activeTabRef = React.useRef(activeTab);
  activeTabRef.current = activeTab;

  const prefetchMyWorkBadge = React.useCallback(() => {
    if (userId && activeTabRef.current !== 'mywork') {
      fetchMyWork(false);
    }
  }, [userId]);

  useEffect(prefetchMyWorkBadge, [prefetchMyWorkBadge]);

  useFocusEffect(prefetchMyWorkBadge);

  const fetchMyWork = async (showLoading: boolean = true) => {
    try {
      if (showLoading) setLoading(true);
      setMyWorkError(null);
      const data = await getMyAdminSubTasks();
      setMyWorkData(data);
    } catch (error) {
      console.error('getMyAdminSubTasks', error);
      setMyWorkError(
        error instanceof Error ? error.message : 'Không tải được danh sách công việc'
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchTickets = async (
    showLoading: boolean = true,
    options?: {
      overrideTab?: AdminTicketTab;
      overrideSearch?: string;
      overrideStatus?: string;
    }
  ) => {
    // Sử dụng override nếu có, nếu không dùng state hiện tại
    const currentTab = options?.overrideTab ?? activeTab;
    // Tab "Việc của tôi" dùng endpoint riêng — không đụng tới getAllAdminTickets.
    if (currentTab === 'mywork') {
      return fetchMyWork(showLoading);
    }

    try {
      if (showLoading) setLoading(true);

      const currentSearch = options?.overrideSearch ?? searchTerm;
      const currentStatus = options?.overrideStatus ?? filterStatus;

      const allTickets = await getAllAdminTickets();

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
        status: ticket.status,
        date: ticket.createdAt
          ? new Date(ticket.createdAt).toLocaleDateString('vi-VN')
          : '',
        priority: (ticket.priority || 'Medium').toLowerCase(),
        requester: ticket.creator
          ? normalizeVietnameseName(ticket.creator.fullname || '')
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
    // Tab "Việc của tôi" lọc hoàn toàn client-side (myWorkGroups) nên không cần gọi lại API.
    if (activeTab === 'mywork') return;
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
      navigation.navigate(ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST_DETAIL, { ticketId });
    } else {
      navigation.navigate(ROUTES.SCREENS.ADMINISTRATIVE_TICKET_ADMIN_DETAIL, { ticketId });
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleCreateTicket = () => {
    navigation.navigate(ROUTES.SCREENS.ADMINISTRATIVE_TICKET_CREATE);
  };

  /**
   * Đổi trạng thái công việc con ngay tại list, optimistic + rollback khi lỗi.
   *
   * Không refetch sau khi thành công: update_subtask không trả về document nào để
   * merge, và endpoint mặc định chỉ trả ticket còn việc chưa xong nên refetch ngay
   * sẽ giật dòng vừa bấm ra khỏi màn hình. Để nó rụng ở lần refresh kế tiếp.
   */
  const handleUpdateMySubTaskStatus = async (subTask: MyAdminSubTask, newStatus: string) => {
    if (newStatus === subTask.status) return;

    const snapshot = myWorkData;
    if (!snapshot) return;

    const nextTickets = snapshot.tickets.map((group) => {
      if (group._id !== subTask.ticketId) return group;
      const subTasks = group.subTasks.map((s) =>
        s._id === subTask._id ? { ...s, status: newStatus } : s
      );
      return {
        ...group,
        subTasks,
        openCount: subTasks.filter((s) => isAdminSubTaskOpen(s.status)).length,
      };
    });

    setPendingSubTaskId(subTask._id);
    setMyWorkData({
      ...snapshot,
      tickets: nextTickets,
      // Tính lại từ groups local thay vì giữ số của server, nếu không badge và list
      // sẽ lệch nhau ngay sau lần cập nhật đầu tiên.
      totalOpenSubTasks: nextTickets.reduce((sum, g) => sum + g.openCount, 0),
    });

    try {
      await updateAdminSubTaskStatus(subTask.ticketId, subTask._id, newStatus);
      toast.success('Cập nhật thành công!');
    } catch (error) {
      setMyWorkData(snapshot);
      toast.error(
        error instanceof Error ? error.message : 'Lỗi cập nhật công việc con'
      );
    } finally {
      setPendingSubTaskId(null);
    }
  };

  const toggleTab = (tab: AdminTicketTab) => {
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

  const isMyWorkTab = activeTab === 'mywork';
  const myWorkOpenCount = myWorkData?.totalOpenSubTasks || 0;

  // Search client-side trên cả tiêu đề ticket lẫn tiêu đề công việc con — user
  // thường nhớ tên việc mình phải làm hơn là tên ticket cha.
  const myWorkGroups = React.useMemo(() => {
    const groups = myWorkData?.tickets || [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter(
      (g) =>
        g.title?.toLowerCase().includes(term) ||
        g.ticketCode?.toLowerCase().includes(term) ||
        g.subTasks.some((s) => s.title?.toLowerCase().includes(term))
    );
  }, [myWorkData, searchTerm]);

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
        <View className="flex-1 items-center justify-center">
          <Text className="text-center text-2xl font-bold text-[#0A2240]">Tickets</Text>
          {/* Phân biệt module Hành chính (Frappe) với ticket IT */}
          <Text className="mt-0.5 text-center text-xs font-medium text-[#5A6575]">
            (Hành chính dịch vụ)
          </Text>
        </View>
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
        <View className="flex-1 items-center">
          <TouchableOpacity key="mywork-tab" onPress={() => toggleTab('mywork')}>
            <View className="flex-row items-center justify-center">
              <Text
                className={
                  activeTab === 'mywork'
                    ? 'text-center font-bold text-[#002855]'
                    : 'text-center font-medium text-gray-500'
                }>
                Việc của tôi
              </Text>
              {myWorkOpenCount > 0 ? (
                <View className="ml-1.5 min-w-[20px] items-center rounded-full bg-[#F05023] px-1.5 py-0.5">
                  <Text className="text-xs font-bold text-white">
                    {myWorkOpenCount > 99 ? '99+' : myWorkOpenCount}
                  </Text>
                </View>
              ) : null}
            </View>
            {activeTab === 'mywork' && <View className="mt-2 h-0.5 bg-[#002855]" />}
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
                placeholder={isMyWorkTab ? 'Tìm kiếm công việc...' : 'Tìm kiếm ticket...'}
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
                    if (!isMyWorkTab) handleSearch();
                  }}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              ) : null}
            </View>
            {/* Chip lọc là trạng thái TICKET nên vô nghĩa ở tab "Việc của tôi". */}
            {!isMyWorkTab ? (
              <TouchableOpacity
                className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                onPress={toggleFilters}>
                <MaterialIcons name="filter-list" size={24} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Bộ lọc trạng thái */}
        {showFilters && !isMyWorkTab && (
          <View className="mb-2 px-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2">
              <TouchableOpacity
                className={`mr-2 rounded-full px-3 py-1 ${filterStatus === '' ? 'bg-blue-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter('')}>
                <Text className={filterStatus === '' ? 'text-white' : 'text-gray-700'}>Tất cả</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`mr-2 rounded-full px-3 py-1 ${filterStatus === ADMIN_TICKET_FILTER_STATUSES.ASSIGNED ? 'bg-blue-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter(ADMIN_TICKET_FILTER_STATUSES.ASSIGNED)}>
                <Text
                  className={
                    filterStatus === ADMIN_TICKET_FILTER_STATUSES.ASSIGNED ? 'text-white' : 'text-gray-700'
                  }>
                  Đã tiếp nhận
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`mr-2 rounded-full px-3 py-1 ${filterStatus === ADMIN_TICKET_FILTER_STATUSES.IN_PROGRESS ? 'bg-yellow-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter(ADMIN_TICKET_FILTER_STATUSES.IN_PROGRESS)}>
                <Text
                  className={
                    filterStatus === ADMIN_TICKET_FILTER_STATUSES.IN_PROGRESS ? 'text-white' : 'text-gray-700'
                  }>
                  Đang xử lý
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`rounded-full px-3 py-1 ${filterStatus === ADMIN_TICKET_FILTER_STATUSES.DONE ? 'bg-green-500' : 'bg-gray-200'}`}
                onPress={() => applyFilter(ADMIN_TICKET_FILTER_STATUSES.DONE)}>
                <Text
                  className={
                    filterStatus === ADMIN_TICKET_FILTER_STATUSES.DONE ? 'text-white' : 'text-gray-700'
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
        ) : isMyWorkTab ? (
          myWorkError ? (
            <View className="flex-1 items-center justify-center p-4">
              <Text className="mb-3 text-center font-medium text-gray-500">{myWorkError}</Text>
              <TouchableOpacity
                onPress={() => fetchMyWork()}
                className="rounded-full bg-[#002855] px-5 py-2">
                <Text className="font-medium text-white">Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : myWorkGroups.length > 0 ? (
            <FlatList
              data={myWorkGroups}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ padding: 16 }}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={({ item }) => (
                <MyWorkTicketCard
                  group={item}
                  pendingSubTaskId={pendingSubTaskId}
                  onPressSubTask={setSelectedSubTask}
                  onOpenTicket={
                    myWorkData?.canOpenTicketDetail
                      ? (ticketId) =>
                          navigation.navigate(
                            ROUTES.SCREENS.ADMINISTRATIVE_TICKET_ADMIN_DETAIL,
                            { ticketId }
                          )
                      : undefined
                  }
                />
              )}
            />
          ) : (
            <View className="flex-1 items-center justify-center p-4">
              <Text className="text-center font-medium text-gray-500">
                {searchTerm
                  ? 'Không tìm thấy công việc nào.'
                  : 'Bạn chưa được giao công việc con nào.'}
              </Text>
              {!searchTerm ? (
                <Text className="mt-1 text-center text-sm text-gray-400">
                  Công việc con được giao trong tab Tiến trình của từng ticket.
                </Text>
              ) : null}
            </View>
          )
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
                      className={`${getAdminTicketStatusColorClass(item.status)} rounded-lg px-3 py-1`}
                      style={{ flexShrink: 0, minWidth: 90 }}>
                      <Text
                        className="text-center text-base font-medium text-white"
                        numberOfLines={1}>
                        {getAdminTicketStatusLabel(item.status) || item.status}
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

        {/* Nút thêm mới ở dưới cùng — tab "Việc của tôi" không tạo ticket. */}
        {!isMyWorkTab ? (
          <TouchableOpacity
            className="absolute bottom-[10%] right-[5%] h-14 w-14 items-center justify-center rounded-full bg-orange-500 shadow-lg"
            onPress={handleCreateTicket}>
            <Ionicons name="add" size={30} color="white" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Đổi trạng thái công việc con ngay tại list.
          - controlled (visible/onClose) vì store ticket detail scope theo 1 ticket,
            còn ở đây mỗi dòng thuộc một ticket khác nhau.
          - canComplete luôn true: mọi công việc con trong tab này đều do chính user
            phụ trách, mà backend cho PIC công việc con đánh dấu hoàn thành.
          - allSubTasks chỉ gồm đúng nó để sheet không gán nhãn "Chờ xử lý" theo vị
            trí trong hàng đợi — thứ tự ở đây đã bị lọc còn mỗi việc của tôi. */}
      <SubTaskStatusSheet
        subTask={selectedSubTask}
        allSubTasks={selectedSubTask ? [selectedSubTask] : []}
        canComplete
        visible={!!selectedSubTask}
        onClose={() => setSelectedSubTask(null)}
        onSelect={(value) => {
          if (selectedSubTask) {
            handleUpdateMySubTaskStatus(selectedSubTask, value);
          }
        }}
      />
    </SafeAreaView>
  );
};

export default TicketAdminScreen;
