// @ts-nocheck
import React, { useState } from 'react';
// @ts-ignore
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { Post, Reaction } from '../../types/post';
import { postService } from '../../services/postService';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/constants';
import { formatRelativeTime } from '../../utils/dateUtils';
import { useEmojis, CustomEmoji } from '../../hooks/useEmojis';
import EmojiReactionModal from './EmojiReactionModal';
import LikeSkeletonSvg from '../../assets/like-skeleton.svg';
import { getAvatar } from '../../utils/avatar';

interface PostCardProps {
  post: Post;
  onUpdate: (post: Post) => void;
  onDelete: (postId: string) => void;
  onCommentPress?: (post: Post) => void;
}

const { width } = Dimensions.get('window');

// Type for emoji data that can be either custom or fallback
type EmojiData =
  | CustomEmoji
  | {
      code: string;
      url: null;
      fallbackText: string;
    };

// Gradient Text Component đơn giản
const GradientText: React.FC<{ children: string; style?: any }> = ({ children, style }) => {
  return (
    <Text style={[{ fontSize: 16, fontWeight: '500', color: '#F05023' }, style]}>{children}</Text>
  );
};

const PostCard: React.FC<PostCardProps> = ({ post, onUpdate, onDelete, onCommentPress }) => {
  const { user } = useAuth();
  const { customEmojis } = useEmojis();
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [emojiModalVisible, setEmojiModalVisible] = useState(false);
  const [likeButtonPosition, setLikeButtonPosition] = useState<
    { x: number; y: number } | undefined
  >(undefined);
  const likeButtonRef = React.useRef<View>(null);

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

  const getEmojiByCode = (code: string): EmojiData => {
    const emoji = customEmojis.find((emoji) => emoji.code === code);

    // Fallback cho các emoji codes cũ hoặc không tồn tại
    if (!emoji) {
      // Map legacy reaction types to emoji text
      const legacyEmojiMap: Record<string, string> = {
        like: '👍',
        love: '❤️',
        haha: '😂',
        sad: '😢',
        wow: '😮',
      };

      return {
        code,
        url: null,
        fallbackText: legacyEmojiMap[code] || '👍',
      };
    }

    return emoji;
  };

  // Type guard function
  const isFallbackEmoji = (
    emoji: EmojiData
  ): emoji is { code: string; url: null; fallbackText: string } => {
    return emoji.url === null && 'fallbackText' in emoji;
  };

  const handleReaction = async (emojiCode: string) => {
    // Đóng modal ngay lập tức khi chọn emoji
    setEmojiModalVisible(false);

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

  const reactionCounts = getReactionCounts();
  const userReaction = getUserReaction();
  const totalReactions = post.reactions.length;
  const isAuthor = !!post.author && post.author._id === user?._id;

  const handleLikeButtonPress = () => {
    // Nếu modal đang mở thì đóng lại
    if (emojiModalVisible) {
      setEmojiModalVisible(false);
      return;
    }

    // Mở modal mới
    if (likeButtonRef.current) {
      // Dùng measureInWindow để lấy toạ độ tuyệt đối trên màn hình
      likeButtonRef.current.measureInWindow((x, y, width, height) => {
        // Đặt modal ngay dưới nút và canh giữa theo bề rộng của nút
        setLikeButtonPosition({ x: x + width / 2, y: y + height + 10 });
        setEmojiModalVisible(true);
      });
    } else {
      setEmojiModalVisible(true);
    }
  };

  const handleCloseEmojiModal = () => {
    setEmojiModalVisible(false);
  };

  return (
    <View className="mb-2 border-b border-gray-100 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-1 flex-row items-center">
          <View className="h-10 w-10 overflow-hidden rounded-full bg-gray-300">
            <Image source={{ uri: getAvatar(post.author) }} className="h-full w-full" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="font-semibold text-gray-900">
              {post.author ? post.author.fullname : 'Ẩn danh'}
            </Text>
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-500">{formatRelativeTime(post.createdAt)}</Text>
              {post.author?.jobTitle && (
                <>
                  <Text className="mx-1 text-sm text-gray-400">•</Text>
                  <Text className="text-sm text-gray-500">{post.author.jobTitle}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {isAuthor && (
          <TouchableOpacity onPress={handleDeletePost} className="p-2">
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
                  onPress={() => {
                    setSelectedImageIndex(index);
                    setImageModalVisible(true);
                  }}
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
                      <Text className="font-bold text-lg text-white">
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
            <View className="mt-2">
              {post.videos.slice(0, 1).map((video, index) => (
                <View key={index} className="w-full rounded-lg" style={{ height: 200 }}>
                  <Video
                    source={{ uri: `${API_BASE_URL}${video}` }}
                    className="h-full w-full rounded-lg"
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
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
              <View className="flex-row">
                {Object.entries(reactionCounts).map(([emojiCode, count]) => {
                  const emoji = getEmojiByCode(emojiCode);
                  if (!emoji || count === 0) return null;
                  return (
                    <View key={emojiCode}>
                      {emoji.url ? (
                        <Image source={emoji.url} className="h-8 w-8" resizeMode="contain" />
                      ) : isFallbackEmoji(emoji) ? (
                        <Text className="text-lg">{emoji.fallbackText}</Text>
                      ) : (
                        <Text className="text-lg">👍</Text>
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
            onPress={handleLikeButtonPress}
            className="flex-row items-center rounded-full px-4 py-2"
            ref={likeButtonRef}>
            {userReaction ? (
              <>
                {(() => {
                  const emoji = getEmojiByCode(userReaction.type);
                  if (emoji && emoji.url) {
                    return (
                      <Image source={emoji.url} className="mr-2 h-9 w-9" resizeMode="contain" />
                    );
                  } else if (emoji && isFallbackEmoji(emoji)) {
                    return <Text className="mr-2 text-xl">{emoji.fallbackText}</Text>;
                  } else {
                    return (
                      <View style={{ marginRight: 8 }}>
                        <LikeSkeletonSvg width={28} height={28} />
                      </View>
                    );
                  }
                })()}

                <GradientText style={{ fontFamily: 'Mulish-Bold', fontSize: 15 }}>
                  Đã thích
                </GradientText>
              </>
            ) : (
              <>
                <View style={{ marginRight: 8 }}>
                  <LikeSkeletonSvg width={28} height={28} />
                </View>
                <Text className="font-medium text-gray-600">Thích</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => (onCommentPress ? onCommentPress(post) : undefined)}
            className="flex-row items-center rounded-full px-4 py-2">
            <Ionicons name="chatbubble-outline" size={24} color="#6B7280" />
            <Text className="ml-2 font-medium text-base text-gray-600">Bình luận</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Emoji Reaction Modal */}
      <EmojiReactionModal
        visible={emojiModalVisible}
        onClose={handleCloseEmojiModal}
        onEmojiSelect={handleReaction}
        position={likeButtonPosition}
      />

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        onRequestClose={() => setImageModalVisible(false)}>
        <View className="flex-1 bg-black">
          <TouchableOpacity
            onPress={() => setImageModalVisible(false)}
            className="absolute right-4 top-12 z-10 p-3">
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
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
        </View>
      </Modal>
    </View>
  );
};

export default PostCard;
