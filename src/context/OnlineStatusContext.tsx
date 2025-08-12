import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { io } from 'socket.io-client';
// @ts-ignore
import { Platform, AppState, AppStateStatus } from 'react-native';
import { API_BASE_URL, CHAT_SOCKET_URL, CHAT_SOCKET_PATH } from '../config/constants';

// Sử dụng API_BASE_URL từ constants để đảm bảo nhất quán giữa các phần của ứng dụng

// Map để lưu trạng thái online và last seen
interface OnlineStatusMap {
  [userId: string]: {
    isOnline: boolean;
    lastSeen?: Date;
  };
}

interface OnlineStatusContextType {
  onlineUsers: OnlineStatusMap;
  currentUserId: string | null;
  isUserOnline: (userId: string) => boolean;
  getLastSeen: (userId: string) => Date | undefined;
  getFormattedLastSeen: (userId: string) => string;
  reconnectSocket: () => Promise<void>;
  isSocketConnected: boolean;
}

// Initialize the context with default values
export const OnlineStatusContext = createContext<OnlineStatusContextType>({
  onlineUsers: {},
  currentUserId: null,
  isUserOnline: () => false,
  getLastSeen: () => undefined,
  getFormattedLastSeen: () => 'Offline',
  reconnectSocket: async () => {},
  isSocketConnected: false,
});

export const useOnlineStatus = () => useContext(OnlineStatusContext);

// Helper function để tạo Date object an toàn
const createSafeDate = (value: any): Date | null => {
  try {
    if (!value) return null;

    // Nếu đã là Date object
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    // Nếu là string hoặc number
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.warn('Invalid date value:', value, error);
    return null;
  }
};

// Hàm để lấy trạng thái online từ Redis cache
const fetchOnlineStatusFromCache = async (
  userId: string
): Promise<{ isOnline: boolean; lastSeen?: Date } | null> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${API_BASE_URL}/api/users/online-status/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    return {
      isOnline: data.isOnline,
      lastSeen: data.lastSeen ? createSafeDate(data.lastSeen) : undefined,
    };
  } catch (error) {
    console.error('Error fetching online status from cache:', error);
    return null;
  }
};

// Hàm để cập nhật trạng thái online vào Redis cache
const updateOnlineStatusToCache = async (
  userId: string,
  status: { isOnline: boolean; lastSeen?: Date }
): Promise<void> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    await fetch(`${API_BASE_URL}/api/users/online-status/${userId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isOnline: status.isOnline,
        lastSeen: status.lastSeen?.toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch (error) {
    console.error('Error updating online status to cache:', error);
  }
};

export const OnlineStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineStatusMap>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const socketRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);
  const cacheTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Thêm state để theo dõi trạng thái kết nối của socket
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const isInitialized = useRef(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  // Hàm lấy thời gian last seen dạng chuỗi thân thiện
  const getFormattedLastSeen = (userId: string): string => {
    const userStatus = onlineUsers[userId];

    if (!userStatus) return 'Offline';
    if (userStatus.isOnline) return 'Đang hoạt động';
    if (!userStatus.lastSeen) return 'Offline';

    const lastSeen = createSafeDate(userStatus.lastSeen);
    if (!lastSeen) return 'Offline';

    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Vừa truy cập';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hôm qua';

    return `${lastSeen.getDate()}/${lastSeen.getMonth() + 1}/${lastSeen.getFullYear()}`;
  };

  // Hàm để cập nhật trạng thái online với cache
  const updateOnlineStatus = async (
    userId: string,
    status: { isOnline: boolean; lastSeen?: Date }
  ) => {
    // Cập nhật state local
    setOnlineUsers((prev) => ({
      ...prev,
      [userId]: status,
    }));

    // Cập nhật cache
    await updateOnlineStatusToCache(userId, status);

    // Xóa timeout cũ nếu có
    if (cacheTimeoutRef.current[userId]) {
      clearTimeout(cacheTimeoutRef.current[userId]);
    }

    // Set timeout mới để cập nhật cache sau 30 giây
    cacheTimeoutRef.current[userId] = setTimeout(async () => {
      const currentStatus = await fetchOnlineStatusFromCache(userId);
      if (currentStatus) {
        setOnlineUsers((prev) => ({
          ...prev,
          [userId]: currentStatus,
        }));
      }
    }, 30000);
  };

  // Cleanup function cho socket
  const cleanupSocket = () => {
    if (socketRef.current) {
      try {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      } catch (error) {
        console.error('Error cleaning up socket:', error);
      }
      socketRef.current = null;
    }
    setIsSocketConnected(false);
  };

  // Hàm để reconnect socket với backoff
  const reconnectSocket = async () => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log('Max reconnect attempts reached. Will retry in 30 seconds.');
      reconnectTimeout.current = setTimeout(() => {
        reconnectAttempts.current = 0;
        reconnectSocket();
      }, 30000);
      return;
    }

    cleanupSocket();

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
    console.log(
      `Attempting reconnect ${reconnectAttempts.current + 1}/${maxReconnectAttempts} in ${delay}ms`
    );

    reconnectAttempts.current++;

    reconnectTimeout.current = setTimeout(async () => {
      await initializeSocket();
    }, delay);
  };

  // Tách riêng logic khởi tạo socket
  const initializeSocket = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.warn('No auth token found, skipping socket initialization');
        return;
      }

      const decoded: any = jwtDecode(token);
      const userId = decoded._id || decoded.id;
      if (!userId) {
        console.warn('No user ID found in token, skipping socket initialization');
        return;
      }

      setCurrentUserId(userId);

      // Đảm bảo chỉ có một socket instance
      cleanupSocket();

      console.log('Initializing socket connection to:', CHAT_SOCKET_URL, 'path:', CHAT_SOCKET_PATH);

      // Khởi tạo socket mới tới chat-service qua path riêng (không dùng SIS socket)
      socketRef.current = io(CHAT_SOCKET_URL, {
        path: CHAT_SOCKET_PATH,
        query: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: true, // Force new connection
        autoConnect: true,
      });

      // Theo dõi trạng thái kết nối
      socketRef.current.on('connect', () => {
        console.log('Socket connected successfully');
        setIsSocketConnected(true);
        reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection

        // Chỉ emit cần thiết khi kết nối, không spam
        try {
          // Delay các emit để tránh spam server
          setTimeout(() => {
            if (socketRef.current && socketRef.current.connected) {
              socketRef.current.emit('joinUserRoom', userId);
            }
          }, 500);

          setTimeout(() => {
            if (socketRef.current && socketRef.current.connected) {
              socketRef.current.emit('userOnline', { userId, chatId: 'global' });
            }
          }, 1000);

          setTimeout(() => {
            if (socketRef.current && socketRef.current.connected) {
              socketRef.current.emit('getUsersOnlineStatus');
            }
          }, 1500);
        } catch (error) {
          console.error('Error emitting initial events:', error);
        }
      });

      socketRef.current.on('connect_error', (error: any) => {
        console.error('Socket connection error:', error?.message || error);
        setIsSocketConnected(false);

        // Tự động thử lại sau một khoảng thời gian nếu đang trong trạng thái active
        if (appState.current === 'active' && reconnectAttempts.current < maxReconnectAttempts) {
          console.log('Will attempt to reconnect due to connection error');
          setTimeout(() => reconnectSocket(), 3000);
        }
      });

      socketRef.current.on('disconnect', (reason: string) => {
        console.log('Socket disconnected. Reason:', reason);
        setIsSocketConnected(false);

        // Tự động reconnect nếu là do lỗi mạng và app đang active
        if (
          (reason === 'io server disconnect' ||
            reason === 'transport close' ||
            reason === 'ping timeout' ||
            reason === 'transport error') &&
          appState.current === 'active' &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          console.log('Will attempt to reconnect due to disconnect');
          setTimeout(() => reconnectSocket(), 3000);
        }
      });

      // Error handling for socket
      socketRef.current.on('error', (error: any) => {
        console.error('Socket error:', error?.message || error);
      });

      // Lắng nghe sự kiện user online
      socketRef.current.on('userOnline', ({ userId }: { userId: string }) => {
        try {
          updateOnlineStatus(userId, {
            isOnline: true,
            lastSeen: new Date(),
          });
        } catch (error) {
          console.error('Error handling userOnline event:', error);
        }
      });

      // Lắng nghe sự kiện user offline
      socketRef.current.on('userOffline', ({ userId }: { userId: string }) => {
        try {
          updateOnlineStatus(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });
        } catch (error) {
          console.error('Error handling userOffline event:', error);
        }
      });

      // Lắng nghe danh sách user online hiện tại
      socketRef.current.on('onlineUsers', async (users: string[]) => {
        try {
          console.log('Received current online users:', users);

          // Lấy trạng thái từ cache cho tất cả users
          const updatedStatus: OnlineStatusMap = {};
          for (const id of users) {
            const cachedStatus = await fetchOnlineStatusFromCache(id);
            if (cachedStatus) {
              updatedStatus[id] = cachedStatus;
            } else {
              updatedStatus[id] = {
                isOnline: true,
                lastSeen: new Date(),
              };
            }
          }

          setOnlineUsers((prev) => {
            const newState = { ...prev };

            // Cập nhật trạng thái cho tất cả người dùng offline trước
            Object.keys(newState).forEach((id) => {
              if (!users.includes(id)) {
                newState[id] = {
                  ...newState[id],
                  isOnline: false,
                };
              }
            });

            // Sau đó cập nhật trạng thái online
            return { ...newState, ...updatedStatus };
          });
        } catch (error) {
          console.error('Error handling onlineUsers event:', error);
        }
      });

      // Lắng nghe thông tin last seen
      socketRef.current.on(
        'userLastSeen',
        ({ userId, lastSeen }: { userId: string; lastSeen: string }) => {
          try {
            const safeLastSeen = createSafeDate(lastSeen);
            updateOnlineStatus(userId, {
              isOnline: false,
              lastSeen: safeLastSeen || new Date(), // Fallback to current time if invalid
            });
          } catch (error) {
            console.error('Error handling userLastSeen event:', error);
            // Fallback với current time
            updateOnlineStatus(userId, {
              isOnline: false,
              lastSeen: new Date(),
            });
          }
        }
      );

      // Lắng nghe sự kiện userStatus
      socketRef.current.on(
        'userStatus',
        ({ userId, status }: { userId: string; status: string }) => {
          try {
            console.log(`User ${userId} status updated to ${status}`);
            updateOnlineStatus(userId, {
              isOnline: status === 'online',
              lastSeen: status === 'offline' ? new Date() : onlineUsers[userId]?.lastSeen,
            });
          } catch (error) {
            console.error('Error handling userStatus event:', error);
          }
        }
      );

      isInitialized.current = true;
    } catch (error) {
      console.error('Critical error setting up socket connection:', error);
      setIsSocketConnected(false);

      // Thử lại sau 5 giây nếu có lỗi nghiêm trọng
      if (appState.current === 'active' && reconnectAttempts.current < maxReconnectAttempts) {
        setTimeout(() => reconnectSocket(), 5000);
      }
    }
  };

  // Init socket và lắng nghe sự kiện
  useEffect(() => {
    let pingInterval: NodeJS.Timeout;
    let statusRefreshInterval: NodeJS.Timeout;
    let isUnmounted = false;

    const initializeAndSetupSocket = async () => {
      if (!isInitialized.current && !isUnmounted) {
        await initializeSocket();
      }

      if (isUnmounted) return;

      // Thiết lập ping để duy trì kết nối (giảm tần suất)
      pingInterval = setInterval(() => {
        if (isUnmounted) return;

        if (socketRef.current && socketRef.current.connected && currentUserId) {
          try {
            // Chỉ emit ping, không emit userOnline liên tục
            socketRef.current.emit('ping', { userId: currentUserId });
          } catch (error) {
            console.error('Error sending ping:', error);
          }
        } else if (
          appState.current === 'active' &&
          (!socketRef.current || !socketRef.current.connected)
        ) {
          // Thử reconnect nếu không connected và app đang active
          console.log('Ping check: Socket not connected, attempting reconnect');
          reconnectSocket();
        }
      }, 30000); // Tăng từ 15 giây lên 30 giây để giảm tải

      // Tự động kiểm tra lại trạng thái online (giảm tần suất)
      statusRefreshInterval = setInterval(() => {
        if (isUnmounted) return;

        if (socketRef.current && socketRef.current.connected) {
          try {
            socketRef.current.emit('getUsersOnlineStatus');
          } catch (error) {
            console.error('Error refreshing online status:', error);
          }
        }
      }, 60000); // Tăng từ 30 giây lên 60 giây
    };

    // Thiết lập sự kiện khi app chuyển vào background hoặc foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (isUnmounted) return;

      console.log('App state changed:', appState.current, '->', nextAppState);

      if (nextAppState === 'active' && appState.current.match(/inactive|background/)) {
        // App từ background về active
        console.log('App has come to the foreground!');
        if (!socketRef.current || !socketRef.current.connected) {
          console.log('Reconnecting socket due to app becoming active');
          reconnectSocket();
        } else if (socketRef.current && currentUserId) {
          try {
            // Chỉ emit userOnline một lần khi app active
            socketRef.current.emit('userOnline', { userId: currentUserId, chatId: 'global' });
            // Delay một chút trước khi emit getUsersOnlineStatus
            setTimeout(() => {
              if (socketRef.current && socketRef.current.connected && !isUnmounted) {
                socketRef.current.emit('getUsersOnlineStatus');
              }
            }, 1000);
          } catch (error) {
            console.error('Error emitting events on app active:', error);
          }
        }
      } else if (nextAppState.match(/inactive|background/) && appState.current === 'active') {
        // App từ active về background
        console.log('App has gone to the background!');
        if (socketRef.current && socketRef.current.connected && currentUserId) {
          try {
            socketRef.current.emit('userBackground', { userId: currentUserId });
          } catch (error) {
            console.error('Error emitting background event:', error);
          }
        }
      }

      appState.current = nextAppState;
    };

    // Đăng ký event listener cho app state
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Initialize socket
    initializeAndSetupSocket();

    return () => {
      console.log('Cleaning up OnlineStatusProvider');
      isUnmounted = true;

      // Cleanup socket
      cleanupSocket();

      // Clear intervals
      if (pingInterval) clearInterval(pingInterval);
      if (statusRefreshInterval) clearInterval(statusRefreshInterval);

      // Clear reconnect timeout
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      // Remove app state listener
      subscription.remove();

      // Clear tất cả các timeout cache
      Object.values(cacheTimeoutRef.current).forEach((timeout) => clearTimeout(timeout));
      cacheTimeoutRef.current = {};

      // Reset state
      isInitialized.current = false;
      reconnectAttempts.current = 0;
    };
  }, []); // Xóa currentUserId khỏi dependency để tránh re-run liên tục

  const isUserOnline = (userId: string): boolean => {
    return onlineUsers[userId]?.isOnline || false;
  };

  const getLastSeen = (userId: string): Date | undefined => {
    return onlineUsers[userId]?.lastSeen;
  };

  return (
    <OnlineStatusContext.Provider
      value={{
        onlineUsers,
        currentUserId,
        isUserOnline,
        getLastSeen,
        getFormattedLastSeen,
        reconnectSocket,
        isSocketConnected,
      }}>
      {children}
    </OnlineStatusContext.Provider>
  );
};
