// @ts-nocheck
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
// @ts-ignore
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import debounce from 'lodash.debounce';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChatStackParamList } from '../../navigation/ChatStackNavigator';
import { jwtDecode } from 'jwt-decode';
import { getSocket, getGroupSocket } from '../../services/socketService';
import { useOnlineStatus } from '../../context/OnlineStatusContext';
import { BASE_URL, CHAT_SERVICE_URL } from '../../config/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../components/Chat/Avatar';
import GroupAvatar from '../../components/Chat/GroupAvatar';
import { useEmojis } from '../../hooks/useEmojis';
import WiscomLogo from '../../assets/wiscom.svg';
import { ROUTES } from '../../constants/routes';
import StandardHeader from '../../components/Common/StandardHeader';

interface User {
  _id: string;
  fullname: string;
  avatarUrl?: string;
}

interface Message {
  _id: string;
  content: string;
  createdAt: string;
  sender: string | { _id: string; fullname: string; avatarUrl?: string };
  readBy: string[];
  type?: string;
  fileUrl?: string;
  fileUrls?: string[];
  isEmoji?: boolean;
}

interface Chat {
  _id: string;
  participants: User[];
  lastMessage?: Message;
  updatedAt: string;
  isGroup?: boolean;
  name?: string;
  avatar?: string;
}

const ChatScreen = () => {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [forwardMode, setForwardMode] = useState(false);
  const [messageToForwardId, setMessageToForwardId] = useState<string | null>(null);
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const [lastVisitedChatId, setLastVisitedChatId] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const { isUserOnline, getFormattedLastSeen } = useOnlineStatus();
  const navigation = useNavigation<NativeStackNavigationProp<ChatStackParamList>>();
  const route = useRoute();
  const parentTabNav: any = (navigation as any).getParent?.();
  const hideTabBar = () => {
    parentTabNav?.setOptions({ tabBarStyle: { display: 'none' } });
  };
  const socketRef = useRef<any>(null);
  const groupSocketRef = useRef<any>(null);

  // Helper function to check if a message is unread by current user
  const isMessageUnread = useCallback(
    (message: Message | undefined, currentUserId: string | null): boolean => {
      if (!message || !currentUserId) {
        return false;
      }

      const senderId =
        typeof message.sender === 'object' && message.sender !== null
          ? message.sender._id
          : message.sender;

      if (!senderId || senderId === currentUserId) {
        return false;
      }

      const readBy = Array.isArray(message.readBy) ? message.readBy : [];
      return !readBy.includes(currentUserId);
    },
    []
  );

  // === Utility to join chat rooms ===
  // We join every chat room so that the screen can receive real‑time
  // 'receiveMessage' events even when the user is not inside the
  // ChatDetail screen of that room.
  const joinChatRooms = useCallback((chatList: Chat[]) => {
    const socket = socketRef.current;
    if (!socket) {
      console.log('🔌 [joinChatRooms] No socket available');
      return;
    }

    console.log('🔌 [joinChatRooms] Joining', chatList.length, 'chat rooms');
    chatList.forEach((chat) => {
      console.log('🔌 [joinChatRooms] Joining room:', chat._id);
      socket.emit('joinChat', chat._id);
    });
  }, []);
  const insets = useSafeAreaInsets();

  const { customEmojis } = useEmojis();

  // Tạo function để sắp xếp users theo độ ưu tiên:
  // 1. Users đang online (hiển thị trước)
  // 2. Users đã có chat 1-1 gần đây (không tính group chat)
  // 3. Sắp xếp theo thời gian tin nhắn cuối cùng (nếu có chat 1-1)
  // 4. Sắp xếp theo tên (nếu cùng trạng thái)
  const getSortedUsers = useMemo(() => {
    if (!users || !Array.isArray(users)) return [];

    // Nếu chưa xác định currentUserId, vẫn hiển thị danh sách users (không lọc bản thân)
    const baseUsers = currentUserId
      ? users.filter((user) => user._id !== currentUserId)
      : users.slice();

    // Nếu chưa có currentUserId, sắp xếp theo online trước rồi theo tên
    if (!currentUserId) {
      return baseUsers.sort((a, b) => {
        const aIsOnline = isUserOnline(a._id);
        const bIsOnline = isUserOnline(b._id);
        if (aIsOnline && !bIsOnline) return -1;
        if (!aIsOnline && bIsOnline) return 1;
        const aName = a.fullname || a.full_name || a.name || '';
        const bName = b.fullname || b.full_name || b.name || '';
        return aName.localeCompare(bName);
      });
    }

    // Khi đã có currentUserId: ưu tiên theo mức độ tương tác chat 1-1
    const chatParticipantsMap = new Map();
    const chatLastMessageMap = new Map();
    if (chats && Array.isArray(chats)) {
      chats.forEach((chat) => {
        if (!chat.isGroup && chat.participants.length === 2) {
          const otherParticipant = chat.participants.find((p) => p._id !== currentUserId);
          if (otherParticipant) {
            chatParticipantsMap.set(otherParticipant._id, true);
            if (chat.lastMessage) {
              chatLastMessageMap.set(
                otherParticipant._id,
                new Date(chat.lastMessage.createdAt).getTime()
              );
            }
          }
        }
      });
    }

    return baseUsers.sort((a, b) => {
      const aIsOnline = isUserOnline(a._id);
      const bIsOnline = isUserOnline(b._id);
      const aHasChat = chatParticipantsMap.has(a._id);
      const bHasChat = chatParticipantsMap.has(b._id);
      const aLastMessageTime = chatLastMessageMap.get(a._id) || 0;
      const bLastMessageTime = chatLastMessageMap.get(b._id) || 0;

      if (aIsOnline && !bIsOnline) return -1;
      if (!aIsOnline && bIsOnline) return 1;
      if (aHasChat && !bHasChat) return -1;
      if (!aHasChat && bHasChat) return 1;
      if (aHasChat && bHasChat) return bLastMessageTime - aLastMessageTime;
      const aName = a.fullname || a.full_name || a.name || '';
      const bName = b.fullname || b.full_name || b.name || '';
      return aName.localeCompare(bName);
    });
  }, [users, chats, currentUserId, isUserOnline]);

  // Check if we're in forwarding mode based on route params
  useEffect(() => {
    const params = route.params as any;
    if (params && params.forwardMode) {
      const checkForwardMessage = async () => {
        try {
          const messageId = await AsyncStorage.getItem('messageToForward');
          if (messageId) {
            setMessageToForwardId(messageId);
            setForwardMode(true);
            Alert.alert('Chuyển tiếp tin nhắn', 'Chọn người nhận để chuyển tiếp tin nhắn');
          }
        } catch (error) {
          console.error('Error checking for forwarded message:', error);
        }
      };

      checkForwardMessage();
    }
  }, [route.params]);

  useEffect(() => {
    // Chỉ fetch users 1 lần khi load màn hình
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('authToken');
        const usersUrl = `${BASE_URL}/api/users/?t=${Date.now()}`;
        console.log('👥 [ChatScreen] GET users:', usersUrl);
        const usersRes = await fetch(usersUrl, {
          headers: token
            ? { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-store' }
            : { 'Cache-Control': 'no-store' },
        });

        if (usersRes.status === 304) {
          // Giữ nguyên danh sách hiện tại nếu server trả Not Modified
        } else if (usersRes.ok) {
          const contentType = usersRes.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            // Bỏ qua nếu không phải JSON
          } else {
            const usersData = await usersRes.json();
            // Chat service already returns normalized users
            const users = Array.isArray(usersData) ? usersData : [];
            setUsers(users);

            // Xác định currentUserId theo email từ token/AsyncStorage, map sang _id của chat-service
            try {
              let myEmail: string | null = null;
              if (token) {
                try {
                  const decoded: any = jwtDecode(token);
                  myEmail = decoded.email || decoded.sub || null;
                } catch {}
              }
              if (!myEmail) {
                const userStr = await AsyncStorage.getItem('user');
                if (userStr) {
                  const cachedUser = JSON.parse(userStr);
                  myEmail = cachedUser?.email || null;
                }
              }

              if (myEmail) {
                const me = users.find(
                  (u: any) => (u.email || '').toLowerCase() === myEmail!.toLowerCase()
                );
                if (me && me._id) {
                  setCurrentUserId(me._id);
                  console.log(
                    '👤 [ChatScreen] currentUserId resolved from users list:',
                    me._id,
                    myEmail
                  );
                  // Sau khi có currentUserId, tải danh sách chat gần đây
                  await fetchChats(true);
                } else {
                  console.log(
                    '⚠️ [ChatScreen] Cannot map email to chat-service user _id. email=',
                    myEmail,
                    'usersCount=',
                    users.length
                  );
                }
              } else {
                console.log('⚠️ [ChatScreen] Cannot determine my email from token/AsyncStorage');
              }
            } catch (mapErr) {
              console.warn('⚠️ [ChatScreen] Error mapping current user id:', mapErr);
            }
          }
        } else {
          // Không xoá danh sách khi lỗi tạm thời (như 304)
        }

        // Dùng lại token vừa lấy ở trên
        if (token) {
          try {
            const decoded: any = jwtDecode(token);
            // decode JWT to get the current user's id
            const userId = decoded._id || decoded.id;
            if (userId) {
              console.log('👤 [ChatScreen] currentUserId decoded:', userId);
              setCurrentUserId(userId);
              // Gọi tải danh sách gần đây ngay sau khi biết currentUserId
              fetchChats(true);
            }
          } catch (err) {}
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const setupGlobalSocket = async () => {
    if (!currentUserId || socketRef.current) return;
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    socketRef.current = getSocket(token);

    socketRef.current.on('connect', () => {
      setSocketConnected(true);
      if (currentUserId) {
        socketRef.current.emit('joinUserRoom', currentUserId);
      }
    });

    socketRef.current.on('disconnect', () => {
      setSocketConnected(false);
    });

    socketRef.current.on('receiveMessage', (message: any) => {
      // Only handle 1-1 chat messages (not group messages)
      if (!message.isGroup) {
        setChats((prevChats) => {
          const chatIndex = prevChats.findIndex((c) => c._id === message.chat);

          if (chatIndex === -1) {
            // If chat not found, fetch fresh data but avoid immediate state conflicts
            setTimeout(() => fetchChats(true), 100);
            return prevChats;
          }

          const newChats = [...prevChats];
          const existingChat = newChats[chatIndex];

          // Remove chat from current position
          newChats.splice(chatIndex, 1);

          // Add to top with updated last message
          newChats.unshift({
            ...existingChat,
            lastMessage: {
              ...message,
              readBy: Array.isArray(message.readBy) ? message.readBy : [],
            },
            updatedAt: message.createdAt,
          });

          return newChats;
        });
      }
    });
    // Listen for newChat updates
    socketRef.current.on('newChat', (updatedChat: Chat) => {
      setChats((prevChats) => {
        const index = prevChats.findIndex((c) => c._id === updatedChat._id);
        const updated = [...prevChats];
        if (index !== -1) {
          updated.splice(index, 1);
        }
        updated.unshift(updatedChat);
        return updated;
      });
      // Ensure list stays in sync by refetching
      fetchChats(true);
    });

    socketRef.current.on('messageRead', (data: { chatId: string; userId: string }) => {
      console.log('📖 [ChatScreen] Received messageRead event:', data);

      // Only update local state, avoid unnecessary API calls
      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat._id === data.chatId && chat.lastMessage) {
            console.log('📖 [ChatScreen] Processing messageRead for chat:', chat._id);

            const currentReadBy = Array.isArray(chat.lastMessage.readBy)
              ? chat.lastMessage.readBy
              : [];

            // Check if user is already in readBy array
            const isAlreadyRead = currentReadBy.includes(data.userId);
            console.log('📖 [ChatScreen] Read status:', {
              userId: data.userId,
              currentReadBy,
              isAlreadyRead,
            });

            if (!isAlreadyRead) {
              console.log('📖 [ChatScreen] Adding user to readBy list');
              return {
                ...chat,
                lastMessage: {
                  ...chat.lastMessage,
                  readBy: [...currentReadBy, data.userId],
                },
              };
            }
          }
          return chat;
        })
      );

      // Remove the unnecessary fetchChats call to avoid race conditions
      // The local state update above is sufficient for UI consistency
    });

    socketRef.current.on('reconnect', () => {
      fetchChats(true);
    });
  };

  // Setup socket riêng cho GroupChat
  const setupGroupSocket = async () => {
    if (!currentUserId || groupSocketRef.current) return;
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    groupSocketRef.current = getGroupSocket(token);

    groupSocketRef.current.on('connect', () => {
      console.log('✅ GroupSocket connected');
      if (currentUserId) {
        groupSocketRef.current.emit('joinUserRoom', currentUserId);
      }
    });

    groupSocketRef.current.on('disconnect', () => {
      console.log('🔌 GroupSocket disconnected');
    });

    // =============== GROUP CHAT SOCKET EVENTS ===============

    // Group member events
    groupSocketRef.current.on('addedToGroup', (data: any) => {
      fetchChats(true); // Refresh to show new group
      Alert.alert('Thông báo', 'Bạn đã được thêm vào một nhóm mới');
    });

    groupSocketRef.current.on('removedFromGroup', (data: any) => {
      fetchChats(true); // Refresh to remove group from list
      Alert.alert('Thông báo', 'Bạn đã bị xóa khỏi một nhóm');
    });

    groupSocketRef.current.on('groupMembersAdded', (data: any) => {
      fetchChats(true); // Refresh to update member count
    });

    groupSocketRef.current.on('groupMemberRemoved', (data: any) => {
      fetchChats(true); // Refresh to update member count
    });

    // Group info updates
    groupSocketRef.current.on('groupInfoUpdated', (data: any) => {
      setChats((prevChats) =>
        prevChats.map((chat) => (chat._id === data.chatId ? { ...chat, ...data.changes } : chat))
      );
    });

    // Group admin updates
    groupSocketRef.current.on('groupAdminUpdated', (data: any) => {
      // This would need to update admin status in chat if we store it
    });

    // User joined/left group
    groupSocketRef.current.on('userJoinedGroup', (data: any) => {});

    groupSocketRef.current.on('userLeftGroup', (data: any) => {});

    // Group message events
    groupSocketRef.current.on('receiveMessage', (message: any) => {
      // Only handle group chat messages (isGroup = true)
      if (message.isGroup) {
        setChats((prevChats) => {
          const chatIndex = prevChats.findIndex((c) => c._id === message.chat);

          if (chatIndex === -1) {
            // If chat not found, fetch fresh data but avoid immediate state conflicts
            setTimeout(() => fetchChats(true), 100);
            return prevChats;
          }

          const newChats = [...prevChats];
          const existingChat = newChats[chatIndex];

          // Remove chat from current position
          newChats.splice(chatIndex, 1);

          // Add to top with updated last message
          newChats.unshift({
            ...existingChat,
            lastMessage: {
              ...message,
              readBy: Array.isArray(message.readBy) ? message.readBy : [],
            },
            updatedAt: message.createdAt,
          });

          return newChats;
        });
      }
    });
  };

  useEffect(() => {
    if (currentUserId) {
      setupGlobalSocket();
      setupGroupSocket();
    }

    // Cleanup function khi component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (groupSocketRef.current) {
        groupSocketRef.current.disconnect();
        groupSocketRef.current = null;
      }
    };
  }, [currentUserId]);

  // Function để fetch chats với option force refresh
  const fetchChats = async (forceRefresh = false) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.log('🟡 [fetchChats] No auth token');
        return;
      }

      const url = forceRefresh
        ? `${CHAT_SERVICE_URL}/list?t=${Date.now()}`
        : `${CHAT_SERVICE_URL}/list`;
      console.log('📥 [fetchChats] GET', url);

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });

      console.log('📥 [fetchChats] Status:', res.status, res.statusText);
      console.log('📥 [fetchChats] Content-Type:', res.headers.get('content-type'));

      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          console.warn(`💡 [fetchChats] HTML response (Status: ${res.status})`);
          console.warn('Backend server may not be running or endpoint not implemented yet.');
          return;
        }

        const errorText = await res.text();
        console.warn('⚠️ [fetchChats] Error body:', errorText.substring(0, 300));
        return;
      }

      // Kiểm tra content type trước khi parse JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await res.text();
        console.warn('Chats API returned non-JSON response:', responseText.substring(0, 100));
        return;
      }

      const data = await res.json();
      console.log('📥 [fetchChats] JSON length:', Array.isArray(data) ? data.length : 'n/a');
      if (Array.isArray(data)) {
        console.log('💾 [fetchChats] Received chats data:', data.length, 'chats');

        // Backend đã lọc chat rỗng, chỉ cần sort theo thời gian
        // Tạm comment debug logs để tránh spam khi test
        // data.forEach((chat, index) => {
        //     if (chat.lastMessage) {
        //         console.log(`💾 [fetchChats] Chat ${index + 1}:`, {
        //             chatId: chat._id,
        //             lastMessageId: chat.lastMessage._id,
        //             lastMessageContent: chat.lastMessage.content?.substring(0, 20) + '...',
        //             senderId: typeof chat.lastMessage.sender === 'object'
        //                 ? chat.lastMessage.sender._id
        //                 : chat.lastMessage.sender,
        //             readBy: chat.lastMessage.readBy || [],
        //             currentUserId,
        //             isGroup: chat.isGroup
        //         });
        //     } else if (chat.isGroup) {
        //         console.log(`💾 [fetchChats] Group chat ${index + 1}:`, {
        //             chatId: chat._id,
        //             name: chat.name,
        //             isGroup: chat.isGroup,
        //             participants: chat.participants?.length,
        //             hasLastMessage: false,
        //             note: 'Group chat mới tạo chưa có tin nhắn'
        //         });
        //     }
        // });

        const sortedChats = data.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        // Ensure we are listening to every chat room we just fetched
        joinChatRooms(sortedChats);

        setChats(sortedChats);
      } else {
        console.warn('Chats response is not an array:', data);
        setChats([]);
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
      setChats([]);
    }
  };

  // Join/refresh rooms whenever the list of chats changes
  useEffect(() => {
    if (chats.length) {
      joinChatRooms(chats);
    }
  }, [chats, joinChatRooms]);

  // Refresh chats khi màn hình được focus để cập nhật trạng thái đã đọc
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔎 [ChatScreen] focus, currentUserId =', currentUserId);
      if (!currentUserId) return;

      let isMounted = true;

      const refreshChats = async () => {
        if (isMounted) {
          await fetchChats(true);
        }
      };

      // Refresh ngay lập tức khi focus
      console.log('🔄 [ChatScreen] focus -> refreshChats');
      refreshChats();

      return () => {
        isMounted = false;
      };
    }, [currentUserId]) // Chỉ phụ thuộc vào currentUserId
  );

  // Lắng nghe khi quay lại từ ChatDetail để refresh chats
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (currentUserId && shouldRefresh) {
        // Mark visited chat as read in local state immediately for better UX
        setChats((prevChats) =>
          prevChats.map((chat) => {
            // Only mark read for the last visited chat
            if (chat._id === lastVisitedChatId && chat.lastMessage) {
              const lastMessage = chat.lastMessage;
              const lastMessageSenderId =
                typeof lastMessage.sender === 'object' && lastMessage.sender !== null
                  ? lastMessage.sender._id
                  : lastMessage.sender;

              const currentReadBy = Array.isArray(lastMessage.readBy) ? lastMessage.readBy : [];

              // If last message is not from current user and not read yet
              if (
                lastMessageSenderId &&
                lastMessageSenderId !== currentUserId &&
                !currentReadBy.includes(currentUserId)
              ) {
                return {
                  ...chat,
                  lastMessage: {
                    ...lastMessage,
                    readBy: [...currentReadBy, currentUserId],
                  },
                };
              }
            }
            return chat;
          })
        );

        // Call mark read API for the visited chat
        if (lastVisitedChatId) {
          const markChatAsRead = async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              if (!token) {
                console.log('No token for markChatAsRead');
                return;
              }

              // Use the correct endpoint that exists in backend
              const response = await fetch(
                `${CHAT_SERVICE_URL}/messages/${lastVisitedChatId}/read`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    userId: currentUserId,
                    timestamp: new Date().toISOString(),
                  }),
                }
              );

              if (response.ok) {
                console.log('✅ [ChatScreen] Successfully marked chat as read');
                // Force update local state to ensure UI consistency
                setChats((prevChats) =>
                  prevChats.map((chat) => {
                    if (chat._id === lastVisitedChatId && chat.lastMessage) {
                      const currentReadBy = Array.isArray(chat.lastMessage.readBy)
                        ? chat.lastMessage.readBy
                        : [];

                      if (!currentReadBy.includes(currentUserId)) {
                        return {
                          ...chat,
                          lastMessage: {
                            ...chat.lastMessage,
                            readBy: [...currentReadBy, currentUserId],
                          },
                        };
                      }
                    }
                    return chat;
                  })
                );
              } else {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('text/html')) {
                  console.warn(
                    `💡 Mark read API endpoint not available (Status: ${response.status})`
                  );
                  console.warn(
                    'Backend server may not be running or endpoint not implemented yet.'
                  );
                  return;
                }

                const errorText = await response.text();
                console.warn('💡 [API] Failed to mark chat as read:', response.status, errorText);
              }
            } catch (error) {
              console.warn('💡 [API] Error marking chat as read:', error);
            }
          };
          markChatAsRead();
        }

        // Single refresh call instead of multiple calls to avoid race conditions
        fetchChats(true);

        // Clean up flags after a short delay
        const cleanupTimeout = setTimeout(() => {
          setShouldRefresh(false);
          setLastVisitedChatId(null);
        }, 500);

        return () => {
          clearTimeout(cleanupTimeout);
        };
      }
    });
    return unsubscribe;
  }, [navigation, currentUserId, shouldRefresh, lastVisitedChatId]);

  const handleSearch = async (text: string) => {
    try {
      let usersData = [];
      if (text.trim() === '') {
        // Khi không có search text, fetch tất cả users
        const token = await AsyncStorage.getItem('authToken');
        const url = `${BASE_URL}/api/users/?t=${Date.now()}`;
        const usersRes = await fetch(url, {
          headers: token
            ? { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-store' }
            : { 'Cache-Control': 'no-store' },
        });

        if (usersRes.status === 304) {
          // Không cập nhật nếu Not Modified
          return;
        }
        if (!usersRes.ok) {
          const contentType = usersRes.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            console.warn(`💡 Users API endpoint not available (Status: ${usersRes.status})`);
            console.warn('Backend server may not be running or endpoint not implemented yet.');
            setUsers([]);
            return;
          }

          const errorText = await usersRes.text();
          console.warn('Users API unavailable:', usersRes.status, errorText);
          setUsers([]);
          return;
        }

        const contentType = usersRes.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const responseText = await usersRes.text();
          console.warn('Users API returned non-JSON response:', responseText.substring(0, 100));
          setUsers([]);
          return;
        }

        // Chat service already returns normalized users
        const userData = await usersRes.json();
        usersData = Array.isArray(userData) ? userData : [];
      } else {
        // Khi có search text, tìm kiếm users
        const token = await AsyncStorage.getItem('authToken');
        const res = await fetch(`${BASE_URL}/api/users/search?query=${encodeURIComponent(text)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const responseText = await res.text();
            console.error('Expected JSON but got:', responseText.substring(0, 200));
            setUsers([]);
            return;
          }
          const searchData = await res.json();
          usersData = Array.isArray(searchData) ? searchData : [];
        } else {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            console.warn(`💡 Search API endpoint not available (Status: ${res.status})`);
            console.warn('Backend server may not be running or endpoint not implemented yet.');
          } else {
            const errorText = await res.text();
            console.warn('Search API unavailable:', res.status, errorText);
          }
          usersData = [];
        }
      }
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      console.error('Error searching users:', err);
      setUsers([]);
    }
  };

  const debouncedSearch = useCallback(debounce(handleSearch, 400), []);

  const handleChatPress = async (chat: Chat, other: User | null) => {
    if (forwardMode && messageToForwardId) {
      // Forward the message to this chat
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        console.log('📤 [forward] POST', `${CHAT_SERVICE_URL}/message/forward`, {
          messageId: messageToForwardId,
          targetChatId: chat._id,
        });
        const response = await fetch(`${CHAT_SERVICE_URL}/message/forward`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messageId: messageToForwardId,
            targetChatId: chat._id,
          }),
        });
        console.log('📤 [forward] Status:', response.status, response.statusText);

        if (response.ok) {
          Alert.alert('Thành công', 'Đã chuyển tiếp tin nhắn');
          // Clear forwarding mode and stored message ID
          setForwardMode(false);
          setMessageToForwardId(null);
          await AsyncStorage.removeItem('messageToForward');

          // Navigate to the chat
          hideTabBar();
          if (chat.isGroup) {
            // For group chat, navigate to GroupChatDetailScreen
            navigation.navigate(ROUTES.SCREENS.GROUP_CHAT_DETAIL as any, {
              chat: chat as any, // Convert to GroupInfo format
            });
          } else {
            navigation.navigate('ChatDetail', { user: other!, chatId: chat._id });
          }
        } else {
          const errorData = await response.json();
          Alert.alert('Lỗi', errorData.message || 'Không thể chuyển tiếp tin nhắn');
        }
      } catch (error) {
        console.error('Error forwarding message:', error);
        Alert.alert('Lỗi', 'Đã xảy ra lỗi khi chuyển tiếp tin nhắn');
      }
    } else {
      setLastVisitedChatId(chat._id); // Lưu ID của chat được visit
      setShouldRefresh(true); // Set flag để refresh khi quay lại
      hideTabBar();

      if (chat.isGroup) {
        // For group chat, navigate to GroupChatDetailScreen
        navigation.navigate(ROUTES.SCREENS.GROUP_CHAT_DETAIL as any, {
          chat: chat as any, // Convert to GroupInfo format
        });
      } else {
        navigation.navigate('ChatDetail', { user: other!, chatId: chat._id });
      }
    }
  };

  const renderUser = useCallback(
    ({ item }: { item: User }) => {
      const handleUserPress = () => {
        console.log('👆 [UserPress] item:', { _id: item._id, fullname: item.fullname });
        console.log('👆 [UserPress] existingChat:', existingChat?._id);
        // Tìm chat 1-1 hiện có với user này (chỉ những chat có tin nhắn)
        const existingChat =
          chats && Array.isArray(chats)
            ? chats.find(
                (chat) =>
                  !chat.isGroup && // Chỉ tìm chat 1-1, không phải group chat
                  chat.participants.length === 2 && // Đảm bảo là chat 1-1
                  chat.participants.some((p) => p._id === item._id) &&
                  chat.lastMessage // Chỉ những chat có tin nhắn
              )
            : null;

        setLastVisitedChatId(existingChat?._id || null); // Lưu ID của chat được visit
        setShouldRefresh(true); // Set flag để refresh khi quay lại
        hideTabBar();

        if (existingChat) {
          // Nếu đã có chat 1-1 với tin nhắn, navigate với chatId
          console.log('🧭 [UserPress] navigate ChatDetail with existing chatId', existingChat._id);
          navigation.navigate('ChatDetail', { user: item, chatId: existingChat._id });
        } else {
          // Nếu chưa có chat hoặc chat chưa có tin nhắn, chỉ navigate với user
          // ChatDetailScreen sẽ tự tạo chat khi gửi tin nhắn đầu tiên
          console.log('🧭 [UserPress] navigate ChatDetail with user only');
          navigation.navigate('ChatDetail', { user: item });
        }
      };

      return (
        <TouchableOpacity className="mr-4 w-20 items-center" onPress={handleUserPress}>
          <Avatar user={item} size={64} statusSize={15} />
          <Text className="mt-1 w-20 text-center font-medium text-xs" numberOfLines={1}>
            {item.fullname}
          </Text>
        </TouchableOpacity>
      );
    },
    [chats, hideTabBar, navigation]
  );

  const renderChat = ({ item, index }: { item: Chat; index: number }) => {
    if (!Array.isArray(item.participants)) {
      return null;
    }

    if (!currentUserId) {
      return null; // wait until we know who the current user is
    }

    // Check if this is a group chat
    const isGroupChat = item.isGroup;

    let displayName = '';
    let displayUser = null;

    if (isGroupChat) {
      // For group chat, display group name and member count
      displayName = item.name || 'Nhóm không tên';
    } else {
      // For 1-1 chat, find the other user
      const other = item.participants.find((p) => p._id !== currentUserId);
      if (!other) {
        return null;
      }
      displayName = other.fullname;
      displayUser = other;
    }

    // Format time
    const messageTime = item.lastMessage?.createdAt ? new Date(item.lastMessage.createdAt) : null;
    const formattedTime = messageTime
      ? messageTime.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    // Kiểm tra xem tin nhắn đã được đọc chưa - IMPROVED LOGIC
    const lastMessageSenderId =
      typeof item.lastMessage?.sender === 'object' && item.lastMessage?.sender !== null
        ? item.lastMessage.sender._id
        : item.lastMessage?.sender;

    // Use the helper function for consistent unread checking
    const hasUnreadMessage = isMessageUnread(item.lastMessage, currentUserId);

    // Xử lý nội dung tin nhắn cuối cùng để hiển thị
    let lastMessageContent = '';
    if (item.lastMessage) {
      // Kiểm tra loại tin nhắn và hiển thị tương ứng
      if (item.lastMessage.type === 'image') {
        lastMessageContent = 'Đã gửi ảnh';
      } else if (item.lastMessage.fileUrls && item.lastMessage.fileUrls.length > 0) {
        lastMessageContent = `${item.lastMessage.fileUrls.length} hình ảnh`;
      } else if (item.lastMessage.type === 'file') {
        lastMessageContent = 'Tệp đính kèm';
      } else {
        lastMessageContent = item.lastMessage.content || '';
      }

      // Thêm tên người gửi cho group chat
      if (
        isGroupChat &&
        typeof item.lastMessage.sender === 'object' &&
        item.lastMessage.sender !== null
      ) {
        const senderName = item.lastMessage.sender.fullname;
        if (lastMessageSenderId === currentUserId) {
          lastMessageContent = `Bạn: ${lastMessageContent}`;
        } else {
          lastMessageContent = `${senderName}: ${lastMessageContent}`;
        }
      } else if (!isGroupChat && lastMessageSenderId === currentUserId) {
        // Cho 1-1 chat, chỉ thêm "Bạn: " nếu là tin nhắn của mình
        lastMessageContent = `Bạn: ${lastMessageContent}`;
      }
    }

    return (
      <TouchableOpacity
        key={`chat-item-${item._id || index}`}
        className="flex-row items-center border-b border-gray-100 px-4 py-3"
        onPress={() => handleChatPress(item, displayUser)}>
        {isGroupChat ? (
          <GroupAvatar
            size={56}
            groupAvatar={item.avatar}
            participants={item.participants as any}
            currentUserId={currentUserId}
          />
        ) : (
          <Avatar user={displayUser} size={56} statusSize={15} />
        )}

        <View className="ml-4 flex-1">
          <View className="flex-row items-center">
            {isGroupChat && (
              <MaterialIcons name="group" size={16} color="#666" style={{ marginRight: 5 }} />
            )}

            <Text
              className={`${hasUnreadMessage ? 'font-bold' : 'font-medium'} flex text-lg`}
              numberOfLines={1}>
              {displayName}
            </Text>
          </View>

          <View className="flex-row items-center">
            {item.lastMessage?.isEmoji ? (
              (() => {
                const emoji = customEmojis.find((e) => e.code === item.lastMessage?.content);
                return emoji ? (
                  <Image
                    source={emoji.url}
                    style={{ width: 20, height: 20, marginRight: 4 }}
                    resizeMode="contain"
                  />
                ) : (
                  <Text
                    className={`${hasUnreadMessage ? 'font-bold text-secondary' : 'font-medium text-gray-500'} mr-1 text-base`}
                    numberOfLines={1}
                    style={{ maxWidth: '70%' }}>
                    {lastMessageContent}
                  </Text>
                );
              })()
            ) : (
              <Text
                className={`${hasUnreadMessage ? 'font-bold text-secondary' : 'font-medium text-gray-500'} mr-1 text-base`}
                numberOfLines={1}
                style={{ maxWidth: '70%' }}>
                {lastMessageContent}
              </Text>
            )}
          </View>
        </View>

        <View className="items-end">
          <Text
            className={`${hasUnreadMessage ? 'font-bold text-black' : 'font-medium text-gray-400'} mb-1 text-xs`}>
            {formattedTime}
          </Text>
          {/* Hiển thị dấu chấm đỏ thay vì số khi có tin nhắn chưa đọc */}
          {hasUnreadMessage && <View className="h-3 w-3 rounded-full bg-red-500" />}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading)
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="bg-white p-4">
          <WiscomLogo width={100} height={100} />
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StandardHeader
        logo={<WiscomLogo width={150} height={50} />}
        rightButton={
          <TouchableOpacity
            onPress={() => navigation.navigate(ROUTES.SCREENS.CREATE_GROUP as any)}
            className="rounded-full bg-white p-2"
            style={{ backgroundColor: '#fff' }}>
            <MaterialIcons name="group-add" size={24} color="#002855" />
          </TouchableOpacity>
        }
      />

      <View className="bg-white p-4">
        <View className="flex-row items-center rounded-full border border-gray-200 bg-white px-4 py-2">
          <MaterialIcons name="search" size={22} color="#BDBDBD" />
          <TextInput
            className="ml-2 flex-1 font-medium text-base text-gray-400"
            style={{
              height: 36,
              paddingVertical: 0,
              textAlignVertical: 'center',
              marginTop: 0,
              marginBottom: 0,
            }}
            placeholder="Tìm kiếm"
            placeholderTextColor="#BDBDBD"
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              debouncedSearch(text);
            }}
            underlineColorAndroid="transparent"
          />
        </View>
      </View>

      <View className="mt-2">
        {getSortedUsers.length > 0 ? (
          <FlatList
            data={getSortedUsers}
            horizontal
            keyExtractor={(item) => item._id}
            renderItem={renderUser}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={10}
            removeClippedSubviews={true}
            getItemLayout={(data, index) => ({
              length: 80, // width của mỗi user item
              offset: 80 * index,
              index,
            })}
          />
        ) : (
          <View className="px-4 py-8">
            <Text className="text-center font-medium text-gray-500">
              {search.trim()
                ? 'Không tìm thấy người dùng nào'
                : users.length === 0
                  ? 'Đang tải danh sách người dùng...'
                  : 'Không có người dùng để hiển thị'}
            </Text>
          </View>
        )}
      </View>

      <Text className="mb-[2%] ml-[5%] mt-[6%] font-semibold text-xl text-gray-900">
        Sảnh tâm sự
      </Text>
      {chats.length === 0 ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-center font-medium text-gray-500">
            {currentUserId
              ? 'Không có cuộc trò chuyện nào. Hãy bắt đầu cuộc trò chuyện mới!'
              : 'Đang đợi xác định người dùng...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item, index) => (item._id ? item._id.toString() : `chat-${index}`)}
          renderItem={({ item, index }) => renderChat({ item, index })}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      )}
    </SafeAreaView>
  );
};

export default ChatScreen;
