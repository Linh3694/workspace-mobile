import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';
import { Message } from '../types/message';

interface UseSocketProps {
  authToken: string | null;
  chatId: string;
  currentUserId: string | null;
  chatPartner: { _id: string };
  isScreenActive: boolean;
  onNewMessage: (message: Message) => void;
  onMessageRead: (data: { userId: string; chatId: string }) => void;
  onMessageRevoked: (data: { messageId: string; chatId: string }) => void;
  onUserOnline: (data: { userId: string }) => void;
  onUserOffline: (data: { userId: string }) => void;
  onUserStatus: (data: { userId: string; status: string; lastSeen?: string }) => void;
}

interface TypingState {
  otherTyping: boolean;
  setOtherTyping: (typing: boolean) => void;
}

export const useSocket = ({
  authToken,
  chatId,
  currentUserId,
  chatPartner,
  isScreenActive,
  onNewMessage,
  onMessageRead,
  onMessageRevoked,
  onUserOnline,
  onUserOffline,
  onUserStatus
}: UseSocketProps) => {
  const socketRef = useRef<Socket | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isSocketDisabled, setIsSocketDisabled] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedTypingRef = useRef<NodeJS.Timeout | null>(null);

  // Setup socket connection
  const setupSocket = useCallback(async () => {
    if (!authToken || isSocketDisabled) {
      return;
    }

    try {
      console.log('🔌 Attempting socket connection to:', API_BASE_URL);
      
      // Disconnect existing socket if any
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      // Create new socket connection với timeout và fallback
      const socket = io(API_BASE_URL, {
        query: { token: authToken },
        transports: ['websocket'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000
      });

      socketRef.current = socket;

      // Connection events
      socket.on('connect', () => {
        console.log('✅ Socket connected successfully');
        setIsConnected(true);
        setConnectionAttempts(0);
        
        // Chỉ join chat room, không emit userOnline vì đã có OnlineStatusContext handle
        socket.emit('joinChat', chatId);
        
        // Check online status của partner
        socket.emit('checkUserStatus', { userId: chatPartner._id });
      });

      socket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.warn('⚠️ Socket connection failed:', error.message);
        setIsConnected(false);
        
        const newAttempts = connectionAttempts + 1;
        setConnectionAttempts(newAttempts);
        
        // Disable socket after 3 failed attempts
        if (newAttempts >= 3) {
          console.warn('🚫 Disabling socket after 3 failed attempts. App will work in offline mode.');
          setIsSocketDisabled(true);
          if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
          }
        }
      });

      // Message events
      socket.on('receiveMessage', (newMessage: Message) => {
        
        // Reset typing indicator khi nhận tin nhắn mới từ người đang typing
        if (newMessage.sender._id === chatPartner._id) {
          setOtherTyping(false);
        }
        
        onNewMessage(newMessage);

        // Auto-mark as read if screen is active and message is not from me
        if (isScreenActive && newMessage.sender._id !== currentUserId) {
          setTimeout(async () => {
            const token = await AsyncStorage.getItem('authToken');
            if (token && currentUserId) {
              // Call markMessagesAsRead from message operations
              socket.emit('messageRead', {
                userId: currentUserId,
                chatId: chatId,
                timestamp: new Date().toISOString()
              });
            }
          }, 1000);
        }
      });

      // Read status events
      socket.on('messageRead', onMessageRead);

      // Message revoked events
      socket.on('messageRevoked', onMessageRevoked);

      // User status events
      socket.on('userOnline', onUserOnline);
      socket.on('userOffline', onUserOffline);
      socket.on('userStatus', onUserStatus);

      // Typing events
      socket.on('userTyping', ({ userId, chatId: typingChatId }: { userId: string, chatId: string }) => {
       
        
        if (typingChatId === chatId && userId === chatPartner._id) {
          setOtherTyping(true);
          
          // Clear existing timeout
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          
          // Auto-reset typing indicator after 4 seconds
          typingTimeoutRef.current = setTimeout(() => {
            setOtherTyping(false);
          }, 4000);
        }
      });

      socket.on('userStopTyping', ({ userId, chatId: typingChatId }: { userId: string, chatId: string }) => {
     
        
        if (typingChatId === chatId && userId === chatPartner._id) {
          setOtherTyping(false);
          
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
          }
        }
      });

      // Heartbeat events
      socket.on('heartbeat', ({ onlineUsers }: { onlineUsers: string[] }) => {
      });

      // Không cần ping ở đây vì đã có trong useEffect riêng
      // const pingInterval = setInterval(() => {
      //   if (socket.connected) {
      //     socket.emit('ping', { userId: currentUserId });
      //   }
      // }, 30000);

      // return () => {
      //   clearInterval(pingInterval);
      //   socket.disconnect();
      // };
    } catch (error) {
      console.error('Socket setup error:', error);
      setIsConnected(false);
    }
  }, [authToken, chatId, currentUserId, chatPartner._id, isScreenActive, onNewMessage, onMessageRead, onMessageRevoked, onUserOnline, onUserOffline, onUserStatus]);

  // Emit typing event
  const emitTyping = useCallback(() => {
    if (socketRef.current && socketRef.current.connected && chatId && currentUserId) {
      socketRef.current.emit('typing', { chatId, userId: currentUserId });
      
      // Clear previous debounced call
      if (debouncedTypingRef.current) {
        clearTimeout(debouncedTypingRef.current);
      }
      
      // Debounce stop typing
      debouncedTypingRef.current = setTimeout(() => {
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('stopTyping', { chatId, userId: currentUserId });
        }
      }, 2500);
    }
  }, [chatId, currentUserId]);

  // Emit stop typing
  const emitStopTyping = useCallback(() => {
    if (socketRef.current && socketRef.current.connected && chatId && currentUserId) {
      socketRef.current.emit('stopTyping', { chatId, userId: currentUserId });
    }
  }, [chatId, currentUserId]);

  // Emit user online
  const emitUserOnline = useCallback(() => {
    if (socketRef.current && socketRef.current.connected && currentUserId && chatId) {
      socketRef.current.emit('userOnline', { userId: currentUserId, chatId });
    }
  }, [currentUserId, chatId]);

  // Emit message read
  const emitMessageRead = useCallback((userId: string, chatId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      const timestamp = new Date().toISOString();
      socketRef.current.emit('messageRead', {
        userId,
        chatId,
        timestamp
      });
    }
  }, []);

  // Check user status
  const checkUserStatus = useCallback((userId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('checkUserStatus', { userId });
    }
  }, []);

  // Setup socket when component mounts
  useEffect(() => {
    let isUnmounted = false;
    
    const initSocket = async () => {
      if (!authToken || !chatId || !currentUserId || isUnmounted) return;
      
      await setupSocket();
    };
    
    initSocket();

    return () => {
      isUnmounted = true;
      
      // Clear all timeouts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (debouncedTypingRef.current) {
        clearTimeout(debouncedTypingRef.current);
      }

      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [authToken, chatId, currentUserId]);

  // Heartbeat interval với tần suất giảm
  useEffect(() => {
    if (!socketRef.current || !chatId || !currentUserId) return;

    let heartbeatInterval: NodeJS.Timeout;
    let isUnmounted = false;

    // Tăng thời gian heartbeat và ping để giảm spam
    heartbeatInterval = setInterval(() => {
      if (isUnmounted) return;
      
      if (socketRef.current?.connected) {
        // Chỉ emit heartbeat, không emit userOnline liên tục
        socketRef.current.emit('heartbeat', { 
          userId: currentUserId,
          chatId: chatId,
          timestamp: Date.now()
        });
      }
    }, 30000); // Tăng từ 5 giây lên 30 giây

    return () => {
      isUnmounted = true;
      clearInterval(heartbeatInterval);
    };
  }, [chatId, currentUserId]);

  return {
    socket: socketRef.current,
    isConnected,
    otherTyping,
    emitTyping,
    emitStopTyping,
    emitUserOnline,
    emitMessageRead,
    checkUserStatus
  };
}; 