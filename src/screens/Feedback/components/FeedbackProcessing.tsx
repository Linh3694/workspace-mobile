import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import { getStatusLabel, getStatusColor } from '../../../config/feedbackConstants';
import { useFeedbackData, useFeedbackActions } from '../../../hooks/useFeedbackStore';
import { toast } from '../../../utils/toast';

interface FeedbackProcessingProps {
  feedbackId: string;
  isReadOnly?: boolean;
  isAssignedToMe?: boolean;
}

const FeedbackProcessing: React.FC<FeedbackProcessingProps> = ({
  feedbackId,
  isReadOnly = false,
  isAssignedToMe = false,
}) => {
  // Local states
  const [replyText, setReplyText] = useState('');
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const replyInputRef = useRef<View>(null);

  // Store
  const { feedback, refreshing } = useFeedbackData();
  const { refreshFeedback, addReply } = useFeedbackActions();

  // Check if can send reply
  const isClosed = ['Đóng', 'Tự động đóng', 'Hoàn thành'].includes(feedback?.status || '');
  const canSendReply = !isReadOnly && feedback?.assigned_to && !isClosed;

  // Pick image/video
  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets) {
        const newMedia = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || `media_${Date.now()}${asset.type === 'video' ? '.mp4' : '.jpg'}`,
          type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        }));
        setSelectedImages((prev) => [...prev, ...newMedia].slice(0, 10));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      toast.error('Không thể chọn ảnh');
    }
  }, []);

  // Remove selected image
  const handleRemoveImage = useCallback((index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Send reply
  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() && selectedImages.length === 0) {
      toast.error('Vui lòng nhập nội dung hoặc chọn ảnh/video');
      return;
    }

    setIsSending(true);
    try {
      // Pass selectedImages to addReply
      const success = await addReply(replyText.trim(), false, selectedImages);

      if (success) {
        setReplyText('');
        setSelectedImages([]);
        toast.success('Đã gửi phản hồi');
      } else {
        toast.error('Không thể gửi phản hồi');
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Không thể gửi phản hồi');
    } finally {
      setIsSending(false);
    }
  }, [replyText, selectedImages, addReply]);

  // Scroll to input on focus
  const handleInputFocus = useCallback(() => {
    // Delay để đợi keyboard hiển thị xong rồi scroll
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    // Scroll lần nữa sau khi keyboard đã fully shown
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 400);
  }, []);

  if (!feedback) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}>
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-white p-4"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshFeedback}
            colors={['#F05023']}
            tintColor="#F05023"
          />
        }>
        {/* Status Section */}
        <View className="mb-4 rounded-2xl bg-[#F8F8F8] p-4">
          <Text className="mb-2 text-lg font-semibold">Trạng thái hiện tại</Text>
          <View className={`self-start rounded-lg px-4 py-1 ${getStatusColor(feedback.status)}`}>
            <Text className="text-base font-bold text-white">
              {getStatusLabel(feedback.status)}
            </Text>
          </View>

          {/* Show assigned user */}
          {feedback.assigned_to_full_name && (
            <View className="mt-3">
              <Text className="text-sm text-gray-500">Người xử lý:</Text>
              <Text className="mt-1 font-medium">
                {normalizeVietnameseName(feedback.assigned_to_full_name)}
              </Text>
              {feedback.assigned_to_jobtitle && (
                <Text className="text-sm text-gray-400">{feedback.assigned_to_jobtitle}</Text>
              )}
            </View>
          )}

          {/* Not assigned warning */}
          {!feedback.assigned_to && !isClosed && (
            <View className="mt-3 rounded-lg bg-yellow-100 p-3">
              <Text className="text-center text-yellow-700">
                Chưa có người xử lý được phân công. Vui lòng chọn người xử lý để có thể phản hồi.
              </Text>
            </View>
          )}
        </View>

        {/* Conversation History */}
        <View className="mb-4">
          <Text className="mb-3 text-lg font-semibold">Lịch sử trao đổi</Text>

          {feedback.replies && feedback.replies.length > 0 ? (
            feedback.replies
              .filter((reply) => !reply.is_internal)
              .map((reply, index) => {
                const isStaff = reply.reply_by_type === 'Staff';
                const staffName = normalizeVietnameseName(reply.reply_by_full_name || 'Kỹ thuật');
                const guardianName =
                  reply.reply_by_full_name || feedback.guardian_info?.name || 'Phụ huynh';

                return (
                  <View
                    key={index}
                    className="mb-3 rounded-2xl bg-white p-4"
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                      elevation: 2,
                    }}>
                    {/* Header với avatar và tên */}
                    <View className="mb-2 flex-row items-center">
                      {isStaff ? (
                        <>
                          {/* Avatar cho kỹ thuật - chữ cái đầu tên */}

                          <Text className="text-base font-bold text-[#2E7D32]">{staffName}</Text>
                        </>
                      ) : (
                        <>
                          {/* Avatar cho phụ huynh - chữ cái đầu */}
                          <Text className="text-base font-bold text-[#E53935]">
                            Phụ huynh {guardianName}
                          </Text>
                        </>
                      )}
                    </View>

                    {/* Nội dung tin nhắn - tách nội dung và file đính kèm */}
                    {(() => {
                      // Extract text content (before "---" separator)
                      const parts = reply.content.split('\n\n---\n');
                      const textContent = parts[0]?.trim();

                      // Extract file URLs from HTML links
                      const fileUrlRegex = /href="([^"]+)"/g;
                      const attachmentUrls: string[] = [];
                      let match;
                      while ((match = fileUrlRegex.exec(reply.content)) !== null) {
                        attachmentUrls.push(match[1]);
                      }

                      return (
                        <>
                          {textContent && (
                            <Text className="mb-2 text-base leading-6 text-gray-700">
                              {textContent}
                            </Text>
                          )}

                          {/* Hiển thị file đính kèm */}
                          {attachmentUrls.length > 0 && (
                            <View className="mt-2 flex-row flex-wrap gap-2">
                              {attachmentUrls.map((url, fileIndex) => {
                                const fullUrl = url.startsWith('http')
                                  ? url
                                  : `https://admin.sis.wellspring.edu.vn${url}`;
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                                const isVideo = /\.(mp4|mov|avi|webm)$/i.test(url);

                                if (isImage) {
                                  return (
                                    <TouchableOpacity
                                      key={fileIndex}
                                      onPress={() => setPreviewImage(fullUrl)}
                                      className="h-20 w-20 overflow-hidden rounded-lg">
                                      <Image
                                        source={{ uri: fullUrl }}
                                        className="h-full w-full"
                                        resizeMode="cover"
                                      />
                                    </TouchableOpacity>
                                  );
                                }

                                if (isVideo) {
                                  return (
                                    <TouchableOpacity
                                      key={fileIndex}
                                      onPress={() => setPreviewVideo(fullUrl)}
                                      className="h-20 w-20 items-center justify-center rounded-lg bg-gray-800">
                                      <Ionicons name="play-circle" size={32} color="white" />
                                      <Text className="mt-1 text-xs text-white">Xem video</Text>
                                    </TouchableOpacity>
                                  );
                                }

                                // Other files
                                return (
                                  <View
                                    key={fileIndex}
                                    className="flex-row items-center rounded-lg bg-gray-100 px-2 py-1">
                                    <Ionicons name="document" size={16} color="#666" />
                                    <Text className="ml-1 text-xs text-gray-600" numberOfLines={1}>
                                      {url.split('/').pop()}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </>
                      );
                    })()}

                    {/* Thời gian */}
                    <Text className="text-sm text-gray-400">
                      {new Date(reply.reply_date).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                );
              })
          ) : (
            <View className="rounded-2xl bg-white p-4">
              <Text className="text-center text-sm italic text-gray-400">Chưa có phản hồi</Text>
            </View>
          )}
        </View>

        {/* Reply Input - Only show if can reply */}
        {canSendReply && isAssignedToMe && (
          <View ref={replyInputRef} className="mb-4 rounded-2xl bg-[#F8F8F8] p-4">
            <Text className="mb-3 text-lg font-semibold">Phản hồi phụ huynh</Text>

            {/* Input area */}
            <View className="rounded-xl bg-white p-3">
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Nhập nội dung phản hồi..."
                multiline
                numberOfLines={4}
                className="text-base"
                style={{ minHeight: 80, textAlignVertical: 'top' }}
                editable={!isSending}
                onFocus={handleInputFocus}
              />

              {/* Image/Video preview */}
              {selectedImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                  {selectedImages.map((media, index) => {
                    const isVideo = media.type?.startsWith('video/');
                    return (
                      <View key={index} className="relative mr-2">
                        {isVideo ? (
                          <View
                            style={{
                              width: 60,
                              height: 60,
                              borderRadius: 8,
                              overflow: 'hidden',
                              backgroundColor: '#1a1a1a',
                            }}>
                            <Video
                              source={{ uri: media.uri }}
                              style={{ width: 60, height: 60 } as any}
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
                            source={{ uri: media.uri }}
                            style={{ width: 60, height: 60, borderRadius: 8 }}
                          />
                        )}
                        <TouchableOpacity
                          onPress={() => handleRemoveImage(index)}
                          style={{
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            backgroundColor: '#ef4444',
                            borderRadius: 10,
                            width: 20,
                            height: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <Ionicons name="close" size={14} color="white" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              {/* Action buttons */}
              <View className="mt-3 flex-row items-center justify-between">
                <TouchableOpacity
                  onPress={handlePickImage}
                  disabled={isSending}
                  className="rounded-lg p-2">
                  <Ionicons name="image-outline" size={24} color="#6b7280" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSendReply}
                  disabled={isSending || !replyText.trim()}
                  style={{
                    backgroundColor: !replyText.trim() ? '#d1d5db' : '#002855',
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                  {isSending ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="white" />
                      <Text className="ml-1 font-medium text-white">Gửi</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Show message if can reply but not assigned to me */}
        {canSendReply && !isAssignedToMe && (
          <View className="mb-4 rounded-2xl bg-gray-100 p-4">
            <Text className="text-center text-gray-500">
              Chỉ người được phân công ({normalizeVietnameseName(feedback.assigned_to_full_name)})
              mới có thể phản hồi
            </Text>
          </View>
        )}

        {/* Closed message */}
        {isClosed && (
          <View className="mb-4 rounded-2xl bg-green-100 p-4">
            <Text className="text-center font-medium text-green-700">Góp ý này đã được đóng</Text>
          </View>
        )}

        {/* Image Preview Modal */}
        <Modal
          visible={!!previewImage}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewImage(null)}>
          <View className="flex-1 items-center justify-center bg-black/80">
            <TouchableOpacity
              onPress={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: 50,
                right: 20,
                zIndex: 10,
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20,
                padding: 8,
              }}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            {previewImage && (
              <Image
                source={{ uri: previewImage }}
                style={{ width: '90%', height: '70%' }}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>

        {/* Video Preview Modal */}
        <Modal
          visible={!!previewVideo}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVideo(null)}>
          <View className="flex-1 items-center justify-center bg-black">
            <TouchableOpacity
              onPress={() => setPreviewVideo(null)}
              style={{
                position: 'absolute',
                top: 50,
                right: 20,
                zIndex: 10,
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20,
                padding: 8,
              }}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            {previewVideo && (
              <Video
                source={{ uri: previewVideo }}
                style={{ width: '100%', height: '70%' } as any}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay
              />
            )}
          </View>
        </Modal>

        {/* Extra padding for keyboard */}
        <View className="h-32" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default FeedbackProcessing;
