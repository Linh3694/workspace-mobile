import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Image, RefreshControl, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from '../../../components/Common';
import Modal from 'react-native-modal';

// Store & Hooks
import { useAdministrativeTicketData, useAdministrativeTicketActions } from '../../../hooks/useAdministrativeTicketStore';

// Utils & Constants
import { API_BASE_URL } from '../../../config/constants';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import { isLateEventNotice } from '../../../utils/eventTicketUtils';
import {
  getAdminTicketStatusColorClass,
  getAdminTicketStatusLabel,
} from '../../../config/administrativeTicketConstants';

// Components
import TicketComments from './TicketComments';

interface TicketInformationProps {
  ticketId: string;
  activeTab: string;
  onRefresh?: () => void;
}

const TicketInformation: React.FC<TicketInformationProps> = ({ ticketId, activeTab }) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Global store - ticket đã được fetch từ parent (TicketAdminDetail/TicketGuestDetail)
  const { ticket, loading, refreshing, error } = useAdministrativeTicketData();
  const { refreshTicket } = useAdministrativeTicketActions();

  // Show messaging tab when active
  if (activeTab === 'messaging') {
    return <TicketComments ticketId={ticketId} />;
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        <Text className="font-medium text-gray-500">{error || 'Không tìm thấy thông tin ticket'}</Text>
        <TouchableOpacity onPress={refreshTicket} className="mt-4 rounded-lg bg-blue-500 px-4 py-2">
          <Text className="font-medium text-white">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const resolveAttachmentUrl = (url: string) =>
    url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  const attachmentList: { url: string; filename: string; isImage: boolean }[] = (() => {
    const raw = ticket.attachments;
    let urls: string[] = [];
    if (Array.isArray(raw) && raw.length > 0) {
      urls = raw.map((a) => a?.url || '').filter(Boolean);
    } else if (ticket.attachment) {
      urls = [ticket.attachment];
    }
    return urls.map((url) => ({
      url: resolveAttachmentUrl(url),
      filename: decodeURIComponent(url.split('?')[0].split('/').pop() || 'file'),
      isImage: /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)(\?|$)/i.test(url),
    }));
  })();
  const isEventTicket = !!ticket.is_event_facility;
  const relatedStudentsText =
    ticket.related_students && ticket.related_students.length > 0
      ? ticket.related_students.map((s) => `${s.student_name} (${s.student_code})`).join(', ')
      : 'Không có';
  const relatedStaffText =
    ticket.related_staff && ticket.related_staff.length > 0
      ? ticket.related_staff
          .map((s) =>
            s.department_name
              ? `${normalizeVietnameseName(s.full_name)} (${s.department_name})`
              : normalizeVietnameseName(s.full_name),
          )
          .join(', ')
      : 'Không có';

  return (
    <ScrollView
      className="flex-1 bg-white p-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshTicket} colors={['#F05023']} tintColor="#F05023" />
      }>
      <View className="mb-4 rounded-xl bg-[#F8F8F8] p-4">
        <Text className="mb-2 font-semibold text-lg text-[#002855]">Thông tin chung</Text>

        <View className="mb-3 flex flex-row items-center justify-between">
          <Text className="font-semibold text-base text-[#757575]">Mã yêu cầu</Text>
          <Text className="font-medium text-base text-[#002855]">{ticket.ticketCode}</Text>
        </View>

        <View className="mb-3 flex flex-row items-center justify-between">
          <Text className="font-semibold text-base text-[#757575]">Người thực hiện</Text>
          <Text className="font-medium text-base text-[#002855]">
            {ticket.assignedTo ? normalizeVietnameseName(ticket.assignedTo.fullname) : 'Chưa phân công'}
          </Text>
        </View>

        <View className="mb-3 flex flex-row items-center justify-between">
          <Text className="font-semibold text-base text-[#757575]">Ngày yêu cầu</Text>
          <View className="flex-row items-center">
            <Text className="font-medium text-base text-[#002855]">{formatDate(ticket.createdAt)}</Text>
          </View>
        </View>

        <View className="mb-3 flex flex-row items-center justify-between">
          <Text className="font-semibold text-base text-[#757575]">Trạng thái</Text>
          <View className={`${getAdminTicketStatusColorClass(ticket.status)} rounded-lg px-3 py-1`}>
            <Text className="font-semibold text-base text-white">
              {getAdminTicketStatusLabel(ticket.status)}
            </Text>
          </View>
        </View>
        <View className="mb-3 flex flex-row items-center justify-between">
          <Text className="font-semibold text-base text-[#757575]">Hạng mục</Text>
          <Text className="font-medium text-base text-[#002855]">
            {ticket.category_label || ticket.category || '--'}
          </Text>
        </View>
      </View>

      <View className="mb-4 rounded-xl bg-[#F8F8F8] p-4">
        <Text className="mb-2 font-bold text-lg text-[#002855]">Nội dung yêu cầu</Text>

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">Tiêu đề</Text>
          <Text className="mt-1 font-medium text-base text-[#757575]">{ticket.title}</Text>
        </View>

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">Chi tiết</Text>
          <Text className="mt-1 font-medium text-base text-[#757575]">{ticket.description}</Text>
        </View>

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">Khu vực / Tòa</Text>
          <Text className="mt-1 font-medium text-base text-[#757575]">
            {ticket.event_building_label || ticket.area_title || '--'}
          </Text>
        </View>

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">Phòng</Text>
          <Text className="mt-1 font-medium text-base text-[#757575]">
            {ticket.event_room_label || ticket.room_label || ticket.event_room_id || ticket.room_id || '--'}
          </Text>
        </View>

        {isEventTicket ? (
          <View className="mb-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
            <Text className="font-semibold text-base text-[#002855]">Thời gian sự kiện</Text>
            <Text className="mt-1 font-medium text-base text-[#757575]">
              {`${formatDate(ticket.event_start_time)} - ${formatDate(ticket.event_end_time)}`}
            </Text>
            {ticket.event_start_time && isLateEventNotice(ticket.event_start_time) ? (
              <Text className="mt-2 font-semibold text-sm text-orange-700">{'Báo muộn (< 72 giờ)'}</Text>
            ) : null}
          </View>
        ) : null}

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">Thiết bị liên quan</Text>
          <Text className="mt-1 font-medium text-base text-[#757575]">
            {ticket.related_equipment_label || ticket.related_equipment_id || 'Không có'}
          </Text>
        </View>

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">Học sinh liên quan</Text>
          <Text className="mt-1 font-medium text-base text-[#757575]">{relatedStudentsText}</Text>
        </View>

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">CBGVNV liên quan</Text>
          <Text className="mt-1 font-medium text-base text-[#757575]">{relatedStaffText}</Text>
        </View>

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">Đính kèm</Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-2">
            {attachmentList.length > 0 ? (
              attachmentList.map((file, index) =>
                file.isImage ? (
                  <TouchableOpacity key={index} onPress={() => setPreviewImage(file.url)}>
                    <Image
                      source={{ uri: file.url }}
                      className="h-20 w-20 rounded-lg"
                      onError={(e) => console.error('Lỗi tải ảnh:', e.nativeEvent.error)}
                    />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    key={index}
                    onPress={() => Linking.openURL(file.url)}
                    className="h-20 w-20 items-center justify-center rounded-lg bg-gray-100 p-1">
                    <Ionicons name="document-outline" size={26} color="#757575" />
                    <Text className="mt-1 text-center text-xs text-[#757575]" numberOfLines={2}>
                      {file.filename}
                    </Text>
                  </TouchableOpacity>
                ),
              )
            ) : (
              <Text className="font-medium text-sm text-[#757575]">Không có đính kèm</Text>
            )}
          </View>
        </View>

        <View className="mb-3">
          <Text className="font-semibold text-base text-[#002855]">Ghi chú</Text>
          <View className="mt-1 flex-row items-center">
            <Text className="mt-1 font-medium text-base text-[#757575]">{ticket.notes || 'Không có'}</Text>
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
