import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import StandardHeader from '../../components/Common/StandardHeader';
import ConfirmModal from '../../components/ConfirmModal';
import InputModal from '../../components/InputModal';
import { toast } from '../../utils/toast';
import {
  approveRoomBooking,
  getPendingRoomBookingsForMe,
  rejectRoomBooking,
} from '../../services/roomBookingService';
import type { PendingRoomBooking } from '../../types/roomBooking';
import { formatTimeRange } from './roomBookingUtils';
import { color } from '../../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PRIMARY = color.brand.DEFAULT;

/** "2026-09-25 17:30:00" -> "25/09/2026" */
function formatDay(mysql?: string): string {
  const raw = (mysql || '').trim();
  if (!raw) return '';
  const [d] = raw.split(' ');
  const parts = d.split('-');
  if (parts.length !== 3) return raw;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Hàng chờ duyệt đặt phòng.
 *
 * Danh sách do backend quyết (`get_pending_room_bookings_for_me`) — nó hỏi chính engine
 * duyệt xem phiếu nào đang chờ người này, nên không có luật quyền nào viết lại ở đây.
 * Bấm duyệt/từ chối gọi API duyệt dùng chung theo (doctype, name).
 */
export default function RoomBookingApprovalScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<PendingRoomBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approveTarget, setApproveTarget] = useState<PendingRoomBooking | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingRoomBooking | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const rows = await getPendingRoomBookingsForMe();
    setItems(rows);
    setLoading(false);
  }, []);

  // Tải lại mỗi lần vào màn: người duyệt hay mở app từ thông báo, và phiếu có thể đã
  // được đồng nghiệp trong cùng phạm vi ký mất — danh sách cũ là danh sách sai.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const doApprove = async () => {
    if (!approveTarget || acting) return;
    setActing(true);
    try {
      await approveRoomBooking(approveTarget.name);
      toast.success('Đã duyệt yêu cầu đặt phòng');
      setApproveTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không duyệt được');
    } finally {
      setActing(false);
    }
  };

  const doReject = async () => {
    if (!rejectTarget || acting) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error('Nhập lý do từ chối để người đặt biết vì sao');
      return;
    }
    setActing(true);
    try {
      await rejectRoomBooking(rejectTarget.name, reason);
      toast.success('Đã từ chối yêu cầu');
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không từ chối được');
    } finally {
      setActing(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <StandardHeader
        center={
          <Text className="text-lg font-bold" style={{ color: PRIMARY }}>
            Chờ tôi duyệt
          </Text>
        }
        leftButton={
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="h-11 w-11 items-center justify-center">
            <Ionicons name="chevron-back" size={26} color={PRIMARY} />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="checkmark-done-outline" size={48} color="#D1D5DB" />
          <Text className="mt-3 text-center text-base text-gray-400">
            Không có yêu cầu nào chờ bạn duyệt
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {items.map((b) => (
            <View
              key={b.name}
              className="mb-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5">
              <View className="flex-row items-start">
                <Text className="flex-1 text-base font-semibold text-gray-900" numberOfLines={2}>
                  {b.title || '(Không tiêu đề)'}
                </Text>
                {b.overdue ? (
                  <View className="ml-2 rounded-full bg-red-50 px-2 py-0.5">
                    <Text className="text-[11px] font-bold text-red-600">Quá hạn</Text>
                  </View>
                ) : null}
              </View>

              <View className="mt-2">
                <Row icon="business-outline" text={b.room_title || b.room_id} />
                <Row
                  icon="time-outline"
                  text={`${formatDay(b.start_time)} · ${formatTimeRange(b.start_time, b.end_time)}`}
                />
                <Row
                  icon="person-outline"
                  text={[b.requested_by, b.requested_by_department].filter(Boolean).join(' · ')}
                />
                {b.step_label ? <Row icon="git-branch-outline" text={`Bước ${b.step_label}`} /> : null}
              </View>

              {b.description ? (
                <Text className="mt-2 text-xs text-gray-500" numberOfLines={3}>
                  {b.description}
                </Text>
              ) : null}

              <View className="mt-3 flex-row">
                <TouchableOpacity
                  onPress={() => setRejectTarget(b)}
                  className="mr-2 flex-1 flex-row items-center justify-center rounded-xl border border-red-200 bg-red-50 py-2.5">
                  <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                  <Text className="ml-1.5 text-sm font-bold text-red-600">Từ chối</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setApproveTarget(b)}
                  className="flex-1 flex-row items-center justify-center rounded-xl py-2.5"
                  style={{ backgroundColor: PRIMARY }}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text className="ml-1.5 text-sm font-bold text-white">Duyệt</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <ConfirmModal
        visible={!!approveTarget}
        title="Duyệt yêu cầu đặt phòng"
        message={
          approveTarget
            ? `Duyệt "${approveTarget.title}" — ${approveTarget.room_title}, ${formatDay(
                approveTarget.start_time
              )} ${formatTimeRange(approveTarget.start_time, approveTarget.end_time)}?`
            : ''
        }
        onCancel={() => setApproveTarget(null)}
        onConfirm={doApprove}
      />

      <InputModal
        visible={!!rejectTarget}
        title="Lý do từ chối"
        placeholder="Ví dụ: phòng đã có lịch ưu tiên"
        value={rejectReason}
        onChangeText={setRejectReason}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
        onConfirm={doReject}
        isLoading={acting}
      />
    </View>
  );
}

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  if (!text) return null;
  return (
    <View className="mt-1 flex-row items-center">
      <Ionicons name={icon} size={14} color="#9CA3AF" />
      <Text className="ml-1.5 flex-1 text-xs text-gray-600" numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}
