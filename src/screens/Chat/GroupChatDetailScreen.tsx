import React, { useState, useEffect, useRef, useCallback } from 'react';
// @ts-ignore
import {View, Text, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/constants';
import { getSocket } from '../../services/socketService';
import Avatar from '../../components/Chat/Avatar';
import GroupAvatar from '../../components/Chat/GroupAvatar';
import type { GroupInfo, Message, User } from '../../types/message';
import { ROUTES } from '../../constants/routes';

interface GroupChatDetailScreenProps {
  route: {
    params: {
      chat: GroupInfo;
    };
  };
}

const GroupChatDetailScreen: React.FC<GroupChatDetailScreenProps> = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute();
  const { chat } = route.params as { chat: GroupInfo };
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setGroupInfo(chat);
    fetchCurrentUser();
    fetchMessages();
    setupSocket();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leaveGroupChat', { chatId: chat._id });
        socketRef.current.off('receiveMessage');
        socketRef.current.off('userTypingInGroup');
        socketRef.current.off('userStopTypingInGroup');
        socketRef.current.off('groupMemberRemoved');
        socketRef.current.off('groupInfoUpdated');
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, []);
  
  useEffect(() => {
    if (currentUserId && groupInfo) {
      setIsAdmin(groupInfo.admins.some(admin => admin._id === currentUserId));
    }
  }, [currentUserId, groupInfo]);

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

  const fetchMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/chats/messages/${chat._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupSocket = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      socketRef.current = getSocket(token);

      // Join group chat room
      socketRef.current.emit('joinGroupChat', { chatId: chat._id });

      // Listen for new messages
      socketRef.current.on('receiveMessage', (message: Message) => {
        if (message.chat === chat._id) {
          setMessages(prev => [...prev, message]);
          // Scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd();
          }, 100);
        }
      });

      // Listen for typing indicators
      socketRef.current.on('userTypingInGroup', (data: any) => {
        setTypingUsers(prev => {
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        });
      });

      socketRef.current.on('userStopTypingInGroup', (data: any) => {
        setTypingUsers(prev => prev.filter(id => id !== data.userId));
      });

      // Listen for group updates
      socketRef.current.on('groupMemberRemoved', (data: any) => {
        if (data.chatId === chat._id) {
          if (data.removedUserId === currentUserId) {
            Alert.alert('Thông báo', 'Bạn đã bị xóa khỏi nhóm', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ]);
          } else {
            // Update group info to remove member
            setGroupInfo(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                participants: prev.participants.filter(p => p._id !== data.removedUserId)
              };
            });
          }
        }
      });

      socketRef.current.on('groupInfoUpdated', (data: any) => {
        if (data.chatId === chat._id) {
          setGroupInfo(prev => prev ? { ...prev, ...data.changes } : prev);
        }
      });

    } catch (error) {
      console.error('Error setting up socket:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/chats/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chat._id,
          content: newMessage.trim(),
          type: 'text',
        }),
      });

      if (response.ok) {
        setNewMessage('');
        // Stop typing indicator
        socketRef.current?.emit('groupTyping', { 
          chatId: chat._id, 
          isTyping: false 
        });
      } else {
        Alert.alert('Lỗi', 'Không thể gửi tin nhắn');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (text: string) => {
    setNewMessage(text);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing indicator
    if (text.trim() && socketRef.current) {
      socketRef.current.emit('groupTyping', { 
        chatId: chat._id, 
        isTyping: true 
      });
    }

    // Stop typing after 1 second of no typing
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current) {
        socketRef.current.emit('groupTyping', { 
          chatId: chat._id, 
          isTyping: false 
        });
      }
    }, 1000);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = typeof item.sender === 'object' 
      ? item.sender._id === currentUserId
      : item.sender === currentUserId;

    const senderInfo = typeof item.sender === 'object' ? item.sender : null;

    return (
      <View className={`my-1 ${isMyMessage ? 'items-end' : 'items-start'}`}>
        {!isMyMessage && senderInfo && (
          <View className="flex-row items-center mb-1">
            <Avatar user={senderInfo} size={32} />
            <Text className="text-sm font-semibold text-blue-500 ml-2">{senderInfo.fullname}</Text>
          </View>
        )}
        <View className={`max-w-4/5 p-3 rounded-2xl ${isMyMessage ? 'bg-blue-500' : 'bg-gray-200'}`}>
          <Text className={`text-base ${isMyMessage ? 'text-white' : 'text-black'}`}>
            {item.content}
          </Text>
          <Text className={`text-xs mt-1 ${isMyMessage ? 'text-white/70' : 'text-gray-600'}`}>
            {new Date(item.createdAt).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    return (
      <View className="px-4 py-2">
        <Text className="text-sm text-gray-600 italic">
          {typingUsers.length === 1 
            ? 'Có người đang nhập...'
            : `${typingUsers.length} người đang nhập...`
          }
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="p-2"
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <View className="flex-1 flex-row items-center ml-3">
          <GroupAvatar
            size={40}
            groupAvatar={groupInfo?.avatar}
            participants={groupInfo?.participants || []}
            currentUserId={currentUserId}
            style={{ marginRight: 12 }}
          />
          <View className="flex-1">
            <Text className="text-lg font-semibold text-gray-900">
              {groupInfo?.name}
            </Text>
            <Text className="text-sm text-gray-500">
              {groupInfo?.participants.length} thành viên
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate(ROUTES.SCREENS.GROUP_INFO as any, { groupInfo })}
          className="p-2"
        >
          <MaterialIcons name="info" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView 
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          className="flex-1 px-4"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />
        
        {renderTypingIndicator()}

        {/* Input */}
        <View className="flex-row items-end px-4 py-3 border-t border-gray-200">
          <TextInput
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-2 text-base max-h-24"
            value={newMessage}
            onChangeText={handleTyping}
            placeholder="Nhập tin nhắn..."
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            className={`${(!newMessage.trim() || sending) ? 'bg-gray-400' : 'bg-blue-500'} rounded-2xl w-10 h-10 items-center justify-center ml-2`}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="send" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Floating Add Member Button - chỉ hiện cho admin */}
      {(isAdmin || groupInfo?.settings.allowMembersToAdd) && (
        <TouchableOpacity
          className="absolute bottom-5 right-5 bg-blue-500 rounded-2xl w-10 h-10 items-center justify-center"
          onPress={() => navigation.navigate(ROUTES.SCREENS.GROUP_INFO as any, { groupInfo })}
        >
          <MaterialIcons name="person-add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

export default GroupChatDetailScreen; 