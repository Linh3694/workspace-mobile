import React from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    TextInput
} from 'react-native';
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
}

const AddActivityModal: React.FC<AddActivityModalProps> = ({
    visible,
    onClose,
    onAdd,
    activityType,
    onActivityTypeChange,
    title,
    onTitleChange,
    description,
    onDescriptionChange
}) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View className="flex-1 bg-black/50 justify-end">
                    <TouchableWithoutFeedback onPress={() => { }}>
                        <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
                            <View className="flex-row items-center justify-between mb-6">
                                <Text className="text-xl font-bold text-gray-800">Thêm hoạt động</Text>
                                <TouchableOpacity
                                    onPress={onClose}
                                    className="p-2"
                                >
                                    <MaterialCommunityIcons name="close" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Activity Type Selection */}
                                <View className="mb-6">
                                    <Text className="text-base font-semibold text-gray-800 mb-3">Loại hoạt động</Text>
                                    <View className="flex-row space-x-3 gap-5">
                                        <TouchableOpacity
                                            onPress={() => onActivityTypeChange('repair')}
                                            className={`flex-1 py-3 px-4 rounded-xl  ${activityType === 'repair'
                                                ? ' bg-secondary'
                                                : 'bg-[#f8f8f8]'
                                                }`}
                                        >
                                            <Text className={`text-center font-medium ${activityType === 'repair' ? 'text-white' : 'text-primary'
                                                }`}>
                                                Sửa chữa
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => onActivityTypeChange('software')}
                                            className={`flex-1 py-3 px-4 rounded-xl  ${activityType === 'software'
                                                ? ' bg-secondary'
                                                : ' bg-[#f8f8f8]'
                                                }`}
                                        >
                                            <Text className={`text-center font-medium ${activityType === 'software' ? 'text-white' : 'text-primary'
                                                }`}>
                                                Phần mềm
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Title Input */}
                                <View className="mb-4">
                                    <Text className="text-base font-semibold text-gray-800 mb-2">Tiêu đề *</Text>
                                    <View className="border border-gray-300 rounded-xl p-4 bg-white">
                                        <TextInput
                                            value={title}
                                            onChangeText={onTitleChange}
                                            placeholder="Nhập tiêu đề hoạt động..."
                                            className="text-base text-gray-800"
                                            multiline={false}
                                        />
                                    </View>
                                </View>

                                {/* Description Input */}
                                <View className="mb-6">
                                    <Text className="text-base font-semibold text-gray-800 mb-2">Mô tả chi tiết</Text>
                                    <View className="border border-gray-300 rounded-xl p-4 bg-white h-24">
                                        <TextInput
                                            value={description}
                                            onChangeText={onDescriptionChange}
                                            placeholder="Nhập mô tả chi tiết..."
                                            className="text-base text-gray-800 flex-1"
                                            multiline={true}
                                            textAlignVertical="top"
                                        />
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View className="flex-row gap-5 my-5">
                                    <TouchableOpacity
                                        onPress={onClose}
                                        className="flex-1 py-3 bg-gray-200 rounded-xl"
                                    >
                                        <Text className="text-center font-semibold text-gray-700">Hủy</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={onAdd}
                                        className="flex-1 py-3 bg-secondary rounded-xl"
                                    >
                                        <Text className="text-center font-semibold text-white">Thêm</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

export default AddActivityModal; 