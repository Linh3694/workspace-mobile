import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { notificationCenterService } from '../../services/notificationCenterService';

interface NotificationData {
  _id?: string;
  id?: string;
  title: string | { vi: string; en: string };
  message: string | { vi: string; en: string };
  data: any;
  read: boolean;
  createdAt: string;
}

interface PaginationState {
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  pages: number;
}

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    total: 0,
    unreadCount: 0,
    page: 1,
    limit: 20,
    pages: 0,
  });

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (page = 1) => {
      try {
        if (page === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const response = await notificationCenterService.getNotifications(page, pagination.limit);

        if (response.success) {
          const notificationsData = response.data.notifications || [];

          if (page === 1) {
            setNotifications(notificationsData);
          } else {
            setNotifications((prev) => [...prev, ...notificationsData]);
          }

          setPagination({
            total: response.data.total,
            unreadCount: response.data.unread_count,
            page: page,
            limit: pagination.limit,
            pages: Math.ceil(response.data.total / pagination.limit),
          });
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
        Alert.alert('Lỗi', 'Không thể tải thông báo. Vui lòng thử lại.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [pagination.limit]
  );

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await notificationCenterService.markAsRead(notificationId);
      if (response.success) {
        setNotifications((prev) =>
          prev.map((item) =>
            item._id === notificationId || item.id === notificationId
              ? { ...item, read: true }
              : item
          )
        );
        setPagination((prev) => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
        }));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Handle notification press
  const handleNotificationPress = useCallback(
    async (notification: NotificationData) => {
      // Mark as read if not already read
      if (!notification.read) {
        const notificationId = notification._id || notification.id;
        if (notificationId) {
          await markAsRead(notificationId);
        }
      }

      // Handle navigation based on notification type
      const data = notification.data;
      if (data?.type === 'new_ticket' || data?.type === 'ticket_update') {
        (navigation as any).navigate('Main', {
          screen: 'Ticket',
          params: { ticketId: data.ticketId },
        });
      } else if (data?.type === 'attendance' || data?.type === 'staff_attendance') {
        (navigation as any).navigate('Main', {
          screen: 'Notification',
        });
      }
    },
    [navigation, markAsRead]
  );

  // Refresh notifications
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(1);
  }, [fetchNotifications]);

  // Load more notifications
  const loadMore = useCallback(() => {
    if (!loadingMore && pagination.page < pagination.pages) {
      fetchNotifications(pagination.page + 1);
    }
  }, [loadingMore, pagination.page, pagination.pages, fetchNotifications]);

  // Initial load
  useEffect(() => {
    fetchNotifications();

    // Clear badge count
    Notifications.setBadgeCountAsync(0);

    // Handle deep link if notificationId is provided
    if ((route.params as any)?.notificationId) {
      // Find and handle the notification
      const notification = notifications.find(
        (n) => n._id === (route.params as any).notificationId
      );
      if (notification) {
        handleNotificationPress(notification);
      }
    }
  }, []);

  // Render notification item
  const renderNotification = ({ item }: { item: NotificationData }) => {
    const title = typeof item.title === 'string' ? item.title : item.title.vi || item.title.en;
    const message =
      typeof item.message === 'string' ? item.message : item.message.vi || item.message.en;

    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        className={`border-b border-gray-100 p-4 ${!item.read ? 'bg-blue-50' : 'bg-white'}`}>
        <View className="flex-row items-start">
          {!item.read && <View className="mr-3 mt-2 h-2 w-2 rounded-full bg-blue-500" />}
          <View className="flex-1">
            <Text
              className={`font-semibold text-base ${!item.read ? 'text-blue-900' : 'text-gray-900'}`}>
              {title}
            </Text>
            <Text className={`mt-1 text-sm ${!item.read ? 'text-blue-700' : 'text-gray-600'}`}>
              {message}
            </Text>
            <Text className="mt-2 text-xs text-gray-400">
              {formatDistanceToNow(new Date(item.createdAt), {
                addSuffix: true,
                locale: vi,
              })}
            </Text>
          </View>
          {!item.read && <Ionicons name="chevron-forward" size={20} color="#3B82F6" />}
        </View>
      </TouchableOpacity>
    );
  };

  // Render footer for loading more
  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View className="py-4">
        <ActivityIndicator size="small" color="#F05023" />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F05023" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between border-b border-gray-200 p-4">
        <Text className="font-bold text-xl text-gray-900">Thông báo</Text>
        {pagination.unreadCount > 0 && (
          <View className="rounded-full bg-red-500 px-2 py-1">
            <Text className="font-medium text-xs text-white">{pagination.unreadCount}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="notifications-off-outline" size={64} color="#9CA3AF" />
            <Text className="mt-4 text-lg text-gray-500">Không có thông báo nào</Text>
          </View>
        }
        ListFooterComponent={renderFooter}
      />
    </SafeAreaView>
  );
};

export default NotificationsScreen;
