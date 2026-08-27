import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import StandardHeader from '../../components/Common/StandardHeader';
import BottomSheetModal from '../../components/Common/BottomSheetModal';
import ConfirmModal from '../../components/ConfirmModal';
import { toast } from '../../utils/toast';
import { getEvents, getWaitlistReport, publishSchedule } from '../../services/parentMeetingService';
import type { PTMeetingEventListItem, PTWaitlistEntry } from '../../types/parentMeeting';
import {
  canPublishParentMeetingSchedule,
  canViewParentMeetingAdmin,
  formatDateShort,
  formatDateTimeShort,
  formatTimeRange,
  getEventStatusLabel,
  getTeacherGroupLabel,
} from './parentMeetingUtils';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PRIMARY = '#002855';
const SECONDARY = '#F05023';

export default function ParentMeetingAdminScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const roles: string[] = Array.isArray(user?.roles) ? (user?.roles as string[]) : [];
  /**
   * Hai cờ TÁCH RỜI, không suy ra được từ nhau: BGH đọc được mọi thứ nhưng KHÔNG được xuất bản,
   * còn giáo vụ thì ngược lại — vừa đọc vừa là người duy nhất bấm được nút. Gộp làm một cờ là
   * cách cũ đã sai theo cả hai chiều: nút hiện cho đúng nhóm bị backend từ chối, còn người có
   * quyền thật thì không vào nổi màn hình.
   */
  const canViewAdmin = canViewParentMeetingAdmin(roles);
  const canPublish = canPublishParentMeetingSchedule(roles);

  const [events, setEvents] = useState<PTMeetingEventListItem[]>([]);
  const [eventId, setEventId] = useState('');
  const [waitlist, setWaitlist] = useState<PTWaitlistEntry[]>([]);
  /**
   * Lỗi đọc hàng chờ phải là một TRẠNG THÁI RIÊNG, không được quy về mảng rỗng.
   * Mảng rỗng ở màn này được hiển thị thành câu khẳng định "Không có phụ huynh
   * nào phải chờ" — đúng thứ Ban Giám hiệu dựa vào để quyết định thôi đôn đốc.
   * Gộp lỗi vào rỗng nghĩa là một lần 403 sẽ nói dối họ mà không để lại dấu vết.
   */
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [publishConfirmVisible, setPublishConfirmVisible] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!canViewAdmin) {
      setLoadingEvents(false);
      return;
    }
    setLoadingEvents(true);
    const data = await getEvents({ page_size: 25 });
    setEvents(data);
    // Chọn sẵn đợt đầu danh sách (server trả mới nhất trước) để BGH/giáo vụ mở ra là thấy số liệu ngay
    setEventId((prev) => prev || data[0]?.name || '');
    setLoadingEvents(false);
  }, [canViewAdmin]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const loadWaitlist = useCallback(async () => {
    if (!eventId) {
      setWaitlist([]);
      setWaitlistError(null);
      return;
    }
    setLoadingWaitlist(true);
    try {
      setWaitlist(await getWaitlistReport(eventId));
      setWaitlistError(null);
    } catch (e) {
      // Xoá luôn dữ liệu cũ: giữ lại hàng chờ của đợt trước rồi treo cạnh tên đợt
      // mới còn khó hiểu hơn là nói thẳng "không đọc được".
      setWaitlist([]);
      setWaitlistError(e instanceof Error ? e.message : 'Không đọc được danh sách chờ');
    } finally {
      setLoadingWaitlist(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadWaitlist();
  }, [loadWaitlist]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.name === eventId) ?? null,
    [events, eventId]
  );

  /**
   * Hàng chờ đếm theo NGUYỆN VỌNG (mỗi dòng là một target), nhưng một phụ huynh có thể chờ
   * nhiều giáo viên. Hiện cả hai con số vì chúng trả lời hai câu hỏi khác nhau: "còn bao nhiêu
   * cuộc gặp chưa xếp được" và "phải gọi lại bao nhiêu gia đình".
   */
  const waitingFamilies = useMemo(
    () => new Set(waitlist.map((w) => w.registration_id)).size,
    [waitlist]
  );

  /**
   * Đợt đã xếp lịch nhưng chưa gửi cho phụ huynh. Đây là TRẠNG THÁI của đợt, không phải quyền:
   * BGH cũng cần biết lịch còn ở dạng nháp để không tưởng đã xong việc, nên cảnh báo nháp bám
   * theo cờ này, còn nút bấm thì phải nhân thêm quyền ghi (`showPublishAction`).
   */
  const isDraftSchedule = selectedEvent?.status === 'Scheduled';
  const showPublishAction = isDraftSchedule && canPublish;

  const handlePublish = async () => {
    // Chốt lại quyền ngay trước lệnh ghi: nút có thể bị mở nhầm do một đường render khác,
    // nhưng lệnh gửi thông báo cho toàn bộ phụ huynh thì không có đường lùi.
    if (!eventId || !canPublish) return;
    setPublishing(true);
    try {
      const result = await publishSchedule(eventId);
      toast.success(
        `Đã xuất bản lịch — ${result.notified_scheduled} phụ huynh nhận lịch, ${result.notified_waitlisted} phụ huynh nhận thông báo chờ`
      );
      setPublishConfirmVisible(false);
      await loadEvents();
      await loadWaitlist();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể xuất bản lịch');
    } finally {
      setPublishing(false);
    }
  };

  const renderWaitlistItem = (item: PTWaitlistEntry) => (
    <View key={item.target_row_id} className="mb-2 rounded-xl border border-gray-100 bg-white px-3.5 py-3">
      <View className="flex-row items-start">
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
            {item.student_name || 'Không rõ học sinh'}
          </Text>
          <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
            {[
              item.class_title,
              item.student_code,
              item.teacher_name,
              getTeacherGroupLabel(item.teacher_group, item.teacher_group_label_vn),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {item.submitted_at ? (
          <Text className="ml-2 text-[11px] text-gray-400">
            {formatDateTimeShort(item.submitted_at)}
          </Text>
        ) : null}
      </View>

      {item.need_interpreter === 1 ? (
        <View className="mt-1.5 flex-row items-center self-start rounded-full bg-amber-50 px-2 py-0.5">
          <Ionicons name="language-outline" size={13} color="#B45309" />
          <Text className="ml-1 text-[11px] font-semibold" style={{ color: '#B45309' }}>
            Cần phiên dịch
          </Text>
        </View>
      ) : null}

      {item.note ? <Text className="mt-2 text-xs text-gray-500">Ghi chú: {item.note}</Text> : null}
    </View>
  );

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
            Đợt họp phụ huynh
          </Text>
        }
      />

      {/* Ẩn UI chỉ để đỡ khó hiểu; quyền thật do backend chặn (`_can_write` trên SIS PT Meeting Event) */}
      {!canViewAdmin ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="lock-closed-outline" size={48} color="#D1D5DB" />
          <Text className="mt-3 text-center text-base text-gray-400">
            Mục này dành cho Ban Giám hiệu và Giáo vụ
          </Text>
        </View>
      ) : loadingEvents ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : events.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="calendar-clear-outline" size={48} color="#D1D5DB" />
          <Text className="mt-3 text-center text-base text-gray-400">
            Chưa có đợt họp phụ huynh nào
          </Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            onPress={() => setPickerVisible(true)}
            className="mx-4 mt-3 flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <Ionicons name="calendar-outline" size={22} color={PRIMARY} />
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                {selectedEvent?.title_vn || 'Chọn đợt họp'}
              </Text>
              <Text className="text-xs text-gray-500" numberOfLines={1}>
                {[
                  formatDateShort(selectedEvent?.meeting_date),
                  getEventStatusLabel(selectedEvent?.status),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {!selectedEvent ? (
            <View className="flex-1 items-center justify-center px-8">
              <Ionicons name="information-circle-outline" size={48} color="#D1D5DB" />
              <Text className="mt-3 text-center text-base text-gray-400">
                Chọn một đợt họp để xem tổng hợp
              </Text>
            </View>
          ) : (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                padding: 16,
                paddingBottom: (showPublishAction ? 96 : 24) + insets.bottom,
              }}>
              {/* Tổng hợp đợt họp */}
              <View className="mb-4 rounded-xl border border-gray-100 bg-white px-3.5 py-3">
                <Text className="text-sm font-bold" style={{ color: SECONDARY }}>
                  {[
                    formatDateShort(selectedEvent.meeting_date),
                    formatTimeRange(selectedEvent.start_time, selectedEvent.end_time),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Text className="mt-1 text-base font-semibold text-gray-900">
                  {selectedEvent.title_vn}
                </Text>
                <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
                  {[
                    selectedEvent.location,
                    selectedEvent.slot_duration ? `${selectedEvent.slot_duration} phút/ca` : '',
                    getEventStatusLabel(selectedEvent.status),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>

                <View className="mt-3 flex-row flex-wrap">
                  {[
                    { label: 'Đơn đăng ký', value: selectedEvent.registration_count },
                    { label: 'Ca đã xếp', value: selectedEvent.booked_count },
                    { label: 'Tổng số ca', value: selectedEvent.slot_count },
                    { label: 'Lớp áp dụng', value: selectedEvent.class_count },
                    { label: 'Giáo viên', value: selectedEvent.teacher_count },
                    // Không đọc được hàng chờ thì hiện gạch ngang, KHÔNG hiện 0: số 0 nằm
                    // cạnh các ô khác trông y hệt một số liệu thật và đọc ra kết luận ngược.
                    {
                      label: 'Nguyện vọng chờ',
                      value: waitlistError ? '—' : (waitlist.length as number | string),
                    },
                  ].map((s) => (
                    <View key={s.label} className="mb-2 w-1/3 pr-2">
                      <Text className="text-xl font-bold" style={{ color: PRIMARY }}>
                        {s.value}
                      </Text>
                      <Text className="text-[11px] text-gray-500">{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Lịch nháp: phải nói rõ phụ huynh CHƯA thấy gì, nếu không BGH tưởng đã xong việc.
                  Câu cuối đổi theo quyền — bảo BGH "bấm Xuất bản" là chỉ vào một nút họ không có. */}
              {isDraftSchedule ? (
                <View className="mb-4 flex-row rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                  <Ionicons name="eye-off-outline" size={18} color="#B45309" />
                  <Text className="ml-2 flex-1 text-xs leading-5" style={{ color: '#92400E' }}>
                    Lịch đang ở dạng NHÁP — phụ huynh chưa nhìn thấy gì. Sau khi giáo vụ / GVCN /
                    khối trưởng review xong,{' '}
                    {canPublish
                      ? 'bấm "Xuất bản lịch" để gửi lịch cho phụ huynh.'
                      : 'giáo vụ sẽ xuất bản để gửi lịch cho phụ huynh.'}
                  </Text>
                </View>
              ) : null}

              {/* Danh sách chờ */}
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-sm font-bold uppercase" style={{ color: PRIMARY }}>
                  Danh sách chờ
                </Text>
                <Text className="text-xs text-gray-500">
                  {waitlistError
                    ? 'Chưa đọc được'
                    : `${waitlist.length} nguyện vọng · ${waitingFamilies} phụ huynh`}
                </Text>
              </View>
              <Text className="mb-3 text-xs leading-5 text-gray-500">
                Đây là các nguyện vọng hết slot khi xếp lịch, xếp theo đúng thứ tự nộp đơn. GVCN
                cần liên hệ lại để thống nhất hình thức họp khác; khi có ca phụ huynh huỷ, hệ
                thống tự gán lại theo đúng thứ tự này.
              </Text>

              {loadingWaitlist ? (
                <View className="items-center rounded-xl border border-gray-100 bg-white px-4 py-8">
                  <ActivityIndicator color={PRIMARY} />
                </View>
              ) : waitlistError ? (
                /* Hiện lỗi + nút thử lại thay vì im lặng: nếu đây là 403 do thiếu role thì
                   người dùng còn biết đường báo IT, còn nếu là lỗi mạng thì bấm lại là xong. */
                <View className="items-center rounded-xl border border-red-100 bg-red-50 px-4 py-6">
                  <Ionicons name="alert-circle-outline" size={36} color="#B91C1C" />
                  <Text className="mt-2 text-center text-sm font-semibold" style={{ color: '#B91C1C' }}>
                    Không đọc được danh sách chờ
                  </Text>
                  <Text className="mt-1 text-center text-xs" style={{ color: '#991B1B' }}>
                    {waitlistError}
                  </Text>
                  <TouchableOpacity
                    onPress={() => void loadWaitlist()}
                    className="mt-3 rounded-full border border-red-200 bg-white px-4 py-2">
                    <Text className="text-xs font-semibold" style={{ color: '#B91C1C' }}>
                      Thử lại
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : waitlist.length === 0 ? (
                <View className="items-center rounded-xl border border-gray-100 bg-white px-4 py-8">
                  <Ionicons name="checkmark-circle-outline" size={40} color="#D1D5DB" />
                  <Text className="mt-2 text-center text-sm text-gray-400">
                    Không có phụ huynh nào phải chờ
                  </Text>
                </View>
              ) : (
                waitlist.map(renderWaitlistItem)
              )}
            </ScrollView>
          )}

          {showPublishAction ? (
            <View
              className="absolute inset-x-0 bottom-0 border-t border-gray-100 bg-white px-4 pt-3"
              style={{ paddingBottom: insets.bottom + 10 }}>
              <TouchableOpacity
                disabled={publishing}
                onPress={() => setPublishConfirmVisible(true)}
                className="flex-row items-center justify-center rounded-2xl py-3.5"
                style={{ backgroundColor: publishing ? '#9CA3AF' : PRIMARY }}>
                <Ionicons name="send-outline" size={18} color="#FFFFFF" />
                <Text className="ml-2 text-base font-bold text-white">
                  {publishing ? 'Đang xuất bản…' : 'Xuất bản lịch'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}

      <BottomSheetModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        maxHeightPercent={80}
        fillHeight>
        <View className="flex-1">
          <View className="items-center pb-2 pt-3">
            <View className="h-1 w-10 rounded-full bg-gray-300" />
          </View>
          <Text className="px-4 pb-2 text-lg font-bold" style={{ color: PRIMARY }}>
            Chọn đợt họp
          </Text>
          <FlatList
            data={events}
            keyExtractor={(e) => e.name}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            ListEmptyComponent={
              <Text className="py-8 text-center text-gray-400">Chưa có đợt họp nào</Text>
            }
            renderItem={({ item }) => {
              const active = item.name === eventId;
              return (
                <TouchableOpacity
                  onPress={() => {
                    setEventId(item.name);
                    setPickerVisible(false);
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

      <ConfirmModal
        visible={publishConfirmVisible}
        title="Xuất bản lịch họp"
        message={
          selectedEvent
            ? `Gửi lịch của đợt "${selectedEvent.title_vn}" tới toàn bộ phụ huynh đã đăng ký? Thông báo đã gửi thì không rút lại được.`
            : ''
        }
        onCancel={() => (publishing ? null : setPublishConfirmVisible(false))}
        onConfirm={handlePublish}
      />
    </View>
  );
}
