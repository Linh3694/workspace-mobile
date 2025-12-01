import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Platform,
    Linking
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import deviceService from '../../services/deviceService';
import { API_BASE_URL } from '../../config/constants.js';
import { Image } from 'react-native';
import { getAvatar } from '../../utils/avatar';
import { AssignmentHistory, Device } from '../../types/devices';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeVietnameseName } from '../../utils/nameFormatter';

type DeviceAssignmentHistoryScreenRouteProp = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.DEVICE_ASSIGNMENT_HISTORY>;
type DeviceAssignmentHistoryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, typeof ROUTES.SCREENS.DEVICE_ASSIGNMENT_HISTORY>;

const DeviceAssignmentHistoryScreen = () => {
    const navigation = useNavigation<DeviceAssignmentHistoryScreenNavigationProp>();
    const route = useRoute<DeviceAssignmentHistoryScreenRouteProp>();
    const { deviceId, deviceType, deviceName } = route.params;
    const insets = useSafeAreaInsets();

    const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [device, setDevice] = useState<Device | null>(null);

    useEffect(() => {
        fetchAssignmentHistory();
    }, [deviceId]);

    const fetchAssignmentHistory = async () => {
        try {
            setLoading(true);
            const deviceData = await deviceService.getDeviceById(deviceType, deviceId);
            if (deviceData) {
                setDevice(deviceData);
                if (deviceData.assignmentHistory) {
                    setAssignmentHistory(deviceData.assignmentHistory.reverse()); // Hiển thị mới nhất trước
                }
            }
        } catch (error) {
            console.error('Error fetching assignment history:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchAssignmentHistory();
        setRefreshing(false);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    const calculateDuration = (startDate: string, endDate?: string) => {
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : new Date();
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return '1 ngày';
        if (diffDays < 30) return `${diffDays} ngày`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng`;
        return `${Math.floor(diffDays / 365)} năm`;
    };

    const renderAssignmentItem = (assignment: AssignmentHistory, index: number) => (
        <View key={assignment._id} className={`${!assignment.endDate ? 'bg-[#002855]' : 'bg-[#E4E9EF]'} rounded-xl p-4 mb-4`}>
            <View className="flex-row items-center mb-3">
                <Image
                    source={{ uri: getAvatar(assignment.user) }}
                    className="w-12 h-12 rounded-full mr-3"
                />
                <View className="flex-1">
                    <Text className={`${!assignment.endDate ? 'text-white' : 'text-gray-800'} font-semibold text-base`}>
                        {normalizeVietnameseName(assignment.user?.fullname) || 'Không xác định'}
                    </Text>
                    <Text className={`${!assignment.endDate ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                        {assignment.user?.jobTitle || 'Không xác định'}
                    </Text>
                    <Text className={`${!assignment.endDate ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                        {formatDate(assignment.startDate)} {assignment.endDate ? `→ ${formatDate(assignment.endDate)}` : '→ nay'} ({calculateDuration(assignment.startDate, assignment.endDate)})
                    </Text>
                </View>
                <View className={`px-3 py-1 rounded-full ${!assignment.endDate ? 'bg-green-500' : 'bg-gray-500'}`}>
                    <Text className="text-xs text-white font-bold">
                        {!assignment.endDate ? 'Đang sử dụng' : 'Đã trả'}
                    </Text>
                </View>
            </View>

            <View className={`border-t ${!assignment.endDate ? 'border-gray-600' : 'border-gray-300'} pt-3 space-y-2`}>
                <Text className={`${!assignment.endDate ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                    Người bàn giao: {normalizeVietnameseName(assignment.assignedBy?.fullname) || 'Không xác định'}
                </Text>

                {/* Revoked Information */}
                {assignment.revokedBy && assignment.revokedReason && (
                    <View className="mt-2">
                        <Text className={`${!assignment.endDate ? 'text-red-300' : 'text-red-600'} text-sm`}>
                            Thu hồi bởi: {normalizeVietnameseName(assignment.revokedBy?.fullname) || 'Không xác định'}
                        </Text>
                        <View className="flex-row flex-wrap mt-1">
                            {assignment.revokedReason.map((reason, index) => (
                                <View key={index} className="bg-red-500 px-2 py-1 rounded mr-1 mb-1">
                                    <Text className="text-xs text-white">{reason}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {assignment.notes && (
                    <View className="mt-2">
                        <Text className={`${!assignment.endDate ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                            Ghi chú: {assignment.notes}
                        </Text>
                    </View>
                )}

                {assignment.document && (
                    <View className="mt-2">
                        <TouchableOpacity
                            onPress={async () => {
                                try {
                                    // Lấy tên file từ document path
                                    let fileName = assignment.document;
                                    if (assignment.document.includes('/')) {
                                        fileName = assignment.document.split('/').pop() || assignment.document;
                                    }
                                    
                                    // Build full document URL giống như DevicesDetailScreen
                                    const documentUrl = `${API_BASE_URL}/uploads/Handovers/${fileName}`;
                                    
                                    // Check if URL can be opened
                                    const canOpen = await Linking.canOpenURL(documentUrl);
                                    if (canOpen) {
                                        await Linking.openURL(documentUrl);
                                    } else {
                                        Alert.alert(
                                            'Không thể mở file',
                                            'Thiết bị không hỗ trợ mở loại file này. Vui lòng thử trên máy tính.',
                                            [{ text: 'OK' }]
                                        );
                                    }
                                } catch (error) {
                                    console.error('Error opening document:', error);
                                    Alert.alert(
                                        'Lỗi',
                                        'Không thể mở biên bản bàn giao. Vui lòng thử lại sau.',
                                        [{ text: 'OK' }]
                                    );
                                }
                            }}
                            className="flex-row items-center"
                        >
                            <MaterialCommunityIcons
                                name="file-document-outline"
                                size={16}
                                color={!assignment.endDate ? '#ffffff' : '#002855'}
                            />
                            <Text className={`ml-1 text-sm underline ${!assignment.endDate ? 'text-gray-300' : 'text-blue-600'}`}>
                                Xem biên bản bàn giao
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView className="flex-1" style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#002855" />
                    <Text className="text-base text-[#002855] mt-3">Đang tải lịch sử...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white" style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 bg-white">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="w-10 h-10 items-center justify-center"
                >
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#002855" />
                </TouchableOpacity>

                <View className="flex-1 mr-10">
                    <Text className="text-xl font-bold text-primary text-center">
                        Lịch sử bàn giao
                    </Text>
                </View>
            </View>

            {/* Content */}
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#002855']}
                        tintColor="#002855"
                    />
                }
            >
                {assignmentHistory.length > 0 ? (
                    <>
                        <Text className="text-sm text-gray-600 mb-4">
                            Tổng cộng {assignmentHistory.length} lần bàn giao
                        </Text>
                        {assignmentHistory.map(renderAssignmentItem)}
                    </>
                ) : (
                    <View className="items-center py-8">
                        <MaterialCommunityIcons name="clipboard-text-outline" size={60} color="#ccc" />
                        <Text className="text-gray-500 mt-3 text-center">
                            Chưa có lịch sử bàn giao nào
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default DeviceAssignmentHistoryScreen; 