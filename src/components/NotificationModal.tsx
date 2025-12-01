import React from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
} from 'react-native';
import { TouchableOpacity } from './Common';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface NotificationModalProps {
    visible: boolean;
    type: 'success' | 'error';
    message: string;
    onClose: () => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({
    visible,
    type,
    message,
    onClose
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View className="flex-1 items-center justify-center bg-black/50">
                {/* Backdrop */}
                <Pressable
                    className="absolute bottom-0 left-0 right-0 top-0"
                    onPress={onClose}
                />

                {/* Modal Content */}
                <View className="w-[80%] overflow-hidden rounded-2xl bg-white">
                    <View className="items-center p-5">
                        {/* Icon */}
                        <View
                            className={`mb-4 h-16 w-16 items-center justify-center rounded-full ${type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}
                        >
                            <MaterialCommunityIcons
                                name={type === 'success' ? 'check-circle' : 'alert-circle'}
                                size={40}
                                color={type === 'success' ? '#10B981' : '#EF4444'}
                            />
                        </View>

                        <Text className="mb-2.5 text-center font-semibold text-lg text-black">
                            {type === 'success' ? 'Thành công' : 'Thông báo'}
                        </Text>
                        <Text className="mb-2 text-center text-base leading-[22px] text-gray-600">
                            {message}
                        </Text>
                    </View>

                    {/* Action Button */}
                    <View className="border-t border-gray-200">
                        <TouchableOpacity
                            className="items-center justify-center bg-transparent py-4"
                            onPress={onClose}
                        >
                            <Text
                                className={`font-semibold text-[17px] ${type === 'success' ? 'text-green-600' : 'text-[#FF3B30]'}`}
                            >
                                OK
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default NotificationModal; 