// @ts-nocheck
import React, { useState } from 'react';
// @ts-ignore
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TouchableOpacity } from '../Common';
import type { GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Post, Comment, Reaction } from '../../types/post';
import { postService } from '../../services/postService';
import { useAuth } from '../../context/AuthContext';
import { getAvatar } from '../../utils/avatar';
import { formatRelativeTime } from '../../utils/dateUtils';
import LikeSkeletonSvg from '../../assets/like-skeleton.svg';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  post: Post;
  onUpdate: (post: Post) => void;
}

// Gradient Text Component đơn giản
const GradientText: React.FC<{ children: string; style?: any }> = ({ children, style }) => {
  return (
    <Text style={[{ fontSize: 16, fontWeight: '500', color: '#F05023' }, style]}>{children}</Text>
  );
};

const CommentsModal: React.FC<CommentsModalProps> = ({ visible, onClose, post, onUpdate }) => {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [likingComment, setLikingComment] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

  // Sắp xếp comments từ mới nhất đến cũ nhất và nhóm replies
  const organizeComments = () => {
    // Tách main comments và replies
    const mainComments = post.comments.filter((comment) => !comment.parentComment);
    const replies = post.comments.filter((comment) => comment.parentComment);

    // Sort main comments từ mới đến cũ
    const sortedMainComments = [...mainComments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Tạo cấu trúc comments với replies
    return sortedMainComments.map((mainComment) => ({
      ...mainComment,
      replies: replies
        .filter((reply) => reply.parentComment === mainComment._id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), // replies sort cũ đến mới
    }));
  };

  const organizedComments = organizeComments();

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

  const handleLikeButtonPress = async () => {
    try {
      const userReaction = getUserReaction();
      if (userReaction) {
        // Remove like
        const updatedPost = await postService.removeReaction(post._id);
        onUpdate(updatedPost);
      } else {
        // Add like
        const updatedPost = await postService.addReaction(post._id, 'like');
        onUpdate(updatedPost);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Lỗi', 'Không thể thực hiện thao tác. Vui lòng thử lại.');
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      setLikingComment(commentId);

      // Kiểm tra xem user đã like comment này chưa
      const comment = post.comments.find((c) => c._id === commentId);
      if (!comment) return;

      const userReaction = comment.reactions.find((r) => r.user?._id === user?._id);

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

  const handleCommentReaction = (commentId: string, event?: GestureResponderEvent) => {
    setSelectedCommentId(commentId);
    // Nếu có sự kiện, dùng toạ độ tại điểm bấm để neo modal ngay bên dưới
    if (event?.nativeEvent?.pageX !== undefined && event?.nativeEvent?.pageY !== undefined) {
      setReactionButtonPosition({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY + 10 });
    }
    setCommentReactionModalVisible(true);
  };

  const handleCommentReactionSelect = async (commentId: string, emojiCode: string) => {
    try {
      setCommentReactionModalVisible(false);

      // Kiểm tra xem user đã có reaction loại này chưa
      const comment = post.comments.find((c) => c._id === commentId);
      if (!comment) return;

      const userReaction = comment.reactions.find((r) => r.user?._id === user?._id);

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
    const parts = content.split(
      /(@[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]*(?:\s+[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]*){0,2})/g
    );

    return (
      <Text className="text-base leading-5 text-gray-800">
        {parts.map((part, index) => {
          if (part.startsWith('@') && part.trim().length > 1) {
            return (
              <Text key={index} className="font-bold text-orange-500">
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
    reactions.forEach((reaction) => {
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
      onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white">
        {/* Reactions Section */}
        {totalReactions > 0 && (
          <View className="px-4 py-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center">
                <Ionicons name="heart" size={16} color="#EF4444" />
                <Text className="ml-2 font-semibold text-base text-[#757575]">
                  {totalReactions === 1
                    ? userReaction
                      ? 'Bạn'
                      : '1 người'
                    : userReaction
                      ? `Bạn và ${totalReactions - 1} người khác`
                      : `${totalReactions} người khác`}
                </Text>
              </View>
              {/* Reaction Button */}
              <TouchableOpacity
                onPress={handleLikeButtonPress}
                className="mr-5 flex-row items-center rounded-full px-3 py-2">
                <LikeSkeletonSvg width={32} height={32} />
                <Text
                  className={`ml-2 font-medium ${userReaction ? 'text-red-600' : 'text-gray-600'}`}>
                  {userReaction ? 'Đã thích' : 'Thích'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 60}>
          {/* Comments List */}
          <ScrollView className="flex-1 px-4">
            {post.comments.length === 0 ? (
              <View className="flex-1 items-center justify-center py-10">
                <Ionicons name="chatbubble-outline" size={64} color="#D1D5DB" />
                <Text className="mt-4 font-medium text-lg text-gray-500">
                  Chưa có bình luận nào
                </Text>
                <Text className="mt-2 px-8 text-center text-gray-400">
                  Hãy là người đầu tiên bình luận về bài viết này
                </Text>
              </View>
            ) : (
              <View>
                {organizedComments.map((comment) => (
                  <View key={comment._id} className="mb-6">
                    <View className="flex-row">
                      <View className="mr-1 h-10 w-10 overflow-hidden rounded-full">
                        <Image
                          source={{ uri: getAvatar(comment.user) }}
                          className="h-full w-full"
                        />
                      </View>
                      <View className="flex-1">
                        <View className="rounded-2xl px-4">
                          <View className="flex-row items-center justify-start gap-2">
                            <Text className="mb-1 font-semibold text-base text-gray-900">
                              {comment.user ? comment.user.fullname : 'Ẩn danh'}
                            </Text>
                            <Text className="mb-1 text-sm text-gray-500">
                              {formatRelativeTime(comment.createdAt)}
                            </Text>
                          </View>
                          {renderCommentContent(comment.content)}
                        </View>
                        <View className="mt-2 flex-row items-center justify-between">
                          <View className="flex-1 flex-row items-center">
                            <TouchableOpacity
                              className="ml-4"
                              onPress={(e) => handleCommentReaction(comment._id, e)}
                              disabled={likingComment === comment._id}>
                              <View className="flex-row items-center">
                                {(() => {
                                  const myReaction = comment.reactions.find(
                                    (r) => r.user?._id === user?._id
                                  );
                                  if (!myReaction) return null;
                                  const emoji = getEmojiByCode(myReaction.type);
                                  if (emoji && emoji.url) {
                                    return (
                                      <Image
                                        source={emoji.url}
                                        className="mr-1 h-4 w-4"
                                        resizeMode="contain"
                                      />
                                    );
                                  } else if (emoji && isFallbackEmoji(emoji)) {
                                    return (
                                      <Text className="mr-1 text-base">{emoji.fallbackText}</Text>
                                    );
                                  }
                                  return null;
                                })()}
                                {(() => {
                                  const reacted = comment.reactions.some((r: any) => {
                                    const ids = [
                                      r?.user?._id,
                                      r?.user?.id,
                                      r?.userId,
                                      r?.user?.email,
                                      typeof r?.user === 'string' ? r.user : undefined,
                                    ]
                                      .filter(Boolean)
                                      .map((v) => String(v).toLowerCase());
                                    const myIds = [
                                      user?._id,
                                      (user as any)?.id,
                                      user?.email,
                                      (user as any)?.username,
                                    ]
                                      .filter(Boolean)
                                      .map((v) => String(v).toLowerCase());
                                    return ids.some((id) => myIds.includes(id));
                                  });
                                  const label =
                                    likingComment === comment._id
                                      ? 'Đang xử lý...'
                                      : reacted
                                        ? 'Đã thích'
                                        : 'Thích';
                                  return (
                                    <Text
                                      className="font-bold text-sm"
                                      style={{ color: reacted ? '#F05023' : '#6B7280' }}>
                                      {label}
                                    </Text>
                                  );
                                })()}
                              </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                              className="ml-4"
                              onPress={() =>
                                handleReplyComment(
                                  comment._id,
                                  comment.user ? comment.user.fullname : 'Ẩn danh'
                                )
                              }>
                              <Text className="font-bold text-sm text-gray-600">Trả lời</Text>
                            </TouchableOpacity>
                          </View>
                          {comment.reactions.length > 0 && (
                            <View className="flex-row items-center">
                              <View className="flex-row items-center px-2 py-1">
                                <Text className="mr-1 text-sm text-gray-600">
                                  {comment.reactions.length}
                                </Text>
                                {getUniqueReactionTypes(comment.reactions).map((reactionType) => {
                                  const emoji = getEmojiByCode(reactionType);
                                  return (
                                    <View key={reactionType} className="mr-1">
                                      {emoji.url ? (
                                        <Image
                                          source={emoji.url}
                                          className="h-6 w-6"
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
                                  <View className="mr-3 h-8 w-8 overflow-hidden rounded-full bg-gray-300">
                                    <Image
                                      source={{ uri: getAvatar(reply.user) }}
                                      className="h-full w-full"
                                    />
                                  </View>
                                  <View className="flex-1">
                                    <View>
                                      <View className="flex-row items-center justify-start gap-2">
                                        <Text className="mb-1 font-semibold text-sm text-gray-900">
                                          {reply.user ? reply.user.fullname : 'Ẩn danh'}
                                        </Text>
                                        <Text className="mb-1 font-medium text-xs text-gray-500">
                                          {formatRelativeTime(reply.createdAt)}
                                        </Text>
                                      </View>
                                      {renderCommentContent(reply.content)}
                                    </View>

                                    {/* Actions và Reactions cho reply trên cùng một hàng */}
                                    <View className="mt-1 flex-row items-center justify-between">
                                      {/* Bên trái: Time và Action buttons */}
                                      <View className="flex-1 flex-row items-center">
                                        <TouchableOpacity
                                          className="ml-1"
                                          onPress={(e) => handleCommentReaction(reply._id, e)}>
                                          <View className="flex-row items-center">
                                            {(() => {
                                              const myReaction = reply.reactions.find(
                                                (r) => r.user?._id === user?._id
                                              );
                                              if (!myReaction) return null;
                                              const emoji = getEmojiByCode(myReaction.type);
                                              if (emoji && emoji.url) {
                                                return (
                                                  <Image
                                                    source={emoji.url}
                                                    className="mr-1 h-4 w-4"
                                                    resizeMode="contain"
                                                  />
                                                );
                                              } else if (emoji && isFallbackEmoji(emoji)) {
                                                return (
                                                  <Text className="mr-1 text-xs">
                                                    {emoji.fallbackText}
                                                  </Text>
                                                );
                                              }
                                              return null;
                                            })()}
                                            <Text
                                              className={`font-medium text-xs ${
                                                reply.reactions.some((r: any) => {
                                                  const ids = [
                                                    r?.user?._id,
                                                    r?.user?.id,
                                                    r?.userId,
                                                    r?.user?.email,
                                                    typeof r?.user === 'string'
                                                      ? r.user
                                                      : undefined,
                                                  ]
                                                    .filter(Boolean)
                                                    .map((v) => String(v).toLowerCase());
                                                  const myIds = [
                                                    user?._id,
                                                    (user as any)?.id,
                                                    user?.email,
                                                    (user as any)?.username,
                                                  ]
                                                    .filter(Boolean)
                                                    .map((v) => String(v).toLowerCase());
                                                  return ids.some((id) => myIds.includes(id));
                                                })
                                                  ? 'text-orange-500'
                                                  : 'text-gray-600'
                                              }`}
                                              style={{
                                                color: reply.reactions.some((r: any) => {
                                                  const ids = [
                                                    r?.user?._id,
                                                    r?.user?.id,
                                                    r?.userId,
                                                    r?.user?.email,
                                                    typeof r?.user === 'string'
                                                      ? r.user
                                                      : undefined,
                                                  ]
                                                    .filter(Boolean)
                                                    .map((v) => String(v).toLowerCase());
                                                  const myIds = [
                                                    user?._id,
                                                    (user as any)?.id,
                                                    user?.email,
                                                    (user as any)?.username,
                                                  ]
                                                    .filter(Boolean)
                                                    .map((v) => String(v).toLowerCase());
                                                  return ids.some((id) => myIds.includes(id));
                                                })
                                                  ? '#F05023'
                                                  : '#6B7280',
                                              }}>
                                              {reply.reactions.some((r: any) => {
                                                const ids = [
                                                  r?.user?._id,
                                                  r?.user?.id,
                                                  r?.userId,
                                                  r?.user?.email,
                                                  typeof r?.user === 'string' ? r.user : undefined,
                                                ]
                                                  .filter(Boolean)
                                                  .map((v) => String(v).toLowerCase());
                                                const myIds = [
                                                  user?._id,
                                                  (user as any)?.id,
                                                  user?.email,
                                                  (user as any)?.username,
                                                ]
                                                  .filter(Boolean)
                                                  .map((v) => String(v).toLowerCase());
                                                return ids.some((id) => myIds.includes(id));
                                              })
                                                ? 'Đã thích'
                                                : 'Thích'}
                                            </Text>
                                          </View>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                          className="ml-3"
                                          onPress={() =>
                                            handleReplyComment(
                                              reply._id,
                                              reply.user ? reply.user.fullname : 'Ẩn danh'
                                            )
                                          }>
                                          <Text className="font-medium text-xs text-gray-600">
                                            Trả lời
                                          </Text>
                                        </TouchableOpacity>
                                      </View>

                                      {/* Bên phải: Reply Reactions */}
                                      {reply.reactions.length > 0 && (
                                        <View className="flex-row items-center">
                                          <View className="flex-row items-center ">
                                            <Text className="mr-1 text-sm text-gray-600">
                                              {reply.reactions.length}
                                            </Text>
                                            {getUniqueReactionTypes(reply.reactions).map(
                                              (reactionType) => {
                                                const emoji = getEmojiByCode(reactionType);
                                                return (
                                                  <View key={reactionType} className="mr-1">
                                                    {emoji.url ? (
                                                      <Image
                                                        source={emoji.url}
                                                        className="h-6 w-6"
                                                        resizeMode="contain"
                                                      />
                                                    ) : isFallbackEmoji(emoji) ? (
                                                      <Text className="text-sm">
                                                        {emoji.fallbackText}
                                                      </Text>
                                                    ) : (
                                                      <Text className="text-sm">👍</Text>
                                                    )}
                                                  </View>
                                                );
                                              }
                                            )}
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
          <View className="border-t border-gray-200 bg-white px-4 py-3">
            {/* Reply indicator */}
            {replyingTo && (
              <View className="mb-2 flex-row items-center justify-between rounded-lg bg-gray-50 p-2">
                <View className="flex-1">
                  <Text className="text-sm text-gray-600">
                    Đang trả lời{' '}
                    <Text className="font-semibold text-gray-800">
                      {(() => {
                        const replyTarget = organizedComments.find((c) => c._id === replyingTo);
                        if (replyTarget)
                          return replyTarget.user ? replyTarget.user.fullname : 'Ẩn danh';

                        // Tìm trong replies nếu không tìm thấy trong main comments
                        for (const comment of organizedComments) {
                          const reply = comment.replies?.find((r) => r._id === replyingTo);
                          if (reply) return reply.user ? reply.user.fullname : 'Ẩn danh';
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
              <View className="mr-3 h-10 w-10 overflow-hidden rounded-full bg-gray-300">
                <Image source={{ uri: getAvatar(user) }} className="h-full w-full" />
              </View>
              <View className="flex-1 flex-row items-center rounded-full bg-gray-100 px-4 py-3">
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
                    paddingBottom: 0,
                  }}
                />
                <TouchableOpacity
                  onPress={handleComment}
                  disabled={!commentText.trim() || loading}
                  className={`ml-2 p-1 ${
                    commentText.trim() && !loading ? 'opacity-100' : 'opacity-50'
                  }`}>
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

      {/* Emoji reactions removed - simplified to like only */}
    </Modal>
  );
};

export default CommentsModal;
