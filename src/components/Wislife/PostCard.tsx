// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
// @ts-ignore
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  GestureResponderEvent,
  StatusBar,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
  PanResponder,
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
import { resolveSocialMediaUrl } from '../../utils/resolveSocialMediaUrl';
import { saveMediaToDevice } from '../../utils/mediaDownload';
import { ActionSheet, InlineToast, useInlineToast, type ActionSheetOption } from '../Common';
import CreatePostModal from './CreatePostModal';
import LikeSkeletonSvg from '../../assets/like-skeleton.svg';
import { MentionRichText } from './MentionInput';
import { getAvatar } from '../../utils/avatar';
import {
  FEED_REACTION_CODE,
  getEmojiByCode,
  hasLottieAnimation,
  isFallbackEmoji,
  JOURNAL_COMMENTS_ENABLED,
  JOURNAL_MULTI_REACTION_ENABLED,
} from '../../utils/emojiUtils';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import ReactionPicker from './ReactionPicker';
import ReactionsListModal from './ReactionsListModal';
import ImageGallery from './ImageGallery';
import { useNavigation } from '@react-navigation/native';

interface PostCardProps {
  post: Post;
  onUpdate: (post: Post) => void;
  onDelete: (postId: string) => void;
  onCommentPress?: (post: Post) => void;
  /**
   * Cho phép CHÍNH CHỦ bài viết sửa/xoá bài của mình (giống bảng tin trên web).
   * Mặc định tắt ⇒ bảng tin Wislife toàn trường giữ nguyên: chỉ Mobile BOD có menu.
   */
  enableAuthorActions?: boolean;
}

const { width } = Dimensions.get('window');

// Gradient Text Component đơn giản
const GradientText: React.FC<{ children: string; style?: any }> = ({ children, style }) => {
  return (
    <Text style={[{ fontSize: 16, fontWeight: '500', color: '#F05023' }, style]}>{children}</Text>
  );
};

const PostCard: React.FC<PostCardProps> = ({
  post,
  onUpdate,
  onDelete,
  onCommentPress,
  enableAuthorActions = false,
}) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Mở trang chi tiết bài viết
  const openPostDetail = () => {
    navigation.navigate('PostDetail', { post, onUpdate });
  };
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Animation cho swipe to close image modal
  const imageModalTranslateY = useRef(new Animated.Value(0)).current;
  const imageModalOpacity = useRef(new Animated.Value(1)).current;
  
  // Đóng modal với animation
  const closeImageModalWithAnimation = () => {
    Animated.parallel([
      Animated.timing(imageModalTranslateY, {
        toValue: 500,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(imageModalOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setImageModalVisible(false);
      imageModalTranslateY.setValue(0);
      imageModalOpacity.setValue(1);
    });
  };
  
  // Pan responder cho thanh kéo ở trên - dễ dùng hơn
  const dragHandlePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      // Cho phép kéo cả lên và xuống nhưng chỉ có effect khi kéo xuống
      if (gestureState.dy > 0) {
        imageModalTranslateY.setValue(gestureState.dy);
        const opacity = Math.max(0.3, 1 - gestureState.dy / 300);
        imageModalOpacity.setValue(opacity);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      // Giảm threshold xuống 60px để dễ đóng hơn
      if (gestureState.dy > 60 || gestureState.vy > 0.3) {
        closeImageModalWithAnimation();
      } else {
        // Bounce back
        Animated.parallel([
          Animated.spring(imageModalTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }),
          Animated.timing(imageModalOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
  }), []);
  // State cho Reaction Picker modal
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<
    { x: number; y: number } | undefined
  >();
  // State cho danh sách người thích
  const [reactionsListVisible, setReactionsListVisible] = useState(false);
  // Menu tuỳ chọn bài viết + modal sửa bài
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const pendingOptionRef = useRef<string | null>(null);

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

  // Tải ảnh/video của bài viết về máy (không lưu được album → bảng chia sẻ).
  const [savingMedia, setSavingMedia] = useState(false);
  const { toast, showToast, hideToast } = useInlineToast();
  const saveMedia = async (rawUrl: string, kind: 'image' | 'video') => {
    const url = resolveSocialMediaUrl(rawUrl, API_BASE_URL);
    if (!url || savingMedia) return;
    try {
      setSavingMedia(true);
      const result = await saveMediaToDevice({ url, kind });
      if (result === 'saved-to-library') {
        showToast(kind === 'video' ? 'Đã lưu video vào album' : 'Đã lưu ảnh vào album');
      }
    } catch (error) {
      console.error('[PostCard] save media', error);
      showToast('Không thể tải hoặc lưu tệp này', 'error');
    } finally {
      setSavingMedia(false);
    }
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

  /**
   * Menu tuỳ chọn dùng ActionSheet chứ không dùng `Alert.alert`: menu có thể lên tới
   * 4 mục (Ghim/Sửa/Xoá/Huỷ) mà Alert trên Android chỉ nhận tối đa 3 nút — mục thứ 4
   * sẽ bị nuốt mất im lặng.
   */
  const openPostOptions = () => {
    pendingOptionRef.current = null;
    setOptionsVisible(true);
  };

  /**
   * Chạy hành động SAU khi sheet đã đóng hẳn: mở Alert xác nhận hoặc modal sửa
   * ngay lúc modal sheet đang dismiss thì trên iOS hộp thoại có thể không hiện.
   */
  const handleOptionsDismissed = () => {
    const action = pendingOptionRef.current;
    pendingOptionRef.current = null;
    if (action === 'pin') void handlePinPost();
    if (action === 'edit') setEditModalVisible(true);
    if (action === 'delete') handleDeletePost();
  };

  const reactionCounts = getReactionCounts();
  const userReaction = getUserReaction();
  const totalReactions = post.reactions?.length ?? 0;
  /** Feed API chỉ trả `commentCount`; mảng `comments` có thể thiếu */
  const commentCount =
    typeof post.commentCount === 'number' ? post.commentCount : post.comments?.length ?? 0;


  // Mobile BOD có thể ghim/xóa mọi bài viết, kể cả bài của người khác
  const userRoles = (user as any)?.roles || [];
  const isMobileBod = userRoles.some((role: string) => role === 'Mobile BOD');

  /**
   * Chính chủ bài viết. So khớp nhiều khoá (email/_id/username) như `getUserReaction`
   * vì payload feed không đảm bảo khoá nào cũng có mặt.
   */
  const isPostAuthor = useMemo(() => {
    const myIds = [user?._id, (user as any)?.id, user?.email, (user as any)?.username]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());
    if (myIds.length === 0) return false;

    const author = post.author as any;
    const authorIds = [author?._id, author?.id, author?.email, author?.username]
      .filter(Boolean)
      .map((v: any) => String(v).toLowerCase());

    return authorIds.some((id: string) => myIds.includes(id));
  }, [user, post.author]);

  const canEditPost = enableAuthorActions && isPostAuthor;
  const canDeletePost = isMobileBod || (enableAuthorActions && isPostAuthor);
  const hasPostOptions = isMobileBod || canEditPost || canDeletePost;

  const postOptions: ActionSheetOption[] = [
    ...(isMobileBod
      ? [{ label: post.isPinned ? 'Bỏ ghim' : 'Ghim bài viết', value: 'pin' }]
      : []),
    ...(canEditPost ? [{ label: 'Sửa bài viết', value: 'edit' }] : []),
    ...(canDeletePost
      ? [{ label: 'Xóa bài viết', value: 'delete', color: '#FF3B30' }]
      : []),
  ];

  // Bật đa cảm xúc thì mở modal chọn; tắt thì bấm là thả tim luôn.
  const handleLikeButtonPress = (event?: GestureResponderEvent) => {
    if (!JOURNAL_MULTI_REACTION_ENABLED) {
      void handleReaction(FEED_REACTION_CODE);
      return;
    }
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
    <View
      className="mb-2 border-b border-gray-100 bg-white"
      style={
        post.isPinned
          ? {
              backgroundColor: '#',
              borderLeftWidth: 0,
            }
          : {}
      }>
      {/* Pinned indicator - Gradient top bar + Corner badge */}
      {post.isPinned && (
        <>
          {/* Top bar màu navy */}
          {/* <View 
            className="h-1 w-full"
            style={{ 
              backgroundColor: '#FF7A00',
            }}
          /> */}
          {/* Corner ribbon badge - pointerEvents="none" để không chặn nút ... */}
          <View
            className="absolute right-0 top-0 z-10"
            pointerEvents="none"
            style={{
              width: 70,
              height: 70,
              overflow: 'hidden',
            }}>
            <View
              style={{
                position: 'absolute',
                right: -35,
                top: 8,
                width: 100,
                backgroundColor: '#FF7A00',
                paddingVertical: 4,
                transform: [{ rotate: '45deg' }],
                alignItems: 'center',
                shadowColor: '#FF7A00',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 3,
              }}>
              <View className="flex-row items-center">
                <Ionicons name="pin" size={10} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '700', marginLeft: 2 }}>
                  GHIM
                </Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Header */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-1 flex-row items-center">
          <View
            className="h-10 w-10 overflow-hidden rounded-full"
            style={
              post.isPinned
                ? {
                    borderWidth: 2,
                    borderColor: '#FF7A00',
                  }
                : {
                    backgroundColor: '#F0F7FF',
                  }
            }>
            <Image source={{ uri: getAvatar(post.author) }} className="h-full w-full" />
          </View>
          <View className="ml-3 flex-1">
            {/* Tên */}
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

        {/* Nút tùy chọn (GHIM/SỬA/XÓA) — Mobile BOD, hoặc chính chủ ở feed có bật enableAuthorActions */}
        {hasPostOptions && (
          <TouchableOpacity
            onPress={openPostOptions}
            className="p-2"
            style={{ zIndex: 20 }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content - Ấn để xem chi tiết */}
      <TouchableOpacity onPress={openPostDetail} activeOpacity={0.8}>
        <View className="px-4 pb-3">
          <MentionRichText
            content={post.content}
            className="text-base leading-5 text-gray-900"
          />
        </View>
      </TouchableOpacity>

      {/* Media - Facebook/Instagram Style */}
      {(post.images.length > 0 || post.videos.length > 0) && (
        <View className="pb-3">
          {/* Images - Sử dụng ImageGallery component */}
          {post.images.length > 0 && (
            <ImageGallery
              images={post.images}
              baseUrl={API_BASE_URL}
              onImagePress={openImageModal}
            />
          )}

          {/* Videos */}
          {post.videos.length > 0 && (
            <View className={post.images.length > 0 ? 'mt-2' : ''}>
              {post.videos.slice(0, 1).map((video, index) => (
                <View
                  key={index}
                  className="w-full overflow-hidden bg-black"
                  style={{ aspectRatio: 16 / 9 }}>
                  <Video
                    source={{ uri: resolveSocialMediaUrl(video, API_BASE_URL) }}
                    style={{ width: '100%', height: '100%' }}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false}
                    isLooping={false}
                  />
                  {/* Tải video về máy */}
                  <TouchableOpacity
                    disabled={savingMedia}
                    onPress={() => void saveMedia(video, 'video')}
                    className="absolute right-2 top-2 h-9 w-9 items-center justify-center rounded-full bg-black/60">
                    {savingMedia ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="download-outline" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                  {/* Toast tải video khi đang xem trên feed (không có modal để chèn) */}
                  {!imageModalVisible && toast ? (
                    <InlineToast
                      key={toast.id}
                      message={toast.message}
                      type={toast.type}
                      floating
                      bottomOffset={12}
                      onHide={hideToast}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Reactions & Comments Summary - Hiển thị khi có reaction HOẶC comment */}
      {(totalReactions > 0 || (JOURNAL_COMMENTS_ENABLED && commentCount > 0)) && (
        <View className="px-4 pb-2">
          <View className="flex-row items-center justify-between">
            {/* Ấn vào để xem danh sách người thích */}
            {totalReactions > 0 ? (
              <TouchableOpacity
                className="flex-row items-center"
                onPress={() => setReactionsListVisible(true)}
                activeOpacity={0.7}>
                <View className="flex-row items-center">
                  {/* Tắt đa cảm xúc ⇒ gộp mọi mã cũ về 1 icon tim. */}
                  {(JOURNAL_MULTI_REACTION_ENABLED
                    ? Object.entries(reactionCounts)
                    : ([[FEED_REACTION_CODE, totalReactions]] as Array<[string, number]>)
                  ).map(([emojiCode, count]) => {
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
              </TouchableOpacity>
            ) : (
              <View />
            )}
            {JOURNAL_COMMENTS_ENABLED && commentCount > 0 && (
              <TouchableOpacity onPress={() => (onCommentPress ? onCommentPress(post) : undefined)}>
                <Text className="text-sm text-gray-600">{commentCount} bình luận</Text>
              </TouchableOpacity>
            )}
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
                  const emoji = getEmojiByCode(
                    JOURNAL_MULTI_REACTION_ENABLED ? userReaction.type : FEED_REACTION_CODE,
                  );
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
                  ? getEmojiByCode(
                      JOURNAL_MULTI_REACTION_ENABLED ? userReaction.type : FEED_REACTION_CODE,
                    )?.color || '#F05023'
                  : '#6B7280',
              }}>
              {userReaction
                ? (JOURNAL_MULTI_REACTION_ENABLED
                    ? getEmojiByCode(userReaction.type)?.name || 'Đã thích'
                    : 'Đã thích')
                : 'Thích'}
            </Text>
          </TouchableOpacity>

          {JOURNAL_COMMENTS_ENABLED && (
            <TouchableOpacity
              onPress={() => (onCommentPress ? onCommentPress(post) : undefined)}
              className="flex-row items-center rounded-full px-4 py-2">
              <Ionicons name="chatbubble-outline" size={24} color="#6B7280" />
              <Text className="ml-2 text-base font-medium text-gray-600">Bình luận</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Image Modal - Style mạng xã hội với swipe to close */}
      <Modal
        visible={imageModalVisible}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Animated.View 
          style={{ 
            flex: 1, 
            backgroundColor: 'black',
            opacity: imageModalOpacity,
          }}
        >
          <Animated.View 
            style={{ 
              flex: 1,
              transform: [{ translateY: imageModalTranslateY }],
            }}
          >
            {/* Thanh kéo để vuốt đóng - Vùng touch lớn ở trên */}
            <View 
              {...dragHandlePanResponder.panHandlers}
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: insets.top + 120,
                zIndex: 20,
              }}
            >
              {/* Header */}
              <View
                className="flex-row items-center justify-between px-4"
                style={{ marginTop: insets.top + 8 }}>
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

                {/* Nút tải ảnh + đóng */}
                <View className="flex-row items-center">
                  <TouchableOpacity
                    disabled={savingMedia}
                    onPress={() => void saveMedia(post.images[currentImageIndex], 'image')}
                    className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-black/50">
                    {savingMedia ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="download-outline" size={22} color="white" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setImageModalVisible(false)}
                    className="h-10 w-10 items-center justify-center rounded-full bg-black/50">
                    <Ionicons name="close" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Thanh kéo indicator */}
              <View className="items-center mt-4">
                <View className="w-10 h-1 rounded-full bg-white/50" />
                <Text className="text-xs text-white/50 mt-2">Kéo xuống để đóng</Text>
              </View>
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
                    source={{ uri: resolveSocialMediaUrl(image, API_BASE_URL) }}
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
          </Animated.View>
          {toast ? (
            <InlineToast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              floating
              bottomOffset={insets.bottom + 32}
              onHide={hideToast}
            />
          ) : null}
        </Animated.View>
      </Modal>

      {/* Reaction Picker Modal */}
      <ReactionPicker
        visible={JOURNAL_MULTI_REACTION_ENABLED && reactionPickerVisible}
        onClose={() => setReactionPickerVisible(false)}
        onSelect={handleReaction}
        currentReaction={userReaction?.type}
        anchorPosition={reactionPickerPosition}
      />

      {/* Reactions List Modal */}
      <ReactionsListModal
        visible={reactionsListVisible}
        onClose={() => setReactionsListVisible(false)}
        reactions={post.reactions}
      />

      {/* Tùy chọn bài viết */}
      <ActionSheet
        visible={optionsVisible}
        title="Tùy chọn bài viết"
        options={postOptions}
        onSelect={(value) => {
          pendingOptionRef.current = value;
          setOptionsVisible(false);
        }}
        onCancel={() => {
          pendingOptionRef.current = null;
          setOptionsVisible(false);
        }}
        onDismiss={handleOptionsDismissed}
      />

      {/* Sửa bài viết — dùng lại CreatePostModal ở chế độ sửa */}
      {canEditPost && (
        <CreatePostModal
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          onPostCreated={() => {}}
          editingPost={post}
          onPostUpdated={(updatedPost) => {
            setEditModalVisible(false);
            onUpdate(updatedPost);
          }}
        />
      )}
    </View>
  );
};

export default PostCard;
