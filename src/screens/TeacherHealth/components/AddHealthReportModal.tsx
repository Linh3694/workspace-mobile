import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Pressable,
} from 'react-native';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from '../../../hooks/useLanguage';
import healthReportService, {
  HealthReport,
  PorridgeDate,
  CreateHealthReportParams,
  UpdateHealthReportParams,
} from '../../../services/healthReportService';
import studentService, { Student } from '../../../services/studentService';
import DatePickerModal from '../../../components/DatePickerModal';

// Hằng số cho thời gian đăng ký bữa cháo
const LUNCH_AFTERNOON_DEADLINE_HOUR = 9;
const BREAKFAST_DEADLINE_HOUR = 20;

interface Props {
  visible: boolean;
  onClose: () => void;
  classId: string;
  editingReport?: HealthReport | null;
  onSuccess: () => void;
}

interface PorridgeDateForm {
  date: Date;
  breakfast: boolean;
  lunch: boolean;
  afternoon: boolean;
}

// Format date YYYY-MM-DD
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Format date DD/MM/YYYY
const formatDateDisplay = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Start of day
const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Difference in calendar days
const differenceInCalendarDays = (date1: Date, date2: Date): number => {
  const d1 = startOfDay(date1);
  const d2 = startOfDay(date2);
  return Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
};

const AddHealthReportModal: React.FC<Props> = ({
  visible,
  onClose,
  classId,
  editingReport,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Students list
  const [students, setStudents] = useState<Student[]>([]);
  const [showStudentPicker, setShowStudentPicker] = useState(false);

  // Form state
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [description, setDescription] = useState('');
  const [hasPorridge, setHasPorridge] = useState(false);
  const [porridgeDates, setPorridgeDates] = useState<PorridgeDateForm[]>([]);
  const [porridgeNote, setPorridgeNote] = useState('');

  // State cho thêm ngày mới
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newBreakfast, setNewBreakfast] = useState(true);
  const [newLunch, setNewLunch] = useState(true);
  const [newAfternoon, setNewAfternoon] = useState(true);

  // Fetch students
  const fetchStudents = useCallback(async () => {
    if (!classId) return;
    setLoadingStudents(true);
    try {
      const response = await studentService.getStudentsByClass(classId);
      if (response.success && response.data) {
        setStudents(response.data);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoadingStudents(false);
    }
  }, [classId]);

  // Load students when modal opens
  useEffect(() => {
    if (visible && classId) {
      fetchStudents();
    }
  }, [visible, classId, fetchStudents]);

  // Reset form khi mở modal
  useEffect(() => {
    if (visible) {
      if (editingReport) {
        const student = students.find((s) => s.name === editingReport.student_id);
        setSelectedStudent(student || null);
        setDescription(editingReport.description);
        setHasPorridge(!!editingReport.porridge_registration);
        setPorridgeDates(
          editingReport.porridge_dates?.map((pd) => ({
            date: new Date(pd.date),
            breakfast: !!pd.breakfast,
            lunch: !!pd.lunch,
            afternoon: !!pd.afternoon,
          })) || []
        );
        setPorridgeNote(editingReport.porridge_note || '');
      } else {
        setSelectedStudent(null);
        setDescription('');
        setHasPorridge(false);
        setPorridgeDates([]);
        setPorridgeNote('');
      }
      setNewDate(undefined);
      setNewBreakfast(true);
      setNewLunch(true);
      setNewAfternoon(true);
    }
  }, [visible, editingReport, students]);

  // Kiểm tra bữa ăn nào có thể đăng ký
  const mealAvailability = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const today = startOfDay(now);

    if (!newDate) {
      return { breakfast: true, lunch: true, afternoon: true, message: '' };
    }

    const selectedDay = startOfDay(newDate);
    const daysDiff = differenceInCalendarDays(selectedDay, today);

    // Ngày trong quá khứ
    if (daysDiff < 0) {
      return {
        breakfast: false,
        lunch: false,
        afternoon: false,
        message: 'Không thể đăng ký cho ngày trong quá khứ',
      };
    }

    // Ngày hôm nay
    if (daysDiff === 0) {
      const canLunchAfternoon = currentHour < LUNCH_AFTERNOON_DEADLINE_HOUR;
      return {
        breakfast: false,
        lunch: canLunchAfternoon,
        afternoon: canLunchAfternoon,
        message: !canLunchAfternoon
          ? `Bữa trưa và xế phải đăng ký trước ${LUNCH_AFTERNOON_DEADLINE_HOUR}h`
          : 'Bữa sáng phải đăng ký từ ngày hôm trước',
      };
    }

    // Ngày mai
    if (daysDiff === 1) {
      const canBreakfast = currentHour < BREAKFAST_DEADLINE_HOUR;
      return {
        breakfast: canBreakfast,
        lunch: true,
        afternoon: true,
        message: !canBreakfast
          ? `Bữa sáng ngày mai phải đăng ký trước ${BREAKFAST_DEADLINE_HOUR}h hôm nay`
          : '',
      };
    }

    return { breakfast: true, lunch: true, afternoon: true, message: '' };
  }, [newDate]);

  // Auto uncheck khi ngày thay đổi
  useEffect(() => {
    if (!mealAvailability.breakfast && newBreakfast) setNewBreakfast(false);
    if (!mealAvailability.lunch && newLunch) setNewLunch(false);
    if (!mealAvailability.afternoon && newAfternoon) setNewAfternoon(false);
  }, [mealAvailability, newBreakfast, newLunch, newAfternoon]);

  // Thêm ngày ăn cháo
  const handleAddPorridgeDate = () => {
    if (!newDate) {
      Alert.alert('Lỗi', 'Vui lòng chọn ngày');
      return;
    }

    const today = startOfDay(new Date());
    const selectedDay = startOfDay(newDate);
    if (selectedDay < today) {
      Alert.alert('Lỗi', 'Không thể đăng ký cho ngày trong quá khứ');
      return;
    }

    const hasValidMeal =
      (newBreakfast && mealAvailability.breakfast) ||
      (newLunch && mealAvailability.lunch) ||
      (newAfternoon && mealAvailability.afternoon);

    if (!hasValidMeal) {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất 1 bữa');
      return;
    }

    const dateStr = formatDate(newDate);
    const exists = porridgeDates.some((pd) => formatDate(pd.date) === dateStr);
    if (exists) {
      Alert.alert('Lỗi', 'Ngày này đã được thêm');
      return;
    }

    setPorridgeDates([
      ...porridgeDates,
      {
        date: newDate,
        breakfast: newBreakfast && mealAvailability.breakfast,
        lunch: newLunch && mealAvailability.lunch,
        afternoon: newAfternoon && mealAvailability.afternoon,
      },
    ]);

    setNewDate(undefined);
    setNewBreakfast(true);
    setNewLunch(true);
    setNewAfternoon(true);
  };

  // Xóa ngày
  const handleRemovePorridgeDate = (index: number) => {
    setPorridgeDates(porridgeDates.filter((_, i) => i !== index));
  };

  // Submit
  const handleSubmit = async () => {
    if (!selectedStudent) {
      Alert.alert('Lỗi', 'Vui lòng chọn học sinh');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mô tả sức khoẻ');
      return;
    }

    if (hasPorridge && porridgeDates.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng thêm ít nhất 1 ngày ăn cháo');
      return;
    }

    setIsSubmitting(true);

    try {
      const porridgeDatesData: PorridgeDate[] = hasPorridge
        ? porridgeDates.map((pd) => ({
            date: formatDate(pd.date),
            breakfast: pd.breakfast,
            lunch: pd.lunch,
            afternoon: pd.afternoon,
          }))
        : [];

      if (editingReport) {
        const params: UpdateHealthReportParams = {
          report_id: editingReport.name,
          description: description.trim(),
          porridge_registration: hasPorridge,
          porridge_dates: porridgeDatesData,
          porridge_note: hasPorridge ? porridgeNote.trim() : undefined,
        };

        const response = await healthReportService.updateHealthReport(params);

        if (response.success) {
          onSuccess();
          Alert.alert('Thành công', 'Đã cập nhật báo cáo sức khoẻ');
        } else {
          Alert.alert('Lỗi', response.message || 'Cập nhật thất bại');
        }
      } else {
        const params: CreateHealthReportParams = {
          student_id: selectedStudent.name,
          class_id: classId,
          description: description.trim(),
          porridge_registration: hasPorridge,
          porridge_dates: porridgeDatesData,
          porridge_note: hasPorridge ? porridgeNote.trim() : undefined,
        };

        const response = await healthReportService.createHealthReport(params);

        if (response.success) {
          onSuccess();
          Alert.alert('Thành công', `Đã thêm báo cháo cho ${selectedStudent.student_name}`);
        } else {
          Alert.alert('Lỗi', response.message || 'Tạo báo cháo thất bại');
        }
      }
    } catch (error) {
      console.error('Error submitting:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render meal badges
  const renderMealBadges = (pd: PorridgeDateForm) => {
    return (
      <View className="flex-row gap-1">
        {pd.breakfast && (
          <View className="rounded-full bg-emerald-100 px-2 py-0.5">
            <Text className="text-xs font-medium text-emerald-700">Sáng</Text>
          </View>
        )}
        {pd.lunch && (
          <View className="rounded-full bg-sky-100 px-2 py-0.5">
            <Text className="text-xs font-medium text-sky-700">Trưa</Text>
          </View>
        )}
        {pd.afternoon && (
          <View className="rounded-full bg-violet-100 px-2 py-0.5">
            <Text className="text-xs font-medium text-violet-700">Chiều</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={90} fillHeight>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4">
          <Text className="text-lg font-bold text-[#002855]">
            {editingReport ? 'Sửa báo cáo' : 'Thêm báo cháo'}
          </Text>
          <TouchableOpacity onPress={onClose} className="p-1">
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {/* Chọn học sinh */}
          <View className="mb-4 mt-4">
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Học sinh <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => !editingReport && setShowStudentPicker(true)}
              disabled={!!editingReport}
              className={`flex-row items-center justify-between rounded-xl border border-gray-200 px-4 py-3 ${
                editingReport ? 'bg-gray-100' : 'bg-white'
              }`}>
              <Text
                className={`flex-1 text-base ${
                  selectedStudent ? 'text-[#002855]' : 'text-gray-400'
                }`}>
                {selectedStudent
                  ? `${selectedStudent.student_name} - ${selectedStudent.student_code}`
                  : 'Chọn học sinh...'}
              </Text>
              {!editingReport && <Ionicons name="chevron-down" size={20} color="#666" />}
            </TouchableOpacity>
          </View>

          {/* Mô tả sức khoẻ */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Mô tả sức khoẻ <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Nhập mô tả tình trạng sức khoẻ..."
              multiline
              numberOfLines={3}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-[#002855]"
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
          </View>

          {/* Đăng ký ăn cháo */}
          <View className="mb-4 flex-row items-center justify-between rounded-xl bg-gray-50 p-4">
            <Text className="text-base font-medium text-[#002855]">Đăng ký ăn cháo</Text>
            <Switch
              value={hasPorridge}
              onValueChange={setHasPorridge}
              trackColor={{ false: '#E5E7EB', true: '#002855' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Form thêm ngày ăn cháo */}
          {hasPorridge && (
            <View className="mb-4 rounded-xl bg-gray-50 p-4">
              {/* Lưu ý */}
              <View className="mb-4">
                <Text className="mb-2 text-sm font-medium text-gray-700">Lưu ý về cháo</Text>
                <TextInput
                  value={porridgeNote}
                  onChangeText={setPorridgeNote}
                  placeholder="VD: Cháo loãng, không hành..."
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-base text-[#002855]"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Chọn ngày */}
              <Text className="mb-2 text-sm font-medium text-gray-700">Thêm ngày ăn cháo</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="mb-3 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                <View className="flex-row items-center">
                  <Ionicons name="calendar-outline" size={20} color="#002855" />
                  <Text className={`ml-2 text-base ${newDate ? 'text-[#002855]' : 'text-gray-400'}`}>
                    {newDate ? formatDateDisplay(newDate) : 'Chọn ngày...'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>

              {/* Checkbox bữa ăn */}
              <View className="mb-3 flex-row items-center justify-between">
                <Pressable
                  onPress={() => mealAvailability.breakfast && setNewBreakfast(!newBreakfast)}
                  className="flex-row items-center">
                  <View
                    className={`mr-2 h-5 w-5 items-center justify-center rounded border ${
                      newBreakfast && mealAvailability.breakfast
                        ? 'border-[#002855] bg-[#002855]'
                        : 'border-gray-300 bg-white'
                    } ${!mealAvailability.breakfast ? 'opacity-50' : ''}`}>
                    {newBreakfast && mealAvailability.breakfast && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <Text
                    className={`text-sm ${
                      mealAvailability.breakfast ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                    Sáng
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => mealAvailability.lunch && setNewLunch(!newLunch)}
                  className="flex-row items-center">
                  <View
                    className={`mr-2 h-5 w-5 items-center justify-center rounded border ${
                      newLunch && mealAvailability.lunch
                        ? 'border-[#002855] bg-[#002855]'
                        : 'border-gray-300 bg-white'
                    } ${!mealAvailability.lunch ? 'opacity-50' : ''}`}>
                    {newLunch && mealAvailability.lunch && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <Text
                    className={`text-sm ${
                      mealAvailability.lunch ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                    Trưa
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => mealAvailability.afternoon && setNewAfternoon(!newAfternoon)}
                  className="flex-row items-center">
                  <View
                    className={`mr-2 h-5 w-5 items-center justify-center rounded border ${
                      newAfternoon && mealAvailability.afternoon
                        ? 'border-[#002855] bg-[#002855]'
                        : 'border-gray-300 bg-white'
                    } ${!mealAvailability.afternoon ? 'opacity-50' : ''}`}>
                    {newAfternoon && mealAvailability.afternoon && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <Text
                    className={`text-sm ${
                      mealAvailability.afternoon ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                    Chiều
                  </Text>
                </Pressable>
              </View>

              {/* Thông báo hạn chế */}
              {mealAvailability.message && (
                <View className="mb-3 flex-row items-start rounded-lg bg-amber-50 p-2">
                  <Ionicons name="alert-circle" size={16} color="#D97706" style={{ marginTop: 2 }} />
                  <Text className="ml-2 flex-1 text-xs text-amber-700">{mealAvailability.message}</Text>
                </View>
              )}

              {/* Nút thêm ngày */}
              <TouchableOpacity
                onPress={handleAddPorridgeDate}
                className="mb-4 flex-row items-center justify-center rounded-lg border border-[#002855] bg-white py-2">
                <Ionicons name="add" size={20} color="#002855" />
                <Text className="ml-1 text-sm font-medium text-[#002855]">Thêm ngày</Text>
              </TouchableOpacity>

              {/* Danh sách ngày đã chọn */}
              {porridgeDates.length > 0 && (
                <View>
                  <Text className="mb-2 text-sm font-medium text-gray-700">
                    Đã đăng ký: {porridgeDates.length} ngày
                  </Text>
                  {porridgeDates
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .map((pd, index) => (
                      <View
                        key={index}
                        className="mb-2 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
                        <View className="flex-row items-center">
                          <Text className="mr-3 text-sm font-medium text-[#002855]">
                            {formatDateDisplay(pd.date)}
                          </Text>
                          {renderMealBadges(pd)}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemovePorridgeDate(index)}
                          className="rounded-full bg-red-50 p-1">
                          <Ionicons name="close" size={16} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    ))}
                </View>
              )}
            </View>
          )}

          {/* Spacing bottom */}
          <View className="h-24" />
        </ScrollView>

        {/* Footer buttons */}
        <View className="flex-row items-center border-t border-gray-100 px-5 py-4">
          <TouchableOpacity
            onPress={onClose}
            disabled={isSubmitting}
            className="mr-3 flex-1 items-center rounded-xl border border-gray-200 py-3">
            <Text className="text-base font-semibold text-gray-600">Hủy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 items-center rounded-xl bg-[#002855] py-3">
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {editingReport ? 'Cập nhật' : 'Thêm mới'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Student Picker Modal */}
      <BottomSheetModal
        visible={showStudentPicker}
        onClose={() => setShowStudentPicker(false)}
        maxHeightPercent={70}
        fillHeight>
        <View className="flex-1">
          <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4">
            <Text className="text-lg font-bold text-[#002855]">Chọn học sinh</Text>
            <TouchableOpacity onPress={() => setShowStudentPicker(false)} className="p-1">
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {loadingStudents ? (
            <View className="flex-1 items-center justify-center py-8">
              <ActivityIndicator size="large" color="#002855" />
            </View>
          ) : (
            <ScrollView className="flex-1">
              {students.map((student) => (
                <TouchableOpacity
                  key={student.name}
                  onPress={() => {
                    setSelectedStudent(student);
                    setShowStudentPicker(false);
                  }}
                  className={`flex-row items-center border-b border-gray-50 px-5 py-4 ${
                    selectedStudent?.name === student.name ? 'bg-blue-50' : ''
                  }`}>
                  <View className="flex-1">
                    <Text
                      className={`text-base ${
                        selectedStudent?.name === student.name
                          ? 'font-bold text-[#002855]'
                          : 'text-gray-800'
                      }`}>
                      {student.student_name}
                    </Text>
                    <Text className="text-sm text-gray-500">{student.student_code}</Text>
                  </View>
                  {selectedStudent?.name === student.name && (
                    <Ionicons name="checkmark-circle" size={24} color="#002855" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </BottomSheetModal>

      {/* Date Picker */}
      <DatePickerModal
        visible={showDatePicker}
        value={newDate || new Date()}
        onSelect={(date) => {
          setNewDate(date);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />
    </BottomSheetModal>
  );
};

export default AddHealthReportModal;
