/**
 * Màn hình Thêm/Sửa ghi nhận lỗi kỷ luật
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
  TouchableOpacity as RNTouchableOpacity,
  Keyboard,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity, BottomSheetModal } from '../../components/Common';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import DatePickerModal from '../../components/DatePickerModal';
import disciplineRecordService from '../../services/disciplineRecordService';
import { getFullImageUrl } from '../../utils/imageUtils';
import { DisciplineTargetCard } from './components/DisciplineTargetCard';
import { ClassTargetCard } from './components/ClassTargetCard';
import { useAuth } from '../../context/AuthContext';
import {
  hasMobileDisciplineAccess,
  hasDisciplineSupervisoryUiRole,
  canModifyDisciplineRecordInSupervisoryUi,
  disciplineRecordCreatorId,
  getDisciplineSessionOwnerId,
} from '../../utils/disciplinePermissions';

// ─── Hằng số ────────────────────────────────────────────────────────────────

const PRIMARY = '#002855';
const ERROR = '#EF4444';
const MULISH = 'Mulish';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormData {
  date: string;
  classification: string;
  target_class_ids: string[];
  target_student_ids: string[];
  violation: string;
  form: string;
  time_slot_id: string;
  description: string;
}

type ProofImage = { type: 'file'; uri: string; name: string } | { type: 'url'; url: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateForInput = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ─── PickerField ──────────────────────────────────────────────────────────────

interface PickerFieldProps {
  label: string;
  value: string;
  options: { name: string; title?: string }[];
  onSelect: (v: string) => void;
  displayKey?: string;
  valueKey?: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
}

const PickerField: React.FC<PickerFieldProps> = ({
  label,
  value,
  options,
  onSelect,
  valueKey = 'name',
  error,
  placeholder = 'Chọn...',
  required = false,
}) => {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search
    ? options.filter((o) => (o.title || o.name).toLowerCase().includes(search.toLowerCase()))
    : options;

  const selected = options.find((o) => o[valueKey as keyof typeof o] === value);
  const display = selected ? selected.title || selected.name : placeholder;

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>
        {label} {required || error ? <Text style={styles.asterisk}>*</Text> : null}
      </Text>

      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={[styles.inputRow, styles.inputRowMultiline, error ? styles.inputError : null]}>
        <Text style={[styles.inputText, styles.inputTextWrap, !value && styles.placeholder]}>
          {display}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#9CA3AF" style={styles.inputRowChevron} />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BottomSheetModal
        visible={visible}
        onClose={() => setVisible(false)}
        maxHeightPercent={70}
        fillHeight>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetKeyboardView}
          keyboardVerticalOffset={0}>
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <TextInput
              placeholder="Tìm kiếm..."
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />
            <ScrollView
              style={styles.sheetList}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => Keyboard.dismiss()}>
              {filtered.map((o) => {
                const v = o[valueKey as keyof typeof o] as string;
                const isSelected = value === v;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => {
                      onSelect(v);
                      setVisible(false);
                      setSearch('');
                    }}
                    style={[
                      styles.sheetItem,
                      styles.sheetItemPickerOption,
                      isSelected && styles.sheetItemSelected,
                    ]}>
                    <Text
                      style={[
                        styles.sheetItemText,
                        styles.sheetItemTextWrap,
                        isSelected && styles.sheetItemTextSelected,
                      ]}>
                      {o.title || o.name}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={PRIMARY}
                        style={styles.sheetItemPickerCheck}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BottomSheetModal>
    </View>
  );
};

// ─── MultiClassPicker ─────────────────────────────────────────────────────────
// Lazy load: chỉ fetch khi mở modal. Dùng FlatList để virtualize danh sách dài.

interface MultiSelectPickerProps {
  label: string;
  values: string[];
  options: { name: string; title?: string }[];
  onChange: (v: string[]) => void;
  onLoadOptions?: () => Promise<void>;
  error?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  selectedCountLabel?: (n: number) => string;
  required?: boolean;
}

const MultiClassPicker: React.FC<MultiSelectPickerProps> = ({
  label,
  values,
  options,
  onChange,
  onLoadOptions,
  error,
  placeholder = 'Chọn lớp...',
  searchPlaceholder = 'Tìm kiếm lớp...',
  selectedCountLabel = (n) => (n ? `Đã chọn ${n} lớp` : 'Chọn lớp...'),
  required = false,
}) => {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const filtered = useMemo(
    () =>
      search
        ? options.filter((o) => (o.title || o.name).toLowerCase().includes(search.toLowerCase()))
        : options,
    [options, search]
  );

  const toggle = (id: string) => {
    onChange(values.includes(id) ? values.filter((x) => x !== id) : [...values, id]);
  };

  const handleOpen = useCallback(async () => {
    setVisible(true);
    if (onLoadOptions && !loaded) {
      setLoading(true);
      try {
        await onLoadOptions();
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    }
  }, [onLoadOptions, loaded]);

  const handleClose = () => {
    setVisible(false);
    setSearch('');
  };

  const renderItem = useCallback(
    ({ item }: { item: { name: string; title?: string } }) => {
      const isSelected = values.includes(item.name);
      return (
        <TouchableOpacity
          onPress={() => toggle(item.name)}
          style={[styles.sheetItem, isSelected && styles.sheetItemSelected]}>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.sheetItemText} numberOfLines={1}>
            {item.title || item.name}
          </Text>
        </TouchableOpacity>
      );
    },
    [values]
  );

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>
        {label} {required || error ? <Text style={styles.asterisk}>*</Text> : null}
      </Text>

      <TouchableOpacity
        onPress={handleOpen}
        style={[styles.inputRow, error ? styles.inputError : null]}>
        <Text style={[styles.inputText, !values.length && styles.placeholder]}>
          {selectedCountLabel(values.length)}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPercent={70} fillHeight>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetKeyboardView}
          keyboardVerticalOffset={0}>
          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { marginBottom: 0 }]}>{label}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.doneButtonHeader}>
                <Text style={styles.doneButtonText}>Xong</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder={searchPlaceholder}
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />
            {loading ? (
              <View style={styles.sheetListLoading}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={styles.sheetListLoadingText}>Đang tải danh sách lớp...</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(o) => o.name}
                renderItem={renderItem}
                style={styles.sheetListMultiClass}
                contentContainerStyle={styles.sheetListContent}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => Keyboard.dismiss()}
                showsVerticalScrollIndicator
                initialNumToRender={20}
                maxToRenderPerBatch={30}
                windowSize={10}
                ListEmptyComponent={
                  <View style={styles.sheetListEmpty}>
                    <Text style={styles.sheetListEmptyText}>
                      {search ? 'Không tìm thấy lớp phù hợp' : 'Chưa có dữ liệu lớp'}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </BottomSheetModal>
    </View>
  );
};

// ─── MultiStudentPicker ───────────────────────────────────────────────────────
// Mở modal: load danh sách học sinh đầy đủ. Search chỉ dùng để lọc thêm.

interface MultiStudentPickerProps {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  onStudentDetailsUpdate?: (
    partial: Record<
      string,
      {
        student_name?: string;
        student_code?: string;
        photo?: string | null;
        current_class_title?: string | null;
      }
    >
  ) => void;
  searchStudents: (query: string) => Promise<
    {
      name: string;
      student_name?: string;
      student_code?: string;
      photo?: string;
      user_image?: string;
      current_class?: { title?: string };
      /** API search_students_by_school_year trả flat từ SQL */
      current_class_title?: string;
    }[]
  >;
  error?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  selectedCountLabel?: (n: number) => string;
  required?: boolean;
}

const SEARCH_DEBOUNCE_MS = 350;

const MultiStudentPicker: React.FC<MultiStudentPickerProps> = ({
  label,
  values,
  onChange,
  onStudentDetailsUpdate,
  searchStudents,
  error,
  placeholder = 'Chọn học sinh...',
  searchPlaceholder = 'Tìm kiếm theo tên hoặc mã...',
  selectedCountLabel = (n) => (n ? `Đã chọn ${n} học sinh` : 'Chọn học sinh...'),
  required = false,
}) => {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [optionsWithRaw, setOptionsWithRaw] = useState<
    { name: string; title?: string; subtitle?: string; raw?: Record<string, unknown> }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggle = (
    id: string,
    item?: {
      student_name?: string;
      student_code?: string;
      photo?: string;
      user_image?: string;
      current_class?: { title?: string };
      current_class_title?: string;
    }
  ) => {
    const newValues = values.includes(id) ? values.filter((x) => x !== id) : [...values, id];
    onChange(newValues);
    if (item && !values.includes(id) && onStudentDetailsUpdate) {
      const classTitle = item.current_class?.title ?? item.current_class_title ?? null;
      onStudentDetailsUpdate({
        [id]: {
          student_name: item.student_name,
          student_code: item.student_code,
          photo: item.photo ?? item.user_image ?? null,
          current_class_title: classTitle,
        },
      });
    }
  };

  const fetchStudents = useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        const res = await searchStudents(query);
        const seen = new Set<string>();
        const unique = res.filter((s) => {
          if (seen.has(s.name)) return false;
          seen.add(s.name);
          return true;
        });
        setOptionsWithRaw(
          unique.map((s) => {
            const classLabel =
              s.current_class_title?.trim() || s.current_class?.title?.trim() || '';
            return {
              name: s.name,
              title: `${s.student_name || ''} (${s.student_code || ''})`,
              subtitle: classLabel,
              raw: s as Record<string, unknown>,
            };
          })
        );
      } catch {
        setOptionsWithRaw([]);
      } finally {
        setLoading(false);
      }
    },
    [searchStudents]
  );

  // Khi mở modal: load danh sách đầy đủ. Khi user gõ search: debounce rồi filter.
  useEffect(() => {
    if (!visible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = search.trim() ? SEARCH_DEBOUNCE_MS : 0;
    debounceRef.current = setTimeout(() => {
      fetchStudents(search.trim());
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [visible, search, fetchStudents]);

  const handleClose = () => {
    setVisible(false);
    setSearch('');
    setOptionsWithRaw([]);
  };

  const handleToggleWithRaw = (item: {
    name: string;
    title?: string;
    subtitle?: string;
    raw?: Record<string, unknown>;
  }) => {
    toggle(item.name, item.raw as Parameters<typeof toggle>[1]);
  };

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>
        {label} {required || error ? <Text style={styles.asterisk}>*</Text> : null}
      </Text>

      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={[styles.inputRow, error ? styles.inputError : null]}>
        <Text style={[styles.inputText, !values.length && styles.placeholder]}>
          {selectedCountLabel(values.length)}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPercent={70} fillHeight>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetKeyboardView}
          keyboardVerticalOffset={0}>
          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { marginBottom: 0 }]}>{label}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.doneButtonHeader}>
                <Text style={styles.doneButtonText}>Xong</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder={searchPlaceholder}
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />
            {loading ? (
              <View style={styles.sheetListLoading}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={styles.sheetListLoadingText}>
                  {search.trim() ? 'Đang tìm kiếm...' : 'Đang tải danh sách học sinh...'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={optionsWithRaw}
                keyExtractor={(o) => o.name}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleToggleWithRaw(item)}
                    style={[
                      styles.sheetItem,
                      values.includes(item.name) && styles.sheetItemSelected,
                    ]}>
                    <View
                      style={[
                        styles.checkbox,
                        values.includes(item.name) && styles.checkboxSelected,
                      ]}>
                      {values.includes(item.name) && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <View style={styles.sheetItemTextCol}>
                      <Text style={styles.sheetItemText} numberOfLines={1}>
                        {item.title || item.name}
                      </Text>
                      {item.subtitle ? (
                        <Text style={styles.sheetItemSubtitle} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                )}
                style={styles.sheetListMultiClass}
                contentContainerStyle={styles.sheetListContent}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => Keyboard.dismiss()}
                showsVerticalScrollIndicator
                initialNumToRender={20}
                maxToRenderPerBatch={30}
                windowSize={10}
                ListEmptyComponent={
                  <View style={styles.sheetListEmpty}>
                    <Text style={styles.sheetListEmptyText}>
                      {search.trim()
                        ? 'Không tìm thấy học sinh phù hợp'
                        : 'Chưa có dữ liệu học sinh'}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </BottomSheetModal>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const DisciplineAddEditScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { user } = useAuth();
  const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
  const sessionOwnerId = getDisciplineSessionOwnerId(user);
  const canAccessModule = hasMobileDisciplineAccess(roles);
  const canUseSupervisoryUi = hasDisciplineSupervisoryUiRole(roles);
  const params = (route.params as any) || {};
  const recordId = params.recordId as string | undefined;
  const isEdit = !!recordId;

  // ── State ──────────────────────────────────────────────────────────────────
  const [loadingRecord, setLoadingRecord] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [campusId, setCampusId] = useState('');
  const [enabledSchoolYearId, setEnabledSchoolYearId] = useState<string | null | undefined>(
    undefined
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    date: formatDateForInput(new Date()),
    classification: '',
    target_class_ids: [],
    target_student_ids: [],
    violation: '',
    form: '',
    time_slot_id: '',
    description: '',
  });

  /** Điểm trừ nhập tay per học sinh / lớp (mặc định 10) */
  const [targetStudentPoints, setTargetStudentPoints] = useState<Record<string, string>>({});
  const [targetClassPoints, setTargetClassPoints] = useState<Record<string, string>>({});

  const [classificationOptions, setClassificationOptions] = useState<
    { name: string; title?: string }[]
  >([]);
  const [allViolations, setAllViolations] = useState<
    { name: string; title?: string; classification?: string }[]
  >([]);
  const [formOptions, setFormOptions] = useState<{ name: string; title?: string }[]>([]);
  const [timeSlotOptions, setTimeSlotOptions] = useState<{ name: string; title?: string }[]>([]);
  const [classOptions, setClassOptions] = useState<{ name: string; title?: string }[]>([]);
  /** Chi tiết học sinh (tên, mã, ảnh, lớp) - dùng cho card đã chọn */
  const [studentDetailsMap, setStudentDetailsMap] = useState<
    Record<
      string,
      {
        student_name?: string;
        student_code?: string;
        photo?: string | null;
        current_class_title?: string | null;
      }
    >
  >({});
  const [proofImages, setProofImages] = useState<ProofImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Owner bản ghi khi sửa — dùng kiểm tra lại trước khi submit */
  const [editCreatorId, setEditCreatorId] = useState<string | null>(null);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Load campusId khi mount và mỗi khi màn hình được focus (vd: đổi campus ở Profile rồi quay lại)
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('currentCampusId').then((id) => setCampusId(id || ''));
    }, [])
  );

  useEffect(() => {
    if (!recordId || !isEdit) return;
    disciplineRecordService.getRecord(recordId).then((res) => {
      setLoadingRecord(false);
      if (res.success && res.data) {
        const d = res.data;
        const creatorId = disciplineRecordCreatorId(d);
        if (!canModifyDisciplineRecordInSupervisoryUi(roles, creatorId, sessionOwnerId)) {
          Alert.alert(
            'Không có quyền',
            'Bạn chỉ sửa được bản ghi do chính mình tạo, hoặc cần vai trò SIS Supervisory Admin.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        setEditCreatorId(creatorId);
        const dateStr = d.date
          ? d.date.split('T')[0] || d.date.split(' ')[0]
          : formatDateForInput(new Date());
        setFormData({
          date: dateStr,
          classification: d.classification || '',
          target_class_ids: (d.target_class_ids || []) as string[],
          target_student_ids: (d.target_student_ids ||
            (d.target_student ? [d.target_student] : [])) as string[],
          violation: d.violation || '',
          form: d.form || '',
          time_slot_id: (d as { time_slot_id?: string }).time_slot_id || '',
          description: (d as { description?: string }).description || '',
        });
        const existing = (d as { proof_images?: { image?: string }[] }).proof_images || [];
        setProofImages(
          existing
            .filter((img) => img?.image)
            .map((img) => ({ type: 'url' as const, url: img.image! }))
        );
        // Populate studentDetailsMap từ target_students khi edit
        const targets =
          (
            d as {
              target_students?: {
                student_id: string;
                student_name?: string;
                student_code?: string;
                student_class_title?: string;
                student_photo_url?: string | null;
                deduction_points?: string;
              }[];
            }
          ).target_students || [];
        const map: Record<
          string,
          {
            student_name?: string;
            student_code?: string;
            photo?: string | null;
            current_class_title?: string | null;
          }
        > = {};
        targets.forEach((t) => {
          if (t.student_id) {
            map[t.student_id] = {
              student_name: t.student_name,
              student_code: t.student_code,
              photo: t.student_photo_url ?? null,
              current_class_title: t.student_class_title ?? null,
            };
          }
        });
        setStudentDetailsMap(map);

        const sp: Record<string, string> = {};
        targets.forEach((t) => {
          if (t.student_id) {
            sp[t.student_id] = String(t.deduction_points ?? '10');
          }
        });
        setTargetStudentPoints(sp);

        const classEntries = (d as { target_class_entries?: { class_id: string; deduction_points?: string }[] })
          .target_class_entries;
        const cp: Record<string, string> = {};
        if (classEntries && classEntries.length > 0) {
          classEntries.forEach((ce) => {
            if (ce.class_id) cp[ce.class_id] = String(ce.deduction_points ?? '10');
          });
        } else {
          (d.target_class_ids || []).forEach((cid) => {
            cp[cid] = '10';
          });
        }
        setTargetClassPoints(cp);
      } else {
        Alert.alert('Lỗi', res.message || 'Không tìm thấy bản ghi', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    });
  }, [recordId, isEdit, navigation, roles, sessionOwnerId]);

  // Lấy năm học đang enable - gọi cả khi campusId rỗng (backend fallback không filter campus)
  useEffect(() => {
    disciplineRecordService.getEnabledSchoolYear(campusId || undefined).then((res) => {
      setEnabledSchoolYearId(res.success && res.data?.name ? res.data.name : null);
    });
  }, [campusId]);

  useEffect(() => {
    if (!campusId) return;
    Promise.all([
      disciplineRecordService.getClassifications(campusId),
      disciplineRecordService.getViolations(campusId),
      disciplineRecordService.getForms(campusId),
      disciplineRecordService.getTimes(campusId),
    ]).then(([cRes, vRes, fRes, tRes]) => {
      if (cRes.success && cRes.data) setClassificationOptions(cRes.data);
      if (vRes.success && vRes.data) setAllViolations(vRes.data);
      if (fRes.success && fRes.data) setFormOptions(fRes.data);
      if (tRes.success && tRes.data) setTimeSlotOptions(tRes.data);
    });
  }, [campusId]);

  // Lazy load lớp: chỉ fetch khi mở MultiClassPicker (không load sẵn khi mount)
  // Khi edit có target_class_ids: load 1 lần để hiển thị tên lớp trên card
  const loadClassOptions = useCallback(async () => {
    if (!enabledSchoolYearId) return;
    const res = await disciplineRecordService.getAllClasses(
      enabledSchoolYearId,
      campusId || undefined
    );
    setClassOptions(res.success && res.data ? res.data : []);
  }, [campusId, enabledSchoolYearId]);

  // Khi edit: load classOptions 1 lần để hiển thị tên lớp trên card đã chọn
  useEffect(() => {
    if (
      isEdit &&
      formData.target_class_ids.length > 0 &&
      enabledSchoolYearId &&
      classOptions.length === 0
    ) {
      loadClassOptions();
    }
  }, [
    isEdit,
    formData.target_class_ids.length,
    enabledSchoolYearId,
    classOptions.length,
    loadClassOptions,
  ]);

  // Search học sinh: gọi API khi user gõ trong MultiStudentPicker (search-first)
  const searchStudents = useCallback(
    async (query: string) => {
      if (!enabledSchoolYearId) return [];
      const res = await disciplineRecordService.searchStudentsBySchoolYear(
        query,
        enabledSchoolYearId
      );
      return res.success && res.data ? res.data : [];
    },
    [enabledSchoolYearId]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  /** Vi phạm chỉ hiển thị những bản ghi phụ thuộc vào phân loại đã chọn */
  const violationOptions = useMemo(() => {
    if (!formData.classification) return [];
    return allViolations
      .filter((v) => v.classification === formData.classification)
      .map((v) => ({ name: v.name, title: v.title || v.name }));
  }, [allViolations, formData.classification]);

  const handleClassificationChange = (v: string) => {
    setFormData((p) => {
      const newViolations = allViolations.filter((x) => x.classification === v);
      const violationStillValid = p.violation && newViolations.some((x) => x.name === p.violation);
      return {
        ...p,
        classification: v,
        violation: violationStillValid ? p.violation : '',
      };
    });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.date) e.date = 'Ngày là bắt buộc';
    if (!formData.classification) e.classification = 'Phân loại là bắt buộc';
    if (!formData.violation) e.violation = 'Vi phạm là bắt buộc';
    if (!formData.form) e.form = 'Hình thức là bắt buộc';
    if (!formData.description?.trim()) e.description = 'Mô tả là bắt buộc';
    if (formData.target_class_ids.length === 0 && formData.target_student_ids.length === 0) {
      e.targets = 'Chọn ít nhất một lớp hoặc một học sinh';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addImagesFromResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets?.length) {
      result.assets.forEach((asset) => {
        const fileName = asset.uri.split('/').pop() || 'image.jpg';
        setProofImages((prev) => [...prev, { type: 'file', uri: asset.uri, name: fileName }]);
      });
    }
  };

  const handlePickImage = () => {
    Alert.alert('Ảnh minh chứng', 'Chọn nguồn ảnh', [
      {
        text: 'Chụp ảnh',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Cần quyền', 'Vui lòng cho phép truy cập camera');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: false,
          });
          addImagesFromResult(result);
        },
      },
      {
        text: 'Chọn từ thư viện',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Cần quyền', 'Vui lòng cho phép truy cập thư viện ảnh');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsMultipleSelection: true,
          });
          addImagesFromResult(result);
        },
      },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  const removeProofImage = (index: number) => {
    setProofImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canAccessModule) return;
    if (!isEdit && !canUseSupervisoryUi) {
      Alert.alert(
        'Không có quyền',
        'Chỉ SIS Supervisory / SIS Supervisory Admin mới tạo được ghi nhận lỗi.'
      );
      return;
    }
    if (isEdit && recordId && editCreatorId != null) {
      if (!canModifyDisciplineRecordInSupervisoryUi(roles, editCreatorId, sessionOwnerId)) {
        Alert.alert('Không có quyền', 'Bạn không thể cập nhật bản ghi này.');
        return;
      }
    }
    if (!validate() || !campusId) return;
    if (!enabledSchoolYearId && !isEdit) {
      Alert.alert('Lỗi', 'Chưa có năm học đang áp dụng');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedUrls: { image: string }[] = [];
      for (const img of proofImages) {
        if (img.type === 'url') {
          uploadedUrls.push({ image: img.url });
        } else {
          const up = await disciplineRecordService.uploadFile({
            uri: img.uri,
            name: img.name,
            type: 'image/jpeg',
          });
          if (up.success && up.file_url) {
            uploadedUrls.push({ image: up.file_url });
          }
        }
      }

      const target_student_points: Record<string, string> = {};
      formData.target_student_ids.forEach((id) => {
        target_student_points[id] = targetStudentPoints[id] ?? '10';
      });
      const target_class_points: Record<string, string> = {};
      formData.target_class_ids.forEach((id) => {
        target_class_points[id] = targetClassPoints[id] ?? '10';
      });

      const basePayload = {
        date: formData.date,
        classification: formData.classification,
        violation: formData.violation,
        form: formData.form,
        time_slot_id: formData.time_slot_id || undefined,
        description: formData.description || undefined,
        proof_images: uploadedUrls,
        campus: campusId,
        ...(formData.target_student_ids.length > 0 ? { target_student_points } : {}),
        ...(formData.target_class_ids.length > 0 ? { target_class_points } : {}),
      };

      const targetType: 'class' | 'student' | 'mixed' =
        formData.target_class_ids.length > 0 && formData.target_student_ids.length > 0
          ? 'mixed'
          : formData.target_class_ids.length > 0
            ? 'class'
            : 'student';

      const payload = {
        ...basePayload,
        target_type: targetType,
        target_class_ids:
          formData.target_class_ids.length > 0 ? formData.target_class_ids : undefined,
        target_student_ids:
          formData.target_student_ids.length > 0 ? formData.target_student_ids : undefined,
        target_student:
          targetType === 'student' && formData.target_student_ids.length === 1
            ? formData.target_student_ids[0]
            : undefined,
      };

      if (isEdit && recordId) {
        const res = await disciplineRecordService.update({ ...payload, name: recordId });
        if (res.success) {
          Alert.alert('Thành công', 'Cập nhật thành công', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Lỗi', res.message || 'Không thể cập nhật');
        }
      } else {
        const res = await disciplineRecordService.create(payload);
        if (res.success) {
          Alert.alert('Thành công', 'Tạo ghi nhận lỗi thành công', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Lỗi', res.message || 'Không thể tạo');
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (!canAccessModule) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Ionicons name="lock-closed-outline" size={56} color="#D1D5DB" />
        <Text style={[styles.loadingText, { textAlign: 'center', paddingHorizontal: 24 }]}>
          Bạn cần quyền Mobile Supervisory để truy cập Kỷ luật trên ứng dụng.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            marginTop: 20,
            backgroundColor: PRIMARY,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
          }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isEdit && !canUseSupervisoryUi) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Ionicons name="shield-outline" size={56} color="#D1D5DB" />
        <Text style={[styles.loadingText, { textAlign: 'center', paddingHorizontal: 24 }]}>
          Chỉ tài khoản có vai trò SIS Supervisory hoặc SIS Supervisory Admin mới tạo được ghi nhận
          lỗi (giống web).
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            marginTop: 20,
            backgroundColor: PRIMARY,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
          }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadingRecord) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-full p-2">
          <Ionicons name="arrow-back" size={22} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Chỉnh sửa ghi nhận lỗi' : 'Thêm ghi nhận lỗi'}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          className="flex-1 px-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}>
          <Text style={styles.sectionHeading}>Chi tiết</Text>

          {/* Ngày */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              Ngày <Text style={styles.asterisk}>*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[styles.inputRow, errors.date ? styles.inputError : null]}>
              <Text style={styles.inputText}>{formData.date}</Text>
              <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {errors.date ? <Text style={styles.errorText}>{errors.date}</Text> : null}
          </View>

          {/* Tiết */}
          <PickerField
            label="Tiết"
            value={formData.time_slot_id}
            options={timeSlotOptions}
            onSelect={(v) => setFormData((p) => ({ ...p, time_slot_id: v }))}
            placeholder="Chọn tiết..."
          />

          <PickerField
            label="Phân loại"
            value={formData.classification}
            options={classificationOptions}
            onSelect={handleClassificationChange}
            error={errors.classification}
            required
            placeholder="Chọn phân loại..."
          />

          <PickerField
            label="Vi phạm"
            value={formData.violation}
            options={violationOptions}
            placeholder={!formData.classification ? 'Chọn phân loại trước' : 'Chọn vi phạm...'}
            onSelect={(v) => setFormData((p) => ({ ...p, violation: v }))}
            error={errors.violation}
            required
          />

          {/* Ảnh minh chứng — không bắt buộc */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Ảnh minh chứng (tùy chọn)</Text>
            <TouchableOpacity onPress={handlePickImage} style={styles.imagePicker}>
              <Ionicons name="camera-outline" size={22} color={PRIMARY} />
              <Text style={styles.imagePickerText}>Chụp ảnh / Chọn ảnh</Text>
            </TouchableOpacity>
            <Text style={styles.imageHint}>JPG, PNG, GIF. Tối đa 5MB</Text>

            {proofImages.length > 0 && (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {proofImages.map((img, idx) => (
                  <View key={idx} style={{ position: 'relative' }}>
                    <Image
                      source={{
                        uri: img.type === 'url' ? getFullImageUrl(img.url) || img.url : img.uri,
                      }}
                      style={styles.proofThumb}
                      resizeMode="cover"
                    />
                    <RNTouchableOpacity
                      onPress={() => removeProofImage(idx)}
                      style={styles.removeImageBtn}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </RNTouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Text style={styles.sectionHeading}>Đối tượng</Text>

          {/* Chọn lớp - lazy load khi mở modal, FlatList virtualize */}
          <MultiClassPicker
            label="Chọn lớp"
            values={formData.target_class_ids}
            options={classOptions}
            onChange={(v) => {
              setFormData((p) => ({ ...p, target_class_ids: v }));
              setTargetClassPoints((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((k) => {
                  if (!v.includes(k)) delete next[k];
                });
                v.forEach((id) => {
                  if (next[id] == null) next[id] = '10';
                });
                return next;
              });
            }}
            onLoadOptions={loadClassOptions}
            error={errors.targets}
            required
            placeholder="Chọn lớp..."
            selectedCountLabel={(n) => (n ? `Đã chọn ${n} lớp` : 'Chọn lớp...')}
          />

          {/* Chọn học sinh - search-first: chỉ gọi API khi user gõ tìm kiếm */}
          <MultiStudentPicker
            label="Chọn học sinh"
            values={formData.target_student_ids}
            onChange={(v) => {
              setFormData((p) => ({ ...p, target_student_ids: v }));
              setTargetStudentPoints((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((k) => {
                  if (!v.includes(k)) delete next[k];
                });
                v.forEach((id) => {
                  if (next[id] == null) next[id] = '10';
                });
                return next;
              });
            }}
            onStudentDetailsUpdate={(partial) =>
              setStudentDetailsMap((prev) => ({ ...prev, ...partial }))
            }
            searchStudents={searchStudents}
            error={errors.targets}
            required
            placeholder="Chọn học sinh..."
            selectedCountLabel={(n) => (n ? `Đã chọn ${n} học sinh` : 'Chọn học sinh...')}
          />

          {/* Đối tượng đã chọn - card nằm ngang, scroll khi overflow */}
          {(formData.target_class_ids.length > 0 || formData.target_student_ids.length > 0) && (
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Đối tượng đã chọn</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.targetScrollContent}
                style={styles.targetScroll}>
                {formData.target_class_ids.map((classId) => {
                  const item = classOptions.find((c) => c.name === classId);
                  return (
                    <ClassTargetCard
                      key={`class-${classId}`}
                      classId={classId}
                      classTitle={item?.title || item?.name || classId}
                      violationId={formData.violation}
                      referenceDate={formData.date}
                      deductionPoints={targetClassPoints[classId] ?? '10'}
                      onDeductionPointsChange={(pts) =>
                        setTargetClassPoints((p) => ({ ...p, [classId]: pts }))
                      }
                      onRemove={() => {
                        setFormData((p) => ({
                          ...p,
                          target_class_ids: p.target_class_ids.filter((x) => x !== classId),
                        }));
                        setTargetClassPoints((p) => {
                          const next = { ...p };
                          delete next[classId];
                          return next;
                        });
                      }}
                      showRemove
                    />
                  );
                })}
                {formData.target_student_ids.map((studentId) => {
                  const details = studentDetailsMap[studentId];
                  const displayName = details?.student_name || studentId;
                  const displayCode = details?.student_code || '';
                  const classTitle = details?.current_class_title ?? '';
                  const photoUrl = details?.photo ? getFullImageUrl(details.photo) : undefined;
                  return (
                    <DisciplineTargetCard
                      key={`student-${studentId}`}
                      studentId={studentId}
                      studentName={displayName || '-'}
                      studentCode={displayCode}
                      classTitle={classTitle || undefined}
                      avatarUrl={photoUrl}
                      schoolYearId={enabledSchoolYearId}
                      violationId={formData.violation}
                      referenceDate={formData.date}
                      deductionPoints={targetStudentPoints[studentId] ?? '10'}
                      onDeductionPointsChange={(pts) =>
                        setTargetStudentPoints((p) => ({ ...p, [studentId]: pts }))
                      }
                      onRemove={() => {
                        setFormData((p) => ({
                          ...p,
                          target_student_ids: p.target_student_ids.filter((x) => x !== studentId),
                        }));
                        setTargetStudentPoints((p) => {
                          const next = { ...p };
                          delete next[studentId];
                          return next;
                        });
                      }}
                      showRemove
                    />
                  );
                })}
              </ScrollView>
            </View>
          )}

          <Text style={styles.sectionHeading}>Kết luận</Text>

          <PickerField
            label="Hình thức"
            value={formData.form}
            options={formOptions}
            onSelect={(v) => setFormData((p) => ({ ...p, form: v }))}
            error={errors.form}
            required
            placeholder="Chọn hình thức..."
          />

          {/* Mô tả — bắt buộc, đồng bộ web AddRecord/EditRecord */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              Mô tả <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              value={formData.description}
              onChangeText={(t) => setFormData((p) => ({ ...p, description: t }))}
              placeholder="Nhập mô tả chi tiết"
              placeholderTextColor="#9CA3AF"
              style={[
                styles.textInput,
                { minHeight: 80, textAlignVertical: 'top' },
                errors.description ? styles.inputError : null,
              ]}
              multiline
            />
            {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
          </View>

          {/* Buttons */}
          <View className="mt-2 flex-row gap-3">
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={[styles.btnPrimary, { flex: 1 }]}>
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>{isEdit ? 'Cập nhật' : 'Lưu'}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={submitting}
              style={[styles.btnSecondary, { flex: 1 }]}>
              <Text style={styles.btnSecondaryText}>Hủy bỏ</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        value={formData.date ? new Date(formData.date) : new Date()}
        onSelect={(d) => setFormData((p) => ({ ...p, date: formatDateForInput(d) }))}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontFamily: MULISH,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY,
    fontFamily: MULISH,
    marginRight: 40, // bù lại nút back bên trái
  },

  // ── Form field ──────────────────────────────────────────────────────────
  fieldWrapper: {
    marginBottom: 16,
  },
  /** Tiêu đề nhóm: Chi tiết / Đối tượng / Kết luận */
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
    marginTop: 4,
    fontFamily: MULISH,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    fontFamily: MULISH,
  },
  asterisk: {
    color: ERROR,
  },
  errorText: {
    fontSize: 12,
    color: ERROR,
    marginTop: 4,
    fontFamily: MULISH,
  },

  // ── Input row (picker trigger) ───────────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  inputError: {
    borderWidth: 1,
    borderColor: ERROR,
  },
  inputText: {
    fontSize: 15,
    color: '#1F2937',
    flex: 1,
    fontFamily: MULISH,
  },
  /** PickerField: ô chọn dài — xuống dòng, không cắt một dòng */
  inputRowMultiline: {
    alignItems: 'flex-start',
  },
  inputTextWrap: {
    flexShrink: 1,
    minWidth: 0,
  },
  inputRowChevron: {
    marginTop: 2,
  },
  placeholder: {
    color: '#9CA3AF',
  },

  // ── Readonly field ───────────────────────────────────────────────────────
  readonlyField: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  readonlyText: {
    fontSize: 15,
    color: '#6B7280',
    fontFamily: MULISH,
  },

  // ── Text input ───────────────────────────────────────────────────────────
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
    fontFamily: MULISH,
    color: '#1F2937',
  },

  // ── Đối tượng (Lớp / Học sinh) chip ───────────────────────────────────────
  targetChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetChipActive: {
    backgroundColor: '#F97316',
  },
  targetChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    fontFamily: MULISH,
  },
  targetChipTextActive: {
    color: '#fff',
  },

  // ── Penalty chip ─────────────────────────────────────────────────────────
  penaltyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  penaltyChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  penaltyChipActive: {
    backgroundColor: PRIMARY,
  },
  penaltyChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    fontFamily: MULISH,
  },
  penaltyChipTextActive: {
    color: '#fff',
  },

  // ── Image picker ─────────────────────────────────────────────────────────
  imagePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
  },
  imagePickerText: {
    marginLeft: 10,
    fontSize: 15,
    color: PRIMARY,
    fontWeight: '500',
    fontFamily: MULISH,
  },
  imageHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    fontFamily: MULISH,
  },
  proofThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },

  // ── Buttons ──────────────────────────────────────────────────────────────
  btnPrimary: {
    backgroundColor: '#3F4246',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: MULISH,
  },
  btnSecondary: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: MULISH,
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  sheetContent: {
    flex: 1,
    padding: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY,
    marginBottom: 12,
    fontFamily: MULISH,
  },
  doneButtonHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: PRIMARY,
    borderRadius: 8,
  },
  sheetKeyboardView: {
    flex: 1,
    minHeight: 200,
  },
  sheetListMultiClass: {
    flex: 1,
  },
  sheetListContent: {
    paddingBottom: 16,
  },
  sheetListLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  sheetListLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontFamily: MULISH,
  },
  sheetListEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  sheetListEmptyText: {
    fontSize: 15,
    color: '#6B7280',
    fontFamily: MULISH,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
    fontFamily: MULISH,
  },
  sheetList: {
    flex: 1,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  /** Dòng option trong bottom sheet PickerField (phân loại / vi phạm / hình thức / tiết) */
  sheetItemPickerOption: {
    alignItems: 'flex-start',
  },
  sheetItemTextWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  sheetItemPickerCheck: {
    marginTop: 2,
    marginLeft: 4,
  },
  sheetItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  sheetItemTextCol: {
    flex: 1,
    minWidth: 0,
  },
  sheetItemText: {
    fontSize: 15,
    color: '#374151',
    fontFamily: MULISH,
  },
  sheetItemSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#6B7280',
    fontFamily: MULISH,
  },
  sheetItemTextSelected: {
    fontWeight: '600',
    color: PRIMARY,
  },

  // ── Đối tượng đã chọn (scroll ngang) ─────────────────────────────────────
  targetScroll: {
    marginTop: 8,
    marginHorizontal: -4,
  },
  targetScrollContent: {
    paddingVertical: 8,
    paddingRight: 16,
  },

  // ── Badge (giữ cho tương thích nếu cần) ───────────────────────────────────
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  badgeText: {
    fontSize: 13,
    color: '#374151',
    fontFamily: MULISH,
    maxWidth: 120,
  },

  // ── Checkbox (MultiClassPicker) ───────────────────────────────────────────
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY,
  },
  doneButton: {
    marginTop: 12,
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontFamily: MULISH,
  },
});

export default DisciplineAddEditScreen;
