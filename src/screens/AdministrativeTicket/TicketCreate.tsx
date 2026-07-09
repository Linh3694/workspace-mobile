import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import {
  EVENT_FACILITY_CATEGORY,
  getBuildingLabelForAreaTitle,
  datetimeLocalToMysql,
  dateToDatetimeLocal,
  hasBookingConflict,
} from '../../utils/eventTicketUtils';
import { ADMIN_TICKET_MAX_IMAGES_UPLOAD } from '../../config/administrativeTicketConstants';
import { API_BASE_URL } from '../../config/constants';
import { isAxiosError } from 'axios';
import {
  getAdminTicketCategories,
  getPendingAckCategories,
  createAdminTicket,
  updateAdminTicket,
  getAdminTicketDetail,
  uploadAdminTicketAttachment,
  parseFrappeApiError,
  getRoomsByBuilding,
  getAllStudentsForTicket,
  getAllStaffForTicket,
  getRoomEquipmentForTicket,
  getRoomEventBookings,
  type AdminTicketCategory,
  type AdminEventRoomOption,
  type AdminRoomBooking,
  type AdminTicketEquipmentLine,
  type AdminTicketStudentOption,
  type AdminTicketStaffOption,
} from '../../services/administrativeTicketService';
import { getAllBuildings, type Building } from '../../services/buildingService';
import { getAllAdministrativeAssignments, type AdministrativeSupportAssignment } from '../../services/administrativeSupportService';

interface ImageItem {
  uri: string;
  type?: string;
  name?: string;
  /** Tệp tài liệu (không phải ảnh) — hiển thị icon thay vì preview ảnh */
  isDocument?: boolean;
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
  | 'staff'
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
function rowMatchesPickerSearch(query: string, label: string, value = '', subtitle = ''): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return normalizeSearchText(`${label} ${subtitle} ${value}`).includes(q);
}

/** Lọc học sinh theo tên hoặc mã */
function studentMatchesSearch(query: string, item: AdminTicketStudentOption): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return (
    normalizeSearchText(item.student_name).includes(q) ||
    normalizeSearchText(item.student_code || '').includes(q) ||
    normalizeSearchText(item.class_title || '').includes(q)
  );
}

/** Ghép thông tin phụ của học sinh (mã + lớp) giống web */
function formatStudentMeta(item: AdminTicketStudentOption): string {
  return [item.student_code, item.class_title].filter(Boolean).join(' · ');
}

/** Lọc CBGVNV theo tên, email hoặc phòng ban */
function staffMatchesSearch(query: string, item: AdminTicketStaffOption): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return (
    normalizeSearchText(item.full_name).includes(q) ||
    normalizeSearchText(item.email || '').includes(q) ||
    normalizeSearchText(item.department_name || '').includes(q)
  );
}

/** Thông tin phụ của CBGVNV: phòng ban (giống web — không hiện email) */
function formatStaffMeta(item: AdminTicketStaffOption): string {
  return (item.department_name || '').trim();
}

function toMysqlFromDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDateTimeDisplay(input?: string): string {
  if (!input || !input.trim()) return 'Chọn';
  const normalized = input.includes('T') ? input : input.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return input;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Mốc nhỏ nhất cho thời gian kết thúc: sau bắt đầu ít nhất 1 phút và không ở quá khứ */
function getMinEventEndDate(startLocal?: string): Date {
  const now = new Date();
  const start = startLocal ? new Date(startLocal) : null;
  if (!start || Number.isNaN(start.getTime())) return now;
  const minEnd = new Date(start.getTime() + 60 * 1000);
  return minEnd > now ? minEnd : now;
}

/** Ghép nhãn tòa nhà tiếng Việt + tiếng Anh (giống web) */
function formatBuildingPickerLabel(building: Building): string {
  const vn = String(building.title_vn || building.name).trim();
  const en = String(building.title_en || '').trim();
  if (!en || normalizeSearchText(vn) === normalizeSearchText(en)) return vn;
  return `${vn} (${en})`;
}

/** Dữ liệu hiển thị cho picker tòa nhà: dòng chính + dòng phụ */
function getBuildingPickerDisplay(building: Building): { label: string; subtitle: string } {
  const label = String(building.title_vn || building.name).trim();
  const en = String(building.title_en || '').trim();
  if (!en || normalizeSearchText(label) === normalizeSearchText(en)) {
    return { label, subtitle: '' };
  }
  return { label, subtitle: en };
}

/** Ghép nhãn phòng theo năm học + code (giống web) */
function formatRoomPickerLabel(room: AdminEventRoomOption): string {
  const yearly = String(room.yearly_assignment_display || '').trim();
  const baseLabel = String(room.title_vn || room.name).trim();
  const code = String(room.short_title || room.name).trim();
  const main = yearly || baseLabel;
  if (!main) return room.name;
  if (!code || normalizeSearchText(main) === normalizeSearchText(code)) return main;
  return `${main} (${code})`;
}

/** Dữ liệu hiển thị cho picker phòng: dòng chính + dòng phụ */
function getRoomPickerDisplay(room: AdminEventRoomOption): { label: string; subtitle: string } {
  const yearly = String(room.yearly_assignment_display || '').trim();
  const baseLabel = String(room.title_vn || room.name).trim();
  const code = String(room.short_title || room.name).trim();
  const label = yearly || baseLabel;
  const subtitleParts: string[] = [];
  const seen = new Set<string>();
  const pushUnique = (value: string) => {
    const v = value.trim();
    if (!v) return;
    const key = normalizeSearchText(v);
    if (seen.has(key)) return;
    seen.add(key);
    subtitleParts.push(v);
  };
  if (code && normalizeSearchText(code) !== normalizeSearchText(label)) pushUnique(code);
  if (yearly && baseLabel && normalizeSearchText(baseLabel) !== normalizeSearchText(label)) {
    pushUnique(baseLabel);
  }
  return { label: label || room.name, subtitle: subtitleParts.join(' · ') };
}

const TicketCreate = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<
    | RouteProp<RootStackParamList, typeof ROUTES.SCREENS.ADMINISTRATIVE_TICKET_CREATE>
    | RouteProp<RootStackParamList, typeof ROUTES.SCREENS.ADMINISTRATIVE_TICKET_EDIT>
  >();
  const editTicketId = (route.params as { ticketId?: string } | undefined)?.ticketId?.trim() || '';
  const isEditMode = !!editTicketId;
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState('');
  const [ticketCreatedId, setTicketCreatedId] = useState('');
  const [categories, setCategories] = useState<AdminTicketCategory[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [assignments, setAssignments] = useState<AdministrativeSupportAssignment[]>([]);
  const [pendingAckCategories, setPendingAckCategories] = useState<string[]>([]);
  const [eventRooms, setEventRooms] = useState<AdminEventRoomOption[]>([]);
  const [nonEventRooms, setNonEventRooms] = useState<AdminEventRoomOption[]>([]);
  const [ticketEquipment, setTicketEquipment] = useState<AdminTicketEquipmentLine[]>([]);
  const [ticketStudents, setTicketStudents] = useState<AdminTicketStudentOption[]>([]);
  const [ticketStaff, setTicketStaff] = useState<AdminTicketStaffOption[]>([]);
  const [loadingRoomDeps, setLoadingRoomDeps] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingRoomBookings, setLoadingRoomBookings] = useState(false);
  const [roomBookings, setRoomBookings] = useState<AdminRoomBooking[]>([]);
  const [originCategory, setOriginCategory] = useState('');

  const [picker, setPicker] = useState<PickerKey>(null);
  /** Ô tìm trong sheet chọn khu vực / tòa / phòng / thiết bị / học sinh */
  const [pickerSheetQuery, setPickerSheetQuery] = useState('');
  const [datetimeTarget, setDatetimeTarget] = useState<'start' | 'end' | null>(null);
  /** Sheet chọn ảnh đính kèm (thay react-native-actions-sheet) */
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [existingAttachmentUrls, setExistingAttachmentUrls] = useState<string[]>([]);

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
    related_department_ids: [] as string[],
    related_student_ids: [] as string[],
    related_staff_ids: [] as string[],
  });

  const insets = useSafeAreaInsets();

  const pendingCategorySet = useMemo(
    () => new Set(pendingAckCategories),
    [pendingAckCategories],
  );

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
    return ids.map((id) => {
      const byId = buildings.find((b) => b.name === id);
      const byLegacy = buildings.find((b) => b.title_vn === id || b.short_title === id);
      const match = byId || byLegacy;
      if (!match) {
        return {
          value: id,
          label: getBuildingLabelForAreaTitle(id, buildings),
          subtitle: '',
        };
      }
      const display = getBuildingPickerDisplay(match);
      return {
        value: id,
        label: display.label,
        subtitle: display.subtitle,
      };
    });
  }, [ticketData.category, assignments, buildings, isEventCategory]);

  const buildingItems = useMemo(
    () =>
      buildings.map((b) => {
        const display = getBuildingPickerDisplay(b);
        return {
          value: b.name,
          label: display.label,
          subtitle: display.subtitle,
        };
      }),
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
  const eventRoomItems = useMemo(
    () =>
      eventRooms.map((room) => {
        const display = getRoomPickerDisplay(room);
        return {
          value: room.name,
          label: display.label,
          subtitle: display.subtitle,
        };
      }),
    [eventRooms]
  );
  const nonEventRoomItems = useMemo(
    () =>
      nonEventRooms.map((room) => {
        const display = getRoomPickerDisplay(room);
        return {
          value: room.name,
          label: display.label,
          subtitle: display.subtitle,
        };
      }),
    [nonEventRooms]
  );

  /** Danh sách HS trong sheet chọn (đồng bộ index viền dưới từng dòng) */
  const filteredStudentPickerRows = useMemo(() => {
    if (picker !== 'students') return [];
    return ticketStudents.filter((s) => studentMatchesSearch(pickerSheetQuery, s));
  }, [picker, ticketStudents, pickerSheetQuery]);

  /** Danh sách CBGVNV trong sheet chọn */
  const filteredStaffPickerRows = useMemo(() => {
    if (picker !== 'staff') return [];
    return ticketStaff.filter((s) => staffMatchesSearch(pickerSheetQuery, s));
  }, [picker, ticketStaff, pickerSheetQuery]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    setPickerSheetQuery('');
  }, [picker]);

  useEffect(() => {
    const run = async () => {
      try {
        const [storedUserName, cats, bld, asn, pending] = await Promise.all([
          AsyncStorage.getItem('userFullname'),
          getAdminTicketCategories(),
          getAllBuildings(),
          getAllAdministrativeAssignments(),
          getPendingAckCategories(),
        ]);
        setUserName(normalizeVietnameseName(storedUserName || 'WISer'));
        setCategories(cats);
        setBuildings(bld);
        setAssignments(asn);
        setPendingAckCategories(pending);
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
    const loadEditTicket = async () => {
      if (!isEditMode || !editTicketId) return;
      try {
        const detail = await getAdminTicketDetail(editTicketId);
        if (!detail || cancelled) return;
        const studentIds =
          Array.isArray(detail.related_student_ids)
            ? detail.related_student_ids
            : typeof detail.related_student_ids === 'string' && detail.related_student_ids.trim()
              ? detail.related_student_ids.split(',').map((x) => x.trim()).filter(Boolean)
              : [];
        const staffIds = (() => {
          const raw = detail.related_staff_ids;
          if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
          if (typeof raw === 'string' && raw.trim()) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
            } catch {
              return raw.split(',').map((x) => x.trim()).filter(Boolean);
            }
          }
          if (Array.isArray(detail.related_staff)) {
            return detail.related_staff.map((s) => String(s.user_id).trim()).filter(Boolean);
          }
          return [];
        })();
        setOriginCategory(detail.category || '');
        setTicketData((prev) => ({
          ...prev,
          title: detail.title || '',
          category: detail.category || '',
          description: detail.description || '',
          notes: detail.notes || '',
          area_title: detail.area_title || '',
          event_building_id: detail.event_building_id || '',
          event_room_id: detail.event_room_id || '',
          event_start_local: (detail.event_start_time || '').replace(' ', 'T').slice(0, 16),
          event_end_local: (detail.event_end_time || '').replace(' ', 'T').slice(0, 16),
          room_id: detail.room_id || '',
          related_equipment_id: detail.related_equipment_id || '',
          related_department_ids: Array.isArray(detail.related_department_ids)
            ? detail.related_department_ids
            : [],
          related_student_ids: studentIds,
          related_staff_ids: staffIds,
        }));
        {
          const rawAttachments = (
            detail as { attachments?: Array<string | { url?: string }> }
          ).attachments;
          const urls = Array.isArray(rawAttachments)
            ? rawAttachments
                .map((a) => (typeof a === 'string' ? a : a?.url || ''))
                .filter((u): u is string => Boolean(u))
            : [];
          setExistingAttachmentUrls(
            urls.length ? urls : detail.attachment ? [detail.attachment] : [],
          );
        }
      } catch (e) {
        console.error('load edit administrative ticket', e);
        Alert.alert('Lỗi', 'Không thể tải dữ liệu ticket để chỉnh sửa');
      }
    };
    loadEditTicket();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, editTicketId]);

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
    const loadAllStudents = async () => {
      setLoadingStudents(true);
      try {
        const students = await getAllStudentsForTicket();
        if (!cancelled) setTicketStudents(students);
      } catch (e) {
        console.error('load all students for ticket', e);
        if (!cancelled) setTicketStudents([]);
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    };
    loadAllStudents();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAllStaff = async () => {
      setLoadingStaff(true);
      try {
        const staff = await getAllStaffForTicket();
        if (!cancelled) setTicketStaff(staff);
      } catch (e) {
        console.error('load all staff for ticket', e);
        if (!cancelled) setTicketStaff([]);
      } finally {
        if (!cancelled) setLoadingStaff(false);
      }
    };
    loadAllStaff();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadDeps = async () => {
      if (!effectiveRoomId) {
        setTicketEquipment([]);
        return;
      }
      setLoadingRoomDeps(true);
      try {
        const eq = await getRoomEquipmentForTicket(effectiveRoomId);
        if (!cancelled) {
          setTicketEquipment(eq);
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

  useEffect(() => {
    let cancelled = false;
    const loadRoomBookings = async () => {
      if (!effectiveRoomId) {
        setRoomBookings([]);
        return;
      }
      setLoadingRoomBookings(true);
      try {
        const anchor =
          isEventCategory && ticketData.event_start_local
            ? new Date(ticketData.event_start_local)
            : new Date();
        const start = new Date(anchor);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        end.setHours(23, 59, 59, 0);
        const rows = await getRoomEventBookings({
          room_id: effectiveRoomId,
          range_start: toMysqlFromDate(start),
          range_end: toMysqlFromDate(end),
          ...(isEditMode ? { exclude_ticket_id: editTicketId } : {}),
        });
        if (!cancelled) setRoomBookings(rows);
      } catch (e) {
        console.error('load room bookings', e);
        if (!cancelled) setRoomBookings([]);
      } finally {
        if (!cancelled) setLoadingRoomBookings(false);
      }
    };
    loadRoomBookings();
    return () => {
      cancelled = true;
    };
  }, [effectiveRoomId, isEventCategory, ticketData.event_start_local, ticketData.event_end_local, editTicketId, isEditMode]);

  const handleGoBack = () => {
    if (step === 1) {
      navigation.goBack();
    } else {
      setStep(step - 1);
    }
  };

  const validateStep2 = async (): Promise<boolean> => {
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
      if (new Date(ticketData.event_start_local) < new Date()) {
        Alert.alert('Thông báo', 'Không được đặt thời gian bắt đầu sự kiện trong quá khứ');
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
      try {
        const bookings = await getRoomEventBookings({
          room_id: ticketData.event_room_id.trim(),
          range_start: datetimeLocalToMysql(ticketData.event_start_local),
          range_end: datetimeLocalToMysql(ticketData.event_end_local),
          ...(isEditMode ? { exclude_ticket_id: editTicketId } : {}),
        });
        if (hasBookingConflict(ticketData.event_start_local, ticketData.event_end_local, bookings, editTicketId)) {
          Alert.alert('Thông báo', 'Khung giờ này đã có người đặt');
          return false;
        }
      } catch (e) {
        console.error('validate room booking conflict', e);
      }
    } else {
      if (!ticketData.area_title.trim()) {
        Alert.alert('Thông báo', 'Chọn khu vực (tòa) theo phân công');
        return false;
      }
    }
    return true;
  };

  const handleContinue = async () => {
    if (step === 1) {
      if (!ticketData.category) {
        Alert.alert('Thông báo', 'Vui lòng chọn hạng mục');
        return;
      }
      const allowCurrentEditCategory = isEditMode && originCategory && originCategory === ticketData.category;
      if (pendingCategorySet.has(ticketData.category) && !allowCurrentEditCategory) {
        Alert.alert(
          'Thông báo',
          'Bạn còn ticket cùng hạng mục chưa xác nhận kết quả. Hãy xử lý ở danh sách ticket trước khi tạo mới.',
        );
        return;
      }
    }
    if (step === 2 && !(await validateStep2())) return;
    if (step === 3) {
      submitTicket();
    } else {
      setStep(step + 1);
    }
  };

  const submitTicket = async () => {
    try {
      setLoading(true);

      const newAttachmentUrls = await Promise.all(
        ticketData.images.map((img) => {
          const uriParts = img.uri.split('/');
          const fileName = img.name || uriParts[uriParts.length - 1] || 'attach.jpg';
          const ext = fileName.split('.').pop()?.toLowerCase();
          const mime =
            img.type ||
            (ext === 'png'
              ? 'image/png'
              : ext === 'jpg' || ext === 'jpeg'
                ? 'image/jpeg'
                : 'application/octet-stream');
          return uploadAdminTicketAttachment(img.uri, fileName, mime);
        }),
      );
      const attachmentUrls = [...existingAttachmentUrls, ...newAttachmentUrls];
      const attachmentUrl: string | undefined = attachmentUrls[0];

      const areaForPic = isEventCategory
        ? ticketData.event_building_id.trim()
        : ticketData.area_title.trim();

      const relatedPayload = {
        related_department_ids:
          ticketData.related_department_ids.length > 0 ? ticketData.related_department_ids : undefined,
        related_equipment_id: ticketData.related_equipment_id.trim() || undefined,
        related_student_ids:
          ticketData.related_student_ids.length > 0 ? ticketData.related_student_ids : undefined,
        related_staff_ids:
          ticketData.related_staff_ids.length > 0 ? ticketData.related_staff_ids : undefined,
      };
      if (isEditMode && editTicketId) {
        const updated = await updateAdminTicket({
          ticket_id: editTicketId,
          title: ticketData.title.trim(),
          description: ticketData.description.trim(),
          category: ticketData.category,
          notes: ticketData.notes.trim(),
          area_title: areaForPic,
          attachment: attachmentUrl,
          attachments: attachmentUrls,
          is_event_facility: isEventCategory,
          room_id: !isEventCategory ? ticketData.room_id.trim() : '',
          event_building_id: isEventCategory ? ticketData.event_building_id.trim() : '',
          event_room_id: isEventCategory ? ticketData.event_room_id.trim() : '',
          event_start_time: isEventCategory ? datetimeLocalToMysql(ticketData.event_start_local) : '',
          event_end_time: isEventCategory ? datetimeLocalToMysql(ticketData.event_end_local) : '',
          ...relatedPayload,
        });
        await getPendingAckCategories().then(setPendingAckCategories).catch(() => undefined);
        Alert.alert('Thành công', 'Đã cập nhật ticket', [
          {
            text: 'OK',
            onPress: () =>
              navigation.navigate(ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST_DETAIL, {
                ticketId: updated._id || editTicketId,
              }),
          },
        ]);
        return;
      }

      const created = await createAdminTicket({
        title: ticketData.title.trim(),
        description: ticketData.description.trim(),
        category: ticketData.category,
        notes: ticketData.notes.trim(),
        area_title: areaForPic,
        priority: ticketData.priority || 'Medium',
        attachment: attachmentUrl,
        attachments: attachmentUrls,
        is_event_facility: isEventCategory,
        event_building_id: isEventCategory ? ticketData.event_building_id.trim() : undefined,
        event_room_id: isEventCategory ? ticketData.event_room_id.trim() : undefined,
        event_start_time: isEventCategory ? datetimeLocalToMysql(ticketData.event_start_local) : undefined,
        event_end_time: isEventCategory ? datetimeLocalToMysql(ticketData.event_end_local) : undefined,
        room_id: !isEventCategory ? ticketData.room_id.trim() : undefined,
        ...relatedPayload,
      });

      if (created?.ticketCode) {
        setPendingAckCategories(await getPendingAckCategories());
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
      const nextLocal = dateToDatetimeLocal(date);
      if (datetimeTarget === 'start') {
        if (date < new Date()) {
          Alert.alert('Thông báo', 'Không được đặt thời gian bắt đầu sự kiện trong quá khứ');
          if (Platform.OS === 'android') setDatetimeTarget(null);
          return;
        }
        setTicketData((p) => {
          const next = { ...p, event_start_local: nextLocal };
          // Nếu start mới lớn hơn end hiện tại thì reset end để tránh khoảng thời gian sai.
          if (p.event_end_local && new Date(nextLocal) > new Date(p.event_end_local)) {
            next.event_end_local = '';
          }
          return next;
        });
      } else {
        const minEndDate = getMinEventEndDate(ticketData.event_start_local);
        if (date < minEndDate) {
          Alert.alert('Thông báo', 'Thời gian kết thúc phải sau thời gian bắt đầu');
          if (Platform.OS === 'android') setDatetimeTarget(null);
          return;
        }
        setTicketData((p) => ({ ...p, event_end_local: nextLocal }));
      }
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

  const toggleStaff = useCallback((id: string) => {
    setTicketData((prev) => {
      const has = prev.related_staff_ids.includes(id);
      return {
        ...prev,
        related_staff_ids: has
          ? prev.related_staff_ids.filter((x) => x !== id)
          : [...prev.related_staff_ids, id],
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

  const pickDocument = async () => {
    try {
      setAttachmentSheetVisible(false);
      if (ticketData.images.length >= ADMIN_TICKET_MAX_IMAGES_UPLOAD) {
        Alert.alert('Thông báo', `Tối đa ${ADMIN_TICKET_MAX_IMAGES_UPLOAD} tệp đính kèm`);
        return;
      }
      setTimeout(async () => {
        try {
          const result = await DocumentPicker.getDocumentAsync({
            copyToCacheDirectory: true,
            multiple: true,
          });
          if ((result as { canceled?: boolean }).canceled) return;
          const assets =
            (result as { assets?: Array<{ uri: string; name?: string; mimeType?: string }> }).assets ||
            [];
          if (!assets.length) return;
          const remaining = ADMIN_TICKET_MAX_IMAGES_UPLOAD - ticketData.images.length;
          const newFiles: ImageItem[] = assets
            .slice(0, Math.max(0, remaining))
            .filter((a) => Boolean(a?.uri))
            .map((a) => {
              const mime = a.mimeType || 'application/octet-stream';
              return {
                uri: a.uri,
                name: a.name || a.uri.split('/').pop() || 'file',
                type: mime,
                isDocument: !mime.startsWith('image/'),
              };
            });
          if (newFiles.length) {
            setTicketData((prev) => ({ ...prev, images: [...prev.images, ...newFiles] }));
          }
        } catch (e) {
          console.error('pick document', e);
          Alert.alert('Lỗi', 'Không thể chọn tệp');
        }
      }, 400);
    } catch {
      /* noop */
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
        {pendingAckCategories.length > 0 ? (
          <View className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Text className="text-sm text-amber-900">
              Một số hạng mục tạm không thể tạo mới vì còn ticket chưa xác nhận kết quả (xong, chưa
              đóng/đánh giá). Vào màn Danh sách ticket để xử lý trước.
            </Text>
          </View>
        ) : null}
        <View className="space-y-3">
          {categories.map((category) => {
            const blocked = pendingCategorySet.has(category.value);
            return (
            <TouchableOpacity
              key={category.value}
              activeOpacity={blocked ? 1 : 0.7}
              className={`mb-2 rounded-xl border-2 p-4 ${
                blocked
                  ? 'border-gray-200 bg-gray-100 opacity-60'
                  : ticketData.category === category.value
                  ? 'border-[#FF5733] bg-[#FFF5F3]'
                  : 'border-gray-200 bg-white'
              }`}
              disabled={blocked}
              onPress={() => {
                if (blocked) return;
                setTicketData((prev) => ({
                  ...prev,
                  category: category.value,
                  area_title: '',
                  room_id: '',
                  event_building_id: '',
                  event_room_id: '',
                  event_start_local: '',
                  event_end_local: '',
                  related_equipment_id: '',
                  related_department_ids: [],
                  related_student_ids: [],
                  related_staff_ids: [],
                }));
              }}>
              <Text
                className={`font-medium text-base ${
                  ticketData.category === category.value && !blocked ? 'text-[#FF5733]' : 'text-gray-800'
                }`}>
                {category.label}
                {blocked ? ' (đang chờ xác nhận)' : ''}
              </Text>
            </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );

  const listMaxH = Dimensions.get('window').height * 0.46;

  const renderPickerModal = (
    title: string,
    visible: boolean,
    data: { value: string; label: string; subtitle?: string }[],
    onSelect: (v: string) => void,
    onClose: () => void
  ) => {
    const filtered = data.filter((row) =>
      rowMatchesPickerSearch(pickerSheetQuery, row.label, row.value, row.subtitle || '')
    );
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
                  {item.subtitle ? <Text className="mt-0.5 text-sm text-gray-500">{item.subtitle}</Text> : null}
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
      <Text className="mb-3 text-center font-bold text-xl text-[#002147]">
        {isEditMode ? 'Chỉnh sửa yêu cầu' : 'Thông tin chi tiết'}
      </Text>
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
                ? formatBuildingPickerLabel(
                    buildings.find((b) => b.name === ticketData.event_building_id) || {
                      name: ticketData.event_building_id,
                    }
                  )
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
                ? formatRoomPickerLabel(
                    eventRooms.find((r) => r.name === ticketData.event_room_id) || {
                      name: ticketData.event_room_id,
                    }
                  ) ||
                  ticketData.event_room_id
                : 'Chọn phòng'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="mb-3 rounded-xl border border-gray-200 p-3" onPress={() => openDatetime('start')}>
            <Text className="text-gray-500">Bắt đầu sự kiện *</Text>
            <Text className="mt-1 font-medium">{formatDateTimeDisplay(ticketData.event_start_local)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`mb-3 rounded-xl border border-gray-200 p-3 ${
              !ticketData.event_start_local ? 'opacity-60' : ''
            }`}
            onPress={() => openDatetime('end')}
            disabled={!ticketData.event_start_local}>
            <Text className="text-gray-500">Kết thúc sự kiện *</Text>
            <Text className="mt-1 font-medium">{formatDateTimeDisplay(ticketData.event_end_local)}</Text>
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
                ? getBuildingLabelForAreaTitle(ticketData.area_title, buildings)
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
            <Text className="text-gray-500">Phòng</Text>
            <Text className="mt-1 font-medium">
              {ticketData.room_id
                ? formatRoomPickerLabel(
                    nonEventRooms.find((r) => r.name === ticketData.room_id) || {
                      name: ticketData.room_id,
                    }
                  ) ||
                  ticketData.room_id
                : 'Chọn phòng'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {!isEventCategory && effectiveRoomId ? (
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
        </>
      ) : null}
      {!isEventCategory && ticketData.category ? (
        <TouchableOpacity
          className="mb-3 rounded-xl border border-gray-200 p-3"
          onPress={() => setPicker('students')}
          disabled={loadingStudents}>
          <Text className="text-gray-500">Học sinh liên quan (tuỳ chọn)</Text>
          <Text className="mt-1 font-medium">
            {ticketData.related_student_ids.length > 0
              ? `${ticketData.related_student_ids.length} học sinh`
              : loadingStudents
                ? 'Đang tải danh sách học sinh...'
                : 'Chọn học sinh'}
          </Text>
        </TouchableOpacity>
      ) : null}
      {!isEventCategory && ticketData.category ? (
        <TouchableOpacity
          className="mb-3 rounded-xl border border-gray-200 p-3"
          onPress={() => setPicker('staff')}
          disabled={loadingStaff}>
          <Text className="text-gray-500">CBGVNV liên quan (tuỳ chọn)</Text>
          <Text className="mt-1 font-medium">
            {ticketData.related_staff_ids.length > 0
              ? `${ticketData.related_staff_ids.length} CBGVNV`
              : loadingStaff
                ? 'Đang tải danh sách CBGVNV...'
                : 'Chọn CBGVNV'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
        <Text className="mb-2 font-semibold text-[#002147]">Lịch đặt phòng</Text>
        {!effectiveRoomId ? (
          <Text className="text-sm text-gray-500">Chọn phòng để xem lịch đặt phòng trong 7 ngày tới.</Text>
        ) : loadingRoomBookings ? (
          <View className="flex-row items-center gap-2 py-2">
            <ActivityIndicator size="small" color="#FF5733" />
            <Text className="text-sm text-gray-500">Đang tải lịch...</Text>
          </View>
        ) : roomBookings.length === 0 ? (
          <Text className="text-sm text-gray-500">Chưa có lịch đặt phòng trong khoảng thời gian này.</Text>
        ) : (
          <View className="gap-2">
            {roomBookings.slice(0, 5).map((b) => (
              <View key={`${b.name}-${b.event_start_time}`} className="rounded-lg bg-gray-50 p-2.5">
                <Text className="font-semibold text-sm text-[#002147]">
                  {normalizeVietnameseName(b.booked_by) || b.booked_by || 'Người đặt'}
                </Text>
                <View className="mt-1.5">
                  <Text className="text-xs text-gray-500">
                    Phòng ban: {b.booked_by_department?.trim() || '—'}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-500">
                    Email: {b.booked_by_email?.trim() || '—'}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-600">
                    {`Thời gian: ${formatDateTimeDisplay(b.event_start_time)} - ${formatDateTimeDisplay(b.event_end_time)}`}
                  </Text>
                </View>
              </View>
            ))}
            {roomBookings.length > 5 ? (
              <Text className="text-xs text-gray-500">{`+${roomBookings.length - 5} lịch khác`}</Text>
            ) : null}
          </View>
        )}
        {isEventCategory &&
        ticketData.event_start_local &&
        ticketData.event_end_local &&
        hasBookingConflict(ticketData.event_start_local, ticketData.event_end_local, roomBookings, editTicketId) ? (
          <Text className="mt-2 text-sm font-semibold text-red-600">Khung giờ đang chọn đã trùng lịch.</Text>
        ) : null}
      </View>

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
          minimumDate={
            datetimeTarget === 'start' ? new Date() : getMinEventEndDate(ticketData.event_start_local)
          }
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
                minimumDate={
                  datetimeTarget === 'start'
                    ? new Date()
                    : getMinEventEndDate(ticketData.event_start_local)
                }
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
        <Text className="mt-3 text-base text-gray-600">Chọn tệp đính kèm (ảnh / tài liệu)</Text>
      </TouchableOpacity>
      {existingAttachmentUrls.length > 0 && (
        <ScrollView horizontal className="mb-4 flex-row">
          {existingAttachmentUrls.map((url, index) => {
            const fullUrl = url.startsWith('http')
              ? url
              : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)(\?|$)/i.test(url);
            const fileName = decodeURIComponent(url.split('?')[0].split('/').pop() || 'file');
            return (
              <View key={`exist-${index}`} className="relative mr-2 h-[100px] w-[100px]">
                {isImage ? (
                  <Image source={{ uri: fullUrl }} className="h-full w-full rounded-lg" />
                ) : (
                  <View className="h-full w-full items-center justify-center rounded-lg bg-gray-100 p-1">
                    <Ionicons name="document-outline" size={28} color="#757575" />
                    <Text className="mt-1 text-center text-xs text-gray-600" numberOfLines={2}>
                      {fileName}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1"
                  onPress={() =>
                    setExistingAttachmentUrls((prev) => prev.filter((u) => u !== url))
                  }>
                  <Ionicons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
      {ticketData.images.length > 0 && (
        <ScrollView horizontal className="mb-4 flex-row">
          {ticketData.images.map((image, index) => {
            const isImage = !image.isDocument && !(image.type && !image.type.startsWith('image/'));
            return (
              <View key={index} className="relative mr-2 h-[100px] w-[100px]">
                {isImage ? (
                  <Image source={{ uri: image.uri }} className="h-full w-full rounded-lg" />
                ) : (
                  <View className="h-full w-full items-center justify-center rounded-lg bg-gray-100 p-1">
                    <Ionicons name="document-outline" size={28} color="#757575" />
                    <Text className="mt-1 text-center text-xs text-gray-600" numberOfLines={2}>
                      {image.name || 'Tệp'}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1"
                  onPress={() =>
                    setTicketData((p) => ({ ...p, images: p.images.filter((_, i) => i !== index) }))
                  }>
                  <Ionicons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            );
          })}
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
                  {step === 3 ? (isEditMode ? 'Cập nhật' : 'Gửi yêu cầu') : 'Tiếp tục'}
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
              onPress={() =>
                // Reset stack: bỏ màn tạo ticket khỏi lịch sử để nút back ở danh sách về Trang chủ,
                // đồng thời remount danh sách (load lại để thấy ticket vừa tạo).
                navigation.reset({
                  index: 1,
                  routes: [
                    { name: ROUTES.SCREENS.MAIN },
                    { name: ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST },
                  ],
                })
              }>
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
            <Text className="mb-3 text-center font-bold text-xl text-[#002147]">Tệp đính kèm</Text>
            <View className="mb-3 overflow-hidden rounded-xl border border-gray-200">
              <TouchableOpacity
                className="flex-row items-center border-b border-gray-100 px-4 py-4"
                onPress={pickFromCamera}>
                <Ionicons name="camera-outline" size={26} color="#FF5733" />
                <Text className="ml-3 text-base font-medium text-[#002147]">Chụp ảnh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center border-b border-gray-100 px-4 py-4"
                onPress={pickFromLibrary}>
                <Ionicons name="images-outline" size={26} color="#FF5733" />
                <Text className="ml-3 text-base font-medium text-[#002147]">Chọn từ thư viện</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-row items-center px-4 py-4" onPress={pickDocument}>
                <Ionicons name="document-attach-outline" size={26} color="#FF5733" />
                <Text className="ml-3 text-base font-medium text-[#002147]">Chọn tệp (tài liệu)</Text>
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
            related_department_ids: [],
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
        eventRoomItems,
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
        nonEventRoomItems,
        (v) => {
          setTicketData((p) => ({
            ...p,
            room_id: v,
            related_equipment_id: '',
            related_department_ids: [],
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
                const meta = formatStudentMeta(item);
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
                    <View className="ml-2 flex-1">
                      <Text className="text-base font-medium text-[#002147]">{item.student_name}</Text>
                      {meta ? <Text className="mt-0.5 text-sm text-gray-500">{meta}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text className="px-3 py-4 text-center text-sm text-gray-500">
                  {ticketStudents.length === 0
                    ? 'Không có học sinh'
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

      <BottomSheetModal
        visible={picker === 'staff'}
        onClose={() => setPicker(null)}
        maxHeightPercent={78}
        keyboardAvoiding
        bottomPaddingExtra={8}>
        <View className="p-4">
          <Text className="mb-3 text-center font-bold text-xl text-[#002147]">CBGVNV liên quan</Text>
          <View className="mb-3 flex-row items-center rounded-xl border border-gray-200 bg-white px-3 py-2.5">
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              className="ml-2 flex-1 py-1 text-base text-[#002147]"
              placeholder="Tìm theo tên hoặc phòng ban..."
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
              data={filteredStaffPickerRows}
              keyExtractor={(s) => s.user_id}
              style={{ maxHeight: listMaxH }}
              keyboardShouldPersistTaps="handled"
              extraData={ticketData.related_staff_ids}
              renderItem={({ item, index }) => {
                const sel = ticketData.related_staff_ids.includes(item.user_id);
                const meta = formatStaffMeta(item);
                return (
                  <TouchableOpacity
                    className={`flex-row items-center px-3 py-3 ${
                      index < filteredStaffPickerRows.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                    onPress={() => toggleStaff(item.user_id)}>
                    <Ionicons
                      name={sel ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={sel ? '#FF5733' : '#999'}
                    />
                    <View className="ml-2 flex-1">
                      <Text className="text-base font-medium text-[#002147]">
                        {normalizeVietnameseName(item.full_name)}
                      </Text>
                      {meta ? <Text className="mt-0.5 text-sm text-gray-500">{meta}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text className="px-3 py-4 text-center text-sm text-gray-500">
                  {ticketStaff.length === 0 ? 'Không có CBGVNV' : 'Không tìm thấy kết quả'}
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
