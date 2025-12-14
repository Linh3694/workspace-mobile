import React, { useState, useEffect, useCallback } from 'react';
// @ts-ignore
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import PostCard from '../../components/Wislife/PostCard';
import CreatePostModal from '../../components/Wislife/CreatePostModal';
import CommentsModal from '../../components/Wislife/CommentsModal';
import PostSkeleton from '../../components/Wislife/PostSkeleton';
import { postService } from '../../services/postService';
import { useAuth } from '../../context/AuthContext';
import { Post } from '../../types/post';
import WislifeIcon from '../../assets/wislife-banner.svg';
import { getAvatar } from '../../utils/avatar';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import StandardHeader from '../../components/Common/StandardHeader';

const WislifeScreen = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isCommentsModalVisible, setIsCommentsModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const fetchPosts = useCallback(async (pageNum = 1, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }

      const response = await postService.getNewsfeed(pageNum, 10);

      if (pageNum === 1 || isRefresh) {
        setPosts(response.posts);
      } else {
        setPosts((prev) => [...prev, ...response.posts]);
      }

      setHasNextPage(response.pagination.hasNext);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching posts:', error);
      Alert.alert('Lỗi', 'Không thể tải bài viết. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMorePosts = useCallback(() => {
    if (hasNextPage && !loading && !refreshing) {
      fetchPosts(page + 1);
    }
  }, [hasNextPage, loading, refreshing, page, fetchPosts]);

  const onRefresh = useCallback(() => {
    fetchPosts(1, true);
  }, [fetchPosts]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      fetchPosts(1);
      return;
    }

    try {
      setLoading(true);
      const response = await postService.searchPosts(searchQuery, 1, 10);
      setPosts(response.posts);
      setHasNextPage(response.pagination.hasNext);
      setPage(1);
    } catch (error) {
      console.error('Error searching posts:', error);
      Alert.alert('Lỗi', 'Không thể tìm kiếm bài viết. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, fetchPosts]);

  const handlePostCreated = useCallback((newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    setIsCreateModalVisible(false);
  }, []);

  const handlePostUpdate = useCallback(
    (updatedPost: Post) => {
      setPosts((prev) => prev.map((post) => (post._id === updatedPost._id ? updatedPost : post)));
      if (selectedPost && selectedPost._id === updatedPost._id) {
        setSelectedPost(updatedPost);
      }
    },
    [selectedPost]
  );

  const handlePostDelete = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
  }, []);

  const handleCommentPress = useCallback((post: Post) => {
    setSelectedPost(post);
    setIsCommentsModalVisible(true);
  }, []);

  const handleCloseCommentsModal = useCallback(() => {
    setIsCommentsModalVisible(false);
    setSelectedPost(null);
  }, []);

  useEffect(() => {
    fetchPosts(1);
  }, []);

  return (
    <View className="flex-1 bg-white">
      <StandardHeader
        logo={<WislifeIcon width={130} height={50} />}
        rightButton={
          <TouchableOpacity 
            onPress={() => {
              setIsSearchVisible(!isSearchVisible);
              if (isSearchVisible && searchQuery) {
                // Nếu đang đóng search bar và có search query, reset về tất cả bài viết
                setSearchQuery('');
                fetchPosts(1);
              }
            }}
            className="ml-3">
            <Ionicons name={isSearchVisible ? "close" : "search"} size={24} color="#6B7280" />
          </TouchableOpacity>
        }
      />

      {/* Search Bar - hiển thị khi isSearchVisible = true */}
      {isSearchVisible && (
        <View className="border-b border-gray-200 bg-white px-4 py-3">
          <View className="flex-row items-center rounded-lg bg-gray-100 px-3">
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              className="ml-2 flex-1 py-2 text-base text-gray-900"
              placeholder="Tìm kiếm bài viết..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  fetchPosts(1);
                }}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Create Post Section */}
      <TouchableOpacity
        onPress={() => setIsCreateModalVisible(true)}
        className="mx-4 mt-2 border-b border-gray-300 pb-3">
        <View className="flex-row items-center">
          <View className="flex-1 flex-row items-center">
            <View className="h-10 w-10 overflow-hidden rounded-full bg-gray-300">
              <Image source={{ uri: getAvatar(user) }} className="h-full w-full" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-semibold text-gray-900">{user?.fullname || ''}</Text>
              <Text className="text-sm text-gray-500">Có gì mới?</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Posts List */}
      <ScrollView
        className="flex-1"
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
          const paddingToBottom = 20;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            loadMorePosts();
          }
        }}
        scrollEventThrottle={400}>
        {loading && page === 1 ? (
          <View className="pb-24">
            {[...Array(3)].map((_, index) => (
              <PostSkeleton key={index} />
            ))}
          </View>
        ) : posts.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
            <Text className="mt-4 font-medium text-lg text-gray-500">Chưa có bài viết nào</Text>
            <Text className="mt-2 px-8 text-center text-gray-400">
              Hãy là người đầu tiên chia sẻ những khoảnh khắc đặc biệt
            </Text>
          </View>
        ) : (
          <View className="pb-[30%]">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onUpdate={handlePostUpdate}
                onDelete={handlePostDelete}
                onCommentPress={handleCommentPress}
              />
            ))}

            {loading && page > 1 && (
              <View className="items-center py-4">
                <ActivityIndicator size="small" color="#FF7A00" />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Create Post Modal */}
      <CreatePostModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onPostCreated={handlePostCreated}
      />

      {/* Comments Modal */}
      {selectedPost && (
        <CommentsModal
          visible={isCommentsModalVisible}
          onClose={handleCloseCommentsModal}
          post={selectedPost}
          onUpdate={handlePostUpdate}
        />
      )}
    </View>
  );
};

export default WislifeScreen;
