import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, FlatList, ActivityIndicator, SafeAreaView, Image, Platform} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/constants';
import { useOnlineStatus } from '../../context/OnlineStatusContext';
import Avatar from '../../components/Chat/Avatar';
import GroupAvatar from '../../components/Chat/GroupAvatar';
import type { GroupInfo, User } from '../../types/message';
import * as ImagePicker from 'expo-image-picker';

interface GroupInfoScreenProps {
  route: {
    params: {
      groupInfo: GroupInfo;
    };
  };
}

const GroupInfoScreen: React.FC<GroupInfoScreenProps> = () => {
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  const [showMemberDetailModal, setShowMemberDetailModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState<User[]>([]);
  
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute();
  const { groupInfo: initialGroupInfo } = route.params as { groupInfo: GroupInfo };
  const insets = useSafeAreaInsets();
  const { isUserOnline, getFormattedLastSeen } = useOnlineStatus();

  useEffect(() => {
    setGroupInfo(initialGroupInfo);
    setEditedName(initialGroupInfo.name);
    setEditedDescription(initialGroupInfo.description || '');
    fetchCurrentUser();
  }, [initialGroupInfo]);

  useEffect(() => {
    if (currentUserId && groupInfo) {
      setIsAdmin(groupInfo.admins.some(admin => admin._id === currentUserId));
      setIsCreator(groupInfo.creator._id === currentUserId);
    }
  }, [currentUserId, groupInfo]);

  useEffect(() => {
    if (searchText.trim() && allUsers.length > 0) {
      const filtered = allUsers.filter(user => 
        user.fullname.toLowerCase().includes(searchText.toLowerCase()) &&
        !groupInfo?.participants.some(p => p._id === user._id)
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers([]);
    }
  }, [searchText, allUsers, groupInfo]);

  const fetchCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUserId(user._id);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const users = await response.json();
        const otherUsers = users.filter((user: User) => user._id !== currentUserId);
        setAllUsers(otherUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleUpdateGroupInfo = async () => {
    if (!editedName.trim()) {
      Alert.alert('Lỗi', 'Tên nhóm không được để trống');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/chats/group/${groupInfo?._id}/info`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editedName.trim(),
          description: editedDescription.trim(),
        }),
      });

      if (response.ok) {
        const updatedGroup = await response.json();
        setGroupInfo(updatedGroup);
        setIsEditing(false);
        Alert.alert('Thành công', 'Đã cập nhật thông tin nhóm');
      } else {
        const errorData = await response.json();
        Alert.alert('Lỗi', errorData.message || 'Không thể cập nhật thông tin nhóm');
      }
    } catch (error) {
      console.error('Error updating group info:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi cập nhật thông tin nhóm');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/chats/group/${groupInfo?._id}/add-member`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds: [userId],
        }),
      });

      if (response.ok) {
        const updatedGroup = await response.json();
        setGroupInfo(updatedGroup);
        setShowAddMemberModal(false);
        setSearchText('');
        Alert.alert('Thành công', 'Đã thêm thành viên vào nhóm');
      } else {
        const errorData = await response.json();
        Alert.alert('Lỗi', errorData.message || 'Không thể thêm thành viên');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi thêm thành viên');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    Alert.alert(
      'Xác nhận',
      `Bạn có chắc chắn muốn xóa ${userName} khỏi nhóm?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const token = await AsyncStorage.getItem('authToken');
              const response = await fetch(`${API_BASE_URL}/api/chats/group/${groupInfo?._id}/remove-member/${userId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                const updatedGroup = await response.json();
                setGroupInfo(updatedGroup);
                Alert.alert('Thành công', 'Đã xóa thành viên khỏi nhóm');
              } else {
                const errorData = await response.json();
                Alert.alert('Lỗi', errorData.message || 'Không thể xóa thành viên');
              }
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Lỗi', 'Có lỗi xảy ra khi xóa thành viên');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleToggleAdmin = async (userId: string, userName: string, isCurrentlyAdmin: boolean) => {
    const action = isCurrentlyAdmin ? 'remove-admin' : 'add-admin';
    const actionText = isCurrentlyAdmin ? 'gỡ quyền admin' : 'thăng admin';
    
    Alert.alert(
      'Xác nhận',
      `Bạn có chắc chắn muốn ${actionText} cho ${userName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: isCurrentlyAdmin ? 'Gỡ quyền' : 'Thăng chức',
          onPress: async () => {
            setLoading(true);
            try {
              const token = await AsyncStorage.getItem('authToken');
              const response = await fetch(`${API_BASE_URL}/api/chats/group/${groupInfo?._id}/${action}/${userId}`, {
                method: isCurrentlyAdmin ? 'DELETE' : 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                const updatedGroup = await response.json();
                setGroupInfo(updatedGroup);
                Alert.alert('Thành công', `Đã ${actionText} thành công`);
              } else {
                const errorData = await response.json();
                Alert.alert('Lỗi', errorData.message || `Không thể ${actionText}`);
              }
            } catch (error) {
              console.error(`Error ${action}:`, error);
              Alert.alert('Lỗi', `Có lỗi xảy ra khi ${actionText}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleLeaveGroup = () => {
    if (isCreator) {
      Alert.alert(
        'Không thể rời nhóm',
        'Bạn là người tạo nhóm. Vui lòng chuyển quyền quản trị cho thành viên khác trước khi rời nhóm.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Rời khỏi nhóm',
      'Bạn có chắc chắn muốn rời khỏi nhóm này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const token = await AsyncStorage.getItem('authToken');
              const response = await fetch(`${API_BASE_URL}/api/chats/group/${groupInfo?._id}/leave`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                Alert.alert(
                  'Thành công',
                  'Bạn đã rời khỏi nhóm',
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation.goBack()
                    }
                  ]
                );
              } else {
                const errorData = await response.json();
                Alert.alert('Lỗi', errorData.message || 'Không thể rời khỏi nhóm');
              }
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert('Lỗi', 'Có lỗi xảy ra khi rời khỏi nhóm');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleChangeAvatar = async () => {
    if (!isAdmin && !isCreator) {
      Alert.alert('Lỗi', 'Chỉ admin mới có thể thay đổi avatar nhóm');
      return;
    }

    Alert.alert(
      'Thay đổi avatar nhóm',
      'Chọn nguồn ảnh',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Chọn từ thư viện', onPress: () => pickImageFromLibrary() },
        { text: 'Chụp ảnh mới', onPress: () => takePhoto() },
      ]
    );
  };

  const pickImageFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi chọn ảnh');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần quyền truy cập camera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi chụp ảnh');
    }
  };

  const uploadAvatar = async (imageUri: string) => {
    setUploadingAvatar(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      // Create FormData
      const formData = new FormData();
      formData.append('avatar', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'group-avatar.jpg',
      } as any);

      const response = await fetch(`${API_BASE_URL}/api/chats/group/${groupInfo?._id}/info`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (response.ok) {
        const updatedGroup = await response.json();
        setGroupInfo(updatedGroup);
        Alert.alert('Thành công', 'Đã cập nhật avatar nhóm');
      } else {
        const errorData = await response.json();
        Alert.alert('Lỗi', errorData.message || 'Không thể cập nhật avatar');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi tải lên avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const showMoreOptions = () => {
    Alert.alert(
      'Tùy chọn',
      'Chọn hành động',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Cài đặt nhóm', onPress: () => {} },
        { text: 'Báo cáo nhóm', onPress: () => {} },
      ]
    );
  };

  const handleSelectUser = (user: User) => {
    const isSelected = selectedUsersToAdd.some(u => u._id === user._id);
    if (isSelected) {
      setSelectedUsersToAdd(prev => prev.filter(u => u._id !== user._id));
    } else {
      setSelectedUsersToAdd(prev => [...prev, user]);
    }
  };

  const handleRemoveSelectedUser = (userId: string) => {
    setSelectedUsersToAdd(prev => prev.filter(u => u._id !== userId));
  };

  const handleAddSelectedMembers = async () => {
    if (selectedUsersToAdd.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một thành viên');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/chats/group/${groupInfo?._id}/add-member`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds: selectedUsersToAdd.map(u => u._id),
        }),
      });

      if (response.ok) {
        const updatedGroup = await response.json();
        setGroupInfo(updatedGroup);
        setShowAddMemberModal(false);
        setSelectedUsersToAdd([]);
        setSearchText('');
        Alert.alert('Thành công', 'Đã thêm thành viên vào nhóm');
      } else {
        const errorData = await response.json();
        Alert.alert('Lỗi', errorData.message || 'Không thể thêm thành viên');
      }
    } catch (error) {
      console.error('Error adding members:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi thêm thành viên');
    } finally {
      setLoading(false);
    }
  };

  const renderMemberItem = ({ item }: { item: User }) => {
    const memberIsAdmin = groupInfo?.admins.some(admin => admin._id === item._id);
    const memberIsCreator = groupInfo?.creator._id === item._id;
    const canManageMember = isCreator && !memberIsCreator;

    return (
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200">
        <Avatar user={item} size={48} />
        <View className="flex-1 ml-3">
          <Text className="text-base font-semibold text-black">{item.fullname}</Text>
          <Text className="text-sm text-gray-500 mt-0.5">{item.email}</Text>
        </View>
        <View className="flex-row items-center">
          {memberIsCreator && (
            <Text className="text-xs font-semibold text-orange-500 bg-orange-50 px-2 py-1 rounded-3xl mr-2">
              Người tạo
            </Text>
          )}
          {memberIsAdmin && !memberIsCreator && (
            <Text className="text-xs font-semibold text-blue-500 bg-blue-50 px-2 py-1 rounded-3xl mr-2">
              Admin
            </Text>
          )}
          {canManageMember && (
            <TouchableOpacity
              className="p-2 ml-1"
              onPress={() => handleToggleAdmin(item._id, item.fullname, memberIsAdmin)}
            >
              <MaterialIcons 
                name={memberIsAdmin ? "admin-panel-settings" : "person-add-alt"} 
                size={20} 
                color="#007AFF" 
              />
            </TouchableOpacity>
          )}
          {(isAdmin || isCreator) && !memberIsCreator && item._id !== currentUserId && (
            <TouchableOpacity
              className="p-2 ml-1 bg-red-50 rounded-2xl"
              onPress={() => handleRemoveMember(item._id, item.fullname)}
            >
              <MaterialIcons name="remove-circle" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderUserToAdd = ({ item }: { item: User }) => (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3 border-b border-gray-200"
      onPress={() => handleAddMember(item._id)}
    >
      <Avatar user={item} size={40} />
      <View className="flex-1 ml-3">
        <Text className="text-base font-semibold text-black">{item.fullname}</Text>
        <Text className="text-sm text-gray-500 mt-0.5">{item.email}</Text>
      </View>
      <MaterialIcons name="add-circle" size={24} color="#007AFF" />
    </TouchableOpacity>
  );

  if (!groupInfo) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={showMoreOptions} className="p-2">
          <MaterialIcons name="more-vert" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Group Info Section */}
        <View className="items-center py-0 px-4 bg-white">
          <TouchableOpacity
            className="relative mb-4"
            onPress={handleChangeAvatar}
            disabled={uploadingAvatar || (!isAdmin && !isCreator)}
          >
            <GroupAvatar
              size={120}
              groupAvatar={groupInfo.avatar}
              participants={groupInfo.participants.slice(0, 3)}
              currentUserId={currentUserId}
            />
            {groupInfo.participants.length > 3 && (
              <View className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gray-500 items-center justify-center border-2 border-white">
                <Text className="text-white text-xs font-semibold">
                  +{groupInfo.participants.length - 3}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <Text className="text-2xl font-semibold text-black text-center">
            {groupInfo.name}
          </Text>
        </View>

        {/* Tab Navigation */}
        <View className="flex-row bg-white px-20 py-6 justify-around">
          <TouchableOpacity 
            className="items-center py-3 px-4"
            onPress={() => setActiveTab('search')}
          >
            <View className={`w-16 h-16 rounded-full items-center justify-center bg-gray-100`}>
              <MaterialIcons 
                name="search" 
                size={32} 
                color="#757575" 
              />
            </View>
            <Text className={`text-sm mt-2 font-medium text-[#757575]`}>
              Tìm
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className="items-center py-3 px-4"
            onPress={() => setActiveTab('notification')}
          >
            <View className={`w-16 h-16 rounded-full items-center justify-center bg-gray-100`}>
              <MaterialIcons 
                name="notifications" 
                size={32} 
                color="#757575" 
              />
            </View>
            <Text className={`text-sm mt-2 font-medium text-[#757575]`}>
              Thông báo
            </Text>
          </TouchableOpacity>
        </View>

        {/* Menu Section */}
        <View className="bg-white pt-4 border-t border-[#E5E5E5] gap-2">
          <Text className="text-sm text-gray-500 font-semibold px-4 pb-2">
            Hành động
          </Text>
          
          <TouchableOpacity 
            className="flex-row items-center py-4 px-4"
            onPress={() => setShowMembersModal(true)}
          >
            <MaterialIcons name="people" size={24} color="#8E8E93" />
            <Text className="text-base font-semibold text-[#757575] ml-4 flex-1">Quản lý nhóm</Text>
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center py-4 px-4">
            <MaterialIcons name="photo-library" size={24} color="#8E8E93" />
            <Text className="text-base font-semibold text-[#757575] ml-4 flex-1">Xem ảnh, video</Text>
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center py-4 px-4">
            <MaterialIcons name="attach-file" size={24} color="#8E8E93" />
            <Text className="text-base font-semibold text-[#757575] ml-4 flex-1">Tìm tệp đính kèm</Text>
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center py-4 px-4">
            <MaterialIcons name="link" size={24} color="#8E8E93" />
            <Text className="text-base font-semibold text-[#757575] ml-4 flex-1">Tìm liên kết</Text>
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center py-4 px-4 opacity-50">
            <MaterialIcons name="note" size={24} color="#C7C7CC" />
            <Text className="text-base font-semibold text-[#757575] ml-4 flex-1">Ghim tin nhắn</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center py-4 px-4"
            onPress={handleLeaveGroup}
          >
            <MaterialIcons name="exit-to-app" size={24} color="#FF3B30" />
            <Text className="text-base font-semibold text-[#FF3B30] ml-4 flex-1">Rời nhóm</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-7 py-6">
            <TouchableOpacity onPress={() => setShowMembersModal(false)}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-black">Quản lý nhóm</Text>
            {(isAdmin || groupInfo.settings.allowMembersToAdd) && (
              <TouchableOpacity 
                onPress={() => {
                  setShowMembersModal(false);
                  fetchUsers();
                  setShowAddMemberModal(true);
                }}
              >
                <MaterialIcons name="person-add" size={24} color="#000" />
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView className="flex-1">
            {/* Admins Section */}
            {groupInfo.admins.length > 0 && (
              <View className="mt-4">
                <Text className="text-base text-gray-600 font-medium px-4 mb-3">
                  Quản trị viên ({groupInfo.admins.length})
                </Text>
                {groupInfo.admins.map((admin) => (
                  <TouchableOpacity 
                    key={admin._id} 
                    className="flex-row items-center px-4 py-3"
                    onPress={() => {
                      console.log('Admin pressed:', admin.fullname);
                      setSelectedMember(admin);
                      setShowMemberDetailModal(true);
                    }}
                  >
                    <View className="relative">
                      <Avatar user={admin} size={48} />
                      <View className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${isUserOnline(admin._id) ? 'bg-green-500' : 'bg-gray-400'}`} />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-base font-semibold text-black">{admin.fullname}</Text>
                      <Text className="text-sm text-gray-500">
                        {isUserOnline(admin._id) ? 'Đang hoạt động' : getFormattedLastSeen(admin._id)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Regular Members Section */}
            <View className="mt-6">
              <Text className="text-base text-gray-600 font-medium px-4 mb-3">
                Thành viên ({groupInfo.participants.filter(p => !groupInfo.admins.some(a => a._id === p._id)).length})
              </Text>
              {groupInfo.participants
                .filter(participant => !groupInfo.admins.some(admin => admin._id === participant._id))
                .map((member) => (
                  <TouchableOpacity 
                    key={member._id} 
                    className="flex-row items-center px-4 py-3"
                    onPress={() => {
                      console.log('Member pressed:', member.fullname);
                      setSelectedMember(member);
                      setShowMemberDetailModal(true);
                    }}
                  >
                    <View className="relative">
                      <Avatar user={member} size={48} />
                      <View className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${isUserOnline(member._id) ? 'bg-green-500' : 'bg-gray-400'}`} />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-base font-semibold text-black">{member.fullname}</Text>
                      <Text className="text-sm text-gray-500">
                        {isUserOnline(member._id) ? 'Đang hoạt động' : getFormattedLastSeen(member._id)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          </ScrollView>
          
          {/* Member Detail Modal Overlay - Inside Members Modal */}
          {showMemberDetailModal && selectedMember && (
            <View className="absolute inset-0 bg-black bg-opacity-70 flex justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <View className="bg-white rounded-3xl mx-6 w-80 overflow-hidden">
                {/* Member Profile Section */}
                <View className="items-center py-8 px-6">
                  <View className="relative mb-4">
                    <Avatar user={selectedMember} size={100} />
                    <View className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-white ${isUserOnline(selectedMember._id) ? 'bg-green-500' : 'bg-gray-400'}`} />
                  </View>
                  
                  <Text className="text-xl font-bold text-black mb-2">
                    {selectedMember.fullname}
                  </Text>
                  
                  {(selectedMember as any).jobTitle && (
                    <Text className="text-sm text-gray-600 text-center mb-2">
                      {(selectedMember as any).jobTitle}
                    </Text>
                  )}
                  
                  {/* Online Status */}
                  <Text className="text-sm text-gray-500">
                    {isUserOnline(selectedMember._id) ? 'Đang hoạt động' : getFormattedLastSeen(selectedMember._id)}
                  </Text>
                </View>

                {/* Action Menu */}
                <View className="bg-white border-t border-[#E5E5E5] py-2">
                  <TouchableOpacity 
                    className="flex-row items-center py-4 px-6"
                    onPress={() => {
                      setShowMemberDetailModal(false);
                      setShowMembersModal(false);
                      // Navigate to 1-1 chat with this user
                      navigation.navigate('Chat', { 
                        user: selectedMember,
                        chatId: null 
                      });
                    }}
                  >
                    <Text className="text-base text-black flex-1">Nhắn tin</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    className="flex-row items-center py-4 px-6"
                    onPress={() => {
                      Alert.alert('Thông báo', 'Tính năng đang được xây dựng', [{ text: 'OK' }]);
                    }}
                  >
                    <Text className="text-base text-black flex-1">Xem hồ sơ</Text>
                  </TouchableOpacity>

                  {/* Admin actions */}
                  {(isAdmin || isCreator) && selectedMember._id !== currentUserId && (
                    <>
                      {!groupInfo.admins.some(admin => admin._id === selectedMember._id) && (
                        <TouchableOpacity 
                          className="flex-row items-center py-4 px-6"
                          onPress={() => {
                            Alert.alert('Thông báo', 'Tính năng đang được xây dựng', [{ text: 'OK' }]);
                          }}
                        >
                          <Text className="text-base text-black flex-1">Thêm làm Quản trí viên</Text>
                        </TouchableOpacity>
                      )}

                      {selectedMember._id !== groupInfo.creator._id && (
                        <TouchableOpacity 
                          className="flex-row items-center py-4 px-6"
                          onPress={() => {
                            Alert.alert('Thông báo', 'Tính năng đang được xây dựng', [{ text: 'OK' }]);
                          }}
                        >
                          <Text className="text-base text-red-500 flex-1">Xóa khỏi nhóm</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>
              
              {/* Background tap to close */}
              <TouchableOpacity 
                className="absolute inset-0"
                onPress={() => setShowMemberDetailModal(false)}
                activeOpacity={1}
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-3">
            <TouchableOpacity onPress={() => {
              setShowAddMemberModal(false);
              setSelectedUsersToAdd([]);
              setSearchText('');
            }}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-black">Thành viên</Text>
            <TouchableOpacity onPress={() => {}}>
              <MaterialIcons name="person" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          
          {/* Selected Users Section */}
          {selectedUsersToAdd.length > 0 && (
            <View className="px-4 py-4">
              <Text className="text-base font-medium text-gray-600 mb-3">
                Đã chọn
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-3">
                  {selectedUsersToAdd.map((user) => (
                    <View key={user._id} className="items-center">
                      <View className="relative">
                        <Avatar user={user} size={60} />
                        <TouchableOpacity
                          className="absolute top-0 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center"
                          onPress={() => handleRemoveSelectedUser(user._id)}
                        >
                          <MaterialIcons name="remove" size={16} color="white" />
                        </TouchableOpacity>
                      </View>
                      <Text className="text-sm text-black mt-1 max-w-16 text-center" numberOfLines={1}>
                        {user.fullname.split(' ').slice(-1)[0]}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Search Input */}
          <View className="flex-row items-center bg-gray-100 rounded-2xl px-3 mx-4 mb-4">
            <MaterialIcons name="search" size={20} color="#666" />
            <TextInput
              className="flex-1 py-3 pl-2 text-base text-black"
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Tìm kiếm người dùng..."
            />
          </View>

          {/* Users List */}
          <View className="flex-1">
            <Text className="text-base font-medium text-gray-600 px-4 mb-3">
              Gần đây
            </Text>
            
            <FlatList
              data={filteredUsers}
              renderItem={({ item }) => {
                const isSelected = selectedUsersToAdd.some(u => u._id === item._id);
                return (
                  <TouchableOpacity
                    className="flex-row items-center px-4 py-3"
                    onPress={() => handleSelectUser(item)}
                  >
                    <Avatar user={item} size={48} />
                    <View className="flex-1 ml-3">
                      <Text className="text-base font-semibold text-black">{item.fullname}</Text>
                      <Text className="text-sm text-gray-500 mt-0.5">{item.email}</Text>
                    </View>
                    <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      isSelected ? 'bg-[#002855] border-[#002855]' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <MaterialIcons name="check" size={16} color="white" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={() => (
                <View className="p-8 items-center">
                  <Text className="text-base text-gray-500 text-center">
                    {searchText.trim() ? 'Không tìm thấy người dùng' : 'Nhập tên để tìm kiếm người dùng'}
                  </Text>
                </View>
              )}
            />
          </View>

          {/* Add Button */}
          {selectedUsersToAdd.length > 0 && (
            <View className="p-4 border-t border-gray-200">
              <TouchableOpacity
                className="bg-[#002855] py-3 rounded-full flex-row items-center justify-center"
                onPress={handleAddSelectedMembers}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <MaterialIcons name="group-add" size={20} color="white" />
                    <Text className="text-white font-semibold ml-2">
                      Thêm {selectedUsersToAdd.length} thành viên
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// Minimal styles for compatibility
const styles = StyleSheet.create({
  // Keep empty or minimal styles for backward compatibility
});

export default GroupInfoScreen; 