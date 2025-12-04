import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import {
  getStatusLabel,
  getStatusColor,
  FEEDBACK_FILTER_OPTIONS,
} from '../../config/feedbackConstants';
import {
  useFeedbackStore,
  useFeedbackListData,
  useFeedbackUIActions,
} from '../../hooks/useFeedbackStore';
import type { Feedback } from '../../services/feedbackService';

type FeedbackScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Feedback'>;

interface FeedbackScreenProps {
  isFromTab?: boolean;
}

const FeedbackScreen = ({ isFromTab = false }: FeedbackScreenProps) => {
  const navigation = useNavigation<FeedbackScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Local states
  const [showFilters, setShowFilters] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState('');

  // Store data
  const { feedbackList, loading, refreshing, error, totalCount } = useFeedbackListData();
  const { setFilterStatus, setSearchTerm } = useFeedbackUIActions();
  const filterStatus = useFeedbackStore((state) => state.ui.filterStatus);
  const fetchFeedbackList = useFeedbackStore((state) => state.fetchFeedbackList);
  const refreshList = useFeedbackStore((state) => state.refreshList);

  // Initial fetch
  useEffect(() => {
    fetchFeedbackList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      fetchFeedbackList();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterStatus])
  );

  // Handle search
  const handleSearch = () => {
    setSearchTerm(localSearchTerm);
    fetchFeedbackList({ page: 1 });
  };

  // Handle filter
  const applyFilter = (status: string) => {
    setFilterStatus(status);
    setShowFilters(false);
  };

  // Navigate to detail
  const handleViewDetail = (feedbackId: string) => {
    navigation.navigate('FeedbackDetail' as any, { feedbackId });
  };

  // Go back
  const handleGoBack = () => {
    navigation.goBack();
  };

  // Helper để hiển thị số sao
  const renderStars = (rating: number) => {
    // Rating được lưu dạng normalized (0-1), cần convert về 1-5
    const actualRating = Math.round(rating * 5);
    return '⭐'.repeat(actualRating);
  };

  // Render feedback item - Layout giống Ticket
  const renderItem = ({ item }: { item: Feedback }) => {
    const isRating = item.feedback_type === 'Đánh giá';

    return (
      <TouchableOpacity
        className="mb-3 rounded-xl bg-[#F8F8F8] p-4"
        onPress={() => handleViewDetail(item.name)}>
        <View>
          {/* Title - Hiển thị khác nhau cho Góp ý và Đánh giá */}
          <Text className="text-lg font-medium text-[#E84A37]" numberOfLines={2}>
            {isRating
              ? `Đánh giá - ${renderStars(item.rating || 0)}`
              : item.title || 'Không có tiêu đề'}
          </Text>

          {/* Code (left) and Assigned (right) */}
          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-sm text-gray-500">{item.name}</Text>
            <Text className="text-sm text-gray-500" numberOfLines={1}>
              {normalizeVietnameseName(item.assigned_to_full_name) || 'Chưa phân công'}
            </Text>
          </View>

          {/* Guardian (left) and Status (right) - Style giống Ticket */}
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="flex-1 text-base font-semibold text-[#002855]" numberOfLines={1}>
              {item.guardian_name || item.guardian || 'Chưa xác định'}
            </Text>
            <View
              className={`${getStatusColor(item.status)} rounded-lg px-3 py-1`}
              style={{ flexShrink: 0, minWidth: 90 }}>
              <Text className="text-center text-sm font-medium text-white" numberOfLines={1}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4">
        {!isFromTab && (
          <TouchableOpacity onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
        )}
        <Text className="flex-1 text-center text-xl font-bold text-[#002855]">Góp ý phụ huynh</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search bar */}
      <View className="flex-row items-center gap-2 px-4 pb-2">
        <View className="flex-1 flex-row items-center rounded-full bg-[#F5F5F5] px-4 py-2">
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            placeholder="Tìm kiếm feedback..."
            placeholderTextColor="#888"
            value={localSearchTerm}
            onChangeText={setLocalSearchTerm}
            onSubmitEditing={handleSearch}
            className="ml-2 flex-1 text-base"
            returnKeyType="search"
          />
          {localSearchTerm.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setLocalSearchTerm('');
                setSearchTerm('');
                fetchFeedbackList({ page: 1 });
              }}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          className={`rounded-full p-2 ${showFilters ? 'bg-[#002855]' : 'bg-[#F5F5F5]'}`}>
          <MaterialIcons name="filter-list" size={24} color={showFilters ? 'white' : '#888'} />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      {showFilters && (
        <View className="px-4 pb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {FEEDBACK_FILTER_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status.value}
                onPress={() => applyFilter(status.value)}
                className={`mr-2 rounded-full px-4 py-2 ${
                  filterStatus === status.value ? 'bg-[#002855]' : 'bg-[#F5F5F5]'
                }`}>
                <Text
                  className={`text-sm font-medium ${
                    filterStatus === status.value ? 'text-white' : 'text-gray-600'
                  }`}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Count */}
      <View className="px-4 pb-2">
        <Text className="text-sm text-gray-500">Tổng: {totalCount} góp ý</Text>
      </View>

      {/* List */}
      {loading && feedbackList.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F05023" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-center text-red-500">{error}</Text>
          <TouchableOpacity
            onPress={() => fetchFeedbackList()}
            className="mt-4 rounded-lg bg-[#002855] px-4 py-2">
            <Text className="font-medium text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : feedbackList.length === 0 ? (
        <View className="flex-1 items-center justify-center p-4">
          <Ionicons name="chatbox-outline" size={64} color="#ccc" />
          <Text className="mt-4 text-center text-gray-500">Chưa có góp ý nào</Text>
        </View>
      ) : (
        <FlatList
          data={feedbackList}
          keyExtractor={(item) => item.name}
          contentContainerStyle={{ padding: 16 }}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshList}
              colors={['#F05023']}
              tintColor="#F05023"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default FeedbackScreen;
