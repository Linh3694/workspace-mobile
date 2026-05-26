// @ts-nocheck
/**
 * Hoạt động lớp — nhật ký class-feed cho GVCN/phó CN (journal Wislife scope lớp)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Text,
  View,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';

import PostCard from '../../components/Wislife/PostCard';
import CreatePostModal from '../../components/Wislife/CreatePostModal';
import CommentsModal from '../../components/Wislife/CommentsModal';
import PostSkeleton from '../../components/Wislife/PostSkeleton';
import { Ionicons } from '@expo/vector-icons';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ROUTES } from '../../constants/routes';

import type { RootStackParamList } from '../../navigation/AppNavigator';

import { postService } from '../../services/postService';

import { useAuth } from '../../context/AuthContext';

import type { Post } from '../../types/post';

import { getAvatar } from '../../utils/avatar';

import { useLanguage } from '../../hooks/useLanguage';

import { useHomeroomClasses } from '../../hooks/useHomeroomClasses';

import { ClassPickerSheet } from './components/ClassPickerSheet';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ClassActivityScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const {
    loading: loadingClasses,
    options,
    selected,
    error: classErr,
    setSelected,
  } = useHomeroomClasses();

  const { t } = useLanguage();

  const [pickerOpen, setPickerOpen] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  const [isCommentsModalVisible, setIsCommentsModalVisible] = useState(false);

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const classContext = useMemo(() => {
    if (!selected) return null;
    return {
      classId: selected.id,
      schoolYearId: selected.schoolYearId,
      className: selected.title,
    };
  }, [selected]);

  const fetchPosts = useCallback(
    async (pageNum = 1, isRefresh = false) => {
      if (!selected) return;

      try {
        if (isRefresh) setRefreshing(true);
        else if (pageNum === 1) setLoadingPosts(true);

        const response = await postService.getClassFeed(
          selected.id,
          selected.schoolYearId,
          pageNum,
          10
        );

        const sortedPosts = (response.posts || []).sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        if (pageNum === 1 || isRefresh) {
          setPosts(sortedPosts);
        } else {
          setPosts((prev) => {
            const merged = [...prev, ...sortedPosts];
            return merged.sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
          });
        }

        setHasNextPage(response.pagination?.hasNext ?? false);
        setPage(pageNum);
      } catch (e) {
        console.error(e);
        Alert.alert(t('common.error'), t('class_activity.load_error'));
      } finally {
        setLoadingPosts(false);
        setRefreshing(false);
      }
    },
    [selected, t]
  );

  useEffect(() => {
    if (!selected) {
      setPosts([]);
      setLoadingPosts(false);
      return;
    }
    setPage(1);
    void fetchPosts(1);
  }, [selected?.id, selected?.schoolYearId, fetchPosts]);

  const loadMorePosts = useCallback(() => {
    if (hasNextPage && !loadingPosts && !refreshing) {
      void fetchPosts(page + 1);
    }
  }, [hasNextPage, loadingPosts, refreshing, page, fetchPosts]);

  const onRefresh = useCallback(() => {
    void fetchPosts(1, true);
  }, [fetchPosts]);

  const handlePostCreated = useCallback((newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    setIsCreateModalVisible(false);
  }, []);

  const handlePostUpdate = useCallback(
    (updatedPost: Post) => {
      setPosts((prev) => prev.map((p) => (p._id === updatedPost._id ? updatedPost : p)));
      if (selectedPost && selectedPost._id === updatedPost._id) {
        setSelectedPost(updatedPost);
      }
    },
    [selectedPost]
  );

  const handlePostDelete = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  }, []);

  const openExchange = () => {
    if (!selected) return;
    navigation.navigate(ROUTES.SCREENS.EXCHANGE_LIST, {
      classId: selected.id,
      schoolYearId: selected.schoolYearId,
      classTitle: selected.title,
    });
  };

  const hasMultipleClasses = options.length > 1;

  /** Tiêu đề pill giống LeaveRequests: "Lớp …" */
  const classPillLabel = selected?.title
    ? /^lớp\s/i.test(selected.title.trim())
      ? selected.title.trim()
      : `Lớp ${selected.title.trim()}`
    : '';

  /** Header giống màn Đơn từ (LeaveRequestsScreen): back + tiêu đề căn giữa + slot phải 44px */
  const headerBackTitleRight = (rightSlot: React.ReactNode) => (
    <View className="px-4 pt-4">
      <View className="mb-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 44,
            height: 44,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: -8,
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#0A2240" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-2xl font-bold text-[#0A2240]" numberOfLines={1}>
          {t('class_activity.tile_title')}
        </Text>
        {rightSlot}
      </View>
    </View>
  );

  if (loadingClasses) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        {headerBackTitleRight(<View style={{ width: 44 }} />)}
        <View style={styles.loadingBody}>
          <ActivityIndicator size="large" color="#FF7A00" />
          <Text style={styles.hint}>{t('class_activity.loading_classes')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (classErr || options.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        {headerBackTitleRight(<View style={{ width: 44 }} />)}
        <View style={styles.center}>
          <Ionicons name="school-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('class_activity.no_homeroom')}</Text>
          <Text style={styles.emptySub}>{t('class_activity.no_homeroom_desc')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {headerBackTitleRight(
        <TouchableOpacity
          onPress={openExchange}
          style={{
            width: 44,
            height: 44,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="exchange">
          <Ionicons name="chatbubble-ellipses-outline" size={24} color="#0A2240" />
        </TouchableOpacity>
      )}

      {/* Badge chọn lớp — cùng pattern pill với màn Đơn từ */}
      <View className="mb-2 px-4">
        <TouchableOpacity
          onPress={() => hasMultipleClasses && setPickerOpen(true)}
          activeOpacity={hasMultipleClasses ? 0.7 : 1}
          className="self-center">
          <View
            className="flex-row items-center rounded-full px-4 py-2"
            style={{ backgroundColor: '#E5EAF0' }}>
            <Text
              className="max-w-[240px] text-base font-semibold text-[#002855]"
              numberOfLines={1}>
              {classPillLabel}
            </Text>
            {hasMultipleClasses ? (
              <Ionicons name="chevron-down" size={16} color="#002855" style={{ marginLeft: 6 }} />
            ) : null}
          </View>
        </TouchableOpacity>
      </View>

      <ClassPickerSheet
        visible={pickerOpen}
        options={options}
        selectedId={selected?.id}
        onClose={() => setPickerOpen(false)}
        onSelect={(o) => void setSelected(o)}
        title={t('class_activity.pick_class')}
      />

      <TouchableOpacity
        onPress={() => setIsCreateModalVisible(true)}
        style={styles.composerRow}
        activeOpacity={0.7}>
        <View style={styles.composerBox}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: getAvatar(user) }} style={styles.avatarImg} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center', marginLeft: 10 }}>
            <Text style={styles.placeholderText}>{t('class_activity.composer_placeholder')}</Text>
          </View>
          <View style={styles.iconCircle}>
            <Ionicons name="image-outline" size={18} color="#002855" />
          </View>
        </View>
      </TouchableOpacity>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF7A00']}
            tintColor="#FF7A00"
          />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const pad = 24;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - pad) {
            loadMorePosts();
          }
        }}
        scrollEventThrottle={400}>
        <View style={{ paddingBottom: 120 }}>
          {loadingPosts && page === 1 ? (
            <View>
              {[...Array(3)].map((_, i) => (
                <PostSkeleton key={i} />
              ))}
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.feedEmpty}>
              <Ionicons name="images-outline" size={56} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>{t('class_activity.empty_feed_title')}</Text>
              <Text style={styles.emptySub}>{t('class_activity.empty_feed_sub')}</Text>
            </View>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  onUpdate={handlePostUpdate}
                  onDelete={handlePostDelete}
                  onCommentPress={(p) => {
                    setSelectedPost(p);
                    setIsCommentsModalVisible(true);
                  }}
                />
              ))}

              {loadingPosts && page > 1 ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <ActivityIndicator size="small" color="#FF7A00" />
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <CreatePostModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onPostCreated={handlePostCreated}
        classContext={classContext || undefined}
      />

      {selectedPost && (
        <CommentsModal
          visible={isCommentsModalVisible}
          onClose={() => {
            setIsCommentsModalVisible(false);
            setSelectedPost(null);
          }}
          post={selectedPost}
          onUpdate={handlePostUpdate}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  hint: { marginTop: 12, color: '#6B7280' },
  emptyTitle: {
    marginTop: 12,
    fontFamily: 'Mulish-SemiBold',
    fontSize: 18,
    color: '#374151',
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  feedEmpty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  composerRow: { marginHorizontal: 16, marginVertical: 10 },
  composerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FF7A00',
  },
  avatarImg: { width: '100%', height: '100%' },
  placeholderText: { fontSize: 16, color: '#9CA3AF' },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
