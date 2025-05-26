import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
    FlatList
} from 'react-native';

interface SelectModalProps<T> {
    visible: boolean;
    title: string;
    options: T[];
    keyExtractor: (item: T) => string;
    renderLabel: (item: T) => string;
    onCancel: () => void;
    onSelect: (item: T) => void;
}

const { height } = Dimensions.get('window');

function SelectModal<T>({
    visible,
    title,
    options,
    keyExtractor,
    renderLabel,
    onCancel,
    onSelect
}: SelectModalProps<T>) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(height)).current;
    const [selectedItem, setSelectedItem] = useState<T | null>(null);

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
            setSelectedItem(null);
        }
    }, [visible]);

    const handleConfirm = () => {
        if (selectedItem) {
            onSelect(selectedItem);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
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
                                <FlatList
                                    data={options}
                                    keyExtractor={keyExtractor}
                                    className="max-h-[200px]"
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            onPress={() => setSelectedItem(item)}
                                            className={`py-3 ${selectedItem === item ? 'bg-[#F5F5F5]' : ''}`}
                                        >
                                            <Text className="text-base text-[#333333] text-center">
                                                {renderLabel(item)}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                    ItemSeparatorComponent={() => (
                                        <View className="h-[0.5px] bg-[#E5E5E5]" />
                                    )}
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
                                        onPress={handleConfirm}
                                        disabled={!selectedItem}
                                    >
                                        <Text
                                            className={`text-[17px] font-semibold ${selectedItem ? 'text-[#FF3B30]' : 'text-[#999999]'
                                                }`}
                                        >
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
}

export default SelectModal;