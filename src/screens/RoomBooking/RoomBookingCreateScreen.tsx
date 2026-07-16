import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, FlatList, Switch } from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import StandardHeader from '../../components/Common/StandardHeader';
import BottomSheetModal from '../../components/Common/BottomSheetModal';
import DatePickerModal from '../../components/DatePickerModal';
import TimePickerModal from '../../components/TimePickerModal';
import { toast } from '../../utils/toast';
import { getBookableRooms, getRoomBookings, createRoomBooking } from '../../services/roomBookingService';
import {
  createAdminTicket,
  getAllStaffForTicket,
  type AdminTicketStaffOption,
  type AdminRoomBooking,
} from '../../services/administrativeTicketService';
import {
  EVENT_FACILITY_CATEGORY,
  datetimeLocalToMysql,
  dateToDatetimeLocal,
  hasBookingConflict,
} from '../../utils/eventTicketUtils';
import type { BookableRoom, RoomBooking } from '../../types/roomBooking';
import {
  getAvailabilityViolation,
  getOpenHoursLabel,
  combineDateAndTime,
  timeToInputValue,
  getWeekdayName,
  formatDayHeader,
} from './roomBookingUtils';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ScreenRoute = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.ROOM_BOOKING_CREATE>;

const PRIMARY = '#002855';

const pad = (n: number) => String(n).padStart(2, '0');
const toMysql = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
const addMinutesToHHMM = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(':').map((x) => Number(x) || 0);
  let total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

const roomLabel = (r: BookableRoom): string => (r.title_vn || r.short_title || r.name || '').trim();
const buildingLabel = (r: BookableRoom): string =>
  (r.building_title_vn || r.building_title_en || '').trim();

export default function RoomBookingCreateScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const insets = useSafeAreaInsets();

  const [rooms, setRooms] = useState<BookableRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<BookableRoom | null>(null);

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [withService, setWithService] = useState(false);
  const [serviceDescription, setServiceDescription] = useState('');

  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const editedTimesRef = useRef(false);

  const [staff, setStaff] = useState<AdminTicketStaffOption[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [staffSearch, setStaffSearch] = useState('');

  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [roomPickerVisible, setRoomPickerVisible] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);
  const [attendeeVisible, setAttendeeVisible] = useState(false);

  // Tải danh sách phòng + prefill từ route
  useEffect(() => {
    void (async () => {
      const data = await getBookableRooms();
      setRooms(data);
      const preId = route.params?.roomId;
      if (preId) {
        const found = data.find((r) => r.name === preId);
        if (found) setSelectedRoom(found);
      }
    })();
  }, [route.params?.roomId]);

  // Tải danh sách CBGVNV cho người tham dự
  useEffect(() => {
    void (async () => setStaff(await getAllStaffForTicket()))();
  }, []);

  // Khi chọn phòng lần đầu: đặt giờ mặc định theo giờ mở cửa của ngày đang chọn
  useEffect(() => {
    if (!selectedRoom || editedTimesRef.current) return;
    const row = selectedRoom.availability?.find((a) => a.day_of_week === getWeekdayName(date));
    if (row && !row.is_closed) {
      const open = timeToInputValue(row.start_time) || '08:00';
      const close = timeToInputValue(row.end_time) || '18:00';
      const end = addMinutesToHHMM(open, 60);
      setStartTime(open);
      setEndTime(end <= close ? end : close);
    }
  }, [selectedRoom, date]);

  // Tải lịch phòng theo ngày để kiểm tra trùng
  useEffect(() => {
    if (!selectedRoom) {
      setBookings([]);
      return;
    }
    const day0 = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const day1 = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    void getRoomBookings({
      room_id: selectedRoom.name,
      range_start: toMysql(day0),
      range_end: toMysql(day1),
    }).then(setBookings);
  }, [selectedRoom, date]);

  const startDate = useMemo(() => combineDateAndTime(date, startTime), [date, startTime]);
  const endDate = useMemo(() => combineDateAndTime(date, endTime), [date, endTime]);
  const startLocal = useMemo(() => dateToDatetimeLocal(startDate), [startDate]);
  const endLocal = useMemo(() => dateToDatetimeLocal(endDate), [endDate]);

  const timeInvalid = endDate <= startDate;
  const availabilityViolation = useMemo(
    () => getAvailabilityViolation(startDate, endDate, selectedRoom?.availability),
    [startDate, endDate, selectedRoom]
  );
  const conflict = useMemo(
    () =>
      !timeInvalid &&
      hasBookingConflict(startLocal, endLocal, bookings as unknown as AdminRoomBooking[]),
    [timeInvalid, startLocal, endLocal, bookings]
  );

  const openHoursLabel = selectedRoom ? getOpenHoursLabel(date, selectedRoom.availability) : '';

  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        roomLabel(r).toLowerCase().includes(q) ||
        buildingLabel(r).toLowerCase().includes(q) ||
        (r.title_en || '').toLowerCase().includes(q)
    );
  }, [rooms, roomSearch]);

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.department_name || '').toLowerCase().includes(q)
    );
  }, [staff, staffSearch]);

  const selectedStaff = useMemo(
    () => staff.filter((s) => selectedStaffIds.has(s.user_id)),
    [staff, selectedStaffIds]
  );

  const toggleStaff = useCallback((userId: string) => {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const submit = async () => {
    if (title.trim().length < 3) {
      toast.error('Tiêu đề tối thiểu 3 ký tự');
      return;
    }
    if (!selectedRoom) {
      toast.error('Vui lòng chọn phòng');
      return;
    }
    if (timeInvalid) {
      toast.error('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (startDate < startOfToday) {
      toast.error('Không thể đặt phòng cho ngày trong quá khứ');
      return;
    }
    if (availabilityViolation) {
      toast.error(availabilityViolation);
      return;
    }
    if (conflict) {
      toast.error('Khung giờ này đã có người đặt phòng');
      return;
    }
    if (withService && !serviceDescription.trim()) {
      toast.error('Vui lòng nhập mô tả yêu cầu CSVC');
      return;
    }

    const attendees = selectedStaff.map((s) => s.email).filter(Boolean);
    const startMysql = datetimeLocalToMysql(startLocal);
    const endMysql = datetimeLocalToMysql(endLocal);

    setSubmitting(true);
    try {
      if (withService) {
        await createAdminTicket({
          title: title.trim(),
          description: serviceDescription.trim(),
          category: EVENT_FACILITY_CATEGORY,
          is_event_facility: true,
          event_building_id: selectedRoom.building_id,
          event_room_id: selectedRoom.name,
          event_start_time: startMysql,
          event_end_time: endMysql,
          attendees,
        });
        toast.success('Đã đặt phòng & tạo yêu cầu CSVC');
      } else {
        await createRoomBooking({
          title: title.trim(),
          description: purpose.trim() || title.trim(),
          building_id: selectedRoom.building_id,
          room_id: selectedRoom.name,
          start_time: startMysql,
          end_time: endMysql,
          attendees,
        });
        toast.success('Đặt phòng thành công');
      }
      navigation.goBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể đặt phòng');
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = withService ? 'Đặt phòng & tạo yêu cầu CSVC' : 'Đặt phòng';
  const canSubmit = !submitting && !!selectedRoom && !timeInvalid && !availabilityViolation && !conflict;

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
            Đặt phòng
          </Text>
        }
      />

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 96 + insets.bottom }}>
        {/* Tiêu đề */}
        <Text className="mb-1.5 text-sm font-semibold text-gray-700">
          Tiêu đề cuộc họp <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Nhập tiêu đề…"
          placeholderTextColor="#9CA3AF"
          className="mb-4 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base text-gray-900"
        />

        {/* Phòng */}
        <Text className="mb-1.5 text-sm font-semibold text-gray-700">
          Phòng <Text className="text-red-500">*</Text>
        </Text>
        <TouchableOpacity
          onPress={() => setRoomPickerVisible(true)}
          className="mb-4 flex-row items-center rounded-xl border border-gray-200 bg-white px-3.5 py-3">
          <Ionicons name="business-outline" size={20} color={PRIMARY} />
          <View className="ml-2.5 flex-1">
            {selectedRoom ? (
              <>
                <Text className="text-base font-medium text-gray-900" numberOfLines={1}>
                  {roomLabel(selectedRoom)}
                </Text>
                <Text className="text-xs text-gray-500" numberOfLines={1}>
                  {buildingLabel(selectedRoom)}
                </Text>
              </>
            ) : (
              <Text className="text-base text-gray-400">Chọn phòng</Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Thời gian */}
        <Text className="mb-1.5 text-sm font-semibold text-gray-700">
          Thời gian <Text className="text-red-500">*</Text>
        </Text>
        <TouchableOpacity
          onPress={() => setDatePickerVisible(true)}
          className="mb-2 flex-row items-center rounded-xl border border-gray-200 bg-white px-3.5 py-3">
          <Ionicons name="calendar-outline" size={20} color={PRIMARY} />
          <Text className="ml-2.5 flex-1 text-base text-gray-900">{formatDayHeader(date)}</Text>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
        <View className="mb-1.5 flex-row">
          <TouchableOpacity
            onPress={() => setStartPickerVisible(true)}
            className="mr-2 flex-1 flex-row items-center rounded-xl border border-gray-200 bg-white px-3.5 py-3">
            <Ionicons name="time-outline" size={18} color={PRIMARY} />
            <Text className="ml-2 text-base text-gray-900">{startTime}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setEndPickerVisible(true)}
            className="ml-2 flex-1 flex-row items-center rounded-xl border border-gray-200 bg-white px-3.5 py-3">
            <Ionicons name="time-outline" size={18} color={PRIMARY} />
            <Text className="ml-2 text-base text-gray-900">{endTime}</Text>
          </TouchableOpacity>
        </View>
        {openHoursLabel ? (
          <Text className="mb-2 text-xs text-gray-500">Giờ mở cửa: {openHoursLabel}</Text>
        ) : null}
        {timeInvalid ? (
          <Text className="mb-2 text-sm font-semibold text-red-600">
            Giờ kết thúc phải sau giờ bắt đầu.
          </Text>
        ) : availabilityViolation ? (
          <Text className="mb-2 text-sm font-semibold text-red-600">{availabilityViolation}</Text>
        ) : conflict ? (
          <Text className="mb-2 text-sm font-semibold text-red-600">
            Khung giờ đang chọn đã trùng lịch.
          </Text>
        ) : null}
        <View className="mb-4" />

        {/* Người tham dự */}
        <Text className="mb-1.5 text-sm font-semibold text-gray-700">Người tham dự (tuỳ chọn)</Text>
        <TouchableOpacity
          onPress={() => setAttendeeVisible(true)}
          className="mb-2 flex-row items-center rounded-xl border border-gray-200 bg-white px-3.5 py-3">
          <Ionicons name="people-outline" size={20} color={PRIMARY} />
          <Text className="ml-2.5 flex-1 text-base text-gray-900">
            {selectedStaff.length > 0 ? `${selectedStaff.length} người tham dự` : 'Thêm người tham dự'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>
        {selectedStaff.length > 0 ? (
          <View className="mb-4 flex-row flex-wrap">
            {selectedStaff.map((s) => (
              <View
                key={s.user_id}
                className="mb-1.5 mr-1.5 flex-row items-center rounded-full bg-blue-50 py-1 pl-3 pr-1.5">
                <Text className="text-xs text-gray-700">{s.full_name}</Text>
                <TouchableOpacity onPress={() => toggleStaff(s.user_id)} className="ml-1">
                  <Ionicons name="close-circle" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View className="mb-4" />
        )}

        {/* Nội dung / mục đích */}
        <Text className="mb-1.5 text-sm font-semibold text-gray-700">Nội dung / mục đích (tuỳ chọn)</Text>
        <TextInput
          value={purpose}
          onChangeText={setPurpose}
          placeholder="Mô tả ngắn gọn…"
          placeholderTextColor="#9CA3AF"
          multiline
          className="mb-4 min-h-[76px] rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base text-gray-900"
          style={{ textAlignVertical: 'top' }}
        />

        {/* Switch CSVC */}
        <View className="mb-2 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-3">
          <Text className="mr-3 flex-1 text-sm font-medium text-gray-800">
            Kèm yêu cầu CSVC/dịch vụ cho sự kiện
          </Text>
          <Switch
            value={withService}
            onValueChange={setWithService}
            trackColor={{ true: PRIMARY, false: '#D1D5DB' }}
          />
        </View>
        {withService ? (
          <TextInput
            value={serviceDescription}
            onChangeText={setServiceDescription}
            placeholder="Mô tả yêu cầu CSVC…"
            placeholderTextColor="#9CA3AF"
            multiline
            className="mb-4 min-h-[76px] rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base text-gray-900"
            style={{ textAlignVertical: 'top' }}
          />
        ) : null}
      </ScrollView>

      {/* Nút submit */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-gray-100 bg-white px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 10 }}>
        <TouchableOpacity
          disabled={!canSubmit}
          onPress={submit}
          className="items-center justify-center rounded-2xl py-3.5"
          style={{ backgroundColor: canSubmit ? PRIMARY : '#9CA3AF' }}>
          <Text className="text-base font-bold text-white">
            {submitting ? 'Đang xử lý…' : submitLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pickers */}
      <DatePickerModal
        visible={datePickerVisible}
        value={date}
        minimumDate={(() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          return d;
        })()}
        onSelect={(d) => {
          const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
          setDate(nd);
        }}
        onClose={() => setDatePickerVisible(false)}
      />
      <TimePickerModal
        visible={startPickerVisible}
        value={startTime}
        onSelect={(t) => {
          editedTimesRef.current = true;
          setStartTime(timeToInputValue(t));
        }}
        onClose={() => setStartPickerVisible(false)}
      />
      <TimePickerModal
        visible={endPickerVisible}
        value={endTime}
        onSelect={(t) => {
          editedTimesRef.current = true;
          setEndTime(timeToInputValue(t));
        }}
        onClose={() => setEndPickerVisible(false)}
      />

      {/* Sheet chọn phòng */}
      <BottomSheetModal
        visible={roomPickerVisible}
        onClose={() => setRoomPickerVisible(false)}
        maxHeightPercent={80}
        fillHeight>
        <View className="flex-1">
          <View className="items-center pb-2 pt-3">
            <View className="h-1 w-10 rounded-full bg-gray-300" />
          </View>
          <Text className="px-4 pb-2 text-lg font-bold" style={{ color: PRIMARY }}>
            Chọn phòng
          </Text>
          <View className="mx-4 mb-2 flex-row items-center rounded-xl bg-gray-100 px-3 py-2">
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              value={roomSearch}
              onChangeText={setRoomSearch}
              placeholder="Tìm phòng…"
              placeholderTextColor="#9CA3AF"
              className="ml-2 flex-1 text-base text-gray-900"
            />
          </View>
          <FlatList
            data={filteredRooms}
            keyExtractor={(r) => r.name}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            ListEmptyComponent={
              <Text className="py-8 text-center text-gray-400">Không tìm thấy phòng phù hợp</Text>
            }
            renderItem={({ item }) => {
              const active = selectedRoom?.name === item.name;
              return (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedRoom(item);
                    setRoomPickerVisible(false);
                    setRoomSearch('');
                  }}
                  className="flex-row items-center border-b border-gray-100 py-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                      {roomLabel(item)}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                      {[buildingLabel(item), item.capacity ? `${item.capacity} chỗ` : '']
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

      {/* Sheet người tham dự */}
      <BottomSheetModal
        visible={attendeeVisible}
        onClose={() => setAttendeeVisible(false)}
        maxHeightPercent={80}
        fillHeight>
        <View className="flex-1">
          <View className="items-center pb-2 pt-3">
            <View className="h-1 w-10 rounded-full bg-gray-300" />
          </View>
          <View className="flex-row items-center justify-between px-4 pb-2">
            <Text className="text-lg font-bold" style={{ color: PRIMARY }}>
              Người tham dự
            </Text>
            <TouchableOpacity onPress={() => setAttendeeVisible(false)}>
              <Text className="text-base font-semibold" style={{ color: PRIMARY }}>
                Xong
              </Text>
            </TouchableOpacity>
          </View>
          <View className="mx-4 mb-2 flex-row items-center rounded-xl bg-gray-100 px-3 py-2">
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              value={staffSearch}
              onChangeText={setStaffSearch}
              placeholder="Tìm CBGVNV…"
              placeholderTextColor="#9CA3AF"
              className="ml-2 flex-1 text-base text-gray-900"
            />
          </View>
          <FlatList
            data={filteredStaff}
            keyExtractor={(s) => s.user_id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            ListEmptyComponent={
              <Text className="py-8 text-center text-gray-400">Không tìm thấy người phù hợp</Text>
            }
            renderItem={({ item }) => {
              const sel = selectedStaffIds.has(item.user_id);
              return (
                <TouchableOpacity
                  onPress={() => toggleStaff(item.user_id)}
                  className="flex-row items-center border-b border-gray-100 py-3">
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900" numberOfLines={1}>
                      {item.full_name}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                      {[item.department_name, item.email].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons
                    name={sel ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={sel ? PRIMARY : '#D1D5DB'}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </BottomSheetModal>
    </View>
  );
}
