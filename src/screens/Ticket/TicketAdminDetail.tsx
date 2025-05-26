import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons, MaterialIcons, AntDesign, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import axios from 'axios';
import { API_BASE_URL } from '../../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TicketInformation from './components/TicketInformation';
import TicketProcessing from './components/TicketProcessing';
import TicketChat from './components/TicketChat';
import TicketHistory from './components/TicketHistory';
import { Modal, FlatList } from 'react-native';
import SelectModal from '../../components/SelectModal';
import InputModal from '../../components/InputModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TicketDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TicketAdminDetail'>;

interface RouteParams {
    ticketId: string;
}

interface Ticket {
    _id: string;
    ticketCode: string;
    title: string;
    status: string;
    feedback?: {
        rating: number;
        comment?: string;
        badges?: string[];
    };
}

interface UserType {
    _id: string;
    fullname: string;
}

const TicketAdminDetail = () => {
    const navigation = useNavigation<TicketDetailScreenNavigationProp>();
    const route = useRoute();
    const { ticketId } = route.params as RouteParams;
    const [activeTab, setActiveTab] = useState('information');
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [users, setUsers] = useState<UserType[]>([]);
    const [chosenUser, setChosenUser] = useState<UserType | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [departmentUsers, setDepartmentUsers] = useState<any[]>([]);
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchTicketData();
    }, [ticketId]);

    const fetchTicketData = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await axios.get(`${API_BASE_URL}/api/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setTicket(response.data.ticket);
            }
        } catch (error) {
            console.error('Lỗi khi lấy thông tin ticket:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGoBack = () => {
        navigation.goBack();
    };

    const renderStars = (rating: number) => {
        return Array(5).fill(0).map((_, index) => (
            <MaterialIcons
                key={index}
                name="star-border"
                size={24}
                color="#9CA3AF"
            />
        ));
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'information':
                return (
                    <TicketInformation
                        ticketId={ticketId}
                        onRefresh={fetchTicketData}
                    />
                );
            case 'processing':
                return (
                    <TicketProcessing ticketId={ticketId} onRefresh={fetchTicketData} />
                );
            case 'chat':
                return (
                    <TicketChat ticketId={ticketId} />
                );
            case 'history':
                return (
                    <TicketHistory ticketId={ticketId} />
                );
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

    const fetchDepartmentUsers = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const res = await axios.get(
                `${API_BASE_URL}/api/users/department/Phòng Công nghệ thông tin`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setDepartmentUsers(res.data.users || []);
        } catch (err) {
            console.error('Error fetching department users:', err);
        }
    };

    const handleAssignSelectedUser = async (userId: string) => {
        if (!userId) return;
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            await axios.put(
                `${API_BASE_URL}/api/tickets/${ticketId}`,
                { assignedTo: userId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await fetchTicketData();
            setModalVisible(false);
            setSelectedUserId(null);
        } catch (err) {
            console.error('Error assigning selected user:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignToCurrentUser = async () => {
        try {
            setLoading(true);
            const userId = await AsyncStorage.getItem('userId');
            console.log('userId', userId);
            const token = await AsyncStorage.getItem('authToken');
            await axios.put(
                `${API_BASE_URL}/api/tickets/${ticketId}`,
                { assignedTo: userId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await fetchTicketData();
        } catch (error) {
            console.error('Error assigning ticket:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelTicket = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            await axios.put(
                `${API_BASE_URL}/api/tickets/${ticketId}`,
                {
                    status: 'Cancelled',
                    cancelReason: cancelReason
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await fetchTicketData();
            setCancelModalVisible(false);
            setCancelReason('');
        } catch (error) {
            console.error('Error cancelling ticket:', error);
        } finally {
            setLoading(false);
        }
    };

    if (ticket && ticket.feedback) {
        console.log('Ticket rating:', ticket.feedback.rating);
    }

    return (
        <SafeAreaView
            className="flex-1 bg-white"
            style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
        >
            {/* Header */}
            {loading ? (
                <View className="p-4">
                    <ActivityIndicator size="large" color="#F05023" />
                </View>
            ) : ticket ? (
                <View className="bg-white">
                    <View className="w-full flex-row items-start justify-between px-4 py-4">
                        <View className="flex-row items-center">
                            <Text className="text-black font-medium text-lg mr-2">{ticket.ticketCode}</Text>
                            {ticket.feedback && (
                                <View className="flex-row">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <FontAwesome
                                            key={star}
                                            name={star <= ((ticket.feedback && ticket.feedback.rating) ?? 0) ? "star" : "star-o"}
                                            size={16}
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

                    <View className="px-4 mb-4">
                        <Text className="text-[#E84A37] font-medium text-xl">{ticket.title}</Text>
                    </View>
                        <View className="flex-row justify-between items-center pr-[65%] pl-5 mb-6">
                            <TouchableOpacity onPress={handleAssignToCurrentUser} className="w-11 h-11 rounded-full bg-green-600 items-center justify-center">
                                <Ionicons name="checkmark" size={24} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    setModalVisible(true);
                                    fetchDepartmentUsers();
                                }}
                                className="w-11 h-11 rounded-full bg-yellow-500 items-center justify-center"
                            >
                                <FontAwesome5 name="sync-alt" size={16} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setCancelModalVisible(true)}
                                className="w-11 h-11 rounded-full bg-red-600 items-center justify-center"
                            >
                                <Ionicons name="square" size={16} color="white" />
                            </TouchableOpacity>
                        </View>
                </View>
            ) : null}

            {/* Tab Navigation */}
            <View className="flex-row pl-5 ">
                <TouchableOpacity
                    onPress={() => setActiveTab('information')}
                    className={`py-3 mr-6 ${activeTab === 'information' ? 'border-b-2 border-black' : ''}`}
                >
                    <Text className={`${activeTab === 'information' ? 'text-[#002855] font-bold' : 'text-gray-400 font-medium'}`}>
                        Thông tin
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('processing')}
                    className={`py-3 mr-6 ${activeTab === 'processing' ? 'border-b-2 border-black' : ''}`}
                >
                    <Text className={`${activeTab === 'processing' ? 'text-[#002855] font-bold' : 'text-gray-400 font-medium'}`}>
                        Tiến trình
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('chat')}
                    className={`py-3 mr-6 ${activeTab === 'chat' ? 'border-b-2 border-black' : ''}`}
                >
                    <Text className={`${activeTab === 'chat' ? 'text-[#002855] font-bold' : 'text-gray-400 font-medium'}`}>
                        Trao đổi
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('history')}
                    className={`py-3 ${activeTab === 'history' ? 'border-b-2 border-black' : ''}`}
                >
                    <Text className={`${activeTab === 'history' ? 'text-[#002855] font-bold' : 'text-gray-400 font-medium'}`}>
                        Lịch sử
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View className="flex-1">
                {renderContent()}
            </View>

            <SelectModal
                visible={modalVisible}
                title="Chọn nhân viên"
                options={departmentUsers}
                keyExtractor={u => u._id}
                renderLabel={u => u.fullname}
                onCancel={() => setModalVisible(false)}
                onSelect={u => {
                    setChosenUser(u);
                    setModalVisible(false);
                    handleAssignSelectedUser(u._id);
                }}
            />

            <InputModal
                visible={cancelModalVisible}
                title="Lý do hủy"
                placeholder="Nhập lý do hủy ticket"
                value={cancelReason}
                onChangeText={setCancelReason}
                onCancel={() => {
                    setCancelModalVisible(false);
                    setCancelReason('');
                }}
                onConfirm={handleCancelTicket}
            />

        </SafeAreaView>
    );
};

export default TicketAdminDetail; 