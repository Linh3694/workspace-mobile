import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHAT_SERVICE_URL, CHAT_SOCKET_URL, CHAT_SOCKET_PATH, BASE_URL } from '../config/constants';
import { Message } from '../types/message';

interface TypingUser {
  _id: string;
  fullname: string;
  avatarUrl?: string;
}

interface UseGroupSocketProps {
  authToken: string | null;
  chatId: string;
  currentUserId: string | null;
  isScreenActive: boolean;
  onNewMessage: (message: Message) => void;
  onMessageRead: (data: { userId: string; chatId: string }) => void;
  onMessageRevoked: (data: { messageId: string; chatId: string }) => void;
  onGroupMemberAdded?: (data: { chatId: string; newMember: any; addedBy: any }) => void;
  onGroupMemberRemoved?: (data: { chatId: string; removedUserId: string; removedBy: any }) => void;
  onGroupInfoUpdated?: (data: { chatId: string; changes: any; updatedBy: any }) => void;
}

export const useGroupSocket = ({
  authToken,
  chatId,
  currentUserId,
  isScreenActive,
  onNewMessage,
  onMessageRead,
  onMessageRevoked,
  onGroupMemberAdded,
  onGroupMemberRemoved,
  onGroupInfoUpdated,
}: UseGroupSocketProps) => {
  const socketRef = useRef<Socket | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isSocketDisabled, setIsSocketDisabled] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const debouncedTypingRef = useRef<NodeJS.Timeout | null>(null);

  // Setup socket connection
  const setupSocket = useCallback(async () => {
    if (!authToken || isSocketDisabled || !chatId || !currentUserId) {
      const reason = !authToken
        ? 'No auth token'
        : isSocketDisabled
          ? 'Socket disabled'
          : !chatId
            ? 'No chatId'
            : 'No currentUserId';
      console.log('🔌 [GroupSocket] Cannot setup socket:', reason);
      setDebugInfo(`Cannot setup: ${reason}`);
      return;
    }

    try {
      setDebugInfo('Connecting to socket...');
      console.log('🔌 [GroupSocket] Setting up socket for chat:', chatId, 'user:', currentUserId);

      // Disconnect existing socket if any
      if (socketRef.current) {
        console.log('🔌 [GroupSocket] Disconnecting existing socket');
        socketRef.current.disconnect();
        setJoinedRoom(null);
      }

      // Create new socket connection vào namespace group với path riêng qua Nginx
      const socket = io(`${CHAT_SOCKET_URL}/groupchat`, {
        path: CHAT_SOCKET_PATH,
        query: { token: authToken },
        transports: ['websocket'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true, // Force new connection
      });

      console.log('🔌 [GroupSocket] ========= SOCKET SETUP =========');
      console.log('🔌 [GroupSocket] Connection URL:', `${CHAT_SOCKET_URL}/groupchat`);
      console.log('🔌 [GroupSocket] Auth token provided:', !!authToken);
      console.log('🔌 [GroupSocket] Target chatId:', chatId);
      console.log('🔌 [GroupSocket] ==========================================');

      socketRef.current = socket;

      // Connection events
      socket.on('connect', () => {
        console.log('✅ [GroupSocket] Socket connected with ID:', socket.id);
        setIsConnected(true);
        setConnectionAttempts(0);
        setDebugInfo(`Connected: ${socket.id}`);

        // Join group chat room
        console.log('📡 [GroupSocket] Joining group chat room:', chatId);
        console.log('📡 [GroupSocket] ========= EMIT joinGroupChat =========');
        console.log('📡 [GroupSocket] Socket ID:', socket.id);
        console.log('📡 [GroupSocket] Socket connected:', socket.connected);
        console.log('📡 [GroupSocket] Emit data:', { chatId });
        console.log('📡 [GroupSocket] =========================================');

        socket.emit('joinGroupChat', { chatId });

        console.log('📡 [GroupSocket] ✅ AFTER emit joinGroupChat');
        console.log('📡 [GroupSocket] Socket status after emit:', {
          id: socket.id,
          connected: socket.connected,
          rooms: 'Cannot access from client',
        });

        // Tự động đánh dấu các tin nhắn hiện có là đã đọc khi mở group chat
        if (isScreenActive && currentUserId) {
          setTimeout(() => {
            socket.emit('messageRead', {
              userId: currentUserId,
              chatId: chatId,
              timestamp: new Date().toISOString(),
            });
            console.log('📡 [GroupSocket] Auto-emitted messageRead on join');
          }, 500);
        }

        // Confirm room join with timeout
        setTimeout(() => {
          setJoinedRoom(chatId);
          setDebugInfo(`Joined room: ${chatId}`);
          console.log('📡 [GroupSocket] Assumed joined room:', chatId);
        }, 1000);
      });

      socket.on('disconnect', (reason) => {
        console.log('🔌 [GroupSocket] Socket disconnected:', reason);
        setIsConnected(false);
        setJoinedRoom(null);
        setTypingUsers([]);
        setDebugInfo(`Disconnected: ${reason}`);
      });

      socket.on('connect_error', (error) => {
        console.warn('⚠️ [GroupSocket] Socket connection failed:', error.message);
        setIsConnected(false);
        setJoinedRoom(null);

        const newAttempts = connectionAttempts + 1;
        setConnectionAttempts(newAttempts);
        setDebugInfo(`Connection failed (${newAttempts}/5): ${error.message}`);

        if (newAttempts >= 5) {
          console.warn('🚫 [GroupSocket] Disabling socket after 5 failed attempts');
          setIsSocketDisabled(true);
          setDebugInfo('Socket disabled after 5 failures');
          if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
          }
        }
      });

      // Socket error handling
      socket.on('error', (error) => {
        console.error('❌ [GroupSocket] Socket error:', error);
        setDebugInfo(`Socket error: ${error.message || error}`);
      });

      // Group chat join confirmation
      socket.on('userJoinedGroup', (data) => {
        if (data.userId === currentUserId && data.chatId === chatId) {
          console.log('✅ [GroupSocket] Confirmed joined group chat:', chatId);
          setJoinedRoom(chatId);
          setDebugInfo(`Confirmed joined: ${chatId}`);
        }
      });

      // Test room join confirmation
      socket.on('roomJoinConfirmed', (data) => {
        console.log('🎯 [GroupSocket] ========= ROOM JOIN CONFIRMED =========');
        console.log('🎯 [GroupSocket] Confirmation data:', data);
        console.log('🎯 [GroupSocket] My socket ID:', socket.id);
        console.log('🎯 [GroupSocket] Room size on server:', data.roomSize);
        console.log('🎯 [GroupSocket] ========================================');
        setJoinedRoom(data.chatId);
        setDebugInfo(`Confirmed joined: ${data.chatId} (${data.roomSize} members)`);
      });

      // Message events - với extensive logging
      socket.on('receiveMessage', (newMessage: Message) => {
        console.log('📨 [GroupSocket] ========= RECEIVED MESSAGE =========');
        console.log('📨 [GroupSocket] Message ID:', newMessage._id);
        console.log('📨 [GroupSocket] Message chat:', newMessage.chat);
        console.log('📨 [GroupSocket] Current chatId:', chatId);
        console.log('📨 [GroupSocket] Message sender:', newMessage.sender);
        console.log('📨 [GroupSocket] Current userId:', currentUserId);
        console.log('📨 [GroupSocket] Socket ID:', socket.id);
        console.log('📨 [GroupSocket] Joined room:', joinedRoom);
        console.log('📨 [GroupSocket] ===========================================');

        // Type check để đảm bảo có chat
        if (!newMessage.chat) {
          console.warn('📨 [GroupSocket] Message has no chat field, ignoring');
          return;
        }

        // Extract chat ID from message
        const messageChatId =
          typeof newMessage.chat === 'object' ? (newMessage.chat as any)._id : newMessage.chat;
        console.log('📨 [GroupSocket] Extracted message chatId:', messageChatId);

        if (messageChatId !== chatId) {
          console.log('📨 [GroupSocket] Message not for current chat, ignoring');
          console.log('📨 [GroupSocket] Expected:', chatId, 'Got:', messageChatId);
          return;
        }

        // Extract sender ID
        const senderId =
          typeof newMessage.sender === 'object' ? newMessage.sender._id : newMessage.sender;
        console.log('📨 [GroupSocket] Processing message from sender:', senderId);

        // Remove typing indicator for this user
        setTypingUsers((prev) => {
          const filtered = prev.filter((user) => user._id !== senderId);
          if (filtered.length !== prev.length) {
            console.log('⌨️ [GroupSocket] Removed typing indicator for:', senderId);
          }
          return filtered;
        });

        // Clear timeout for this user
        const timeout = typingTimeoutsRef.current.get(senderId);
        if (timeout) {
          clearTimeout(timeout);
          typingTimeoutsRef.current.delete(senderId);
        }

        console.log('📨 [GroupSocket] Calling onNewMessage callback...');
        onNewMessage(newMessage);
        console.log('📨 [GroupSocket] onNewMessage callback completed');

        // Auto-mark as read if screen is active and message is not from me
        if (isScreenActive && senderId !== currentUserId) {
          console.log('📨 [GroupSocket] Auto-marking message as read...');

          // Emit messageRead ngay lập tức
          socket.emit('messageRead', {
            userId: currentUserId,
            chatId: chatId,
            timestamp: new Date().toISOString(),
          });
          console.log('📨 [GroupSocket] Emitted messageRead immediately');

          // Backup với API call sau delay ngắn để đảm bảo
          setTimeout(async () => {
            const token = await AsyncStorage.getItem('authToken');
            if (token && currentUserId) {
              try {
                await fetch(`${CHAT_SERVICE_URL}/messages/${chatId}/read`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ userId: currentUserId }),
                });
                console.log('📨 [GroupSocket] Backup API call completed');
              } catch (error) {
                console.error('📨 [GroupSocket] Backup API call failed:', error);
              }
            }
          }, 100);
        }
      });

      // Read status events
      socket.on('messageRead', (data) => {
        console.log('👁️ [GroupSocket] Message read event:', data);
        onMessageRead(data);
      });

      // Message revoked events
      socket.on('messageRevoked', (data) => {
        console.log('🗑️ [GroupSocket] Message revoked event:', data);
        onMessageRevoked(data);
      });

      // Group typing events
      socket.on(
        'userTypingInGroup',
        async ({ userId, chatId: typingChatId }: { userId: string; chatId: string }) => {
          console.log('⌨️ [GroupSocket] User typing event:', {
            userId,
            typingChatId,
            currentChatId: chatId,
          });

          if (typingChatId === chatId && userId !== currentUserId) {
            // Fetch user info if we don't have it
            let userInfo: TypingUser = {
              _id: userId,
              fullname: 'Đang tải...',
              avatarUrl: undefined,
            };

            try {
              const token = await AsyncStorage.getItem('authToken');
              if (token) {
                const response = await fetch(`${BASE_URL}/api/users/${userId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (response.ok) {
                  const userData = await response.json();
                  console.log('👤 [GroupSocket] User data from API:', userData);
                  userInfo = {
                    _id: userId,
                    fullname: userData.fullname || userData.name || 'Unknown User',
                    avatarUrl: userData.avatarUrl || userData.avatar,
                  };
                  console.log('👤 [GroupSocket] Mapped user info:', userInfo);
                } else {
                  console.warn('👤 [GroupSocket] Failed to fetch user, status:', response.status);
                }
              }
            } catch (error) {
              console.warn('⌨️ [GroupSocket] Failed to fetch user info for typing:', error);
            }

            setTypingUsers((prev) => {
              if (prev.some((u) => u._id === userId)) {
                console.log('⌨️ [GroupSocket] User already typing, updating timeout');
                return prev;
              }
              console.log('⌨️ [GroupSocket] Adding user to typing list:', userId);
              return [...prev, userInfo];
            });

            // Clear existing timeout
            const existingTimeout = typingTimeoutsRef.current.get(userId);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }

            // Set new timeout
            const timeout = setTimeout(() => {
              console.log('⌨️ [GroupSocket] Typing timeout for user:', userId);
              setTypingUsers((prev) => prev.filter((u) => u._id !== userId));
              typingTimeoutsRef.current.delete(userId);
            }, 4000);

            typingTimeoutsRef.current.set(userId, timeout);
          }
        }
      );

      socket.on(
        'userStopTypingInGroup',
        ({ userId, chatId: typingChatId }: { userId: string; chatId: string }) => {
          console.log('⌨️ [GroupSocket] User stop typing:', userId);

          if (typingChatId === chatId && userId !== currentUserId) {
            setTypingUsers((prev) => prev.filter((u) => u._id !== userId));

            const timeout = typingTimeoutsRef.current.get(userId);
            if (timeout) {
              clearTimeout(timeout);
              typingTimeoutsRef.current.delete(userId);
            }
          }
        }
      );

      // Group management events
      socket.on('groupMemberAdded', (data: { chatId: string; newMember: any; addedBy: any }) => {
        console.log('👥 [GroupSocket] Member added:', data);
        if (data.chatId === chatId && onGroupMemberAdded) {
          onGroupMemberAdded(data);
        }
      });

      socket.on(
        'groupMemberRemoved',
        (data: { chatId: string; removedUserId: string; removedBy: any }) => {
          console.log('👥 [GroupSocket] Member removed:', data);
          if (data.chatId === chatId && onGroupMemberRemoved) {
            onGroupMemberRemoved(data);
          }
        }
      );

      socket.on('groupInfoUpdated', (data: { chatId: string; changes: any; updatedBy: any }) => {
        console.log('📝 [GroupSocket] Group info updated:', data);
        if (data.chatId === chatId && onGroupInfoUpdated) {
          onGroupInfoUpdated(data);
        }
      });

      // Debug all events
      socket.onAny((eventName, ...args) => {
        console.log('🔍 [GroupSocket] Received event:', eventName, args);
      });
    } catch (error) {
      console.error('❌ [GroupSocket] Error setting up socket:', error);
      setDebugInfo(`Setup error: ${error.message || error}`);
    }
  }, [
    authToken,
    chatId,
    currentUserId,
    isScreenActive,
    onNewMessage,
    onMessageRead,
    onMessageRevoked,
    onGroupMemberAdded,
    onGroupMemberRemoved,
    onGroupInfoUpdated,
    connectionAttempts,
    isSocketDisabled,
    joinedRoom,
  ]);

  // Emit typing
  const emitTyping = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected || !chatId || !currentUserId) {
      console.log('⌨️ [GroupSocket] Cannot emit typing:', {
        hasSocket: !!socketRef.current,
        connected: socketRef.current?.connected,
        hasChatId: !!chatId,
        hasUserId: !!currentUserId,
      });
      return;
    }

    console.log('⌨️ [GroupSocket] Emitting typing for user:', currentUserId, 'in chat:', chatId);

    // Clear existing debounce
    if (debouncedTypingRef.current) {
      clearTimeout(debouncedTypingRef.current);
    }

    // Emit typing
    socketRef.current.emit('groupTyping', {
      chatId,
      userId: currentUserId,
      isTyping: true,
    });
    console.log('⌨️ [GroupSocket] ✅ Emitted groupTyping event with isTyping: true');

    // Set debounced stop typing
    debouncedTypingRef.current = setTimeout(() => {
      if (socketRef.current && socketRef.current.connected) {
        console.log('⌨️ [GroupSocket] Auto-stopping typing for user:', currentUserId);
        socketRef.current.emit('groupTyping', {
          chatId,
          userId: currentUserId,
          isTyping: false,
        });
        console.log('⌨️ [GroupSocket] ✅ Emitted groupTyping event with isTyping: false (auto)');
      }
    }, 2000);
  }, [chatId, currentUserId]);

  // Emit stop typing
  const emitStopTyping = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected || !chatId || !currentUserId) {
      console.log('⌨️ [GroupSocket] Cannot emit stop typing:', {
        hasSocket: !!socketRef.current,
        connected: socketRef.current?.connected,
        hasChatId: !!chatId,
        hasUserId: !!currentUserId,
      });
      return;
    }

    console.log('⌨️ [GroupSocket] Manually stopping typing for user:', currentUserId);

    socketRef.current.emit('groupTyping', {
      chatId,
      userId: currentUserId,
      isTyping: false,
    });
    console.log('⌨️ [GroupSocket] ✅ Emitted groupTyping event with isTyping: false (manual)');

    // Clear debounce
    if (debouncedTypingRef.current) {
      clearTimeout(debouncedTypingRef.current);
      debouncedTypingRef.current = null;
    }
  }, [chatId, currentUserId]);

  // Emit message read
  const emitMessageRead = useCallback((userId: string, chatId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      const timestamp = new Date().toISOString();
      socketRef.current.emit('messageRead', {
        userId,
        chatId,
        timestamp,
      });
    }
  }, []);

  // Force reconnect function
  const reconnect = useCallback(() => {
    console.log('🔄 [GroupSocket] Force reconnecting...');
    setIsSocketDisabled(false);
    setConnectionAttempts(0);
    setupSocket();
  }, [setupSocket]);

  // Setup socket when component mounts
  useEffect(() => {
    let isUnmounted = false;

    const initSocket = async () => {
      if (!authToken || !chatId || !currentUserId || isUnmounted) {
        const reason = !authToken
          ? 'No auth token'
          : !chatId
            ? 'No chatId'
            : !currentUserId
              ? 'No currentUserId'
              : 'Unmounted';
        console.log('🔌 [GroupSocket] Cannot init socket:', reason);
        setDebugInfo(`Cannot init: ${reason}`);
        return;
      }

      console.log('🔌 [GroupSocket] Initializing socket for group:', chatId);
      await setupSocket();
    };

    // Delay để tránh re-render liên tục
    const timer = setTimeout(() => {
      initSocket();
    }, 100);

    return () => {
      isUnmounted = true;
      clearTimeout(timer);

      console.log('🔌 [GroupSocket] Cleaning up socket for group:', chatId);

      // Clear all timeouts
      typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();

      if (debouncedTypingRef.current) {
        clearTimeout(debouncedTypingRef.current);
      }

      // Leave group chat and disconnect socket
      if (socketRef.current) {
        socketRef.current.emit('leaveGroupChat', { chatId });
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setJoinedRoom(null);
    };
  }, [authToken, chatId, currentUserId]); // Removed setupSocket from dependencies to prevent loops

  return {
    socket: socketRef.current,
    typingUsers,
    isConnected,
    joinedRoom,
    debugInfo,
    emitTyping,
    emitStopTyping,
    emitMessageRead,
    reconnect,
  };
};
