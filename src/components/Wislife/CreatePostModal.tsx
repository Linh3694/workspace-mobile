import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
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
import { API_BASE_URL } from '../../config/constants';
import { resolveSocialMediaUrl } from '../../utils/resolveSocialMediaUrl';
import MentionInput, { MentionUser, extractMentionIds, getMentionPlainText } from './MentionInput';

// Config cho image compression
const IMAGE_CONFIG = {
  /** Cạnh dài tối đa — khớp trần CDN_IMAGE_MAX_WIDTH (2048) của social-service */
  maxSize: 2048,
  quality: 0.85,
};

/** Dòng phạm vi đăng trong modal: không lặp "Đăng vào lớp Lớp …" khi API đã có tiền tố Lớp */
function labelAudienceClassScope(className: string): string {
  const s = String(className || '').trim();
  if (!s) return '';
  if (/^lớp(\s|$)/i.test(s)) return `Đăng vào ${s}`;
  return `Đăng vào lớp ${s}`;
}

/**
 * Compress ảnh trước khi upload (giảm từ ~5MB xuống vài trăm KB).
 *
 * TUYỆT ĐỐI không truyền cả `width` lẫn `height` cho `resize`: manipulator ép
 * cứng đúng hai số đó và ảnh méo. Truyền ĐÚNG MỘT chiều thì chiều còn lại được
 * tính theo tỉ lệ gốc.
 *
 * Kích thước phải lấy từ asset của ImagePicker (đã áp EXIF orientation).
 * `Image.getSize` từng dùng ở đây là nguồn gây méo: trên Android nó đọc bounds
 * bitmap thô nên ảnh chụp dọc trả về chiều ngang, còn khi nó lỗi thì fallback
 * vuông 1200×1200 bóp mọi ảnh thành hình vuông.
 */
const compressImage = async (
  uri: string,
  sourceWidth?: number,
  sourceHeight?: number,
): Promise<string> => {
  try {
    let width = sourceWidth;
    let height = sourceHeight;

    // Asset không kèm kích thước ⇒ hỏi chính manipulator, kết quả đã áp EXIF.
    if (!width || !height) {
      const probed = await ImageManipulator.manipulateAsync(uri, []);
      width = probed.width;
      height = probed.height;
    }

    // Ảnh đã nhỏ hơn ngưỡng thì chỉ nén: phóng to chỉ làm mờ và phình file.
    const actions: ImageManipulator.Action[] =
      Math.max(width, height) > IMAGE_CONFIG.maxSize
        ? [
            {
              resize:
                width >= height
                  ? { width: IMAGE_CONFIG.maxSize }
                  : { height: IMAGE_CONFIG.maxSize },
            },
          ]
        : [];

    const manipulated = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: IMAGE_CONFIG.quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return manipulated.uri;
  } catch (error) {
    console.warn('[Compress] Failed, using original:', error);
    return uri;
  }
};

/** Trần media một bài viết — khớp social-service. */
const MAX_MEDIA = 30;

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: (post: Post) => void;
  /** Khi có: đăng bài vào lớp chủ nhiệm (class-feed) */
  classContext?: {
    classId: string;
    schoolYearId: string;
    className?: string;
  } | null;
  /** Khi có: modal chạy ở chế độ SỬA bài này thay vì đăng bài mới */
  editingPost?: Post | null;
  /** Bắt buộc khi dùng chế độ sửa — nhận bài đã cập nhật từ server */
  onPostUpdated?: (post: Post) => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({
  visible,
  onClose,
  onPostCreated,
  classContext,
  editingPost,
  onPostUpdated,
}) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);
  const [uploadProgress, setUploadProgress] = useState(''); // Hiển thị tiến trình
  /** Ảnh/video CŨ của bài đang sửa còn được giữ lại (bỏ khỏi mảng = xoá khỏi bài) */
  const [keptImages, setKeptImages] = useState<string[]>([]);
  const [keptVideos, setKeptVideos] = useState<string[]>([]);

  const isEditMode = Boolean(editingPost);
  const keptMediaCount = keptImages.length + keptVideos.length;
  const totalMediaCount = keptMediaCount + selectedFiles.length;
  const hasAnyContent = Boolean(content.trim()) || totalMediaCount > 0;

  const resetForm = () => {
    setContent('');
    setSelectedFiles([]);
    setMentionedUsers([]);
    setKeptImages([]);
    setKeptVideos([]);
  };

  // Nạp lại nội dung bài mỗi lần mở modal ở chế độ sửa; mở để đăng mới thì về form trắng.
  // Cố ý chỉ phụ thuộc `editingPost?._id` chứ không phải cả object: feed thay object bài
  // viết mỗi lần có reaction/bình luận mới, phụ thuộc cả object sẽ nuốt nội dung đang gõ dở.
  useEffect(() => {
    if (!visible) return;
    if (editingPost) {
      setContent(editingPost.content || '');
      setKeptImages(editingPost.images || []);
      setKeptVideos(editingPost.videos || []);
      setSelectedFiles([]);
      setMentionedUsers([]);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingPost?._id]);

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
          width: asset.width,
          height: asset.height,
        }));

        // Trần media bài đăng — khớp social-service (30). Chế độ sửa tính cả media cũ giữ lại.
        const totalFiles = keptMediaCount + selectedFiles.length + newFiles.length;
        if (totalFiles > MAX_MEDIA) {
          Alert.alert(
            'Giới hạn file',
            `Chỉ có thể chọn tối đa ${MAX_MEDIA} file cho một bài viết`
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
          width: asset.width,
          height: asset.height,
        };

        if (totalMediaCount >= MAX_MEDIA) {
          Alert.alert(
            'Giới hạn file',
            `Chỉ có thể chọn tối đa ${MAX_MEDIA} file cho một bài viết`
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

  const removeKeptImage = (index: number) => {
    setKeptImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeKeptVideo = (index: number) => {
    setKeptVideos(prev => prev.filter((_, i) => i !== index));
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

  /** Nén ảnh cho nhẹ trước khi upload (video giữ nguyên) — dùng chung cho đăng mới và sửa bài. */
  const compressSelectedFiles = async (): Promise<MediaFile[]> => {
    const compressedFiles: MediaFile[] = [];
    const imageFiles = selectedFiles.filter(f => f.type.startsWith('image/'));
    const videoFiles = selectedFiles.filter(f => f.type.startsWith('video/'));

    if (imageFiles.length > 0) {
      setUploadProgress(`Đang nén ${imageFiles.length} ảnh...`);

      for (let i = 0; i < imageFiles.length; i++) {
        setUploadProgress(`Đang nén ảnh ${i + 1}/${imageFiles.length}...`);
        const file = imageFiles[i];
        compressedFiles.push({
          ...file,
          uri: await compressImage(file.uri, file.width, file.height),
        });
      }
    }

    // Video giữ nguyên (không compress)
    compressedFiles.push(...videoFiles);
    return compressedFiles;
  };

  const handleCreatePost = async () => {
    if (!content.trim() && selectedFiles.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập nội dung hoặc chọn hình ảnh/video');
      return;
    }

    try {
      setLoading(true);

      // Bước 1: Compress ảnh để upload nhanh hơn
      const compressedFiles = await compressSelectedFiles();

      // Bước 2: Upload
      setUploadProgress('Đang đăng bài...');

      // Convert mention format @[name](id) sang plain text @name
      const plainContent = getMentionPlainText(content);

      // Lấy danh sách mention IDs (tags) từ text
      const mentionIds = extractMentionIds(content, mentionedUsers);

      let newPost: Post;

      if (
        classContext?.classId &&
        classContext?.schoolYearId &&
        String(classContext.classId).trim() &&
        String(classContext.schoolYearId).trim()
      ) {
        // Đăng vào lớp (audienceType class) — Wislife lớp chủ nhiệm
        const fallbackText =
          plainContent.trim() ||
          (compressedFiles.length > 0
            ? classContext.className
              ? `Bài chia sẻ — ${classContext.className}`
              : 'Bài chia sẻ'
            : '');
        newPost = await postService.createClassPost({
          classId: String(classContext.classId).trim(),
          schoolYearId: String(classContext.schoolYearId).trim(),
          content: fallbackText,
          files: compressedFiles,
          type: 'Chia sẻ',
          tags: mentionIds.length ? mentionIds : undefined,
        });
      } else {
        newPost = await postService.createPost({
          content: plainContent.trim(),
          type: 'Chia sẻ',
          visibility: 'public',
          files: compressedFiles,
          tags: mentionIds,
        });
      }

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

  const handleUpdatePost = async () => {
    if (!editingPost) return;

    if (!hasAnyContent) {
      Alert.alert('Lỗi', 'Vui lòng nhập nội dung hoặc chọn hình ảnh/video');
      return;
    }

    try {
      setLoading(true);

      const compressedFiles = await compressSelectedFiles();
      setUploadProgress('Đang lưu thay đổi...');

      const updatedPost = await postService.updatePost(editingPost._id, {
        content: getMentionPlainText(content).trim(),
        images: keptImages,
        videos: keptVideos,
        files: compressedFiles,
      });

      setUploadProgress('');
      onPostUpdated?.(updatedPost);
      handleClose();
    } catch (error) {
      console.error('Error updating post:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật bài viết. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const handleSubmit = () => {
    if (isEditMode) {
      void handleUpdatePost();
      return;
    }
    void handleCreatePost();
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
            {isEditMode ? 'Sửa bài viết' : 'Tạo bài viết'}
          </Text>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!hasAnyContent || loading}
            className={`px-4 py-2 rounded-full ${
              !hasAnyContent || loading ? 'bg-gray-300' : 'bg-[#FF7A00]'
            }`}>
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white font-medium">{isEditMode ? 'Lưu' : 'Đăng'}</Text>
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

        <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
          {/* User Info */}
          <View className="py-4">
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-full overflow-hidden bg-gray-300 mr-3">
                <Image source={{ uri: getAvatar(user) }} className="w-full h-full" />
              </View>
              <View className="flex-col items-start">
                <Text className="text-lg font-semibold text-gray-900">{user?.fullname}</Text>
                {/* Sửa bài thì không nêu phạm vi đăng: bài đã có phạm vi từ lúc tạo,
                    hiện "Công khai" ở đây sẽ sai với bài đăng trong lớp. */}
                {!isEditMode && (
                  <View className="flex-row items-center mt-1">
                    {classContext?.className ? (
                      <Ionicons name="school-outline" size={14} color="#757575" />
                    ) : (
                      <Ionicons name="globe" size={14} color="#757575" />
                    )}
                    <Text className="text-gray-600 text-sm ml-1">
                      {classContext?.className ? labelAudienceClassScope(classContext.className) : 'Công khai'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Post visibility */}
            <View className="flex-row items-center mt-2 ml-15" />
          </View>

          {/* Ô nội dung: cao đủ chỗ gõ nhiều dòng + chừa padding dưới */}
          <MentionInput
            className="min-h-[184px] w-full text-lg text-gray-900"
            style={{
              minHeight: 184,
              paddingTop: 12,
              paddingBottom: 14,
              lineHeight: 26,
              fontSize: 18,
            }}
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

          {/* Selected Media — chế độ sửa: ảnh/video cũ giữ lại đứng trước, rồi tới file mới chọn */}
          {(totalMediaCount > 0) && (
            <View className="mt-4">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
              >
                {keptImages.map((image, index) => (
                  <View key={`kept-image-${index}-${image}`} className="mr-3 relative">
                    <Image
                      source={{ uri: resolveSocialMediaUrl(image, API_BASE_URL) }}
                      className="w-32 h-32 rounded-lg"
                      resizeMode={ResizeMode.COVER}
                    />
                    <TouchableOpacity
                      onPress={() => removeKeptImage(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}

                {keptVideos.map((video, index) => (
                  <View key={`kept-video-${index}-${video}`} className="mr-3 relative">
                    <View className="w-32 h-32 rounded-lg overflow-hidden bg-black">
                      <Video
                        source={{ uri: resolveSocialMediaUrl(video, API_BASE_URL) }}
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
                    <TouchableOpacity
                      onPress={() => removeKeptVideo(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}

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
            
            {totalMediaCount > 0 && (
              <Text className="text-sm text-gray-500">
                {totalMediaCount}/{MAX_MEDIA}
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default CreatePostModal; 