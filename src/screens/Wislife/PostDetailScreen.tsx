// @ts-nocheck
import React, { useState, useRef, useCallback } from 'react';
// @ts-ignore
import {
  View,
  Text,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import LottieView from 'lottie-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Post, Comment, Reaction } from '../../types/post';
import { postService } from '../../services/postService';
import { useAuth } from '../../context/AuthContext';
import { getAvatar } from '../../utils/avatar';
import { formatRelativeTime } from '../../utils/dateUtils';
import { API_BASE_URL } from '../../config/constants';
import LikeSkeletonSvg from '../../assets/like-skeleton.svg';
import { getEmojiByCode, hasLottieAnimation } from '../../utils/emojiUtils';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import ReactionPicker from '../../components/Wislife/ReactionPicker';

const { width } = Dimensions.get('window');

type PostDetailRouteParams = {
  PostDetail: {
    post: Post;
    onUpdate?: (post: Post) => void;
  };
};

const PostDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<PostDetailRouteParams, 'PostDetail'>>();
  const { post: initialPost, onUpdate } = route.params;
  const insets = useSafeAreaInsets();
  
  const { user } = useAuth();
  const [post, setPost] = useState<Post>(initialPost);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyingToParent, setReplyingToParent] = useState<string | null>(null);
  const [likingComment, setLikingComment] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  
  // State cho Reaction Picker
  const [postReactionPickerVisible, setPostReactionPickerVisible] = useState(false);
  const [commentReactionModalVisible, setCommentReactionModalVisible] = useState(false);
  const [reactionButtonPosition, setReactionButtonPosition] = useState<{ x: number; y: number } | undefined>();
  
  // State cho expanded comments
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  
  // State cho image modal
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  const inputRef = useRef<TextInput>(null);

  // Cập nhật post và callback
  const updatePost = useCallback((updatedPost: Post) => {
    setPost(updatedPost);
    onUpdate?.(updatedPost);
  }, [onUpdate]);

  // Sắp xếp comments
  const organizeComments = () => {
    const mainComments = post.comments.filter((comment) => !comment.parentComment);
    const replies = post.comments.filter((comment) => comment.parentComment);

    const sortedMainComments = [...mainComments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return sortedMainComments.map((mainComment) => ({
      ...mainComment,
      replies: replies
        .filter((reply) => reply.parentComment === mainComment._id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    }));
  };

  const organizedComments = organizeComments();

  // Lấy reaction của user
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

  const getCommentUserReaction = (reactions: Reaction[]): Reaction | null => {
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

    const found = (reactions as any[]).find((r) => {
      const ownerIds = resolveOwnerIds(r);
      return ownerIds.some((oid) => myIds.includes(oid));
    });
    return (found as unknown as Reaction) || null;
  };

  // Xử lý reaction cho post
  const handleLikeButtonPress = (event?: any) => {
    if (event?.nativeEvent) {
      setReactionButtonPosition({
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      });
    }
    setPostReactionPickerVisible(true);
  };

  const handlePostReactionSelect = async (emojiCode: string) => {
    setPostReactionPickerVisible(false);
    try {
      const userReaction = getUserReaction();
      let updatedPost: Post;
      
      if (userReaction && userReaction.type === emojiCode) {
        updatedPost = await postService.removeReaction(post._id);
      } else {
        updatedPost = await postService.addReaction(post._id, emojiCode);
      }
      updatePost(updatedPost);
    } catch (error) {
      console.error('Error handling post reaction:', error);
      Alert.alert('Lỗi', 'Không thể thực hiện thao tác. Vui lòng thử lại.');
    }
  };

  // Xử lý reaction cho comment
  const handleCommentReaction = (commentId: string, event?: any) => {
    setSelectedCommentId(commentId);
    if (event?.nativeEvent?.pageX !== undefined && event?.nativeEvent?.pageY !== undefined) {
      setReactionButtonPosition({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY + 10 });
    }
    setCommentReactionModalVisible(true);
  };

  const handleCommentReactionSelect = async (commentId: string, emojiCode: string) => {
    try {
      setCommentReactionModalVisible(false);
      const comment = post.comments.find((c) => c._id === commentId);
      if (!comment) return;

      const userReaction = comment.reactions.find((r) => r.user?._id === user?._id);
      let updatedPost: Post;
      
      if (userReaction && userReaction.type === emojiCode) {
        updatedPost = await postService.removeCommentReaction(post._id, commentId);
      } else {
        updatedPost = await postService.addCommentReaction(post._id, commentId, emojiCode);
      }
      updatePost(updatedPost);
    } catch (error) {
      console.error('Error adding comment reaction:', error);
      Alert.alert('Lỗi', 'Không thể thêm reaction. Vui lòng thử lại.');
    }
  };

  // Xử lý reply
  const handleReplyComment = (commentId: string, commentAuthor: string, parentCommentId?: string) => {
    setReplyingTo(commentId);
    setReplyingToParent(parentCommentId || null);
    setCommentText(`@${commentAuthor} `);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyingToParent(null);
    setCommentText('');
  };

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

  // Gửi comment
  const handleComment = async () => {
    if (!commentText.trim()) return;

    try {
      setLoading(true);
      if (replyingTo) {
        const cleanContent = commentText.trim();
        const targetCommentId = replyingToParent || replyingTo;
        const updatedPost = await postService.replyComment(post._id, targetCommentId, cleanContent);
        updatePost(updatedPost);
      } else {
        const updatedPost = await postService.addComment(post._id, commentText.trim());
        updatePost(updatedPost);
      }
      setCommentText('');
      setReplyingTo(null);
      setReplyingToParent(null);
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

  // Render comment content với @mention
  const renderCommentContent = (content: string) => {
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
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-100 px-4 py-3">
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-semibold text-gray-900">Bài viết</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Post Content */}
          <View className="border-b border-gray-100 pb-4">
            {/* Pinned badge */}
            {post.isPinned && (
              <View className="h-1 w-full" style={{ backgroundColor: '#FF7A00' }} />
            )}
            
            {/* Author Header */}
            <View className="flex-row items-center p-4">
              <View 
                className="h-12 w-12 overflow-hidden rounded-full"
                style={post.isPinned ? { borderWidth: 2, borderColor: '#FF7A00' } : { backgroundColor: '#E5E7EB' }}>
                <Image source={{ uri: getAvatar(post.author) }} className="h-full w-full" />
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center">
                  <Text className="text-base font-semibold text-gray-900">
                    {post.author ? normalizeVietnameseName(post.author.fullname) : 'Ẩn danh'}
                  </Text>
                  {post.isPinned && (
                    <View className="ml-2 flex-row items-center rounded-full bg-orange-50 px-2 py-0.5">
                      <Ionicons name="pin" size={10} color="#FF7A00" style={{ transform: [{ rotate: '45deg' }] }} />
                      <Text className="ml-1 text-xs font-medium" style={{ color: '#FF7A00' }}>Ghim</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center">
                  <Text className="text-sm text-gray-500">{formatRelativeTime(post.createdAt)}</Text>
                  <Text className="mx-1 text-sm text-gray-400">•</Text>
                  <Ionicons name="globe-outline" size={12} color="#6B7280" />
                  <Text className="ml-1 text-sm text-gray-500">Công khai</Text>
                </View>
              </View>
            </View>

            {/* Post Content Text */}
            <View className="px-4 pb-4">
              <Text className="text-base leading-6 text-gray-900">{post.content}</Text>
            </View>

            {/* Media */}
            {(post.images.length > 0 || post.videos.length > 0) && (
              <View className="pb-4">
                {/* Images */}
                {post.images.length > 0 && (
                  <View className="flex-row flex-wrap">
                    {post.images.map((image, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => {
                          setSelectedImageIndex(index);
                          setImageModalVisible(true);
                        }}
                        className={`relative ${
                          post.images.length === 1 ? 'w-full' : 'w-1/2'
                        } ${index > 0 ? 'pl-1' : ''} ${index > 1 ? 'pt-1' : ''}`}
                        style={{ aspectRatio: post.images.length === 1 ? 16 / 9 : 1 }}>
                        <Image
                          source={{ uri: `${API_BASE_URL}${image}` }}
                          className="h-full w-full"
                          resizeMode="cover"
                        />
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
            <View className="flex-row items-center justify-between border-t border-gray-100 px-4 py-3">
              <View className="flex-row items-center">
                {totalReactions > 0 && (
                  <>
                    <View className="mr-2 flex-row items-center">
                      {Object.entries(reactionCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([type], index) => {
                          const emoji = getEmojiByCode(type);
                          if (!emoji) return null;
                          return (
                            <View key={type} style={{ marginLeft: index > 0 ? -6 : 0, zIndex: 10 - index }}>
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
                    <Text className="text-sm text-gray-600">{totalReactions} lượt thích</Text>
                  </>
                )}
              </View>
              <Text className="text-sm text-gray-600">{post.comments.length} bình luận</Text>
            </View>

            {/* Action Buttons */}
            <View className="flex-row border-t border-gray-100 px-2 py-1">
              <TouchableOpacity
                onPress={(e) => handleLikeButtonPress(e)}
                className="flex-1 flex-row items-center justify-center py-1.5">
                {userReaction ? (
                  (() => {
                    const emoji = getEmojiByCode(userReaction.type);
                    if (emoji && hasLottieAnimation(emoji)) {
                      return (
                        <LottieView
                          source={emoji.lottieSource}
                          autoPlay
                          loop
                          style={{ width: 24, height: 24 }}
                        />
                      );
                    } else if (emoji) {
                      return <Text style={{ fontSize: 20 }}>{emoji.fallbackText}</Text>;
                    }
                    return <LikeSkeletonSvg width={24} height={24} />;
                  })()
                ) : (
                  <LikeSkeletonSvg width={24} height={24} />
                )}
                <Text
                  className="ml-2 font-medium"
                  style={{ color: userReaction ? (getEmojiByCode(userReaction.type)?.color || '#F05023') : '#6B7280' }}>
                  {userReaction ? (getEmojiByCode(userReaction.type)?.name || 'Đã thích') : 'Thích'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => inputRef.current?.focus()}
                className="flex-1 flex-row items-center justify-center py-1.5">
                <Ionicons name="chatbubble-outline" size={20} color="#6B7280" />
                <Text className="ml-2 font-medium text-gray-600">Bình luận</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments Section */}
          <View className="px-4 py-4">
            <Text className="mb-4 text-base font-semibold text-gray-900">
              Bình luận ({post.comments.length})
            </Text>

            {post.comments.length === 0 ? (
              <View className="items-center py-8">
                <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
                <Text className="mt-3 text-gray-500">Chưa có bình luận nào</Text>
                <Text className="mt-1 text-sm text-gray-400">Hãy là người đầu tiên bình luận</Text>
              </View>
            ) : (
              <View>
                {organizedComments.map((comment) => (
                  <View key={comment._id} className="mb-5">
                    <View className="flex-row">
                      <View className="mr-3 h-10 w-10 overflow-hidden rounded-full">
                        <Image source={{ uri: getAvatar(comment.user) }} className="h-full w-full" />
                      </View>
                      <View className="flex-1">
                        <View className="rounded-2xl bg-gray-50 px-4 py-3">
                          <Text className="font-semibold text-gray-900">
                            {comment.user ? normalizeVietnameseName(comment.user.fullname) : 'Ẩn danh'}
                          </Text>
                          {renderCommentContent(comment.content)}
                        </View>
                        
                        {/* Comment Actions */}
                        <View className="mt-2 flex-row items-center justify-between">
                          <View className="flex-row items-center">
                            <Text className="text-xs text-gray-500">{formatRelativeTime(comment.createdAt)}</Text>
                            <TouchableOpacity
                              className="ml-4"
                              onPress={(e) => handleCommentReaction(comment._id, e)}>
                              {(() => {
                                const myReaction = getCommentUserReaction(comment.reactions);
                                const emoji = myReaction ? getEmojiByCode(myReaction.type) : null;
                                return (
                                  <Text
                                    className="text-xs font-semibold"
                                    style={{ color: myReaction ? (emoji?.color || '#F05023') : '#6B7280' }}>
                                    {myReaction ? (emoji?.name || 'Đã thích') : 'Thích'}
                                  </Text>
                                );
                              })()}
                            </TouchableOpacity>
                            <TouchableOpacity
                              className="ml-4"
                              onPress={() => handleReplyComment(
                                comment._id,
                                comment.user ? normalizeVietnameseName(comment.user.fullname) : 'Ẩn danh'
                              )}>
                              <Text className="text-xs font-semibold text-gray-600">Trả lời</Text>
                            </TouchableOpacity>
                          </View>
                          
                          {comment.reactions.length > 0 && (
                            <View className="flex-row items-center">
                              <Text className="mr-1 text-xs text-gray-500">{comment.reactions.length}</Text>
                              {getUniqueReactionTypes(comment.reactions).slice(0, 3).map((type) => {
                                const emoji = getEmojiByCode(type);
                                if (!emoji) return null;
                                return hasLottieAnimation(emoji) ? (
                                  <LottieView key={type} source={emoji.lottieSource} autoPlay loop style={{ width: 16, height: 16 }} />
                                ) : (
                                  <Text key={type} style={{ fontSize: 12 }}>{emoji.fallbackText}</Text>
                                );
                              })}
                            </View>
                          )}
                        </View>

                        {/* Replies */}
                        {comment.replies && comment.replies.length > 0 && (
                          <View className="ml-2 mt-3">
                            <TouchableOpacity
                              onPress={() => toggleReplies(comment._id)}
                              className="mb-2 flex-row items-center py-1">
                              <View className="mr-2 h-px w-6 bg-gray-300" />
                              <Text className="text-xs font-medium text-gray-500">
                                {expandedComments.has(comment._id)
                                  ? 'Ẩn bình luận'
                                  : `Xem ${comment.replies.length} bình luận`}
                              </Text>
                            </TouchableOpacity>

                            {expandedComments.has(comment._id) && comment.replies.map((reply) => (
                              <View key={reply._id} className="mb-3">
                                <View className="flex-row">
                                  <View className="mr-2 h-8 w-8 overflow-hidden rounded-full">
                                    <Image source={{ uri: getAvatar(reply.user) }} className="h-full w-full" />
                                  </View>
                                  <View className="flex-1">
                                    <View className="rounded-2xl bg-gray-50 px-3 py-2">
                                      <Text className="text-sm font-semibold text-gray-900">
                                        {reply.user ? normalizeVietnameseName(reply.user.fullname) : 'Ẩn danh'}
                                      </Text>
                                      <Text className="text-sm text-gray-800">{reply.content}</Text>
                                    </View>
                                    <View className="mt-1 flex-row items-center">
                                      <Text className="text-xs text-gray-500">{formatRelativeTime(reply.createdAt)}</Text>
                                      <TouchableOpacity
                                        className="ml-3"
                                        onPress={(e) => handleCommentReaction(reply._id, e)}>
                                        {(() => {
                                          const myReaction = getCommentUserReaction(reply.reactions);
                                          const emoji = myReaction ? getEmojiByCode(myReaction.type) : null;
                                          return (
                                            <Text
                                              className="text-xs font-medium"
                                              style={{ color: myReaction ? (emoji?.color || '#F05023') : '#6B7280' }}>
                                              {myReaction ? (emoji?.name || 'Đã thích') : 'Thích'}
                                            </Text>
                                          );
                                        })()}
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        className="ml-3"
                                        onPress={() => handleReplyComment(
                                          reply._id,
                                          reply.user ? normalizeVietnameseName(reply.user.fullname) : 'Ẩn danh',
                                          comment._id
                                        )}>
                                        <Text className="text-xs font-medium text-gray-600">Trả lời</Text>
                                      </TouchableOpacity>
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
          </View>
          
          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Comment Input */}
        <View 
          className="border-t border-gray-200 bg-white px-4 py-3"
          style={{ paddingBottom: insets.bottom + 12 }}>
          {replyingTo && (
            <View className="mb-2 flex-row items-center justify-between rounded-lg bg-gray-50 p-2">
              <Text className="text-sm text-gray-600">
                Đang trả lời{' '}
                <Text className="font-semibold text-gray-800">
                  {(() => {
                    const replyTarget = organizedComments.find((c) => c._id === replyingTo);
                    if (replyTarget) return replyTarget.user ? normalizeVietnameseName(replyTarget.user.fullname) : 'Ẩn danh';
                    for (const comment of organizedComments) {
                      const reply = comment.replies?.find((r) => r._id === replyingTo);
                      if (reply) return reply.user ? normalizeVietnameseName(reply.user.fullname) : 'Ẩn danh';
                    }
                    return 'comment';
                  })()}
                </Text>
              </Text>
              <TouchableOpacity onPress={handleCancelReply}>
                <Ionicons name="close" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          )}

          <View className="flex-row items-center">
            <View className="mr-3 h-10 w-10 overflow-hidden rounded-full bg-gray-300">
              <Image source={{ uri: getAvatar(user) }} className="h-full w-full" />
            </View>
            <View className="flex-1 flex-row items-center rounded-full bg-gray-100 px-4 py-2.5">
              <TextInput
                ref={inputRef}
                className="flex-1 text-base"
                placeholder="Viết bình luận..."
                placeholderTextColor="#9CA3AF"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                textAlignVertical="center"
                style={{ 
                  minHeight: 22, 
                  maxHeight: 80,
                  paddingTop: 0,
                  paddingBottom: 0,
                  includeFontPadding: false,
                }}
              />
              <TouchableOpacity
                onPress={handleComment}
                disabled={!commentText.trim() || loading}
                className={`ml-2 ${commentText.trim() && !loading ? 'opacity-100' : 'opacity-50'}`}>
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

      {/* Post Reaction Picker */}
      <ReactionPicker
        visible={postReactionPickerVisible}
        onClose={() => setPostReactionPickerVisible(false)}
        onSelect={handlePostReactionSelect}
        currentReaction={userReaction?.type}
        anchorPosition={reactionButtonPosition}
      />

      {/* Comment Reaction Picker */}
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
    </SafeAreaView>
  );
};

export default PostDetailScreen;
