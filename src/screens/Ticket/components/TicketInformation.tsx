import React, { useState } from 'react';
//@ts-ignore
import { View, Text, ScrollView, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useTicketDetail } from '../../../hooks/useTicketHooks';
import Modal from 'react-native-modal';
import TicketComments from './TicketComments';
import { API_BASE_URL } from '../../../config/constants';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';

interface TicketInformationProps {
  ticketId: string;
  activeTab: string;
  onRefresh?: () => void;
}

const TicketInformation: React.FC<TicketInformationProps> = ({
  ticketId,
  activeTab,
  onRefresh,
}) => {
  const { ticket, loading, error, refetch } = useTicketDetail(ticketId);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Show messaging tab when active
  if (activeTab === 'messaging') {
    return <TicketComments ticketId={ticketId} />;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'Assigned':
        return 'bg-[#002855]';
      case 'Processing':
        return 'bg-[#F59E0B]';
      case 'Done':
        return 'bg-[#BED232]';
      case 'Closed':
        return 'bg-[#009483]';
      case 'Cancelled':
        return 'bg-[#F05023]';
      default:
        return 'bg-gray-500';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'Assigned':
        return 'Đã tiếp nhận';
      case 'Processing':
        return 'Đang xử lý';
      case 'Done':
        return 'Đã xử lý';
      case 'Closed':
        return 'Đã đóng';
      case 'Cancelled':
        return 'Đã hủy';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#002855" />
      </View>
    );
  }

  if (error || !ticket) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="font-medium text-gray-500">
          {error || 'Không tìm thấy thông tin ticket'}
        </Text>
        <TouchableOpacity onPress={refetch} className="mt-4 rounded-lg bg-blue-500 px-4 py-2">
          <Text className="font-medium text-white">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white p-4">
      <View className="mb-4 rounded-xl bg-[#F8F8F8] p-4">
        <Text className="mb-2 font-semibold text-lg text-[#002855]">Thông tin chung</Text>

        <View className="mb-3 flex flex-row items-center justify-between">
          <Text className="font-semibold text-base text-[#757575]">Mã yêu cầu</Text>
          <Text className="font-medium text-base text-[#002855]">{ticket.ticketCode}</Text>
        </View>

        <View className="mb-3 flex flex-row items-center justify-between">
          <Text className="font-semibold text-base text-[#757575]">Người thực hiện</Text>
          <Text className="font-medium text-base text-[#002855]">
            {ticket.assignedTo
              ? normalizeVietnameseName(ticket.assignedTo.fullname)
              : 'Chưa phân công'}
          </Text>
        </View>

        <View className="mb-3 flex flex-row items-center justify-between">
          <Text className="font-semibold text-base text-[#757575]">Ngày yêu cầu</Text>
          <View className="flex-row items-center">
            <Text className="font-medium text-base text-[#002855]">
              {formatDate(ticket.createdAt)}
            </Text>
          </View>
        </View>

        <View className="mb-3 flex flex-row items-center justify-between">
          <Text className="font-semibold text-base text-[#757575]">Trạng thái</Text>
          <View className={`${statusColor(ticket.status)} rounded-lg px-3 py-1`}>
            <Text className="font-semibold text-base text-white">{statusLabel(ticket.status)}</Text>
          </View>
        </View>
      </View>

      <View className="mb-4 rounded-xl bg-[#F8F8F8] p-4">
        <Text className="mb-2 font-bold text-lg text-[#002855]">Nội dung yêu cầu</Text>

        <View className="mb-3">
          <Text className=" font-semibold text-base text-[#002855]">Tiêu đề</Text>
          <Text className="mt-1 font-medium text-base text-[#757575]">{ticket.title}</Text>
        </View>

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">Chi tiết</Text>
          <Text className="mt-1 font-medium text-base text-[#757575]">{ticket.description}</Text>
        </View>

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">Ảnh</Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-2">
            {ticket.attachments && ticket.attachments.length > 0 ? (
              ticket.attachments.map((attachment, index) => {
                // Kiểm tra xem attachment.url có phải URL đầy đủ hay không
                const imageUrl = attachment.url.startsWith('http')
                  ? attachment.url
                  : `${API_BASE_URL}/uploads/Tickets/${attachment.url}`;

                return (
                  <TouchableOpacity key={index} onPress={() => setPreviewImage(imageUrl)}>
                    <Image
                      source={{ uri: imageUrl }}
                      className="h-20 w-20 rounded-lg"
                      onError={(e) => console.error('Lỗi tải ảnh:', e.nativeEvent.error)}
                    />
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text className="font-medium text-sm text-[#757575]">Không có ảnh đính kèm</Text>
            )}
          </View>
        </View>

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">Ghi chú</Text>
          <View className="mt-1 flex-row items-center">
            <Text className="mt-1 font-medium text-base text-[#757575]">{ticket.notes}</Text>
          </View>
        </View>
      </View>

      <Modal
        isVisible={!!previewImage}
        onBackdropPress={() => setPreviewImage(null)}
        onSwipeComplete={() => setPreviewImage(null)}
        swipeDirection={['down']}
        style={{ margin: 0, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '100%', alignItems: 'center' }}>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={{ width: '90%', height: '70%', resizeMode: 'contain' }}
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
};

export default TicketInformation;
