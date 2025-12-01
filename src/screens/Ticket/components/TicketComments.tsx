import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Keyboard,
  Modal,
  Pressable,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Store & Hooks
import { useTicketStore, useCanSendMessage, useTicketData } from '../../../hooks/useTicketStore';
import { sendMessage as sendMessageApi, getTicketMessages, getTicketDetail } from '../../../services/ticketService';

// Utils
import { getFullImageUrl } from '../../../utils/imageUtils';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';

import type { Message } from '../../../services/ticketService';

interface TicketCommentsProps {
  ticketId: string;
}

interface GroupedMessage extends Message {
  showHeader: boolean; // Whether to show avatar and name
}

// Group consecutive messages from same sender
const groupMessages = (messages: Message[]): GroupedMessage[] => {
  if (!messages || messages.length === 0) return [];

  return messages.map((msg, index) => {
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const isSameSender = prevMsg && prevMsg.sender._id === msg.sender._id;

    // Check if within 5 minutes of previous message
    const isWithinTimeWindow = prevMsg
      ? new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 5 * 60 * 1000
      : false;

    return {
      ...msg,
      showHeader: !isSameSender || !isWithinTimeWindow,
    };
  });
};

interface MessageItemProps {
  message: GroupedMessage;
  onImagePress: (imageUrl: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = React.memo(({ message, onImagePress }) => {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <View className={`px-4 ${message.showHeader ? 'mt-4' : 'mt-1'}`}>
      <View className="flex-row">
        {/* Avatar - only show for first message in group */}
        <View className="mr-3" style={{ width: 40 }}>
          {message.showHeader && (
            <Image
              source={{
                uri: message.sender.avatarUrl
                  ? getFullImageUrl(message.sender.avatarUrl)
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(message.sender.fullname)}&background=002855&color=fff&size=80`,
              }}
              className="h-10 w-10 rounded-full bg-gray-200"
            />
          )}
        </View>

        {/* Message Content */}
        <View className="flex-1">
          {/* Header - only show for first message in group */}
          {message.showHeader && (
            <View className="mb-1 flex-row items-center">
              <Text className="font-semibold text-[#002855]">
                {normalizeVietnameseName(message.sender.fullname)}
              </Text>
              <Text className="ml-2 text-xs text-gray-400">{formatTime(message.timestamp)}</Text>
            </View>
          )}

          {/* Text Message */}
          {message.text && (
            <View className="self-start rounded-2xl rounded-tl-none bg-[#F3F4F6] px-4 py-3">
              <Text className="text-base text-gray-800">{message.text}</Text>
            </View>
          )}

          {/* Images */}
          {message.images && message.images.length > 0 && (
            <View className="mt-2 flex-row flex-wrap">
              {message.images.map((imageUrl, index) => (
                <Pressable
                  key={`${message._id}-img-${index}`}
                  onPress={() => onImagePress(getFullImageUrl(imageUrl))}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Image
                    source={{ uri: getFullImageUrl(imageUrl) }}
                    className="mb-2 mr-2 h-24 w-24 rounded-xl"
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

// Custom hook to track keyboard
const useKeyboardHeight = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showListener = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  return keyboardHeight;
};

const TicketComments: React.FC<TicketCommentsProps> = ({ ticketId }) => {
  const [messageText, setMessageText] = useState('');
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  // Global store
  const { ticket } = useTicketData();
  const canSendMessage = useCanSendMessage();
  const addMessageToStore = useTicketStore((state) => state.addMessage);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getTicketMessages(ticketId);
      setMessages(data || []);
    } catch (error) {
      console.error('[TicketComments] Error refreshing messages:', error);
    } finally {
      setRefreshing(false);
    }
  }, [ticketId]);

  // Fetch messages on mount
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoading(true);
        console.log('[TicketComments] Fetching messages for ticket:', ticketId);

        // Try to get messages from API endpoint first
        let data = await getTicketMessages(ticketId);

        // If no messages from API, try to get from ticket detail
        if (!data || data.length === 0) {
          console.log('[TicketComments] No messages from API, trying ticket detail...');

          // Check if ticket already has messages
          if (ticket?.messages && ticket.messages.length > 0) {
            console.log('[TicketComments] Using messages from ticket detail');
            data = ticket.messages;
          } else {
            // Fetch ticket detail to get messages
            const ticketDetail = await getTicketDetail(ticketId);
            if (ticketDetail?.messages && ticketDetail.messages.length > 0) {
              console.log('[TicketComments] Got messages from fresh ticket detail');
              data = ticketDetail.messages;
            }
          }
        }

        console.log('[TicketComments] Total messages loaded:', data?.length || 0);
        setMessages(data || []);
      } catch (error) {
        console.error('[TicketComments] Error loading messages:', error);
        // Still try to use messages from ticket if available
        if (ticket?.messages) {
          setMessages(ticket.messages);
        } else {
          setMessages([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [ticketId, ticket?.messages?.length]);

  // Group messages for display
  const groupedMessages = useMemo(() => groupMessages(messages), [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, keyboardHeight]);

  // Handlers
  const handleSendMessage = async () => {
    if (isSending) return;
    if (!messageText.trim() && selectedImages.length === 0) return;

    const textToSend = messageText.trim();
    const imagesToSend = [...selectedImages];

    setMessageText('');
    setSelectedImages([]);
    setIsSending(true);

    try {
      const sentMessage = await sendMessageApi(ticketId, {
        text: textToSend || undefined,
        images: imagesToSend.length > 0 ? imagesToSend : undefined,
      });

      if (sentMessage && sentMessage._id) {
        // Add to local state
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === sentMessage._id);
          if (exists) return prev;
          return [...prev, sentMessage];
        });
        // Also add to global store
        addMessageToStore(sentMessage);
      }

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } catch (error: any) {
      console.error('Send message error:', error);
      setMessageText(textToSend);
      setSelectedImages(imagesToSend);
      Alert.alert('Lỗi', error?.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setIsSending(false);
    }
  };

  const handleImagePick = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Cần quyền truy cập', 'Ứng dụng cần quyền truy cập thư viện ảnh để chọn hình.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5 - selectedImages.length,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.uri.split('/').pop() || 'image.jpg',
        type: 'image/jpeg',
      }));

      if (selectedImages.length + newImages.length > 5) {
        Alert.alert('Giới hạn', 'Chỉ được chọn tối đa 5 ảnh.');
        return;
      }

      setSelectedImages((prev) => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImagePress = (imageUrl: string) => {
    console.log('[TicketComments] Opening preview:', imageUrl);
    setPreviewImage(imageUrl);
  };

  const closePreview = () => {
    setPreviewImage(null);
  };

  // Check if messaging is allowed
  if (!canSendMessage) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <Ionicons name="chatbox-ellipses-outline" size={40} color="#9CA3AF" />
        </View>
        <Text className="text-center text-base text-gray-500">
          Chat sẽ khả dụng khi ticket ở trạng thái{'\n'}
          <Text className="font-semibold text-[#002855]">Processing</Text> hoặc{' '}
          <Text className="font-semibold text-[#002855]">Waiting for Customer</Text>
        </Text>
      </View>
    );
  }

  const canSend = (messageText.trim() || selectedImages.length > 0) && !isSending;

  // Calculate bottom padding based on keyboard
  const inputBottomPadding =
    Platform.OS === 'ios'
      ? keyboardHeight > 0
        ? keyboardHeight - insets.bottom
        : insets.bottom
      : insets.bottom;

  return (
    <View className="flex-1 bg-white">
      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={groupedMessages}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <MessageItem message={item} onImagePress={handleImagePress} />}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: 16,
          flexGrow: groupedMessages.length === 0 ? 1 : undefined,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F05023']} tintColor="#F05023" />
        }
        onContentSizeChange={() => {
          if (groupedMessages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        ListEmptyComponent={
          loading ? (
            <View className="flex-1 items-center justify-center py-8">
              <ActivityIndicator size="large" color="#002855" />
              <Text className="mt-3 text-gray-500">Đang tải tin nhắn...</Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center py-8">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Ionicons name="chatbubbles-outline" size={32} color="#9CA3AF" />
              </View>
              <Text className="text-gray-500">Chưa có tin nhắn nào</Text>
              <Text className="mt-1 text-sm text-gray-400">Hãy bắt đầu cuộc trò chuyện</Text>
            </View>
          )
        }
      />

      {/* Input Container */}
      <View
        style={{
          backgroundColor: '#fff',
          paddingBottom: Math.max(inputBottomPadding, 12),
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        }}>
        {/* Selected Images Preview */}
        {selectedImages.length > 0 && (
          <View className="border-b border-gray-100 bg-gray-50 px-4 py-3">
            <FlatList
              data={selectedImages}
              horizontal
              keyExtractor={(_, index) => `selected-${index}`}
              renderItem={({ item, index }) => (
                <View className="relative mr-3">
                  <Image
                    source={{ uri: item.uri }}
                    className="h-20 w-20 rounded-xl"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => removeImage(index)}
                    className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-red-500 shadow-sm">
                    <Ionicons name="close" size={14} color="white" />
                  </TouchableOpacity>
                </View>
              )}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        )}

        {/* Message Input */}
        <View className="px-4 py-3">
          <View className="flex-row items-end">
            {/* Image Picker Button */}
            <TouchableOpacity
              onPress={handleImagePick}
              disabled={selectedImages.length >= 5 || isSending}
              className="mr-2 h-11 w-11 items-center justify-center rounded-full bg-gray-100">
              <Ionicons
                name="image-outline"
                size={22}
                color={selectedImages.length >= 5 || isSending ? '#D1D5DB' : '#002855'}
              />
            </TouchableOpacity>

            {/* Text Input */}
            <View className="max-h-28 min-h-[44px] flex-1 justify-center rounded-2xl border border-gray-200 bg-gray-50 px-4">
              <TextInput
                ref={inputRef}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Nhập tin nhắn..."
                placeholderTextColor="#9CA3AF"
                multiline
                className="py-2 text-base text-gray-800"
                maxLength={1000}
                editable={!isSending}
                style={{ maxHeight: 100 }}
              />
            </View>

            {/* Send Button */}
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={!canSend}
              className={`ml-2 h-11 w-11 items-center justify-center rounded-full ${
                canSend ? 'bg-[#002855]' : 'bg-gray-200'
              }`}>
              {isSending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={18} color={canSend ? 'white' : '#9CA3AF'} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Image Preview Modal - Using React Native Modal */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
        statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
          <StatusBar barStyle="light-content" backgroundColor="black" />

          {/* Close Button */}
          <Pressable
            onPress={closePreview}
            style={{
              position: 'absolute',
              top: insets.top + 10,
              right: 16,
              zIndex: 999,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="close" size={28} color="white" />
          </Pressable>

          {/* Image */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {previewImage && (
              <Image
                source={{ uri: previewImage }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default TicketComments;
