import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { TouchableOpacity } from '../Common';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Video, ResizeMode } from 'expo-av';
import { postService } from '../../services/postService';
import { useAuth } from '../../context/AuthContext';
import { Post, MediaFile } from '../../types/post';
import { getAvatar } from '../../utils/avatar';
import MentionInput, { MentionUser, extractMentionIds, getMentionPlainText } from './MentionInput';

// Config cho image compression
const IMAGE_CONFIG = {
  maxWidth: 1200,      // Max width để upload nhanh
  maxHeight: 1200,     // Max height
  quality: 0.7,        // 70% quality - cân bằng giữa chất lượng và kích thước
};

/**
 * Compress và resize ảnh để upload nhanh hơn
 * Giảm từ ~5MB xuống ~200-500KB
 */
const compressImage = async (uri: string): Promise<{ uri: string; width: number; height: number }> => {
  try {
    // Lấy kích thước ảnh gốc
    const imageInfo = await new Promise<{ width: number; height: number }>((resolve) => {
      Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve({ width: 1200, height: 1200 }));
    });

    // Tính toán kích thước mới giữ tỉ lệ
    let { width, height } = imageInfo;
    const ratio = Math.min(IMAGE_CONFIG.maxWidth / width, IMAGE_CONFIG.maxHeight / height);
    
    if (ratio < 1) {
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // Compress ảnh
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width, height } }],
      { 
        compress: IMAGE_CONFIG.quality, 
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );

    return { uri: manipulated.uri, width, height };
  } catch (error) {
    console.warn('[Compress] Failed, using original:', error);
    return { uri, width: 0, height: 0 };
  }
};

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: (post: Post) => void;
}

const { width } = Dimensions.get('window');

const CreatePostModal: React.FC<CreatePostModalProps> = ({
  visible,
  onClose,
  onPostCreated,
}) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);
  const [uploadProgress, setUploadProgress] = useState(''); // Hiển thị tiến trình

  const resetForm = () => {
    setContent('');
    setSelectedFiles([]);
    setMentionedUsers([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Quyền truy cập',
          'Cần quyền truy cập thư viện ảnh để chọn hình ảnh'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets) {
        const newFiles: MediaFile[] = result.assets.map((asset, index) => ({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          name: `media_${Date.now()}_${index}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          size: asset.fileSize,
        }));

        // Limit to 10 files total
        const totalFiles = selectedFiles.length + newFiles.length;
        if (totalFiles > 10) {
          Alert.alert(
            'Giới hạn file',
            'Chỉ có thể chọn tối đa 10 file cho một bài viết'
          );
          return;
        }

        setSelectedFiles(prev => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn hình ảnh. Vui lòng thử lại.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Quyền truy cập',
          'Cần quyền truy cập camera để chụp ảnh'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const newFile: MediaFile = {
          uri: asset.uri,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          name: `camera_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          size: asset.fileSize,
        };

        if (selectedFiles.length >= 10) {
          Alert.alert(
            'Giới hạn file',
            'Chỉ có thể chọn tối đa 10 file cho một bài viết'
          );
          return;
        }

        setSelectedFiles(prev => [...prev, newFile]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh. Vui lòng thử lại.');
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const showMediaOptions = () => {
    Alert.alert(
      'Chọn phương thức',
      'Bạn muốn thêm media từ đâu?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Thư viện', onPress: pickImage },
        { text: 'Chụp ảnh', onPress: takePhoto },
      ]
    );
  };

  const handleCreatePost = async () => {
    if (!content.trim() && selectedFiles.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập nội dung hoặc chọn hình ảnh/video');
      return;
    }

    try {
      setLoading(true);
      
      // Bước 1: Compress ảnh để upload nhanh hơn
      const compressedFiles: MediaFile[] = [];
      const imageFiles = selectedFiles.filter(f => f.type.startsWith('image/'));
      const videoFiles = selectedFiles.filter(f => f.type.startsWith('video/'));
      
      if (imageFiles.length > 0) {
        setUploadProgress(`Đang nén ${imageFiles.length} ảnh...`);
        
        for (let i = 0; i < imageFiles.length; i++) {
          setUploadProgress(`Đang nén ảnh ${i + 1}/${imageFiles.length}...`);
          const file = imageFiles[i];
          const compressed = await compressImage(file.uri);
          compressedFiles.push({
            ...file,
            uri: compressed.uri,
          });
        }
      }
      
      // Video giữ nguyên (không compress)
      compressedFiles.push(...videoFiles);
      
      // Bước 2: Upload
      setUploadProgress('Đang đăng bài...');
      
      // Convert mention format @[name](id) sang plain text @name
      const plainContent = getMentionPlainText(content);
      
      // Lấy danh sách mention IDs (tags) từ text
      const mentionIds = extractMentionIds(content, mentionedUsers);
      
      const newPost = await postService.createPost({
        content: plainContent.trim(),
        type: 'Chia sẻ',
        visibility: 'public',
        files: compressedFiles,
        tags: mentionIds,
      });

      setUploadProgress('');
      onPostCreated(newPost);
      handleClose();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Lỗi', 'Không thể tạo bài viết. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const isVideoFile = (file: MediaFile) => {
    return file.type.startsWith('video/');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-200">
          <TouchableOpacity onPress={handleClose}>
            <Text className="text-lg text-gray-600">Hủy</Text>
          </TouchableOpacity>
          
          <Text className="text-lg font-semibold text-gray-900">
            Tạo bài viết
          </Text>
          
          <TouchableOpacity
            onPress={handleCreatePost}
            disabled={(!content.trim() && selectedFiles.length === 0) || loading}
            className={`px-4 py-2 rounded-full ${
              (!content.trim() && selectedFiles.length === 0) || loading
                ? 'bg-gray-300'
                : 'bg-[#FF7A00]'
            }`}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white font-medium">Đăng</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Upload Progress Bar */}
        {loading && uploadProgress && (
          <View className="px-6 py-2 bg-orange-50 border-b border-orange-100">
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#FF7A00" />
              <Text className="ml-2 text-sm text-orange-700">{uploadProgress}</Text>
            </View>
          </View>
        )}

        <ScrollView className="flex-1 px-4">
          {/* User Info */}
          <View className="py-4">
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-full overflow-hidden bg-gray-300 mr-3">
                <Image 
                  source={{ uri: getAvatar(user) }} 
                  className="w-full h-full"
                />
              </View>
              <View className="flex-col items-start">
                <Text className="text-lg font-semibold text-gray-900">
                  {user?.fullname}
                </Text>
                <View className="flex-row items-center">
                <View className="w-6 h-6 rounded-full items-center justify-center">
                  <Ionicons name="globe" size={14} color="#757575" />
                </View>
                <Text className="text-gray-600 text-sm">Công khai</Text>
                </View>
              </View>
            </View>
            
            {/* Post visibility */}
            <View className="flex-row items-center mt-2 ml-15">
             
            </View>
          </View>

          {/* Content Input với Mention */}
          <MentionInput
            className="text-lg text-gray-900 min-h-[100px]"
            placeholder="Có gì mới? (gõ @ để mention)"
            placeholderTextColor="#9CA3AF"
            value={content}
            onChangeText={setContent}
            onMentionsChange={setMentionedUsers}
            multiline
            textAlignVertical="top"
            autoFocus
            suggestionsAbove={false}
            containerStyle={{ zIndex: 10 }}
          />

          {/* Selected Media */}
          {selectedFiles.length > 0 && (
            <View className="mt-4">
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                className="mb-4"
              >
                {selectedFiles.map((file, index) => (
                  <View key={index} className="mr-3 relative">
                    {isVideoFile(file) ? (
                      <View className="w-32 h-32 rounded-lg overflow-hidden bg-black">
                        <Video
                          source={{ uri: file.uri }}
                          className="w-full h-full"
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={false}
                          isLooping={false}
                          useNativeControls={false}
                        />
                        <View className="absolute inset-0 items-center justify-center">
                          <Ionicons name="play-circle" size={32} color="white" />
                        </View>
                      </View>
                    ) : (
                      <Image
                        source={{ uri: file.uri }}
                        className="w-32 h-32 rounded-lg"
                        resizeMode={ResizeMode.COVER}
                      />
                    )}
                    
                    <TouchableOpacity
                      onPress={() => removeFile(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Media Options */}
          <View className="flex-row items-center py-4 border-t border-gray-100 mt-4">
            <TouchableOpacity
              onPress={showMediaOptions}
              className="flex-row items-center flex-1 py-3"
            >
              <Ionicons name="image" size={24} color="#6B7280" />
              <Text className="ml-3 text-gray-700 font-medium">
                Thêm ảnh/video
              </Text>
            </TouchableOpacity>
            
            {selectedFiles.length > 0 && (
              <Text className="text-sm text-gray-500">
                {selectedFiles.length}/10
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default CreatePostModal; 