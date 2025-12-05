// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import {
  leaveService,
  type ClassStudent,
  type CreateLeaveRequestData,
} from '../../services/leaveService';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

type CreateLeaveRequestNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.CREATE_LEAVE_REQUEST
>;

const REASONS = [
  { value: 'sick_child' as const, label: 'Con ốm' },
  { value: 'family_matters' as const, label: 'Gia đình có việc bận' },
  { value: 'other' as const, label: 'Lý do khác' },
];

const DateField = ({
  label,
  date,
  onPress,
}: {
  label: string;
  date: Date;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-3">
    <Text className="text-xs font-medium text-gray-500">
      {label} <Text className="text-red-500">*</Text>
    </Text>
    <View className="mt-1 flex-row items-center">
      <Ionicons name="calendar-outline" size={18} color="#6B7280" />
      <Text className="ml-2 text-sm font-semibold text-[#0A2240]">
        {format(date, 'dd/MM/yyyy', { locale: vi })}
      </Text>
    </View>
  </TouchableOpacity>
);

const CreateLeaveRequestScreen = () => {
  const navigation = useNavigation<CreateLeaveRequestNavigationProp>();
  const route = useRoute();
  // const { t } = useLanguage(); // i18n hook (unused here)
  const { user } = useAuth();

  // Get classId from route params
  const classId = (route.params as any)?.classId;
  const classTitle = (route.params as any)?.classTitle || '';

  // States
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedStudent, setSelectedStudent] = useState<ClassStudent | null>(null);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [reason, setReason] = useState<'sick_child' | 'family_matters' | 'other'>('sick_child');
  const [otherReason, setOtherReason] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  // Load students for the class
  useEffect(() => {
    const loadStudents = async () => {
      if (!classId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await leaveService.getClassStudents(classId);

        if (response.success && response.data) {
          setStudents(response.data);
        } else {
          Alert.alert('Lỗi', response.message || 'Không thể tải danh sách học sinh');
        }
      } catch (error) {
        console.error('Error loading students:', error);
        Alert.alert('Lỗi', 'Không thể tải danh sách học sinh');
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [classId]);

  const formatDateForServer = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedStudent) {
      Alert.alert('Lỗi', 'Vui lòng chọn học sinh');
      return;
    }

    if (startDate > endDate) {
      Alert.alert('Lỗi', 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
      return;
    }

    if (reason === 'other' && !otherReason.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập lý do khác');
      return;
    }

    setSubmitting(true);
    try {
      const data: CreateLeaveRequestData = {
        student_id: selectedStudent.student_id,
        reason,
        other_reason: reason === 'other' ? otherReason : undefined,
        start_date: formatDateForServer(startDate),
        end_date: formatDateForServer(endDate),
        creator_name: user?.full_name || user?.name || user?.email,
        creator_role: 'Teacher',
        creator_user_id: user?.name || user?._id,
        is_created_by_parent: false,
      };

      const response = await leaveService.createLeaveRequest(data);

      if (response.success) {
        Alert.alert('Thành công', 'Đã tạo đơn nghỉ phép thành công', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        Alert.alert('Lỗi', response.message || 'Không thể tạo đơn nghỉ phép');
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi tạo đơn nghỉ phép');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDateChange = (_: any, date?: Date) => {
    if (!date) {
      if (Platform.OS === 'android') {
        setPickerTarget(null);
      }
      return;
    }

    if (pickerTarget === 'start') {
      setStartDate(date);
      if (endDate < date) {
        setEndDate(date);
      }
    } else if (pickerTarget === 'end') {
      setEndDate(date);
    }

    if (Platform.OS === 'android') {
      setPickerTarget(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F05023" />
          <Text className="mt-4 text-gray-500">Đang tải dữ liệu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-4">
        <View className="mb-4 flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: -8,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color="#0A2240" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-2xl font-bold text-[#0A2240]">
            Tạo đơn nghỉ phép
          </Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Class Info */}
        {classTitle && (
          <View className="mb-4 rounded-lg bg-gray-50 p-3">
            <Text className="text-sm text-gray-500">Lớp</Text>
            <Text className="text-base font-semibold text-[#0A2240]">{classTitle}</Text>
          </View>
        )}

        {/* Student Selection */}
        <View className="mb-4">
          <Text className="mb-2 text-base font-medium text-[#0A2240]">
            Học sinh <Text className="text-red-500">*</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setShowStudentPicker(!showStudentPicker)}
            className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white p-4">
            <Text
              className={selectedStudent ? 'text-base text-[#0A2240]' : 'text-base text-gray-400'}>
              {selectedStudent
                ? `${selectedStudent.student_name} (${selectedStudent.student_code})`
                : 'Chọn học sinh'}
            </Text>
            <Ionicons
              name={showStudentPicker ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>

          {/* Student Picker Dropdown */}
          {showStudentPicker && (
            <View className="mt-2 max-h-60 rounded-lg border border-gray-200 bg-white shadow-sm">
              <ScrollView nestedScrollEnabled>
                {students.map((student) => (
                  <TouchableOpacity
                    key={student.student_id}
                    onPress={() => {
                      setSelectedStudent(student);
                      setShowStudentPicker(false);
                    }}
                    className={`border-b border-gray-100 p-4 ${
                      selectedStudent?.student_id === student.student_id ? 'bg-blue-50' : ''
                    }`}>
                    <Text className="text-base font-medium text-[#0A2240]">
                      {student.student_name}
                    </Text>
                    <Text className="text-sm text-gray-500">{student.student_code}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Reason Selection */}
        <View className="mb-4">
          <Text className="mb-2 text-base font-medium text-[#0A2240]">
            Lý do nghỉ <Text className="text-red-500">*</Text>
          </Text>
          <View className="space-y-2">
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                onPress={() => setReason(r.value)}
                className="flex-row items-center py-2">
                <View
                  className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                    reason === r.value ? 'border-[#F05023]' : 'border-gray-300'
                  }`}>
                  {reason === r.value && <View className="h-2.5 w-2.5 rounded-full bg-[#F05023]" />}
                </View>
                <Text className="text-base text-[#0A2240]">{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Other Reason Input */}
        {reason === 'other' && (
          <View className="mb-4">
            <Text className="mb-2 text-base font-medium text-[#0A2240]">
              Lý do khác <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={otherReason}
              onChangeText={setOtherReason}
              placeholder="Nhập lý do nghỉ cụ thể"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              className="rounded-lg border border-gray-300 bg-white p-4 text-base text-[#0A2240]"
              style={{ textAlignVertical: 'top', minHeight: 80 }}
              editable={!submitting}
            />
          </View>
        )}

        {/* Date Selection */}
        <View className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-[#0A2240]">Thời gian nghỉ</Text>
            <Text className="text-xs text-gray-500">Chọn khoảng ngày</Text>
          </View>
          <View className="flex-row gap-3">
            <DateField
              label="Ngày bắt đầu"
              date={startDate}
              onPress={() => setPickerTarget((prev) => (prev === 'start' ? null : 'start'))}
            />
            <DateField
              label="Ngày kết thúc"
              date={endDate}
              onPress={() => setPickerTarget((prev) => (prev === 'end' ? null : 'end'))}
            />
          </View>
        </View>

        {/* Date Picker Modal */}
        <Modal
          transparent
          animationType="fade"
          visible={!!pickerTarget}
          onRequestClose={() => setPickerTarget(null)}>
          <TouchableWithoutFeedback onPress={() => setPickerTarget(null)}>
            <View className="flex-1 items-center justify-center bg-black/30 px-6">
              <TouchableWithoutFeedback onPress={() => {}}>
                <View className="w-full rounded-2xl bg-white p-4 shadow-lg">
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-[#0A2240]">
                      {pickerTarget === 'start' ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc'}
                    </Text>
                    <TouchableOpacity onPress={() => setPickerTarget(null)}>
                      <Ionicons name="close" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  {pickerTarget && (
                    <DateTimePicker
                      value={pickerTarget === 'start' ? startDate : endDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleDateChange}
                      minimumDate={pickerTarget === 'end' ? startDate : undefined}
                      locale="vi"
                    />
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Action Buttons */}
        <View className="mt-5 flex-row gap-3 pb-6">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className={`flex-1 items-center rounded-lg py-3 ${
              submitting ? 'bg-gray-300' : 'bg-[#3F4246]'
            }`}>
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-semibold text-white">Lưu</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={submitting}
            className="flex-1 items-center rounded-lg border border-gray-300 bg-white py-3">
            <Text className="text-base font-semibold text-[#0A2240]">Hủy bỏ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CreateLeaveRequestScreen;
