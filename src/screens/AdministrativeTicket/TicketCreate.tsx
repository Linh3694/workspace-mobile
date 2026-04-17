import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  FlatList,
  Dimensions,
} from 'react-native';
import BottomSheetModal from '../../components/Common/BottomSheetModal';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import { normalizeCampusIdForBackend } from '../../utils/campusIdUtils';
import {
  EVENT_FACILITY_CATEGORY,
  getBuildingLabelForAreaTitle,
  datetimeLocalToMysql,
  dateToDatetimeLocal,
} from '../../utils/eventTicketUtils';
import { ADMIN_TICKET_MAX_IMAGES_UPLOAD } from '../../config/administrativeTicketConstants';
import { isAxiosError } from 'axios';
import {
  getAdminTicketCategories,
  createAdminTicket,
  uploadAdminTicketAttachment,
  parseFrappeApiError,
  getRoomsByBuilding,
  getRoomEquipmentForTicket,
  getStudentsByRoom,
  type AdminTicketCategory,
  type AdminEventRoomOption,
  type AdminTicketEquipmentLine,
  type AdminTicketStudentOption,
} from '../../services/administrativeTicketService';
import { getAllBuildings, type Building } from '../../services/buildingService';
import { getAllAdministrativeAssignments, type AdministrativeSupportAssignment } from '../../services/administrativeSupportService';

interface ImageItem {
  uri: string;
  type?: string;
  name?: string;
}

const ProgressIndicator = ({ step }: { step: number }) => {
  return (
    <View className="my-6 flex-row items-center justify-center">
      <View className="flex-row items-center">
        <View className="flex h-8 w-8 items-center justify-center rounded-full">
          {step === 1 ? (
            <FontAwesome name="dot-circle-o" size={24} color="#FF5733" />
          ) : step > 1 ? (
            <FontAwesome name="check-circle" size={24} color="#FF5733" />
          ) : (
            <FontAwesome name="circle-o" size={24} color="#FF5733" />
          )}
        </View>
        <View className={`h-0.5 w-12 ${step > 1 ? 'bg-[#FF5733]' : 'bg-gray-300'}`} />
      </View>
      <View className="flex-row items-center">
        <View className="flex h-8 w-8 items-center justify-center rounded-full">
          {step === 2 ? (
            <FontAwesome name="dot-circle-o" size={24} color="#FF5733" />
          ) : step > 2 ? (
            <FontAwesome name="check-circle" size={24} color="#FF5733" />
          ) : (
            <FontAwesome name="circle-o" size={24} color="#FF5733" />
          )}
        </View>
        <View className={`h-0.5 w-12 ${step > 2 ? 'bg-[#FF5733]' : 'bg-gray-300'}`} />
      </View>
      <View className="flex-row items-center">
        <View className="flex h-8 w-8 items-center justify-center rounded-full">
          {step === 3 ? (
            <FontAwesome name="dot-circle-o" size={24} color="#FF5733" />
          ) : step > 3 ? (
            <FontAwesome name="check-circle" size={24} color="#FF5733" />
          ) : (
            <FontAwesome name="circle-o" size={24} color="#FF5733" />
          )}
        </View>
      </View>
    </View>
  );
};

type PickerKey =
  | 'area'
  | 'eventBuilding'
  | 'eventRoom'
  | 'room'
  | 'equipment'
  | 'students'
  | null;

/** Chuẩn hóa chuỗi để tìm không phân biệt dấu (tiếng Việt) */
function normalizeSearchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** Lọc dòng picker theo label + value */
function rowMatchesPickerSearch(query: string, label: string, value = ''): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return normalizeSearchText(`${label} ${value}`).includes(q);
}

/** Lọc học sinh theo tên hoặc mã */
function studentMatchesSearch(query: string, item: AdminTicketStudentOption): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return (
    normalizeSearchText(item.student_name).includes(q) ||
    normalizeSearchText(item.student_code || '').includes(q)
  );
}

const TicketCreate = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState('');
  const [ticketCreatedId, setTicketCreatedId] = useState('');
  const [categories, setCategories] = useState<AdminTicketCategory[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [assignments, setAssignments] = useState<AdministrativeSupportAssignment[]>([]);
  const [eventRooms, setEventRooms] = useState<AdminEventRoomOption[]>([]);
  const [nonEventRooms, setNonEventRooms] = useState<AdminEventRoomOption[]>([]);
  const [ticketEquipment, setTicketEquipment] = useState<AdminTicketEquipmentLine[]>([]);
  const [ticketStudents, setTicketStudents] = useState<AdminTicketStudentOption[]>([]);
  const [loadingRoomDeps, setLoadingRoomDeps] = useState(false);

  const [picker, setPicker] = useState<PickerKey>(null);
  /** Ô tìm trong sheet chọn khu vực / tòa / phòng / thiết bị / học sinh */
  const [pickerSheetQuery, setPickerSheetQuery] = useState('');
  const [datetimeTarget, setDatetimeTarget] = useState<'start' | 'end' | null>(null);
  /** Sheet chọn ảnh đính kèm (thay react-native-actions-sheet) */
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);

  const [ticketData, setTicketData] = useState({
    title: '',
    category: '',
    description: '',
    images: [] as ImageItem[],
    notes: '',
    priority: 'Medium',
    area_title: '',
    event_building_id: '',
    event_room_id: '',
    event_start_local: '',
    event_end_local: '',
    room_id: '',
    related_equipment_id: '',
    related_student_ids: [] as string[],
  });

  const insets = useSafeAreaInsets();

  const isEventCategory = ticketData.category === EVENT_FACILITY_CATEGORY;

  const effectiveRoomId = useMemo(() => {
    if (isEventCategory) return ticketData.event_room_id.trim();
    return ticketData.room_id.trim();
  }, [isEventCategory, ticketData.event_room_id, ticketData.room_id]);

  const areaOptions = useMemo(() => {
    if (!ticketData.category || isEventCategory) return [];
    const rows = assignments.filter((a) => a.support_category === ticketData.category);
    const ids = [...new Set(rows.map((a) => (a.area_title || '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    return ids.map((id) => ({
      value: id,
      label: getBuildingLabelForAreaTitle(id, buildings),
    }));
  }, [ticketData.category, assignments, buildings, isEventCategory]);

  const buildingItems = useMemo(
    () =>
      buildings.map((b) => ({
        value: b.name,
        label: b.title_vn || b.name,
      })),
    [buildings]
  );

  const equipmentItems = useMemo(
    () =>
      ticketEquipment.map((eq) => ({
        value: eq.name,
        label: `${eq.category_title || 'Thiết bị'} (×${eq.quantity ?? 0})`,
      })),
    [ticketEquipment]
  );

  /** Danh sách HS trong sheet chọn (đồng bộ index viền dưới từng dòng) */
  const filteredStudentPickerRows = useMemo(() => {
    if (picker !== 'students') return [];
    return ticketStudents.filter((s) => studentMatchesSearch(pickerSheetQuery, s));
  }, [picker, ticketStudents, pickerSheetQuery]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    setPickerSheetQuery('');
  }, [picker]);

  useEffect(() => {
    const run = async () => {
      try {
        const [storedUserName, cats, bld, asn] = await Promise.all([
          AsyncStorage.getItem('userFullname'),
          getAdminTicketCategories(),
          getAllBuildings(),
          getAllAdministrativeAssignments(),
        ]);
        setUserName(normalizeVietnameseName(storedUserName || 'WISer'));
        setCategories(cats);
        setBuildings(bld);
        setAssignments(asn);
      } catch (e) {
        console.error('TicketCreate bootstrap', e);
      } finally {
        setBootLoading(false);
      }
    };
    run();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadEventRooms = async () => {
      if (!isEventCategory || !ticketData.event_building_id.trim()) {
        setEventRooms([]);
        return;
      }
      const rooms = await getRoomsByBuilding(ticketData.event_building_id.trim());
      if (!cancelled) setEventRooms(rooms);
    };
    loadEventRooms();
    return () => {
      cancelled = true;
    };
  }, [isEventCategory, ticketData.event_building_id]);

  useEffect(() => {
    let cancelled = false;
    const loadNonEvent = async () => {
      if (isEventCategory || !ticketData.area_title.trim()) {
        setNonEventRooms([]);
        return;
      }
      const rooms = await getRoomsByBuilding(ticketData.area_title.trim());
      if (!cancelled) setNonEventRooms(rooms);
    };
    loadNonEvent();
    return () => {
      cancelled = true;
    };
  }, [isEventCategory, ticketData.area_title]);

  useEffect(() => {
    let cancelled = false;
    const loadDeps = async () => {
      if (!effectiveRoomId) {
        setTicketEquipment([]);
        setTicketStudents([]);
        return;
      }
      setLoadingRoomDeps(true);
      try {
        const campusRaw = await AsyncStorage.getItem('currentCampusId');
        const campus_id = campusRaw ? normalizeCampusIdForBackend(campusRaw) : undefined;
        const [eq, st] = await Promise.all([
          getRoomEquipmentForTicket(effectiveRoomId),
          getStudentsByRoom(effectiveRoomId, campus_id ? { campus_id } : undefined),
        ]);
        if (!cancelled) {
          setTicketEquipment(eq);
          setTicketStudents(st);
        }
      } catch (e) {
        console.error('load room deps', e);
      } finally {
        if (!cancelled) setLoadingRoomDeps(false);
      }
    };
    loadDeps();
    return () => {
      cancelled = true;
    };
  }, [effectiveRoomId]);

  const handleGoBack = () => {
    if (step === 1) {
      navigation.goBack();
    } else {
      setStep(step - 1);
    }
  };

  const validateStep2 = (): boolean => {
    if (!ticketData.title.trim() || ticketData.title.trim().length < 5) {
      Alert.alert('Thông báo', 'Tiêu đề phải có ít nhất 5 ký tự');
      return false;
    }
    if (!ticketData.description.trim() || ticketData.description.trim().length < 10) {
      Alert.alert('Thông báo', 'Mô tả chi tiết phải có ít nhất 10 ký tự');
      return false;
    }
    if (isEventCategory) {
      if (!ticketData.event_building_id.trim()) {
        Alert.alert('Thông báo', 'Vui lòng chọn tòa nhà');
        return false;
      }
      if (!ticketData.event_room_id.trim()) {
        Alert.alert('Thông báo', 'Vui lòng chọn phòng sự kiện');
        return false;
      }
      if (!ticketData.event_start_local) {
        Alert.alert('Thông báo', 'Chọn thời gian bắt đầu sự kiện');
        return false;
      }
      if (!ticketData.event_end_local) {
        Alert.alert('Thông báo', 'Chọn thời gian kết thúc sự kiện');
        return false;
      }
      if (new Date(ticketData.event_end_local) <= new Date(ticketData.event_start_local)) {
        Alert.alert('Thông báo', 'Thời gian kết thúc phải sau thời gian bắt đầu');
        return false;
      }
    } else {
      if (!ticketData.area_title.trim()) {
        Alert.alert('Thông báo', 'Chọn khu vực (tòa) theo phân công');
        return false;
      }
      if (!ticketData.room_id.trim()) {
        Alert.alert('Thông báo', 'Chọn phòng');
        return false;
      }
    }
    return true;
  };

  const handleContinue = () => {
    if (step === 1 && !ticketData.category) {
      Alert.alert('Thông báo', 'Vui lòng chọn hạng mục');
      return;
    }
    if (step === 2 && !validateStep2()) return;
    if (step === 3) {
      submitTicket();
    } else {
      setStep(step + 1);
    }
  };

  const submitTicket = async () => {
    try {
      setLoading(true);

      let attachmentUrl: string | undefined;
      if (ticketData.images.length > 0) {
        const img = ticketData.images[0];
        const uriParts = img.uri.split('/');
        const fileName = uriParts[uriParts.length - 1] || 'attach.jpg';
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        attachmentUrl = await uploadAdminTicketAttachment(img.uri, fileName, mime);
        if (ticketData.images.length > 1) {
          console.warn('[TicketCreate] Chỉ gửi file đầu tiên làm attachment ticket HC');
        }
      }

      const areaForPic = isEventCategory
        ? ticketData.event_building_id.trim()
        : ticketData.area_title.trim();

      const relatedPayload = {
        related_equipment_id: ticketData.related_equipment_id.trim() || undefined,
        related_student_ids:
          ticketData.related_student_ids.length > 0 ? ticketData.related_student_ids : undefined,
      };

      const created = await createAdminTicket({
        title: ticketData.title.trim(),
        description: ticketData.description.trim(),
        category: ticketData.category,
        notes: ticketData.notes.trim(),
        area_title: areaForPic,
        priority: ticketData.priority || 'Medium',
        attachment: attachmentUrl,
        is_event_facility: isEventCategory,
        event_building_id: isEventCategory ? ticketData.event_building_id.trim() : undefined,
        event_room_id: isEventCategory ? ticketData.event_room_id.trim() : undefined,
        event_start_time: isEventCategory ? datetimeLocalToMysql(ticketData.event_start_local) : undefined,
        event_end_time: isEventCategory ? datetimeLocalToMysql(ticketData.event_end_local) : undefined,
        room_id: !isEventCategory ? ticketData.room_id.trim() : undefined,
        ...relatedPayload,
      });

      if (created?.ticketCode) {
        setTicketCreatedId(created.ticketCode);
        setStep(5);
      } else {
        Alert.alert('Thông báo', 'Đã tạo nhưng không nhận được mã ticket');
      }
    } catch (error: unknown) {
      let msg = 'Không thể tạo ticket';
      if (isAxiosError(error) && error.response?.data) {
        msg = parseFrappeApiError(error.response.data);
      } else if (error instanceof Error) {
        msg = error.message;
      }
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  };

  const openDatetime = (target: 'start' | 'end') => {
    setDatetimeTarget(target);
  };

  // Chọn ngày giờ sự kiện (Android: dialog hệ thống; iOS: spinner trong modal)
  const onDatetimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      setDatetimeTarget(null);
      return;
    }
    if (date && datetimeTarget) {
      const key = datetimeTarget === 'start' ? 'event_start_local' : 'event_end_local';
      setTicketData((p) => ({ ...p, [key]: dateToDatetimeLocal(date) }));
      if (Platform.OS === 'android') {
        setDatetimeTarget(null);
      }
    }
  };

  const toggleStudent = useCallback((id: string) => {
    setTicketData((prev) => {
      const has = prev.related_student_ids.includes(id);
      return {
        ...prev,
        related_student_ids: has
          ? prev.related_student_ids.filter((x) => x !== id)
          : [...prev.related_student_ids, id],
      };
    });
  }, []);

  const pickFromCamera = async () => {
    try {
      setLoading(true);
      setAttachmentSheetVisible(false);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Không có quyền truy cập camera');
        setLoading(false);
        return;
      }
      if (ticketData.images.length >= ADMIN_TICKET_MAX_IMAGES_UPLOAD) {
        Alert.alert('Thông báo', `Tối đa ${ADMIN_TICKET_MAX_IMAGES_UPLOAD} ảnh`);
        setLoading(false);
        return;
      }
      setTimeout(async () => {
        try {
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
          if (!result.canceled && result.assets?.[0]) {
            setTicketData((prev) => ({
              ...prev,
              images: [...prev.images, { uri: result.assets![0].uri }],
            }));
          }
        } finally {
          setLoading(false);
        }
      }, 400);
    } catch {
      setLoading(false);
    }
  };

  const pickFromLibrary = async () => {
    try {
      setLoading(true);
      setAttachmentSheetVisible(false);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Không có quyền truy cập thư viện ảnh');
        setLoading(false);
        return;
      }
      setTimeout(async () => {
        try {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.5,
            selectionLimit: ADMIN_TICKET_MAX_IMAGES_UPLOAD,
          });
          if (!result.canceled && result.assets?.length) {
            const remaining = ADMIN_TICKET_MAX_IMAGES_UPLOAD - ticketData.images.length;
            const newImages = result.assets.slice(0, Math.max(0, remaining)).map((a) => ({ uri: a.uri }));
            setTicketData((prev) => ({ ...prev, images: [...prev.images, ...newImages] }));
          }
        } finally {
          setLoading(false);
        }
      }, 400);
    } catch {
      setLoading(false);
    }
  };

  const renderStepOne = () => (
    <View className="flex-1 items-center justify-center">
      <Text className="mb-2 w-[80%] text-center font-bold text-xl text-gray-800">
        Xin chào WISer <Text className="text-[#FF5733]">{userName}</Text>, tạo yêu cầu{' '}
        <Text className="font-bold text-[#002147]">Hành chính / CSVC</Text>
      </Text>
      <View className="my-10 w-full px-4">
        <Text className="mb-4 text-center font-semibold text-base text-[#002147]">
          Chọn hạng mục <Text className="text-red-500">*</Text>
        </Text>
        <View className="space-y-3">
          {categories.map((category) => (
            <TouchableOpacity
              key={category.value}
              className={`mb-2 rounded-xl border-2 p-4 ${
                ticketData.category === category.value
                  ? 'border-[#FF5733] bg-[#FFF5F3]'
                  : 'border-gray-200 bg-white'
              }`}
              onPress={() =>
                setTicketData((prev) => ({
                  ...prev,
                  category: category.value,
                  area_title: '',
                  room_id: '',
                  event_building_id: '',
                  event_room_id: '',
                  related_equipment_id: '',
                  related_student_ids: [],
                }))
              }>
              <Text
                className={`font-medium text-base ${
                  ticketData.category === category.value ? 'text-[#FF5733]' : 'text-gray-800'
                }`}>
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const listMaxH = Dimensions.get('window').height * 0.46;

  const renderPickerModal = (
    title: string,
    visible: boolean,
    data: { value: string; label: string }[],
    onSelect: (v: string) => void,
    onClose: () => void
  ) => {
    const filtered = data.filter((row) => rowMatchesPickerSearch(pickerSheetQuery, row.label, row.value));
    return (
      <BottomSheetModal
        visible={visible}
        onClose={onClose}
        maxHeightPercent={72}
        keyboardAvoiding
        bottomPaddingExtra={8}>
        <View className="p-4">
          <Text className="mb-3 text-center font-bold text-xl text-[#002147]">{title}</Text>
          <View className="mb-3 flex-row items-center rounded-xl border border-gray-200 bg-white px-3 py-2.5">
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              className="ml-2 flex-1 py-1 text-base text-[#002147]"
              placeholder="Tìm nhanh..."
              placeholderTextColor="#9CA3AF"
              value={pickerSheetQuery}
              onChangeText={setPickerSheetQuery}
              returnKeyType="search"
            />
            {pickerSheetQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setPickerSheetQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>
          <View className="mb-3 overflow-hidden rounded-xl border border-gray-200">
            <FlatList
              data={filtered}
              keyExtractor={(i) => (i.value !== '' ? i.value : '__empty__')}
              style={{ maxHeight: listMaxH }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  className={`px-3 py-3 ${index < filtered.length - 1 ? 'border-b border-gray-100' : ''}`}
                  onPress={() => onSelect(item.value)}>
                  <Text className="text-base font-medium text-[#002147]">{item.label}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text className="px-3 py-4 text-center text-sm text-gray-500">
                  {data.length === 0 ? 'Không có dữ liệu' : 'Không tìm thấy kết quả'}
                </Text>
              }
            />
          </View>
          <TouchableOpacity className="rounded-full bg-gray-200 py-3" onPress={onClose}>
            <Text className="text-center font-semibold text-lg text-[#757575]">Đóng</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    );
  };

  const renderStepTwo = () => (
    <View className="w-full">
      <Text className="mb-3 text-center font-bold text-xl text-[#002147]">Thông tin chi tiết</Text>
      <ProgressIndicator step={2} />

      <View className="mb-5">
        <Text className="mb-1.5 font-semibold text-base text-[#002147]">
          Tiêu đề <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          className="mb-1 mt-2 rounded-xl border border-gray-200 p-3"
          placeholder="Nhập tiêu đề..."
          value={ticketData.title}
          onChangeText={(text) => setTicketData((p) => ({ ...p, title: text }))}
          maxLength={100}
        />
      </View>

      <View className="mb-5">
        <Text className="mb-1.5 font-semibold text-base text-[#002147]">
          Mô tả <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          className="mb-1 mt-2 min-h-[120px] rounded-xl border border-gray-200 p-3"
          placeholder="Mô tả chi tiết..."
          multiline
          textAlignVertical="top"
          maxLength={1000}
          value={ticketData.description}
          onChangeText={(text) => setTicketData((p) => ({ ...p, description: text }))}
        />
      </View>

      {isEventCategory ? (
        <>
          <Text className="mb-2 font-semibold text-[#002147]">CSVC sự kiện</Text>
          <TouchableOpacity
            className="mb-3 rounded-xl border border-gray-200 p-3"
            onPress={() => setPicker('eventBuilding')}>
            <Text className="text-gray-500">Tòa nhà *</Text>
            <Text className="mt-1 font-medium">
              {ticketData.event_building_id
                ? buildingItems.find((b) => b.value === ticketData.event_building_id)?.label
                : 'Chọn tòa nhà'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="mb-3 rounded-xl border border-gray-200 p-3"
            onPress={() => setPicker('eventRoom')}
            disabled={!ticketData.event_building_id}>
            <Text className="text-gray-500">Phòng *</Text>
            <Text className="mt-1 font-medium">
              {ticketData.event_room_id
                ? eventRooms.find((r) => r.name === ticketData.event_room_id)?.title_vn ||
                  ticketData.event_room_id
                : 'Chọn phòng'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="mb-3 rounded-xl border border-gray-200 p-3" onPress={() => openDatetime('start')}>
            <Text className="text-gray-500">Bắt đầu sự kiện *</Text>
            <Text className="mt-1 font-medium">{ticketData.event_start_local || 'Chọn'}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="mb-3 rounded-xl border border-gray-200 p-3" onPress={() => openDatetime('end')}>
            <Text className="text-gray-500">Kết thúc sự kiện *</Text>
            <Text className="mt-1 font-medium">{ticketData.event_end_local || 'Chọn'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            className="mb-3 rounded-xl border border-gray-200 p-3"
            onPress={() => setPicker('area')}>
            <Text className="text-gray-500">Khu vực (tòa) *</Text>
            <Text className="mt-1 font-medium">
              {ticketData.area_title
                ? areaOptions.find((a) => a.value === ticketData.area_title)?.label
                : 'Chọn khu vực'}
            </Text>
          </TouchableOpacity>
          {areaOptions.length === 0 && ticketData.category ? (
            <Text className="mb-2 text-sm text-amber-700">Chưa có phân công PIC cho danh mục này.</Text>
          ) : null}
          <TouchableOpacity
            className="mb-3 rounded-xl border border-gray-200 p-3"
            onPress={() => setPicker('room')}
            disabled={!ticketData.area_title}>
            <Text className="text-gray-500">Phòng *</Text>
            <Text className="mt-1 font-medium">
              {ticketData.room_id
                ? nonEventRooms.find((r) => r.name === ticketData.room_id)?.title_vn || ticketData.room_id
                : 'Chọn phòng'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {effectiveRoomId ? (
        <>
          <TouchableOpacity
            className="mb-3 rounded-xl border border-gray-200 p-3"
            onPress={() => setPicker('equipment')}
            disabled={loadingRoomDeps}>
            <Text className="text-gray-500">Thiết bị liên quan (tuỳ chọn)</Text>
            <Text className="mt-1 font-medium">
              {ticketData.related_equipment_id
                ? equipmentItems.find((e) => e.value === ticketData.related_equipment_id)?.label ||
                  ticketData.related_equipment_id
                : 'Không chọn'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="mb-3 rounded-xl border border-gray-200 p-3" onPress={() => setPicker('students')}>
            <Text className="text-gray-500">Học sinh liên quan (tuỳ chọn)</Text>
            <Text className="mt-1 font-medium">
              {ticketData.related_student_ids.length > 0
                ? `${ticketData.related_student_ids.length} học sinh`
                : 'Chọn học sinh'}
            </Text>
          </TouchableOpacity>
        </>
      ) : null}

      {datetimeTarget && Platform.OS === 'android' && (
        <DateTimePicker
          value={
            datetimeTarget === 'start' && ticketData.event_start_local
              ? new Date(ticketData.event_start_local)
              : datetimeTarget === 'end' && ticketData.event_end_local
                ? new Date(ticketData.event_end_local)
                : new Date()
          }
          mode="datetime"
          display="default"
          onChange={onDatetimeChange}
        />
      )}
      {datetimeTarget && Platform.OS === 'ios' && (
        <BottomSheetModal
          visible
          onClose={() => setDatetimeTarget(null)}
          maxHeightPercent={55}
          keyboardAvoiding={false}
          bottomPaddingExtra={8}>
          <View className="p-4">
            <Text className="mb-3 text-center font-bold text-xl text-[#002147]">
              {datetimeTarget === 'start' ? 'Bắt đầu sự kiện' : 'Kết thúc sự kiện'}
            </Text>
            <View className="mb-3 items-center overflow-hidden rounded-xl border border-gray-200 py-1">
              <DateTimePicker
                value={
                  datetimeTarget === 'start' && ticketData.event_start_local
                    ? new Date(ticketData.event_start_local)
                    : datetimeTarget === 'end' && ticketData.event_end_local
                      ? new Date(ticketData.event_end_local)
                      : new Date()
                }
                mode="datetime"
                display="spinner"
                onChange={onDatetimeChange}
              />
            </View>
            <TouchableOpacity
              className="rounded-full bg-[#FF5733] py-3"
              onPress={() => setDatetimeTarget(null)}>
              <Text className="text-center font-bold text-lg text-white">Xong</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetModal>
      )}
    </View>
  );

  const renderStepThree = () => (
    <View className="w-full">
      <Text className="mb-3 text-center font-bold text-xl text-[#002147]">Đính kèm & xác nhận</Text>
      <ProgressIndicator step={3} />
      <View className="mb-5">
        <Text className="mb-1.5 font-semibold text-base text-[#002147]">Ghi chú</Text>
        <TextInput
          className="min-h-[100px] rounded-xl border border-gray-200 bg-gray-50 p-3"
          placeholder="Ghi chú thêm..."
          multiline
          textAlignVertical="top"
          value={ticketData.notes}
          onChangeText={(text) => setTicketData((p) => ({ ...p, notes: text }))}
        />
      </View>
      <TouchableOpacity
        className="mb-4 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-6"
        onPress={() => setAttachmentSheetVisible(true)}>
        <Ionicons name="cloud-upload-outline" size={40} color="#999" />
        <Text className="mt-3 text-base text-gray-600">Chọn ảnh đính kèm (tối đa 1 file dùng cho ticket)</Text>
      </TouchableOpacity>
      {ticketData.images.length > 0 && (
        <ScrollView horizontal className="mb-4 flex-row">
          {ticketData.images.map((image, index) => (
            <View key={index} className="relative mr-2 h-[100px] w-[100px]">
              <Image source={{ uri: image.uri }} className="h-full w-full rounded-lg" />
              <TouchableOpacity
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1"
                onPress={() =>
                  setTicketData((p) => ({ ...p, images: p.images.filter((_, i) => i !== index) }))
                }>
                <Ionicons name="close" size={16} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderStepFive = () => (
    <View className="mt-10 flex h-full items-center justify-center p-5">
      <Image source={require('../../assets/final.png')} className="mb-5 h-[220px] w-[158px]" />
      <Text className="mb-3 font-bold text-2xl text-gray-800">Cám ơn {userName}!</Text>
      <Text className="mb-6 text-center text-base text-gray-600">Yêu cầu hành chính đã được ghi nhận.</Text>
      {ticketCreatedId ? (
        <View className="mb-6 w-[60%] items-center rounded-xl bg-[#E6EEF6] p-4">
          <Text className="mb-1 text-base text-[#002147]">Mã yêu cầu:</Text>
          <Text className="font-bold text-xl text-[#FF5733]">{ticketCreatedId}</Text>
        </View>
      ) : null}
    </View>
  );

  if (bootLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#FF5733" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
      {loading && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-white/80">
          <ActivityIndicator size="large" color="#FF5733" />
          <Text className="mt-2 text-base text-gray-700">Đang xử lý...</Text>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="h-full flex-1">
        <ScrollView
          className="mt-4 h-full flex-1"
          contentContainerStyle={{ paddingBottom: 120, padding: 16 }}>
          {step === 1 && renderStepOne()}
          {step === 2 && renderStepTwo()}
          {step === 3 && renderStepThree()}
          {step === 5 && renderStepFive()}
        </ScrollView>

        <View className="absolute bottom-[2%] left-4 right-4 items-center gap-3">
          {step < 4 && (
            <>
              <TouchableOpacity
                className={`w-full rounded-full bg-[#FF5733] px-6 py-2.5 ${
                  step === 1 && !ticketData.category ? 'opacity-50' : 'opacity-100'
                }`}
                onPress={handleContinue}>
                <Text className="text-center font-bold text-lg text-white">
                  {step === 3 ? 'Gửi yêu cầu' : 'Tiếp tục'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity className="w-full rounded-full bg-gray-200 px-5 py-2.5" onPress={handleGoBack}>
                <Text className="text-center font-semibold text-lg text-[#757575]">Quay lại</Text>
              </TouchableOpacity>
            </>
          )}
          {step === 5 && (
            <TouchableOpacity
              className="w-full rounded-full bg-[#FF5733] px-6 py-2.5"
              onPress={() => navigation.navigate(ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST)}>
              <Text className="text-center font-bold text-lg text-white">Về danh sách</Text>
            </TouchableOpacity>
          )}
        </View>

        <BottomSheetModal
          visible={attachmentSheetVisible}
          onClose={() => setAttachmentSheetVisible(false)}
          maxHeightPercent={45}
          keyboardAvoiding={false}
          bottomPaddingExtra={8}>
          <View className="p-4">
            <Text className="mb-3 text-center font-bold text-xl text-[#002147]">Ảnh đính kèm</Text>
            <View className="mb-3 overflow-hidden rounded-xl border border-gray-200">
              <TouchableOpacity
                className="flex-row items-center border-b border-gray-100 px-4 py-4"
                onPress={pickFromCamera}>
                <Ionicons name="camera-outline" size={26} color="#FF5733" />
                <Text className="ml-3 text-base font-medium text-[#002147]">Chụp ảnh</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-row items-center px-4 py-4" onPress={pickFromLibrary}>
                <Ionicons name="images-outline" size={26} color="#FF5733" />
                <Text className="ml-3 text-base font-medium text-[#002147]">Chọn từ thư viện</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              className="rounded-full bg-gray-200 py-3"
              onPress={() => setAttachmentSheetVisible(false)}>
              <Text className="text-center font-semibold text-lg text-[#757575]">Hủy</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetModal>
      </KeyboardAvoidingView>

      {renderPickerModal(
        'Chọn khu vực',
        picker === 'area',
        areaOptions,
        (v) => {
          setTicketData((p) => ({
            ...p,
            area_title: v,
            room_id: '',
            related_equipment_id: '',
            related_student_ids: [],
          }));
          setPicker(null);
        },
        () => setPicker(null)
      )}
      {renderPickerModal(
        'Chọn tòa nhà',
        picker === 'eventBuilding',
        buildingItems,
        (v) => {
          setTicketData((p) => ({
            ...p,
            event_building_id: v,
            event_room_id: '',
            related_equipment_id: '',
            related_student_ids: [],
          }));
          setPicker(null);
        },
        () => setPicker(null)
      )}
      {renderPickerModal(
        'Chọn phòng (sự kiện)',
        picker === 'eventRoom',
        eventRooms.map((r) => ({ value: r.name, label: r.title_vn || r.name })),
        (v) => {
          setTicketData((p) => ({
            ...p,
            event_room_id: v,
            related_equipment_id: '',
            related_student_ids: [],
          }));
          setPicker(null);
        },
        () => setPicker(null)
      )}
      {renderPickerModal(
        'Chọn phòng',
        picker === 'room',
        nonEventRooms.map((r) => ({ value: r.name, label: r.title_vn || r.name })),
        (v) => {
          setTicketData((p) => ({
            ...p,
            room_id: v,
            related_equipment_id: '',
            related_student_ids: [],
          }));
          setPicker(null);
        },
        () => setPicker(null)
      )}
      {renderPickerModal(
        'Thiết bị',
        picker === 'equipment',
        [{ value: '', label: '— Không chọn —' }, ...equipmentItems],
        (v) => {
          setTicketData((p) => ({ ...p, related_equipment_id: v }));
          setPicker(null);
        },
        () => setPicker(null)
      )}

      <BottomSheetModal
        visible={picker === 'students'}
        onClose={() => setPicker(null)}
        maxHeightPercent={78}
        keyboardAvoiding
        bottomPaddingExtra={8}>
        <View className="p-4">
          <Text className="mb-3 text-center font-bold text-xl text-[#002147]">Học sinh liên quan</Text>
          <View className="mb-3 flex-row items-center rounded-xl border border-gray-200 bg-white px-3 py-2.5">
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              className="ml-2 flex-1 py-1 text-base text-[#002147]"
              placeholder="Tìm theo tên hoặc mã HS..."
              placeholderTextColor="#9CA3AF"
              value={pickerSheetQuery}
              onChangeText={setPickerSheetQuery}
              returnKeyType="search"
            />
            {pickerSheetQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setPickerSheetQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>
          <View className="mb-3 overflow-hidden rounded-xl border border-gray-200">
            <FlatList
              data={filteredStudentPickerRows}
              keyExtractor={(s) => s.student_id}
              style={{ maxHeight: listMaxH }}
              keyboardShouldPersistTaps="handled"
              extraData={ticketData.related_student_ids}
              renderItem={({ item, index }) => {
                const sel = ticketData.related_student_ids.includes(item.student_id);
                return (
                  <TouchableOpacity
                    className={`flex-row items-center px-3 py-3 ${
                      index < filteredStudentPickerRows.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                    onPress={() => toggleStudent(item.student_id)}>
                    <Ionicons
                      name={sel ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={sel ? '#FF5733' : '#999'}
                    />
                    <Text className="ml-2 flex-1 text-base font-medium text-[#002147]">
                      {item.student_name} ({item.student_code})
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text className="px-3 py-4 text-center text-sm text-gray-500">
                  {ticketStudents.length === 0
                    ? 'Không có học sinh trong phòng'
                    : 'Không tìm thấy kết quả'}
                </Text>
              }
            />
          </View>
          <TouchableOpacity className="rounded-full bg-gray-200 py-3" onPress={() => setPicker(null)}>
            <Text className="text-center font-semibold text-lg text-[#757575]">Xong</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </SafeAreaView>
  );
};

export default TicketCreate;
