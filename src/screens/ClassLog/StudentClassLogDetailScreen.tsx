// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Platform,
  Keyboard,
} from 'react-native';
import { TouchableOpacity, BottomSheetModal } from '../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StudentAvatar } from '../../utils/studentAvatar';
import classLogService, {
  ClassLogOptionsResponse,
  ClassLogOption,
} from '../../services/classLogService';
import { attendanceApiService } from '../../services/attendanceApiService';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { formatTimeHHMM } from '../../utils/dateUtils';
import { ROUTES } from '../../constants/routes';
import HealthReportModal from './components/HealthReportModal';
import dailyHealthService from '../../services/dailyHealthService';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

type RouteParams = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.STUDENT_CLASS_LOG_DETAIL>;

const statusLabel: Record<AttendanceStatus, string> = {
  present: 'Có mặt',
  absent: 'Vắng',
  late: 'Muộn',
  excused: 'Vắng có phép',
};

const statusColors: Record<AttendanceStatus, { bg: string; text: string }> = {
  present: { bg: '#DCFCE7', text: '#166534' },
  absent: { bg: '#FEE2E2', text: '#991B1B' },
  late: { bg: '#FEF3C7', text: '#92400E' },
  excused: { bg: '#F3F4F6', text: '#4B5563' },
};

// Trạng thái Y tế đồng bộ với web
type HealthVisitStatus =
  | 'left_class'
  | 'at_clinic'
  | 'examining'
  | 'returned'
  | 'picked_up'
  | 'transferred';

const healthStatusConfig: Record<HealthVisitStatus, { label: string; bg: string; text: string }> = {
  left_class: { label: 'Chờ Y tế tiếp nhận', bg: '#F3F4F6', text: '#6B7280' },
  at_clinic: { label: 'Đang ở Y tế', bg: '#DBEAFE', text: '#2563EB' },
  examining: { label: 'Đang khám', bg: '#FFEDD5', text: '#EA580C' },
  returned: { label: 'Đã về lớp', bg: '#DCFCE7', text: '#16A34A' },
  picked_up: { label: 'Phụ huynh đón', bg: '#FCE7F3', text: '#DB2777' },
  transferred: { label: 'Chuyển viện', bg: '#FEE2E2', text: '#DC2626' },
};

// Key trong options response từ API
type OptionsKey = 'homework' | 'behavior' | 'participation' | 'issue' | 'top_performance';

// Labels theo đúng web: Bài tập về nhà, Thái độ học tập, Học tập, Lưu ý, Học sinh được khen
const optionLabels: Record<OptionsKey, { label: string; color: string }> = {
  homework: { label: 'Bài tập về nhà', color: '#3B82F6' },
  behavior: { label: 'Thái độ học tập', color: '#8B5CF6' },
  participation: { label: 'Học tập', color: '#10B981' },
  issue: { label: 'Lưu ý', color: '#EF4444' },
  top_performance: { label: 'Học sinh được khen', color: '#F59E0B' },
};

// Helper: thêm opacity vào màu hex
const getColorWithOpacity = (color: string, opacity: number = 0.15) => {
  if (!color || color === '#F6F6F6') return color;
  if (color.startsWith('#') && color.length === 7) {
    const opacityHex = Math.round(opacity * 255)
      .toString(16)
      .padStart(2, '0');
    return color + opacityHex;
  }
  return color;
};

// Component Select Picker
interface SelectPickerProps {
  label: string;
  color: string;
  options: ClassLogOption[];
  value: string;
  defaultValue?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const SelectPicker: React.FC<SelectPickerProps> = ({
  label,
  color,
  options,
  value,
  defaultValue,
  onChange,
  disabled,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Tìm option hiện tại (value hoặc default)
  const currentValue = value || defaultValue || '';
  const selectedOption = options.find((o) => o.name === currentValue);
  const displayText = selectedOption
    ? selectedOption.title_vn || selectedOption.title_en || selectedOption.name
    : 'Chọn...';
  const selectedColor = selectedOption?.color || color;

  return (
    <View style={{ marginBottom: 16 }}>
      {/* Label */}
      <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
        {label}
      </Text>

      {/* Select Button */}
      <TouchableOpacity
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: currentValue ? getColorWithOpacity(selectedColor) : '#F6F6F6',
          borderColor: currentValue ? selectedColor : '#E5E7EB',
          opacity: disabled ? 0.5 : 1,
        }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: currentValue ? selectedColor : '#9CA3AF',
          }}>
          {displayText}
        </Text>
        <Ionicons name="chevron-down" size={20} color={currentValue ? selectedColor : '#9CA3AF'} />
      </TouchableOpacity>

      {/* Modal Picker */}
      <BottomSheetModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        {/* Modal Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#F3F4F6',
          }}>
          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={{ fontSize: 16, color: '#6B7280' }}>Huỷ</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#1F2937' }}>{label}</Text>
          <TouchableOpacity
            onPress={() => {
              onChange('');
              setModalVisible(false);
            }}>
            <Text style={{ fontSize: 16, color: '#EF4444' }}>Xoá</Text>
          </TouchableOpacity>
        </View>

        {/* Options List */}
        <FlatList
          data={options}
          keyExtractor={(item) => item.name}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const isSelected = currentValue === item.name;
            const itemColor = item.color || color;
            const itemText = item.title_vn || item.title_en || item.name;
            const bgColor = getColorWithOpacity(itemColor, 0.12);

            return (
              <TouchableOpacity
                onPress={() => {
                  onChange(item.name);
                  setModalVisible(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  marginBottom: 8,
                  borderRadius: 12,
                  backgroundColor: bgColor,
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: isSelected ? itemColor : 'transparent',
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: isSelected ? '600' : '500',
                      color: itemColor,
                    }}>
                    {itemText}
                  </Text>
                  {item.is_default === 1 && (
                    <View
                      style={{
                        marginLeft: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        backgroundColor: getColorWithOpacity(itemColor, 0.2),
                        borderRadius: 4,
                      }}>
                      <Text style={{ fontSize: 11, color: itemColor }}>Mặc định</Text>
                    </View>
                  )}
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={itemColor} />}
              </TouchableOpacity>
            );
          }}
        />
      </BottomSheetModal>
    </View>
  );
};

// Component Multi Select Picker cho Lưu ý (chọn nhiều)
interface MultiSelectPickerProps {
  label: string;
  color: string;
  options: ClassLogOption[];
  values: string[]; // Mảng các name đã chọn
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

const MultiSelectPicker: React.FC<MultiSelectPickerProps> = ({
  label,
  color,
  options,
  values,
  onChange,
  disabled,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempValues, setTempValues] = useState<string[]>(values);

  // Khi mở modal, sync tempValues với values hiện tại
  const handleOpen = () => {
    setTempValues(values);
    setModalVisible(true);
  };

  // Toggle chọn/bỏ chọn option
  const toggleOption = (optionName: string) => {
    setTempValues((prev) =>
      prev.includes(optionName) ? prev.filter((v) => v !== optionName) : [...prev, optionName]
    );
  };

  // Lưu và đóng modal
  const handleSave = () => {
    onChange(tempValues);
    setModalVisible(false);
  };

  // Tìm các option đã chọn để hiển thị
  const selectedOptions = options.filter((o) => values.includes(o.name));
  const displayText =
    selectedOptions.length > 0
      ? selectedOptions.map((o) => o.title_vn || o.title_en || o.name).join(', ')
      : 'Chọn...';

  return (
    <View style={{ marginBottom: 16 }}>
      {/* Label */}
      <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
        {label}
      </Text>

      {/* Select Button */}
      <TouchableOpacity
        onPress={() => !disabled && handleOpen()}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: values.length > 0 ? getColorWithOpacity(color) : '#F6F6F6',
          borderWidth: 1,
          borderColor: values.length > 0 ? color : '#E5E7EB',
          opacity: disabled ? 0.5 : 1,
        }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: values.length > 0 ? color : '#9CA3AF',
            flex: 1,
          }}
          numberOfLines={2}>
          {displayText}
        </Text>
        <Ionicons name="chevron-down" size={20} color={values.length > 0 ? color : '#9CA3AF'} />
      </TouchableOpacity>

      {/* Modal Picker */}
      <BottomSheetModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        {/* Modal Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#F3F4F6',
          }}>
          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={{ fontSize: 16, color: '#6B7280' }}>Huỷ</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#1F2937' }}>{label}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={{ fontSize: 16, color: '#3B82F6', fontWeight: '600' }}>Xong</Text>
          </TouchableOpacity>
        </View>
        {/* Options List */}
        <FlatList
          data={options}
          keyExtractor={(item) => item.name}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const isSelected = tempValues.includes(item.name);
            const itemColor = item.color || color;
            const itemText = item.title_vn || item.title_en || item.name;
            const bgColor = getColorWithOpacity(itemColor, 0.12);

            return (
              <TouchableOpacity
                onPress={() => toggleOption(item.name)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  marginBottom: 8,
                  borderRadius: 12,
                  backgroundColor: bgColor,
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: isSelected ? itemColor : 'transparent',
                }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: isSelected ? '600' : '500',
                    color: itemColor,
                    flex: 1,
                  }}>
                  {itemText}
                </Text>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: isSelected ? itemColor : '#D1D5DB',
                    backgroundColor: isSelected ? itemColor : '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </BottomSheetModal>
    </View>
  );
};

// Component cho Biểu dương (checkbox style)
interface TopPerformanceToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const TopPerformanceToggle: React.FC<TopPerformanceToggleProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const config = optionLabels.top_performance;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
        {config.label}
      </Text>

      <TouchableOpacity
        onPress={() => !disabled && onChange(!value)}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: value ? getColorWithOpacity(config.color) : '#F6F6F6',
          borderWidth: 1,
          borderColor: value ? config.color : '#E5E7EB',
          opacity: disabled ? 0.5 : 1,
        }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: value ? config.color : '#6B7280',
          }}>
          {value ? 'Có' : 'Không'}
        </Text>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: value ? config.color : '#D1D5DB',
            backgroundColor: value ? config.color : '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {value && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const StudentClassLogDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();

  const {
    student,
    attendanceStatus: paramAttendance,
    isAtClinic: paramAtClinic,
    healthVisitInfo: paramHealthVisit,
    classId,
    date,
    period,
    initialData,
  } = route.params;

  const studentId = student.name || student.student_id;

  // Đồng bộ server khi vào lại màn (VD: Y tế từ chối → vẫn excused, không còn badge Y tế)
  const [attendanceStatus, setAttendanceStatus] = useState(paramAttendance);
  const [isAtClinic, setIsAtClinic] = useState(paramAtClinic);
  const [healthVisitInfo, setHealthVisitInfo] = useState(paramHealthVisit);
  /** Ghi chú điểm danh tiết/homeroom — dùng để gợi ý GV cập nhật tay sau luồng Xuống Y tế */
  const [attendanceRemarks, setAttendanceRemarks] = useState('');

  useEffect(() => {
    setAttendanceStatus(route.params.attendanceStatus);
    setIsAtClinic(route.params.isAtClinic);
    setHealthVisitInfo(route.params.healthVisitInfo);
  }, [
    route.params.attendanceStatus,
    route.params.isAtClinic,
    route.params.healthVisitInfo,
    studentId,
  ]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [periodRes, homeroomRes, healthRes] = await Promise.all([
            attendanceApiService.getClassAttendance(classId, date, period),
            attendanceApiService.getClassAttendance(classId, date, 'homeroom'),
            dailyHealthService.getHealthStatusForPeriod({ class_id: classId, date, period }),
          ]);
          if (cancelled) return;

          const rowsToMap = (rows: any[]): Record<string, AttendanceStatus> => {
            const m: Record<string, AttendanceStatus> = {};
            (rows || []).forEach((item: any) => {
              const id = item.student_id || item.name;
              if (id) m[id] = (item.status as AttendanceStatus) || 'present';
            });
            return m;
          };

          const periodRows =
            periodRes.success && Array.isArray(periodRes.data) ? periodRes.data : [];
          const homeroomRows =
            homeroomRes.success && Array.isArray(homeroomRes.data) ? homeroomRes.data : [];
          const hasPeriod = periodRows.length > 0;
          const baseMap = hasPeriod ? rowsToMap(periodRows) : rowsToMap(homeroomRows);
          const activeRows = hasPeriod ? periodRows : homeroomRows;
          const rec = activeRows.find((r: any) => (r.student_id || r.name) === studentId);
          setAttendanceRemarks(String(rec?.remarks || ''));

          const healthMap = healthRes?.students || {};
          const h = healthMap[studentId];
          const showHealth =
            !!h &&
            ['left_class', 'at_clinic', 'examining', 'picked_up', 'transferred'].includes(
              h.status || ''
            );

          const eff: AttendanceStatus = showHealth ? 'excused' : baseMap[studentId] || 'present';
          setAttendanceStatus(eff);
          setIsAtClinic(showHealth);
          setHealthVisitInfo(showHealth ? h : undefined);
        } catch (e) {
          console.error('StudentClassLogDetail sync attendance/health:', e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [classId, date, period, studentId])
  );

  const isToday = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return date === `${yyyy}-${mm}-${dd}`;
  }, [date]);

  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [options, setOptions] = useState<ClassLogOptionsResponse | null>(null);
  /**
   * Android: ScrollView không có automaticallyAdjustKeyboardInsets — cần paddingBottom theo bàn phím.
   * iOS: CHỈ dùng automaticallyAdjustKeyboardInsets; không gộp KeyboardAvoidingView + padding theo keyboard
   * (trùng lặp làm co layout / mất nội dung).
   */
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subShow = Keyboard.addListener('keyboardDidShow', (e) => {
      setAndroidKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const subHide = Keyboard.addListener('keyboardDidHide', () => setAndroidKeyboardHeight(0));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // Form state - lưu bằng option.name (ID) thay vì title
  // issues là mảng để hỗ trợ multi-select
  const [formData, setFormData] = useState({
    student_id: student.student_id || student.name,
    homework: initialData?.homework || '',
    behavior: initialData?.behavior || '',
    participation: initialData?.participation || '',
    issues: initialData?.issues ? initialData.issues.split(',').filter(Boolean) : ([] as string[]),
    is_top_performance: initialData?.is_top_performance === 1,
    specific_comment: initialData?.specific_comment || '',
  });

  // Load options on mount - lấy education_stage từ class để filter
  useEffect(() => {
    loadOptions();
  }, [classId]);

  const loadOptions = async () => {
    try {
      setOptionsLoading(true);

      // Bước 1: Lấy thông tin class để có education_grade
      let educationStageId: string | undefined;

      try {
        const classInfoRes = await attendanceApiService.getClassInfo(classId);
        console.log('📚 ClassInfo response:', classInfoRes);

        if (classInfoRes.success && classInfoRes.data?.education_grade) {
          const educationGrade = classInfoRes.data.education_grade;
          console.log('📚 Education grade:', educationGrade);

          // Bước 2: Lấy education_stage từ education_grade
          const stageRes = await attendanceApiService.getEducationStage(educationGrade);
          console.log('📚 Education stage response:', stageRes);

          if (stageRes.success && stageRes.data?.education_stage_id) {
            educationStageId = stageRes.data.education_stage_id;
            console.log('📚 Education stage ID:', educationStageId);
          }
        }
      } catch (err) {
        console.log('📚 Error fetching education stage, will load all options:', err);
      }

      // Bước 3: Lấy options với education_stage filter
      const optionsRes = await classLogService.getOptions(educationStageId);
      console.log('📚 Options loaded for stage:', educationStageId, optionsRes);
      setOptions(optionsRes);
    } catch (error) {
      console.error('Error loading options:', error);
    } finally {
      setOptionsLoading(false);
    }
  };

  // Tính giá trị mặc định cho mỗi loại
  const defaultOptions = useMemo(() => {
    if (!options) return { homework: '', behavior: '', participation: '' };

    const homeworkDefault = options.homework?.find((o) => o.is_default === 1);
    const behaviorDefault = options.behavior?.find((o) => o.is_default === 1);
    const participationDefault = options.participation?.find((o) => o.is_default === 1);

    return {
      homework: homeworkDefault?.name || '',
      behavior: behaviorDefault?.name || '',
      participation: participationDefault?.name || '',
    };
  }, [options]);

  const handleSave = async () => {
    try {
      setLoading(true);

      // Chuẩn bị payload - sử dụng giá trị default nếu chưa chọn
      // issues là mảng, cần chuyển thành string phân cách bằng dấu phẩy
      const payload = {
        class_id: classId,
        date,
        period,
        student_id: formData.student_id,
        homework: formData.homework || defaultOptions.homework,
        behavior: formData.behavior || defaultOptions.behavior,
        participation: formData.participation || defaultOptions.participation,
        issues: formData.issues.join(','),
        is_top_performance: formData.is_top_performance ? 1 : 0,
        specific_comment: formData.specific_comment,
      };

      const result = await classLogService.updateStudentNote(payload);

      if (!result.success) {
        throw new Error(result.message);
      }

      Alert.alert('Thành công', 'Đã lưu đánh giá', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể lưu đánh giá');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = useCallback(() => {
    const initialIssues = initialData?.issues ? initialData.issues.split(',').filter(Boolean) : [];
    const issuesChanged =
      formData.issues.length !== initialIssues.length ||
      formData.issues.some((v) => !initialIssues.includes(v));

    return (
      formData.homework !== (initialData?.homework || '') ||
      formData.behavior !== (initialData?.behavior || '') ||
      formData.participation !== (initialData?.participation || '') ||
      issuesChanged ||
      formData.is_top_performance !== (initialData?.is_top_performance === 1) ||
      formData.specific_comment !== (initialData?.specific_comment || '')
    );
  }, [formData, initialData]);

  const handleHealthReportSuccess = () => {
    setShowHealthModal(false);
    navigation.goBack();
  };

  const statusStyle = statusColors[attendanceStatus];
  const isAbsent = attendanceStatus === 'absent' || attendanceStatus === 'excused';

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
        }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 8, borderRadius: 20 }}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#1F2937', fontFamily: 'Mulish' }}>
          Đánh giá học sinh
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={loading || !hasChanges() || isAbsent}>
          {loading ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: hasChanges() && !isAbsent ? '#002855' : '#9CA3AF',
                fontFamily: 'Mulish',
              }}>
              Lưu
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom:
            24 + insets.bottom + (Platform.OS === 'android' ? androidKeyboardHeight : 0),
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
        {/* Student info card */}
        <View
          style={{
            backgroundColor: '#F9FAFB',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <StudentAvatar
              name={student.student_name}
              avatarUrl={student.user_image || student.avatar_url || student.photo}
              size={72}
            />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text
                style={{ fontSize: 20, fontWeight: '700', color: '#1F2937', fontFamily: 'Mulish' }}>
                {student.student_name}
              </Text>
              {student.student_code && (
                <Text
                  style={{ fontSize: 14, color: '#6B7280', marginTop: 4, fontFamily: 'Mulish' }}>
                  {student.student_code}
                </Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: statusStyle.bg,
                  }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: statusStyle.text,
                      fontFamily: 'Mulish',
                    }}>
                    {statusLabel[attendanceStatus]}
                  </Text>
                </View>
                {isAtClinic && (
                  <View
                    style={{
                      marginLeft: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: '#FEE2E2',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}>
                    <Ionicons name="medkit" size={14} color="#DC2626" />
                    <Text
                      style={{
                        marginLeft: 4,
                        fontSize: 13,
                        color: '#DC2626',
                        fontFamily: 'Mulish',
                      }}>
                      Đang ở Y tế
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Cảnh báo nếu học sinh vắng */}
        {isAbsent && (
          <View
            style={{
              backgroundColor: '#FEF3C7',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <Ionicons name="warning-outline" size={24} color="#92400E" />
            <Text
              style={{
                marginLeft: 12,
                fontSize: 14,
                color: '#92400E',
                flex: 1,
                fontFamily: 'Mulish',
              }}>
              Học sinh vắng mặt - không thể đánh giá
            </Text>
          </View>
        )}

        {/* Sau khi Y tế từ chối: server giữ excused, không còn visit trong API — nhắc GV điểm danh tay (đồng bộ nghiệp vụ backend) */}
        {attendanceStatus === 'excused' &&
          !isAtClinic &&
          attendanceRemarks.includes('Xuống Y tế') && (
            <View
              style={{
                backgroundColor: '#E0F2FE',
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'flex-start',
                borderWidth: 1,
                borderColor: '#7DD3FC',
              }}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#0369A1"
                style={{ marginTop: 1 }}
              />
              <Text
                style={{
                  marginLeft: 10,
                  fontSize: 13,
                  color: '#0C4A6E',
                  flex: 1,
                  fontFamily: 'Mulish',
                  lineHeight: 20,
                }}>
                Điểm danh tiết đang là Vắng có phép. Nếu học sinh đã có mặt tại lớp, vui lòng cập
                nhật thủ công ở màn Điểm danh.
              </Text>
            </View>
          )}

        {/* Health status display - nếu đã báo y tế */}
        {isAtClinic &&
          healthVisitInfo &&
          (() => {
            const visitStatus = (healthVisitInfo.status as HealthVisitStatus) || 'left_class';
            const config = healthStatusConfig[visitStatus] || healthStatusConfig.left_class;
            const showCancelButton =
              visitStatus === 'left_class' && isToday && healthVisitInfo.visit_id;
            return (
              <View style={{ marginBottom: 24 }}>
                <View
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: config.bg,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                  <Ionicons name="medkit" size={24} color={config.text} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: config.text,
                        fontFamily: 'Mulish',
                      }}>
                      {config.label}
                    </Text>
                    {healthVisitInfo.leave_class_time && (
                      <Text
                        style={{
                          fontSize: 13,
                          color: config.text,
                          marginTop: 2,
                          fontFamily: 'Mulish',
                          opacity: 0.8,
                        }}>
                        Rời lớp lúc {formatTimeHHMM(healthVisitInfo.leave_class_time)}
                      </Text>
                    )}
                  </View>
                </View>
                {showCancelButton && (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Hủy đơn báo Y tế',
                        'Xác nhận hủy đơn báo học sinh xuống Y tế? (Học sinh quay lại lớp / trốn đi chơi). Điểm danh sẽ được cập nhật về có mặt.',
                        [
                          { text: 'Đóng', style: 'cancel' },
                          {
                            text: 'Xác nhận hủy',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const result = await dailyHealthService.cancelHealthVisit(
                                  healthVisitInfo.visit_id
                                );
                                if (result.success) {
                                  Alert.alert('Thành công', 'Đã hủy đơn báo Y tế', [
                                    { text: 'OK', onPress: () => navigation.goBack() },
                                  ]);
                                } else {
                                  Alert.alert('Lỗi', result.message || 'Không thể hủy đơn');
                                }
                              } catch (error: any) {
                                Alert.alert('Lỗi', error.message || 'Không thể hủy đơn');
                              }
                            },
                          },
                        ]
                      );
                    }}
                    style={{
                      marginTop: 12,
                      padding: 16,
                      borderRadius: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: '#FECACA',
                      backgroundColor: '#FEF2F2',
                    }}>
                    <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                    <Text
                      style={{
                        marginLeft: 8,
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#DC2626',
                        fontFamily: 'Mulish',
                      }}>
                      Hủy báo Y tế
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}

        {/* Health report button - chỉ hiển thị trong ngày hôm nay và chưa báo y tế */}
        {!isAtClinic && !isAbsent && isToday && (
          <TouchableOpacity
            onPress={() => setShowHealthModal(true)}
            style={{
              marginBottom: 24,
              padding: 16,
              borderRadius: 16,
              backgroundColor: '#FEF2F2',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#FECACA',
            }}>
            <Ionicons name="medkit-outline" size={22} color="#DC2626" />
            <Text
              style={{
                marginLeft: 10,
                fontSize: 16,
                fontWeight: '600',
                color: '#DC2626',
                fontFamily: 'Mulish',
              }}>
              Báo Y tế
            </Text>
          </TouchableOpacity>
        )}

        {/* Class log options */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: '#1F2937',
            marginBottom: 16,
            fontFamily: 'Mulish',
          }}>
          Đánh giá tiết học
        </Text>

        {optionsLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <ActivityIndicator size="small" />
            <Text style={{ marginTop: 8, color: '#6B7280', fontFamily: 'Mulish' }}>
              Đang tải...
            </Text>
          </View>
        ) : (
          <>
            {/* Bài tập */}
            <SelectPicker
              label={optionLabels.homework.label}
              color={optionLabels.homework.color}
              options={options?.homework || []}
              value={formData.homework}
              defaultValue={defaultOptions.homework}
              onChange={(v) => setFormData((prev) => ({ ...prev, homework: v }))}
              disabled={isAbsent}
            />

            {/* Hành vi */}
            <SelectPicker
              label={optionLabels.behavior.label}
              color={optionLabels.behavior.color}
              options={options?.behavior || []}
              value={formData.behavior}
              defaultValue={defaultOptions.behavior}
              onChange={(v) => setFormData((prev) => ({ ...prev, behavior: v }))}
              disabled={isAbsent}
            />

            {/* Tham gia */}
            <SelectPicker
              label={optionLabels.participation.label}
              color={optionLabels.participation.color}
              options={options?.participation || []}
              value={formData.participation}
              defaultValue={defaultOptions.participation}
              onChange={(v) => setFormData((prev) => ({ ...prev, participation: v }))}
              disabled={isAbsent}
            />

            {/* Lưu ý - Multi select */}
            <MultiSelectPicker
              label={optionLabels.issue.label}
              color={optionLabels.issue.color}
              options={options?.issue || []}
              values={formData.issues}
              onChange={(v) => setFormData((prev) => ({ ...prev, issues: v }))}
              disabled={isAbsent}
            />

            {/* Biểu dương */}
            <TopPerformanceToggle
              value={formData.is_top_performance}
              onChange={(v) => setFormData((prev) => ({ ...prev, is_top_performance: v }))}
              disabled={isAbsent}
            />
          </>
        )}

        {/* Ghi chú */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: '#374151',
              marginBottom: 8,
              fontFamily: 'Mulish',
            }}>
            Ghi chú
          </Text>
          <TextInput
            value={formData.specific_comment}
            onChangeText={(text) => setFormData((prev) => ({ ...prev, specific_comment: text }))}
            placeholder="Nhập ghi chú cho học sinh..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            editable={!isAbsent}
            onFocus={() => {
              // Đưa ô Ghi chú vào vùng nhìn thấy phía trên bàn phím
              requestAnimationFrame(() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
              });
            }}
            style={{
              backgroundColor: '#F9FAFB',
              borderRadius: 12,
              padding: 16,
              fontSize: 15,
              color: '#1F2937',
              minHeight: 100,
              textAlignVertical: 'top',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              opacity: isAbsent ? 0.5 : 1,
            }}
          />
        </View>
      </ScrollView>

      {/* Health Report Modal */}
      <HealthReportModal
        visible={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        onSuccess={handleHealthReportSuccess}
        student={student}
        classId={classId}
        period={period}
        date={date}
      />
    </View>
  );
};

export default StudentClassLogDetailScreen;
