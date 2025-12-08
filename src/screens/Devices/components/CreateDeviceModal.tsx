import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Pressable,
    Alert,
} from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DeviceType } from '../../../types/devices';

interface CreateDeviceModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    deviceType: DeviceType;
    onCreateDevice: (data: CreateDeviceData) => Promise<void>;
}

export interface CreateDeviceData {
    name: string;
    serial: string;
    manufacturer?: string;
    releaseYear?: number;
    type?: string;
    specs?: {
        processor?: string;
        ram?: string;
        storage?: string;
        display?: string;
        resolution?: string;
        ip?: string;
        imei1?: string;
        imei2?: string;
        phoneNumber?: string;
    };
}

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
    laptop: 'Laptop',
    monitor: 'Màn hình',
    printer: 'Máy in',
    projector: 'Máy chiếu',
    phone: 'Điện thoại',
    tool: 'Công cụ',
};

const DEVICE_SUBTYPES: Record<DeviceType, { value: string; label: string }[]> = {
    laptop: [
        { value: 'Laptop', label: 'Laptop' },
        { value: 'Desktop', label: 'Desktop' },
    ],
    monitor: [
        { value: 'Monitor', label: 'Màn hình' },
    ],
    printer: [
        { value: 'Printer', label: 'Máy in' },
    ],
    projector: [
        { value: 'Projector', label: 'Máy chiếu' },
    ],
    phone: [
        { value: 'Phone', label: 'Điện thoại' },
    ],
    tool: [
        { value: 'Tool', label: 'Công cụ' },
    ],
};

const CreateDeviceModal: React.FC<CreateDeviceModalProps> = ({
    visible,
    onClose,
    onSuccess,
    deviceType,
    onCreateDevice,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<CreateDeviceData>({
        name: '',
        serial: '',
        manufacturer: '',
        releaseYear: new Date().getFullYear(),
        type: DEVICE_SUBTYPES[deviceType]?.[0]?.value || '',
        specs: {},
    });

    const resetForm = () => {
        setFormData({
            name: '',
            serial: '',
            manufacturer: '',
            releaseYear: new Date().getFullYear(),
            type: DEVICE_SUBTYPES[deviceType]?.[0]?.value || '',
            specs: {},
        });
    };

    const handleCancel = () => {
        if (isLoading) return;
        resetForm();
        onClose();
    };

    const validateForm = (): boolean => {
        if (!formData.name.trim()) {
            Alert.alert('Lỗi', 'Vui lòng nhập tên thiết bị');
            return false;
        }
        if (!formData.serial.trim()) {
            Alert.alert('Lỗi', 'Vui lòng nhập số serial');
            return false;
        }
        return true;
    };

    const handleCreate = async () => {
        if (!validateForm()) return;

        try {
            setIsLoading(true);
            await onCreateDevice(formData);
            resetForm();
            onClose();
            onSuccess();
        } catch (error) {
            console.error('Error creating device:', error);
            Alert.alert(
                'Lỗi',
                error instanceof Error ? error.message : 'Không thể tạo thiết bị. Vui lòng thử lại.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const updateField = (field: keyof CreateDeviceData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const updateSpec = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            specs: { ...prev.specs, [field]: value }
        }));
    };

    const renderSpecFields = () => {
        switch (deviceType) {
            case 'laptop':
                return (
                    <>
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">CPU</Text>
                            <TextInput
                                value={formData.specs?.processor || ''}
                                onChangeText={(v) => updateSpec('processor', v)}
                                placeholder="VD: Intel Core i7-12700H"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                            />
                        </View>
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">RAM</Text>
                            <TextInput
                                value={formData.specs?.ram || ''}
                                onChangeText={(v) => updateSpec('ram', v)}
                                placeholder="VD: 16GB DDR5"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                            />
                        </View>
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">Ổ cứng</Text>
                            <TextInput
                                value={formData.specs?.storage || ''}
                                onChangeText={(v) => updateSpec('storage', v)}
                                placeholder="VD: 512GB SSD NVMe"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                            />
                        </View>
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">Màn hình</Text>
                            <TextInput
                                value={formData.specs?.display || ''}
                                onChangeText={(v) => updateSpec('display', v)}
                                placeholder="VD: 15.6 inch FHD"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                            />
                        </View>
                    </>
                );
            case 'monitor':
                return (
                    <>
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">Kích thước</Text>
                            <TextInput
                                value={formData.specs?.display || ''}
                                onChangeText={(v) => updateSpec('display', v)}
                                placeholder="VD: 27 inch"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                            />
                        </View>
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">Độ phân giải</Text>
                            <TextInput
                                value={formData.specs?.resolution || ''}
                                onChangeText={(v) => updateSpec('resolution', v)}
                                placeholder="VD: 2560x1440 (2K)"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                            />
                        </View>
                    </>
                );
            case 'printer':
                return (
                    <View className="mb-4">
                        <Text className="mb-2 font-medium text-sm text-black">Địa chỉ IP</Text>
                        <TextInput
                            value={formData.specs?.ip || ''}
                            onChangeText={(v) => updateSpec('ip', v)}
                            placeholder="VD: 192.168.1.100"
                            className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                            placeholderTextColor="#999"
                            editable={!isLoading}
                            keyboardType="numeric"
                        />
                    </View>
                );
            case 'phone':
                return (
                    <>
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">IMEI 1</Text>
                            <TextInput
                                value={formData.specs?.imei1 || ''}
                                onChangeText={(v) => updateSpec('imei1', v)}
                                placeholder="Nhập IMEI 1"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                                keyboardType="numeric"
                            />
                        </View>
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">IMEI 2</Text>
                            <TextInput
                                value={formData.specs?.imei2 || ''}
                                onChangeText={(v) => updateSpec('imei2', v)}
                                placeholder="Nhập IMEI 2 (nếu có)"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                                keyboardType="numeric"
                            />
                        </View>
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">Số điện thoại</Text>
                            <TextInput
                                value={formData.specs?.phoneNumber || ''}
                                onChangeText={(v) => updateSpec('phoneNumber', v)}
                                placeholder="VD: 0901234567"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                                keyboardType="phone-pad"
                            />
                        </View>
                    </>
                );
            default:
                return null;
        }
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
                <View className="mx-5 max-h-[85%] w-[90%] overflow-hidden rounded-2xl bg-white">
                    {/* Header */}
                    <View className="p-5 pb-3">
                        <Text className="mb-2.5 text-center font-semibold text-lg text-black">
                            Tạo {DEVICE_TYPE_LABELS[deviceType]} mới
                        </Text>
                    </View>

                    {/* Scrollable Content */}
                    <ScrollView
                        className="max-h-[500px] px-5"
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Device Type Selection */}
                        {DEVICE_SUBTYPES[deviceType]?.length > 1 && (
                            <View className="mb-4">
                                <Text className="mb-2 font-medium text-sm text-black">
                                    Loại thiết bị <Text className="text-red-500">*</Text>
                                </Text>
                                <View className="flex-row gap-2">
                                    {DEVICE_SUBTYPES[deviceType].map((subtype) => (
                                        <TouchableOpacity
                                            key={subtype.value}
                                            onPress={() => updateField('type', subtype.value)}
                                            className={`flex-1 rounded-xl py-3 ${formData.type === subtype.value
                                                ? 'bg-[#FFF5F0]'
                                                : 'bg-gray-100'
                                                }`}
                                        >
                                            <Text
                                                className={`text-center font-medium text-sm ${formData.type === subtype.value
                                                    ? 'text-[#F05023]'
                                                    : 'text-gray-700'
                                                    }`}
                                            >
                                                {subtype.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Name */}
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">
                                Tên thiết bị <Text className="text-red-500">*</Text>
                            </Text>
                            <TextInput
                                value={formData.name}
                                onChangeText={(v) => updateField('name', v)}
                                placeholder="VD: MacBook Pro 14 inch 2023"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                            />
                        </View>

                        {/* Serial */}
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">
                                Số Serial <Text className="text-red-500">*</Text>
                            </Text>
                            <TextInput
                                value={formData.serial}
                                onChangeText={(v) => updateField('serial', v)}
                                placeholder="VD: C02XG2FDJG5J"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                                autoCapitalize="characters"
                            />
                        </View>

                        {/* Manufacturer */}
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">Hãng sản xuất</Text>
                            <TextInput
                                value={formData.manufacturer}
                                onChangeText={(v) => updateField('manufacturer', v)}
                                placeholder="VD: Apple, Dell, HP, Lenovo..."
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                            />
                        </View>

                        {/* Release Year */}
                        <View className="mb-4">
                            <Text className="mb-2 font-medium text-sm text-black">Năm sản xuất</Text>
                            <TextInput
                                value={formData.releaseYear?.toString() || ''}
                                onChangeText={(v) => updateField('releaseYear', parseInt(v) || undefined)}
                                placeholder="VD: 2023"
                                className="rounded-xl bg-gray-100 p-3 text-sm text-black"
                                placeholderTextColor="#999"
                                editable={!isLoading}
                                keyboardType="numeric"
                                maxLength={4}
                            />
                        </View>

                        {/* Device-specific specs */}
                        {renderSpecFields()}

                        {/* Spacer for scroll */}
                        <View className="h-4" />
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
                            onPress={handleCreate}
                            disabled={isLoading || !formData.name.trim() || !formData.serial.trim()}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#F05023" />
                            ) : (
                                <Text
                                    className="font-semibold text-lg"
                                    style={{
                                        color: formData.name.trim() && formData.serial.trim()
                                            ? '#F05023'
                                            : '#9CA3AF'
                                    }}
                                >
                                    Tạo mới
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default CreateDeviceModal;










