import React, { useState } from 'react';
import { View, Text, Modal, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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
  const [downloading, setDownloading] = useState(false);

  if (!visible) return null;

  // Extract file name from URL if not provided
  const getFileName = () => {
    if (fileName) return fileName;

    try {
      // Try to extract from URL path
      const urlParts = fileUrl.split('/');
      const lastPart = urlParts[urlParts.length - 1];

      // Decode URI component to get proper file name
      const decoded = decodeURIComponent(lastPart);

      // Remove query parameters if any
      return decoded.split('?')[0] || 'file';
    } catch (error) {
      console.error('Error extracting file name:', error);
      return 'file';
    }
  };

  // Detect file type
  const getFileType = () => {
    const name = getFileName().toLowerCase();
    if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'image';
    if (name.endsWith('.pdf')) return 'pdf';
    if (name.match(/\.(doc|docx)$/)) return 'document';
    return 'other';
  };

  const displayFileName = getFileName();
  const fileType = getFileType();

  // For PDF and DOCX on Android, use Google Docs Viewer
  const getViewerUrl = () => {
    if (Platform.OS === 'android' && (fileType === 'pdf' || fileType === 'document')) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
    }
    return fileUrl;
  };

  // Download and share file
  const handleDownload = async () => {
    try {
      setDownloading(true);

      const fileUri = FileSystem.documentDirectory + displayFileName;

      const downloadResult = await FileSystem.downloadAsync(fileUrl, fileUri, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (downloadResult.status === 200) {
        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();

        if (isAvailable) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: getMimeType(displayFileName),
            dialogTitle: 'Mở file bằng...',
          });
        } else {
          Alert.alert('Thành công', `File đã được tải về: ${displayFileName}`);
        }
      } else {
        Alert.alert('Lỗi', 'Không thể tải file');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi tải file');
    } finally {
      setDownloading(false);
    }
  };

  // Get MIME type from file name
  const getMimeType = (name: string): string => {
    const ext = name.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="flex-row items-center justify-between bg-black p-4 pt-12">
          <TouchableOpacity onPress={onClose} className="p-2">
            <MaterialCommunityIcons name="close" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1 px-2">
            <Text className="text-center text-sm font-semibold text-white" numberOfLines={2}>
              {displayFileName}
            </Text>
            {Platform.OS === 'android' && (fileType === 'pdf' || fileType === 'document') && (
              <Text className="mt-1 text-center text-xs text-gray-400">
                Xem qua Google Docs Viewer
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={handleDownload} disabled={downloading} className="p-2">
            {downloading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="download-outline" size={24} color="white" />
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="flex-1">
          <WebView
            source={{
              uri: getViewerUrl(),
              headers:
                Platform.OS === 'android' && (fileType === 'pdf' || fileType === 'document')
                  ? {} // Google Docs Viewer doesn't support custom headers
                  : authToken
                    ? {
                        Authorization: `Bearer ${authToken}`,
                      }
                    : {},
            }}
            style={{ flex: 1 }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView error:', nativeEvent);
              Alert.alert('Lỗi', 'Không thể tải file. Vui lòng thử tải về để xem.', [
                { text: 'Đóng', style: 'cancel' },
                { text: 'Tải về', onPress: handleDownload },
              ]);
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
              console.log('WebView started loading file:', getViewerUrl());
            }}
            onLoadEnd={() => {
              console.log('WebView finished loading file');
            }}
            startInLoadingState={true}
            renderLoading={() => (
              <View className="flex-1 items-center justify-center bg-black">
                <ActivityIndicator size="large" color="white" />
                <Text className="mt-2 text-white">Đang tải file...</Text>
                {Platform.OS === 'android' && (fileType === 'pdf' || fileType === 'document') && (
                  <Text className="mt-2 px-8 text-center text-xs text-gray-400">
                    Đang tải qua Google Docs Viewer...
                  </Text>
                )}
              </View>
            )}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      </View>
    </Modal>
  );
};

export default FilePreviewModal;
