import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    FlatList,
    Pressable,
} from 'react-native';
import { TouchableOpacity } from './Common';

interface SelectModalProps<T> {
    visible: boolean;
    title: string;
    options: T[];
    keyExtractor: (item: T) => string;
    renderLabel: (item: T) => string;
    onCancel: () => void;
    onSelect: (item: T) => void;
    /** Khoá của mục đang chọn sẵn khi mở modal (để người dùng thấy mình đang ở đâu). */
    selectedKey?: string | null;
    cancelLabel?: string;
    confirmLabel?: string;
    /** Khoá nút Ok (vd. đang gọi API đổi campus). */
    confirming?: boolean;
}

function SelectModal<T>({
    visible,
    title,
    options,
    keyExtractor,
    renderLabel,
    onCancel,
    onSelect,
    selectedKey,
    cancelLabel = 'Hủy',
    confirmLabel = 'Ok',
    confirming = false,
}: SelectModalProps<T>) {
    const [selectedItem, setSelectedItem] = useState<T | null>(null);

    useEffect(() => {
        if (!visible) {
            setSelectedItem(null);
            return;
        }
        if (selectedKey) {
            const preset = options.find((o) => keyExtractor(o) === selectedKey) || null;
            setSelectedItem(preset);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, selectedKey]);

    const handleConfirm = () => {
        if (selectedItem && !confirming) {
            onSelect(selectedItem);
        }
    };
    const canConfirm = !!selectedItem && !confirming;

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
                    <View className="p-5 pb-0">
                        <Text className="mb-4 text-center font-semibold text-lg text-black">
                            {title}
                        </Text>
                        <FlatList
                            data={options}
                            keyExtractor={keyExtractor}
                            className="max-h-[200px]"
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => setSelectedItem(item)}
                                    className={`rounded-xl py-3 ${selectedItem === item ? 'bg-[#FFF5F0]' : ''}`}
                                >
                                    <Text
                                        className={`text-center text-base ${selectedItem === item ? 'font-medium text-[#F05023]' : 'text-gray-800'}`}
                                    >
                                        {renderLabel(item)}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            ItemSeparatorComponent={() => (
                                <View className="h-px bg-gray-100" />
                            )}
                        />
                    </View>

                    {/* Action Buttons */}
                    <View className="mt-4 flex-row border-t border-gray-200">
                        <TouchableOpacity
                            className="flex-1 items-center justify-center bg-transparent py-4"
                            onPress={onCancel}
                        >
                            <Text className="font-medium text-[17px] text-gray-600">
                                {cancelLabel}
                            </Text>
                        </TouchableOpacity>
                        <View className="w-px bg-gray-200" />
                        <TouchableOpacity
                            className="flex-1 items-center justify-center bg-transparent py-4"
                            onPress={handleConfirm}
                            disabled={!canConfirm}
                        >
                            <Text
                                className={`font-semibold text-[17px] ${canConfirm ? 'text-[#F05023]' : 'text-gray-400'}`}
                            >
                                {confirmLabel}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export default SelectModal;