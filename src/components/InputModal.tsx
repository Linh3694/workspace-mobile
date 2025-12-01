import React from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { TouchableOpacity } from './Common';

interface InputModalProps {
  visible: boolean;
  title: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

const InputModal: React.FC<InputModalProps> = ({
  visible,
  title,
  placeholder,
  value,
  onChangeText,
  onCancel,
  onConfirm,
  isLoading = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50">
        {/* Backdrop */}
        <Pressable
          className="absolute bottom-0 left-0 right-0 top-0"
          onPress={onCancel}
        />

        {/* Modal Content */}
        <View className="w-[80%] overflow-hidden rounded-2xl bg-white">
          <View className="p-5">
            <Text className="mb-4 text-center font-semibold text-lg text-black">{title}</Text>
            <TextInput
              className="mb-5 w-full rounded-lg bg-[#F5F5F5] px-4 py-3 text-base text-black"
              placeholder={placeholder}
              value={value}
              onChangeText={onChangeText}
              placeholderTextColor="#999999"
              editable={!isLoading}
            />
          </View>

          {/* Action Buttons */}
          <View className="flex-row border-t border-gray-200">
            <TouchableOpacity
              className="flex-1 items-center justify-center bg-transparent py-4"
              onPress={onCancel}
              disabled={isLoading}>
              <Text
                className={`font-medium text-[17px] ${isLoading ? 'text-[#CCCCCC]' : 'text-[#666666]'}`}>
                Hủy
              </Text>
            </TouchableOpacity>
            <View className="w-px bg-gray-200" />
            <TouchableOpacity
              className="flex-1 items-center justify-center bg-transparent py-4"
              onPress={onConfirm}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <Text className="font-semibold text-[17px] text-[#FF3B30]">Ok</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default InputModal;
