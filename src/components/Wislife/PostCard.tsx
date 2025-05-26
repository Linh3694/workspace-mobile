import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  ImageSourcePropType,
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
}

const { width } = Dimensions.get('window');

// Type for emoji data that can be either custom or fallback
type EmojiData = CustomEmoji | {
  code: string;
  url: null;
  fallbackText: string;
};

// Gradient Text Component đơn giản
const GradientText: React.FC<{ children: string; style?: any }> = ({ children, style }) => {
  return (
    <Text style={[{ fontSize: 16, fontWeight: '500', color: '#F05023' }, style]}>
      {children}
    </Text>
  );
};

const PostCard: React.FC<PostCardProps> = ({ post, onUpdate, onDelete }) => {
  const { user } = useAuth();
  const { customEmojis } = useEmojis();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [emojiModalVisible, setEmojiModalVisible] = useState(false);
  const [likeButtonPosition, setLikeButtonPosition] = useState<{ x: number; y: number } | undefined>(undefined);
  const likeButtonRef = React.useRef<View>(null);

  const getUserReaction = (): Reaction | null => {
    return post.reactions.find(reaction => reaction.user._id === user?._id) || null;
  };

  const getReactionCounts = () => {
    const counts: Record<string, number> = {};
    
    post.reactions.forEach(reaction => {
      counts[reaction.type] = (counts[reaction.type] || 0) + 1;
    });

    return counts;
  };

  const getEmojiByCode = (code: string): EmojiData => {
    const emoji = customEmojis.find(emoji => emoji.code === code);
    
    // Fallback cho các emoji codes cũ hoặc không tồn tại
    if (!emoji) {
      // Map legacy reaction types to emoji text
      const legacyEmojiMap: Record<string, string> = {
        'like': '👍',
        'love': '❤️',
        'haha': '😂',
        'sad': '😢',
        'wow': '😮'
      };
      
      return {
        code,
        url: null,
        fallbackText: legacyEmojiMap[code] || '👍'
      };
    }
    
    return emoji;
  };

  // Type guard function
  const isFallbackEmoji = (emoji: EmojiData): emoji is { code: string; url: null; fallbackText: string } => {
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

  const handleComment = async () => {
    if (!commentText.trim()) return;

    try {
      setLoading(true);
      const updatedPost = await postService.addComment(post._id, commentText.trim());
      onUpdate(updatedPost);
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Lỗi', 'Không thể thêm bình luận. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = () => {
    Alert.alert(
      'Xóa bài viết',
      'Bạn có chắc chắn muốn xóa bài viết này?',
      [
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
      ]
    );
  };

  const reactionCounts = getReactionCounts();
  const userReaction = getUserReaction();
  const totalReactions = post.reactions.length;
  const isAuthor = post.author._id === user?._id;

  const handleLikeButtonPress = () => {
    // Nếu modal đang mở thì đóng lại
    if (emojiModalVisible) {
      setEmojiModalVisible(false);
      return;
    }
    
    // Mở modal mới
    if (likeButtonRef.current) {
      likeButtonRef.current.measure((fx, fy, width, height, px, py) => {
        setLikeButtonPosition({ x: px, y: py });
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
    <View className="bg-white mb-2 border-b border-gray-100">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full overflow-hidden bg-gray-300">
            <Image 
              source={{ uri: getAvatar(post.author) }} 
              className="w-full h-full"
            />
          </View>
          <View className="ml-3 flex-1">
            <Text className="font-semibold text-gray-900">
              {post.author.fullname}
            </Text>
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-500">
                {formatRelativeTime(post.createdAt)}
              </Text>
              {post.author.jobTitle && (
                <>
                  <Text className="text-sm text-gray-400 mx-1">•</Text>
                  <Text className="text-sm text-gray-500">
                    {post.author.jobTitle}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
        
        {isAuthor && (
          <TouchableOpacity
            onPress={handleDeletePost}
            className="p-2"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View className="px-4 pb-3">
        <Text className="text-gray-900 text-base leading-5">
          {post.content}
        </Text>
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
                  style={{ aspectRatio: post.images.length === 1 ? 16/9 : 1 }}
                >
                  <Image
                    source={{ uri: `${API_BASE_URL}${image}` }}
                    className="w-full h-full "
                    resizeMode="cover"
                  />
                  {index === 3 && post.images.length > 4 && (
                    <View className="absolute inset-0 bg-black bg-opacity-50 rounded-lg items-center justify-center">
                      <Text className="text-white text-lg font-bold">
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
                <Video
                  key={index}
                  source={{ uri: `${API_BASE_URL}${video}` }}
                  className="w-full rounded-lg"
                  style={{ height: 200 }}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                />
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
                    <View key={emojiCode} className="mr-1">
                      {emoji.url ? (
                        <Image
                          source={emoji.url}
                          className="w-8 h-8"
                          resizeMode="contain"
                        />
                      ) : isFallbackEmoji(emoji) ? (
                        <Text className="text-lg">{emoji.fallbackText}</Text>
                      ) : (
                        <Text className="text-lg">👍</Text>
                      )}
                    </View>
                  );
                })}
              </View>
              <Text className="text-sm text-gray-600 ml-2">
                {totalReactions} {totalReactions === 1 ? 'lượt thích' : 'lượt thích'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowComments(!showComments)}>
              <Text className="text-sm text-gray-600">
                {post.comments.length} bình luận
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View className="px-4 py-1 border-t border-gray-100">
        <View className="flex-row items-center justify-around">
          <TouchableOpacity
            onPress={handleLikeButtonPress}
            className="flex-row items-center px-4 py-2 rounded-full"
            ref={likeButtonRef}
          >
            {userReaction ? (
              <>
                {(() => {
                  const emoji = getEmojiByCode(userReaction.type);
                  if (emoji && emoji.url) {
                    return (
                      <Image
                        source={emoji.url}
                        className="w-9 h-9 mr-2"
                        resizeMode="contain"
                      />
                    );
                  } else if (emoji && isFallbackEmoji(emoji)) {
                    return (
                      <Text className="text-xl mr-2">{emoji.fallbackText}</Text>
                    );
                  } else {
                    return (
                      <LikeSkeletonSvg width={28} height={28} style={{ marginRight: 8 }} />
                    );
                  }
                })()}
                
                <GradientText style={{ fontFamily: 'Mulish-Bold', fontSize: 15 }}>
                  Thích
                </GradientText>
              </>
            ) : (
              <>
                <LikeSkeletonSvg width={28} height={28} style={{ marginRight: 8 }} />
                <Text className="font-medium text-gray-600">
                  Thích
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowComments(!showComments)}
            className="flex-row items-center px-4 py-2 rounded-full"
          >
            <Ionicons name="chatbubble-outline" size={24} color="#6B7280" />
            <Text className="ml-2 font-medium text-gray-600 text-base">
              Bình luận
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Comments */}
      {showComments && (
        <View className="px-4 pb-4 border-t border-gray-100">
          {/* Comment Input */}
          <View className="flex-row items-center py-3">
            <View className="w-8 h-8 rounded-full overflow-hidden bg-gray-300 mr-3">
              <Image 
                source={{ uri: getAvatar(user) }} 
                className="w-full h-full"
              />
            </View>
            <View className="flex-1 flex-row items-center bg-gray-100 rounded-full px-3 py-2">
              <TextInput
                className="flex-1 text-base"
                placeholder="Viết bình luận..."
                placeholderTextColor="#9CA3AF"
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                onPress={handleComment}
                disabled={!commentText.trim() || loading}
                className={`ml-2 ${
                  commentText.trim() && !loading ? 'opacity-100' : 'opacity-50'
                }`}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FF7A00" />
                ) : (
                  <Ionicons name="send" size={16} color="#FF7A00" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments List */}
          {post.comments.map((comment) => (
            <View key={comment._id} className="flex-row mb-3">
              <View className="w-8 h-8 rounded-full overflow-hidden bg-gray-300 mr-3">
                <Image 
                  source={{ uri: getAvatar(comment.user) }} 
                  className="w-full h-full"
                />
              </View>
              <View className="flex-1">
                <View className="bg-gray-100 rounded-lg px-3 py-2">
                  <Text className="font-semibold text-sm text-gray-900">
                    {comment.user.fullname}
                  </Text>
                  <Text className="text-[#757575] mt-1">
                    {comment.content}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500 mt-1 ml-3">
                  {formatRelativeTime(comment.createdAt)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

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
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View className="flex-1 bg-black">
          <TouchableOpacity
            onPress={() => setImageModalVisible(false)}
            className="absolute top-12 right-4 z-10 p-3"
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            className="flex-1"
          >
            {post.images.map((image, index) => (
              <View key={index} className="items-center justify-center" style={{ width }}>
                <Image
                  source={{ uri: `${API_BASE_URL}${image}` }}
                  className="w-full h-full"
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