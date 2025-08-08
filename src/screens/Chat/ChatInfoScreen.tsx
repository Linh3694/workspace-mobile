import React, { useState, useEffect } from 'react';
// @ts-ignore
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { getAvatar } from '../../utils/avatar';
import { API_BASE_URL } from '../../config/constants.js';
import { useOnlineStatus } from '../../context/OnlineStatusContext';
import { User } from '../../navigation/AppNavigator';

// Extended user interface với thông tin đầy đủ từ DB
interface FullUserInfo extends User {
  employeeCode?: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  address?: string;
}

interface ChatInfoScreenProps {
  route: {
    params: {
      user: User;
      chatId?: string;
    };
  };
}

const ChatInfoScreen: React.FC<ChatInfoScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute();
  const { user: chatPartner, chatId } = route.params as { user: User; chatId?: string };
  const [avatarError, setAvatarError] = useState(false);
  const [fullUserInfo, setFullUserInfo] = useState<FullUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { isUserOnline, getFormattedLastSeen } = useOnlineStatus();
  const insets = useSafeAreaInsets();

  // Fetch thông tin đầy đủ của user từ database
  const fetchFullUserInfo = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.warn('No auth token found');
        setFullUserInfo(chatPartner);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/users/${chatPartner._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const userData = await response.json();
          console.log('✅ Fetched full user info:', userData);
          setFullUserInfo(userData);
        } else {
          console.warn('⚠️ API returned non-JSON response, using basic info');
          setFullUserInfo(chatPartner);
        }
      } else {
        console.warn('⚠️ Failed to fetch user info:', response.status);
        setFullUserInfo(chatPartner);
      }
    } catch (error) {
      console.warn('⚠️ Error fetching user info:', error);
      setFullUserInfo(chatPartner);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFullUserInfo();
  }, [chatPartner._id]);

  const handleImageError = () => {
    setAvatarError(true);
  };

  const getFallbackAvatar = () => {
    const userInfo = fullUserInfo || chatPartner;
    if (!userInfo)
      return 'https://ui-avatars.com/api/?name=Unknown&background=F97316&color=ffffff&size=200';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.fullname)}&background=F97316&color=ffffff&size=200&font-size=0.5`;
  };

  const handleViewMedia = () => {
    Alert.alert('Thông báo', 'Tính năng xem ảnh, video sẽ được cập nhật trong phiên bản tiếp theo');
  };

  const handleSearchInChat = () => {
    Alert.alert(
      'Thông báo',
      'Tính năng tìm kiếm trong cuộc trò chuyện sẽ được cập nhật trong phiên bản tiếp theo'
    );
  };

  const handleAttachFiles = () => {
    Alert.alert(
      'Thông báo',
      'Tính năng tìm tệp đính kèm sẽ được cập nhật trong phiên bản tiếp theo'
    );
  };

  const handleLinks = () => {
    Alert.alert('Thông báo', 'Tính năng liên kết sẽ được cập nhật trong phiên bản tiếp theo');
  };

  const handleNotificationSettings = () => {
    Alert.alert(
      'Thông báo',
      'Tính năng cài đặt thông báo sẽ được cập nhật trong phiên bản tiếp theo'
    );
  };

  const handleBlockUser = () => {
    Alert.alert(
      'Chặn người dùng',
      `Bạn có chắc chắn muốn chặn ${(fullUserInfo || chatPartner).fullname}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Chặn',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Thông báo',
              'Tính năng chặn người dùng sẽ được cập nhật trong phiên bản tiếp theo'
            );
          },
        },
      ]
    );
  };

  // Sử dụng fullUserInfo nếu có, fallback về chatPartner
  const displayUser = fullUserInfo || chatPartner;

  return (
    <SafeAreaView
      style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView className="flex-1">
        {/* Profile Section */}
        <View className="mx-4 items-center rounded-2xl p-6">
          {/* Avatar với online status */}
          <View className="relative mb-4">
            <Image
              source={{
                uri: avatarError ? getFallbackAvatar() : getAvatar(displayUser),
              }}
              className="h-24 w-24 rounded-full"
              onError={handleImageError}
              onLoad={() => setAvatarError(false)}
            />
            {/* Online status indicator */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 4,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: isUserOnline(chatPartner._id) ? '#10B981' : '#6B7280',
                borderWidth: 3,
                borderColor: 'white',
              }}
            />
          </View>

          {/* User Info */}
          <Text className="my-2 font-bold text-3xl text-primary">{displayUser?.fullname}</Text>
          {(fullUserInfo as FullUserInfo)?.jobTitle && (
            <Text className="mb-2 font-medium text-[#757575]">
              {(fullUserInfo as FullUserInfo).jobTitle}
            </Text>
          )}
          {/* <Text className="text-[#757575] font-medium mb-2">
                        {isUserOnline(chatPartner._id) ? 'Đang hoạt động' : getFormattedLastSeen(chatPartner._id)}
                    </Text> */}

          {/* Employee Code Badge */}
          <View className="rounded-full bg-[#F9FBEB] px-4 py-2">
            <Text className="font-semibold text-lg text-black">
              {displayUser?.employeeCode || 'N/A'}
            </Text>
          </View>
        </View>

        {/* Quick Actions Section */}
        <View className="mx-4 mb-3 flex-row justify-center">
          {/* Search Action */}
          <TouchableOpacity className="mx-8 items-center" onPress={handleSearchInChat}>
            <View className="mb-2 h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Ionicons name="search" size={24} color="#6B7280" />
            </View>
            <Text className="font-medium text-sm text-gray-600">Tìm</Text>
          </TouchableOpacity>

          {/* Notification Action */}
          <TouchableOpacity className="mx-8 items-center" onPress={handleNotificationSettings}>
            <View className="mb-2 h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Ionicons name="notifications" size={24} color="#6B7280" />
            </View>
            <Text className="font-medium text-sm text-gray-600">Thông báo</Text>
          </TouchableOpacity>
        </View>

        {/* Contact Info Section */}
        <View className="mx-4 mt-2 rounded-2xl bg-[#f8f8f8] px-4 py-2">
          <View className="my-2">
            <Text className="font-semibold text-lg text-black">Thông tin liên hệ</Text>
          </View>
          <View className="gap-2">
            {/* Phone */}
            <View className="my-2 flex-row items-center">
              <Ionicons name="call-outline" size={20} color="#757575" />
              <Text className="ml-5 font-medium text-black">{displayUser.phone || 'N/A'}</Text>
            </View>

            {/* Email */}
            <View className="my-2 flex-row items-center">
              <Ionicons name="mail-outline" size={20} color="#757575" />
              <Text className="ml-5 font-medium text-black">{displayUser?.email || 'N/A'}</Text>
            </View>

            {/* Department */}
            <View className="my-2 flex-row items-center">
              <Ionicons name="business-outline" size={20} color="#757575" />
              <Text className="ml-5 font-medium text-black">{displayUser.department || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Chat Actions Section - Reduced actions */}
        <View className="mt-8 rounded-2xl border-t border-[#E5E5E5]">
          <View className="gap-8 p-5">
            <Text className="font-semibold text-base text-black">Hành động</Text>

            {/* View Media */}
            <TouchableOpacity className="flex-row items-center" onPress={handleViewMedia}>
              <Ionicons name="images-outline" size={20} color="#757575" />
              <Text className="ml-5 flex-1 font-medium text-black">Xem ảnh, video</Text>
              <Ionicons name="chevron-forward" size={16} color="#757575" />
            </TouchableOpacity>

            {/* Attach Files */}
            <TouchableOpacity className="flex-row items-center" onPress={handleAttachFiles}>
              <Ionicons name="attach-outline" size={20} color="#757575" />
              <Text className="ml-5 flex-1 font-medium text-black">Tìm tệp đính kèm</Text>
              <Ionicons name="chevron-forward" size={16} color="#757575" />
            </TouchableOpacity>

            {/* Links */}
            <TouchableOpacity className="flex-row items-center" onPress={handleLinks}>
              <Ionicons name="link-outline" size={20} color="#757575" />
              <Text className="ml-5 flex-1 font-medium text-black">Liên kết</Text>
              <Ionicons name="chevron-forward" size={16} color="#757575" />
            </TouchableOpacity>

            {/* Block User */}
            <TouchableOpacity onPress={handleBlockUser} className="flex-row items-center">
              <MaterialIcons name="block" size={20} color="#EF4444" />
              <Text className="ml-5 font-medium text-red-500">Chặn người dùng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
});

export default ChatInfoScreen;
