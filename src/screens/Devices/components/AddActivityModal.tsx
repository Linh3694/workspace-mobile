import React from 'react';
import {
    View,
    Text,
    Modal,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Pressable,
} from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface AddActivityModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: () => void;
    activityType: 'repair' | 'software';
    onActivityTypeChange: (type: 'repair' | 'software') => void;
    title: string;
    onTitleChange: (title: string) => void;
    description: string;
    onDescriptionChange: (description: string) => void;
    isLoading?: boolean;
}

const ACTIVITY_TYPES = [
    { key: 'repair' as const, label: 'Sửa chữa', icon: 'wrench' },
    { key: 'software' as const, label: 'Phần mềm', icon: 'laptop' },
];

const AddActivityModal: React.FC<AddActivityModalProps> = ({
    visible,
    onClose,
    onAdd,
    activityType,
    onActivityTypeChange,
    title,
    onTitleChange,
    description,
    onDescriptionChange,
    isLoading = false,
}) => {
    const handleCancel = () => {
        if (isLoading) return;
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={handleCancel}
        >
            <View className="flex-1 items-center justify-center bg-black/50">
                {/* Backdrop */}
                <Pressable
                    className="absolute bottom-0 left-0 right-0 top-0"
                    onPress={handleCancel}
                />

                {/* Modal Content */}
                <View className="mx-5 max-h-[80%] w-[90%] overflow-hidden rounded-2xl bg-white">
                    {/* Header */}
                    <View className="p-5 pb-3">
                        <Text className="mb-2.5 text-center font-semibold text-lg text-black">
                            Thêm hoạt động
                        </Text>

                        <Text className="mb-3 font-medium text-base text-black">
                            Loại hoạt động <Text className="text-red-500">*</Text>
                        </Text>
                    </View>

                    {/* Scrollable Content */}
                    <ScrollView className="max-h-96 px-5" showsVerticalScrollIndicator={false}>
                        {/* Activity Type Selection */}
                        <View className="mb-4 gap-2">
                            {ACTIVITY_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type.key}
                                    onPress={() => onActivityTypeChange(type.key)}
                                    className={`rounded-2xl p-3 ${
                                        activityType === type.key
                                            ? 'bg-[#FFF5F0]'
                                            : 'bg-gray-50'
                                    }`}
                                >
                                    <View className="flex-row items-center">
                                        <MaterialCommunityIcons
                                            name={activityType === type.key ? 'radiobox-marked' : 'radiobox-blank'}
                                            size={18}
                                            color={activityType === type.key ? '#F05023' : '#6B7280'}
                                        />
                                        <MaterialCommunityIcons
                                            name={type.icon as any}
                                            size={18}
                                            color={activityType === type.key ? '#F05023' : '#6B7280'}
                                            style={{ marginLeft: 8 }}
                                        />
                                        <Text
                                            className={`ml-2 text-sm ${
                                                activityType === type.key
                                                    ? 'font-medium text-[#F05023]'
                                                    : 'text-gray-700'
                                            }`}
                                        >
                                            {type.label}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Title Input */}
                        <Text className="mb-2 font-medium text-sm text-black">
                            Tiêu đề <Text className="text-red-500">*</Text>
                        </Text>
                        <TextInput
                            value={title}
                            onChangeText={onTitleChange}
                            placeholder="Nhập tiêu đề hoạt động..."
                            className="mb-4 rounded-xl bg-gray-100 p-3 text-sm text-black"
                            placeholderTextColor="#999999"
                            editable={!isLoading}
                        />

                        {/* Description Input */}
                        <Text className="mb-2 font-medium text-sm text-black">Mô tả chi tiết (tùy chọn)</Text>
                        <TextInput
                            value={description}
                            onChangeText={onDescriptionChange}
                            placeholder="Nhập mô tả chi tiết..."
                            multiline={true}
                            numberOfLines={3}
                            className="mb-4 rounded-xl bg-gray-100 p-3 text-sm text-black"
                            style={{ minHeight: 80 }}
                            textAlignVertical="top"
                            placeholderTextColor="#999999"
                            editable={!isLoading}
                        />
                    </ScrollView>

                    {/* Action Buttons */}
                    <View className="flex-row border-t border-gray-200">
                        <TouchableOpacity
                            className="flex-1 items-center justify-center bg-transparent py-4"
                            onPress={handleCancel}
                            disabled={isLoading}
                        >
                            <Text className="font-medium text-lg text-gray-600">Hủy</Text>
                        </TouchableOpacity>
                        <View className="w-px bg-gray-200" />
                        <TouchableOpacity
                            className="flex-1 items-center justify-center bg-transparent py-4"
                            onPress={onAdd}
                            disabled={isLoading || !title.trim()}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#F05023" />
                            ) : (
                                <Text
                                    className="font-semibold text-lg"
                                    style={{ color: title.trim() ? '#F05023' : '#9CA3AF' }}
                                >
                                    Thêm
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default AddActivityModal; 