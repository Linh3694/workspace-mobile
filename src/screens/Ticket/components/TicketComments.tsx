import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTicketMessages, useTicketStore } from '../../../hooks/useTicketStore';
import { useSendMessage } from '../../../hooks/useTicketHooks';
import { useTicketSocket } from '../../../hooks/useTicketSocket';
import { getFullImageUrl } from '../../../utils/imageUtils';
import type { Message } from '../../../services/ticketService';
import Modal from 'react-native-modal';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';

interface TicketCommentsProps {
  ticketId: string;
}

interface MessageItemProps {
  message: Message;
  onImagePress: (imageUrl: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onImagePress }) => {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <View className="mb-4">
      <View className="flex-row items-start space-x-3">
        {/* Avatar */}
        <Image
          source={{
            uri: message.sender.avatarUrl
              ? getFullImageUrl(message.sender.avatarUrl)
              : 'https://via.placeholder.com/40',
          }}
          className="h-10 w-10 rounded-full"
        />

        {/* Message Content */}
        <View className="flex-1">
          <View className="mb-1 flex-row items-center space-x-2">
            <Text className="font-semibold text-gray-900">{normalizeVietnameseName(message.sender.fullname)}</Text>
            <Text className="text-xs text-gray-500">{formatTime(message.timestamp)}</Text>
          </View>

          {/* Text Message */}
          {message.text && <Text className="mb-2 text-gray-700">{message.text}</Text>}

          {/* Images */}
          {message.images && message.images.length > 0 && (
            <View className="flex-row flex-wrap space-x-2">
              {message.images.map((imageUrl, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => onImagePress(getFullImageUrl(imageUrl))}
                  className="mb-2">
                  <Image
                    source={{ uri: getFullImageUrl(imageUrl) }}
                    className="h-20 w-20 rounded-lg"
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const TicketComments: React.FC<TicketCommentsProps> = ({ ticketId }) => {
  const [messageText, setMessageText] = useState('');
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { messages, addMessage, loading: messagesLoading } = useTicketMessages();
  const sendMessageMutation = useSendMessage();
  const { canSendMessage } = useTicketStore();

  // Memoize the callback to prevent recreation on every render
  const handleNewMessage = useCallback(
    (message: Message) => {
      addMessage(message);
    },
    [addMessage]
  );

  // WebSocket for real-time updates
  const { socketState } = useTicketSocket({
    ticketId,
    currentUserId: 'current-user-id', // TODO: Get from auth context
    onNewMessage: handleNewMessage,
  });

  const handleSendMessage = async () => {
    if (!messageText.trim() && selectedImages.length === 0) return;

    try {
      await sendMessageMutation.send(ticketId, {
        text: messageText.trim() || undefined,
        images: selectedImages,
      });

      // Clear input
      setMessageText('');
      setSelectedImages([]);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn. Vui lòng thử lại.');
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
      allowsEditing: true,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
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
    setPreviewImage(imageUrl);
  };

  if (!canSendMessage) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Ionicons name="chatbox-ellipses-outline" size={48} color="#9CA3AF" />
        <Text className="mt-4 text-center text-gray-500">
          Chat sẽ khả dụng khi ticket ở trạng thái Processing hoặc Waiting for Customer
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1">
      {/* Connection Status */}
      {!socketState.connected && (
        <View className="bg-yellow-100 p-2">
          <Text className="text-center text-sm text-yellow-800">Đang kết nối...</Text>
        </View>
      )}

      {/* Messages List */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <MessageItem message={item} onImagePress={handleImagePress} />}
        className="flex-1 p-4"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          messagesLoading ? (
            <View className="flex-1 items-center justify-center py-8">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <View className="flex-1 items-center justify-center py-8">
              <Ionicons name="chatbubbles-outline" size={48} color="#9CA3AF" />
              <Text className="mt-4 text-gray-500">Chưa có tin nhắn nào</Text>
            </View>
          )
        }
      />

      {/* Selected Images Preview */}
      {selectedImages.length > 0 && (
        <View className="border-t border-gray-200 p-2">
          <FlatList
            data={selectedImages}
            horizontal
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item, index }) => (
              <View className="relative mr-2">
                <Image
                  source={{ uri: item.uri }}
                  className="h-16 w-16 rounded-lg"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => removeImage(index)}
                  className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-red-500">
                  <Ionicons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* Message Input */}
      <View className="border-t border-gray-200 p-4">
        <View className="flex-row items-end space-x-2">
          {/* Image Picker Button */}
          <TouchableOpacity
            onPress={handleImagePick}
            className="p-2"
            disabled={selectedImages.length >= 5}>
            <Ionicons
              name="image-outline"
              size={24}
              color={selectedImages.length >= 5 ? '#9CA3AF' : '#3B82F6'}
            />
          </TouchableOpacity>

          {/* Text Input */}
          <View className="max-h-32 flex-1 rounded-lg border border-gray-300 px-3 py-2">
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Nhập tin nhắn..."
              multiline
              className="text-base"
              maxLength={1000}
            />
          </View>

          {/* Send Button */}
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={
              sendMessageMutation.loading || (!messageText.trim() && selectedImages.length === 0)
            }
            className={`rounded-lg p-2 ${
              sendMessageMutation.loading || (!messageText.trim() && selectedImages.length === 0)
                ? 'bg-gray-300'
                : 'bg-blue-500'
            }`}>
            {sendMessageMutation.loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Preview Modal */}
      <Modal
        isVisible={!!previewImage}
        onBackdropPress={() => setPreviewImage(null)}
        style={{ margin: 0 }}>
        <View className="flex-1 items-center justify-center bg-black">
          <TouchableOpacity
            onPress={() => setPreviewImage(null)}
            className="absolute right-4 top-10 z-10 rounded-full bg-black/50 p-2">
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          {previewImage && (
            <Image source={{ uri: previewImage }} className="h-full w-full" resizeMode="contain" />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default TicketComments;
