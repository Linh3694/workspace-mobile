// @ts-nocheck
import React, { useState, useRef } from 'react';
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
import LottieView from 'lottie-react-native';
import { Post, Comment, Reaction } from '../../types/post';
import { postService } from '../../services/postService';
import { useAuth } from '../../context/AuthContext';
import { getAvatar } from '../../utils/avatar';
import { formatRelativeTime } from '../../utils/dateUtils';
import LikeSkeletonSvg from '../../assets/like-skeleton.svg';
import { getEmojiByCode, isFallbackEmoji, hasLottieAnimation } from '../../utils/emojiUtils';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import ReactionPicker from './ReactionPicker';
import ReactionsListModal from './ReactionsListModal';
import MentionInput, { MentionUser, extractMentionIds, getMentionPlainText } from './MentionInput';

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
  // Lưu parent comment khi reply một reply (để gửi API đúng)
  const [replyingToParent, setReplyingToParent] = useState<string | null>(null);
  const [likingComment, setLikingComment] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  // State cho Reaction Picker modals
  const [postReactionPickerVisible, setPostReactionPickerVisible] = useState(false);
  const [commentReactionModalVisible, setCommentReactionModalVisible] = useState(false);
  const [reactionButtonPosition, setReactionButtonPosition] = useState<
    { x: number; y: number } | undefined
  >();
  // State để track comments nào đang mở replies (giống TikTok)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  // Ref để focus input khi click Trả lời
  const inputRef = useRef<TextInput>(null);
  
  // State để track users được mention trong comment hiện tại
  const [currentMentions, setCurrentMentions] = useState<MentionUser[]>([]);

  // Lấy MongoDB ObjectId của user hiện tại
  const [userMongoId, setUserMongoId] = React.useState<string | null>(null);

  // State cho Reactions List Modal
  const [reactionsListVisible, setReactionsListVisible] = useState(false);
  const [selectedReactions, setSelectedReactions] = useState<Reaction[]>([]);
  // State cho việc xóa comment
  const [deletingComment, setDeletingComment] = useState<string | null>(null);

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

  // Tìm MongoDB ObjectId của user hiện tại từ post author hoặc comments
  React.useEffect(() => {
    if (userMongoId) return; // Đã có rồi

    const myEmail = user?.email?.toLowerCase();
    const myUsername = (user as any)?.username?.toLowerCase();

    // Kiểm tra post author
    if (post.author) {
      const authorEmail = post.author.email?.toLowerCase();
      const authorUsername = (post.author as any).username?.toLowerCase();
      if ((myEmail && authorEmail === myEmail) || (myUsername && authorUsername === myUsername)) {
        if (post.author._id) {
          console.log('[CommentsModal] Found user MongoDB ID from post author:', post.author._id);
          setUserMongoId(post.author._id);
          return;
        }
      }
    }

    // Kiểm tra trong comments
    for (const comment of post.comments) {
      if (comment.user) {
        const commentEmail = comment.user.email?.toLowerCase();
        const commentUsername = (comment.user as any).username?.toLowerCase();
        if (
          (myEmail && commentEmail === myEmail) ||
          (myUsername && commentUsername === myUsername)
        ) {
          if (comment.user._id) {
            console.log('[CommentsModal] Found user MongoDB ID from comment:', comment.user._id);
            setUserMongoId(comment.user._id);
            return;
          }
        }
      }
    }
  }, [post, user, userMongoId]);

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

  // Helper function để tìm reaction của user trong một comment/reply
  const getCommentUserReaction = (reactions: Reaction[]): Reaction | null => {
    const myIds = [
      user?._id,
      (user as any)?.id,
      user?.email,
      (user as any)?.username,
      userMongoId, // Thêm MongoDB ObjectId
    ]
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

    const found = (reactions as any[]).find((r) => {
      const ownerIds = resolveOwnerIds(r);
      return ownerIds.some((oid) => myIds.includes(oid));
    });

    return (found as unknown as Reaction) || null;
  };

  // Mở modal chọn reaction cho post
  const handleLikeButtonPress = (event?: GestureResponderEvent) => {
    if (event?.nativeEvent) {
      setReactionButtonPosition({
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      });
    }
    setPostReactionPickerVisible(true);
  };

  // Xử lý khi chọn reaction cho post
  const handlePostReactionSelect = async (emojiCode: string) => {
    setPostReactionPickerVisible(false);
    try {
      const userReaction = getUserReaction();
      let updatedPost: Post;

      if (userReaction && userReaction.type === emojiCode) {
        // Remove reaction if same type
        updatedPost = await postService.removeReaction(post._id);
      } else {
        // Add/change reaction
        updatedPost = await postService.addReaction(post._id, emojiCode);
      }
      onUpdate(updatedPost);
    } catch (error) {
      console.error('Error handling post reaction:', error);
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

  // parentCommentId: nếu reply một reply, đây là main comment id
  const handleReplyComment = (
    commentId: string,
    commentAuthor: string,
    authorId?: string, // MongoDB ID của người được reply
    parentCommentId?: string
  ) => {
    setReplyingTo(commentId);
    // Nếu có parentCommentId, tức là đang reply một reply -> gửi API đến parent
    setReplyingToParent(parentCommentId || null);
    
    // Thư viện react-native-controlled-mentions không hỗ trợ set initial mention value
    // Nên chỉ set plain text @name, không có highlight màu cam cho auto-reply mention
    // Màu cam sẽ hiển thị sau khi gửi comment
    setCommentText(`@${commentAuthor} `);
    
    // Vẫn track mention để gửi notification
    if (authorId) {
      setCurrentMentions([{
        _id: authorId,
        fullname: commentAuthor,
        email: '',
      }]);
    }
    
    // Focus input ngay lập tức
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyingToParent(null);
    setCommentText('');
  };

  /**
   * Kiểm tra user có quyền xóa comment/reply không
   * Quyền xóa:
   * - Người viết comment/reply
   * - Chủ bài viết
   * - Mobile BOD
   */
  const canDeleteComment = (comment: Comment): boolean => {
    if (!user) return false;
    
    const userRoles = (user as any)?.roles || [];
    const isMobileBOD = userRoles.some((role: string) => role === 'Mobile BOD');
    
    // Comment author
    const commentUserId = comment.user?._id || comment.user;
    const isCommentAuthor = 
      commentUserId === user._id || 
      commentUserId === (user as any)?.id ||
      comment.user?.email === user.email;
    
    // Post author
    const postAuthorId = post.author?._id || post.author;
    const isPostAuthor = 
      postAuthorId === user._id || 
      postAuthorId === (user as any)?.id ||
      post.author?.email === user.email;
    
    return isCommentAuthor || isPostAuthor || isMobileBOD;
  };

  /**
   * Xóa comment hoặc reply
   */
  const handleDeleteComment = async (commentId: string, isReply: boolean = false) => {
    Alert.alert(
      isReply ? 'Xóa trả lời' : 'Xóa bình luận',
      isReply 
        ? 'Bạn có chắc chắn muốn xóa trả lời này?' 
        : 'Bạn có chắc chắn muốn xóa bình luận này? Tất cả các trả lời cũng sẽ bị xóa.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingComment(commentId);
              const updatedPost = await postService.deleteComment(post._id, commentId);
              onUpdate(updatedPost);
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Lỗi', 'Không thể xóa bình luận. Vui lòng thử lại.');
            } finally {
              setDeletingComment(null);
            }
          },
        },
      ]
    );
  };

  // Toggle hiển thị replies của một comment (giống TikTok)
  const toggleReplies = (commentId: string) => {
    setExpandedComments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;

    try {
      setLoading(true);
      
      // Convert mention format @[name](id) sang plain text @name
      const plainText = getMentionPlainText(commentText);
      
      // Lấy danh sách mention IDs từ text
      const mentionIds = extractMentionIds(commentText, currentMentions);
      
      if (replyingTo) {
        // Xử lý reply comment
        const cleanContent = plainText.trim();
        // Nếu đang reply một reply, gửi đến parent comment
        // Nếu reply main comment, gửi đến chính comment đó
        const targetCommentId = replyingToParent || replyingTo;
        const updatedPost = await postService.replyCommentWithMentions(
          post._id,
          targetCommentId,
          cleanContent,
          mentionIds
        );
        onUpdate(updatedPost);
      } else {
        // Xử lý comment thông thường với mentions
        const updatedPost = await postService.addCommentWithMentions(
          post._id,
          plainText.trim(),
          mentionIds
        );
        onUpdate(updatedPost);
      }
      setCommentText('');
      setReplyingTo(null);
      setReplyingToParent(null);
      setCurrentMentions([]); // Reset mentions sau khi gửi
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
        {/* Reactions Section - Header gọn gàng theo style mạng xã hội */}
        <View className="border-b border-gray-100 px-10 py-3">
          <View className="flex-row items-center justify-between">
            {/* Bên trái: Hiển thị các loại emoji + số lượng reactions */}
            <TouchableOpacity
              className="flex-1 flex-row items-center"
              onPress={() => {
                if (totalReactions > 0) {
                  setSelectedReactions(post.reactions);
                  setReactionsListVisible(true);
                }
              }}
              activeOpacity={totalReactions > 0 ? 0.7 : 1}>
              {totalReactions > 0 ? (
                <>
                  {/* Hiển thị tối đa 3 loại emoji phổ biến nhất */}
                  <View className="mr-2 flex-row items-center">
                    {Object.entries(reactionCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([type], index) => {
                        const emoji = getEmojiByCode(type);
                        if (!emoji) return null;
                        return (
                          <View
                            key={type}
                            style={{
                              marginLeft: index > 0 ? -6 : 0,
                              zIndex: 10 - index,
                            }}>
                            {hasLottieAnimation(emoji) ? (
                              <LottieView
                                source={emoji.lottieSource}
                                autoPlay
                                loop
                                style={{ width: 22, height: 22 }}
                              />
                            ) : (
                              <Text style={{ fontSize: 16 }}>{emoji.fallbackText}</Text>
                            )}
                          </View>
                        );
                      })}
                  </View>
                  <Text className="text-sm text-gray-600">
                    {userReaction
                      ? totalReactions === 1
                        ? 'Bạn'
                        : `Bạn và ${totalReactions - 1} người khác`
                      : `${totalReactions} lượt thích`}
                  </Text>
                </>
              ) : (
                <Text className="text-sm text-gray-400">Chưa có lượt thích nào</Text>
              )}
            </TouchableOpacity>

            {/* Bên phải: Nút Thích */}
            <TouchableOpacity
              onPress={(e) => handleLikeButtonPress(e)}
              className="flex-row items-center rounded-full bg-gray-50 px-4 py-2">
              {userReaction ? (
                (() => {
                  const emoji = getEmojiByCode(userReaction.type);
                  if (emoji && hasLottieAnimation(emoji)) {
                    return (
                      <LottieView
                        source={emoji.lottieSource}
                        autoPlay
                        loop
                        style={{ width: 22, height: 22 }}
                      />
                    );
                  } else if (emoji) {
                    return <Text style={{ fontSize: 16 }}>{emoji.fallbackText}</Text>;
                  }
                  return <LikeSkeletonSvg width={22} height={22} />;
                })()
              ) : (
                <LikeSkeletonSvg width={22} height={22} />
              )}
              <Text
                className="ml-1.5 text-sm font-semibold"
                style={{
                  color: userReaction
                    ? getEmojiByCode(userReaction.type)?.color || '#F05023'
                    : '#6B7280',
                }}>
                {userReaction ? getEmojiByCode(userReaction.type)?.name || 'Đã thích' : 'Thích'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 60}>
          {/* Comments List */}
          <ScrollView className="flex-1 px-4 pt-4">
            {post.comments.length === 0 ? (
              <View className="flex-1 items-center justify-center py-10">
                <Ionicons name="chatbubble-outline" size={64} color="#D1D5DB" />
                <Text className="mt-4 text-lg font-medium text-gray-500">
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
                            <Text className="mb-1 text-base font-semibold text-gray-900">
                              {comment.user
                                ? normalizeVietnameseName(comment.user.fullname)
                                : 'Ẩn danh'}
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
                              {(() => {
                                const myReaction = getCommentUserReaction(comment.reactions);
                                const emoji = myReaction ? getEmojiByCode(myReaction.type) : null;
                                const label =
                                  likingComment === comment._id
                                    ? 'Đang xử lý...'
                                    : myReaction
                                      ? emoji?.name || 'Đã thích'
                                      : 'Thích';
                                const color = myReaction ? emoji?.color || '#F05023' : '#6B7280';
                                return (
                                  <Text className="text-sm font-bold" style={{ color }}>
                                    {label}
                                  </Text>
                                );
                              })()}
                            </TouchableOpacity>

                            <TouchableOpacity
                              className="ml-4"
                              onPress={() =>
                                handleReplyComment(
                                  comment._id,
                                  comment.user
                                    ? normalizeVietnameseName(comment.user.fullname)
                                    : 'Ẩn danh',
                                  comment.user?._id // Truyền userId để hiển thị mention màu cam
                                )
                              }>
                              <Text className="text-sm font-bold text-gray-600">Trả lời</Text>
                            </TouchableOpacity>

                            {/* Nút xóa comment - chỉ hiển thị nếu có quyền */}
                            {canDeleteComment(comment) && (
                              <TouchableOpacity
                                className="ml-4"
                                onPress={() => handleDeleteComment(comment._id, false)}
                                disabled={deletingComment === comment._id}>
                                <Text className="text-sm font-bold text-red-500">
                                  {deletingComment === comment._id ? 'Đang xóa...' : 'Xóa'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          {comment.reactions.length > 0 && (
                            <TouchableOpacity
                              className="flex-row items-center"
                              onPress={() => {
                                setSelectedReactions(comment.reactions);
                                setReactionsListVisible(true);
                              }}
                              activeOpacity={0.7}>
                              <View className="flex-row items-center px-2 py-1">
                                <Text className="mr-1 text-sm text-gray-600">
                                  {comment.reactions.length}
                                </Text>
                                {getUniqueReactionTypes(comment.reactions).map((reactionType) => {
                                  const emoji = getEmojiByCode(reactionType);
                                  if (!emoji) return null;
                                  return (
                                    <View key={reactionType} style={{ marginRight: 2 }}>
                                      {hasLottieAnimation(emoji) ? (
                                        <LottieView
                                          source={emoji.lottieSource}
                                          autoPlay
                                          loop
                                          style={{ width: 20, height: 20 }}
                                        />
                                      ) : (
                                        <Text style={{ fontSize: 16 }}>{emoji.fallbackText}</Text>
                                      )}
                                    </View>
                                  );
                                })}
                              </View>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Hiển thị replies - Mặc định ẩn, giống TikTok */}
                        {comment.replies && comment.replies.length > 0 && (
                          <View className="ml-6 mt-3">
                            {/* Nút mở/đóng replies */}
                            <TouchableOpacity
                              onPress={() => toggleReplies(comment._id)}
                              className="mb-2 flex-row items-center py-2">
                              <View className="mr-2 h-px w-8 bg-gray-300" />
                              <Text className="text-sm font-medium text-gray-500">
                                {expandedComments.has(comment._id)
                                  ? 'Ẩn bình luận'
                                  : `Xem ${comment.replies.length} bình luận`}
                              </Text>
                            </TouchableOpacity>

                            {/* Chỉ hiển thị replies khi được mở */}
                            {expandedComments.has(comment._id) &&
                              comment.replies.map((reply) => (
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
                                          <Text className="mb-1 text-sm font-semibold text-gray-900">
                                            {reply.user
                                              ? normalizeVietnameseName(reply.user.fullname)
                                              : 'Ẩn danh'}
                                          </Text>
                                          <Text className="mb-1 text-xs font-medium text-gray-500">
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
                                            {(() => {
                                              const myReaction = getCommentUserReaction(
                                                reply.reactions
                                              );
                                              const emoji = myReaction
                                                ? getEmojiByCode(myReaction.type)
                                                : null;
                                              const label = myReaction
                                                ? emoji?.name || 'Đã thích'
                                                : 'Thích';
                                              const color = myReaction
                                                ? emoji?.color || '#F05023'
                                                : '#6B7280';
                                              return (
                                                <Text
                                                  className="text-xs font-medium"
                                                  style={{ color }}>
                                                  {label}
                                                </Text>
                                              );
                                            })()}
                                          </TouchableOpacity>

                                          <TouchableOpacity
                                            className="ml-3"
                                            onPress={() =>
                                              handleReplyComment(
                                                reply._id,
                                                reply.user
                                                  ? normalizeVietnameseName(reply.user.fullname)
                                                  : 'Ẩn danh',
                                                reply.user?._id, // Truyền userId để hiển thị mention màu cam
                                                comment._id // Parent comment ID để reply về đúng thread
                                              )
                                            }>
                                            <Text className="text-xs font-medium text-gray-600">
                                              Trả lời
                                            </Text>
                                          </TouchableOpacity>

                                          {/* Nút xóa reply */}
                                          {canDeleteComment(reply) && (
                                            <TouchableOpacity
                                              className="ml-3"
                                              onPress={() => handleDeleteComment(reply._id, true)}
                                              disabled={deletingComment === reply._id}>
                                              <Text className="text-xs font-medium text-red-500">
                                                {deletingComment === reply._id ? 'Đang xóa...' : 'Xóa'}
                                              </Text>
                                            </TouchableOpacity>
                                          )}
                                        </View>

                                        {/* Bên phải: Reply Reactions */}
                                        {reply.reactions.length > 0 && (
                                          <TouchableOpacity
                                            className="flex-row items-center"
                                            onPress={() => {
                                              setSelectedReactions(reply.reactions);
                                              setReactionsListVisible(true);
                                            }}
                                            activeOpacity={0.7}>
                                            <View className="flex-row items-center ">
                                              <Text className="mr-1 text-sm text-gray-600">
                                                {reply.reactions.length}
                                              </Text>
                                              {getUniqueReactionTypes(reply.reactions).map(
                                                (reactionType) => {
                                                  const emoji = getEmojiByCode(reactionType);
                                                  if (!emoji) return null;
                                                  return (
                                                    <View
                                                      key={reactionType}
                                                      style={{ marginRight: 2 }}>
                                                      {hasLottieAnimation(emoji) ? (
                                                        <LottieView
                                                          source={emoji.lottieSource}
                                                          autoPlay
                                                          loop
                                                          style={{ width: 18, height: 18 }}
                                                        />
                                                      ) : (
                                                        <Text style={{ fontSize: 14 }}>
                                                          {emoji.fallbackText}
                                                        </Text>
                                                      )}
                                                    </View>
                                                  );
                                                }
                                              )}
                                            </View>
                                          </TouchableOpacity>
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
                          return replyTarget.user
                            ? normalizeVietnameseName(replyTarget.user.fullname)
                            : 'Ẩn danh';

                        // Tìm trong replies nếu không tìm thấy trong main comments
                        for (const comment of organizedComments) {
                          const reply = comment.replies?.find((r) => r._id === replyingTo);
                          if (reply)
                            return reply.user
                              ? normalizeVietnameseName(reply.user.fullname)
                              : 'Ẩn danh';
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
                <MentionInput
                  inputRef={inputRef}
                  className="flex-1 text-base"
                  placeholder="Nhập tin nhắn... (gõ @ để mention)"
                  placeholderTextColor="#9CA3AF"
                  value={commentText}
                  onChangeText={setCommentText}
                  onMentionsChange={setCurrentMentions}
                  multiline
                  textAlignVertical="center"
                  suggestionsAbove={true}
                  containerStyle={{ flex: 1 }}
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

      {/* Post Reaction Picker Modal */}
      <ReactionPicker
        visible={postReactionPickerVisible}
        onClose={() => setPostReactionPickerVisible(false)}
        onSelect={handlePostReactionSelect}
        currentReaction={userReaction?.type}
        anchorPosition={reactionButtonPosition}
      />

      {/* Comment Reaction Picker Modal */}
      <ReactionPicker
        visible={commentReactionModalVisible}
        onClose={() => {
          setCommentReactionModalVisible(false);
          setSelectedCommentId(null);
        }}
        onSelect={(emojiCode) => {
          if (selectedCommentId) {
            handleCommentReactionSelect(selectedCommentId, emojiCode);
          }
        }}
        currentReaction={(() => {
          if (!selectedCommentId) return null;
          const comment = post.comments.find((c) => c._id === selectedCommentId);
          if (!comment) return null;
          const myReaction = comment.reactions.find((r) => r.user?._id === user?._id);
          return myReaction?.type || null;
        })()}
        anchorPosition={reactionButtonPosition}
      />

      {/* Reactions List Modal */}
      <ReactionsListModal
        visible={reactionsListVisible}
        onClose={() => {
          setReactionsListVisible(false);
          setSelectedReactions([]);
        }}
        reactions={selectedReactions}
      />
    </Modal>
  );
};

export default CommentsModal;
