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
import { getBookableRooms, getRoomBookings, cancelRoomBooking } from '../../services/roomBookingService';
import type { BookableRoom, RoomBooking } from '../../types/roomBooking';
import {
  groupBookingsByDay,
  formatTimeRange,
  getOpenHoursLabel,
  getRoomLabel,
  getRoomCode,
  getRoomBuildingLabel,
  matchesRoomQuery,
  getPersonLabel,
} from './roomBookingUtils';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PRIMARY = '#002855';
const SECONDARY = '#F05023';

const pad = (n: number) => String(n).padStart(2, '0');
const toMysql = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;

export default function RoomBookingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [rooms, setRooms] = useState<BookableRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<BookableRoom | null>(null);

  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [cancelTarget, setCancelTarget] = useState<RoomBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    const data = await getBookableRooms();
    setRooms(data);
    setSelectedRoom((prev) => prev ?? data[0] ?? null);
    setLoadingRooms(false);
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const loadBookings = useCallback(async () => {
    if (!selectedRoom) {
      setBookings([]);
      return;
    }
    setLoadingBookings(true);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const rangeEnd = new Date(startOfToday);
    rangeEnd.setDate(rangeEnd.getDate() + 60);
    rangeEnd.setHours(23, 59, 59);
    const data = await getRoomBookings({
      room_id: selectedRoom.name,
      range_start: toMysql(startOfToday),
      range_end: toMysql(rangeEnd),
    });
    setBookings(data);
    setLoadingBookings(false);
  }, [selectedRoom]);

  // Reload mỗi lần focus (vd. sau khi tạo booking mới)
  useFocusEffect(
    useCallback(() => {
      void loadBookings();
    }, [loadBookings])
  );

  const groups = useMemo(() => groupBookingsByDay(bookings), [bookings]);

  const filteredRooms = useMemo(
    () => rooms.filter((r) => matchesRoomQuery(r, search)),
    [rooms, search]
  );

  const canCancel = useCallback(
    (b: RoomBooking): boolean =>
      !!user?.email &&
      !!b.booked_by_email &&
      b.booked_by_email.toLowerCase() === user.email.toLowerCase() &&
      b.source !== 'admin_ticket' &&
      !b.source_ticket &&
      b.status !== 'Cancelled',
    [user?.email]
  );

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelRoomBooking(cancelTarget.name);
      toast.success('Đã huỷ đặt phòng');
      setCancelTarget(null);
      await loadBookings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể huỷ đặt phòng');
    } finally {
      setCancelling(false);
    }
  };

  const openHoursToday = selectedRoom ? getOpenHoursLabel(new Date(), selectedRoom.availability) : '';

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

      {/* Bộ chọn phòng */}
      <TouchableOpacity
        onPress={() => setPickerVisible(true)}
        className="mx-4 mt-3 flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <Ionicons name="business-outline" size={22} color={PRIMARY} />
        <View className="ml-3 flex-1">
          {selectedRoom ? (
            <>
              <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                {getRoomLabel(selectedRoom)}
              </Text>
              <Text className="text-xs text-gray-500" numberOfLines={1}>
                {[
                  getRoomCode(selectedRoom),
                  getRoomBuildingLabel(selectedRoom),
                  openHoursToday ? `Hôm nay: ${openHoursToday}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </>
          ) : (
            <Text className="text-base font-medium text-gray-400">
              {loadingRooms ? 'Đang tải phòng…' : 'Chọn phòng'}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Danh sách lịch đã đặt (sắp theo thời gian, nhóm theo ngày) */}
      {loadingBookings ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : !selectedRoom ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="business-outline" size={48} color="#D1D5DB" />
          <Text className="mt-3 text-center text-base text-gray-400">
            {loadingRooms ? 'Đang tải danh sách phòng…' : 'Chưa có phòng nào mở đặt'}
          </Text>
        </View>
      ) : groups.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="calendar-clear-outline" size={48} color="#D1D5DB" />
          <Text className="mt-3 text-center text-base text-gray-400">
            Chưa có lịch — phòng đang trống
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 96 + insets.bottom }}>
          {groups.map((group) => (
            <View key={group.key} className="mb-4">
              <Text className="mb-2 text-sm font-bold uppercase" style={{ color: PRIMARY }}>
                {group.label}
              </Text>
              {group.items.map((b) => {
                const owned = canCancel(b);
                return (
                  <View
                    key={b.name}
                    className="mb-2 flex-row items-center rounded-xl border border-gray-100 bg-white px-3.5 py-3">
                    <View className="mr-3 items-center">
                      <Text className="text-sm font-bold" style={{ color: SECONDARY }}>
                        {formatTimeRange(b.event_start_time, b.event_end_time)}
                      </Text>
                    </View>
                    <View className="flex-1 border-l border-gray-100 pl-3">
                      <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
                        {b.title || '(Không tiêu đề)'}
                      </Text>
                      <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                        {[
                          getPersonLabel({ full_name: b.booked_by, email: b.booked_by_email }),
                          b.booked_by_department,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        {b.source_ticket ? '  ·  Gắn ticket' : ''}
                      </Text>
                    </View>
                    {owned ? (
                      <TouchableOpacity
                        onPress={() => setCancelTarget(b)}
                        className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-red-50">
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Nút Đặt phòng */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-gray-100 bg-white px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 10 }}>
        <TouchableOpacity
          disabled={!selectedRoom}
          onPress={() =>
            selectedRoom &&
            navigation.navigate(ROUTES.SCREENS.ROOM_BOOKING_CREATE, {
              roomId: selectedRoom.name,
              buildingId: selectedRoom.building_id,
            })
          }
          className="flex-row items-center justify-center rounded-2xl py-3.5"
          style={{ backgroundColor: selectedRoom ? PRIMARY : '#9CA3AF' }}>
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text className="ml-2 text-base font-bold text-white">Đặt phòng</Text>
        </TouchableOpacity>
      </View>

      {/* Sheet chọn phòng */}
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
            Chọn phòng
          </Text>
          <View className="mx-4 mb-2 flex-row items-center rounded-xl bg-gray-100 px-3 py-2">
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
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
                    setPickerVisible(false);
                    setSearch('');
                  }}
                  className="flex-row items-center border-b border-gray-100 py-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                      {getRoomLabel(item)}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                      {[
                        getRoomCode(item),
                        getRoomBuildingLabel(item),
                        item.capacity ? `${item.capacity} chỗ` : '',
                      ]
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
        visible={!!cancelTarget}
        title="Huỷ đặt phòng"
        message={
          cancelTarget
            ? `Huỷ lịch "${cancelTarget.title}" (${formatTimeRange(
                cancelTarget.event_start_time,
                cancelTarget.event_end_time
              )})?`
            : ''
        }
        onCancel={() => (cancelling ? null : setCancelTarget(null))}
        onConfirm={handleCancel}
      />
    </View>
  );
}
