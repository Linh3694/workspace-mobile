import React from 'react';
import { View, Text, ScrollView, RefreshControl, Image } from 'react-native';
import { useFeedbackStore, useFeedbackData } from '../../../hooks/useFeedbackStore';
import { BASE_URL } from '../../../config/constants';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
interface FeedbackInformationProps {
  feedbackId: string;
}

// Priority badge
const getPriorityStyle = (priority?: string) => {
  switch (priority) {
    case 'Khẩn cấp':
      return { bg: 'bg-red-100', text: 'text-red-600' };
    case 'Cao':
      return { bg: 'bg-orange-100', text: 'text-orange-600' };
    case 'Trung bình':
      return { bg: 'bg-yellow-100', text: 'text-yellow-600' };
    case 'Thấp':
      return { bg: 'bg-green-100', text: 'text-green-600' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600' };
  }
};

// SLA status badge
const getSLAStyle = (slaStatus?: string) => {
  switch (slaStatus) {
    case 'Overdue':
      return { bg: 'bg-red-100', text: 'text-red-600', label: 'Quá hạn' };
    case 'Warning':
      return { bg: 'bg-yellow-100', text: 'text-yellow-600', label: 'Sắp hết hạn' };
    case 'On time':
      return { bg: 'bg-green-100', text: 'text-green-600', label: 'Đúng hạn' };
    default:
      return null;
  }
};

const FeedbackInformation: React.FC<FeedbackInformationProps> = ({ feedbackId }) => {
  const { feedback, refreshing } = useFeedbackData();
  const refreshFeedback = useFeedbackStore((state) => state.refreshFeedback);

  if (!feedback) return null;

  const priorityStyle = getPriorityStyle(feedback.priority);
  const slaStyle = getSLAStyle(feedback.sla_status);

  // Get avatar URL
  const getAvatarUrl = (avatarPath?: string) => {
    if (!avatarPath) return null;
    if (avatarPath.startsWith('http')) return avatarPath;
    return `${BASE_URL}${avatarPath}`;
  };

  return (
    <ScrollView
      className="flex-1 bg-white p-4"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshFeedback}
          colors={['#F05023']}
          tintColor="#F05023"
        />
      }>
      {/* Guardian Info Section */}
      <View className="mb-4 rounded-2xl bg-[#F8F8F8] p-4">
        <Text className="mb-3 text-lg font-semibold text-[#002855]">Thông tin phụ huynh</Text>

        {feedback.guardian_info ? (
          <>
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-gray-500">Họ tên:</Text>
              <Text className="font-medium">{feedback.guardian_info.name}</Text>
            </View>
            {feedback.guardian_info.phone_number && (
              <View className="flex-row items-center justify-between py-2">
                <Text className="text-gray-500">Số điện thoại:</Text>
                <Text className="font-medium">{feedback.guardian_info.phone_number}</Text>
              </View>
            )}
            {feedback.guardian_info.email && (
              <View className="flex-row items-center justify-between py-2">
                <Text className="text-gray-500">Email:</Text>
                <Text className="font-medium">{feedback.guardian_info.email}</Text>
              </View>
            )}

            {/* Students */}
            {feedback.guardian_info.students && feedback.guardian_info.students.length > 0 && (
              <View className="mt-3">
                <Text className="mb-2 font-medium text-gray-600">Học sinh:</Text>
                {feedback.guardian_info.students.map((student, index) => (
                  <View key={index} className="mt-2 flex-row items-center rounded-lg bg-white p-3">
                    {student.photo ? (
                      <Image
                        source={{ uri: getAvatarUrl(student.photo) || undefined }}
                        className="mr-3 h-12 w-12 rounded-full"
                      />
                    ) : (
                      <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                        <Text className="text-lg font-bold text-gray-500">
                          {student.name?.charAt(0) || '?'}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="font-medium">{student.name}</Text>
                      {student.class_name && (
                        <Text className="text-sm text-gray-500">{student.class_name}</Text>
                      )}
                      {student.relationship && (
                        <Text className="text-xs text-gray-400">{student.relationship}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-gray-500">Mã phụ huynh:</Text>
            <Text className="font-medium">{feedback.guardian}</Text>
          </View>
        )}
      </View>

      {/* Feedback Content Section */}
      <View className="mb-4 rounded-2xl bg-[#F8F8F8] p-4">
        <Text className="mb-3 text-lg font-semibold text-[#002855]">
          {feedback.feedback_type === 'Đánh giá' ? 'Thông tin đánh giá' : 'Nội dung góp ý'}
        </Text>

        {/* Loại feedback */}
        <View className="flex-row items-center justify-between py-2">
          <Text className="text-gray-500">Loại:</Text>
          <Text className="font-medium">{feedback.feedback_type}</Text>
        </View>

        {/* Rating - Chỉ hiện cho Đánh giá */}
        {feedback.feedback_type === 'Đánh giá' && feedback.rating !== undefined && (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-gray-500">Số sao:</Text>
            <Text className="text-xl">{'⭐'.repeat(Math.round((feedback.rating || 0) * 5))}</Text>
          </View>
        )}

        {/* Rating comment - Chỉ hiện cho Đánh giá */}
        {feedback.feedback_type === 'Đánh giá' && feedback.rating_comment && (
          <View className="mt-3">
            <Text className="mb-2 text-gray-500">Nhận xét:</Text>
            <View className="rounded-lg bg-white p-3">
              <Text className="text-gray-700">{feedback.rating_comment}</Text>
            </View>
          </View>
        )}

        {/* Department - Chỉ hiện cho Góp ý */}
        {feedback.feedback_type === 'Góp ý' && feedback.department && (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-gray-500">Bộ phận:</Text>
            <Text className="font-medium">{feedback.department}</Text>
          </View>
        )}

        {/* Priority - Chỉ hiện cho Góp ý */}
        {feedback.feedback_type === 'Góp ý' && feedback.priority && (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-gray-500">Độ ưu tiên:</Text>
            <View className={`${priorityStyle.bg} rounded-lg px-3 py-1`}>
              <Text className={`text-sm font-medium ${priorityStyle.text}`}>
                {feedback.priority}
              </Text>
            </View>
          </View>
        )}

        {/* Content - Chỉ hiện cho Góp ý */}
        {feedback.feedback_type === 'Góp ý' && feedback.content && (
          <View className="mt-3">
            <Text className="mb-2 text-gray-500">Nội dung:</Text>
            <View className="rounded-lg bg-white p-3">
              <Text className="text-gray-700">{feedback.content}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Assignment Section */}
      <View className="mb-4 rounded-2xl bg-[#F8F8F8] p-4">
        <Text className="mb-3 text-lg font-semibold text-[#002855]">Thông tin xử lý</Text>

        {/* Assigned to */}
        <View className="flex-row items-center justify-between py-2">
          <Text className="text-gray-500">Người xử lý:</Text>
          {feedback.assigned_to_full_name ? (
            <View className="flex-row items-center">
              {feedback.assigned_to_avatar && (
                <Image
                  source={{ uri: getAvatarUrl(feedback.assigned_to_avatar) || undefined }}
                  className="mr-2 h-6 w-6 rounded-full"
                />
              )}
              <Text className="font-medium">
                {normalizeVietnameseName(feedback.assigned_to_full_name)}
              </Text>
            </View>
          ) : (
            <Text className="italic text-gray-400">Chưa phân công</Text>
          )}
        </View>

        {/* Assigned date */}
        {feedback.assigned_date && (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-gray-500">Ngày phân công:</Text>
            <Text className="font-medium">
              {new Date(feedback.assigned_date).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {/* Deadline */}
        {feedback.deadline && (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-gray-500">Hạn xử lý:</Text>
            <Text className="font-medium">
              {new Date(feedback.deadline).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {/* SLA Status */}
        {slaStyle && (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-gray-500">Trạng thái SLA:</Text>
            <View className={`${slaStyle.bg} rounded-lg px-3 py-1`}>
              <Text className={`text-sm font-medium ${slaStyle.text}`}>{slaStyle.label}</Text>
            </View>
          </View>
        )}

        {/* Conversation count */}
        <View className="flex-row items-center justify-between py-2">
          <Text className="text-gray-500">Số lượt phản hồi:</Text>
          <Text className="font-medium">{feedback.conversation_count || 0}</Text>
        </View>
      </View>

      {/* Timestamps Section */}
      <View className="mb-4 rounded-2xl bg-[#F8F8F8] p-4">
        <Text className="mb-3 text-lg font-semibold text-[#002855]">Thời gian</Text>

        <View className="flex-row items-center justify-between py-2">
          <Text className="text-gray-500">Ngày gửi:</Text>
          <Text className="font-medium">
            {new Date(feedback.submitted_at).toLocaleDateString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {feedback.first_response_date && (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-gray-500">Phản hồi đầu tiên:</Text>
            <Text className="font-medium">
              {new Date(feedback.first_response_date).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {feedback.last_updated && (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-gray-500">Cập nhật cuối:</Text>
            <Text className="font-medium">
              {new Date(feedback.last_updated).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {feedback.closed_at && (
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-gray-500">Ngày đóng:</Text>
            <Text className="font-medium">
              {new Date(feedback.closed_at).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
      </View>

      {/* Resolution Rating (if closed) */}
      {feedback.resolution_rating ? (
        <View className="mb-4 rounded-2xl bg-[#FFFBE8] p-4">
          <Text className="mb-3 text-center text-lg font-semibold text-[#F5AA1E]">
            Đánh giá từ phụ huynh
          </Text>
          <View className="items-center">
            <Text className="text-3xl font-bold text-[#F5AA1E]">
              {`${Math.round((feedback.resolution_rating || 0) * 5)}/5 ⭐`}
            </Text>
            {feedback.resolution_comment ? (
              <Text className="mt-2 text-center italic text-gray-600">
                {`"${feedback.resolution_comment}"`}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View className="h-8" />
    </ScrollView>
  );
};

export default FeedbackInformation;
