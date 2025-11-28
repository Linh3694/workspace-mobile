// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ReportBrokenModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  deviceName: string;
}

const BROKEN_REASONS = [
  'Hỏng phần cứng',
  'Lỗi phần mềm',
  'Màn hình bị vỡ',
  'Bàn phím/chuột không hoạt động',
  'Quá hạn sử dụng',
  'Không khởi động được',
  'Kết nối mạng có vấn đề',
  'Pin hỏng/không sạc được',
];

const { height } = Dimensions.get('window');

const ReportBrokenModal: React.FC<ReportBrokenModalProps> = ({
  visible,
  onClose,
  onConfirm,
  deviceName,
}) => {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const handleConfirm = async () => {
    if (selectedReasons.length === 0 && customReason.trim() === '') {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất một lý do báo hỏng');
      return;
    }

    try {
      setIsLoading(true);

      const allReasons = [...selectedReasons];
      if (customReason.trim()) {
        allReasons.push(customReason.trim());
      }

      const finalReason = allReasons.join(', ');
      await onConfirm(finalReason);

      // Reset form
      setSelectedReasons([]);
      setCustomReason('');
      onClose();
    } catch (error) {
      console.error('Error reporting broken device:', error);
      Alert.alert('Lỗi', 'Không thể báo hỏng thiết bị. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedReasons([]);
    setCustomReason('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={handleCancel}>
        <Animated.View
          className="flex-1 items-center justify-center bg-black/40 px-5"
          style={{ opacity: fadeAnim }}>
          <TouchableWithoutFeedback>
            <Animated.View
              className="max-h-[80%] w-full max-w-md overflow-hidden rounded-[14px] bg-white"
              style={{
                transform: [
                  {
                    translateY: slideAnim,
                  },
                ],
              }}>
              {/* Header */}
              <View className="p-5 pb-3">
                <Text className="mb-2.5 text-center font-semibold text-lg text-black">
                  Báo hỏng thiết bị
                </Text>

                <Text className="mb-3 font-medium text-base text-black">
                  Lý do báo hỏng <Text className="text-red-500">*</Text>
                </Text>
              </View>

              {/* Scrollable Content */}
              <ScrollView className="max-h-80 px-5" showsVerticalScrollIndicator={false}>
                {/* Reason Selection */}
                <View className="mb-4 gap-2">
                  {BROKEN_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      onPress={() => toggleReason(reason)}
                      className={`rounded-2xl p-3 ${
                        selectedReasons.includes(reason)
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}>
                      <View className="flex-row items-center">
                        <MaterialCommunityIcons
                          name={
                            selectedReasons.includes(reason)
                              ? 'checkbox-marked'
                              : 'checkbox-blank-outline'
                          }
                          size={18}
                          color={selectedReasons.includes(reason) ? '#F05023' : '#6B7280'}
                        />
                        <Text
                          className={`ml-2 text-sm ${
                            selectedReasons.includes(reason)
                              ? 'font-medium text-[#F05023]'
                              : 'text-gray-700'
                          }`}>
                          {reason}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom Reason */}
                <Text className="mb-2 font-medium text-sm text-black">
                  Mô tả chi tiết (tùy chọn)
                </Text>
                <TextInput
                  value={customReason}
                  onChangeText={setCustomReason}
                  placeholder="Mô tả tình trạng hỏng hóc..."
                  multiline={true}
                  numberOfLines={3}
                  className="mb-4 rounded-full border-none bg-gray-100 p-3 text-sm text-black"
                  textAlignVertical="top"
                  placeholderTextColor="#999999"
                />
              </ScrollView>

              {/* Action Buttons */}
              <View className="-mx-5 my-2 flex-row">
                <TouchableOpacity
                  className="flex-1 items-center justify-center bg-transparent py-3"
                  onPress={handleCancel}
                  disabled={isLoading}>
                  <Text className="font-medium text-lg text-[#666666]">Hủy</Text>
                </TouchableOpacity>
                <View className="w-[0.5px] bg-[#E5E5E5]" />
                <TouchableOpacity
                  className="flex-1 items-center justify-center bg-transparent py-3"
                  onPress={handleConfirm}
                  disabled={isLoading}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Text className="font-semibold text-lg text-[#EF4444]">Xác nhận</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default ReportBrokenModal;
