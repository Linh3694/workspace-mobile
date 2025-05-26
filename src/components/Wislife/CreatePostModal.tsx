import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { postService } from '../../services/postService';
import { useAuth } from '../../context/AuthContext';
import { Post, MediaFile } from '../../types/post';
import { getAvatar } from '../../utils/avatar';

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

  const resetForm = () => {
    setContent('');
    setSelectedFiles([]);
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
      const newPost = await postService.createPost({
        content: content.trim(),
        type: 'Chia sẻ',
        visibility: 'public',
        files: selectedFiles,
      });

      onPostCreated(newPost);
      handleClose();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Lỗi', 'Không thể tạo bài viết. Vui lòng thử lại.');
    } finally {
      setLoading(false);
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
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
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

          {/* Content Input */}
          <TextInput
            className="text-lg text-gray-900 min-h-[100px]"
            placeholder="Có gì mới?"
            placeholderTextColor="#9CA3AF"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            autoFocus
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