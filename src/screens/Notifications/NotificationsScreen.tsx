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
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../../hooks/useLanguage';
import { API_BASE_URL } from '../../config/constants';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import axios from 'axios';

interface Notification {
  _id: string;
  title: string;
  body: string;
  data: any;
  read: boolean;
  createdAt: string;
  type: string;
}

interface Pagination {
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  pages: number;
}

const NotificationsScreen = () => {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
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

  // Cài đặt thông báo đẩy khi component mount
  useEffect(() => {
    setupPushNotifications();
    fetchNotifications();

    // Đăng ký lắng nghe sự kiện khi nhận thông báo mới
    const subscription = Notifications.addNotificationReceivedListener(() => {
      fetchNotifications();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Đăng ký nhận thông báo
  const setupPushNotifications = async () => {
    // Kiểm tra xem thiết bị có phải là thiết bị thật không
    if (!Device.isDevice) {
      Alert.alert(t('notifications.title'), t('notifications.simulator_not_supported'));
      return;
    }

    // Kiểm tra quyền thông báo
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Nếu chưa được cấp quyền, yêu cầu quyền
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Nếu không được cấp quyền, thông báo cho người dùng
    if (finalStatus !== 'granted') {
      Alert.alert(t('notifications.title'), t('notifications.permission_required'));
      return;
    }

    // Thiết lập kênh thông báo cho Android
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Mặc định',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    try {
      // Lấy projectId từ Constants
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId;

      if (!projectId) {
        console.error('Không tìm thấy projectId trong app.json');
        return;
      }

      // Lấy token thiết bị
      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      console.log('Push token:', token.data);

      // Lưu token vào AsyncStorage để sử dụng sau này
      await AsyncStorage.setItem('pushToken', token.data);

      // Gửi token lên server
      registerDeviceToken(token.data);
    } catch (error) {
      console.error('Lỗi khi thiết lập thông báo đẩy:', error);
    }
  };

  // Đăng ký token thiết bị với server
  const registerDeviceToken = async (token: string) => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');

      if (!authToken) {
        console.log('Người dùng chưa đăng nhập');
        return;
      }

      // Debug: Decode JWT để thấy user info
      try {
        const base64Url = authToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join('')
        );
        const decoded = JSON.parse(jsonPayload);
        console.log('🔍 Mobile App JWT decoded:', {
          userId: decoded.userId || decoded.name,
          employeeId: decoded.employee_id || decoded.employeeId,
          fullname: decoded.fullname || decoded.full_name,
        });
      } catch (jwtError) {
        console.warn('Could not decode JWT:', jwtError);
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/notification/register-device`,
        { deviceToken: token },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      console.log('✅ Push token registered successfully:', response.data);
    } catch (error) {
      console.error('Lỗi đăng ký token thiết bị:', error);
    }
  };

  // Lấy danh sách thông báo từ server
  const fetchNotifications = useCallback(
    async (page = 1) => {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const authToken = await AsyncStorage.getItem('authToken');

        if (!authToken) {
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        const response = await axios.get(
          `${API_BASE_URL}/api/notification?page=${page}&limit=${pagination.limit}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (response.data.success) {
          if (page === 1) {
            setNotifications(response.data.notifications);
          } else {
            setNotifications((prev) => [...prev, ...response.data.notifications]);
          }
          setPagination(response.data.pagination);
        }
      } catch (error) {
        console.error('Lỗi khi lấy thông báo:', error);
        Alert.alert(t('common.error'), t('notifications.notification_error'));
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [pagination.limit]
  );

  // Tải thêm thông báo khi cuộn đến cuối danh sách
  const handleLoadMore = () => {
    if (loadingMore) return;
    if (pagination.page < pagination.pages) {
      fetchNotifications(pagination.page + 1);
    }
  };

  // Làm mới danh sách thông báo
  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications(1);
  };

  // Xử lý khi người dùng nhấn vào thông báo
  const handleNotificationPress = async (notification: Notification) => {
    try {
      // Đánh dấu thông báo đã đọc nếu chưa đọc
      if (!notification.read) {
        const authToken = await AsyncStorage.getItem('authToken');

        if (!authToken) return;

        // Cập nhật trạng thái đã đọc trên giao diện
        setNotifications((prevNotifications) =>
          prevNotifications.map((item) =>
            item._id === notification._id ? { ...item, read: true } : item
          )
        );

        // Cập nhật trạng thái đã đọc trên server
        await axios.put(
          `${API_BASE_URL}/api/notification/${notification._id}/read`,
          {},
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        // Cập nhật số lượng chưa đọc
        setPagination((prev) => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
        }));
      }

      // Xử lý chuyển hướng dựa vào loại thông báo
      if (notification.data) {
        if (notification.data.type === 'new_ticket' || notification.data.type === 'ticket_update') {
          // Chuyển đến màn hình chi tiết ticket
          if (notification.data.ticketId) {
            // @ts-ignore - Bỏ qua lỗi TypeScript nếu có
            navigation.navigate('TicketDetail', { ticketId: notification.data.ticketId });
          }
        }
      }
    } catch (error) {
      console.error('Lỗi khi xử lý thông báo:', error);
    }
  };

  // Đánh dấu tất cả thông báo đã đọc
  const markAllAsRead = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');

      if (!authToken) return;

      await axios.put(
        `${API_BASE_URL}/api/notification/mark-all-read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      // Cập nhật trạng thái đã đọc trên giao diện
      setNotifications((prevNotifications) =>
        prevNotifications.map((item) => ({ ...item, read: true }))
      );

      // Cập nhật số lượng chưa đọc
      setPagination((prev) => ({
        ...prev,
        unreadCount: 0,
      }));

      Alert.alert('Thông báo', 'Đã đánh dấu tất cả thông báo là đã đọc');
    } catch (error) {
      console.error('Lỗi khi đánh dấu đã đọc tất cả thông báo:', error);
      Alert.alert('Lỗi', 'Không thể đánh dấu đã đọc. Vui lòng thử lại sau.');
    }
  };

  // Xóa tất cả thông báo
  const clearAllNotifications = () => {
    Alert.alert('Xóa thông báo', 'Bạn có chắc chắn muốn xóa tất cả thông báo?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        onPress: async () => {
          try {
            const authToken = await AsyncStorage.getItem('authToken');

            if (!authToken) return;

            await axios.delete(`${API_BASE_URL}/api/notification`, {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            });

            setNotifications([]);
            setPagination((prev) => ({
              ...prev,
              total: 0,
              unreadCount: 0,
            }));

            Alert.alert('Thông báo', 'Đã xóa tất cả thông báo');
          } catch (error) {
            console.error('Lỗi khi xóa tất cả thông báo:', error);
            Alert.alert('Lỗi', 'Không thể xóa thông báo. Vui lòng thử lại sau.');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  // Xóa một thông báo
  const deleteNotification = async (notificationId: string) => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');

      if (!authToken) return;

      await axios.delete(`${API_BASE_URL}/api/notification/${notificationId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // Cập nhật danh sách thông báo trên giao diện
      const deletedNotification = notifications.find((n) => n._id === notificationId);
      setNotifications((prevNotifications) =>
        prevNotifications.filter((item) => item._id !== notificationId)
      );

      // Cập nhật số lượng chưa đọc nếu thông báo bị xóa chưa được đọc
      if (deletedNotification && !deletedNotification.read) {
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
    } catch (error) {
      console.error('Lỗi khi xóa thông báo:', error);
      Alert.alert('Lỗi', 'Không thể xóa thông báo. Vui lòng thử lại sau.');
    }
  };

  // Định dạng thời gian
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins} phút trước`;
    } else if (diffHours < 24) {
      return `${diffHours} giờ trước`;
    } else {
      return `${diffDays} ngày trước`;
    }
  };

  // Hiển thị từng thông báo
  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      className={`border-b border-gray-200 p-4 ${!item.read ? 'bg-blue-50' : ''}`}
      onPress={() => handleNotificationPress(item)}>
      <View className="flex-row justify-between">
        <View className="mr-2 flex-1">
          <Text className={`text-base ${!item.read ? 'font-bold' : ''}`}>{item.title}</Text>
          <Text className="mt-1 text-gray-600">{item.body}</Text>
          <Text className="mt-2 text-xs text-gray-400">{formatTime(item.createdAt)}</Text>
        </View>
        <View className="flex-row items-center">
          {!item.read && <View className="mr-2 h-3 w-3 rounded-full bg-blue-500" />}
          <TouchableOpacity
            onPress={() => {
              Alert.alert('Xóa thông báo', 'Bạn có chắc chắn muốn xóa thông báo này?', [
                { text: 'Hủy', style: 'cancel' },
                {
                  text: 'Xóa',
                  onPress: () => deleteNotification(item._id),
                  style: 'destructive',
                },
              ]);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={20} color="#FF5733" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Hiển thị chân danh sách (loading thêm)
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View className="flex-row items-center justify-center py-4">
        <ActivityIndicator size="small" color="#0A2240" />
        <Text className="ml-2 text-gray-500">{t('notifications.loading_notifications')}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between border-b border-gray-200 p-4">
        <Text className="font-bold text-2xl text-gray-800">{t('notifications.title')}</Text>
        <View className="flex-row">
          {pagination.unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} className="mr-4">
              <Text className="text-blue-600">{t('notifications.mark_as_read')}</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={clearAllNotifications}>
              <Text className="text-red-600">{t('common.delete')} tất cả</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {pagination.unreadCount > 0 && (
        <View className="border-b border-blue-200 bg-blue-50 p-2">
          <Text className="text-center text-blue-700">
            Bạn có {pagination.unreadCount} thông báo chưa đọc
          </Text>
        </View>
      )}

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
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#0A2240']}
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
