import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';

// Get MIME type from file name (moved outside component)
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

// Open file with Android IntentLauncher
const openWithAndroidIntent = async (fileUri: string, fileName: string): Promise<boolean> => {
  try {
    const mimeType = getMimeType(fileName);
    // Convert file:// URI to content:// URI for Android 7+
    const contentUri = await FileSystem.getContentUriAsync(fileUri);
    console.log('Opening with IntentLauncher:', contentUri, mimeType);

    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: mimeType,
    });
    return true;
  } catch (error) {
    console.error('Error opening file with IntentLauncher:', error);
    return false;
  }
};

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
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Use ref to store onClose to avoid dependency issues in useEffect
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

  // Download file and handle based on type
  useEffect(() => {
    let isMounted = true;

    const downloadAndHandleFile = async () => {
      if (!visible) return;

      try {
        setLoadingPreview(true);
        setPreviewError(null);
        setLocalFileUri(null);

        // Generate cache file path
        const cacheDir = FileSystem.cacheDirectory;
        const localUri = `${cacheDir}preview_${Date.now()}_${displayFileName}`;

        console.log('Downloading file:', fileUrl, '-> ', localUri);

        // Download file with auth header
        const downloadResult = await FileSystem.downloadAsync(fileUrl, localUri, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!isMounted) return;

        if (downloadResult.status === 200) {
          console.log('File downloaded successfully:', downloadResult.uri);

          if (Platform.OS === 'android' && (fileType === 'pdf' || fileType === 'document')) {
            // Android: Use IntentLauncher to open PDF/DOCX with external app
            const opened = await openWithAndroidIntent(downloadResult.uri, displayFileName);
            if (opened) {
              // Close modal after opening on Android
              setTimeout(() => onCloseRef.current(), 300);
            } else {
              setPreviewError('Không thể mở file. Vui lòng cài đặt ứng dụng đọc PDF/Word.');
            }
          } else if (Platform.OS === 'ios' && fileType === 'pdf') {
            // iOS: Show PDF directly in WebView (iOS WebView supports PDF natively)
            setLocalFileUri(downloadResult.uri);
          } else if (Platform.OS === 'ios' && fileType === 'document') {
            // iOS + DOCX: Use Sharing since WebView can't render DOCX
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
              await Sharing.shareAsync(downloadResult.uri, {
                mimeType: getMimeType(displayFileName),
                dialogTitle: 'Mở file bằng...',
                UTI: 'org.openxmlformats.wordprocessingml.document',
              });
            } else {
              setPreviewError('Không thể mở file. Vui lòng cài đặt ứng dụng đọc Word.');
            }
          } else {
            // For images, show in WebView
            setLocalFileUri(downloadResult.uri);
          }
        } else {
          console.error('Download failed with status:', downloadResult.status);
          setPreviewError('Không thể tải file. Vui lòng thử lại.');
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Error downloading file:', error);
        setPreviewError('Có lỗi xảy ra khi tải file');
      } finally {
        if (isMounted) {
          setLoadingPreview(false);
        }
      }
    };

    downloadAndHandleFile();

    return () => {
      isMounted = false;
      // Clean up cached file when modal closes
      if (localFileUri) {
        FileSystem.deleteAsync(localFileUri, { idempotent: true }).catch((err) =>
          console.log('Error cleaning up cache:', err)
        );
      }
    };
  }, [visible, fileUrl, authToken, displayFileName, fileType]);

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
        // For PDF and DOCX on Android, use IntentLauncher
        if (Platform.OS === 'android' && (fileType === 'pdf' || fileType === 'document')) {
          const opened = await openWithAndroidIntent(downloadResult.uri, displayFileName);
          if (!opened) {
            Alert.alert('Lỗi', 'Không thể mở file. Vui lòng cài đặt ứng dụng đọc PDF/Word.');
          }
        } else {
          // For iOS or images, use Sharing (iOS shows Quick Look preview)
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: getMimeType(displayFileName),
              dialogTitle: 'Mở file bằng...',
            });
          } else {
            Alert.alert('Thành công', `File đã được tải về: ${displayFileName}`);
          }
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

  // Return null if not visible (after all hooks)
  if (!visible) return null;

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
          {loadingPreview ? (
            <View className="flex-1 items-center justify-center bg-black">
              <ActivityIndicator size="large" color="white" />
              <Text className="mt-2 text-white">Đang tải file...</Text>
              {Platform.OS === 'android' && (fileType === 'pdf' || fileType === 'document') && (
                <Text className="mt-2 px-8 text-center text-xs text-gray-400">
                  Chọn ứng dụng để mở file
                </Text>
              )}
              {Platform.OS === 'ios' && fileType === 'document' && (
                <Text className="mt-2 px-8 text-center text-xs text-gray-400">
                  Chọn ứng dụng để mở file Word
                </Text>
              )}
            </View>
          ) : previewError ? (
            <View className="flex-1 items-center justify-center bg-black px-8">
              <Ionicons name="alert-circle-outline" size={48} color="white" />
              <Text className="mt-4 text-center text-white">{previewError}</Text>
              <TouchableOpacity
                onPress={handleDownload}
                className="mt-6 bg-white px-8 py-3"
                activeOpacity={0.8}>
                <Text className="font-medium text-black">Tải về</Text>
              </TouchableOpacity>
            </View>
          ) : localFileUri &&
            (fileType === 'image' || (Platform.OS === 'ios' && fileType === 'pdf')) ? (
            // Show images and PDF (iOS only) in WebView
            <WebView
              source={{ uri: localFileUri }}
              style={{ flex: 1, backgroundColor: fileType === 'pdf' ? '#525659' : '#000' }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView error:', nativeEvent);
                setPreviewError(
                  fileType === 'pdf' ? 'Không thể hiển thị PDF.' : 'Không thể hiển thị hình ảnh.'
                );
              }}
              onLoadStart={() => {
                console.log('WebView started loading:', localFileUri);
              }}
              onLoadEnd={() => {
                console.log('WebView finished loading');
              }}
              startInLoadingState={true}
              renderLoading={() => (
                <View className="flex-1 items-center justify-center bg-black">
                  <ActivityIndicator size="large" color="white" />
                  <Text className="mt-2 text-white">
                    {fileType === 'pdf' ? 'Đang hiển thị PDF...' : 'Đang hiển thị hình ảnh...'}
                  </Text>
                </View>
              )}
              allowFileAccess={true}
              allowFileAccessFromFileURLs={true}
              allowUniversalAccessFromFileURLs={true}
              originWhitelist={['*']}
              scalesPageToFit={true}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

export default FilePreviewModal;
