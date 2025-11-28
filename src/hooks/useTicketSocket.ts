import { useEffect, useRef, useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';

import type { Message } from '../services/ticketService';

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
  const wsRef = useRef<WebSocket | null>(null);
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
    if (wsRef.current) {
      wsRef.current.close(1000, 'Normal closure');
      wsRef.current = null;
    }
  }, []);

  // Connect WebSocket with retry logic
  const connect = useCallback(
    async (retryCount = 0) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('🔗 WebSocket already connected');
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

        console.log(`🔄 Connecting to WebSocket (attempt ${retryCount + 1})`);

        // Build WebSocket URL with ticket ID
        const wsUrl = `wss://${API_BASE_URL.replace('https://', '')}/ws?ticket=${ticketId}`;

        const ws = new WebSocket(wsUrl, [], {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Connection events
        ws.onopen = () => {
          console.log('🔗 WebSocket connected successfully');
          setSocketState({ connected: true, connecting: false, error: null });

          // Setup ping interval (keep-alive)
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000);
        };

        ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason);
          setSocketState((prev) => ({ ...prev, connected: false }));

          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
          }

          // Auto-reconnect for unexpected disconnections
          if (event.code !== 1000) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            reconnectTimeoutRef.current = setTimeout(() => {
              connect(retryCount + 1);
            }, delay);
          }
        };

        ws.onerror = (error) => {
          console.error('🔥 WebSocket error:', error);
          setSocketState((prev) => ({
            ...prev,
            connecting: false,
            error: 'Lỗi kết nối WebSocket',
          }));
        };

        // Clear any existing message handler
        ws.onmessage = null;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case 'connection':
                console.log('✅ WebSocket connection confirmed');
                break;

              case 'new_message':
                console.log('📨 New message received:', data.message._id);
                if (onNewMessage) {
                  onNewMessage(data.message);
                }
                break;

              case 'ticket_updated':
                console.log('🎫 Ticket updated:', data.ticket._id);
                // Handle ticket updates if needed
                break;

              case 'error':
                console.error('⚠️ WebSocket error:', data.message);
                setSocketState((prev) => ({ ...prev, error: data.message }));
                break;

              case 'pong':
                // Keep-alive pong received
                break;

              default:
                console.warn('⚠️ Unknown WebSocket message type:', data.type);
            }
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('❌ WebSocket setup error:', error);
        setSocketState((prev) => ({
          ...prev,
          connecting: false,
          error: error instanceof Error ? error.message : 'Lỗi kết nối',
        }));
      }
    },
    [ticketId, currentUserId, onNewMessage]
  );

  // Send message through WebSocket
  const sendMessage = useCallback(
    async (messageData: { text?: string; images?: any[]; tempId?: string }) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket chưa kết nối');
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout'));
        }, 10000);

        const messagePayload = {
          type: 'new_message',
          data: {
            ...messageData,
            tempId: messageData.tempId || `temp_${Date.now()}`,
          },
        };

        wsRef.current!.send(JSON.stringify(messagePayload));

        // For React Native, we don't wait for confirmation via WebSocket
        // The message will be sent via HTTP API and broadcasted via WebSocket
        // So we resolve immediately
        resolve(messagePayload.data);
        clearTimeout(timeout);
      });
    },
    [ticketId, currentUserId, onNewMessage]
  );

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
      if (
        nextAppState === 'active' &&
        (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
      ) {
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
    reconnect: () => connect(0),
    disconnect: cleanup,
  };
};
