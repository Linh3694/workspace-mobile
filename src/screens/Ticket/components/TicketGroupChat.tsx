import React, { useState, useEffect, useCallback } from 'react';
// @ts-ignore
import { View, Text, ActivityIndicator, TouchableOpacity, Platform, KeyboardAvoidingView, FlatList, ImageBackground, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL } from '../../../config/constants';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import type { GroupInfo } from '../../../types/message';
import GroupAvatar from '../../../components/Chat/GroupAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

interface TicketGroupChatProps {
  ticketId: string;
  onRefresh?: () => void;
}

const TicketGroupChat: React.FC<TicketGroupChatProps> = ({ ticketId, onRefresh }) => {
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isParticipant, setIsParticipant] = useState(false);
  const [canJoin, setCanJoin] = useState(false);
  const [joining, setJoining] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchCurrentUser();
    fetchTicketGroupChat();
  }, [ticketId]);

  // Auto refresh khi focus vào màn hình
  useFocusEffect(
    useCallback(() => {
      fetchTicketGroupChat();
    }, [ticketId])
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
    
    const isAdmin = currentUser.role === 'admin';
    const isSuperAdmin = currentUser.role === 'superadmin';
    const canJoinAnytime = isAdmin || isSuperAdmin;
    
    return { isAdmin, isSuperAdmin, canJoinAnytime };
  };

  const fetchTicketGroupChat = async () => {
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
      const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/group-chat?t=${timestamp}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

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
      setRefreshing(false);
    }
  };

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
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        
        // Delay ngắn để đảm bảo database đã được update
        setTimeout(() => {
          setGroupInfo(data.groupChat);
          setIsParticipant(data.isCurrentUserInChat || false);
          setCanJoin(!data.isCurrentUserInChat && (currentUser?.role === 'admin' || currentUser?.role === 'superadmin'));
          setError(null);
          
          if (data.message === "Group chat đã tồn tại") {
            Alert.alert('Thông báo', `Group chat đã tồn tại với ${data.participantsCount} thành viên!`);
          } else {
            Alert.alert('Thành công', `Tạo group chat thành công với ${data.participantsCount} thành viên ban đầu!`);
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

  const resetAndRefresh = async () => {
    setRefreshing(true);
    setGroupInfo(null);
    setError(null);
    await fetchTicketGroupChat();
  };

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
          'Authorization': `Bearer ${token}`,
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
            chat: data.groupChat 
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
          chat: groupInfo 
        });
      }, 200);
    } else if (groupInfo && !isParticipant) {
      Alert.alert('Thông báo', 'Bạn cần tham gia group chat trước khi có thể chat');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white py-8">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="mt-4 text-gray-500">Đang tải group chat...</Text>
      </View>
    );
  }

  // Nếu chưa có group chat - hiển thị nút tạo
  if (!groupInfo) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-4 py-8">
        <Ionicons name="chatbubbles-outline" size={96} color="#E5E5E7" />
        <Text className="text-xl font-bold text-gray-800 mt-6 text-center">
          Chưa có Group Chat
        </Text>
        <Text className="text-gray-500 mt-2 text-center leading-6">
          Tạo group chat để trao đổi trực tiếp với{'\n'}
          kỹ thuật viên và admin về ticket này
        </Text>
        
        {/* Thông tin sẽ có trong group chat */}
        <View className="mt-8 bg-blue-50 p-4 rounded-xl max-w-sm">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
            <View className="ml-2 flex-1">
              <Text className="text-sm font-medium text-blue-900 mb-2">
                Group Chat sẽ bao gồm:
              </Text>
              <Text className="text-sm text-blue-700">
                • Người tạo ticket{'\n'}
                • Kỹ thuật viên được gán{'\n'}
                • 1 Admin hỗ trợ (được chọn tự động){'\n'}
                • Chat real-time, chia sẻ file
              </Text>
              {(() => {
                const { isSuperAdmin, isAdmin } = getUserRoleInfo();
                if (isSuperAdmin) {
                  return (
                    <Text className="text-sm text-orange-700 mt-2 font-medium">
                      • Superadmin có thể tham gia bất kỳ lúc nào
                    </Text>
                  );
                } else if (isAdmin) {
                  return (
                    <Text className="text-sm text-orange-700 mt-2 font-medium">
                      • Admin có thể tham gia bất kỳ lúc nào
                    </Text>
                  );
                }
                return null;
              })()}
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={createGroupChat}
          disabled={creating}
          className={`mt-8 px-8 py-4 rounded-xl items-center min-w-48 ${
            creating ? 'bg-gray-400' : 'bg-blue-500'
          }`}
        >
          {creating ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="white" />
              <Text className="text-white font-semibold ml-2">Đang tạo...</Text>
            </View>
          ) : (
            <View className="flex-row items-center">
              <Ionicons name="add-circle" size={20} color="white" />
              <Text className="text-white font-semibold ml-2 text-base">
                Tạo Group Chat
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Nút Reset Data */}
        <TouchableOpacity
          onPress={resetAndRefresh}
          disabled={refreshing}
          className={`mt-3 px-6 py-2 rounded-lg border ${refreshing ? 'border-gray-200' : 'border-gray-300'}`}
        >
          <View className="flex-row items-center">
            {refreshing ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <Ionicons name="refresh" size={16} color="#6B7280" />
            )}
            <Text className={`font-medium ml-2 ${refreshing ? 'text-gray-400' : 'text-gray-600'}`}>
              {refreshing ? 'Đang tải...' : 'Reset & Tải lại'}
            </Text>
          </View>
        </TouchableOpacity>

        {error && (
          <View className="mt-4">
            <Text className="text-red-500 text-sm text-center">{error}</Text>
            <TouchableOpacity
              onPress={fetchTicketGroupChat}
              className="mt-2 bg-red-500 px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-medium text-center">Thử lại</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Nếu đã có group chat - hiển thị như cũ
  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={require('../../../assets/chat-background.png')}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Chat Header */}
          <View className="flex-row items-center p-3 bg-white/90 border-b border-gray-200">
            <GroupAvatar
              size={40}
              groupAvatar={groupInfo?.avatar}
              participants={groupInfo?.participants || []}
              currentUserId={null}
              style={{ marginRight: 12 }}
            />
            <View className="flex-1">
              <Text className="font-semibold text-gray-900 text-base">
                {groupInfo.name}
              </Text>
              <Text className="text-sm text-gray-500">
                {groupInfo.participants.length} thành viên
              </Text>
            </View>
           
            {isParticipant ? (
              <TouchableOpacity
                onPress={navigateToFullChat}
                className="bg-primary px-3 py-2 rounded-lg"
              >
                <Text className="text-white text-sm font-medium">Mở Chat</Text>
              </TouchableOpacity>
            ) : canJoin ? (
              <TouchableOpacity
                onPress={joinGroupChat}
                disabled={joining}
                className={`px-3 py-2 rounded-lg ${
                  joining ? 'bg-gray-400' : 'bg-green-500'
                }`}
              >
                <Text className="text-white text-sm font-medium">
                  {joining ? 'Joining...' : 'Tham gia & Chat'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-gray-300 px-3 py-2 rounded-lg">
                <Text className="text-gray-600 text-sm font-medium">Chỉ xem</Text>
              </View>
            )}
          </View>

          {/* Info Section */}
          <View className="flex-1 justify-center items-center px-4">
            <View className="bg-white/90 p-6 rounded-2xl shadow-lg max-w-sm">
              <View className="items-center mb-4">
                <GroupAvatar
                  size={80}
                  groupAvatar={groupInfo?.avatar}
                  participants={groupInfo?.participants || []}
                  currentUserId={null}
                />
                <Text className="font-bold text-xl text-gray-900 mt-3">
                  {groupInfo.name}
                </Text>
                <Text className="text-gray-500">
                  {groupInfo.participants.length} thành viên
                </Text>
                {(() => {
                  const { isSuperAdmin, isAdmin } = getUserRoleInfo();
                  if (!isParticipant && (isSuperAdmin || isAdmin)) {
                    return (
                      <View className="mt-2 px-3 py-1 bg-orange-100 rounded-full">
                        <Text className="text-xs text-orange-700 font-medium">
                          {isSuperAdmin ? 'Superadmin - Chưa tham gia' : 'Admin - Chưa tham gia'}
                        </Text>
                      </View>
                    );
                  } else if (isParticipant) {
                    return (
                      <View className="mt-2 px-3 py-1 bg-green-100 rounded-full">
                        <Text className="text-xs text-green-700 font-medium">
                          Đã tham gia group chat
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}
              </View>

              {groupInfo.description && (
                <Text className="text-center text-gray-600 mb-4">
                  {groupInfo.description}
                </Text>
              )}

              {/* Participants Preview */}
              <View className="mb-4">
                <Text className="font-medium text-gray-700 mb-2 text-center">
                  Thành viên:
                </Text>
                {groupInfo.participants.slice(0, 3).map((participant, index) => (
                  <View key={participant._id} className="flex-row items-center py-1 justify-center">
                    <View className="w-6 h-6 bg-blue-100 rounded-full items-center justify-center mr-2">
                      <Text className="text-xs font-medium text-blue-600">
                        {participant.fullname.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text className="text-sm text-gray-700">
                      {participant.fullname}
                    </Text>
                    {groupInfo.admins.some(admin => admin._id === participant._id) && (
                      <View className="ml-2 px-2 py-0.5 bg-yellow-100 rounded-full">
                        <Text className="text-xs text-yellow-800">Admin</Text>
                      </View>
                    )}
                  </View>
                ))}
                {groupInfo.participants.length > 3 && (
                  <Text className="text-xs text-gray-500 mt-1 text-center">
                    và {groupInfo.participants.length - 3} thành viên khác
                  </Text>
                )}
              </View>

              {/* Action Button */}
              {isParticipant ? (
                <TouchableOpacity
                  onPress={navigateToFullChat}
                  className="bg-blue-500 py-4 rounded-xl items-center"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="chatbubbles" size={20} color="white" />
                    <Text className="text-white font-semibold ml-2 text-base">
                      Bắt đầu Chat
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : canJoin ? (
                <TouchableOpacity
                  onPress={joinGroupChat}
                  disabled={joining}
                  className={`py-4 rounded-xl items-center ${
                    joining ? 'bg-gray-400' : 'bg-green-500'
                  }`}
                >
                  <View className="flex-row items-center">
                    {joining ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="person-add" size={20} color="white" />
                    )}
                    <Text className="text-white font-semibold ml-2 text-base">
                      {joining ? 'Đang tham gia & mở chat...' : 'Tham gia & Chat ngay'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View className="bg-gray-200 py-4 rounded-xl items-center">
                  <Text className="text-gray-500 font-medium">
                    Bạn không có quyền tham gia group chat này
                  </Text>
                </View>
              )}

              {!isParticipant && canJoin && (
                <Text className="text-xs text-gray-500 text-center mt-2">
                  Nhấn để tham gia group chat và mở trang chat ngay lập tức
                </Text>
              )}
            </View>

          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
};

export default TicketGroupChat; 