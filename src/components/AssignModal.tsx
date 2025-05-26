import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    ActivityIndicator,
    Animated,
    Dimensions,
    TouchableWithoutFeedback
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'react-native';
import { getAvatar } from '../utils/avatar';
import { API_BASE_URL } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
    _id: string;
    fullname: string;
    jobTitle: string;
    department: string;
    avatarUrl?: string;
}

interface AssignModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (userId: string, notes?: string) => Promise<void>;
    deviceName: string;
}

const { height } = Dimensions.get('window');

const AssignModal: React.FC<AssignModalProps> = ({
    visible,
    onClose,
    onConfirm,
    deviceName
}) => {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(height)).current;

    useEffect(() => {
        if (visible) {
            fetchUsers();
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: height,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [visible]);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredUsers(users);
        } else {
            const filtered = users.filter(user =>
                user.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredUsers(filtered);
        }
    }, [searchQuery, users]);

    const fetchUsers = async () => {
        try {
            setSearchLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}/api/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
                setFilteredUsers(data.users || []);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            Alert.alert('Lỗi', 'Không thể tải danh sách người dùng');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!selectedUser) {
            Alert.alert('Lỗi', 'Vui lòng chọn người được cấp phát');
            return;
        }

        try {
            setIsLoading(true);
            await onConfirm(selectedUser._id, notes.trim() || undefined);

            // Reset form
            setSelectedUser(null);
            setNotes('');
            setSearchQuery('');
            onClose();
        } catch (error) {
            console.error('Error assigning device:', error);
            Alert.alert('Lỗi', 'Không thể cấp phát thiết bị. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setSelectedUser(null);
        setNotes('');
        setSearchQuery('');
        onClose();
    };

    const renderUserItem = (user: User) => (
        <TouchableOpacity
            key={user._id}
            onPress={() => setSelectedUser(user)}
            className={`p-3 rounded-lg border ${selectedUser?._id === user._id
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-gray-50'
                }`}
        >
            <View className="flex-row items-center">
                <Image
                    source={{ uri: getAvatar(user) }}
                    className="w-10 h-10 rounded-full mr-3"
                />
                <View className="flex-1">
                    <Text className={`text-sm font-medium ${selectedUser?._id === user._id ? 'text-green-700' : 'text-gray-800'
                        }`}>
                        {user.fullname}
                    </Text>
                    <Text className={`text-xs ${selectedUser?._id === user._id ? 'text-green-600' : 'text-gray-600'
                        }`}>
                        {user.jobTitle} • {user.department}
                    </Text>
                </View>
                <MaterialCommunityIcons
                    name={selectedUser?._id === user._id ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={selectedUser?._id === user._id ? '#22C55E' : '#6B7280'}
                />
            </View>
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={handleCancel}>
                <Animated.View
                    className="flex-1 bg-black/40 justify-center items-center px-5"
                    style={{ opacity: fadeAnim }}
                >
                    <TouchableWithoutFeedback>
                        <Animated.View
                            className="w-full max-w-md bg-white rounded-[14px] overflow-hidden max-h-[80%]"
                            style={{
                                transform: [{
                                    translateY: slideAnim
                                }]
                            }}
                        >
                            {/* Header */}
                            <View className="p-5 pb-3">
                                <Text className="text-lg font-semibold text-black text-center mb-2.5">
                                    Cấp phát thiết bị
                                </Text>

                                {/* Device Info */}
                                <View className="bg-green-50 p-3 rounded-lg mb-4">
                                    <Text className="text-sm text-green-600 text-center">
                                        Cấp phát <Text className="font-semibold">{deviceName}</Text>
                                    </Text>
                                </View>

                                {/* Search */}
                                <View className="relative mb-3">
                                    <TextInput
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        placeholder="Tìm kiếm người dùng..."
                                        className="border border-gray-300 rounded-lg pl-10 pr-3 py-3 text-sm text-black bg-gray-50"
                                        placeholderTextColor="#999999"
                                    />
                                    <MaterialCommunityIcons
                                        name="magnify"
                                        size={20}
                                        color="#6B7280"
                                        style={{ position: 'absolute', left: 12, top: 12 }}
                                    />
                                </View>
                            </View>

                            {/* Scrollable Content */}
                            <ScrollView
                                className="px-5 max-h-60"
                                showsVerticalScrollIndicator={false}
                            >
                                {/* User Selection */}
                                <Text className="text-base font-medium text-black mb-3">
                                    Chọn người được cấp phát <Text className="text-red-500">*</Text>
                                </Text>

                                {searchLoading ? (
                                    <View className="items-center py-4">
                                        <ActivityIndicator size="small" color="#22C55E" />
                                    </View>
                                ) : (
                                    <View className="gap-2 mb-4">
                                        {filteredUsers.map(renderUserItem)}
                                    </View>
                                )}

                                {/* Notes */}
                                <Text className="text-sm font-medium text-black mb-2">
                                    Ghi chú (tùy chọn)
                                </Text>
                                <TextInput
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder="Nhập ghi chú..."
                                    multiline={true}
                                    numberOfLines={2}
                                    className="border-none rounded-full p-3 text-sm text-black bg-gray-100 mb-4"
                                    textAlignVertical="top"
                                    placeholderTextColor="#999999"
                                />
                            </ScrollView>

                            {/* Action Buttons */}
                            <View className="flex-row -mx-5 border-[#E5E5E5]">
                                <TouchableOpacity
                                    className="flex-1 py-3 items-center justify-center bg-transparent"
                                    onPress={handleCancel}
                                    disabled={isLoading}
                                >
                                    <Text className="text-lg text-[#666666] font-medium">
                                        Hủy
                                    </Text>
                                </TouchableOpacity>
                                <View className="w-[0.5px] bg-[#E5E5E5]" />
                                <TouchableOpacity
                                    className="flex-1 py-3 items-center justify-center bg-transparent"
                                    onPress={handleConfirm}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator size="small" color="#22C55E" />
                                    ) : (
                                        <Text className="text-lg text-[#22C55E] font-semibold">
                                            Xác nhận
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </Animated.View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

export default AssignModal; 