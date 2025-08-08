import { useEffect, useRef, useCallback, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';

interface Message {
  _id: string;
  sender: {
    _id: string;
    fullname: string;
    avatarUrl?: string;
    email: string;
  };
  text: string;
  timestamp: string;
  type: 'text' | 'image';
  tempId?: string;
}

interface UseTicketSocketProps {
  ticketId: string;
  currentUserId: string;
  onNewMessage: (message: Message) => void;
  onTyping?: (userId: string, isTyping: boolean) => void;
  onUserStatus?: (userId: string, status: 'online' | 'offline') => void;
}

interface SocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

export const useTicketSocket = ({
  ticketId,
  currentUserId,
  onNewMessage,
  onTyping,
  onUserStatus,
}: UseTicketSocketProps) => {
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>();
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>();
  const [socketState, setSocketState] = useState<SocketState>({
    connected: false,
    connecting: false,
    error: null,
  });

  // Cleanup function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // Connect socket with retry logic
  const connect = useCallback(
    async (retryCount = 0) => {
      if (socketRef.current?.connected) {
        console.log('🔗 Socket already connected');
        return;
      }

      if (retryCount > 3) {
        console.error('❌ Max retry attempts reached');
        setSocketState((prev) => ({
          ...prev,
          connecting: false,
          error: 'Không thể kết nối tới máy chủ',
        }));
        return;
      }

      try {
        setSocketState((prev) => ({ ...prev, connecting: true, error: null }));

        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          throw new Error('Không có token xác thực');
        }

        console.log(`🔄 Connecting to socket (attempt ${retryCount + 1})`);

        const socket = io(BASE_URL, {
          query: { token },
          transports: ['websocket'],
          timeout: 10000,
          forceNew: retryCount > 0, // Force new connection on retry
        });

        // Connection events
        socket.on('connect', () => {
          console.log('🔗 Socket connected successfully');
          setSocketState({ connected: true, connecting: false, error: null });

          // Join ticket room
          socket.emit('joinTicketRoom', ticketId);

          // Setup ping interval
          pingIntervalRef.current = setInterval(() => {
            if (socket.connected) {
              socket.emit('ping');
            }
          }, 30000);
        });

        socket.on('connect_error', (error) => {
          console.error('🔥 Socket connection error:', error.message);
          setSocketState((prev) => ({
            ...prev,
            connecting: false,
            error: error.message,
          }));

          // Retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect(retryCount + 1);
          }, delay);
        });

        socket.on('disconnect', (reason) => {
          console.log('🔌 Socket disconnected:', reason);
          setSocketState((prev) => ({ ...prev, connected: false }));

          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
          }

          // Auto-reconnect for unexpected disconnections
          if (reason === 'io server disconnect' || reason === 'transport close') {
            reconnectTimeoutRef.current = setTimeout(() => {
              connect(0);
            }, 2000);
          }
        });

        // Message events
        socket.on('newMessage', (message: Message) => {
          console.log('📨 New message received:', message._id);
          onNewMessage(message);
        });

        // Typing events
        socket.on('userTyping', ({ userId, ticketId: eventTicketId }) => {
          if (eventTicketId === ticketId && userId !== currentUserId && onTyping) {
            onTyping(userId, true);
          }
        });

        socket.on('userStopTyping', ({ userId, ticketId: eventTicketId }) => {
          if (eventTicketId === ticketId && userId !== currentUserId && onTyping) {
            onTyping(userId, false);
          }
        });

        // User status events
        socket.on('userStatus', ({ userId, status }) => {
          if (userId !== currentUserId && onUserStatus) {
            onUserStatus(userId, status);
          }
        });

        // Auth error
        socket.on('authError', ({ message }) => {
          console.error('🔐 Auth error:', message);
          setSocketState((prev) => ({
            ...prev,
            connecting: false,
            error: message,
          }));
        });

        // General error
        socket.on('error', ({ message }) => {
          console.error('⚠️ Socket error:', message);
          setSocketState((prev) => ({ ...prev, error: message }));
        });

        // Pong response
        socket.on('pong', () => {
          // Connection is alive
        });

        socketRef.current = socket;
      } catch (error) {
        console.error('❌ Socket setup error:', error);
        setSocketState((prev) => ({
          ...prev,
          connecting: false,
          error: error instanceof Error ? error.message : 'Lỗi kết nối',
        }));
      }
    },
    [ticketId, currentUserId, onNewMessage, onTyping, onUserStatus]
  );

  // Send message through socket
  const sendMessage = useCallback(
    async (text: string, type: 'text' | 'image' = 'text', tempId?: string) => {
      if (!socketRef.current?.connected) {
        throw new Error('Socket chưa kết nối');
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout'));
        }, 10000);

        socketRef.current!.emit('sendMessage', {
          ticketId,
          text,
          type,
          tempId,
          sender: { _id: currentUserId },
        });

        // Listen for confirmation
        const handleNewMessage = (message: Message) => {
          if (message.tempId === tempId) {
            clearTimeout(timeout);
            socketRef.current!.off('newMessage', handleNewMessage);
            resolve(message);
          }
        };

        socketRef.current!.on('newMessage', handleNewMessage);
      });
    },
    [ticketId, currentUserId]
  );

  // Send typing indicator
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('typing', {
          ticketId,
          isTyping,
        });
      }
    },
    [ticketId]
  );

  // Mark user as online
  const markOnline = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('userOnline', { ticketId });
    }
  }, [ticketId]);

  // Initialize connection
  useEffect(() => {
    if (ticketId && currentUserId) {
      connect();
    }

    return cleanup;
  }, [ticketId, currentUserId, connect, cleanup]);

  // Reconnect when coming back from background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && !socketRef.current?.connected) {
        connect();
      }
    };

    // Note: You might want to use AppState from react-native here
    // AppState.addEventListener('change', handleAppStateChange);

    return () => {
      // AppState.removeEventListener('change', handleAppStateChange);
    };
  }, [connect]);

  return {
    socketState,
    sendMessage,
    sendTyping,
    markOnline,
    reconnect: () => connect(0),
    disconnect: cleanup,
  };
};
