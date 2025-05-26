import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PostCard from '../../components/Wislife/PostCard';
import CreatePostModal from '../../components/Wislife/CreatePostModal';
import PostSkeleton from '../../components/Wislife/PostSkeleton';
import { postService } from '../../services/postService';
import { useAuth } from '../../context/AuthContext';
import { Post } from '../../types/post';
import WislifeIcon from '../../assets/wislife-banner.svg';
import { getAvatar } from '../../utils/avatar';

const WislifeScreen = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
        setPosts(prev => [...prev, ...response.posts]);
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
    setPosts(prev => [newPost, ...prev]);
    setIsCreateModalVisible(false);
  }, []);

  const handlePostUpdate = useCallback((updatedPost: Post) => {
    setPosts(prev => 
      prev.map(post => 
        post._id === updatedPost._id ? updatedPost : post
      )
    );
  }, []);

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(post => post._id !== postId));
  }, []);

  useEffect(() => {
    fetchPosts(1);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white ">
        <View className="flex-1">
         <WislifeIcon width={100} height={30} />
        </View>
        <TouchableOpacity 
          onPress={() => setIsCreateModalVisible(true)}
          className="ml-3"
        >
          <Ionicons name="search" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Search Bar
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            className="flex-1 ml-3 text-base text-gray-900"
            placeholder="Tìm kiếm bài viết..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                fetchPosts(1);
              }}
            >
              <Ionicons name="close-circle" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View> */}

      {/* Create Post Section */}
      <TouchableOpacity
        onPress={() => setIsCreateModalVisible(true)}
        className="mx-4 mt-5 border-b border-gray-300 pb-5"
      >
        <View className="flex-row items-center">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full overflow-hidden bg-gray-300">
              <Image 
                source={{ uri: getAvatar(user) }} 
                className="w-full h-full"
              />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-semibold text-gray-900">
                {user?.fullname}
              </Text>
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
          if (
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom
          ) {
            loadMorePosts();
          }
        }}
        scrollEventThrottle={400}
      >
        {loading && page === 1 ? (
          <View className="pb-4">
            {[...Array(3)].map((_, index) => (
              <PostSkeleton key={index} />
            ))}
          </View>
        ) : posts.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
            <Text className="mt-4 text-lg font-medium text-gray-500">
              Chưa có bài viết nào
            </Text>
            <Text className="mt-2 text-gray-400 text-center px-8">
              Hãy là người đầu tiên chia sẻ những khoảnh khắc đặc biệt
            </Text>
          </View>
        ) : (
          <View className="pb-4">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onUpdate={handlePostUpdate}
                onDelete={handlePostDelete}
              />
            ))}
            
            {loading && page > 1 && (
              <View className="py-4 items-center">
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
    </SafeAreaView>
  );
};

export default WislifeScreen; 