import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from 'react-native';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import dailyHealthService from '../../../services/dailyHealthService';

interface HealthReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  student: {
    name: string;
    student_id?: string;
    student_name: string;
  };
  classId: string;
  period?: string;
  date?: string;
}

const HealthReportModal: React.FC<HealthReportModalProps> = ({
  visible,
  onClose,
  onSuccess,
  student,
  classId,
  period,
  date,
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Lấy thời gian hiện tại
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const handleSubmit = () => {
    if (!reason.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập lý do báo Y tế');
      return;
    }

    Alert.alert(
      'Xác nhận báo Y tế',
      `Bạn có chắc muốn báo học sinh ${student.student_name} xuống phòng Y tế?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          style: 'destructive',
          onPress: submitReport,
        },
      ]
    );
  };

  const submitReport = async () => {
    try {
      setLoading(true);
      const result = await dailyHealthService.reportStudentToClinic({
        student_id: student.student_id || student.name,
        class_id: classId,
        reason: reason.trim(),
        leave_class_time: getCurrentTime(),
        period,
        date,
      });

      if (result.success) {
        Alert.alert('Thành công', 'Đã báo Y tế thành công', [
          {
            text: 'OK',
            onPress: () => {
              setReason('');
              onSuccess();
              onClose();
            },
          },
        ]);
      } else {
        Alert.alert('Lỗi', result.message || 'Không thể báo Y tế. Vui lòng thử lại.');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể báo Y tế. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason('');
      onClose();
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={handleClose}
      keyboardAvoiding
      fillHeight
      maxHeightPercent={45}>
      {/* Header - chiều cao cố định */}
      <View className="flex-row items-center justify-between border-b border-gray-100 p-4">
        <TouchableOpacity onPress={handleClose} disabled={loading}>
          <Text className="text-gray-500">Hủy</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Báo Y tế</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Nội dung form - flex: 1 để chiếm phần còn lại */}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* Student info */}
        <View className="mb-4 flex-row items-center rounded-xl bg-red-50 p-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <Ionicons name="medkit" size={20} color="#DC2626" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-gray-900">{student.student_name}</Text>
            <Text className="text-sm text-gray-500">Thời gian: {getCurrentTime()}</Text>
          </View>
        </View>

        {/* Reason input */}
        <Text className="mb-2 text-sm font-medium text-gray-700">
          Lý do <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Nhập lý do báo Y tế (VD: Đau bụng, Sốt, Chóng mặt...)"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
          className="min-h-[100] rounded-xl bg-gray-50 p-3 text-gray-900"
          style={{ textAlignVertical: 'top' }}
          editable={!loading}
        />

        {/* Submit button */}
        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss();
            handleSubmit();
          }}
          disabled={loading || !reason.trim()}
          className="mt-4 flex-row items-center justify-center rounded-xl py-4"
          style={{
            backgroundColor: loading || !reason.trim() ? '#E5E7EB' : '#DC2626',
          }}>
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="medkit" size={20} color="#fff" />
              <Text className="ml-2 font-semibold text-white">Báo Y tế</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </BottomSheetModal>
  );
};

export default HealthReportModal;
