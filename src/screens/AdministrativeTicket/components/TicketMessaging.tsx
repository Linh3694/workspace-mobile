import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  useAdministrativeTicketMessages,
  useCanSendAdministrativeMessage,
  useAdministrativeTicketActions,
} from '../../../hooks/useAdministrativeTicketStore';
import { useSendAdministrativeMessage } from '../../../hooks/useAdministrativeTicketHooks';
import type { AdminTicketMessage } from '../../../services/administrativeTicketService';
import { getFullImageUrl } from '../../../utils/imageUtils';
import Modal from 'react-native-modal';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import { Video, ResizeMode } from 'expo-av';

// Helper: URL có phải video không
const isVideoUrl = (url: string): boolean => {
  if (!url) return false;
  const videoExtensions = [
    '.mp4',
    '.mov',
    '.avi',
    '.webm',
    '.mkv',
    '.m4v',
    '.3gp',
    '.3g2',
    '.wmv',
    '.flv',
    '.mpeg',
    '.mpg',
  ];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some((ext) => lowerUrl.includes(ext));
};

interface TicketMessagingProps {
  ticketId: string;
}

interface MessageItemProps {
  message: AdminTicketMessage;
  onImagePress: (imageUrl: string) => void;
  onVideoPress: (videoUrl: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onImagePress, onVideoPress }) => {
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
        <Image
          source={{
            uri: message.sender.avatarUrl
              ? getFullImageUrl(message.sender.avatarUrl)
              : 'https://via.placeholder.com/40',
          }}
          className="h-10 w-10 rounded-full"
        />

        <View className="flex-1">
          <View className="mb-1 flex-row items-center space-x-2">
            <Text className="font-semibold text-gray-900">
              {normalizeVietnameseName(message.sender.fullname)}
            </Text>
            <Text className="text-xs text-gray-500">{formatTime(message.timestamp)}</Text>
          </View>

          {message.text && <Text className="mb-2 text-gray-700">{message.text}</Text>}

          {message.images && message.images.length > 0 && (
            <View className="flex-row flex-wrap space-x-2">
              {message.images.map((mediaUrl, index) => {
                const fullUrl = getFullImageUrl(mediaUrl);
                const isVideo = isVideoUrl(mediaUrl);

                return isVideo ? (
                  <TouchableOpacity
                    key={index}
                    onPress={() => onVideoPress(fullUrl)}
                    className="mb-2">
                    <View
                      style={{
                        width: 100,
                        height: 80,
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: '#1a1a1a',
                      }}>
                      <Video
                        source={{ uri: fullUrl }}
                        style={{ width: 100, height: 80 }}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                        isMuted
                      />
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}>
                          <Ionicons name="play" size={20} color="#333" style={{ marginLeft: 2 }} />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    key={index}
                    onPress={() => onImagePress(fullUrl)}
                    className="mb-2">
                    <Image
                      source={{ uri: fullUrl }}
                      className="h-20 w-20 rounded-lg"
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const TicketMessaging: React.FC<TicketMessagingProps> = ({ ticketId }) => {
  const [messageText, setMessageText] = useState('');
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const { messages } = useAdministrativeTicketMessages();
  const { fetchMessages } = useAdministrativeTicketActions();
  const sendMutation = useSendAdministrativeMessage();
  const canSendMessage = useCanSendAdministrativeMessage();

  useEffect(() => {
    if (ticketId) {
      fetchMessages(ticketId);
    }
  }, [ticketId, fetchMessages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() && selectedImages.length === 0) return;

    if (selectedImages.length > 0 && !messageText.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập nội dung tin nhắn kèm theo ảnh/video');
      return;
    }

    try {
      setSending(true);
      await sendMutation.send(ticketId, {
        text: messageText.trim() || undefined,
        images: selectedImages,
      });
      await fetchMessages(ticketId);

      setMessageText('');
      setSelectedImages([]);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  const handleImagePick = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Cần quyền truy cập', 'Ứng dụng cần quyền truy cập thư viện ảnh để chọn file.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.uri.split('/').pop() || (asset.type === 'video' ? 'video.mp4' : 'image.jpg'),
        type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
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

  const handleVideoPress = (videoUrl: string) => {
    setPreviewVideo(videoUrl);
  };

  if (!canSendMessage) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Ionicons name="chatbox-ellipses-outline" size={48} color="#9CA3AF" />
        <Text className="mt-4 text-center text-gray-500">
          Chat sẽ khả dụng khi ticket ở trạng thái In Progress hoặc Waiting for Customer
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1">
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <MessageItem
            message={item}
            onImagePress={handleImagePress}
            onVideoPress={handleVideoPress}
          />
        )}
        className="flex-1 p-4"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-8">
            <Ionicons name="chatbubbles-outline" size={48} color="#9CA3AF" />
            <Text className="mt-4 text-gray-500">Chưa có tin nhắn nào</Text>
          </View>
        }
      />

      {selectedImages.length > 0 && (
        <View className="border-t border-gray-200 p-2">
          <FlatList
            data={selectedImages}
            horizontal
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item, index }) => {
              const isVideo = item.type?.startsWith('video/');
              return (
                <View className="relative mr-2">
                  {isVideo ? (
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: '#1a1a1a',
                      }}>
                      <Video
                        source={{ uri: item.uri }}
                        style={{ width: 64, height: 64 }}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                        isMuted
                      />
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                        <Ionicons name="play" size={20} color="white" />
                      </View>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: item.uri }}
                      className="h-16 w-16 rounded-lg"
                      resizeMode="cover"
                    />
                  )}
                  <TouchableOpacity
                    onPress={() => removeImage(index)}
                    className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-red-500">
                    <Ionicons name="close" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              );
            }}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      <View className="border-t border-gray-200 p-4">
        <View className="flex-row items-end space-x-2">
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

          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={sending || (!messageText.trim() && selectedImages.length === 0)}
            className={`rounded-lg p-2 ${
              sending || (!messageText.trim() && selectedImages.length === 0)
                ? 'bg-gray-300'
                : 'bg-blue-500'
            }`}>
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>

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

      <Modal
        isVisible={!!previewVideo}
        onBackdropPress={() => setPreviewVideo(null)}
        style={{ margin: 0 }}>
        <View className="flex-1 items-center justify-center bg-black">
          <TouchableOpacity
            onPress={() => setPreviewVideo(null)}
            className="absolute right-4 top-10 z-10 rounded-full bg-black/50 p-2">
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          {previewVideo && (
            <Video
              source={{ uri: previewVideo }}
              style={{ width: '100%', height: '70%' }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default TicketMessaging;
