import React, { useState, useEffect } from 'react';
// @ts-ignore
import {View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { API_BASE_URL } from '../../config/constants';
import { User } from '../../navigation/AppNavigator';
import { getAvatar } from '../../utils/avatar';
import NotificationModal from '../../components/NotificationModal';
import { ROUTES } from '../../constants/routes';

interface CreateGroupScreenProps {
  route?: {
    params?: {
      preSelectedUsers?: User[];
    };
  };
}

const CreateGroupScreen: React.FC<CreateGroupScreenProps> = ({ route }) => {
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>(route?.params?.preSelectedUsers || []);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'nearby' | 'contacts'>('nearby');
  const [notification, setNotification] = useState({
    visible: false,
    type: 'success' as 'success' | 'error',
    message: ''
  });
  
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchText.trim()) {
      const filtered = allUsers.filter(user => 
        user.fullname.toLowerCase().includes(searchText.toLowerCase()) ||
        user.email.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(allUsers);
    }
  }, [searchText, allUsers]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      console.log('🔐 Fetching users with token:', token ? 'Found' : 'Not found');
      
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('👥 Users API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        const currentUserData = await AsyncStorage.getItem('user');
        const currentUser = currentUserData ? JSON.parse(currentUserData) : null;
        
        // Loại bỏ user hiện tại khỏi danh sách
        const otherUsers = data.filter((user: User) => user._id !== currentUser?._id);
        setAllUsers(otherUsers);
        setFilteredUsers(otherUsers);
        
        console.log('✅ Successfully fetched', otherUsers.length, 'users');
      } else {
        console.error('❌ Failed to fetch users:', response.status);
        setNotification({
          visible: true,
          type: 'error',
          message: 'Không thể tải danh sách người dùng'
        });
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      setNotification({
        visible: true,
        type: 'error',
        message: 'Không thể tải danh sách người dùng: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setNotification({
        visible: true,
        type: 'error',
        message: 'Cần quyền truy cập thư viện ảnh để chọn avatar'
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setGroupAvatar(result.assets[0].uri);
    }
  };

  const handleUserToggle = (user: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u._id === user._id);
      if (isSelected) {
        return prev.filter(u => u._id !== user._id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setNotification({
        visible: true,
        type: 'error',
        message: 'Vui lòng nhập tên nhóm'
      });
      return;
    }

    if (selectedUsers.length === 0) {
      setNotification({
        visible: true,
        type: 'error',
        message: 'Vui lòng chọn ít nhất 1 thành viên'
      });
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      console.log('🔑 Token:', token ? 'Found' : 'Not found');
      
      const requestBody = {
        name: groupName.trim(),
        description: '',
        participantIds: selectedUsers.map(u => u._id)
      };
      
      console.log('📤 Sending request to:', `${API_BASE_URL}/api/chats/group/create`);
      console.log('📤 Request body:', requestBody);
      
      const response = await fetch(`${API_BASE_URL}/api/chats/group/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);
      
      const responseText = await response.text();
      console.log('📥 Response text:', responseText);

      if (response.ok) {
        const newGroup = JSON.parse(responseText);
        console.log('✅ Group created successfully:', newGroup);
        
        // Hiển thị notification thành công
        setNotification({
          visible: true,
          type: 'success',
          message: 'Đã tạo nhóm thành công!'
        });
        
        // Sau 1 giây, navigate vào chat nhóm
        setTimeout(() => {
          setNotification(prev => ({ ...prev, visible: false }));
          navigation.replace(ROUTES.SCREENS.GROUP_CHAT_DETAIL, {
            chat: newGroup
          });
        }, 1000);
      } else {
        console.error('❌ API Error - Status:', response.status);
        console.error('❌ API Error - Response:', responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          setNotification({
            visible: true,
            type: 'error',
            message: errorData.message || 'Không thể tạo nhóm'
          });
        } catch (parseError) {
          console.error('❌ Cannot parse error response as JSON:', parseError);
          setNotification({
            visible: true,
            type: 'error',
            message: `Lỗi server (${response.status}): ${responseText.substring(0, 100)}`
          });
        }
      }
    } catch (error) {
      console.error('❌ Network Error:', error);
      setNotification({
        visible: true,
        type: 'error',
        message: 'Có lỗi xảy ra khi tạo nhóm: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (index: number) => {
    // Mock time data cho demo
    const times = ['27 phút trước', '30 phút trước', '1 giờ trước', '1 giờ trước', '3 giờ trước', '16 giờ trước', '18 giờ trước', '21 giờ trước'];
    return times[index % times.length] || '1 giờ trước';
  };

  const renderUserItem = ({ item, index }: { item: User; index: number }) => {
    const isSelected = selectedUsers.some(u => u._id === item._id);
    
    return (
      <TouchableOpacity
        className="flex-row items-center px-4 py-3"
        onPress={() => handleUserToggle(item)}
      >
        <View className="w-6 h-6 mr-3">
          {isSelected ? (
            <View className="w-6 h-6 rounded-full bg-secondary items-center justify-center">
              <MaterialIcons name="check" size={16} color="#fff" />
            </View>
          ) : (
            <View className="w-6 h-6 rounded-full border-2 border-gray-300" />
          )}
        </View>

        <Image
          source={{ uri: getAvatar(item) }}
          className="w-16 h-16 rounded-full mr-3"
          resizeMode="cover"
        />
        <View className="flex-1">
          <Text className="text-base text-black mb-1">{item.fullname}</Text>
          <Text className="text-sm text-gray-600">{getTimeAgo(index)}</Text>
        </View>
         
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View className="flex-row items-start px-4 py-3 border-b border-gray-200">
          <View className="items-center mr-4 my-auto">
               <TouchableOpacity onPress={() => navigation.goBack()}>
                 <Ionicons name="close" size={24} color="#000" />
               </TouchableOpacity>
          </View>
            <View className="flex-col items-start justify-center">
            <Text className="text-lg font-bold text-primary">Nhóm mới</Text>
            <Text className="text-sm text-primary">Đã chọn: {selectedUsers.length}</Text>
            </View>
         </View>

      {/* Group Info Section */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={handlePickImage}>
          {groupAvatar ? (
            <Image source={{ uri: groupAvatar }} className="w-16 h-16 rounded-full mr-3" />
          ) : (
            <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mr-3">
              <MaterialIcons name="camera-alt" size={28} color="#666" />
            </View>
          )}
        </TouchableOpacity>
        <TextInput
          className="flex-1 text-xl text-black py-2"
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Đặt tên nhóm"
          maxLength={100}
        />
      </View>

      {/* Search Section */}
      <View className="px-4 py-2 mb-2">
        <View className="flex-row items-center bg-gray-100 rounded-full px-3 py-3">
          <MaterialIcons name="search" size={20} color="#666" />
          <TextInput
            className="flex-1 text-base ml-2 text-black"
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm tên hoặc số điện thoại"
          />
        
        </View>
      </View>

      {/* Tabs */}
      {/* <View className="flex-row bg-gray-100">
        <TouchableOpacity 
          className={`flex-1 py-3 items-center ${activeTab === 'nearby' ? 'border-b-2 border-blue-500' : ''}`}
          onPress={() => setActiveTab('nearby')}
        >
          <Text className={`text-sm font-semibold ${activeTab === 'nearby' ? 'text-blue-500' : 'text-gray-600'}`}>
            GẦN ĐÂY
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`flex-1 py-3 items-center ${activeTab === 'contacts' ? 'border-b-2 border-blue-500' : ''}`}
          onPress={() => setActiveTab('contacts')}
        >
          <Text className={`text-sm font-semibold ${activeTab === 'contacts' ? 'text-blue-500' : 'text-gray-600'}`}>
            DANH BẠ
          </Text>
        </TouchableOpacity>
      </View> */}

      {/* Users List */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserItem}
          keyExtractor={(item) => item._id}
          style={styles.usersList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom Selected Users */}
      {selectedUsers.length > 0 && (
        <View className="h-[15%] flex-row items-center px-4 bg-gray-100 border-t border-gray-200 shadow-md">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            className="flex mr-3 mb-5"
          >
            <View className="flex-row items-center justify-center">
              {selectedUsers.map(user => (
                <TouchableOpacity 
                  key={user._id} 
                  className="relative mr-3"
                  onPress={() => handleUserToggle(user)}
                >
                  <Image
                    source={{ uri: getAvatar(user) }}
                    className="w-16 h-16 rounded-full"
                    resizeMode="cover"
                  />
                  <View className="absolute top-0 -right-1 w-5 h-5 rounded-full bg-gray-300 items-center justify-center">
                    <MaterialIcons name="close" size={12} color="#757575" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          
          <TouchableOpacity 
            className={`w-10 h-10 rounded-full items-center justify-center mb-5 ${(!groupName.trim() || loading) ? 'bg-gray-400' : 'bg-secondary'}`}
            onPress={handleCreateGroup}
            disabled={!groupName.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Notification Modal */}
      <NotificationModal
        visible={notification.visible}
        type={notification.type}
        message={notification.message}
        onClose={() => setNotification(prev => ({ ...prev, visible: false }))}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  usersList: {
    flex: 1,
  },
});

export default CreateGroupScreen; 