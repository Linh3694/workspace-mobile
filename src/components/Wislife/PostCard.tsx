// @ts-nocheck
import React, { useState } from 'react';
// @ts-ignore
import {
  View,
  Text,
  Image,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  GestureResponderEvent,
  StatusBar,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../Common';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import LottieView from 'lottie-react-native';
import { Post, Reaction } from '../../types/post';
import { postService } from '../../services/postService';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/constants';
import { formatRelativeTime } from '../../utils/dateUtils';
import LikeSkeletonSvg from '../../assets/like-skeleton.svg';
import { getAvatar } from '../../utils/avatar';
import { getEmojiByCode, isFallbackEmoji, hasLottieAnimation } from '../../utils/emojiUtils';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import ReactionPicker from './ReactionPicker';

interface PostCardProps {
  post: Post;
  onUpdate: (post: Post) => void;
  onDelete: (postId: string) => void;
  onCommentPress?: (post: Post) => void;
}

const { width } = Dimensions.get('window');

// Gradient Text Component đơn giản
const GradientText: React.FC<{ children: string; style?: any }> = ({ children, style }) => {
  return (
    <Text style={[{ fontSize: 16, fontWeight: '500', color: '#F05023' }, style]}>{children}</Text>
  );
};

const PostCard: React.FC<PostCardProps> = ({ post, onUpdate, onDelete, onCommentPress }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // State cho Reaction Picker modal
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<
    { x: number; y: number } | undefined
  >();

  // Xử lý scroll để cập nhật index ảnh hiện tại
  const handleImageScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentImageIndex(slideIndex);
  };

  // Mở modal và scroll tới ảnh được click
  const openImageModal = (index: number) => {
    setSelectedImageIndex(index);
    setCurrentImageIndex(index);
    setImageModalVisible(true);
  };

  const getUserReaction = (): Reaction | null => {
    const myIds = [user?._id, (user as any)?.id, user?.email, (user as any)?.username]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());
    if (myIds.length === 0) return null;

    const resolveOwnerIds = (r: any): string[] => {
      const ids: string[] = [];
      if (!r) return ids;
      if (typeof r.user === 'string') ids.push(r.user);
      if (r.userId) ids.push(r.userId);
      if (r.user && typeof r.user === 'object') {
        if (r.user._id) ids.push(r.user._id);
        if (r.user.id) ids.push(r.user.id);
        if (r.user.email) ids.push(r.user.email);
        if (r.user.username) ids.push(r.user.username);
      }
      return ids.map((v) => String(v).toLowerCase());
    };

    const found = (post.reactions as any[]).find((r) => {
      const ownerIds = resolveOwnerIds(r);
      return ownerIds.some((oid) => myIds.includes(oid));
    });
    return (found as unknown as Reaction) || null;
  };

  const getReactionCounts = () => {
    const counts: Record<string, number> = {};

    post.reactions.forEach((reaction) => {
      counts[reaction.type] = (counts[reaction.type] || 0) + 1;
    });

    return counts;
  };

  const handleReaction = async (emojiCode: string) => {
    // Đóng modal ngay lập tức khi chọn emoji
    setReactionPickerVisible(false);

    try {
      const userReaction = getUserReaction();

      let updatedPost: Post;
      if (userReaction) {
        if (userReaction.type === emojiCode) {
          // Remove reaction if same type
          updatedPost = await postService.removeReaction(post._id);
        } else {
          // Change reaction type
          updatedPost = await postService.addReaction(post._id, emojiCode);
        }
      } else {
        // Add new reaction
        updatedPost = await postService.addReaction(post._id, emojiCode);
      }

      onUpdate(updatedPost);
    } catch (error) {
      console.error('Error handling reaction:', error);
      Alert.alert('Lỗi', 'Không thể thực hiện reaction. Vui lòng thử lại.');
    }
  };

  const handleDeletePost = () => {
    Alert.alert('Xóa bài viết', 'Bạn có chắc chắn muốn xóa bài viết này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await postService.deletePost(post._id);
            onDelete(post._id);
          } catch (error) {
            console.error('Error deleting post:', error);
            Alert.alert('Lỗi', 'Không thể xóa bài viết. Vui lòng thử lại.');
          }
        },
      },
    ]);
  };

  const handlePinPost = async () => {
    try {
      let updatedPost: Post;
      if (post.isPinned) {
        // Unpin
        updatedPost = await postService.unpinPost(post._id);
        Alert.alert('Thành công', 'Đã bỏ ghim bài viết');
      } else {
        // Pin
        updatedPost = await postService.pinPost(post._id);
        Alert.alert('Thành công', 'Đã ghim bài viết lên đầu');
      }
      onUpdate(updatedPost);
    } catch (error) {
      console.error('Error pinning post:', error);
      Alert.alert('Lỗi', post.isPinned ? 'Không thể bỏ ghim bài viết' : 'Không thể ghim bài viết');
    }
  };

  const handlePostOptions = () => {
    Alert.alert('Tùy chọn bài viết', '', [
      {
        text: post.isPinned ? 'Bỏ ghim' : 'Ghim bài viết',
        onPress: handlePinPost,
      },
      {
        text: 'Xóa bài viết',
        style: 'destructive',
        onPress: handleDeletePost,
      },
      {
        text: 'Hủy',
        style: 'cancel',
      },
    ]);
  };

  const reactionCounts = getReactionCounts();
  const userReaction = getUserReaction();
  const totalReactions = post.reactions.length;

  // Kiểm tra xem user có quyền xóa bài viết không - CHỈ Mobile BOD
  // Mobile BOD có thể xóa mọi bài viết, kể cả bài của người khác
  const userRoles = (user as any)?.roles || [];
  const canDeletePost = userRoles.some((role: string) => role === 'Mobile BOD');

  // Mở modal chọn reaction khi tap vào nút Thích
  const handleLikeButtonPress = (event?: GestureResponderEvent) => {
    // Lấy vị trí để hiển thị modal gần nút bấm
    if (event?.nativeEvent) {
      setReactionPickerPosition({
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      });
    }
    setReactionPickerVisible(true);
  };

  return (
    <View className="mb-2 border-b border-gray-100 bg-white">
      {/* Pinned Badge - hiển thị nếu bài viết được ghim */}
      {post.isPinned && (
        <View className="flex-row items-center bg-blue-50 px-4 py-2">
          <Ionicons name="pin" size={14} color="#2563EB" />
          <Text className="ml-1.5 text-xs font-medium text-blue-600">Bài viết đã được ghim</Text>
        </View>
      )}

      {/* Header */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-1 flex-row items-center">
          <View className="h-10 w-10 overflow-hidden rounded-full bg-gray-300">
            <Image source={{ uri: getAvatar(post.author) }} className="h-full w-full" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="font-semibold text-gray-900">
              {post.author ? normalizeVietnameseName(post.author.fullname) : 'Ẩn danh'}
            </Text>
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-500">{formatRelativeTime(post.createdAt)}</Text>
              <Text className="mx-1 text-sm text-gray-400">•</Text>
              <Ionicons name="globe-outline" size={12} color="#6B7280" />
              <Text className="ml-1 text-sm text-gray-500">Công khai</Text>
            </View>
          </View>
        </View>

        {/* Nút tùy chọn (PIN/DELETE) - chỉ hiển thị cho Mobile BOD */}
        {canDeletePost && (
          <TouchableOpacity onPress={handlePostOptions} className="p-2">
            <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View className="px-4 pb-3">
        <Text className="text-base leading-5 text-gray-900">{post.content}</Text>
      </View>

      {/* Media */}
      {(post.images.length > 0 || post.videos.length > 0) && (
        <View className=" pb-3">
          {/* Images */}
          {post.images.length > 0 && (
            <View className="flex-row flex-wrap">
              {post.images.slice(0, 4).map((image, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => openImageModal(index)}
                  className={`relative ${
                    post.images.length === 1
                      ? 'w-full'
                      : post.images.length === 2
                        ? 'w-1/2'
                        : 'w-1/2'
                  } ${index > 0 ? 'pl-1' : ''} ${index > 1 ? 'pt-1' : ''}`}
                  style={{ aspectRatio: post.images.length === 1 ? 16 / 9 : 1 }}>
                  <Image
                    source={{ uri: `${API_BASE_URL}${image}` }}
                    className="h-full w-full "
                    resizeMode="cover"
                  />
                  {index === 3 && post.images.length > 4 && (
                    <View className="absolute inset-0 items-center justify-center rounded-lg bg-black bg-opacity-50">
                      <Text className="text-lg font-bold text-white">
                        +{post.images.length - 4}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Videos */}
          {post.videos.length > 0 && (
            <View className="mt-2 px-4">
              {post.videos.slice(0, 1).map((video, index) => (
                <View
                  key={index}
                  className="w-full overflow-hidden rounded-lg bg-black"
                  style={{ aspectRatio: 16 / 9 }}>
                  <Video
                    source={{ uri: `${API_BASE_URL}${video}` }}
                    style={{ width: '100%', height: '100%' }}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false}
                    isLooping={false}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Reactions Summary */}
      {totalReactions > 0 && (
        <View className="px-4 pb-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="flex-row items-center">
                {Object.entries(reactionCounts).map(([emojiCode, count]) => {
                  const emoji = getEmojiByCode(emojiCode);
                  if (!emoji || count === 0) return null;
                  return (
                    <View key={emojiCode} style={{ marginRight: 2 }}>
                      {hasLottieAnimation(emoji) ? (
                        <LottieView
                          source={emoji.lottieSource}
                          autoPlay
                          loop
                          style={{ width: 24, height: 24 }}
                        />
                      ) : (
                        <Text style={{ fontSize: 18 }}>{emoji.fallbackText}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
              <Text className="ml-2 text-sm text-gray-600">
                {totalReactions} {totalReactions === 1 ? 'lượt thích' : 'lượt thích'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => (onCommentPress ? onCommentPress(post) : undefined)}>
              <Text className="text-sm text-gray-600">{post.comments.length} bình luận</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View className="border-t border-gray-100 px-4 py-1">
        <View className="flex-row items-center justify-around">
          <TouchableOpacity
            onPress={(e) => handleLikeButtonPress(e)}
            className="flex-row items-center rounded-full px-4 py-2">
            <View style={{ marginRight: 8 }}>
              {userReaction ? (
                // Hiển thị emoji đã chọn
                (() => {
                  const emoji = getEmojiByCode(userReaction.type);
                  if (emoji && hasLottieAnimation(emoji)) {
                    return (
                      <LottieView
                        source={emoji.lottieSource}
                        autoPlay
                        loop
                        style={{ width: 28, height: 28 }}
                      />
                    );
                  } else if (emoji) {
                    return <Text style={{ fontSize: 24 }}>{emoji.fallbackText}</Text>;
                  }
                  return <LikeSkeletonSvg width={28} height={28} />;
                })()
              ) : (
                <LikeSkeletonSvg width={28} height={28} />
              )}
            </View>
            <Text
              className="font-medium"
              style={{
                color: userReaction
                  ? getEmojiByCode(userReaction.type)?.color || '#F05023'
                  : '#6B7280',
              }}>
              {userReaction ? getEmojiByCode(userReaction.type)?.name || 'Đã thích' : 'Thích'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => (onCommentPress ? onCommentPress(post) : undefined)}
            className="flex-row items-center rounded-full px-4 py-2">
            <Ionicons name="chatbubble-outline" size={24} color="#6B7280" />
            <Text className="ml-2 text-base font-medium text-gray-600">Bình luận</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Modal - Style mạng xã hội */}
      <Modal
        visible={imageModalVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setImageModalVisible(false)}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View className="flex-1 bg-black">
          {/* Header */}
          <View
            className="absolute left-0 right-0 z-10 flex-row items-center justify-between px-4"
            style={{ top: insets.top + 8 }}>
            {/* Thông tin người đăng */}
            <View className="flex-1 flex-row items-center">
              <View className="h-10 w-10 overflow-hidden rounded-full border-2 border-white/30">
                <Image source={{ uri: getAvatar(post.author) }} className="h-full w-full" />
              </View>
              <View className="ml-3">
                <Text className="font-semibold text-white">
                  {post.author ? normalizeVietnameseName(post.author.fullname) : 'Ẩn danh'}
                </Text>
                <Text className="text-xs text-white/70">{formatRelativeTime(post.createdAt)}</Text>
              </View>
            </View>

            {/* Nút đóng */}
            <TouchableOpacity
              onPress={() => setImageModalVisible(false)}
              className="h-10 w-10 items-center justify-center rounded-full bg-black/50">
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Ảnh */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleImageScroll}
            scrollEventThrottle={16}
            contentOffset={{ x: selectedImageIndex * width, y: 0 }}
            className="flex-1">
            {post.images.map((image, index) => (
              <View key={index} className="items-center justify-center" style={{ width }}>
                <Image
                  source={{ uri: `${API_BASE_URL}${image}` }}
                  className="h-full w-full"
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          {/* Page Indicator - Hiển thị khi có nhiều hơn 1 ảnh */}
          {post.images.length > 1 && (
            <View
              className="absolute left-0 right-0 items-center"
              style={{ bottom: insets.bottom + 24 }}>
              {/* Số trang */}
              <View className="mb-3 rounded-full bg-black/60 px-4 py-1.5">
                <Text className="text-sm font-medium text-white">
                  {currentImageIndex + 1} / {post.images.length}
                </Text>
              </View>

              {/* Dots indicator */}
              <View className="flex-row items-center justify-center">
                {post.images.map((_, index) => (
                  <View
                    key={index}
                    className={`mx-1 rounded-full ${
                      index === currentImageIndex ? 'h-2 w-2 bg-white' : 'h-1.5 w-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Reaction Picker Modal */}
      <ReactionPicker
        visible={reactionPickerVisible}
        onClose={() => setReactionPickerVisible(false)}
        onSelect={handleReaction}
        currentReaction={userReaction?.type}
        anchorPosition={reactionPickerPosition}
      />
    </View>
  );
};

export default PostCard;
