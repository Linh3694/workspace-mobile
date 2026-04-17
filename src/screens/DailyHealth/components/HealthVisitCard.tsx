import React from 'react';
import { View, Text, Alert } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { StudentAvatar } from '../../../utils/studentAvatar';
import { DailyHealthVisit } from '../../../services/dailyHealthService';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import { formatTimeHHMM } from '../../../utils/dateUtils';

// Trạng thái pastel đồng bộ web (bg-50, text-700)
const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  left_class: { label: 'Rời lớp', color: '#B45309', bg: '#FFFBEB', icon: 'walk-outline' },
  at_clinic: { label: 'Tại YT', color: '#0369A1', bg: '#F0F9FF', icon: 'medical-outline' },
  examining: { label: 'Đang khám', color: '#C2410C', bg: '#FFF7ED', icon: 'pulse-outline' },
  returned: {
    label: 'Đã về lớp',
    color: '#047857',
    bg: '#ECFDF5',
    icon: 'checkmark-circle-outline',
  },
  picked_up: { label: 'Phụ huynh đón', color: '#6D28D9', bg: '#F5F3FF', icon: 'car-outline' },
  transferred: { label: 'Chuyển viện', color: '#BE123C', bg: '#FFF1F2', icon: 'medkit-outline' },
  cancelled: { label: 'Đã hủy', color: '#475569', bg: '#F8FAFC', icon: 'close-circle-outline' },
  rejected: { label: 'Từ chối', color: '#475569', bg: '#F8FAFC', icon: 'close-circle-outline' },
};

const DEFAULT_CONFIG = {
  label: 'Khác',
  color: '#475569',
  bg: '#F8FAFC',
  icon: 'help-outline' as const,
};

interface HealthVisitCardProps {
  visit: DailyHealthVisit;
  onPress: () => void;
  onReceive?: () => void;
  onReject?: () => void;
  onStartExam?: () => void;
  /** Lượt khám lại: HS đã có lượt hoàn thành trong ngày → hiển thị "Đang khám" */
  isReturnVisit?: boolean;
  /** Đồng bộ web: examining hoặc at_clinic đã có hồ sơ trong ngày */
  canCheckout?: boolean;
  onCheckout?: () => void;
}

// Tính thời gian đã ở clinic (phút)
const getTimeAtClinic = (arriveTime?: string): number | null => {
  if (!arriveTime) return null;
  try {
    const [hours, minutes] = arriveTime.split(':').map(Number);
    const arrive = new Date();
    arrive.setHours(hours, minutes, 0, 0);
    const now = new Date();
    const diff = Math.floor((now.getTime() - arrive.getTime()) / 60000);
    return diff > 0 ? diff : 0;
  } catch {
    return null;
  }
};

const HealthVisitCard: React.FC<HealthVisitCardProps> = ({
  visit,
  onPress,
  onReceive,
  onReject,
  onStartExam,
  isReturnVisit = false,
  canCheckout = false,
  onCheckout,
}) => {
  // Lượt khám lại (at_clinic + đã có lượt hoàn thành) → hiển thị như "examining"
  const displayStatus = (visit.status === 'at_clinic' && isReturnVisit) ? 'examining' : visit.status;
  const config = statusConfig[displayStatus] ?? DEFAULT_CONFIG;
  const timeAtClinic =
    visit.status === 'at_clinic' || visit.status === 'examining'
      ? getTimeAtClinic(visit.arrive_clinic_time)
      : null;
  const isLongWait = timeAtClinic !== null && timeAtClinic > 30;

  const handleReceive = () => {
    Alert.alert('Tiếp nhận học sinh', `Xác nhận tiếp nhận ${visit.student_name} vào phòng Y tế?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Tiếp nhận', onPress: onReceive },
    ]);
  };

  // Gọi onReject để mở modal nhập lý do từ chối (đồng bộ web)
  const handleReject = () => {
    onReject?.();
  };

  const handleAction = () => {
    switch (visit.status) {
      case 'left_class':
        handleReceive();
        break;
      case 'at_clinic':
        onStartExam?.();
        break;
      case 'examining':
        onPress();
        break;
      default:
        onPress();
    }
  };

  const getActionButton = () => {
    switch (visit.status) {
      case 'left_class':
        return { label: 'Tiếp nhận', color: '#0369A1', bg: '#F0F9FF', icon: 'add-circle-outline' };
      case 'at_clinic':
        // Lượt khám lại → hiển thị "Thăm khám" thay vì "Bắt đầu khám"
        if (isReturnVisit) {
          return { label: 'Thăm khám', color: '#C2410C', bg: '#FFF7ED', icon: 'arrow-forward-outline' };
        }
        return { label: 'Bắt đầu khám', color: '#C2410C', bg: '#FFF7ED', icon: 'pulse-outline' };
      case 'examining':
        return { label: 'Thăm khám', color: '#C2410C', bg: '#FFF7ED', icon: 'arrow-forward-outline' };
      default:
        return { label: 'Xem chi tiết', color: '#475569', bg: '#F8FAFC', icon: 'eye-outline' };
    }
  };

  const actionBtn = getActionButton();

  return (
    <TouchableOpacity
      onPress={onPress}
      className="mb-3 overflow-hidden rounded-xl border border-gray-100 bg-white">
      <View className="p-4">
        {/* Header row */}
        <View className="flex-row items-start">
          <StudentAvatar name={visit.student_name} avatarUrl={visit.student_photo} size={56} />
          <View className="ml-3 flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                {visit.student_name}
              </Text>
              <View
                className="flex-row items-center rounded-full px-2 py-1"
                style={{ backgroundColor: config.bg }}>
                <Ionicons name={config.icon as any} size={12} color={config.color} />
                <Text className="ml-1 text-xs font-medium" style={{ color: config.color }}>
                  {config.label}
                </Text>
              </View>
            </View>
            <Text className="text-sm text-gray-500">{visit.student_code}</Text>
            <Text className="text-sm text-gray-500">{visit.class_name}</Text>
          </View>
        </View>

        {/* Info row */}
        <View className="mt-3 rounded-lg bg-gray-50 p-3">
          <View className="mb-2 flex-row items-center">
            <Ionicons name="document-text-outline" size={16} color="#6B7280" />
            <Text
              className="ml-2 text-sm font-medium text-gray-600"
              style={{ fontFamily: 'Mulish' }}>
              Lý do xuống Y Tế:{' '}
            </Text>
            <Text
              className="flex-1 text-sm font-bold text-gray-700 "
              numberOfLines={2}
              style={{ fontFamily: 'Mulish' }}>
              {visit.reason || 'Không có lý do'}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text className="ml-2 text-sm text-gray-600" style={{ fontFamily: 'Mulish' }}>
              Rời lớp:
            </Text>
            <Text className="ml-1 text-sm font-bold text-gray-700" style={{ fontFamily: 'Mulish' }}>
              {formatTimeHHMM(visit.leave_class_time) || '--:--'}
            </Text>
            {/* Chỉ hiển thị "Đến Y Tế" khi đã tiếp nhận (không phải left_class) */}
            {visit.arrive_clinic_time && visit.status !== 'left_class' && (
              <>
                <Text className="ml-3 text-sm text-gray-600" style={{ fontFamily: 'Mulish' }}>
                  Đến Y Tế:
                </Text>
                <Text
                  className="ml-1 text-sm font-bold text-gray-700"
                  style={{ fontFamily: 'Mulish' }}>
                  {formatTimeHHMM(visit.arrive_clinic_time)}
                </Text>
              </>
            )}
          </View>
          {visit.reported_by_name && (
            <View className="mt-1 flex-row items-center">
              <Ionicons name="person-outline" size={16} color="#6B7280" />
              <Text className="ml-2 text-sm text-gray-600" style={{ fontFamily: 'Mulish' }}>
                Người báo cáo:
              </Text>
              <Text
                className="ml-1 text-sm font-bold text-gray-700"
                style={{ fontFamily: 'Mulish' }}>
                {normalizeVietnameseName(visit.reported_by_name)}
              </Text>
            </View>
          )}
        </View>

        {/* Warning for long wait */}
        {isLongWait && (
          <View className="mt-2 flex-row items-center rounded-lg bg-yellow-50 p-2">
            <Ionicons name="warning-outline" size={16} color="#D97706" />
            <Text className="ml-2 text-sm text-yellow-700">
              Đã ở phòng Y tế {timeAtClinic} phút
            </Text>
          </View>
        )}

        {/* Action button(s) */}
        {visit.status === 'left_class' && (
          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity
              onPress={handleReceive}
              className="flex-1 flex-row items-center justify-center rounded-xl py-3"
              style={{ backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD' }}>
              <Ionicons name="add-circle-outline" size={18} color="#0369A1" />
              <Text className="ml-2 font-semibold" style={{ color: '#0369A1' }}>
                Tiếp nhận
              </Text>
            </TouchableOpacity>
            {onReject && (
              <TouchableOpacity
                onPress={handleReject}
                className="flex-1 flex-row items-center justify-center rounded-xl py-3"
                style={{ backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3' }}>
                <Ionicons name="close-circle-outline" size={18} color="#BE123C" />
                <Text className="ml-2 font-semibold" style={{ color: '#BE123C' }}>
                  Từ chối
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {(visit.status === 'at_clinic' || visit.status === 'examining') && (
          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity
              onPress={handleAction}
              className="flex-1 flex-row items-center justify-center rounded-xl py-3"
              style={{ backgroundColor: actionBtn.bg || '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' }}>
              <Ionicons name={actionBtn.icon as any} size={18} color={actionBtn.color} />
              <Text className="ml-2 font-semibold" style={{ color: actionBtn.color }}>
                {actionBtn.label}
              </Text>
            </TouchableOpacity>
            {canCheckout && onCheckout && (
              <TouchableOpacity
                onPress={onCheckout}
                className="flex-1 flex-row items-center justify-center rounded-xl py-3"
                style={{
                  backgroundColor: '#ECFDF5',
                  borderWidth: 1,
                  borderColor: '#A7F3D0',
                }}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#047857" />
                <Text className="ml-2 font-semibold" style={{ color: '#047857' }}>
                  Check out
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default HealthVisitCard;
