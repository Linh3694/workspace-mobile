import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import StandardHeader from '../../components/Common/StandardHeader';
import BottomSheetModal from '../../components/Common/BottomSheetModal';
import ConfirmModal from '../../components/ConfirmModal';
import { toast } from '../../utils/toast';
import {
  getMyTeacherSlots,
  getEvents,
  startMeeting,
  completeMeeting,
  teacherCancelSlot,
} from '../../services/parentMeetingService';
import type { PTMeetingEventListItem, PTTeacherSlot } from '../../types/parentMeeting';
import {
  groupSlotsByDay,
  formatTimeRange,
  formatDateShort,
  getSlotStatusInfo,
  getTeacherGroupLabel,
  getStudentLabel,
  getStartDeadline,
  getAutoCancelMinutesOfList,
  getAutoCancelNotice,
  getEventStatusLabel,
  isAutoCancelledNoShow,
  canStartSlot,
  canCompleteSlot,
  canCancelSlot,
  canWriteNote,
  canViewParentMeetingAdmin,
  type PTStatusTone,
} from './parentMeetingUtils';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PRIMARY = '#002855';
const SECONDARY = '#F05023';

/** Màu badge theo sắc thái trạng thái ca (utils giữ ngữ nghĩa, màn hình chọn màu). */
const TONE_STYLE: Record<PTStatusTone, { bg: string; text: string }> = {
  neutral: { bg: '#F3F4F6', text: '#4B5563' },
  info: { bg: '#E8EEF5', text: PRIMARY },
  success: { bg: '#DCFCE7', text: '#15803D' },
  warning: { bg: '#FEF3C7', text: '#B45309' },
  danger: { bg: '#FEE2E2', text: '#B91C1C' },
};

/** Giá trị "phạm vi hôm nay" của bộ lọc — trùng với mặc định của backend khi không gửi event_id. */
const SCOPE_TODAY = '';

export default function ParentMeetingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const roles: string[] = Array.isArray(user?.roles) ? (user?.roles as string[]) : [];
  /**
   * Đây là lối vào DUY NHẤT tới màn tổng hợp đợt, nên nó phải mở đúng bằng cờ đọc của màn đó.
   * Trước đây chốt bằng `Mobile BOD`: giáo vụ — người duy nhất được xuất bản lịch — không có
   * đường nào bấm tới nút của chính mình.
   */
  const canOpenAdmin = canViewParentMeetingAdmin(roles);

  const [rawSlots, setRawSlots] = useState<PTTeacherSlot[]>([]);
  const [events, setEvents] = useState<PTMeetingEventListItem[]>([]);
  const [scopeEventId, setScopeEventId] = useState<string>(SCOPE_TODAY);
  const [loading, setLoading] = useState(true);
  const [scopePickerVisible, setScopePickerVisible] = useState(false);

  /** slot_id đang gọi API — khoá riêng từng ca để các ca khác vẫn bấm được */
  const [actingId, setActingId] = useState<string>('');

  const [cancelTarget, setCancelTarget] = useState<PTTeacherSlot | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Danh sách đợt phục vụ 2 việc: bộ lọc phạm vi, và tra ngưỡng tự huỷ của từng đợt.
  // Giáo viên không có quyền đọc danh sách đợt thì service trả [] — màn hình vẫn chạy,
  // chỉ mất bộ lọc và câu nhắc phải nói chung chung (xem getAutoCancelNotice).
  useEffect(() => {
    void (async () => setEvents(await getEvents({ page_size: 25 })))();
  }, []);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    const data = await getMyTeacherSlots(scopeEventId ? { eventId: scopeEventId } : {});
    setRawSlots(data);
    setLoading(false);
  }, [scopeEventId]);

  // Reload mỗi lần focus: cron tự huỷ chạy 5 phút/lần và phụ huynh có thể huỷ ca trong lúc
  // màn hình đang mở, nên số liệu cũ ở đây dẫn tới việc giáo viên ngồi chờ một ca đã mất.
  useFocusEffect(
    useCallback(() => {
      void loadSlots();
    }, [loadSlots])
  );

  const minutesByEvent = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      if (Number.isFinite(e.auto_cancel_after_minutes)) {
        map[e.name] = e.auto_cancel_after_minutes;
      }
    }
    return map;
  }, [events]);

  // `get_my_teacher_slots` không trả auto_cancel_after_minutes (nó là cấu hình của ĐỢT),
  // nên gắn thêm ở client thay vì hard-code 10 phút — xem getAutoCancelMinutes.
  const slots = useMemo(
    () =>
      rawSlots.map((s) => ({
        ...s,
        auto_cancel_after_minutes: minutesByEvent[s.event_id] ?? s.auto_cancel_after_minutes,
      })),
    [rawSlots, minutesByEvent]
  );

  const groups = useMemo(() => groupSlotsByDay(slots), [slots]);
  const autoCancelMinutes = useMemo(() => getAutoCancelMinutesOfList(slots), [slots]);
  const scopeEvent = useMemo(
    () => events.find((e) => e.name === scopeEventId) ?? null,
    [events, scopeEventId]
  );

  const handleStart = async (slot: PTTeacherSlot) => {
    setActingId(slot.slot_id);
    try {
      await startMeeting(slot.slot_id);
      toast.success('Đã bắt đầu buổi họp');
      await loadSlots();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể bắt đầu buổi họp');
    } finally {
      setActingId('');
    }
  };

  const handleComplete = async (slot: PTTeacherSlot) => {
    setActingId(slot.slot_id);
    try {
      await completeMeeting(slot.slot_id);
      toast.success('Đã kết thúc buổi họp');
      // Mở luôn màn ghi note khi đợt có bật: ghi ngay lúc còn nhớ nội dung trao đổi, để đến
      // cuối buổi thì giáo viên đã họp thêm vài ca và lẫn thông tin giữa các gia đình.
      if (slot.allow_meeting_note !== 0) {
        navigation.navigate(ROUTES.SCREENS.PARENT_MEETING_NOTE, { slotId: slot.slot_id });
      } else {
        await loadSlots();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể kết thúc buổi họp');
    } finally {
      setActingId('');
    }
  };

  const openCancelSheet = (slot: PTTeacherSlot) => {
    setCancelReason('');
    setCancelTarget(slot);
  };

  const closeCancelSheet = () => {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelReason('');
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await teacherCancelSlot(cancelTarget.slot_id, cancelReason);
      toast.success('Đã huỷ ca họp và báo cho phụ huynh');
      setCancelConfirmVisible(false);
      setCancelTarget(null);
      setCancelReason('');
      await loadSlots();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể huỷ ca họp');
    } finally {
      setCancelling(false);
    }
  };

  const renderSlot = (slot: PTTeacherSlot) => {
    const statusInfo = getSlotStatusInfo(slot.status);
    const tone = TONE_STYLE[statusInfo.tone];
    const busy = actingId === slot.slot_id;
    const deadline = getStartDeadline(slot);
    const groupLabel = getTeacherGroupLabel(slot.teacher_group, slot.teacher_group_label_vn);
    const hasActions =
      canStartSlot(slot) || canCompleteSlot(slot) || canWriteNote(slot) || canCancelSlot(slot);

    return (
      <View key={slot.slot_id} className="mb-2 rounded-xl border border-gray-100 bg-white px-3.5 py-3">
        <View className="flex-row">
          <View className="mr-3 w-[86px] items-start">
            <Text className="text-sm font-bold" style={{ color: SECONDARY }}>
              {formatTimeRange(slot.start_time, slot.end_time)}
            </Text>
            <View
              className="mt-1.5 self-start rounded-full px-2 py-0.5"
              style={{ backgroundColor: tone.bg }}>
              <Text className="text-[11px] font-semibold" style={{ color: tone.text }}>
                {statusInfo.label}
              </Text>
            </View>
          </View>

          <View className="flex-1 border-l border-gray-100 pl-3">
            <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
              {getStudentLabel(slot)}
            </Text>
            <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
              {[slot.class_title, groupLabel, slot.location].filter(Boolean).join(' · ')}
            </Text>

            {slot.need_interpreter === 1 ? (
              <View className="mt-1.5 flex-row items-center self-start rounded-full bg-amber-50 px-2 py-0.5">
                <Ionicons name="language-outline" size={13} color="#B45309" />
                <Text className="ml-1 text-[11px] font-semibold" style={{ color: '#B45309' }}>
                  Cần phiên dịch
                </Text>
              </View>
            ) : null}

            {slot.note ? (
              <View className="mt-2 rounded-lg bg-gray-50 px-2.5 py-2">
                <Text className="text-[11px] font-semibold text-gray-500">
                  Ghi chú của phụ huynh
                </Text>
                <Text className="mt-0.5 text-sm text-gray-700">{slot.note}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Ca tự huỷ: nói rõ nguyên nhân ngay trên thẻ, không để lẫn với ca phụ huynh huỷ */}
        {isAutoCancelledNoShow(slot.status) ? (
          <View className="mt-2.5 flex-row rounded-lg bg-amber-50 px-2.5 py-2">
            <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
            <Text className="ml-1.5 flex-1 text-xs" style={{ color: '#92400E' }}>
              {statusInfo.description}
            </Text>
          </View>
        ) : null}

        {/* Hạn bấm "Bắt đầu họp" gắn ngay trên ca sắp diễn ra, không bắt GV tự cộng nhẩm */}
        {canStartSlot(slot) && deadline ? (
          <Text className="mt-2.5 text-xs font-semibold" style={{ color: '#B45309' }}>
            Bấm "Bắt đầu họp" trước {deadline}, nếu không ca sẽ tự huỷ.
          </Text>
        ) : null}

        {hasActions ? (
          <View className="mt-2.5 flex-row items-center">
            {canStartSlot(slot) ? (
              <TouchableOpacity
                disabled={busy}
                onPress={() => handleStart(slot)}
                className="mr-2 flex-1 flex-row items-center justify-center rounded-xl py-2.5"
                style={{ backgroundColor: busy ? '#9CA3AF' : PRIMARY }}>
                <Ionicons name="play-circle-outline" size={18} color="#FFFFFF" />
                <Text className="ml-1.5 text-sm font-bold text-white">
                  {busy ? 'Đang xử lý…' : 'Bắt đầu họp'}
                </Text>
              </TouchableOpacity>
            ) : null}

            {canCompleteSlot(slot) ? (
              <TouchableOpacity
                disabled={busy}
                onPress={() => handleComplete(slot)}
                className="mr-2 flex-1 flex-row items-center justify-center rounded-xl py-2.5"
                style={{ backgroundColor: busy ? '#9CA3AF' : '#15803D' }}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                <Text className="ml-1.5 text-sm font-bold text-white">
                  {busy ? 'Đang xử lý…' : 'Kết thúc họp'}
                </Text>
              </TouchableOpacity>
            ) : null}

            {canWriteNote(slot) ? (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate(ROUTES.SCREENS.PARENT_MEETING_NOTE, { slotId: slot.slot_id })
                }
                className="mr-2 flex-1 flex-row items-center justify-center rounded-xl border py-2.5"
                style={{ borderColor: PRIMARY }}>
                <Ionicons name="create-outline" size={18} color={PRIMARY} />
                <Text className="ml-1.5 text-sm font-bold" style={{ color: PRIMARY }}>
                  {slot.has_note === 1 ? 'Sửa meeting note' : 'Ghi meeting note'}
                </Text>
              </TouchableOpacity>
            ) : null}

            {canCancelSlot(slot) ? (
              <TouchableOpacity
                disabled={busy}
                onPress={() => openCancelSheet(slot)}
                className="h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <StandardHeader
        leftButton={
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="h-11 w-11 items-center justify-center">
            <Ionicons name="chevron-back" size={26} color={PRIMARY} />
          </TouchableOpacity>
        }
        center={
          <Text className="text-lg font-bold" style={{ color: PRIMARY }}>
            Lịch họp của tôi
          </Text>
        }
        rightButton={
          canOpenAdmin ? (
            <TouchableOpacity
              onPress={() => navigation.navigate(ROUTES.SCREENS.PARENT_MEETING_ADMIN)}
              className="h-11 w-11 items-center justify-center">
              <Ionicons name="stats-chart-outline" size={22} color={PRIMARY} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Bộ lọc phạm vi. Mặc định là HÔM NAY vì màn này hay được mở ngay trước cửa phòng họp;
          muốn xem trọn một đợt (vd. chuẩn bị trước) thì chọn đợt cụ thể. */}
      {events.length > 0 ? (
        <TouchableOpacity
          onPress={() => setScopePickerVisible(true)}
          className="mx-4 mt-3 flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <Ionicons name="funnel-outline" size={20} color={PRIMARY} />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
              {scopeEvent ? scopeEvent.title_vn : 'Ca họp hôm nay'}
            </Text>
            <Text className="text-xs text-gray-500" numberOfLines={1}>
              {scopeEvent
                ? [formatDateShort(scopeEvent.meeting_date), getEventStatusLabel(scopeEvent.status)]
                    .filter(Boolean)
                    .join(' · ')
                : 'Chạm để xem toàn bộ một đợt họp'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : groups.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="calendar-clear-outline" size={48} color="#D1D5DB" />
          <Text className="mt-3 text-center text-base text-gray-400">
            {scopeEvent ? 'Đợt này chưa có ca nào của bạn' : 'Hôm nay bạn không có ca họp nào'}
          </Text>
          <Text className="mt-1 text-center text-xs text-gray-400">
            Lịch chỉ hiện sau khi nhà trường xuất bản kết quả xếp lịch.
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}>
          {/* Luật tự huỷ đặt ở chỗ đọc được ngay: đây là cách duy nhất giáo viên mất ca mà
              không có ai báo trước, và ca đã tự huỷ thì không khôi phục được. */}
          <View className="mb-4 flex-row rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <Ionicons name="time-outline" size={18} color="#B45309" />
            <Text className="ml-2 flex-1 text-xs leading-5" style={{ color: '#92400E' }}>
              {getAutoCancelNotice(autoCancelMinutes)}
            </Text>
          </View>

          {groups.map((group) => (
            <View key={group.key} className="mb-4">
              <Text className="mb-2 text-sm font-bold uppercase" style={{ color: PRIMARY }}>
                {group.label}
              </Text>
              {group.items.map(renderSlot)}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Sheet chọn phạm vi */}
      <BottomSheetModal
        visible={scopePickerVisible}
        onClose={() => setScopePickerVisible(false)}
        maxHeightPercent={70}
        fillHeight>
        <View className="flex-1">
          <View className="items-center pb-2 pt-3">
            <View className="h-1 w-10 rounded-full bg-gray-300" />
          </View>
          <Text className="px-4 pb-2 text-lg font-bold" style={{ color: PRIMARY }}>
            Xem lịch theo
          </Text>
          <FlatList
            data={events}
            keyExtractor={(e) => e.name}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            ListHeaderComponent={
              <TouchableOpacity
                onPress={() => {
                  setScopeEventId(SCOPE_TODAY);
                  setScopePickerVisible(false);
                }}
                className="flex-row items-center border-b border-gray-100 py-3">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">Ca họp hôm nay</Text>
                  <Text className="mt-0.5 text-xs text-gray-500">Mọi đợt đang diễn ra hôm nay</Text>
                </View>
                {scopeEventId === SCOPE_TODAY ? (
                  <Ionicons name="checkmark-circle" size={22} color={PRIMARY} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                )}
              </TouchableOpacity>
            }
            renderItem={({ item }) => {
              const active = item.name === scopeEventId;
              return (
                <TouchableOpacity
                  onPress={() => {
                    setScopeEventId(item.name);
                    setScopePickerVisible(false);
                  }}
                  className="flex-row items-center border-b border-gray-100 py-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                      {item.title_vn}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                      {[formatDateShort(item.meeting_date), getEventStatusLabel(item.status)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={22} color={PRIMARY} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </BottomSheetModal>

      {/* Sheet nhập lý do huỷ. ConfirmModal của repo không nhận children nên lý do thu ở sheet,
          rồi vẫn đi qua ConfirmModal — huỷ ca là thao tác không hoàn tác được. */}
      <BottomSheetModal
        visible={!!cancelTarget && !cancelConfirmVisible}
        onClose={closeCancelSheet}
        maxHeightPercent={70}
        keyboardAvoiding>
        <View>
          <View className="items-center pb-2 pt-3">
            <View className="h-1 w-10 rounded-full bg-gray-300" />
          </View>
          <Text className="px-4 pb-1 text-lg font-bold" style={{ color: PRIMARY }}>
            Huỷ ca họp
          </Text>
          {cancelTarget ? (
            <Text className="px-4 pb-3 text-sm text-gray-500">
              {getStudentLabel(cancelTarget)} ·{' '}
              {formatTimeRange(cancelTarget.start_time, cancelTarget.end_time)}
            </Text>
          ) : null}

          <View className="px-4">
            {/* Nói đúng hệ quả: ca do GIÁO VIÊN huỷ không được nhả cho hàng chờ — mời gia đình
                khác vào khung giờ mà giáo viên vắng là hẹn họ tới gặp một cái ghế trống. */}
            <Text className="mb-2 text-xs leading-5 text-gray-500">
              Phụ huynh sẽ nhận thông báo huỷ. Ca này KHÔNG được chuyển cho phụ huynh trong danh
              sách chờ (vì giáo viên vắng) — giáo vụ sẽ sắp xếp lại.
            </Text>
            <Text className="mb-1.5 text-sm font-semibold text-gray-700">
              Lý do huỷ <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Nhập lý do để phụ huynh hiểu vì sao ca bị huỷ…"
              placeholderTextColor="#9CA3AF"
              multiline
              className="mb-4 min-h-[76px] rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base text-gray-900"
              style={{ textAlignVertical: 'top' }}
            />
            <TouchableOpacity
              disabled={!cancelReason.trim()}
              onPress={() => setCancelConfirmVisible(true)}
              className="mb-2 items-center justify-center rounded-2xl py-3.5"
              style={{ backgroundColor: cancelReason.trim() ? '#DC2626' : '#9CA3AF' }}>
              <Text className="text-base font-bold text-white">Huỷ ca họp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={closeCancelSheet}
              className="items-center justify-center rounded-2xl border border-gray-200 py-3.5">
              <Text className="text-base font-semibold text-gray-600">Giữ nguyên ca</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheetModal>

      <ConfirmModal
        visible={cancelConfirmVisible}
        title="Xác nhận huỷ ca"
        message={
          cancelTarget
            ? `Huỷ ca ${formatTimeRange(
                cancelTarget.start_time,
                cancelTarget.end_time
              )} với phụ huynh của ${getStudentLabel(cancelTarget)}?`
            : ''
        }
        onCancel={() => (cancelling ? null : setCancelConfirmVisible(false))}
        onConfirm={handleCancel}
      />
    </View>
  );
}
