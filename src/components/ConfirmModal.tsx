import React from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
} from 'react-native';
import { TouchableOpacity } from './Common';

interface ConfirmModalProps {
    visible: boolean;
    title: string;
    message: string;
    onCancel: () => void;
    onConfirm: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    visible,
    title,
    message,
    onCancel,
    onConfirm
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onCancel}
        >
            <View className="flex-1 items-center justify-center bg-black/50">
                {/* Backdrop */}
                <Pressable
                    className="absolute bottom-0 left-0 right-0 top-0"
                    onPress={onCancel}
                />

                {/* Modal Content */}
                <View className="w-[80%] overflow-hidden rounded-2xl bg-white">
                    <View className="p-5">
                        <Text className="mb-2.5 text-center font-semibold text-lg text-black">
                            {title}
                        </Text>
                        <Text className="mb-5 text-center text-base leading-[22px] text-gray-600">
                            {message}
                        </Text>
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row border-t border-gray-200">
                        <TouchableOpacity
                            className="flex-1 items-center justify-center bg-transparent py-4"
                            onPress={onCancel}
                        >
                            <Text className="font-medium text-[17px] text-gray-600">
                                Hủy
                            </Text>
                        </TouchableOpacity>
                        <View className="w-px bg-gray-200" />
                        <TouchableOpacity
                            className="flex-1 items-center justify-center bg-transparent py-4"
                            onPress={onConfirm}
                        >
                            <Text className="font-semibold text-[17px] text-[#FF3B30]">
                                Ok
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default ConfirmModal; 