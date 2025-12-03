import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Image,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
} from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { Video, ResizeMode } from 'expo-av';

// Store & Hooks
import {
  useTicketData,
  useTicketActions,
  useTicketSubTasks,
  useTicketMessages,
} from '../../../hooks/useTicketStore';
import {
  acceptFeedback,
  updateTicket,
  getTeamMemberFeedbackStats,
} from '../../../services/ticketService';

// Utils & Constants
import { toast } from '../../../utils/toast';
import { getAvatar } from '../../../utils/avatar';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import { getStatusLabel } from '../../../config/ticketConstants';
import { getFullImageUrl } from '../../../utils/imageUtils';

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

// Lottie animations for rating
const ratingAnimations = [
  require('../../../assets/emoji/1star.json'),
  require('../../../assets/emoji/2star.json'),
  require('../../../assets/emoji/3star.json'),
  require('../../../assets/emoji/4star.json'),
  require('../../../assets/emoji/5star.json'),
];

// Rating descriptions
const getRatingText = (rating: number) => {
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

interface TicketProcessingGuestProps {
  ticketId: string;
}

// Status text color mapping
const getStatusTextColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'assigned':
      return '#002855';
    case 'processing':
    case 'in progress':
      return '#F59E0B';
    case 'waiting for customer':
      return '#F97316';
    case 'done':
    case 'completed':
      return '#4CAF50';
    case 'closed':
      return '#9E9E9E';
    case 'cancelled':
      return '#F05023';
    default:
      return '#222222';
  }
};

const FEEDBACK_BADGES = ['Nhiệt Huyết', 'Chu Đáo', 'Vui Vẻ', 'Tận Tình', 'Chuyên Nghiệp'];

const TicketProcessingGuest: React.FC<TicketProcessingGuestProps> = ({ ticketId }) => {
  // UI state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [technicianStats, setTechnicianStats] = useState<{
    averageRating: number;
    totalFeedbacks: number;
  } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  // Global store - ticket đã được fetch từ parent (TicketGuestDetail)
  const { ticket, loading, refreshing } = useTicketData();
  const { subTasks } = useTicketSubTasks();
  const { messages, messagesLoading } = useTicketMessages();
  const { refreshTicket, fetchMessages } = useTicketActions();

  // Load messages when ticket changes
  useEffect(() => {
    if (ticketId) {
      fetchMessages(ticketId);
    }
  }, [ticketId, fetchMessages]);

  // Fetch technician stats when assignedTo changes
  useEffect(() => {
    const fetchTechnicianStats = async () => {
      if (ticket?.assignedTo?.email) {
        try {
          const stats = await getTeamMemberFeedbackStats(ticket.assignedTo.email);
          if (stats) {
            // API returns: data.feedback.averageRating and data.summary.feedbackCount
            setTechnicianStats({
              averageRating: stats.feedback?.averageRating || 0,
              totalFeedbacks: stats.summary?.feedbackCount || 0,
            });
          }
        } catch (error) {
          console.error('Error fetching technician stats:', error);
        }
      }
    };
    fetchTechnicianStats();
  }, [ticket?.assignedTo?.email]);

  // Handlers
  const handleSubmitFeedback = async () => {
    if (rating === 0) {
      toast.error('Vui lòng chọn số sao');
      return;
    }

    try {
      setSubmitting(true);
      console.log('[handleSubmitFeedback] Submitting feedback:', {
        ticketId,
        rating,
        review,
        selectedBadges,
      });

      await acceptFeedback(ticketId, {
        rating,
        comment: review,
        badges: selectedBadges,
      });
      console.log('[handleSubmitFeedback] Feedback submitted successfully');

      await updateTicket(ticketId, {
        status: 'Closed',
      });
      console.log('[handleSubmitFeedback] Ticket status updated to Closed');

      toast.success('Đánh giá đã được gửi thành công');
      await refreshTicket();
    } catch (error: any) {
      console.error('[handleSubmitFeedback] Error:', error?.message || error);
      toast.error(error?.message || 'Không thể gửi đánh giá');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopenTicket = async () => {
    try {
      setSubmitting(true);

      await updateTicket(ticketId, {
        status: 'Processing',
        notifyAction: 'reopen_ticket',
      });

      toast.success('Ticket đã được mở lại');
      await refreshTicket();
    } catch (error) {
      console.error('Lỗi khi mở lại ticket', error);
      toast.error('Không thể mở lại ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBadge = (badge: string) => {
    if (selectedBadges.includes(badge)) {
      setSelectedBadges(selectedBadges.filter((b) => b !== badge));
    } else {
      setSelectedBadges([...selectedBadges, badge]);
    }
  };

  // Loading state
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#F05023" />
      </View>
    );
  }

  // No ticket
  if (!ticket) {
    return (
      <ScrollView className="flex-1 p-4">
        <Text className="text-center text-gray-500">Không thể tải thông tin ticket</Text>
      </ScrollView>
    );
  }

  const rawStatus = ticket.status?.toLowerCase().replace(/_/g, ' ') || '';
  // "waiting for customer" được xem như "processing" để UI đồng nhất cho guest
  const status = rawStatus === 'waiting for customer' ? 'processing' : rawStatus;
  const statusTextColor = getStatusTextColor(ticket.status);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderTechnician = () => {
    if (!ticket.assignedTo) {
      return <Text className="text-gray-500">Chưa có kỹ thuật viên được phân công</Text>;
    }

    const displayRating = technicianStats?.averageRating ?? 0;
    const totalReviews = technicianStats?.totalFeedbacks ?? 0;

    return (
      <View className="flex-row">
        <View className="mr-5 h-20 w-20 overflow-hidden rounded-full bg-gray-200">
          <Image
            source={{ uri: getAvatar(ticket.assignedTo) }}
            className="h-full w-full"
            resizeMode="cover"
          />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold">
            {normalizeVietnameseName(ticket.assignedTo.fullname)}
          </Text>
          <Text className="text-sm text-gray-500">
            {ticket.assignedTo.jobTitle === 'technical'
              ? 'Kỹ thuật viên'
              : ticket.assignedTo.jobTitle || ''}
          </Text>
          <View className="mt-1 flex-row items-center">
            <FontAwesome name="star" size={16} color="#FFD700" />
            <Text style={{ fontSize: 16, color: '#374151', marginLeft: 4, fontWeight: '600' }}>
              {displayRating.toFixed(1)}
            </Text>
            {totalReviews > 0 && (
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 6 }}>
                ({totalReviews} đánh giá)
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderSubTaskItem = (task: any, index: number) => {
    const isCompleted = task.status === 'Completed';
    const isCancelled = task.status === 'Cancelled';

    let bgColor = '#fff';
    let textColor = '#222';
    let textDecorationLine: 'none' | 'line-through' = 'none';

    if (isCompleted) {
      bgColor = '#E4EFE6';
      textColor = '#009483';
    } else if (isCancelled) {
      bgColor = '#EBEBEB';
      textColor = '#757575';
      textDecorationLine = 'line-through';
    } else {
      const isFirstInProgress =
        subTasks.filter((t) => t.status === 'In Progress')[0]?._id === task._id;

      if (isFirstInProgress) {
        bgColor = '#E6EEF6';
        textColor = '#002855';
      } else {
        bgColor = '#EBEBEB';
        textColor = '#757575';
      }
    }

    const statusText = isCompleted ? 'Hoàn thành' : isCancelled ? 'Huỷ' : 'Đang làm';

    return (
      <View
        key={task._id}
        className="mb-2 flex-row items-center justify-between rounded-lg p-3"
        style={{ backgroundColor: bgColor }}>
        <Text style={{ color: textColor, fontWeight: '500', textDecorationLine }}>
          {index + 1}. {task.title}
        </Text>
        <Text style={{ color: textColor, fontWeight: '500' }}>{statusText}</Text>
      </View>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          className="flex-1 p-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshTicket}
              colors={['#F05023']}
              tintColor="#F05023"
            />
          }>
          {/* Status Header */}
          <View className="my-4 rounded-2xl bg-gray-50 p-4">
            <Text className="mb-2 text-lg font-semibold text-gray-700">Trạng thái</Text>
            <View className="rounded-full bg-white px-4 py-2">
              <Text
                style={{
                  fontFamily: 'Mulish-Bold',
                  fontSize: 16,
                  color: rawStatus === 'waiting for customer' ? '#F59E0B' : statusTextColor,
                }}>
                {/* "waiting for customer" hiển thị như "Đang xử lý" cho guest */}
                {rawStatus === 'waiting for customer'
                  ? 'Đang xử lý'
                  : getStatusLabel(ticket.status)}
              </Text>
            </View>
          </View>

          {/* Assigned Status */}
          {status === 'assigned' && (
            <>
              <View className="rounded-xl bg-gray-50 p-4">
                <Text className="mb-3 text-base font-bold text-gray-700">Kỹ thuật viên</Text>
                {renderTechnician()}
              </View>
              <View className="mt-4 rounded-xl bg-gray-50 p-4">
                <Text className="mb-2 text-lg font-bold text-gray-700">Công việc cần làm</Text>
                <Text className="text-gray-400">Các bước thực hiện sẽ được hiển thị tại đây</Text>
              </View>
            </>
          )}

          {/* Processing Status */}
          {status === 'processing' && (
            <View className="rounded-xl">
              <View className="mb-4 rounded-xl bg-[#f8f8f8] p-4">
                <Text className="mb-3 text-base font-bold text-gray-700">Kỹ thuật viên</Text>
                {renderTechnician()}
              </View>

              {/* Messages from technician */}
              <View className="mb-4 rounded-xl bg-[#f8f8f8] p-4">
                <Text className="mb-3 text-base font-bold text-gray-700">
                  Phản hồi từ kỹ thuật viên
                </Text>
                {messagesLoading ? (
                  <ActivityIndicator size="small" color="#002855" />
                ) : messages.length === 0 ? (
                  <Text className="text-center text-sm italic text-gray-400">
                    Chưa có phản hồi nào
                  </Text>
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
                                <TouchableOpacity
                                  key={idx}
                                  onPress={() => setPreviewImage(fullUrl)}>
                                  <Image
                                    source={{ uri: fullUrl }}
                                    style={{
                                      width: 80,
                                      height: 80,
                                      borderRadius: 8,
                                      marginRight: 6,
                                    }}
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

              {subTasks && subTasks.length > 0 ? (
                <View className="mb-4 rounded-xl bg-[#f8f8f8] p-4">
                  <Text className="mb-3 text-base font-bold text-gray-700">
                    Ticket đang được xử lý. Vui lòng chờ kĩ thuật viên hoàn thành các hạng mục sau
                  </Text>
                  {subTasks.map((task, index) => renderSubTaskItem(task, index))}
                </View>
              ) : (
                <Text className="text-base text-gray-700">
                  Ticket đang được xử lý, vui lòng chờ.
                </Text>
              )}
            </View>
          )}

          {/* Done Status - Feedback Form */}
          {status === 'done' && (
            <View className="rounded-2xl">
              <View className="mb-4 rounded-xl bg-[#f8f8f8] p-4">
                <Text className="mb-3 text-base font-bold text-gray-700">Phản hồi</Text>
                <Text className="mb-3 text-base font-bold text-gray-700">
                  Yêu cầu đã được xử lý xong. Vui lòng nhận kết quả và kiểm tra chất lượng phục vụ
                </Text>

                {/* Accept option */}
                <TouchableOpacity
                  onPress={() => setSelectedOption('accept')}
                  className="flex-row items-center rounded-lg p-3">
                  <View
                    className={`mr-2 h-6 w-6 items-center justify-center rounded-full border-2 ${
                      selectedOption === 'accept' ? 'border-[#002855]' : 'border-gray-400'
                    }`}>
                    {selectedOption === 'accept' && (
                      <View className="h-3 w-3 rounded-full bg-[#002855]" />
                    )}
                  </View>
                  <Text
                    className={`text-base font-medium ${
                      selectedOption === 'accept' ? 'text-primary' : 'text-gray-700'
                    }`}>
                    Chấp nhận kết quả
                  </Text>
                </TouchableOpacity>

                {/* Reject option */}
                <TouchableOpacity
                  onPress={() => setSelectedOption('reject')}
                  className="flex-row items-center rounded-lg p-3">
                  <View
                    className={`mr-2 h-6 w-6 items-center justify-center rounded-full border-2 ${
                      selectedOption === 'reject' ? 'border-[#002855]' : 'border-gray-400'
                    }`}>
                    {selectedOption === 'reject' && (
                      <View className="h-3 w-3 rounded-full bg-[#002855]" />
                    )}
                  </View>
                  <Text
                    className={`text-base font-medium ${
                      selectedOption === 'reject' ? 'text-primary' : 'text-gray-700'
                    }`}>
                    Chưa đạt yêu cầu, cần xử lý lại
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Accept - Show feedback form */}
              {selectedOption === 'accept' && (
                <View>
                  <View className="mt-4 rounded-2xl bg-[#f8f8f8] p-4">
                    <Text className="mb-4 text-center text-base font-bold text-[#002855]">
                      Cảm nhận của bạn về dịch vụ hỗ trợ
                    </Text>

                    {/* Lottie Rating Emojis with Glow Effect */}
                    <View className="mb-4 flex-row items-start justify-center">
                      {[1, 2, 3, 4, 5].map((i) => {
                        const isSelected = rating === i;
                        const isAnySelected = rating > 0;
                        return (
                          <View key={i} className="items-center" style={{ marginHorizontal: 6 }}>
                            <TouchableOpacity
                              onPress={() => setRating(i)}
                              style={{
                                transform: [{ scale: isSelected ? 1.1 : 1 }],
                              }}>
                              {/* Outer glow ring - only show when selected */}
                              <View
                                style={{
                                  width: isSelected ? 54 : 48,
                                  height: isSelected ? 54 : 48,
                                  borderRadius: 27,
                                  padding: isSelected ? 2 : 0,
                                  backgroundColor: isSelected ? 'transparent' : 'transparent',
                                  ...(isSelected && {
                                    borderWidth: 2,
                                    borderColor: '#F5AA1E',
                                    shadowColor: '#F5AA1E',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.6,
                                    shadowRadius: 8,
                                    elevation: 8,
                                  }),
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                {/* Inner circle background */}
                                <View
                                  style={{
                                    width: isSelected ? 46 : 44,
                                    height: isSelected ? 46 : 44,
                                    borderRadius: 23,
                                    backgroundColor: isSelected ? '#FFFBE8' : '#E5E7EB',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: isAnySelected && !isSelected ? 0.5 : 1,
                                  }}>
                                  <LottieView
                                    source={ratingAnimations[i - 1]}
                                    autoPlay
                                    loop
                                    style={{ width: 36, height: 36 }}
                                  />
                                </View>
                              </View>
                            </TouchableOpacity>

                            {/* Badge text below selected icon */}
                            {isSelected && (
                              <View className="mt-2 items-center">
                                {/* Arrow pointing up */}
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
                                {/* Badge */}
                                <View
                                  style={{
                                    backgroundColor: '#F5AA1E',
                                    borderRadius: 12,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                  }}>
                                  <Text className="text-center text-xs font-semibold text-white">
                                    {getRatingText(i)}
                                  </Text>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    {/* Feedback Badges */}
                    <Text className="mb-2 text-center text-sm font-semibold text-[#002855]">
                      Bạn thấy nhân viên hỗ trợ như thế nào?
                    </Text>
                    <View className="mb-3 flex-row flex-wrap justify-center">
                      {FEEDBACK_BADGES.map((badge) => {
                        const isSelected = selectedBadges.includes(badge);
                        return (
                          <TouchableOpacity
                            key={badge}
                            onPress={() => toggleBadge(badge)}
                            style={{
                              margin: 4,
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 20,
                              backgroundColor: isSelected ? '#FFF3D6' : '#F3F4F6',
                              borderWidth: isSelected ? 1.5 : 1,
                              borderColor: isSelected ? '#F5AA1E' : '#E5E7EB',
                              ...(isSelected && {
                                shadowColor: '#F5AA1E',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: 4,
                                elevation: 3,
                              }),
                            }}>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: isSelected ? '600' : '500',
                                color: isSelected ? '#F5AA1E' : '#6B7280',
                              }}>
                              {badge}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Comment */}
                    <View className="mb-3">
                      <TextInput
                        placeholder="Nhận xét của bạn (không bắt buộc)"
                        value={review}
                        onChangeText={setReview}
                        multiline
                        blurOnSubmit={true}
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        className="w-full rounded-lg border border-gray-300 bg-white p-3"
                        style={{ minHeight: 80, textAlignVertical: 'top' }}
                      />
                      {/* Nút đóng bàn phím */}
                      <TouchableOpacity
                        onPress={() => Keyboard.dismiss()}
                        className="mt-2 self-end rounded-lg bg-gray-200 px-3 py-1">
                        <Text className="text-sm font-medium text-gray-600">Xong</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Submit button */}
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      handleSubmitFeedback();
                    }}
                    disabled={submitting}
                    className="mt-5 items-center rounded-full bg-[#FF5733] py-3">
                    <Text className="font-bold text-white">
                      {submitting ? 'Đang xử lý...' : 'Xác nhận'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Reject - Show reopen button */}
              {selectedOption === 'reject' && (
                <View className="mt-4">
                  <TouchableOpacity
                    className="items-center rounded-full bg-[#FF5733] py-3"
                    onPress={handleReopenTicket}
                    disabled={submitting}>
                    <Text className="font-bold text-white">
                      {submitting ? 'Đang xử lý...' : 'Mở lại ticket'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Cancelled Status */}
          {status === 'cancelled' && ticket.cancellationReason && (
            <View className="rounded-xl bg-red-50 p-4">
              <Text className="mb-2 text-base font-bold text-red-700">Lý do huỷ ticket:</Text>
              <Text className="text-red-600">{ticket.cancellationReason}</Text>
            </View>
          )}

          {/* Closed Status - Show existing feedback */}
          {status === 'closed' && ticket.feedback && (
            <View className="rounded-xl bg-gray-50 p-4">
              <Text className="mb-4 text-center text-base font-bold text-[#002855]">
                Phản hồi của bạn
              </Text>

              {/* Lottie Rating Display with Glow */}
              <View className="mb-3 items-center justify-center">
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

              {ticket.feedback.comment && (
                <View className="mb-3 rounded-xl bg-white p-3">
                  <Text className="text-center italic text-gray-700">
                    &ldquo;{ticket.feedback.comment}&rdquo;
                  </Text>
                </View>
              )}

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
                      <Text style={{ color: '#F5AA1E', fontWeight: '600', fontSize: 12 }}>
                        {badge}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>

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
    </KeyboardAvoidingView>
  );
};

export default TicketProcessingGuest;
