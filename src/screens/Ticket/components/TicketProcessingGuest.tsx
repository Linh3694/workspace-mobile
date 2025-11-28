import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { getTicketDetail, acceptFeedback, updateTicket, type Ticket, type SubTask, type Feedback } from '../../../services/ticketService';
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { getAvatar } from '../../../utils/avatar';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';

interface TicketProcessingGuestProps {
  ticketId: string;
}


const getStatusLabel = (status: string) => {
  switch (status) {
    case 'Assigned':
    case 'assigned':
      return 'Đã nhận';
    case 'Processing':
    case 'processing':
    case 'In Progress':
      return 'Đang xử lý';
    case 'Waiting for Customer':
    case 'waiting for customer':
      return 'Chờ phản hồi';
    case 'Done':
    case 'done':
    case 'Completed':
    case 'completed':
      return 'Hoàn thành';
    case 'Closed':
    case 'closed':
      return 'Đã đóng';
    case 'Cancelled':
    case 'cancelled':
      return 'Đã huỷ';
    default:
      return status;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Assigned':
    case 'assigned':
      return 'bg-[#002855]';
    case 'Processing':
    case 'processing':
    case 'In Progress':
      return 'bg-[#F59E0B]';
    case 'Waiting for Customer':
    case 'waiting for customer':
      return 'bg-orange-500';
    case 'Done':
    case 'done':
    case 'Completed':
    case 'completed':
      return 'bg-[#BED232]';
    case 'Closed':
    case 'closed':
      return 'bg-[#009483]';
    case 'Cancelled':
    case 'cancelled':
      return 'bg-[#F05023]';
    default:
      return 'bg-gray-500';
  }
};

// Mapping ticket status to text colors for non-editable pill
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

const TicketProcessingGuest: React.FC<TicketProcessingGuestProps> = ({ ticketId }) => {
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTicketDetails();
  }, [ticketId]);

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      const data = await getTicketDetail(ticketId);
      if (data) {
        setTicket(data);
        setSubTasks(data.subTasks || []);
      }
    } catch (err) {
      console.error('Lỗi khi lấy ticket:', err);
    } finally {
      setLoading(false);
    }
  };

  // Thêm hàm xác nhận đánh giá
  const handleSubmitFeedback = async () => {
    if (rating === 0) {
      Toast.show({
        type: 'error',
        text1: 'Vui lòng chọn số sao',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Gửi feedback
      await acceptFeedback(ticketId, {
        rating,
        comment: review,
        badges: selectedBadges,
      });

      // Cập nhật trạng thái ticket thành "Closed"
      await updateTicket(ticketId, {
        status: 'Closed',
        notifyAction: 'feedback_added',
      });

      Toast.show({
        type: 'success',
        text1: 'Đánh giá đã được gửi thành công',
      });

      fetchTicketDetails(); // Refresh ticket
    } catch (error) {
      console.error('Lỗi khi gửi đánh giá', error);
      Toast.show({
        type: 'error',
        text1: 'Không thể gửi đánh giá',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Thêm hàm mở lại ticket
  const handleReopenTicket = async () => {
    try {
      setSubmitting(true);

      await updateTicket(ticketId, {
        status: 'Processing',
        notifyAction: 'reopen_ticket',
      });

      Toast.show({
        type: 'success',
        text1: 'Ticket đã được mở lại',
      });
      fetchTicketDetails(); // Làm mới dữ liệu ticket
    } catch (error) {
      console.error('Lỗi khi mở lại ticket', error);
      Toast.show({
        type: 'error',
        text1: 'Không thể mở lại ticket',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#F05023" />
      </View>
    );
  }

  // Hiển thị khi không có ticket
  if (!ticket) {
    return (
      <ScrollView className="flex-1 p-4">
        <Text className="text-center text-gray-500">Không thể tải thông tin ticket</Text>
      </ScrollView>
    );
  }

  // Determine text color for status pill
  const statusTextColor = getStatusTextColor(ticket?.status || '');

  // Hiển thị UI dựa vào trạng thái ticket
  return (
    <ScrollView className="flex-1 p-4">
      {/* Header - Trạng thái */}
      <View className="my-4 rounded-2xl bg-gray-50 p-4">
        <Text className="mb-2 font-semibold text-lg text-gray-700">Trạng thái</Text>
        <View className="rounded-full bg-white px-4 py-2">
          <Text
            style={{
              fontFamily: 'Mulish-Bold',
              fontSize: 16,
              color: statusTextColor,
            }}>
            {getStatusLabel(ticket.status)}
          </Text>
        </View>
      </View>

      {/* Nội dung dựa vào trạng thái */}
      {ticket.status.toLowerCase() === 'assigned' && (
        <View className="rounded-xl bg-gray-50 p-4">
          <Text className="mb-3 font-bold text-base text-gray-700">Kỹ thuật viên</Text>
          {ticket.assignedTo ? (
            <View className="flex-row">
              <View className="mr-5 h-20 w-20 overflow-hidden rounded-full bg-gray-200">
                <Image
                  source={{ uri: getAvatar(ticket.assignedTo) }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-base">{normalizeVietnameseName(ticket.assignedTo.fullname)}</Text>
                <Text className="text-sm text-gray-500">
                  {ticket.assignedTo.jobTitle === 'technical'
                    ? 'Kỹ thuật viên'
                    : ticket.assignedTo.jobTitle || ''}
                </Text>

                {/* Numeric rating */}
                <View className="mt-1 flex-row items-center">
                  <Text style={{ fontSize: 16, color: '#374151', marginRight: 4 }}>
                    {ticket.assignedTo.rating?.toFixed(1) || '0.0'}
                  </Text>
                  <AntDesign name="star" size={16} color="#FFD700" />
                </View>
              </View>
            </View>
          ) : (
            <Text className="text-gray-500">Chưa có kỹ thuật viên được phân công</Text>
          )}
        </View>
      )}

      {ticket.status.toLowerCase() === 'assigned' && (
        /* Công việc cần làm */
        <View className="mt-4 rounded-xl bg-gray-50 p-4">
          <Text className="mb-2 font-bold text-lg text-gray-700">Công việc cần làm</Text>
          <Text className="text-gray-400">Các bước thực hiện sẽ được hiển thị tại đây</Text>
        </View>
      )}

      {ticket.status.toLowerCase() === 'processing' && (
        <View className=" rounded-xl">
          {/* Kỹ thuật viên */}
          <View className="mb-4 rounded-xl bg-[#f8f8f8] p-4">
            <Text className="mb-3 font-bold text-base text-gray-700">Kỹ thuật viên</Text>
            {ticket.assignedTo ? (
              <View className="flex-row">
                <View className="mr-5 h-20 w-20 overflow-hidden rounded-full bg-gray-200">
                  <Image
                    source={{ uri: getAvatar(ticket.assignedTo) }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-base">{normalizeVietnameseName(ticket.assignedTo.fullname)}</Text>
                  <Text className="text-sm text-gray-500">
                    {ticket.assignedTo.jobTitle === 'technical'
                      ? 'Kỹ thuật viên'
                      : ticket.assignedTo.jobTitle || ''}
                  </Text>
                  <View className="mt-1 flex-row items-center">
                    <Text style={{ fontSize: 16, color: '#374151', marginRight: 4 }}>
                      {ticket.assignedTo.rating?.toFixed(1) || '0.0'}
                    </Text>
                    <FontAwesome name="star" size={16} color="#FFD700" />
                  </View>
                </View>
              </View>
            ) : (
              <Text className="text-gray-500">Chưa có kỹ thuật viên được phân công</Text>
            )}
          </View>
          {/* Header với nút + */}
          {subTasks && subTasks.length > 0 ? (
            <View className="mb-4 rounded-xl bg-[#f8f8f8] p-4">
              <Text className="mb-3 font-bold text-base text-gray-700">
                Ticket đang được xử lý. Vui lòng chờ kĩ thuật viên hoàn thành các hạng mục sau
              </Text>
              {subTasks.map((task, index) => {
                const isCompleted = task.status === 'Completed';
                const isCancelled = task.status === 'Cancelled';

                // Cập nhật màu sắc theo TicketProcessing
                let bgColor = '#fff';
                let textColor = '#222';
                let textDecorationLine = 'none';

                if (isCompleted) {
                  bgColor = '#E4EFE6';
                  textColor = '#009483';
                } else if (isCancelled) {
                  bgColor = '#EBEBEB';
                  textColor = '#757575';
                  textDecorationLine = 'line-through';
                } else {
                  // Kiểm tra nếu là task đầu tiên In Progress
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

                return (
                  <View
                    key={task._id}
                    className="mb-2 flex-row items-center justify-between rounded-lg p-3"
                    style={{ backgroundColor: bgColor }}>
                    <Text
                      style={{
                        color: textColor,
                        fontWeight: '500',
                        textDecorationLine: textDecorationLine as any,
                      }}>
                      {index + 1}. {task.title}
                    </Text>
                    <Text style={{ color: textColor, fontWeight: '500' }}>
                      {isCompleted ? 'Hoàn thành' : isCancelled ? 'Huỷ' : 'Đang làm'}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text className="text-base text-gray-700">Ticket đang được xử lý, vui lòng chờ.</Text>
          )}
        </View>
      )}

      {ticket.status.toLowerCase() === 'done' && (
        <View className="rounded-2xl">
          <View className="mb-4 rounded-xl bg-[#f8f8f8] p-4">
            <Text className="mb-3 font-bold text-base text-gray-700">Phản hồi</Text>
            <Text className="mb-3 font-bold text-base text-gray-700">
              Yêu cầu đã được xử lý xong. Vui lòng nhận kết quả và kiểm tra chất lượng phục vụ
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedOption('accept')}
              className={`flex-row items-center rounded-lg p-3 ${selectedOption === 'accept' ? '' : ''}`}>
              <View
                className={`mr-2 h-6 w-6 items-center justify-center rounded-full border-2 ${selectedOption === 'accept' ? 'border-[#002855]' : 'border-gray-400'}`}>
                {selectedOption === 'accept' && (
                  <View className="h-3 w-3 rounded-full bg-[#002855]" />
                )}
              </View>
              <Text
                className={`font-medium text-base ${selectedOption === 'accept' ? 'text-primary' : 'text-gray-700'}`}>
                Chấp nhận kết quả
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedOption('reject')}
              className={`flex-row items-center rounded-lg p-3  ${selectedOption === 'reject' ? '' : ''}`}>
              <View
                className={`mr-2 h-6 w-6 items-center justify-center rounded-full border-2 ${selectedOption === 'reject' ? 'border-[#002855]' : 'border-gray-400'}`}>
                {selectedOption === 'reject' && (
                  <View className="h-3 w-3 rounded-full bg-[#002855]" />
                )}
              </View>
              <Text
                className={`font-medium text-base ${selectedOption === 'reject' ? 'text-primary' : 'text-gray-700'}`}>
                Chưa đạt yêu cầu, cần xử lý lại
              </Text>
            </TouchableOpacity>
          </View>

          {selectedOption === 'accept' && (
            <View>
              <View className="mt-4 rounded-2xl bg-[#f8f8f8] p-4">
                {/* Đánh giá */}
                <Text className="mb-3 font-semibold text-base text-gray-700">Đánh giá</Text>

                {/* Stars */}
                <View className="mb-3 flex-row justify-center">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <TouchableOpacity key={i} onPress={() => setRating(i)}>
                      <AntDesign
                        name={i <= rating ? 'star' : 'staro'}
                        size={30}
                        color="#FFD700"
                        style={{ marginHorizontal: 5 }}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Badges */}
                <View className="mb-3 flex-row flex-wrap justify-center">
                  {['Nhiệt Huyết', 'Chu Đáo', 'Vui Vẻ', 'Tận Tình', 'Chuyên Nghiệp'].map(
                    (badge) => {
                      const isSelected = selectedBadges.includes(badge);
                      return (
                        <TouchableOpacity
                          key={badge}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedBadges(selectedBadges.filter((b) => b !== badge));
                            } else {
                              setSelectedBadges([...selectedBadges, badge]);
                            }
                          }}
                          className={`m-1 rounded-full px-4 py-1 ${
                            isSelected ? 'bg-[#FFEBCC]' : 'bg-gray-200'
                          }`}>
                          <Text
                            className={`text-sm ${
                              isSelected ? 'text-[#FFAA00]' : 'text-gray-600'
                            }`}>
                            {badge}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>

                {/* Comment */}
                <TextInput
                  placeholder="Nhận xét của bạn (không bắt buộc)"
                  value={review}
                  onChangeText={setReview}
                  multiline
                  className="mb-3 w-full rounded-lg border border-gray-300 bg-gray-100 p-3"
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                />

                {/* Confirm button */}
              </View>
              <TouchableOpacity
                onPress={handleSubmitFeedback}
                disabled={submitting}
                className="mt-5 items-center rounded-full bg-[#FF5733] py-3">
                <Text className="font-bold text-white">
                  {submitting ? 'Đang xử lý...' : 'Xác nhận'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

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

      {ticket.status.toLowerCase() === 'cancelled' && ticket.cancellationReason && (
        <View className="rounded-xl bg-red-50 p-4">
          <Text className="mb-2 font-bold text-base text-red-700">Lý do huỷ ticket:</Text>
          <Text className="text-red-600">{ticket.cancellationReason}</Text>
        </View>
      )}

      {ticket.status.toLowerCase() === 'closed' && ticket.feedback && (
        <View className="rounded-xl bg-gray-50 p-4">
          <Text className="mb-3 font-bold text-base text-gray-700">Phản hồi của bạn:</Text>

          {/* Rating hiển thị */}
          <View className="mb-3 flex-row justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <AntDesign
                key={star}
                name={star <= (ticket.feedback?.rating || 0) ? 'star' : 'staro'}
                size={30}
                color="#FFD700"
                style={{ marginHorizontal: 3 }}
              />
            ))}
          </View>

          {ticket.feedback?.comment && (
            <View className="mb-3 rounded-lg bg-gray-100 p-3">
              <Text className="italic text-gray-700">&ldquo;{ticket.feedback.comment}&rdquo;</Text>
            </View>
          )}

          {ticket.feedback?.badges && ticket.feedback.badges.length > 0 && (
            <View className="flex-row flex-wrap justify-center">
              {ticket.feedback.badges.map((badge, index) => (
                <View key={index} className="m-1 rounded-full bg-[#FFEBCC] px-3 py-1">
                  <Text style={{ color: '#FFAA00', fontFamily: 'Mulish-Bold', fontSize: 12 }}>
                    {badge}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

export default TicketProcessingGuest;
