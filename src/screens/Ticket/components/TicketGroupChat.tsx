// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
// @ts-ignore
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL } from '../../../config/constants';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import type { GroupInfo } from '../../../types/message';
// import GroupAvatar from '../../../components/Chat/GroupAvatar';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import { SvgUri } from 'react-native-svg';
import GroupchatNone from '../../../assets/Groupchat-none.svg';
import GroupchatFull from '../../../assets/Groupchat-full.svg';
// import Avatar from '../../../components/Chat/Avatar';
import { getAvatar } from '../../../utils/avatar';

interface TicketGroupChatProps {
  ticketId: string;
  ticketCode?: string;
  onRefresh?: () => void;
}

const TicketGroupChat: React.FC<TicketGroupChatProps> = ({ ticketId, ticketCode, onRefresh }) => {
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isParticipant, setIsParticipant] = useState(false);
  const [canJoin, setCanJoin] = useState(false);
  const [joining, setJoining] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchCurrentUser();
    fetchTicketGroupChat();
  }, [ticketId, fetchTicketGroupChat]);

  // Auto refresh khi focus vào màn hình

  useFocusEffect(
    useCallback(() => {
      fetchTicketGroupChat();
    }, [ticketId, fetchTicketGroupChat])
  );

  const fetchCurrentUser = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        const decoded: any = jwtDecode(token);
        setCurrentUser(decoded);
      }
    } catch (error) {
      console.error('Error decoding token:', error);
    }
  };

  const getUserRoleInfo = () => {
    if (!currentUser) return { isAdmin: false, isSuperAdmin: false, canJoinAnytime: false };
    // Hỗ trợ cả JWT có fields roles (frappe) và role cũ
    const role = (currentUser.role || '').toLowerCase();
    const roles: string[] = Array.isArray(currentUser.roles) ? currentUser.roles : [];
    const adminRoles = [
      'System Manager',
      'Administrator',
      'IT Support',
      'Helpdesk',
      'Admin',
      'Technical',
    ];
    const hasFrappeAdminRole = roles.some((r: string) => adminRoles.includes(r));

    const isAdmin = role === 'admin' || hasFrappeAdminRole;
    const isSuperAdmin = role === 'superadmin';
    const canJoinAnytime = isAdmin || isSuperAdmin;

    return { isAdmin, isSuperAdmin, canJoinAnytime };
  };

  const fetchTicketGroupChat = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setError('Không tìm thấy token xác thực');
        return;
      }

      // Thêm timestamp để tránh cache
      const timestamp = Date.now();
      const response = await fetch(
        `${API_BASE_URL}/api/tickets/${ticketId}/group-chat?t=${timestamp}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGroupInfo(data.groupChat);
          setIsParticipant(data.isParticipant || false);
          setCanJoin(data.canJoin || false);
        } else {
          setGroupInfo(null);
          setIsParticipant(false);
          setCanJoin(false);
          setError(null);
        }
      } else if (response.status === 404) {
        // Chưa có group chat - không phải lỗi
        setGroupInfo(null);
        setIsParticipant(false);
        setCanJoin(false);
        setError(null);
      } else if (response.status === 403) {
        // Có thể là permission issue, thử lại sau một chút
        console.warn('⚠️ [TicketGroupChat] 403 error, có thể đang được add vào group chat...');
        setTimeout(() => {
          fetchTicketGroupChat();
        }, 1000);
        return;
      } else {
        setError('Không thể tải group chat cho ticket này');
      }
    } catch (error) {
      console.error('Error fetching ticket group chat:', error);
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const createGroupChat = async () => {
    try {
      setCreating(true);

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Lỗi', 'Không tìm thấy token xác thực');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/group-chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Delay ngắn để đảm bảo database đã được update
        setTimeout(() => {
          setGroupInfo(data.groupChat);
          setIsParticipant(data.isCurrentUserInChat || false);
          const { canJoinAnytime } = getUserRoleInfo();
          setCanJoin(!data.isCurrentUserInChat && canJoinAnytime);
          setError(null);

          if (data.message === 'Group chat đã tồn tại') {
            Alert.alert(
              'Thông báo',
              `Group chat đã tồn tại với ${data.participantsCount} thành viên!`
            );
          } else {
            Alert.alert(
              'Thành công',
              `Tạo group chat thành công với ${data.participantsCount} thành viên ban đầu!`
            );
          }
          onRefresh?.(); // Refresh ticket data nếu có
        }, 500);
      } else {
        Alert.alert('Lỗi', data.message || 'Không thể tạo group chat');
      }
    } catch (error) {
      console.error('Error creating group chat:', error);
      Alert.alert('Lỗi', 'Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setCreating(false);
    }
  };

  // const resetAndRefresh = async () => {
  //   setRefreshing(true);
  //   setGroupInfo(null);
  //   setError(null);
  //   await fetchTicketGroupChat();
  // };

  const joinAndNavigateToChat = async () => {
    try {
      setJoining(true);

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Lỗi', 'Không tìm thấy token xác thực');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/group-chat/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update state immediately
        setGroupInfo(data.groupChat);
        setIsParticipant(true);

        // Navigate to chat right away
        setTimeout(() => {
          navigation.navigate('GroupChatDetail', {
            chat: data.groupChat,
          });
        }, 200);

        onRefresh?.(); // Refresh ticket data nếu có
      } else {
        Alert.alert('Lỗi', data.message || 'Không thể tham gia group chat');
      }
    } catch (error) {
      console.error('Error joining group chat:', error);
      Alert.alert('Lỗi', 'Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setJoining(false);
    }
  };

  // Keep old joinGroupChat for backward compatibility
  const joinGroupChat = joinAndNavigateToChat;

  const navigateToFullChat = () => {
    if (groupInfo && isParticipant) {
      // Delay ngắn để đảm bảo group chat data đã sẵn sàng
      setTimeout(() => {
        navigation.navigate('GroupChatDetail', {
          chat: groupInfo,
        });
      }, 200);
    } else if (groupInfo && !isParticipant) {
      Alert.alert('Thông báo', 'Bạn cần tham gia group chat trước khi có thể chat');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white py-8">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="mt-4 text-gray-500">Đang tải group chat...</Text>
      </View>
    );
  }

  // Nếu chưa có group chat - hiển thị nút tạo
  if (!groupInfo) {
    const screenWidth = Dimensions.get('window').width;

    return (
      <View className="flex-1 items-center justify-center px-6">
        {/* SVG Illustration */}
        <View className="mb-8" style={{ width: 226, height: 230 }}>
          <GroupchatNone />
        </View>

        {/* Main Title */}
        <Text
          className="mb-4 text-center font-bold text-lg"
          style={{ color: '#2C2759', lineHeight: 28 }}>
          Bạn có thắc mắc với kỹ thuật viên về ticket?
        </Text>

        {/* Description */}
        <Text className="mb-8 text-center text-lg text-[#757575]">
          Đừng lo, hãy tạo nhóm chat để 2 bên cùng trao đổi nhé. Chúng tôi luôn sẵn lòng lắng nghe
          và hỗ trợ bạn hết mình.
        </Text>

        {/* Create Group Chat Button */}
        <TouchableOpacity
          onPress={createGroupChat}
          disabled={creating}
          className="items-center rounded-full px-8 py-4"
          style={{
            backgroundColor: creating ? '#CCCCCC' : '#E55A3C',
            minWidth: screenWidth * 0.9,
          }}>
          {creating ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="white" />
              <Text className="ml-2 font-semibold text-white" style={{ fontSize: 16 }}>
                Đang tạo...
              </Text>
            </View>
          ) : (
            <Text className="font-semibold text-white" style={{ fontSize: 16 }}>
              Tạo nhóm chat ngay
            </Text>
          )}
        </TouchableOpacity>

        {/* Error handling */}
        {error && (
          <View className="mt-6 rounded-lg bg-red-50 p-4">
            <Text className="mb-2 text-center text-sm text-red-600">{error}</Text>
            <TouchableOpacity
              onPress={fetchTicketGroupChat}
              className="rounded-lg bg-red-500 px-4 py-2">
              <Text className="text-center font-medium text-white">Thử lại</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Nếu đã có group chat - hiển thị giao diện mới
  return (
    <View className="flex-1 items-center justify-center px-6">
      {/* SVG Illustration */}
      <View className="mb-6" style={{ width: 294, height: 201 }}>
        <GroupchatFull />
      </View>

      {/* Ticket ID */}
      <Text className="mb-4 text-center font-bold text-lg" style={{ color: '#2C2759' }}>
        Ticket: {ticketCode}
      </Text>

      {/* Description */}
      <Text className="mb-6 text-center text-gray-600" style={{ fontSize: 16 }}>
        Hãy tham gia nhóm chat để cùng trao đổi về ticket nhé
      </Text>

      {/* Participants Avatar Section */}
      <View className="mb-4 flex-row items-center justify-center">
        {groupInfo.participants.slice(0, 3).map((participant, index) => (
          <View
            key={participant._id}
            className="relative"
            style={{
              marginLeft: index > 0 ? -8 : 0,
              zIndex: 3 - index,
            }}>
            <Image
              source={{ uri: getAvatar(participant) }}
              className="h-12 w-12 rounded-full border-2 border-white"
              style={{ width: 48, height: 48 }}
            />
          </View>
        ))}
      </View>

      {/* Participants Info */}
      <Text className="mb-8 text-center text-gray-700" style={{ fontSize: 15 }}>
        {groupInfo.participants.length > 0 && (
          <>
            <Text className="font-semibold">{groupInfo.participants[0]?.fullname}</Text>
            {groupInfo.participants.length > 1 && (
              <Text> và {groupInfo.participants.length - 1} người khác</Text>
            )}
            <Text className="text-gray-600"> đã tham gia nhóm chat</Text>
          </>
        )}
      </Text>

      {/* Action Button */}
      {isParticipant ? (
        <TouchableOpacity
          onPress={navigateToFullChat}
          className="mt-5 items-center rounded-full px-8 py-4"
          style={{
            backgroundColor: '#E55A3C',
            minWidth: Dimensions.get('window').width * 0.8,
          }}>
          <Text className="font-semibold text-white" style={{ fontSize: 16 }}>
            Mở chat ngay
          </Text>
        </TouchableOpacity>
      ) : canJoin ? (
        <TouchableOpacity
          onPress={joinGroupChat}
          disabled={joining}
          className="items-center rounded-full px-8 py-4"
          style={{
            backgroundColor: joining ? '#CCCCCC' : '#E55A3C',
            minWidth: Dimensions.get('window').width * 0.9,
          }}>
          {joining ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="white" />
              <Text className="ml-2 font-semibold text-white" style={{ fontSize: 16 }}>
                Đang tham gia...
              </Text>
            </View>
          ) : (
            <Text className="font-semibold text-white" style={{ fontSize: 16 }}>
              Tham gia ngay
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <View
          className="items-center rounded-full bg-gray-300 px-8 py-4"
          style={{ minWidth: Dimensions.get('window').width * 0.8 }}>
          <Text className="font-semibold text-gray-600" style={{ fontSize: 16 }}>
            Chỉ xem
          </Text>
        </View>
      )}

      {/* Error handling */}
      {error && (
        <View className="mt-6 rounded-lg bg-red-50 p-4">
          <Text className="mb-2 text-center text-sm text-red-600">{error}</Text>
          <TouchableOpacity
            onPress={fetchTicketGroupChat}
            className="rounded-lg bg-red-500 px-4 py-2">
            <Text className="text-center font-medium text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default TicketGroupChat;
