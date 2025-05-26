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
    TouchableWithoutFeedback
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
    deviceName
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
                })
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
                })
            ]).start();
        }
    }, [visible]);

    const toggleReason = (reason: string) => {
        setSelectedReasons(prev =>
            prev.includes(reason)
                ? prev.filter(r => r !== reason)
                : [...prev, reason]
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
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={handleCancel}>
                <Animated.View
                    className="flex-1 bg-black/40 justify-center items-center px-5"
                    style={{ opacity: fadeAnim }}
                >
                    <TouchableWithoutFeedback>
                        <Animated.View
                            className="w-full max-w-md bg-white rounded-[14px] overflow-hidden max-h-[80%]"
                            style={{
                                transform: [{
                                    translateY: slideAnim
                                }]
                            }}
                        >
                            {/* Header */}
                            <View className="p-5 pb-3">
                                <Text className="text-lg font-semibold text-black text-center mb-2.5">
                                    Báo hỏng thiết bị
                                </Text>


                                <Text className="text-base font-medium text-black mb-3">
                                    Lý do báo hỏng <Text className="text-red-500">*</Text>
                                </Text>
                            </View>

                            {/* Scrollable Content */}
                            <ScrollView
                                className="px-5 max-h-80"
                                showsVerticalScrollIndicator={false}
                            >
                                {/* Reason Selection */}
                                <View className="gap-2 mb-4">
                                    {BROKEN_REASONS.map((reason) => (
                                        <TouchableOpacity
                                            key={reason}
                                            onPress={() => toggleReason(reason)}
                                            className={`p-3 rounded-2xl ${selectedReasons.includes(reason)
                                                ? 'border-red-500 bg-red-50'
                                                : 'border-gray-200 bg-gray-50'
                                                }`}
                                        >
                                            <View className="flex-row items-center">
                                                <MaterialCommunityIcons
                                                    name={selectedReasons.includes(reason) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                                    size={18}
                                                    color={selectedReasons.includes(reason) ? '#EF4444' : '#6B7280'}
                                                />
                                                <Text className={`ml-2 text-sm ${selectedReasons.includes(reason) ? 'text-red-700 font-medium' : 'text-gray-700'
                                                    }`}>
                                                    {reason}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Custom Reason */}
                                <Text className="text-sm font-medium text-black mb-2">
                                    Mô tả chi tiết (tùy chọn)
                                </Text>
                                <TextInput
                                    value={customReason}
                                    onChangeText={setCustomReason}
                                    placeholder="Mô tả tình trạng hỏng hóc..."
                                    multiline={true}
                                    numberOfLines={3}
                                    className="border-none rounded-full p-3 text-sm text-black bg-gray-100 mb-4"
                                    textAlignVertical="top"
                                    placeholderTextColor="#999999"
                                />
                            </ScrollView>

                            {/* Action Buttons */}
                            <View className="flex-row -mx-5">
                                <TouchableOpacity
                                    className="flex-1 py-3 items-center justify-center bg-transparent"
                                    onPress={handleCancel}
                                    disabled={isLoading}
                                >
                                    <Text className="text-lg text-[#666666] font-medium">
                                        Hủy
                                    </Text>
                                </TouchableOpacity>
                                <View className="w-[0.5px] bg-[#E5E5E5]" />
                                <TouchableOpacity
                                    className="flex-1 py-3 items-center justify-center bg-transparent"
                                    onPress={handleConfirm}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator size="small" color="#EF4444" />
                                    ) : (
                                        <Text className="text-lg text-[#EF4444] font-semibold">
                                            Xác nhận
                                        </Text>
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