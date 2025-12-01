import React from 'react';
import {
  View,
  Text,
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { TouchableOpacity } from './Common';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface UploadDocumentModalProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onDocument: () => void;
  isUploading?: boolean;
}

const UPLOAD_OPTIONS = [
  { key: 'camera', label: 'Chụp ảnh', icon: 'camera' },
  { key: 'gallery', label: 'Chọn từ thư viện', icon: 'image' },
  { key: 'document', label: 'Chọn từ tài liệu', icon: 'file-document' },
];

const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  visible,
  onClose,
  onCamera,
  onGallery,
  onDocument,
  isUploading = false,
}) => {
  const handleOptionPress = (key: string) => {
    if (isUploading) return;
    switch (key) {
      case 'camera':
        onCamera();
        break;
      case 'gallery':
        onGallery();
        break;
      case 'document':
        onDocument();
        break;
    }
  };

  const handleCancel = () => {
    if (isUploading) return;
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
        <View className="w-[80%] overflow-hidden rounded-2xl bg-white">
          <View className="p-5">
            <Text className="mb-4 text-center font-semibold text-lg text-black">
              Tải lên biên bản
            </Text>

            {UPLOAD_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                onPress={() => handleOptionPress(option.key)}
                disabled={isUploading}
                className="flex-row items-center py-3"
              >
                <MaterialCommunityIcons
                  name={option.icon as any}
                  size={24}
                  color={isUploading ? '#999999' : '#F05023'}
                />
                <Text
                  className={`ml-3 flex-1 text-base ${isUploading ? 'text-gray-400' : 'text-gray-800'}`}
                >
                  {option.label}
                </Text>
                {isUploading && <ActivityIndicator size="small" color="#F05023" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Cancel Button */}
          <View className="border-t border-gray-200">
            <TouchableOpacity
              onPress={handleCancel}
              disabled={isUploading}
              className="items-center py-4"
            >
              <Text className="font-medium text-base text-gray-600">Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UploadDocumentModal;
