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
  TouchableWithoutFeedback,
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

const AssignModal: React.FC<AssignModalProps> = ({ visible, onClose, onConfirm, deviceName }) => {
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
        }),
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
        }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter((user) => {
        const userName = (user.fullname || user.full_name || user.name || '').toLowerCase();
        const userDept = (user.department || '').toLowerCase();
        const userJob = (user.jobTitle || user.job_title || '').toLowerCase();
        const searchLower = searchQuery.toLowerCase();

        return (
          userName.includes(searchLower) ||
          userDept.includes(searchLower) ||
          userJob.includes(searchLower)
        );
      });
      setFilteredUsers(filtered);
    }
    console.log('Filtered users:', filteredUsers.length, 'Search query:', searchQuery); // Debug log
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    try {
      setSearchLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/users/?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Users data received:', data); // Debug log
        const usersList = data.users || data || [];
        setUsers(usersList);
        setFilteredUsers(usersList);
      } else {
        console.error('Failed to fetch users:', response.status);
        Alert.alert('Lỗi', 'Không thể tải danh sách người dùng');
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
      activeOpacity={1}
      className="rounded-lg border p-3"
      style={{
        borderColor: selectedUser?._id === user._id ? '#F05023' : '#E5E7EB',
        backgroundColor: selectedUser?._id === user._id ? '#FFF5F0' : '#F9FAFB',
        opacity: 1,
      }}>
      <View className="flex-row items-center">
        <Image source={{ uri: getAvatar(user) }} className="mr-3 h-10 w-10 rounded-full" />
        <View className="flex-1">
          <Text
            className="font-medium text-sm"
            style={{ color: selectedUser?._id === user._id ? '#F05023' : '#1F2937' }}>
            {user.fullname}
          </Text>
          <Text
            className="text-xs"
            style={{ color: selectedUser?._id === user._id ? '#F05023' : '#6B7280' }}>
            {user.jobTitle} • {user.department}
          </Text>
        </View>
        <MaterialCommunityIcons
          name={selectedUser?._id === user._id ? 'radiobox-marked' : 'radiobox-blank'}
          size={20}
          color={selectedUser?._id === user._id ? '#F05023' : '#6B7280'}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={handleCancel}>
        <Animated.View
          className="flex-1 items-center justify-center bg-black/40 px-5"
          style={{ opacity: fadeAnim }}>
          <TouchableWithoutFeedback>
            <Animated.View
              className="max-h-[80%] w-full max-w-md overflow-hidden rounded-[14px] bg-white"
              style={{
                transform: [
                  {
                    translateY: slideAnim,
                  },
                ],
              }}>
              {/* Header */}
              <View className="p-5 pb-3">
                <Text className="mb-2.5 text-center font-semibold text-lg text-black">
                  Cấp phát thiết bị
                </Text>

                {/* Device Info */}
                <View className="mb-4 rounded-lg p-3" style={{ backgroundColor: '#FFF5F0' }}>
                  <Text className="text-center text-sm" style={{ color: '#F05023' }}>
                    Cấp phát <Text className="font-semibold">{deviceName}</Text>
                  </Text>
                </View>

                {/* Search */}
                <View className="relative mb-3">
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Tìm kiếm người dùng..."
                    className="rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-sm text-black"
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
              <ScrollView className="max-h-60 px-5" showsVerticalScrollIndicator={false}>
                {/* User Selection */}
                <Text className="mb-3 font-medium text-base text-black">
                  Chọn người được cấp phát <Text className="text-red-500">*</Text>
                </Text>

                {searchLoading ? (
                  <View className="items-center py-4">
                    <ActivityIndicator size="small" color="#F05023" />
                  </View>
                ) : filteredUsers.length > 0 ? (
                  <View className="mb-4 gap-2">{filteredUsers.map(renderUserItem)}</View>
                ) : (
                  <View className="items-center py-4">
                    <Text className="text-gray-500">Không tìm thấy người dùng nào</Text>
                  </View>
                )}

                {/* Notes */}
                <Text className="mb-2 font-medium text-sm text-black">Ghi chú (tùy chọn)</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Nhập ghi chú..."
                  multiline={true}
                  numberOfLines={2}
                  className="mb-4 rounded-full border-none bg-gray-100 p-3 text-sm text-black"
                  textAlignVertical="top"
                  placeholderTextColor="#999999"
                />
              </ScrollView>

              {/* Action Buttons */}
              <View className="-mx-5 my-5 flex-row border-[#E5E5E5]">
                <TouchableOpacity
                  className="flex-1 items-center justify-center bg-transparent"
                  onPress={handleCancel}
                  disabled={isLoading}>
                  <Text className="font-medium text-lg text-[#666666]">Hủy</Text>
                </TouchableOpacity>
                <View className="w-[0.5px] bg-[#E5E5E5]" />
                <TouchableOpacity
                  className="flex-1 items-center justify-center bg-transparent"
                  onPress={handleConfirm}
                  disabled={isLoading}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#F05023" />
                  ) : (
                    <Text className="font-semibold text-lg" style={{ color: '#F05023' }}>
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
