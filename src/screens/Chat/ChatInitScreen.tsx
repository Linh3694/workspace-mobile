import React, { useEffect } from 'react';
// @ts-ignore
import { View, ActivityIndicator, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../config/constants';
import { ROUTES } from '../../constants/routes';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatInit'>;

const ChatInitScreen = ({ route, navigation }: Props) => {
  const { chatId, senderId } = route.params;

  console.log('🚀 [ChatInit] Screen loaded with params:', {
    chatId,
    senderId,
    routeParams: route.params,
  });

  useEffect(() => {
    const fetchUserAndNavigate = async () => {
      try {
        // Validate params trước khi tiếp tục
        if (!senderId || senderId === 'undefined' || typeof senderId !== 'string') {
          console.error('❌ [ChatInit] Invalid senderId:', senderId);
          // Quay về màn hình chính nếu senderId invalid
          navigation.replace('Main', {});
          return;
        }

        // Hiển thị loading
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          // Nếu chưa đăng nhập, chuyển về màn hình đăng nhập
          navigation.reset({
            index: 0,
            routes: [{ name: ROUTES.AUTH.LOGIN }],
          });
          return;
        }

        console.log('🔗 [ChatInit] Fetching user:', senderId);

        // Gọi API lấy thông tin người dùng
        const response = await fetch(`${BASE_URL}/api/users/${senderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log(
            '✅ [ChatInit] User data loaded:',
            userData?.fullname || userData?.email || 'Unknown'
          );
          // Chuyển đến màn hình chat với thông tin người dùng và chat
          navigation.replace('ChatDetail', {
            chatId,
            user: userData,
          });
        } else {
          console.error('❌ [ChatInit] User API error:', response.status, response.statusText);
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error('❌ [ChatInit] Error response:', errorText);

          // Nếu không lấy được thông tin người dùng, quay về màn hình chính
          navigation.replace('Main', {});
        }
      } catch (error) {
        console.error('❌ [ChatInit] Exception:', error);
        // Nếu có lỗi, quay về màn hình chính
        navigation.replace('Main', {});
      }
    };

    fetchUserAndNavigate();
  }, [chatId, senderId, navigation]);

  return (
    <View
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#009483" />
      <Text style={{ marginTop: 16, color: '#666', fontFamily: 'Inter', fontWeight: 'medium' }}>
        {!senderId || senderId === 'undefined'
          ? 'Tham số không hợp lệ...'
          : 'Đang tải cuộc trò chuyện...'}
      </Text>
    </View>
  );
};

export default ChatInitScreen;
