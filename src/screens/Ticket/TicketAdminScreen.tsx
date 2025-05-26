import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, SafeAreaView, TextInput, TouchableOpacity, FlatList, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../config/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TicketScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TicketAdminScreen'>;

interface Ticket {
    id: string;
    _id?: string;
    ticketCode?: string;
    title: string;
    description: string;
    status: string;
    date: string;
    priority: string;
    requester: string;
    creator?: {
        _id: string;
        fullname: string;
    };
    assignedTo?: {
        _id?: string;
        fullname: string;
    };
}

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
        fetchTickets();
    }, [filterStatus, filterRole, activeTab]);

    useFocusEffect(
        React.useCallback(() => {
            fetchTickets();
        }, [filterStatus, filterRole, activeTab])
    );

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            const userId = await AsyncStorage.getItem('userId');

            if (!token) {
                console.log('Không tìm thấy token');
                setTickets([]);
                return;
            }

            // Xây dựng URL với các tham số lọc
            let url = `${API_BASE_URL}/api/tickets`;

            // Thêm các tham số lọc
            const params = new URLSearchParams();
            if (filterStatus) {
                params.append('status', filterStatus);
            }
            if (searchTerm) {
                params.append('search', searchTerm);
            }

            // Logic lọc theo tab
            if (activeTab === 'assigned' && userId) {
                params.append('userTickets', userId);
            }

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            console.log('API URL:', url);
            console.log('Active Tab:', activeTab);
            console.log('User ID:', userId);

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.data.success) {
                const formattedTickets = res.data.tickets.map((ticket: any) => ({
                    id: ticket._id,
                    _id: ticket._id,
                    ticketCode: ticket.ticketCode || `Ticket-${ticket._id.substring(0, 3)}`,
                    title: ticket.title,
                    description: ticket.description || '',
                    status: ticket.status.toLowerCase(),
                    date: new Date(ticket.createdAt).toLocaleDateString('vi-VN'),
                    priority: ticket.priority.toLowerCase(),
                    requester: ticket.creator?.fullname || 'Không xác định',
                    creator: ticket.creator,
                    assignedTo: ticket.assignedTo
                }));

                setTickets(formattedTickets);
            } else {
                console.error('Lỗi khi lấy danh sách ticket:', res.data.message);
                setTickets([]);
            }
        } catch (error) {
            console.error('Lỗi khi gọi API:', error);
            setTickets([]);
        } finally {
            setLoading(false);
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
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
        switch (status) {
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


    const priorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'bg-red-100 text-red-800';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800';
            case 'low':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const priorityLabel = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'Cao';
            case 'medium':
                return 'Trung bình';
            case 'low':
                return 'Thấp';
            default:
                return priority;
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
            // Gọi lại API để lấy dữ liệu mới
            fetchTickets();
        }
    };

    return (
        <SafeAreaView
            className="flex-1 bg-white"
            style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
        >
            <View className="w-full flex-row items-center px-4 py-4">
                <TouchableOpacity onPress={handleGoBack} className="mr-3">
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View className="flex-1 items-center justify-center mr-[10%]">
                    <Text className="text-xl font-medium">Ticket</Text>
                </View>
            </View>

            {/* Tab Navigation */}
            <View className="flex-row px-4 pt-2 pb-5">
                <View className="flex-1 items-center">
                    <TouchableOpacity
                        onPress={() => toggleTab('all')}
                    >
                        <Text className={`text-center ${activeTab === 'all' ? 'text-[#002855] font-bold' : 'text-gray-500'}`}>
                            Tất cả Ticket
                        </Text>
                        {activeTab === 'all' && (
                            <View className="h-0.5 bg-[#002855] mt-2" />
                        )}
                    </TouchableOpacity>
                </View>
                <View className="flex-1 items-center">
                    <TouchableOpacity
                        onPress={() => toggleTab('assigned')}
                    >
                        <Text className={`text-center ${activeTab === 'assigned' ? 'text-[#002855] font-bold' : 'text-gray-500'}`}>
                            Ticket của tôi
                        </Text>
                        {activeTab === 'assigned' && (
                            <View className="h-0.5 bg-[#002855] mt-2" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            <View className="flex-1">
                {/* Ô tìm kiếm cải tiến với nút lọc */}
                <View className="px-4 py-2">
                    <View className="flex-row items-center">
                        <View className="flex-row items-center bg-gray-100 rounded-2xl px-3 py-2 flex-1">
                            <Ionicons name="search" size={20} color="#666" />
                            <TextInput
                                placeholder="Tìm kiếm ticket..."
                                className="flex-1 ml-2 text-base"
                                value={searchTerm}
                                onChangeText={setSearchTerm}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                            />
                            {searchTerm ? (
                                <TouchableOpacity onPress={() => {
                                    setSearchTerm('');
                                    handleSearch();
                                }}>
                                    <Ionicons name="close-circle" size={20} color="#666" />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        <TouchableOpacity
                            className="ml-2 bg-gray-100 rounded-full w-10 h-10 items-center justify-center"
                            onPress={toggleFilters}
                        >
                            <MaterialIcons name="filter-list" size={24} color="#666" />
                        </TouchableOpacity>

                    </View>
                </View>

                {/* Bộ lọc trạng thái */}
                {showFilters && (
                    <View className="px-4 mb-2">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2">
                            <TouchableOpacity
                                className={`mr-2 px-3 py-1 rounded-full ${filterStatus === '' ? 'bg-blue-500' : 'bg-gray-200'}`}
                                onPress={() => applyFilter('')}
                            >
                                <Text className={filterStatus === '' ? 'text-white' : 'text-gray-700'}>Tất cả</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`mr-2 px-3 py-1 rounded-full ${filterStatus === 'open' ? 'bg-blue-500' : 'bg-gray-200'}`}
                                onPress={() => applyFilter('open')}
                            >
                                <Text className={filterStatus === 'open' ? 'text-white' : 'text-gray-700'}>Chưa nhận</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`mr-2 px-3 py-1 rounded-full ${filterStatus === 'inProgress' ? 'bg-yellow-500' : 'bg-gray-200'}`}
                                onPress={() => applyFilter('inProgress')}
                            >
                                <Text className={filterStatus === 'inProgress' ? 'text-white' : 'text-gray-700'}>Đang xử lý</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`px-3 py-1 rounded-full ${filterStatus === 'resolved' ? 'bg-green-500' : 'bg-gray-200'}`}
                                onPress={() => applyFilter('resolved')}
                            >
                                <Text className={filterStatus === 'resolved' ? 'text-white' : 'text-gray-700'}>Đã xử lý</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                )}



                {/* Danh sách ticket */}
                {loading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#F05023" />
                    </View>
                ) : tickets.length > 0 ? (
                    <FlatList
                        data={tickets}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ padding: 16 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                className="bg-[#F8F8F8] rounded-xl p-4 mb-3"
                                onPress={() => handleViewTicketDetail(item.id)}
                            >
                                <View>
                                    <Text className="text-[#E84A37] font-medium text-lg">{item.title}</Text>
                                    <View className="flex-row justify-between items-center mt-2">
                                        <Text className="text-gray-500 text-sm font-medium mt-1">{item.ticketCode || `Ticket-${item.id.padStart(3, '0')}`}</Text>
                                        <View>
                                            <Text className="text-[#757575] text-base font-medium text-right">
                                                {item.assignedTo?.fullname || 'Chưa phân công'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View className="flex-row justify-between items-center mt-2">
                                        <View>
                                            <Text className="text-primary text-lg font-medium">
                                                {item.creator?.fullname || 'Không xác định'}
                                            </Text>
                                        </View>
                                        <View className={`${statusColor(item.status)} rounded-lg px-3 py-1`}>
                                            <Text className="text-white text-base font-medium">{statusLabel(item.status)}</Text>
                                        </View>

                                    </View>


                                </View>
                            </TouchableOpacity>
                        )}
                    />
                ) : (
                    <View className="flex-1 justify-center items-center p-4">
                        <Text className="text-gray-500 text-center font-medium">Không tìm thấy ticket nào.</Text>
                    </View>
                )}

                {/* Nút thêm mới ở dưới cùng */}
                <TouchableOpacity
                    className="absolute bottom-5 right-5 bg-orange-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
                    onPress={handleCreateTicket}
                >
                    <Ionicons name="add" size={30} color="white" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default TicketAdminScreen;
