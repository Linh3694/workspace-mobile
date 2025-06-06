import React, { useState } from 'react';
// @ts-ignore
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Post, Comment, Reaction } from '../../types/post';
import { postService } from '../../services/postService';
import { useAuth } from '../../context/AuthContext';
import { getAvatar } from '../../utils/avatar';
import { formatRelativeTime } from '../../utils/dateUtils';
import { useEmojis, CustomEmoji } from '../../hooks/useEmojis';
import EmojiReactionModal from './EmojiReactionModal';
import LikeSkeletonSvg from '../../assets/like-skeleton.svg';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  post: Post;
  onUpdate: (post: Post) => void;
}

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

const CommentsModal: React.FC<CommentsModalProps> = ({
  visible,
  onClose,
  post,
  onUpdate,
}) => {
  const { user } = useAuth();
  const { customEmojis } = useEmojis();
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [emojiModalVisible, setEmojiModalVisible] = useState(false);
  const [reactionButtonPosition, setReactionButtonPosition] = useState<{ x: number; y: number } | undefined>(undefined);
  const reactionsRef = React.useRef<View>(null);
  const likeButtonRef = React.useRef<View>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [likingComment, setLikingComment] = useState<string | null>(null);
  const [commentReactionModalVisible, setCommentReactionModalVisible] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

  // Sắp xếp comments từ mới nhất đến cũ nhất và nhóm replies
  const organizeComments = () => {
    // Tách main comments và replies
    const mainComments = post.comments.filter(comment => !comment.parentComment);
    const replies = post.comments.filter(comment => comment.parentComment);
    
    // Sort main comments từ mới đến cũ
    const sortedMainComments = [...mainComments].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Tạo cấu trúc comments với replies
    return sortedMainComments.map(mainComment => ({
      ...mainComment,
      replies: replies
        .filter(reply => reply.parentComment === mainComment._id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) // replies sort cũ đến mới
    }));
  };

  const organizedComments = organizeComments();

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

  const handleLikeButtonPress = () => {
    // Nếu modal đang mở thì đóng lại
    if (emojiModalVisible) {
      setEmojiModalVisible(false);
      return;
    }
    // Đo vị trí của like button và hiển thị modal ngay dưới đó
    if (likeButtonRef.current) {
      likeButtonRef.current.measureInWindow((x, y, width, height) => {
        setReactionButtonPosition({ x: x, y: y + height + 10 });
        setEmojiModalVisible(true);
      });
    } else {
      setEmojiModalVisible(true);
    }
  };

  const handleCloseEmojiModal = () => {
    setEmojiModalVisible(false);
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      setLikingComment(commentId);
      
      // Kiểm tra xem user đã like comment này chưa
      const comment = post.comments.find(c => c._id === commentId);
      if (!comment) return;
      
      const userReaction = comment.reactions.find(r => r.user._id === user?._id);
      
      let updatedPost: Post;
      if (userReaction) {
        // User đã like, remove reaction
        updatedPost = await postService.removeCommentReaction(post._id, commentId);
      } else {
        // User chưa like, add reaction với type 'like'
        updatedPost = await postService.addCommentReaction(post._id, commentId, 'like');
      }
      
      onUpdate(updatedPost);
    } catch (error) {
      console.error('Error liking comment:', error);
      Alert.alert('Lỗi', 'Không thể thích bình luận. Vui lòng thử lại.');
    } finally {
      setLikingComment(null);
    }
  };

  const handleCommentReaction = (commentId: string) => {
    setSelectedCommentId(commentId);
    setCommentReactionModalVisible(true);
  };

  const handleCommentReactionSelect = async (commentId: string, emojiCode: string) => {
    try {
      setCommentReactionModalVisible(false);
      
      // Kiểm tra xem user đã có reaction loại này chưa
      const comment = post.comments.find(c => c._id === commentId);
      if (!comment) return;
      
      const userReaction = comment.reactions.find(r => r.user._id === user?._id);
      
      let updatedPost: Post;
      if (userReaction && userReaction.type === emojiCode) {
        // Cùng loại reaction, remove it
        updatedPost = await postService.removeCommentReaction(post._id, commentId);
      } else {
        // Khác loại hoặc chưa có reaction, add/update reaction
        updatedPost = await postService.addCommentReaction(post._id, commentId, emojiCode);
      }
      
      onUpdate(updatedPost);
    } catch (error) {
      console.error('Error adding comment reaction:', error);
      Alert.alert('Lỗi', 'Không thể thêm reaction. Vui lòng thử lại.');
    }
  };

  const handleReplyComment = (commentId: string, commentAuthor: string) => {
    setReplyingTo(commentId);
    setCommentText(`@${commentAuthor} `);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;

    try {
      setLoading(true);
      if (replyingTo) {
        // Xử lý reply comment
        const cleanContent = commentText.trim();
        const updatedPost = await postService.replyComment(post._id, replyingTo, cleanContent);
        onUpdate(updatedPost);
      } else {
        // Xử lý comment thông thường
        const updatedPost = await postService.addComment(post._id, commentText.trim());
        onUpdate(updatedPost);
      }
      setCommentText('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Lỗi', 'Không thể thêm bình luận. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const reactionCounts = getReactionCounts();
  const userReaction = getUserReaction();
  const totalReactions = post.reactions.length;

  const renderCommentContent = (content: string) => {
    // Tách text thành các phần để highlight @mentions
    // Chỉ match tên người thật: @ + từ đầu viết hoa + tối đa 2 từ tiếp theo cũng viết hoa
    const parts = content.split(/(@[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]*(?:\s+[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]*){0,2})/g);
    
    return (
      <Text className="text-gray-800 text-base leading-5">
        {parts.map((part, index) => {
          if (part.startsWith('@') && part.trim().length > 1) {
            return (
              <Text key={index} className="text-blue-500 font-medium">
                {part.trim()}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  const getUniqueReactionTypes = (reactions: Reaction[]): string[] => {
    const types: string[] = [];
    reactions.forEach(reaction => {
      if (!types.includes(reaction.type)) {
        types.push(reaction.type);
      }
    });
    return types;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-white">
        {/* Reactions Section */}
        {totalReactions > 0 && (
          <View className="px-4 py-3" ref={reactionsRef}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="flex-row">
                  {Object.entries(reactionCounts).map(([emojiCode, count]) => {
                    const emoji = getEmojiByCode(emojiCode);
                    if (!emoji || count === 0) return null;
                    return (
                      <View key={emojiCode}>
                        {emoji.url ? (
                          <Image
                            source={emoji.url}
                            className="w-8 h-8"
                            resizeMode="contain"
                          />
                        ) : isFallbackEmoji(emoji) ? (
                          <Text className="text-sm font-medium">{emoji.fallbackText}</Text>
                        ) : (
                          <Text className="text-sm font-medium">👍</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
                <Text className="text-base font-semibold text-[#757575] ml-2">
                  {totalReactions === 1 
                    ? (userReaction ? 'Bạn' : '1 người')
                    : userReaction 
                      ? `Bạn và ${totalReactions - 1} người khác` 
                      : `${totalReactions} người khác`}
                </Text>
              </View>
              {/* Reaction Button */}
              <TouchableOpacity
                onPress={handleLikeButtonPress}
                className="flex-row items-center px-3 py-2 rounded-full mr-5"
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
                            className="w-8 h-8 mr-1"
                            resizeMode="contain"
                          />
                        );
                      } else if (emoji && isFallbackEmoji(emoji)) {
                        return (
                          <Text className="text-lg mr-1 font-semibold">{emoji.fallbackText}</Text>
                        );
                      } else {
                        return (
                          <LikeSkeletonSvg width={24} height={24} />
                        );
                      }
                    })()}
                    
                    <GradientText style={{ fontSize: 13 }}>
                      Thích
                    </GradientText>
                  </>
                ) : (
                  <>
                    <LikeSkeletonSvg width={32} height={32} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <KeyboardAvoidingView 
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 60}
        >
          {/* Comments List */}
          <ScrollView className="flex-1 px-4">
            {post.comments.length === 0 ? (
              <View className="flex-1 items-center justify-center py-10">
                <Ionicons name="chatbubble-outline" size={64} color="#D1D5DB" />
                <Text className="mt-4 text-lg font-medium text-gray-500">
                  Chưa có bình luận nào
                </Text>
                <Text className="mt-2 text-gray-400 text-center px-8">
                  Hãy là người đầu tiên bình luận về bài viết này
                </Text>
              </View>
            ) : (
              <View>
                {organizedComments.map((comment) => (
                  <View key={comment._id} className="mb-6">
                    <View className="flex-row">
                      <View className="w-10 h-10 rounded-full overflow-hidden mr-1">
                        <Image 
                          source={{ uri: getAvatar(comment.user) }} 
                          className="w-full h-full"
                        />
                      </View>
                      <View className="flex-1">
                        <View className="rounded-2xl px-4">
                            <View className="flex-row items-center justify-start gap-2">
                          <Text className="font-semibold text-base text-gray-900 mb-1">
                            {comment.user.fullname}
                         </Text>
                            <Text className="text-sm text-gray-500">
                              {formatRelativeTime(comment.createdAt)}
                                        </Text>
                                        </View>
                          {renderCommentContent(comment.content)}
                        </View>
                        
                        {/* Actions và Reactions trên cùng một hàng */}
                        <View className="flex-row items-center justify-between mt-2">
                          {/* Bên trái: Time và Action buttons */}
                          <View className="flex-row items-center flex-1">
                           
                            <TouchableOpacity 
                              className="ml-4"
                              onPress={() => handleCommentReaction(comment._id)}
                              disabled={likingComment === comment._id}
                            >
                              <Text className={`text-sm font-bold ${
                                comment.reactions.some(r => r.user._id === user?._id) 
                                  ? 'text-orange-500' 
                                  : 'text-gray-600'
                              }`}>
                                {likingComment === comment._id ? 'Đang xử lý...' : 
                                 comment.reactions.some(r => r.user._id === user?._id) ? 'Đã thích' : 'Thích'}
                              </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              className="ml-4"
                              onPress={() => handleReplyComment(comment._id, comment.user.fullname)}
                            >
                              <Text className="text-sm text-gray-600 font-bold">
                                Trả lời
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Bên phải: Comment Reactions */}
                          {comment.reactions.length > 0 && (
                            <View className="flex-row items-center">
                                            <View className="flex-row items-center px-2 py-1">
                                                 <Text className="text-sm text-gray-600 mr-1">
                                  {comment.reactions.length}
                                </Text>
                                {getUniqueReactionTypes(comment.reactions).map((reactionType) => {
                                  const emoji = getEmojiByCode(reactionType);
                                  return (
                                    <View key={reactionType} className="mr-1">
                                      {emoji.url ? (
                                        <Image
                                          source={emoji.url}
                                          className="w-6 h-6"
                                          resizeMode="contain"
                                        />
                                      ) : isFallbackEmoji(emoji) ? (
                                        <Text className="text-base">{emoji.fallbackText}</Text>
                                      ) : (
                                        <Text className="text-base">👍</Text>
                                      )}
                                    </View>
                                  );
                                })}
                               
                              </View>
                            </View>
                          )}
                        </View>

                        {/* Hiển thị replies */}
                        {comment.replies && comment.replies.length > 0 && (
                          <View className="ml-6 mt-4">
                            {comment.replies.map((reply) => (
                              <View key={reply._id} className="mb-4">
                                <View className="flex-row">
                                  <View className="w-8 h-8 rounded-full overflow-hidden bg-gray-300 mr-3">
                                    <Image 
                                      source={{ uri: getAvatar(reply.user) }} 
                                      className="w-full h-full"
                                    />
                                  </View>
                                  <View className="flex-1">
                                            <View>
                                                <View className="flex-row items-center justify-start gap-2">
                                      <Text className="font-semibold text-sm text-gray-900 mb-1">
                                        {reply.user.fullname}
                                                </Text>
                                                 <Text className="text-xs text-gray-500 font-medium">
                                          {formatRelativeTime(reply.createdAt)}
                                                    </Text>
                                                    </View>
                                      {renderCommentContent(reply.content)}
                                    </View>
                                    
                                    {/* Actions và Reactions cho reply trên cùng một hàng */}
                                    <View className="flex-row items-center justify-between mt-1">
                                      {/* Bên trái: Time và Action buttons */}
                                      <View className="flex-row items-center flex-1">
                                       
                                        
                                        <TouchableOpacity 
                                          className="ml-1"
                                          onPress={() => handleCommentReaction(reply._id)}
                                        >
                                          <Text className={`text-xs font-medium ${
                                            reply.reactions.some(r => r.user._id === user?._id) 
                                              ? 'text-orange-500' 
                                              : 'text-gray-600'
                                          }`}>
                                            {reply.reactions.some(r => r.user._id === user?._id) ? 'Đã thích' : 'Thích'}
                                          </Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity 
                                          className="ml-3"
                                          onPress={() => handleReplyComment(comment._id, reply.user.fullname)}
                                        >
                                          <Text className="text-xs text-gray-600 font-medium">
                                            Trả lời
                                          </Text>
                                        </TouchableOpacity>
                                      </View>

                                      {/* Bên phải: Reply Reactions */}
                                      {reply.reactions.length > 0 && (
                                        <View className="flex-row items-center">
                                                        <View className="flex-row items-center ">
                                                            <Text className="text-sm text-gray-600 mr-1">
                                              {reply.reactions.length}
                                            </Text>
                                            {getUniqueReactionTypes(reply.reactions).map((reactionType) => {
                                              const emoji = getEmojiByCode(reactionType);
                                              return (
                                                <View key={reactionType} className="mr-1">
                                                  {emoji.url ? (
                                                    <Image
                                                      source={emoji.url}
                                                      className="w-6 h-6"
                                                      resizeMode="contain"
                                                    />
                                                  ) : isFallbackEmoji(emoji) ? (
                                                    <Text className="text-sm">{emoji.fallbackText}</Text>
                                                  ) : (
                                                    <Text className="text-sm">👍</Text>
                                                  )}
                                                </View>
                                              );
                                            })}
                                            
                                          </View>
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Comment Input */}
          <View className="px-4 py-3 border-t border-gray-200 bg-white">
            {/* Reply indicator */}
            {replyingTo && (
              <View className="flex-row items-center justify-between mb-2 p-2 bg-gray-50 rounded-lg">
                <View className="flex-1">
                  <Text className="text-sm text-gray-600">
                    Đang trả lời{' '}
                    <Text className="font-semibold text-gray-800">
                      {(() => {
                        const replyTarget = organizedComments.find(c => c._id === replyingTo);
                        if (replyTarget) return replyTarget.user.fullname;
                        
                        // Tìm trong replies nếu không tìm thấy trong main comments
                        for (const comment of organizedComments) {
                          const reply = comment.replies?.find(r => r._id === replyingTo);
                          if (reply) return reply.user.fullname;
                        }
                        return 'comment';
                      })()}
                    </Text>
                  </Text>
                </View>
                <TouchableOpacity onPress={handleCancelReply}>
                  <Ionicons name="close" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}
            
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full overflow-hidden bg-gray-300 mr-3">
                <Image 
                  source={{ uri: getAvatar(user) }} 
                  className="w-full h-full"
                />
              </View>
              <View className="flex-1 flex-row items-center bg-gray-100 rounded-full px-4 py-3">
                <TextInput
                  className="flex-1 text-base"
                  placeholder="Nhập tin nhắn..."
                  placeholderTextColor="#9CA3AF"
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  textAlignVertical="center"
                  style={{ 
                    minHeight: 24,
                    maxHeight: 100,
                    textAlign: 'left',
                    paddingTop: 0,
                    paddingBottom: 0
                  }}
                />
                <TouchableOpacity
                  onPress={handleComment}
                  disabled={!commentText.trim() || loading}
                  className={`ml-2 p-1 ${
                    commentText.trim() && !loading ? 'opacity-100' : 'opacity-50'
                  }`}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FF7A00" />
                  ) : (
                    <Ionicons name="send" size={20} color="#FF7A00" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Emoji Reaction Modal */}
      <EmojiReactionModal
        visible={emojiModalVisible}
        onClose={handleCloseEmojiModal}
        onEmojiSelect={handleReaction}
        position={reactionButtonPosition}
      />

      {/* Comment Reaction Modal */}
      <EmojiReactionModal
        visible={commentReactionModalVisible}
        onClose={() => setCommentReactionModalVisible(false)}
        onEmojiSelect={(emojiCode) => selectedCommentId && handleCommentReactionSelect(selectedCommentId, emojiCode)}
        position={undefined}
      />
    </Modal>
  );
};

export default CommentsModal; 