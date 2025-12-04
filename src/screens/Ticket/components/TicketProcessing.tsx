import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TextInput,
  ScrollView,
  RefreshControl,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';

// Store & Hooks
import {
  useTicketStore,
  useTicketData,
  useTicketActions,
  useTicketUIActions,
  useTicketSubTasks,
  useTicketMessages,
} from '../../../hooks/useTicketStore';

// Utils & Constants
import { toast } from '../../../utils/toast';
import { getStatusLabel } from '../../../config/ticketConstants';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import { getFullImageUrl } from '../../../utils/imageUtils';

// Services
import { sendMessage } from '../../../services/ticketService';

// Components
import { TicketStatusSheet, SubTaskStatusSheet } from './TicketModals';

import type { SubTask } from '../../../services/ticketService';
import type { SubTaskStatus, TicketStatus } from '../../../hooks/useTicketStore';

// Helper function để kiểm tra URL có phải là video không
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

// Lottie animations for feedback stars
const ratingAnimations = [
  require('../../../assets/emoji/1star.json'),
  require('../../../assets/emoji/2star.json'),
  require('../../../assets/emoji/3star.json'),
  require('../../../assets/emoji/4star.json'),
  require('../../../assets/emoji/5star.json'),
];

interface TicketProcessingProps {
  ticketId: string;
  ticketCode?: string;
}

// Admin can only choose these statuses
const ADMIN_STATUS_OPTIONS = ['Processing', 'Done', 'Cancelled'];

// Helper function - defined outside component to avoid recreation
const normalizeStatus = (status = '') => {
  const lower = status.toLowerCase().replace(/_/g, ' ');
  // "waiting for customer" được xử lý như "Processing" để UI đồng nhất cho guest
  if (lower === 'processing' || lower === 'waiting for customer') return 'Processing';
  if (lower === 'done' || lower === 'completed') return 'Done';
  if (lower === 'cancelled') return 'Cancelled';
  if (lower === 'closed') return 'Closed';
  if (lower === 'assigned') return 'Assigned';
  return status;
};

// Helper function for rating text
const getRatingText = (rating: number): string => {
  switch (rating) {
    case 1:
      return 'Rất không hài lòng';
    case 2:
      return 'Không hài lòng';
    case 3:
      return 'Bình thường';
    case 4:
      return 'Hài lòng';
    case 5:
      return 'Rất hài lòng';
    default:
      return '';
  }
};

const TicketProcessing: React.FC<TicketProcessingProps> = ({ ticketId }) => {
  const [showAddSubTask, setShowAddSubTask] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [showCancelReasonInput, setShowCancelReasonInput] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Processing');

  // Quick reply states
  const [replyText, setReplyText] = useState('');
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  // Refs for keyboard handling
  const scrollViewRef = useRef<ScrollView>(null);
  const replyInputRef = useRef<View>(null);

  // Global store - ticket đã được fetch từ parent (TicketAdminDetail)
  const { ticket, loading, refreshing } = useTicketData();
  const { subTasks, hasIncompleteSubTasks } = useTicketSubTasks();
  const { messages, messagesLoading } = useTicketMessages();
  const { updateStatus, addSubTask, updateSubTaskStatus, refreshTicket, fetchMessages } =
    useTicketActions();
  const { openTicketStatusSheet, openSubTaskStatusModal } = useTicketUIActions();
  const actionLoading = useTicketStore((state) => state.actionLoading);
  const ui = useTicketStore((state) => state.ui);

  // Load messages when ticket changes
  useEffect(() => {
    if (ticketId) {
      fetchMessages(ticketId);
    }
  }, [ticketId, fetchMessages]);

  // Sync selected status with ticket status
  useEffect(() => {
    if (ticket?.status) {
      setSelectedStatus(normalizeStatus(ticket.status));
    }
  }, [ticket?.status]);

  const ticketStatus = normalizeStatus(ticket?.status || '');
  const isTerminalStatus = ticketStatus === 'Cancelled' || ticketStatus === 'Closed';

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleUpdateStatus = async (newStatus: string) => {
    // Validate: không thể Done nếu còn subtask In Progress
    if (newStatus === 'Done' && subTasks.some((t) => t.status === 'In Progress')) {
      toast.error('Cần xử lý hết subtask trước');
      return;
    }

    // Cần nhập lý do nếu Cancel
    if (newStatus === 'Cancelled' && !cancelReason.trim()) {
      setShowCancelReasonInput(true);
      return;
    }

    await updateStatusAPI(newStatus, newStatus === 'Cancelled' ? cancelReason : '');
  };

  const updateStatusAPI = async (newStatus: string, reason = '') => {
    try {
      // Nếu có lý do cancel, cần gọi cancelTicket API thay vì updateStatus
      if (newStatus === 'Cancelled' && reason) {
        const cancelTicketFn = useTicketStore.getState().cancelTicket;
        const success = await cancelTicketFn(reason);
        if (success) {
          toast.success('Cập nhật thành công!');
          setCancelReason('');
          setShowCancelReasonInput(false);
        } else {
          toast.error('Không thể cập nhật');
        }
      } else {
        const success = await updateStatus(newStatus as TicketStatus);
        if (success) {
          toast.success('Cập nhật thành công!');
        } else {
          if (newStatus === 'Done' && hasIncompleteSubTasks) {
            toast.error('Cần xử lý hết subtask trước');
          } else {
            toast.error('Không thể cập nhật');
          }
        }
      }
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái:', err);
      toast.error('Không thể cập nhật');
    }
  };

  const confirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Vui lòng nhập lý do huỷ');
      return;
    }
    await updateStatusAPI('Cancelled', cancelReason.trim());
  };

  const handleAddSubTask = async () => {
    if (!newSubTaskTitle.trim()) {
      toast.error('Tiêu đề không được để trống');
      return;
    }

    const success = await addSubTask(newSubTaskTitle);
    if (success) {
      setNewSubTaskTitle('');
      setShowAddSubTask(false);
      toast.success('Thêm thành công!');
    } else {
      toast.error('Lỗi thêm subtask');
    }
  };

  const handleUpdateSubTaskStatus = async (subTaskId: string, newStatus: string) => {
    const success = await updateSubTaskStatus(subTaskId, newStatus as SubTaskStatus);
    if (success) {
      toast.success('Cập nhật thành công!');
    } else {
      toast.error('Lỗi cập nhật subtask');
    }
  };

  const handleSubTaskPress = (task: SubTask) => {
    if (isTerminalStatus) return;
    openSubTaskStatusModal(task);
  };

  // Quick reply handlers
  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // Cho phép chọn cả ảnh và video
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
        videoMaxDuration: 60, // Giới hạn video 60 giây
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || `media_${Date.now()}${asset.type === 'video' ? '.mp4' : '.jpg'}`,
          type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        }));
        setSelectedImages((prev) => [...prev, ...newImages].slice(0, 10));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      toast.error('Không thể chọn ảnh');
    }
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() && selectedImages.length === 0) return;

    // Yêu cầu phải có text khi gửi media
    if (selectedImages.length > 0 && !replyText.trim()) {
      toast.error('Vui lòng nhập nội dung tin nhắn kèm theo');
      return;
    }

    setIsSendingReply(true);
    try {
      await sendMessage(ticketId, {
        text: replyText.trim(),
        images: selectedImages.length > 0 ? selectedImages : undefined,
      });

      setReplyText('');
      setSelectedImages([]);
      toast.success('Đã gửi phản hồi');

      // Refresh messages
      await fetchMessages(ticketId);
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Không thể gửi phản hồi');
    } finally {
      setIsSendingReply(false);
    }
  }, [replyText, selectedImages, ticketId, fetchMessages]);

  const canSendMessage =
    ticket?.status === 'Processing' || ticket?.status === 'Waiting for Customer';

  // Handler để scroll đến ô input khi focus
  const handleReplyInputFocus = useCallback(() => {
    setTimeout(() => {
      replyInputRef.current?.measureLayout(
        scrollViewRef.current as any,
        (x, y) => {
          scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
        },
        () => {}
      );
    }, 300);
  }, []);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderFeedback = () => {
    if (ticketStatus !== 'Closed' || !ticket?.feedback) return null;

    return (
      <View className="mt-4 rounded-2xl bg-[#FFFBE8] p-4">
        <Text className="mb-3 text-center text-lg font-semibold text-[#F5AA1E]">Phản hồi</Text>

        {/* Lottie Star with Glow Effect */}
        <View className="mb-3 items-center">
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              padding: 3,
              borderWidth: 2,
              borderColor: '#F5AA1E',
              shadowColor: '#F5AA1E',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 10,
              elevation: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <View
              style={{
                width: 62,
                height: 62,
                borderRadius: 31,
                backgroundColor: '#FFFBE8',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <LottieView
                source={ratingAnimations[(ticket.feedback?.rating || 1) - 1]}
                autoPlay
                loop
                style={{ width: 48, height: 48 }}
              />
            </View>
          </View>
          {/* Badge below */}
          <View className="mt-2 items-center">
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 6,
                borderRightWidth: 6,
                borderBottomWidth: 6,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderBottomColor: '#F5AA1E',
              }}
            />
            <View
              style={{
                backgroundColor: '#F5AA1E',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 4,
              }}>
              <Text className="text-center text-sm font-semibold text-white">
                {getRatingText(ticket.feedback?.rating || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Comment */}
        {ticket.feedback.comment && (
          <View className="mb-3 rounded-xl bg-white p-3">
            <Text className="text-center italic text-gray-700">
              &ldquo;{ticket.feedback.comment}&rdquo;
            </Text>
          </View>
        )}

        {/* Badges */}
        {ticket.feedback.badges && ticket.feedback.badges.length > 0 && (
          <View className="flex-row flex-wrap justify-center">
            {ticket.feedback.badges.map((badge, index) => (
              <View
                key={index}
                style={{
                  margin: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: '#FFF3D6',
                  borderWidth: 1,
                  borderColor: '#F5AA1E',
                }}>
                <Text style={{ color: '#F5AA1E', fontWeight: '600', fontSize: 12 }}>{badge}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderSubTask = (task: SubTask) => {
    const inProgressTasks = subTasks.filter((t) => t.status === 'In Progress');
    const isFirstInProgress = inProgressTasks.length > 0 && inProgressTasks[0]._id === task._id;

    // Style based on status
    let bgColor = '#fff';
    let textColor = '#222';
    let textDecorationLine: 'none' | 'line-through' = 'none';

    if (task.status === 'Completed') {
      bgColor = '#E4EFE6';
      textColor = '#009483';
    } else if (task.status === 'Cancelled') {
      bgColor = '#EBEBEB';
      textColor = '#757575';
      textDecorationLine = 'line-through';
    } else if (task.status === 'In Progress') {
      if (isFirstInProgress) {
        bgColor = '#E6EEF6';
        textColor = '#002855';
      } else {
        bgColor = '#EBEBEB';
        textColor = '#757575';
      }
    }

    const statusLabel =
      task.status === 'In Progress'
        ? isFirstInProgress
          ? 'Đang xử lý'
          : 'Chờ xử lý'
        : task.status === 'Completed'
          ? 'Hoàn thành'
          : 'Đã huỷ';

    return (
      <TouchableOpacity
        key={task._id}
        onPress={() => handleSubTaskPress(task)}
        disabled={isTerminalStatus}
        style={{
          marginBottom: 10,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: bgColor,
          opacity: isTerminalStatus ? 0.5 : 1,
        }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <Text className="text-lg font-semibold" style={{ color: textColor, textDecorationLine }}>
            {task.title}
          </Text>
          <Text className="text-lg font-semibold" style={{ color: textColor }}>
            {statusLabel}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#002855" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-white p-4"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshTicket}
            colors={['#F05023']}
            tintColor="#F05023"
          />
        }>
        {/* STATUS BAR */}
        <View
          className="mb-2 mt-4 h-auto flex-col items-start justify-center gap-4 rounded-2xl bg-[#f8f8f8] p-4"
          style={{ position: 'relative', zIndex: 1 }}>
          <Text className="mr-2 text-lg font-semibold">Trạng thái:</Text>
          <View style={{ width: '100%' }}>
            <TouchableOpacity
              onPress={openTicketStatusSheet}
              disabled={isTerminalStatus}
              style={{
                backgroundColor: '#fff',
                borderRadius: 25,
                height: 50,
                justifyContent: 'center',
                paddingHorizontal: 16,
                opacity: isTerminalStatus ? 0.6 : 1,
              }}>
              <Text style={{ fontSize: 16 }}>{getStatusLabel(selectedStatus)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CANCEL REASON INPUT */}
        {showCancelReasonInput && (
          <View className="rounded-lg p-4">
            <Text className="mb-2 font-medium">Lý do huỷ ticket:</Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Nhập lý do huỷ..."
              className="mb-2 rounded-lg bg-[#f8f8f8] p-3 font-medium"
              multiline
            />
            <View className="flex-row justify-end">
              <TouchableOpacity
                onPress={() => {
                  setCancelReason('');
                  setShowCancelReasonInput(false);
                }}
                className="mr-2 rounded-lg bg-gray-200 px-4 py-2">
                <Text className="font-medium">Huỷ bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmCancel}
                disabled={actionLoading}
                className="rounded-lg bg-red-500 px-4 py-2">
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="font-medium text-white">Xác nhận</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CANCELLATION REASON DISPLAY */}
        {ticketStatus === 'Cancelled' && ticket?.cancellationReason && (
          <View className="mt-4 rounded-lg bg-red-100 p-4">
            <Text className="font-bold text-red-600">Lý do huỷ ticket:</Text>
            <Text className="font-medium text-red-600">{ticket.cancellationReason}</Text>
          </View>
        )}

        {/* FEEDBACK DISPLAY */}
        {renderFeedback()}

        {/* QUICK REPLY INPUT - Only show when ticket is in processing state */}
        {canSendMessage && (
          <View ref={replyInputRef} className="mb-4 mt-4 rounded-2xl bg-[#f8f8f8] p-4">
            <Text className="mb-3 text-lg font-semibold">Phản hồi người dùng</Text>

            {/* Input area */}
            <View className="rounded-xl bg-white p-3">
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Nhập phản hồi cho người dùng..."
                multiline
                numberOfLines={3}
                className="text-base"
                style={{ minHeight: 60, textAlignVertical: 'top' }}
                editable={!isSendingReply}
                onFocus={handleReplyInputFocus}
              />

              {/* Image/Video preview */}
              {selectedImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                  {selectedImages.map((media, index) => {
                    const isVideo = media.type?.startsWith('video/');
                    return (
                      <View key={index} className="relative mr-2">
                        {isVideo ? (
                          // Video preview với icon play
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
                              style={{ width: 60, height: 60 }}
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
                          // Image preview
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
              <View className="mt-2 flex-row items-center justify-between">
                <TouchableOpacity
                  onPress={handlePickImage}
                  disabled={isSendingReply}
                  className="rounded-lg p-2">
                  <Ionicons name="image-outline" size={24} color="#6b7280" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSendReply}
                  disabled={isSendingReply || (!replyText.trim() && selectedImages.length === 0)}
                  style={{
                    backgroundColor:
                      !replyText.trim() && selectedImages.length === 0 ? '#d1d5db' : '#002855',
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                  {isSendingReply ? (
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

        {/* Recent messages - Show for all status from Processing onwards */}
        {(ticket?.status === 'Processing' ||
          ticket?.status === 'Waiting for Customer' ||
          ticket?.status === 'Done' ||
          ticket?.status === 'Completed') && (
          <View className="mb-4 mt-4 rounded-2xl bg-[#f8f8f8] p-4">
            <Text className="mb-2 text-lg font-semibold text-gray-600">Tin nhắn trao đổi</Text>
            {messagesLoading ? (
              <ActivityIndicator size="small" color="#002855" />
            ) : messages.length === 0 ? (
              <Text className="text-center text-sm italic text-gray-400">Chưa có tin nhắn</Text>
            ) : (
              [...messages]
                .slice(-5)
                .reverse()
                .map((message) => (
                  <View key={message._id} className="mb-2 rounded-lg bg-white p-3">
                    {/* Thời gian */}
                    <Text className="mb-1 text-xs text-gray-400">
                      {new Date(message.timestamp).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    {/* Nội dung text */}
                    {message.text && message.type !== 'image' && (
                      <Text className="text-sm text-gray-700">{message.text}</Text>
                    )}
                    {/* Ảnh/Video */}
                    {message.images && message.images.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mt-2">
                        {message.images.map((mediaUrl, idx) => {
                          const fullUrl = getFullImageUrl(mediaUrl);
                          const isVideo = isVideoUrl(mediaUrl);

                          return isVideo ? (
                            // Video thumbnail với icon play
                            <TouchableOpacity
                              key={idx}
                              onPress={() => setPreviewVideo(fullUrl)}
                              style={{ marginRight: 6 }}>
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
                                    <Ionicons
                                      name="play"
                                      size={20}
                                      color="#333"
                                      style={{ marginLeft: 2 }}
                                    />
                                  </View>
                                </View>
                              </View>
                            </TouchableOpacity>
                          ) : (
                            // Image
                            <TouchableOpacity key={idx} onPress={() => setPreviewImage(fullUrl)}>
                              <Image
                                source={{ uri: fullUrl }}
                                style={{ width: 80, height: 80, borderRadius: 8, marginRight: 6 }}
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                ))
            )}
          </View>
        )}

        {/* SUBTASKS OR COMPLETION BANNER */}
        {!isTerminalStatus &&
          (ticketStatus === 'Done' ? (
            <View className="mb-2 mt-2 rounded-2xl bg-[#f3f4f6] p-4">
              <Text className="text-center text-gray-600" style={{ fontSize: 16, lineHeight: 24 }}>
                Vui lòng thông báo tới người dùng kiểm tra kết quả và chất lượng phục vụ
              </Text>
            </View>
          ) : (
            <View className="mb-2 mt-6 rounded-2xl bg-[#f8f8f8] p-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-lg font-semibold">Danh sách công việc</Text>
                <TouchableOpacity
                  onPress={() => setShowAddSubTask(true)}
                  className="rounded-lg px-4">
                  <Text className="text-3xl font-medium text-primary">+</Text>
                </TouchableOpacity>
              </View>

              {/* Add subtask input */}
              {showAddSubTask && (
                <View className="mb-3 flex-row items-center">
                  <TextInput
                    value={newSubTaskTitle}
                    onChangeText={setNewSubTaskTitle}
                    placeholder="Nhập việc cần làm"
                    className="mr-2 flex-1 rounded-lg bg-[#ebebeb] p-3"
                  />
                  <TouchableOpacity
                    onPress={handleAddSubTask}
                    disabled={actionLoading}
                    className="mr-2 rounded-lg bg-[#009483] px-3 py-2">
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="font-medium text-white">Thêm</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddSubTask(false);
                      setNewSubTaskTitle('');
                    }}
                    className="rounded-lg bg-gray-400 px-3 py-2">
                    <Text className="font-medium text-white">Huỷ</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Subtask list */}
              {subTasks.length > 0 ? (
                subTasks.map(renderSubTask)
              ) : (
                <Text className="text-center text-sm font-medium text-gray-500">
                  Không có subtask
                </Text>
              )}
            </View>
          ))}

        {/* Action Sheets */}
        <TicketStatusSheet
          currentStatus={ticketStatus}
          onSelect={(value) => {
            handleUpdateStatus(value);
            setSelectedStatus(value);
          }}
        />

        <SubTaskStatusSheet
          subTask={ui.selectedSubTask}
          allSubTasks={subTasks}
          onSelect={(value) => {
            if (ui.selectedSubTask) {
              handleUpdateSubTaskStatus(ui.selectedSubTask._id, value);
            }
          }}
        />

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
                style={{ width: '100%', height: '70%' }}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay
              />
            )}
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default TicketProcessing;
