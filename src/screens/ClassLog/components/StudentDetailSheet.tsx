import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { StudentAvatar } from '../../../utils/studentAvatar';
import classLogService, {
  ClassLogOptionsResponse,
  ClassLogStudent,
  ClassLogOption,
} from '../../../services/classLogService';
import HealthReportModal from './HealthReportModal';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

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

interface StudentDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: ClassLogStudent) => Promise<void>;
  onHealthReportSuccess: () => void;
  student: {
    name: string;
    student_id?: string;
    student_name: string;
    student_code?: string;
    user_image?: string;
    avatar_url?: string;
    photo?: string;
  };
  attendanceStatus: AttendanceStatus;
  isAtClinic?: boolean;
  classId: string;
  date: string;
  period: string;
  initialData?: ClassLogStudent;
  options?: ClassLogOptionsResponse | null;
}

// Key trong formData (vẫn giữ homework_status để lưu vào DB)
type FormKey = 'homework_status' | 'behavior' | 'participation' | 'issue' | 'top_performance';
// Key trong options response từ API (homework thay vì homework_status)
type OptionsKey = 'homework' | 'behavior' | 'participation' | 'issue' | 'top_performance';

// Map từ OptionsKey sang FormKey
const optionsKeyToFormKey: Record<OptionsKey, FormKey> = {
  homework: 'homework_status',
  behavior: 'behavior',
  participation: 'participation',
  issue: 'issue',
  top_performance: 'top_performance',
};

const optionLabels: Record<OptionsKey, { label: string; icon: string; color: string }> = {
  homework: { label: 'Bài tập', icon: 'document-text-outline', color: '#3B82F6' },
  behavior: { label: 'Hành vi', icon: 'person-outline', color: '#8B5CF6' },
  participation: { label: 'Tham gia', icon: 'hand-left-outline', color: '#10B981' },
  issue: { label: 'Vấn đề', icon: 'warning-outline', color: '#EF4444' },
  top_performance: { label: 'Biểu dương', icon: 'star-outline', color: '#F59E0B' },
};

const StudentDetailSheet: React.FC<StudentDetailSheetProps> = ({
  visible,
  onClose,
  onSave,
  onHealthReportSuccess,
  student,
  attendanceStatus,
  isAtClinic,
  classId,
  date,
  period,
  initialData,
  options,
}) => {
  const [loading, setLoading] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ClassLogStudent>({
    student_id: student.student_id || student.name,
    homework_status: initialData?.homework_status || '',
    behavior: initialData?.behavior || '',
    participation: initialData?.participation || '',
    issue: initialData?.issue || '',
    top_performance: initialData?.top_performance || '',
    notes: initialData?.notes || '',
  });

  // Reset form when student changes
  useEffect(() => {
    setFormData({
      student_id: student.student_id || student.name,
      homework_status: initialData?.homework_status || '',
      behavior: initialData?.behavior || '',
      participation: initialData?.participation || '',
      issue: initialData?.issue || '',
      top_performance: initialData?.top_performance || '',
      notes: initialData?.notes || '',
    });
  }, [student, initialData]);

  const handleSelectOption = (formKey: FormKey, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [formKey]: prev[formKey] === value ? '' : value,
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await onSave(formData);
      Alert.alert('Thành công', 'Đã lưu ghi chú');
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể lưu ghi chú');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    return (
      formData.homework_status !== (initialData?.homework_status || '') ||
      formData.behavior !== (initialData?.behavior || '') ||
      formData.participation !== (initialData?.participation || '') ||
      formData.issue !== (initialData?.issue || '') ||
      formData.top_performance !== (initialData?.top_performance || '') ||
      formData.notes !== (initialData?.notes || '')
    );
  };

  const statusStyle = statusColors[attendanceStatus];

  const renderOptionSection = (optionsKey: OptionsKey) => {
    const config = optionLabels[optionsKey];
    const formKey = optionsKeyToFormKey[optionsKey];
    const optionList: ClassLogOption[] = options?.[optionsKey] || [];

    if (optionList.length === 0) return null;

    return (
      <View key={optionsKey} className="mb-4">
        <View className="mb-2 flex-row items-center">
          <Ionicons name={config.icon as any} size={18} color={config.color} />
          <Text className="ml-2 text-sm font-medium text-gray-700">{config.label}</Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {optionList.map((option) => {
            // Sử dụng title_vn làm giá trị hiển thị và lưu
            const displayText = option.title_vn || option.title_en || option.name;
            const isSelected = formData[formKey] === displayText;
            const buttonColor = option.color || config.color;

            return (
              <TouchableOpacity
                key={option.name}
                onPress={() => handleSelectOption(formKey, displayText)}
                className="rounded-lg border px-3 py-2"
                style={{
                  backgroundColor: isSelected ? buttonColor : '#fff',
                  borderColor: isSelected ? buttonColor : '#E5E7EB',
                }}>
                <Text className="text-sm" style={{ color: isSelected ? '#fff' : '#374151' }}>
                  {displayText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <>
      <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={85} fillHeight>
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-gray-100 p-4">
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-900">Chi tiết học sinh</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading || !hasChanges()}>
            {loading ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <Text
                className="font-medium"
                style={{ color: hasChanges() ? '#4F46E5' : '#9CA3AF' }}>
                Lưu
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-4">
            {/* Student info card */}
            <View className="mb-4 rounded-xl bg-gray-50 p-4">
              <View className="flex-row items-center">
                <StudentAvatar
                  name={student.student_name}
                  avatarUrl={student.user_image || student.avatar_url || student.photo}
                  size={64}
                />
                <View className="ml-3 flex-1">
                  <Text className="text-lg font-semibold text-gray-900">
                    {student.student_name}
                  </Text>
                  {student.student_code && (
                    <Text className="text-sm text-gray-500">{student.student_code}</Text>
                  )}
                  <View className="mt-2 flex-row items-center">
                    <View
                      className="rounded-full px-2 py-1"
                      style={{ backgroundColor: statusStyle.bg }}>
                      <Text className="text-xs font-medium" style={{ color: statusStyle.text }}>
                        {statusLabel[attendanceStatus]}
                      </Text>
                    </View>
                    {isAtClinic && (
                      <View className="ml-2 flex-row items-center rounded-full bg-red-100 px-2 py-1">
                        <Ionicons name="medkit" size={12} color="#DC2626" />
                        <Text className="ml-1 text-xs text-red-700">Đang ở Y tế</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Health report button */}
            {!isAtClinic && attendanceStatus !== 'excused' && (
              <TouchableOpacity
                onPress={() => setShowHealthModal(true)}
                className="mb-4 flex-row items-center justify-center rounded-xl border border-red-200 bg-red-50 p-2">
                <Ionicons name="medkit-outline" size={12} color="#DC2626" />
                <Text className="ml-2 font-semibold text-red-700">Báo Y tế</Text>
              </TouchableOpacity>
            )}

            {/* Class log options */}
            <Text className="mb-3 text-base font-semibold text-gray-900">Ghi sổ đầu bài</Text>

            {renderOptionSection('homework')}
            {renderOptionSection('behavior')}
            {renderOptionSection('participation')}
            {renderOptionSection('top_performance')}
            {renderOptionSection('issue')}

            {/* Notes */}
            <View className="mb-4">
              <View className="mb-2 flex-row items-center">
                <Ionicons name="create-outline" size={18} color="#6B7280" />
                <Text className="ml-2 text-sm font-medium text-gray-700">Ghi chú</Text>
              </View>
              <TextInput
                value={formData.notes}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, notes: text }))}
                placeholder="Nhập ghi chú..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                className="min-h-[80] rounded-xl bg-gray-50 p-3 text-gray-900"
                style={{ textAlignVertical: 'top' }}
              />
            </View>
          </View>
        </ScrollView>
      </BottomSheetModal>

      {/* Health Report Modal */}
      <HealthReportModal
        visible={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        onSuccess={() => {
          setShowHealthModal(false);
          onHealthReportSuccess();
        }}
        student={student}
        classId={classId}
        period={period}
        date={date}
      />
    </>
  );
};

export default StudentDetailSheet;
