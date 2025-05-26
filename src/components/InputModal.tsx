import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
    TextInput
} from 'react-native';

interface InputModalProps {
    visible: boolean;
    title: string;
    placeholder?: string;
    value: string;
    onChangeText: (text: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
}

const { height } = Dimensions.get('window');

const InputModal: React.FC<InputModalProps> = ({
    visible,
    title,
    placeholder,
    value,
    onChangeText,
    onCancel,
    onConfirm
}) => {
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

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={onCancel}>
                <Animated.View
                    className="flex-1 bg-black/40 justify-center items-center"
                    style={{ opacity: fadeAnim }}
                >
                    <TouchableWithoutFeedback>
                        <Animated.View
                            className="w-[80%] bg-white rounded-[14px] overflow-hidden"
                            style={{
                                transform: [{
                                    translateY: slideAnim
                                }]
                            }}
                        >
                            <View className="p-5">
                                <Text className="text-lg font-semibold text-black text-center mb-2.5">
                                    {title}
                                </Text>
                                <TextInput
                                    className="w-full px-4 py-3 bg-[#F5F5F5] rounded-lg text-base text-black mb-5"
                                    placeholder={placeholder}
                                    value={value}
                                    onChangeText={onChangeText}
                                    placeholderTextColor="#999999"
                                />
                                <View className="flex-row mt-2.5 -mx-5">
                                    <TouchableOpacity
                                        className="flex-1 py-3 items-center justify-center bg-transparent"
                                        onPress={onCancel}
                                    >
                                        <Text className="text-[17px] text-[#666666] font-medium">
                                            Hủy
                                        </Text>
                                    </TouchableOpacity>
                                    <View className="w-[0.5px] bg-[#E5E5E5]" />
                                    <TouchableOpacity
                                        className="flex-1 py-3 items-center justify-center bg-transparent"
                                        onPress={onConfirm}
                                    >
                                        <Text className="text-[17px] text-[#FF3B30] font-semibold">
                                            Ok
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </Animated.View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

export default InputModal;
