import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, SafeAreaView, TextInput, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../config/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TicketScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Ticket'>;

interface Ticket {
    _id: string;
    ticketCode: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    assignedTo?: {
        fullname: string;
    };
    creator?: {
        _id: string;
        fullname: string;
    };
}

const TicketGuestScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchUserTickets();
    }, [filterStatus]);

    const fetchUserTickets = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            const userId = await AsyncStorage.getItem('userId');

            if (!token || !userId) {
                console.log('Không tìm thấy token hoặc userId');
                setTickets([]);
                return;
            }

            // Xây dựng URL với các tham số lọc
            let url = `${API_BASE_URL}/api/tickets`;

            // Thêm userId vào URL để lọc chỉ lấy ticket do user tạo
            url += `?creator=${userId}`;

            // Thêm các tham số lọc khác
            if (filterStatus) {
                url += `&status=${filterStatus}`;
            }
            if (searchTerm) {
                url += `&search=${searchTerm}`;
            }

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.data.success) {
                setTickets(res.data.tickets || []);
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
            className="bg-[#F8F8F8] rounded-xl p-4 mb-3"
            onPress={() => handleViewTicketDetail(item._id)}
        >
            <View>
                <Text className="text-[#E84A37] font-medium text-lg">{item.title}</Text>
                <View className="flex-row justify-between items-center mt-2">
                    <Text className="text-gray-500 text-sm font-medium mt-1">{item.ticketCode || `Ticket-${item._id.padStart(3, '0')}`}</Text>
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
                    <View className={`${getStatusColor(item.status)} rounded-lg px-3 py-1`}>
                        <Text className="text-white text-base font-medium">{getStatusLabel(item.status)}</Text>
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

    return (
        <SafeAreaView
            className="flex-1 bg-white"
            style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
        >
            <View className="w-full flex-1 pb-16">
                {/* Header với tiêu đề và nút back */}
                <View className="w-full flex-row items-center px-4 py-4">
                    <TouchableOpacity onPress={handleGoBack} className="mr-3">
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <View className="flex-1 items-center justify-center">
                        <Text className="text-xl font-medium">Ticket</Text>
                    </View>
                </View>

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
                                className={`mr-2 px-3 py-1 rounded-full ${filterStatus === 'Open' ? 'bg-blue-500' : 'bg-gray-200'}`}
                                onPress={() => applyFilter('Open')}
                            >
                                <Text className={filterStatus === 'Open' ? 'text-white' : 'text-gray-700'}>Chưa nhận</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`mr-2 px-3 py-1 rounded-full ${filterStatus === 'Processing' ? 'bg-yellow-500' : 'bg-gray-200'}`}
                                onPress={() => applyFilter('Processing')}
                            >
                                <Text className={filterStatus === 'Processing' ? 'text-white' : 'text-gray-700'}>Đang xử lý</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`mr-2 px-3 py-1 rounded-full ${filterStatus === 'Waiting for Customer' ? 'bg-orange-500' : 'bg-gray-200'}`}
                                onPress={() => applyFilter('Waiting for Customer')}
                            >
                                <Text className={filterStatus === 'Waiting for Customer' ? 'text-white' : 'text-gray-700'}>Chờ phản hồi</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`mr-2 px-3 py-1 rounded-full ${filterStatus === 'Closed' ? 'bg-green-500' : 'bg-gray-200'}`}
                                onPress={() => applyFilter('Closed')}
                            >
                                <Text className={filterStatus === 'Closed' ? 'text-white' : 'text-gray-700'}>Đã xử lý</Text>
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
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        contentContainerStyle={{ padding: 16 }}
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

export default TicketGuestScreen;
