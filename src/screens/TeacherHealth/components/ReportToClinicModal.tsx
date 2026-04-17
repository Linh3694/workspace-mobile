import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../../hooks/useLanguage';
import dailyHealthService from '../../../services/dailyHealthService';
import studentService, { Student } from '../../../services/studentService';

interface Props {
  visible: boolean;
  onClose: () => void;
  classId: string;
  onSuccess: () => void;
}

const ReportToClinicModal: React.FC<Props> = ({ visible, onClose, classId, onSuccess }) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Students list
  const [students, setStudents] = useState<Student[]>([]);
  const [showStudentPicker, setShowStudentPicker] = useState(false);

  // Form state
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [reason, setReason] = useState('');

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
      setSelectedStudent(null);
      setReason('');
    }
  }, [visible]);

  // Submit
  const handleSubmit = async () => {
    if (!selectedStudent) {
      Alert.alert('Lỗi', 'Vui lòng chọn học sinh');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập lý do');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const leaveTime = `${hours}:${minutes}`;

      const response = await dailyHealthService.reportStudentToClinic({
        student_id: selectedStudent.name,
        class_id: classId,
        reason: reason.trim(),
        leave_class_time: leaveTime,
      });

      if (response.success) {
        Alert.alert(
          'Thành công',
          `Đã báo ${selectedStudent.student_name} xuống phòng Y tế`,
          [{ text: 'OK', onPress: () => onSuccess() }]
        );
      } else {
        Alert.alert('Lỗi', response.message || 'Báo Y tế thất bại');
      }
    } catch (error) {
      console.error('Error reporting to clinic:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={70} fillHeight>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4">
          <Text className="text-lg font-bold text-[#002855]">Báo học sinh xuống Y tế</Text>
          <TouchableOpacity onPress={onClose} className="p-1">
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {/* Mô tả */}
          <Text className="mb-4 mt-4 text-sm text-gray-500">
            Thông báo cho phòng Y tế về học sinh cần thăm khám
          </Text>

          {/* Chọn học sinh */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Học sinh <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setShowStudentPicker(true)}
              className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
              <Text
                className={`flex-1 text-base ${
                  selectedStudent ? 'text-[#002855]' : 'text-gray-400'
                }`}>
                {selectedStudent
                  ? `${selectedStudent.student_name} - ${selectedStudent.student_code}`
                  : 'Chọn học sinh...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Lý do */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Lý do <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Nhập lý do cần xuống Y tế..."
              multiline
              numberOfLines={3}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-[#002855]"
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
          </View>

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
              <Text className="text-base font-semibold text-white">Báo Y tế</Text>
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
    </BottomSheetModal>
  );
};

export default ReportToClinicModal;
