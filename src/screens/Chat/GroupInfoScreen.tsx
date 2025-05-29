import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, FlatList, ActivityIndicator, SafeAreaView, Image} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/constants';
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
  
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute();
  const { groupInfo: initialGroupInfo } = route.params as { groupInfo: GroupInfo };
  const insets = useSafeAreaInsets();

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

  const renderMemberItem = ({ item }: { item: User }) => {
    const memberIsAdmin = groupInfo?.admins.some(admin => admin._id === item._id);
    const memberIsCreator = groupInfo?.creator._id === item._id;
    const canManageMember = isCreator && !memberIsCreator;

    return (
      <View style={styles.memberItem}>
        <Avatar user={item} size={48} />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.fullname}</Text>
          <Text style={styles.memberEmail}>{item.email}</Text>
        </View>
        <View style={styles.memberActions}>
          {memberIsCreator && (
            <Text style={styles.creatorBadge}>Người tạo</Text>
          )}
          {memberIsAdmin && !memberIsCreator && (
            <Text style={styles.adminBadge}>Admin</Text>
          )}
          {canManageMember && (
            <TouchableOpacity
              style={styles.actionButton}
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
              style={[styles.actionButton, styles.dangerButton]}
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
      style={styles.userToAddItem}
      onPress={() => handleAddMember(item._id)}
    >
      <Avatar user={item} size={40} />
      <View style={styles.userToAddInfo}>
        <Text style={styles.userToAddName}>{item.fullname}</Text>
        <Text style={styles.userToAddEmail}>{item.email}</Text>
      </View>
      <MaterialIcons name="add-circle" size={24} color="#007AFF" />
    </TouchableOpacity>
  );

  if (!groupInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin nhóm</Text>
        {(isAdmin || isCreator) && !isEditing && (
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <MaterialIcons name="edit" size={24} color="#007AFF" />
          </TouchableOpacity>
        )}
        {isEditing && (
          <TouchableOpacity onPress={handleUpdateGroupInfo} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.saveButton}>Lưu</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Group Info Section */}
        <View style={styles.groupInfoSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleChangeAvatar}
            disabled={uploadingAvatar || (!isAdmin && !isCreator)}
          >
            <GroupAvatar
              size={80}
              groupAvatar={groupInfo.avatar}
              participants={groupInfo.participants}
              currentUserId={currentUserId}
            />
            {(isAdmin || isCreator) && (
              <View style={styles.avatarOverlay}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialIcons name="camera-alt" size={20} color="#fff" />
                )}
              </View>
            )}
          </TouchableOpacity>
          
          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editNameInput}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Tên nhóm"
                maxLength={100}
              />
              <TextInput
                style={styles.editDescriptionInput}
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Mô tả nhóm (không bắt buộc)"
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>
          ) : (
            <View style={styles.infoContainer}>
              <Text style={styles.groupName}>{groupInfo.name}</Text>
              {groupInfo.description && (
                <Text style={styles.groupDescription}>{groupInfo.description}</Text>
              )}
              <Text style={styles.memberCount}>
                {groupInfo.participants.length} thành viên
              </Text>
              <Text style={styles.createdDate}>
                Tạo bởi {groupInfo.creator.fullname} • {new Date(groupInfo.createdAt).toLocaleDateString('vi-VN')}
              </Text>
            </View>
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => {
              setShowMembersModal(true);
            }}
          >
            <MaterialIcons name="people" size={24} color="#007AFF" />
            <Text style={styles.actionText}>Xem danh sách thành viên</Text>
            <Text style={styles.actionSubtext}>{groupInfo.participants.length} thành viên</Text>
          </TouchableOpacity>

          {(isAdmin || groupInfo.settings.allowMembersToAdd) && (
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => {
                fetchUsers();
                setShowAddMemberModal(true);
              }}
            >
              <MaterialIcons name="person-add" size={24} color="#007AFF" />
              <Text style={styles.actionText}>Thêm thành viên</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.actionItem, styles.dangerAction]}
            onPress={handleLeaveGroup}
          >
            <MaterialIcons name="exit-to-app" size={24} color="#FF3B30" />
            <Text style={[styles.actionText, styles.dangerText]}>Rời khỏi nhóm</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Danh sách thành viên</Text>
            <TouchableOpacity onPress={() => setShowMembersModal(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={groupInfo.participants}
            renderItem={renderMemberItem}
            keyExtractor={(item) => item._id}
            style={styles.membersList}
          />
        </SafeAreaView>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Thêm thành viên</Text>
            <TouchableOpacity onPress={() => setShowAddMemberModal(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Tìm kiếm người dùng..."
            />
          </View>

          <FlatList
            data={filteredUsers}
            renderItem={renderUserToAdd}
            keyExtractor={(item) => item._id}
            style={styles.usersList}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchText.trim() ? 'Không tìm thấy người dùng' : 'Nhập tên để tìm kiếm người dùng'}
                </Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  content: {
    flex: 1,
  },
  groupInfoSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editContainer: {
    width: '100%',
    alignItems: 'center',
  },
  editNameInput: {
    width: '100%',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
    paddingVertical: 8,
    marginBottom: 16,
  },
  editDescriptionInput: {
    width: '100%',
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
  },
  infoContainer: {
    alignItems: 'center',
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  memberCount: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  createdDate: {
    fontSize: 12,
    color: '#999',
  },
  actionsSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  actionText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 12,
    flex: 1,
    fontWeight: '500',
  },
  actionSubtext: {
    fontSize: 14,
    color: '#666',
  },
  dangerAction: {
    backgroundColor: '#FFF2F0',
  },
  dangerText: {
    color: '#FF3B30',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  membersList: {
    flex: 1,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9500',
    backgroundColor: '#FFF4E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  adminBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#E6F3FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  dangerButton: {
    backgroundColor: '#FFF2F0',
    borderRadius: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 8,
    fontSize: 16,
  },
  usersList: {
    flex: 1,
  },
  userToAddItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userToAddInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userToAddName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  userToAddEmail: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default GroupInfoScreen; 