import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  Pressable,
  Keyboard,
} from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAvatar } from '../../../utils/avatar';
import deviceService from '../../../services/deviceService';

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
  onConfirm: (userId: string, userName: string, notes?: string) => Promise<void>;
  deviceName: string;
}

const USERS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const AssignModal: React.FC<AssignModalProps> = ({ visible, onClose, onConfirm, deviceName }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  // Debounce timer ref
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchRef = useRef('');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      resetAndFetch();
    } else {
      // Cleanup when closing
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    }
  }, [visible]);

  // Debounced search effect
  useEffect(() => {
    if (!visible) return;

    // Clear previous timer
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    // Debounce search
    searchTimerRef.current = setTimeout(() => {
      if (searchQuery !== lastSearchRef.current) {
        lastSearchRef.current = searchQuery;
        fetchUsers(1, searchQuery, true);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery, visible]);

  const resetAndFetch = () => {
    setUsers([]);
    setPage(1);
    setHasMore(true);
    setSearchQuery('');
    setSelectedUser(null);
    setNotes('');
    lastSearchRef.current = '';
    fetchUsers(1, '', true);
  };

  const fetchUsers = async (pageNum: number, search: string, isNewSearch: boolean) => {
    try {
      if (isNewSearch) {
        setInitialLoading(true);
        setSearchLoading(search.length > 0);
      } else {
        setLoadingMore(true);
      }

      const result = await deviceService.getUsers(pageNum, USERS_PER_PAGE, search);

      if (isNewSearch) {
        setUsers(result.users);
      } else {
        // Filter out duplicates when loading more
        setUsers((prev) => {
          const existingIds = new Set(prev.map((u) => u._id));
          const newUsers = result.users.filter((u: User) => !existingIds.has(u._id));
          return [...prev, ...newUsers];
        });
      }

      setPage(pageNum);
      setHasMore(result.pagination.hasNext);
      setTotal(result.pagination.total);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách người dùng');
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      setSearchLoading(false);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !searchLoading) {
      fetchUsers(page + 1, searchQuery, false);
    }
  }, [loadingMore, hasMore, page, searchQuery, searchLoading]);

  const handleConfirm = async () => {
    if (!selectedUser) {
      Alert.alert('Lỗi', 'Vui lòng chọn người được cấp phát');
      return;
    }

    try {
      setIsLoading(true);
      Keyboard.dismiss();
      await onConfirm(selectedUser._id, selectedUser.fullname, notes.trim() || undefined);

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
    if (isLoading) return;
    Keyboard.dismiss();
    setSelectedUser(null);
    setNotes('');
    setSearchQuery('');
    onClose();
  };

  const renderUserItem = ({ item: user }: { item: User }) => (
    <TouchableOpacity
      onPress={() => setSelectedUser(user)}
      className="mb-2 rounded-lg border p-3"
      style={{
        borderColor: selectedUser?._id === user._id ? '#F05023' : '#E5E7EB',
        backgroundColor: selectedUser?._id === user._id ? '#FFF5F0' : '#F9FAFB',
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

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View className="items-center py-3">
        <ActivityIndicator size="small" color="#F05023" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (initialLoading || searchLoading) return null;
    return (
      <View className="items-center py-6">
        <MaterialCommunityIcons name="account-search-outline" size={40} color="#9CA3AF" />
        <Text className="mt-2 text-gray-500">
          {searchQuery ? 'Không tìm thấy người dùng nào' : 'Không có người dùng'}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}>
      <View className="flex-1 items-center justify-center bg-black/50">
        {/* Backdrop */}
        <Pressable className="absolute bottom-0 left-0 right-0 top-0" onPress={handleCancel} />

        {/* Modal Content */}
        <View className="mx-5 max-h-[85%] w-[90%] overflow-hidden rounded-2xl bg-white">
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
            <View className="relative">
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Tìm kiếm người dùng..."
                className="rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-10 text-sm text-black"
                placeholderTextColor="#999999"
                editable={!isLoading}
                returnKeyType="search"
              />
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color="#6B7280"
                style={{ position: 'absolute', left: 12, top: 12 }}
              />
              {searchLoading && (
                <ActivityIndicator
                  size="small"
                  color="#F05023"
                  style={{ position: 'absolute', right: 12, top: 12 }}
                />
              )}
            </View>
          </View>

          {/* User Selection Label */}
          <View className="px-5 pb-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-medium text-base text-black">
                Chọn người được cấp phát <Text className="text-red-500">*</Text>
              </Text>
              {total > 0 && (
                <Text className="text-xs text-gray-500">
                  {users.length}/{total}
                </Text>
              )}
            </View>
          </View>

          {/* Users List */}
          <View className="max-h-52 px-5">
            {initialLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator size="large" color="#F05023" />
                <Text className="mt-2 text-sm text-gray-500">Đang tải...</Text>
              </View>
            ) : (
              <FlatList
                data={users}
                keyExtractor={(item) => item._id}
                renderItem={renderUserItem}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={renderEmpty}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>

          {/* Notes Section - Separated */}
          <View className="border-t border-gray-100 px-5 pt-4">
            <Text className="mb-2 font-medium text-sm text-black">Ghi chú (tùy chọn)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Nhập ghi chú..."
              multiline={true}
              numberOfLines={2}
              className="rounded-xl bg-gray-100 p-3 text-sm text-black"
              style={{ minHeight: 60, maxHeight: 80 }}
              textAlignVertical="top"
              placeholderTextColor="#999999"
              editable={!isLoading}
            />
          </View>

          {/* Selected User Preview */}
          {selectedUser && (
            <View className="mx-5 mt-3 flex-row items-center rounded-lg bg-green-50 p-2">
              <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
              <Text className="ml-2 flex-1 text-sm text-green-700" numberOfLines={1}>
                Đã chọn: <Text className="font-medium">{selectedUser.fullname}</Text>
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="mt-4 flex-row border-t border-gray-200">
            <TouchableOpacity
              className="flex-1 items-center justify-center bg-transparent py-4"
              onPress={handleCancel}
              disabled={isLoading}>
              <Text className="font-medium text-lg text-gray-600">Hủy</Text>
            </TouchableOpacity>
            <View className="w-px bg-gray-200" />
            <TouchableOpacity
              className="flex-1 items-center justify-center bg-transparent py-4"
              onPress={handleConfirm}
              disabled={isLoading || !selectedUser}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#F05023" />
              ) : (
                <Text
                  className="font-semibold text-lg"
                  style={{ color: selectedUser ? '#F05023' : '#9CA3AF' }}>
                  Xác nhận
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AssignModal;
