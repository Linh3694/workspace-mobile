import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G, Path, Rect, Defs, ClipPath } from 'react-native-svg';
import { TouchableOpacity } from '../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { notificationCenterService } from '../../services/notificationCenterService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROUTES } from '../../constants/routes';

// Custom Mark As Read Icon component (giống parent-portal)
const MarkAsReadIcon = ({ size = 16, color = '#002855' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <G clipPath="url(#clip0_604_2285)">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.58333 8C1.58333 4.45633 4.45633 1.58333 8 1.58333C8.14733 1.58333 8.29344 1.58822 8.43833 1.598C8.52679 1.60594 8.61593 1.59613 8.70054 1.56914C8.78515 1.54215 8.86351 1.49853 8.93103 1.44084C8.99855 1.38315 9.05386 1.31254 9.09371 1.23318C9.13356 1.15382 9.15716 1.06729 9.16311 0.978682C9.16906 0.890073 9.15725 0.801168 9.12837 0.717187C9.09949 0.633207 9.05412 0.555844 8.99492 0.48964C8.93573 0.423437 8.8639 0.369727 8.78366 0.331666C8.70342 0.293605 8.61639 0.271959 8.52767 0.268C8.35202 0.256196 8.17604 0.250193 8 0.25C3.72 0.25 0.25 3.72 0.25 8C0.25 9.28833 0.565 10.5047 1.12233 11.575C0.841333 12.348 0.581333 13.2197 0.405333 14.095C0.223333 14.9997 1.03133 15.7673 1.92 15.5593C2.74967 15.365 3.58667 15.1033 4.33967 14.8327C5.46511 15.4365 6.72279 15.7517 8 15.75C12.28 15.75 15.75 12.28 15.75 8C15.75 7.82267 15.7441 7.64678 15.7323 7.47233C15.7267 7.38483 15.7038 7.29931 15.665 7.22066C15.6263 7.142 15.5724 7.07177 15.5064 7.01398C15.4405 6.9562 15.3638 6.91198 15.2807 6.88388C15.1977 6.85578 15.1099 6.84434 15.0224 6.85021C14.9349 6.85609 14.8494 6.87916 14.7709 6.91812C14.6923 6.95707 14.6222 7.01114 14.5646 7.07723C14.507 7.14332 14.4629 7.22012 14.435 7.30325C14.4071 7.38638 14.3959 7.47419 14.402 7.56167C14.4118 7.70656 14.4167 7.85267 14.4167 8C14.4167 11.5437 11.544 14.4167 8 14.4167C6.85272 14.4187 5.7261 14.1115 4.73867 13.5273C4.65311 13.4767 4.55731 13.4458 4.45828 13.437C4.35925 13.4282 4.2595 13.4416 4.16633 13.4763C3.41533 13.7563 2.56933 14.0303 1.73833 14.232C1.92 13.372 2.18967 12.5093 2.476 11.7607C2.5113 11.6683 2.5256 11.5692 2.51787 11.4706C2.51015 11.3721 2.48059 11.2764 2.43133 11.1907C1.87377 10.2199 1.58132 9.11952 1.58333 8ZM9.16667 3.66667C9.16667 2.82681 9.5003 2.02136 10.0942 1.4275C10.688 0.83363 11.4935 0.5 12.3333 0.5C13.1732 0.5 13.9786 0.83363 14.5725 1.4275C15.1664 2.02136 15.5 2.82681 15.5 3.66667C15.5 4.50652 15.1664 5.31197 14.5725 5.90584C13.9786 6.4997 13.1732 6.83333 12.3333 6.83333C11.4935 6.83333 10.688 6.4997 10.0942 5.90584C9.5003 5.31197 9.16667 4.50652 9.16667 3.66667Z"
        fill={color}
      />
    </G>
    <Defs>
      <ClipPath id="clip0_604_2285">
        <Rect width="16" height="16" fill="white" />
      </ClipPath>
    </Defs>
  </Svg>
);

interface NotificationData {
  _id?: string;
  id?: string;
  title: string | { vi: string; en: string };
  message: string | { vi: string; en: string };
  data: any;
  read: boolean;
  createdAt: string;
  eventTimestamp?: string;
  // Fields cho grouped notifications
  isGrouped?: boolean;
  groupedCount?: number;
  groupedNotifications?: NotificationData[];
  actorName?: string; // Tên người đầu tiên trong nhóm
}

interface PaginationState {
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Hàm trích xuất tên actor từ notification message
 * Ví dụ: "Nguyễn Văn A vừa bày tỏ cảm xúc..." -> "Nguyễn Văn A"
 */
const extractActorName = (notification: NotificationData): string => {
  const message =
    typeof notification.message === 'string'
      ? notification.message
      : notification.message.vi || notification.message.en;

  // Extract name from patterns like "Nguyễn Văn A vừa..."
  const match = message.match(/^([^vừa]+)\s+vừa/);
  if (match) {
    return match[1].trim();
  }

  return 'Ai đó';
};

/**
 * Hàm gộp notifications Wislife theo kiểu Facebook
 * 
 * Logic gộp:
 * - Các notifications về cùng 1 post/comment và cùng action type sẽ được gộp lại
 * - Hiển thị tên người đầu tiên + số người khác
 * - Ví dụ: "Nguyễn Văn A và 2 người khác vừa bày tỏ cảm xúc về bài viết của bạn"
 * 
 * Các notification types được gộp:
 * - wislife_post_reaction: Reaction về post
 * - wislife_post_comment: Comment về post
 * - wislife_comment_reply: Reply về comment
 * - wislife_comment_reaction: Reaction về comment
 * 
 * Trạng thái read:
 * - Nếu TẤT CẢ notifications trong nhóm đã đọc -> nhóm được đánh dấu đã đọc
 * - Nếu CÓ ÍT NHẤT 1 chưa đọc -> nhóm được đánh dấu chưa đọc
 */
const groupWislifeNotifications = (notifications: NotificationData[]): NotificationData[] => {
  const wislifeTypes = [
    'wislife_post_reaction',
    'wislife_post_comment',
    'wislife_comment_reply',
    'wislife_comment_reaction',
  ];

  const grouped: { [key: string]: NotificationData[] } = {};
  const nonWislife: NotificationData[] = [];

  // Phân loại notifications
  notifications.forEach((notif) => {
    const type = notif.data?.type;
    if (wislifeTypes.includes(type)) {
      // Tạo key để group: type + postId + commentId (nếu có)
      const postId = notif.data?.postId || '';
      const commentId = notif.data?.commentId || '';
      const key = `${type}_${postId}_${commentId}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(notif);
    } else {
      nonWislife.push(notif);
    }
  });

  // Tạo grouped notifications
  const groupedNotifications: NotificationData[] = Object.values(grouped).map((group) => {
    // Sắp xếp group theo thời gian (mới nhất trước)
    const sortedGroup = group.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    if (sortedGroup.length === 1) {
      // Chỉ có 1 notification, không cần gộp
      return sortedGroup[0];
    }

    // Có nhiều notifications, gộp lại
    const first = sortedGroup[0];
    const type = first.data?.type;
    const actorName = extractActorName(first);
    const othersCount = sortedGroup.length - 1;

    // Tạo message mới
    let newMessage = '';
    if (type === 'wislife_post_reaction') {
      if (othersCount === 1) {
        newMessage = `${actorName} và 1 người khác vừa bày tỏ cảm xúc về bài viết của bạn`;
      } else {
        newMessage = `${actorName} và ${othersCount} người khác vừa bày tỏ cảm xúc về bài viết của bạn`;
      }
    } else if (type === 'wislife_post_comment') {
      if (othersCount === 1) {
        newMessage = `${actorName} và 1 người khác vừa bình luận về bài viết của bạn`;
      } else {
        newMessage = `${actorName} và ${othersCount} người khác vừa bình luận về bài viết của bạn`;
      }
    } else if (type === 'wislife_comment_reply') {
      if (othersCount === 1) {
        newMessage = `${actorName} và 1 người khác vừa trả lời bình luận của bạn`;
      } else {
        newMessage = `${actorName} và ${othersCount} người khác vừa trả lời bình luận của bạn`;
      }
    } else if (type === 'wislife_comment_reaction') {
      if (othersCount === 1) {
        newMessage = `${actorName} và 1 người khác vừa bày tỏ cảm xúc về bình luận của bạn`;
      } else {
        newMessage = `${actorName} và ${othersCount} người khác vừa bày tỏ cảm xúc về bình luận của bạn`;
      }
    }

    // Tính trạng thái read: nếu TẤT CẢ đã đọc thì mới đánh dấu là đã đọc
    const allRead = sortedGroup.every((n) => n.read);

    return {
      ...first,
      message: newMessage,
      isGrouped: true,
      groupedCount: sortedGroup.length,
      groupedNotifications: sortedGroup,
      actorName,
      read: allRead,
      // Sử dụng thời gian của notification mới nhất (đầu tiên sau khi sort)
      createdAt: first.createdAt,
    };
  });

  // Kết hợp và sắp xếp lại theo thời gian
  const result = [...groupedNotifications, ...nonWislife].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  return result;
};

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
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

        const response = await notificationCenterService.getNotifications({
          limit: pagination.limit,
          offset: (page - 1) * pagination.limit,
          include_read: true,
        });

        if (response.success) {
          const rawNotifications = response.data.notifications || [];

          // Map backend status (string) to frontend read (boolean)
          const notificationsData = rawNotifications.map((notif: any) => ({
            ...notif,
            read: notif.status === 'read' || notif.read === true,
            createdAt: notif.created_at || notif.createdAt,
          }));

          if (page === 1) {
            // Trang đầu tiên: gộp notifications
            const groupedNotifications = groupWislifeNotifications(notificationsData);
            setNotifications(groupedNotifications);
          } else {
            // Load more: thêm notifications mới vào và gộp toàn bộ để consistency
            setNotifications((prev) => {
              // Unflatten các grouped notifications trước đó để có danh sách đầy đủ
              const prevUnflattened: NotificationData[] = [];
              prev.forEach((notif) => {
                if (notif.isGrouped && notif.groupedNotifications) {
                  prevUnflattened.push(...notif.groupedNotifications);
                } else {
                  prevUnflattened.push(notif);
                }
              });
              
              // Kết hợp với notifications mới
              const combined = [...prevUnflattened, ...notificationsData];
              
              // Gộp lại toàn bộ
              return groupWislifeNotifications(combined);
            });
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

  // Mark grouped notification as read (đánh dấu tất cả notifications trong nhóm)
  const markGroupedAsRead = useCallback(
    async (groupedNotification: NotificationData) => {
      if (!groupedNotification.isGrouped || !groupedNotification.groupedNotifications) {
        // Nếu không phải grouped notification, chỉ mark một cái
        const notificationId = groupedNotification._id || groupedNotification.id;
        if (notificationId) {
          await markAsRead(notificationId);
        }
        return;
      }

      try {
        // Mark tất cả notifications trong nhóm
        const markPromises = groupedNotification.groupedNotifications.map((notif) => {
          const notificationId = notif._id || notif.id;
          if (notificationId && !notif.read) {
            return notificationCenterService.markAsRead(notificationId);
          }
          return Promise.resolve({ success: true });
        });

        await Promise.all(markPromises);

        // Update UI
        setNotifications((prev) =>
          prev.map((item) => {
            if (item.isGrouped && item._id === groupedNotification._id) {
              return {
                ...item,
                read: true,
                groupedNotifications: item.groupedNotifications?.map((n) => ({ ...n, read: true })),
              };
            }
            return item;
          })
        );

        // Update unread count
        const unreadCount = groupedNotification.groupedNotifications.filter((n) => !n.read).length;
        setPagination((prev) => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - unreadCount),
        }));
      } catch (error) {
        console.error('Error marking grouped notification as read:', error);
      }
    },
    [markAsRead]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      setMarkingAllRead(true);
      const response = await notificationCenterService.markAllAsRead();
      if (response.success) {
        setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
        setPagination((prev) => ({
          ...prev,
          unreadCount: 0,
        }));
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      Alert.alert('Lỗi', 'Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại.');
    } finally {
      setMarkingAllRead(false);
    }
  }, []);

  // Handle notification press - navigate to appropriate screen based on notification type
  const handleNotificationPress = useCallback(
    async (notification: NotificationData) => {
      // Mark as read if not already read
      if (!notification.read) {
        await markGroupedAsRead(notification);
      }

      // Handle navigation based on notification type
      const data = notification.data;

      // Helper function để navigate đến ticket detail dựa trên role
      const navigateToTicketDetail = async (ticketId: string) => {
        try {
          // Kiểm tra role để navigate đến đúng màn hình
          const storedRolesStr = await AsyncStorage.getItem('userRoles');
          const storedRoles: string[] = storedRolesStr ? JSON.parse(storedRolesStr) : [];
          const hasMobileIT = storedRoles.includes('Mobile IT');

          if (hasMobileIT) {
            // Admin -> TicketAdminDetail
            (navigation as any).navigate(ROUTES.SCREENS.TICKET_ADMIN_DETAIL, { ticketId });
          } else {
            // Guest -> TicketGuestDetail
            (navigation as any).navigate(ROUTES.SCREENS.TICKET_GUEST_DETAIL, { ticketId });
          }
        } catch (error) {
          console.error('Error navigating to ticket detail:', error);
          // Fallback to guest detail
          (navigation as any).navigate(ROUTES.SCREENS.TICKET_GUEST_DETAIL, { ticketId });
        }
      };

      // Helper function để navigate đến feedback detail
      const navigateToFeedbackDetail = (feedbackId: string) => {
        (navigation as any).navigate(ROUTES.SCREENS.FEEDBACK_DETAIL, { feedbackId });
      };

      // Helper function để navigate đến leave requests detail
      const navigateToLeaveRequests = (params: any) => {
        const classId = params?.class_id || params?.classId;
        const leaveRequestId = params?.leave_request_id || params?.leaveRequestId;

        if (classId) {
          (navigation as any).navigate(ROUTES.SCREENS.LEAVE_REQUESTS_DETAIL, {
            classId,
            leaveRequestId,
            fromNotification: true,
          });
        } else {
          // Fallback to class list if no classId
          (navigation as any).navigate(ROUTES.SCREENS.LEAVE_REQUESTS);
        }
      };

      // Helper function để navigate đến attendance home
      const navigateToAttendanceHome = (params: any) => {
        (navigation as any).navigate(ROUTES.SCREENS.ATTENDANCE_HOME, {
          initialTab: params?.tab || 'GVCN',
        });
      };

      // === TICKET NOTIFICATIONS ===
      const ticketTypes = ['new_ticket', 'ticket_update', 'ticket_created', 'ticket_updated'];
      const ticketActions = [
        'ticket_status_changed',
        'ticket_assigned',
        'ticket_processing',
        'ticket_waiting',
        'ticket_done',
        'ticket_closed',
        'ticket_cancelled',
        'new_ticket_admin',
        'user_reply',
        'ticket_cancelled_admin',
        'completion_confirmed',
        'ticket_feedback_received',
      ];

      if (ticketTypes.includes(data?.type) || ticketActions.includes(data?.action)) {
        if (data?.ticketId) {
          await navigateToTicketDetail(data.ticketId);
          return;
        }
      }

      // === FEEDBACK NOTIFICATIONS ===
      const feedbackTypes = [
        'feedback_created',
        'feedback_new',
        'feedback_reply',
        'feedback_updated',
      ];
      const feedbackActions = [
        'new_feedback',
        'feedback_created',
        'feedback_reply',
        'guardian_reply',
        'feedback_assigned',
      ];

      if (feedbackTypes.includes(data?.type) || feedbackActions.includes(data?.action)) {
        if (data?.feedbackId) {
          navigateToFeedbackDetail(data.feedbackId);
          return;
        }
      }

      // === LEAVE REQUEST NOTIFICATIONS ===
      const leaveTypes = ['leave_request', 'leave'];

      if (leaveTypes.includes(data?.type)) {
        navigateToLeaveRequests(data);
        return;
      }

      // === ATTENDANCE NOTIFICATIONS ===
      if (data?.type === 'attendance_reminder') {
        navigateToAttendanceHome(data);
        return;
      }

      // attendance, staff_attendance: chỉ đánh dấu đã đọc, không điều hướng
      if (data?.type === 'attendance' || data?.type === 'staff_attendance') {
        return;
      }

      // === CHAT NOTIFICATIONS ===
      if (data?.type === 'chat_message' && data?.chatId) {
        // Navigate to Main with Chat tab
        (navigation as any).navigate(ROUTES.SCREENS.MAIN, {
          screen: 'Chat',
          params: { chatId: data.chatId },
        });
        return;
      }

      // === WISLIFE NOTIFICATIONS ===
      const wislifeTypes = [
        'wislife_new_post',
        'wislife_post_reaction',
        'wislife_post_comment',
        'wislife_comment_reply',
        'wislife_comment_reaction',
        'wislife_mention',
      ];

      if (wislifeTypes.includes(data?.type)) {
        if (data?.postId) {
          // Navigate to Main with Wislife tab
          (navigation as any).navigate(ROUTES.SCREENS.MAIN, {
            screen: 'Wislife',
            params: { postId: data.postId, commentId: data.commentId },
          });
          return;
        }
      }

      // === DEFAULT: Không xử lý đặc biệt ===
      console.log(
        '📝 Unhandled notification type in NotificationsScreen:',
        data?.type,
        data?.action
      );
    },
    [navigation, markGroupedAsRead]
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

  // Refresh notifications khi screen focus
  useFocusEffect(
    useCallback(() => {
      fetchNotifications(1);
    }, [fetchNotifications])
  );

  // Render notification item
  const renderNotification = ({ item }: { item: NotificationData }) => {
    const title = typeof item.title === 'string' ? item.title : item.title.vi || item.title.en;
    const message =
      typeof item.message === 'string' ? item.message : item.message.vi || item.message.en;

    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        className={`mx-[5%] my-1 rounded-lg border border-gray-100 p-4 ${!item.read ? 'bg-red-50' : 'bg-white'}`}>
        <View className="flex-row items-start">
          {!item.read && <View className="mr-3 mt-2 h-2 w-2 rounded-full bg-red-500" />}
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text
                className={`flex-1 text-base font-semibold ${!item.read ? 'text-red-900' : 'text-gray-900'}`}>
                {title}
              </Text>
              {item.isGrouped && item.groupedCount && item.groupedCount > 1 && (
                <View className="ml-2 rounded-full bg-blue-100 px-2 py-1">
                  <Text className="text-xs font-semibold text-blue-600">{item.groupedCount}</Text>
                </View>
              )}
            </View>
            <Text className={`mt-1 text-sm ${!item.read ? 'text-red-700' : 'text-gray-600'}`}>
              {message}
            </Text>
            <View className="mt-2 flex-row items-center">
              <Text className="text-xs text-gray-400">
                {(() => {
                  try {
                    const dateString = item.createdAt || item.eventTimestamp;
                    if (!dateString) {
                      console.warn(
                        'Missing createdAt and eventTimestamp for notification:',
                        item._id || item.id
                      );
                      return 'Không xác định';
                    }
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                      console.warn(
                        'Invalid date format:',
                        dateString,
                        'for notification:',
                        item._id || item.id
                      );
                      return 'Ngày không hợp lệ';
                    }
                    return formatDistanceToNow(date, {
                      addSuffix: true,
                      locale: vi,
                    });
                  } catch (error) {
                    console.error(
                      'Date formatting error for notification:',
                      item._id || item.id,
                      'createdAt:',
                      item.createdAt,
                      'eventTimestamp:',
                      item.eventTimestamp,
                      'error:',
                      error
                    );
                    return 'Ngày không hợp lệ';
                  }
                })()}
              </Text>
            </View>
          </View>
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

  // Android cần thêm top padding vì SafeAreaView không xử lý đúng status bar

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
    <SafeAreaView className="flex-1 bg-white pt-6">
      <View className="mb-5 flex-row items-center justify-center px-5">
        <Text className="text-center text-2xl text-[#0A2240]" style={{ fontFamily: 'Mulish-Bold' }}>
          Thông báo
        </Text>
      </View>

      {/* Nút đánh dấu tất cả đã đọc - chỉ hiển thị khi có thông báo chưa đọc */}
      {pagination.unreadCount > 0 && (
        <View className="mx-auto mb-3 mt-4 flex items-center justify-center px-5">
          <TouchableOpacity
            onPress={markAllAsRead}
            disabled={markingAllRead}
            className="flex-row items-center self-start rounded-lg border border-[#002855] px-3 py-2">
            {markingAllRead ? (
              <ActivityIndicator size="small" color="#002855" />
            ) : (
              <MarkAsReadIcon size={16} color="#002855" />
            )}
            <Text className="ml-2 text-sm font-medium text-[#002855]">
              {markingAllRead ? 'Đang xử lý...' : 'Đánh dấu tất cả đã đọc'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item, index) => {
          const key = item._id || item.id;
          return key ? `${key}-${index}` : `notification-${index}`;
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
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
