import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useLanguage } from '../../hooks/useLanguage';
import * as Notifications from 'expo-notifications';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { notificationCenterService } from '../../services/notificationCenterService';
import socketService from '../../services/socketService';

interface NotificationData {
  _id?: string; // MongoDB ID
  id?: string; // Frappe ID (backend trả về 'id' thay vì '_id')
  title: string | { vi: string; en: string };
  message: string | { vi: string; en: string };
  data: any;
  read: boolean;
  createdAt: string;
  eventTimestamp?: string; // Thời gian thực tế của event
  type: string;
  student_name?: string;
}

interface Pagination {
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  pages: number;
}

type RootStackParamList = {
  Notification: { notificationId?: string } | undefined;
};

const NotificationsScreen = () => {
  const { t, currentLanguage } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    unreadCount: 0,
    page: 1,
    limit: 20,
    pages: 0,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Notification'>>();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  // Helper: Get notification ID (support both _id and id)
  const getNotificationId = (notification: NotificationData): string | undefined => {
    return notification._id || notification.id;
  };

  // Lấy text từ multilingual notification
  const getLocalizedText = (text: string | { vi: string; en: string }): string => {
    if (typeof text === 'string') return text;
    return currentLanguage === 'vi' ? text.vi : text.en;
  };

  // Cài đặt handler khi nhận push notification
  useEffect(() => {
    // Handler khi nhận notification (app đang mở)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📨 Notification received:', notification);
      fetchNotifications(); // Refresh list
    });

    // Handler khi user tap vào notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);
      const notificationId = response.notification.request.content.data?.notificationId;

      // Clear notification từ lock screen
      if (Platform.OS === 'ios') {
        Notifications.dismissNotificationAsync(response.notification.request.identifier);
      } else {
        Notifications.dismissNotificationAsync(response.notification.request.identifier);
      }

      // Navigate to notification detail nếu có
      if (notificationId) {
        handleNotificationPress({ _id: notificationId } as NotificationData);
      }

      // Refresh notifications list
      fetchNotifications();
    });

    return () => {
      // Expo SDK 54+ uses .remove() method on subscription object
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Fetch notifications khi screen mount
  useEffect(() => {
    fetchNotifications();

    // Clear badge count khi vào màn hình notifications
    Notifications.setBadgeCountAsync(0);

    // Nếu có notificationId từ deep link, auto-open notification đó
    if (route.params?.notificationId) {
      const notification = notifications.find((n) => n._id === route.params.notificationId);
      if (notification) {
        handleNotificationPress(notification);
      }
    }
  }, [route.params?.notificationId]);

  // Connect socket và lắng nghe notifications realtime
  useEffect(() => {
    const initSocket = async () => {
      const authToken = await AsyncStorage.getItem('authToken');
      if (authToken) {
        // Decode token để lấy userId
        try {
          const base64Url = authToken.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const decoded = JSON.parse(jsonPayload);
          const userId = decoded.userId || decoded.name || decoded.sub;

          console.log('🔌 NotificationsScreen: Connecting socket for user:', userId);

          // Connect socket
          await socketService.connect(userId);

          // Lắng nghe notifications mới
          socketService.onNewNotification((notification) => {
            console.log('📨 NotificationsScreen: New notification received:', notification);
            // Refresh notifications list
            fetchNotifications(1);

            // Update badge count
            Notifications.getBadgeCountAsync().then((currentBadge) => {
              Notifications.setBadgeCountAsync(currentBadge + 1);
            });
          });

          // Lắng nghe notification read từ device khác
          socketService.onNotificationRead((data) => {
            console.log('✅ NotificationsScreen: Notification read on other device:', data);
            // Update UI
            setNotifications((prevNotifications) =>
              prevNotifications.map((item) => {
                const itemId = getNotificationId(item);
                return itemId === data.notificationId ? { ...item, read: true } : item;
              })
            );
            // Update unread count
            setPagination((prev) => ({
              ...prev,
              unreadCount: Math.max(0, prev.unreadCount - 1),
            }));
          });
        } catch (error) {
          console.error('❌ NotificationsScreen: Error decoding token:', error);
        }
      }
    };

    initSocket();

    return () => {
      // Cleanup listeners khi unmount
      socketService.removeListener('new_notification');
      socketService.removeListener('notification_read');
    };
  }, []);

  // Fetch danh sách notifications
  const fetchNotifications = useCallback(
    async (page = 1) => {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        console.log('📤 Fetching notifications - page:', page);

        const response = await notificationCenterService.getNotifications({
          limit: pagination.limit,
          offset: (page - 1) * pagination.limit,
          include_read: true,
        });

        console.log('📥 Notifications response:', response);

        if (response.success && response.data) {
          const notificationsData = response.data.notifications || [];

          // Debug: Check if all notifications have id or _id
          const missingIds = notificationsData.filter((n: any) => !n._id && !n.id);
          if (missingIds.length > 0) {
            console.warn('⚠️ Some notifications missing both _id and id:', missingIds.length);
            console.warn('Sample missing ID notification:', missingIds[0]);
          }

          // Debug: Check which ID field is being used
          const withId = notificationsData.filter((n: any) => n.id).length;
          const with_Id = notificationsData.filter((n: any) => n._id).length;
          console.log(`📊 ID fields: ${withId} with 'id', ${with_Id} with '_id'`);

          // Debug: Check read status fields
          if (notificationsData.length > 0) {
            const first = notificationsData[0];
            console.log('📋 First notification structure:', {
              id: first.id,
              read: first.read,
              status: first.status,
              read_at: first.read_at,
              keys: Object.keys(first),
            });

            const readCounts = {
              withRead: notificationsData.filter((n: any) => n.read === true).length,
              withStatus: notificationsData.filter((n: any) => n.status === 'read').length,
              withReadAt: notificationsData.filter((n: any) => n.read_at).length,
            };
            console.log('📊 Read status fields:', readCounts);
          }

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

          console.log(
            `✅ Loaded ${notificationsData.length} notifications, ${response.data.unread_count} unread`
          );
        } else {
          console.error('❌ Failed to fetch notifications:', response.message);
          Alert.alert(t('common.error'), response.message || t('notifications.notification_error'));
        }
      } catch (error: any) {
        console.error('❌ Lỗi khi lấy thông báo:', error);

        if (error.response?.status === 401) {
          Alert.alert(t('common.error'), 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', [
            {
              text: 'OK',
              onPress: async () => {
                // Clear token and navigate to login
                await AsyncStorage.removeItem('authToken');
                // @ts-ignore
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              },
            },
          ]);
        } else {
          Alert.alert(t('common.error'), t('notifications.notification_error'));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [pagination.limit, t, navigation]
  );

  // Load more notifications
  const handleLoadMore = () => {
    if (loadingMore) return;
    if (pagination.page < pagination.pages) {
      fetchNotifications(pagination.page + 1);
    }
  };

  // Refresh notifications
  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications(1);
  };

  // Handle notification press
  const handleNotificationPress = async (notification: NotificationData) => {
    try {
      const notificationId = getNotificationId(notification);
      const isRead = notification.read || (notification as any).status === 'read';

      console.log('📌 Notification pressed:', {
        id: notificationId,
        _id: notification._id,
        id_field: notification.id,
        read: notification.read,
        status: (notification as any).status,
        isRead: isRead,
        type: notification.type,
      });

      // Mark as read nếu chưa đọc
      if (!isRead) {
        // Validate notification ID
        if (!notificationId) {
          console.error('❌ Notification missing both _id and id:', notification);
          return;
        }

        // Optimistic update
        setNotifications((prevNotifications) =>
          prevNotifications.map((item) => {
            const itemId = getNotificationId(item);
            return itemId === notificationId ? { ...item, read: true } : item;
          })
        );

        // Update trên server
        console.log('📤 Marking as read:', notificationId);
        const result = await notificationCenterService.markAsRead(notificationId);

        if (result.success) {
          console.log('✅ Marked as read successfully');
          // Update unread count
          setPagination((prev) => ({
            ...prev,
            unreadCount: Math.max(0, prev.unreadCount - 1),
          }));
        } else {
          console.error('❌ Failed to mark as read:', result.message);
          // Revert optimistic update
          setNotifications((prevNotifications) =>
            prevNotifications.map((item) => {
              const itemId = getNotificationId(item);
              return itemId === notificationId ? { ...item, read: false } : item;
            })
          );
        }
      }

      // Handle navigation based on notification type
      if (notification.data) {
        const data = notification.data;

        // Staff attendance notification - no navigation needed
        if (data.type === 'staff_attendance' || data.type === 'attendance') {
          console.log('✅ Staff attendance notification opened');
          return;
        }

        // Ticket notifications
        if (data.type === 'new_ticket' || data.type === 'ticket_update') {
          if (data.ticketId) {
            // @ts-ignore
            navigation.navigate('TicketAdminDetail', { ticketId: data.ticketId });
          }
        }

        // Chat notifications
        if (data.type === 'new_chat_message') {
          if (data.chatId) {
            // @ts-ignore
            navigation.navigate('ChatDetail', { chatId: data.chatId });
          }
        }
      }
    } catch (error) {
      console.error('❌ Lỗi khi xử lý thông báo:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const result = await notificationCenterService.markAllAsRead();

      if (result.success) {
        // Update UI
        setNotifications((prevNotifications) =>
          prevNotifications.map((item) => ({ ...item, read: true }))
        );

        setPagination((prev) => ({
          ...prev,
          unreadCount: 0,
        }));

        Alert.alert(t('notifications.title'), t('notifications.all_marked_read'));
      } else {
        console.error('❌ Failed to mark all as read:', result.message);
        Alert.alert(t('common.error'), result.message || t('notifications.mark_read_error'));
      }
    } catch (error) {
      console.error('❌ Lỗi khi đánh dấu tất cả đã đọc:', error);
      Alert.alert(t('common.error'), t('notifications.mark_read_error'));
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      const result = await notificationCenterService.deleteNotification(notificationId);

      if (result.success) {
        // Update UI
        const deletedNotification = notifications.find(
          (n) => getNotificationId(n) === notificationId
        );
        setNotifications((prevNotifications) =>
          prevNotifications.filter((item) => getNotificationId(item) !== notificationId)
        );

        // Update counts - check both read boolean and status field
        const wasUnread =
          deletedNotification &&
          !(deletedNotification.read || (deletedNotification as any).status === 'read');
        if (wasUnread) {
          setPagination((prev) => ({
            ...prev,
            total: prev.total - 1,
            unreadCount: prev.unreadCount - 1,
          }));
        } else {
          setPagination((prev) => ({
            ...prev,
            total: prev.total - 1,
          }));
        }
      } else {
        console.error('❌ Failed to delete notification:', result.message);
        Alert.alert(t('common.error'), result.message || t('notifications.delete_error'));
      }
    } catch (error) {
      console.error('❌ Lỗi khi xóa thông báo:', error);
      Alert.alert(t('common.error'), t('notifications.delete_error'));
    }
  };

  // Format time - Ưu tiên eventTimestamp (thời gian thực của event)
  const formatTime = (notification: NotificationData) => {
    try {
      // Ưu tiên: data.timestamp -> eventTimestamp -> createdAt
      const timestamp =
        notification.data?.timestamp || notification.eventTimestamp || notification.createdAt;

      const date = new Date(timestamp);
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: currentLanguage === 'vi' ? vi : undefined,
      });
    } catch {
      return notification.createdAt;
    }
  };

  // Render notification item
  const renderNotificationItem = ({ item }: { item: NotificationData }) => {
    // Check read status - support both 'read' boolean and 'status' string
    const isUnread = !(item.read || (item as any).status === 'read');
    const title = getLocalizedText(item.title);
    const message = getLocalizedText(item.message);

    return (
      <TouchableOpacity
        className={`border-b border-gray-200 p-4 px-10 ${isUnread ? 'bg-[#FFE6DF]' : 'bg-white'}`}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}>
        <View className="flex-row items-start gap-3">
          {/* Icon */}
          <View className="mt-1">
            <Ionicons
              name={
                item.type === 'attendance' || item.type === 'staff_attendance'
                  ? 'time-outline'
                  : item.type === 'ticket'
                    ? 'ticket-outline'
                    : item.type === 'chat'
                      ? 'chatbubble-outline'
                      : 'notifications-outline'
              }
              size={24}
              color={isUnread ? '#F05023' : '#757575'}
            />
          </View>

          {/* Content */}
          <View className="flex-1">
            <View className="mb-2 flex-row items-center justify-between">
              <Text
                className={`flex-1 text-sm ${
                  isUnread ? 'font-bold text-[#F05023]' : 'text-gray-700'
                }`}
                numberOfLines={1}>
                {title}
              </Text>
              {isUnread && <View className="ml-2 h-2 w-2 rounded-full bg-orange-500" />}
            </View>

            <Text className="mb-2 text-sm text-[#757575]" numberOfLines={2}>
              {message}
            </Text>

            <View className="flex-row items-center gap-2">
              <Ionicons name="time-outline" size={12} color="#999" />
              <Text className="text-xs text-gray-500">{formatTime(item)}</Text>

              {item.student_name && (
                <>
                  <View className="h-1 w-1 rounded-full bg-gray-400" />
                  <Text className="text-xs text-gray-500">{item.student_name}</Text>
                </>
              )}
            </View>
          </View>

          {/* Delete button */}
          <TouchableOpacity
            onPress={() => {
              Alert.alert(t('notifications.delete_title'), t('notifications.delete_confirm'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('common.delete'),
                  onPress: () => {
                    const itemId = getNotificationId(item);
                    if (itemId) deleteNotification(itemId);
                  },
                  style: 'destructive',
                },
              ]);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="p-2">
            <Ionicons name="trash-outline" size={20} color="#FF5733" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Footer loading indicator
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View className="py-4">
        <ActivityIndicator size="small" color="#0A2240" />
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white px-4 py-3">
        <View className="relative mb-2 flex-row items-center justify-center">
          {/* Back button - absolute positioned on the left */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="absolute left-0 p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#0A2240" />
          </TouchableOpacity>

          {/* Title - centered */}
          <Text className="font-bold text-2xl text-gray-800">{t('notifications.title')}</Text>

          {/* Mark all as read button - absolute positioned on the right */}
          {pagination.unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              className="absolute right-0 rounded-lg bg-[#002855] px-3 py-1.5">
              <Text className="font-medium text-sm text-white">
                {t('notifications.mark_as_read')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0A2240" />
        </View>
      ) : notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center p-4">
          <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
          <Text className="mt-4 text-center text-gray-500">
            {t('notifications.no_notifications')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item, index) => getNotificationId(item) || `notification-${index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#0A2240']}
              tintColor="#0A2240"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
    </SafeAreaView>
  );
};

export default NotificationsScreen;
