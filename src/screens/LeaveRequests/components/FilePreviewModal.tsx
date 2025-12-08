import React from 'react';
import { View, Text, Modal, ActivityIndicator, Alert } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

interface FilePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  fileUrl: string;
  authToken: string;
  title?: string;
  fileName?: string;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  visible,
  onClose,
  fileUrl,
  authToken,
  title = 'Tài liệu đính kèm',
  fileName,
}) => {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="flex-row items-center justify-between bg-black p-4 pt-12">
          <TouchableOpacity onPress={onClose} className="p-2">
            <MaterialCommunityIcons name="close" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1 px-4">
            <Text className="font-semibold text-center text-base text-white" numberOfLines={1}>
              {fileName || title}
            </Text>
          </View>
          <View className="w-10" />
        </View>

        {/* Content */}
        <View className="flex-1">
          <WebView
            source={{
              uri: fileUrl,
              headers: authToken ? {
                Authorization: `Bearer ${authToken}`,
              } : {},
            }}
            style={{ flex: 1 }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView error:', nativeEvent);
              Alert.alert('Lỗi', 'Không thể tải file. Vui lòng thử lại.');
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView HTTP error:', nativeEvent);
              if (nativeEvent.statusCode === 401) {
                Alert.alert('Lỗi', 'Không có quyền truy cập file này.');
              } else if (nativeEvent.statusCode === 404) {
                Alert.alert('Lỗi', 'Không tìm thấy file.');
              } else {
                Alert.alert('Lỗi', `Lỗi tải file: ${nativeEvent.statusCode}`);
              }
            }}
            onLoadStart={() => {
              console.log('WebView started loading file');
            }}
            onLoadEnd={() => {
              console.log('WebView finished loading file');
            }}
            startInLoadingState={true}
            renderLoading={() => (
              <View className="flex-1 items-center justify-center bg-black">
                <ActivityIndicator size="large" color="white" />
                <Text className="mt-2 text-white">Đang tải file...</Text>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

export default FilePreviewModal;
