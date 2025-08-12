import React, {
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  useMemo,
  memo,
} from 'react';
// @ts-ignore
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  SafeAreaView,
  Linking,
  Alert,
  ActionSheetIOS,
  ScrollView,
  Dimensions,
  Modal,
  StatusBar,
  PanResponder,
  GestureResponderEvent,
  Keyboard,
  ImageBackground,
  Animated,
  Pressable,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Platform, UIManager } from 'react-native';
// @ts-ignore
import { LayoutAnimation } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
// Enable LayoutAnimation on Android
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { User } from '../../navigation/AppNavigator';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import Entypo from '@expo/vector-icons/Entypo';
import { jwtDecode } from 'jwt-decode';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useOnlineStatus } from '../../context/OnlineStatusContext';
import { Video, ResizeMode } from 'expo-av';
import ImageViewing from 'react-native-image-viewing';
// @ts-ignore
import { AppState, AppStateStatus } from 'react-native';
import { BASE_URL, CHAT_SERVICE_URL } from '../../config/constants';
import { ROUTES } from '../../constants/routes';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MessageReactionModal from '../../components/Chat/MessageReactionModal';
import PinnedMessageBanner from '../../components/Chat/PinnedMessageBanner';
import NotificationModal from '../../components/NotificationModal';
import { Message, Chat } from '../../types/message';
import { NotificationType, ChatDetailParams } from '../../types/chat';
import { CustomEmoji } from '../../hooks/useEmojis';
import ImageGrid from '../../components/Chat/ImageGrid';
import MessageBubble from '../../components/Chat/MessageBubble';
import SwipeableMessageBubble from '../../components/Chat/SwipeableMessageBubble';
import ImageViewerModal from '../../components/Chat/ImageViewerModal';
import ForwardMessageSheet from '../../components/Chat/ForwardMessageSheet';
import {
  formatMessageTime,
  formatMessageDate,
  getAvatar,
  isDifferentDay,
} from '../../utils/messageUtils';
import MessageStatus from '../../components/Chat/MessageStatus';
import { getMessageGroupPosition } from '../../utils/messageGroupUtils';
import EmojiPicker from '../../components/Chat/EmojiPicker';
import { useEmojis } from '../../hooks/useEmojis';
import ConfirmModal from '../../components/ConfirmModal';
import ChatInputBar from '../../components/Chat/ChatInputBar';
import { useSocket } from '../../hooks/useSocket';
import { useMessageOperations } from '../../hooks/useMessageOperations';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TypingIndicator = memo(() => {
  const [dots, setDots] = useState('.');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === '...') return '.';
        if (prev === '..') return '...';
        if (prev === '.') return '..';
        return '.';
      });
    }, 500); // Tăng từ 400ms lên 500ms để mượt hơn

    // Thêm animation scale nhẹ cho dots
    const scaleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    scaleAnimation.start();

    return () => {
      clearInterval(interval);
      scaleAnimation.stop();
    };
  }, [scaleAnim]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}>
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#4A4A4A',
            marginRight: 4,
            opacity: dots.length >= 1 ? 1 : 0.3,
          }}
        />
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#4A4A4A',
            marginRight: 4,
            opacity: dots.length >= 2 ? 1 : 0.3,
          }}
        />
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#4A4A4A',
            marginRight: 8,
            opacity: dots.length >= 3 ? 1 : 0.3,
          }}
        />
      </Animated.View>
      <Text
        style={{
          color: '#4A4A4A',
          fontSize: 12,
          fontStyle: 'italic',
          fontFamily: 'Mulish-Italic',
        }}>
        đang soạn tin...
      </Text>
    </View>
  );
});

type Props = NativeStackScreenProps<RootStackParamList, 'ChatDetail'>;

// Thêm hàm kiểm tra một chuỗi có phải là một emoji duy nhất không
const isSingleEmoji = (str: string): boolean => {
  // Regex đơn giản kiểm tra chuỗi kí tự đơn
  return str.length <= 2;
};

const ChatDetailScreen = ({ route, navigation }: Props) => {
  const { user: chatPartner, chatId: routeChatId } = route.params;
  const [chat, setChat] = useState<Chat | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const { customEmojis, loading: emojisLoading } = useEmojis();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);

  const [input, setInput] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const navigationProp =
    useNavigation<NativeStackNavigationProp<{ ChatDetail: ChatDetailParams }, 'ChatDetail'>>();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const { isUserOnline, getFormattedLastSeen } = useOnlineStatus();
  const [imagesToSend, setImagesToSend] = useState<any[]>([]);
  const bottomSheetHeight = 60 + (insets.bottom || 10);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [isScreenActive, setIsScreenActive] = useState(true);
  const chatIdRef = useRef<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [reactionModalPosition, setReactionModalPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageScaleAnim = useRef(new Animated.Value(1)).current;
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState<CustomEmoji | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [isLoadingPinnedMessage, setIsLoadingPinnedMessage] = useState(false);
  const [notification, setNotification] = useState<{
    visible: boolean;
    type: 'success' | 'error';
    message: string;
  }>({
    visible: false,
    type: 'success',
    message: '',
  });
  const [showForwardSheet, setShowForwardSheet] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [messageToRevoke, setMessageToRevoke] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Sử dụng custom hooks
  const messageOps = useMessageOperations({
    chat,
    currentUserId,
  });

  // Socket event handlers
  const handleUserOnline = useCallback(
    (data: { userId: string }) => {
      if (data.userId === chatPartner._id) {
        setIsOnline(true);
      }
    },
    [chatPartner._id]
  );

  const handleUserOffline = useCallback(
    (data: { userId: string }) => {
      if (data.userId === chatPartner._id) {
        setIsOnline(false);
      }
    },
    [chatPartner._id]
  );

  const handleUserStatus = useCallback(
    (data: { userId: string; status: string; lastSeen?: string }) => {
      if (data.userId === chatPartner._id) {
        if (data.status === 'offline') {
          setIsOnline(false);
        } else {
          setIsOnline(true);
        }
      }
    },
    [chatPartner._id]
  );

  // Chỉ sử dụng socket cho chat 1-1
  const socketConnection = useSocket({
    authToken,
    chatId: chat?._id || '',
    currentUserId,
    chatPartner,
    isScreenActive,
    onNewMessage: messageOps.handleNewMessage,
    onMessageRead: messageOps.handleMessageRead,
    onMessageRevoked: messageOps.handleMessageRevoked,
    onUserOnline: handleUserOnline,
    onUserOffline: handleUserOffline,
    onUserStatus: handleUserStatus,
  });

  // Focus & blur handlers for tracking when screen is active/inactive
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsScreenActive(true);

      // Emit messageRead ngay lập tức khi focus
      if (
        currentUserId &&
        chatIdRef.current &&
        socketConnection.socket &&
        socketConnection.socket.connected
      ) {
        socketConnection.emitMessageRead(currentUserId, chatIdRef.current);
      }

      // Mark messages as read when screen comes into focus với delay nhỏ
      setTimeout(() => {
        if (currentUserId && chatIdRef.current) {
          const fetchToken = async () => {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
              messageOps.markMessagesAsRead(chatIdRef.current, currentUserId, token);
            }
          };
          fetchToken();
        }
      }, 500);
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsScreenActive(false);
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, currentUserId, messageOps.markMessagesAsRead, socketConnection]);

  // Lấy authToken khi component mount
  useEffect(() => {
    const getAuthToken = async () => {
      const token = await AsyncStorage.getItem('authToken');
      setAuthToken(token);
    };
    getAuthToken();
  }, []);

  useEffect(() => {
    // Lấy currentUserId từ token
    const fetchCurrentUser = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        try {
          const decoded: any = jwtDecode(token);
          const userId = decoded._id || decoded.id;

          // Lấy thông tin đầy đủ của current user từ API
          const response = await fetch(`${BASE_URL}/api/users/${userId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const userData = await response.json();
            setCurrentUser(userData);
            setCurrentUserId(userId);
          }
        } catch (err) {
          console.error('Error fetching current user:', err);
        }
      }
    };
    fetchCurrentUser();
  }, []);

  useLayoutEffect(() => {
    const parent = navigation.getParent?.();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  useEffect(() => {
    if (!currentUserId) return;

    const fetchData = async () => {
      try {
        const authToken = await AsyncStorage.getItem('authToken');
        if (!authToken) {
          console.log('No auth token available for fetchData');
          return;
        }

        if (routeChatId) {
          // Lấy thông tin chat
          const chatRes = await fetch(`${CHAT_SERVICE_URL}/${routeChatId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });

          if (!chatRes.ok) {
            const contentType = chatRes.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
              console.warn(`💡 Chat API endpoint not available (Status: ${chatRes.status})`);
              console.warn('Backend server may not be running or endpoint not implemented yet.');
              return;
            }

            const errorText = await chatRes.text();
            console.warn('Chat API unavailable:', chatRes.status, errorText);
            return;
          }

          // Kiểm tra content type trước khi parse JSON
          const contentType = chatRes.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const responseText = await chatRes.text();
            console.warn('Chat API returned non-JSON response:', responseText.substring(0, 100));
            return;
          }

          const chatData = await chatRes.json();
          setChat(chatData);
          chatIdRef.current = routeChatId;

          // Lấy tin nhắn đã ghim
          await fetchPinnedMessages(routeChatId);
        } else {
          // Trường hợp không có chatId - tạo chat mới hoặc tìm chat hiện có
          try {
            const createChatRes = await fetch(`${CHAT_SERVICE_URL}/createOrGet`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                participantId: chatPartner._id,
              }),
            });

            if (createChatRes.ok) {
              // Kiểm tra content type
              const contentType = createChatRes.headers.get('content-type');
              if (!contentType || !contentType.includes('application/json')) {
                const responseText = await createChatRes.text();
                console.error('Expected JSON but got:', responseText.substring(0, 200));
                return;
              }

              const chatData = await createChatRes.json();
              setChat(chatData);
              chatIdRef.current = chatData._id;

              // Lấy tin nhắn đã ghim
              await fetchPinnedMessages(chatData._id);
            } else {
              const errorText = await createChatRes.text();
              console.error('Failed to create/get chat:', createChatRes.status, errorText);
            }
          } catch (createError) {
            console.error('Error creating chat:', createError);
          }
        }
      } catch (err) {
        console.error('Error in fetchData:', err);
      }
    };

    fetchData();
  }, [chatPartner._id, routeChatId, currentUserId]); // Removed messageOps.loadMessages to prevent reload loop

  // Separate useEffect to load messages when chat is available
  useEffect(() => {
    if (chat?._id && currentUserId) {
      console.log('🔄 [ChatDetailScreen] Loading initial messages for chat:', chat._id);

      messageOps.loadMessages(chat._id);
    }
  }, [chat?._id, currentUserId, navigation]); // Only depend on chat._id and currentUserId

  // Optimized real-time online/offline status tracking
  useEffect(() => {
    if (!socketConnection.socket || !chat?._id || !currentUserId) return;

    console.log('📡 [ChatDetailScreen] Emitting user online for chat:', chat._id);
    socketConnection.emitUserOnline();

    // Kiểm tra trạng thái của chat partner sau một khoảng thời gian
    const checkPartnerTimeout = setTimeout(() => {
      if (socketConnection.socket && socketConnection.socket.connected) {
        socketConnection.checkUserStatus(chatPartner._id);
      }
    }, 2000);

    return () => {
      clearTimeout(checkPartnerTimeout);
    };
  }, [chat?._id, currentUserId]); // Chỉ phụ thuộc vào các giá trị core, bỏ các object references

  // Debounced typing handler
  const handleInputChange = useCallback(
    (text: string) => {
      setInput(text);

      if (!socketConnection.socket || !chat?._id || !currentUserId) {
        return;
      }

      // Emit typing event
      socketConnection.emitTyping();
    },
    [chat?._id, currentUserId, socketConnection]
  );

  // Hàm gửi tin nhắn sử dụng messageOps
  const sendMessage = useCallback(
    async (emojiParam?: CustomEmoji) => {
      if (!input.trim() && !emojiParam) return;

      console.log('🚀 [ChatDetailScreen] Starting to send message, input:', input);

      const replyToMessage = replyTo;
      const originalInput = input; // Lưu lại input gốc
      setReplyTo(null);

      const result = await messageOps.sendMessage(input, emojiParam, replyToMessage?._id);

      console.log('🚀 [ChatDetailScreen] Send message result:', result);

      if (result && result._id) {
        // Chỉ clear input khi gửi thành công và có _id
        console.log('✅ [ChatDetailScreen] Message sent successfully, clearing input');
        setInput('');

        // Use more performant animation config
        LayoutAnimation.configureNext({
          duration: 200,
          create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
          update: {
            type: LayoutAnimation.Types.easeInEaseOut,
          },
        });
      } else {
        // Khôi phục replyTo nếu gửi thất bại (input vẫn giữ nguyên)
        console.log('❌ [ChatDetailScreen] Message failed to send, keeping input');
        setReplyTo(replyToMessage);
      }
    },
    [input, messageOps.sendMessage, replyTo]
  );

  // Hàm upload file/ảnh lên server sử dụng messageOps
  const uploadAttachment = useCallback(
    async (file: any, type: 'image' | 'file') => {
      const result = await messageOps.uploadAttachment(file, type);
      if (result) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
    },
    [messageOps.uploadAttachment]
  );

  // Upload nhiều ảnh sử dụng messageOps
  const uploadMultipleImages = useCallback(
    async (images: any[]) => {
      const result = await messageOps.uploadMultipleImages(images);
      if (result) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
    },
    [messageOps.uploadMultipleImages]
  );

  // Hàm chọn file
  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled) {
      await uploadAttachment(result, 'file');
    }
  };

  // Xử lý khi app chuyển từ background sang foreground
  useEffect(() => {
    let subscription: any;

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active' && isScreenActive && currentUserId && chat?._id) {
          // Đánh dấu tin nhắn là đã đọc khi quay lại từ background
          const markAsRead = async () => {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
              messageOps.markMessagesAsRead(chat._id, currentUserId, token);
            }
          };
          markAsRead();
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isScreenActive, currentUserId, chat?._id, messageOps.markMessagesAsRead]);

  // Kiểm tra và cập nhật thông tin đầy đủ của chat
  useEffect(() => {
    const fetchFullChatInfo = async () => {
      if (!chat?._id || !currentUserId) return;

      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        // Lấy thông tin đầy đủ của chat bao gồm participants
        const response = await fetch(`${CHAT_SERVICE_URL}/${chat._id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const fullChatData = await response.json();
          // Cập nhật thông tin chat với danh sách participants đầy đủ
          setChat(fullChatData);
        }
      } catch (error) {
        console.error('Error fetching full chat info:', error);
      }
    };

    fetchFullChatInfo();
  }, [chat?._id, currentUserId]);

  // Listen for keyboard events
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );
    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Hàm xử lý khi bắt đầu nhấn giữ tin nhắn
  const handleMessageLongPressIn = (message: Message, event: GestureResponderEvent) => {
    // Bắt đầu đếm thời gian nhấn giữ
    longPressTimeoutRef.current = setTimeout(() => {
      setSelectedMessage(message);
      // Lưu vị trí để hiển thị modal với kiểm tra an toàn
      if (event?.nativeEvent?.pageX !== undefined && event?.nativeEvent?.pageY !== undefined) {
        setReactionModalPosition({
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
        });
      } else {
        // Fallback position khi event không có pageX/pageY
        setReactionModalPosition({
          x: 200, // vị trí mặc định
          y: 400,
        });
      }

      // Hiệu ứng phóng to tin nhắn
      Animated.sequence([
        Animated.timing(messageScaleAnim, {
          toValue: 1.05,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(messageScaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Hiển thị modal reaction
      setShowReactionModal(true);
    }, 500); // Thời gian nhấn giữ (500ms = 0.5 giây)
  };

  // Hàm xử lý khi kết thúc nhấn giữ tin nhắn
  const handleMessageLongPressOut = () => {
    // Xóa timeout nếu người dùng nhả tay ra trước khi đủ thời gian
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  // Thêm hàm refreshMessages
  const refreshMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!chat?._id || !token) return;

      const msgRes = await fetch(`${CHAT_SERVICE_URL}/messages/${chat._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const msgData = await msgRes.json();
      if (Array.isArray(msgData)) {
        const sortedMessages = [...msgData].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        messageOps.setMessages(sortedMessages);
      }
    } catch (error) {
      console.error('Lỗi khi refresh tin nhắn:', error);
    }
  };

  // Sửa lại hàm handleReactionSelect
  const handleReactionSelect = async (reaction: { code: string; isCustom: boolean }) => {
    if (!selectedMessage) return false;
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${CHAT_SERVICE_URL}/message/${selectedMessage._id}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          emojiCode: reaction.code,
          isCustom: reaction.isCustom,
        }),
      });
      if (!res.ok) {
        console.error('Failed to add reaction:', res.status);
        return false;
      }
      // Get updated message from server
      const updatedMessage: Message = await res.json();
      // Update local state to include new reactions
      messageOps.setMessages((prev) =>
        prev.map((msg) => (msg._id === updatedMessage._id ? updatedMessage : msg))
      );
      // Close the reaction modal
      closeReactionModal();
      return true;
    } catch (error) {
      console.error('Error sending reaction:', error);
      return false;
    }
  };

  // Đóng modal reaction
  const closeReactionModal = () => {
    setShowReactionModal(false);
    setSelectedMessage(null);
    setReactionModalPosition(null);
  };

  // Trong component Message hiển thị tin nhắn và reaction
  const renderReaction = (reaction: { emojiCode: string; isCustom: boolean }) => {
    if (!reaction.isCustom) {
      // Unicode emoji (nếu còn dùng)
      return <Text>{reaction.emojiCode}</Text>;
    } else {
      // Custom emoji/GIF từ URL
      const emoji = customEmojis.find((e) => e.code === reaction.emojiCode);
      if (!emoji) return null;

      return (
        <Image
          source={emoji.url}
          style={{ width: 24, height: 24, marginRight: 20, marginBottom: 12 }}
          resizeMode="contain"
        />
      );
    }
  };

  // Sửa lại hàm xử lý action
  const handleActionSelect = (action: string) => {
    if (!selectedMessage?._id) return;

    console.log('📌 [ChatDetailScreen] handleActionSelect called with action:', action);

    switch (action) {
      case 'forward':
        setForwardMessage(selectedMessage);
        setShowForwardSheet(true);
        closeReactionModal();
        break;
      case 'reply':
        setReplyTo(selectedMessage);
        closeReactionModal();
        break;
      case 'copy':
        Clipboard.setString(selectedMessage.content);
        setNotification({
          visible: true,
          type: 'success',
          message: 'Đã sao chép nội dung tin nhắn',
        });
        closeReactionModal();
        break;
      case 'pin':
        console.log('📌 [Pin Action] Pinning message');
        handlePinMessage(selectedMessage._id);
        closeReactionModal();
        break;
      case 'unpin':
        console.log('📌 [Unpin Action] Unpinning message');
        handleUnpinMessage(selectedMessage._id);
        closeReactionModal();
        break;
      default:
        console.log('📌 [Action] Unknown action:', action);
        break;
    }
  };

  // Handle selecting an emoji and delegate to sendMessage
  const handleSendEmoji = async (emoji: CustomEmoji) => {
    if (!chat) return;
    setShowEmojiPicker(false); // đóng picker
    await sendMessage(emoji); // truyền emoji vào hàm gửi
  };

  // Thêm hàm xử lý tin nhắn ghim
  const handlePinMessage = async (messageId: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${CHAT_SERVICE_URL}/message/${messageId}/pin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const pinnedMessage = await response.json();

        // Lấy lại toàn bộ danh sách tin nhắn đã ghim
        if (chatIdRef.current) {
          const pinnedRes = await fetch(
            `${CHAT_SERVICE_URL}/${chatIdRef.current}/pinned-messages`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const pinnedData = await pinnedRes.json();
          if (Array.isArray(pinnedData)) {
            setPinnedMessages(pinnedData);
          }
        }

        // Cập nhật trạng thái isPinned trong danh sách tin nhắn
        messageOps.setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? { ...msg, isPinned: true, pinnedBy: currentUserId || undefined }
              : msg
          )
        );

        setNotification({
          visible: true,
          type: 'success',
          message: 'Đã ghim tin nhắn',
        });
      } else {
        const error = await response.json();
        if (error.pinnedCount >= 3) {
          setNotification({
            visible: true,
            type: 'error',
            message: 'Đã đạt giới hạn tin nhắn ghim (tối đa 3 tin nhắn)',
          });
        } else {
          setNotification({
            visible: true,
            type: 'error',
            message: error.message || 'Không thể ghim tin nhắn',
          });
        }
      }
    } catch (error) {
      console.error('Lỗi khi ghim tin nhắn:', error);
      setNotification({
        visible: true,
        type: 'error',
        message: 'Không thể ghim tin nhắn',
      });
    }
  };

  // Hàm xử lý bỏ ghim tin nhắn
  const handleUnpinMessage = async (messageId: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${CHAT_SERVICE_URL}/message/${messageId}/pin`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Cập nhật trạng thái isPinned trong danh sách tin nhắn
        messageOps.setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId ? { ...msg, isPinned: false, pinnedBy: undefined } : msg
          )
        );

        // Reload toàn bộ dữ liệu chat
        if (chatIdRef.current) {
          try {
            // Lấy lại danh sách tin nhắn đã ghim
            const pinnedRes = await fetch(
              `${CHAT_SERVICE_URL}/${chatIdRef.current}/pinned-messages`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            const pinnedData = await pinnedRes.json();
            if (Array.isArray(pinnedData)) {
              setPinnedMessages(pinnedData);
            }

            // Lấy lại toàn bộ tin nhắn
            const msgRes = await fetch(`${CHAT_SERVICE_URL}/messages/${chatIdRef.current}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const msgData = await msgRes.json();
            if (Array.isArray(msgData)) {
              // Sắp xếp tin nhắn từ cũ đến mới
              const sortedMessages = [...msgData].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
              messageOps.setMessages(sortedMessages);
            }
          } catch (reloadError) {
            console.error('Lỗi khi reload dữ liệu sau khi bỏ ghim:', reloadError);
          }
        }

        setNotification({
          visible: true,
          type: 'success',
          message: 'Đã bỏ ghim tin nhắn',
        });
      } else {
        setNotification({
          visible: true,
          type: 'error',
          message: 'Không thể bỏ ghim tin nhắn',
        });
      }
    } catch (error) {
      console.error('Lỗi khi bỏ ghim tin nhắn:', error);
      setNotification({
        visible: true,
        type: 'error',
        message: 'Không thể bỏ ghim tin nhắn',
      });
    }
  };

  // Thêm hàm xử lý tin nhắn ghim
  const handlePinnedMessagePress = async (message: Message) => {
    try {
      console.log('📌 Navigating to pinned message:', message._id);

      // Highlight tin nhắn ngay lập tức để người dùng thấy phản hồi
      setHighlightedMessageId(message._id);

      // Tìm index trong processedMessages trước
      let targetIndex = -1;
      for (let i = 0; i < processedMessages.length; i++) {
        if (processedMessages[i]._id === message._id) {
          targetIndex = i;
          break;
        }
      }

      // Nếu tìm thấy trong processedMessages, scroll ngay lập tức
      if (targetIndex !== -1 && flatListRef.current) {
        console.log('📌 Found in current data, scrolling to index:', targetIndex);
        flatListRef.current.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0.5,
          viewOffset: 0,
        });

        // Tắt highlight sau 3 giây
        setTimeout(() => {
          setHighlightedMessageId(null);
        }, 3000);
        return;
      }

      // Nếu không tìm thấy, load thêm messages
      console.log('📌 Message not found in current data, loading more...');
      setIsLoadingPinnedMessage(true);

      // Tìm index của tin nhắn trong danh sách messages gốc
      let messageIndex = messageOps.messages.findIndex((msg) => msg._id === message._id);

      // Nếu không tìm thấy trong messages hiện tại, load tất cả messages
      if (messageIndex === -1) {
        console.log('📌 Pinned message not found in current messages, loading all messages...');
        setIsLoadingPinnedMessage(true);

        try {
          const token = await AsyncStorage.getItem('authToken');
          if (!chat?._id || !token) {
            setNotification({
              visible: true,
              type: 'error',
              message: 'Không thể tải tin nhắn',
            });
            return;
          }

          // Load tất cả messages có thể với limit tối đa
          const response = await fetch(
            `${CHAT_SERVICE_URL}/messages/${chat._id}?page=1&limit=100`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            let allMessages = [];

            if (
              data &&
              typeof data === 'object' &&
              data.success === true &&
              Array.isArray(data.messages)
            ) {
              allMessages = data.messages;
            } else if (Array.isArray(data)) {
              allMessages = data;
            }

            if (allMessages.length > 0) {
              // Validate và sort messages
              const validMessages = allMessages.filter(
                (msg) => msg && msg._id && msg.sender && msg.createdAt
              );

              const sortedMessages = validMessages.sort(
                (a: Message, b: Message) =>
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );

              messageOps.setMessages(sortedMessages);

              // Tìm lại index sau khi load messages
              messageIndex = sortedMessages.findIndex((msg) => msg._id === message._id);

              // Nếu vẫn không tìm thấy, load thêm trang
              if (messageIndex === -1 && data.pagination?.hasMore) {
                console.log('📌 Still not found, loading more pages...');
                let currentPage = 2;
                let found = false;

                while (!found && currentPage <= 10) {
                  // Giới hạn tối đa 10 trang để tránh vô hạn
                  const nextResponse = await fetch(
                    `${CHAT_SERVICE_URL}/messages/${chat._id}?page=${currentPage}&limit=100`,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                      },
                    }
                  );

                  if (nextResponse.ok) {
                    const nextData = await nextResponse.json();
                    let nextMessages = [];

                    if (
                      nextData &&
                      typeof nextData === 'object' &&
                      nextData.success === true &&
                      Array.isArray(nextData.messages)
                    ) {
                      nextMessages = nextData.messages;
                    } else if (Array.isArray(nextData)) {
                      nextMessages = nextData;
                    }

                    if (nextMessages.length > 0) {
                      const validNextMessages = nextMessages.filter(
                        (msg) => msg && msg._id && msg.sender && msg.createdAt
                      );

                      const sortedNextMessages = validNextMessages.sort(
                        (a: Message, b: Message) =>
                          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                      );

                      // Thêm messages mới vào đầu danh sách (tin nhắn cũ hơn)
                      const combinedMessages = [...sortedNextMessages, ...sortedMessages];
                      messageOps.setMessages(combinedMessages);

                      // Tìm message trong danh sách kết hợp
                      messageIndex = combinedMessages.findIndex((msg) => msg._id === message._id);

                      if (messageIndex !== -1) {
                        found = true;
                        break;
                      }
                    }

                    // Kiểm tra xem còn trang nào không
                    if (!nextData.pagination?.hasMore) {
                      break;
                    }
                  } else {
                    break;
                  }

                  currentPage++;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error loading all messages:', error);
          setNotification({
            visible: true,
            type: 'error',
            message: 'Không thể tải tin nhắn để tìm tin nhắn được ghim',
          });
          return;
        } finally {
          setIsLoadingPinnedMessage(false);
        }
      }

      // Kiểm tra lại sau khi load all messages
      if (messageIndex === -1) {
        console.warn('📌 Pinned message still not found after loading all messages');
        setNotification({
          visible: true,
          type: 'error',
          message: 'Không tìm thấy tin nhắn này trong cuộc trò chuyện',
        });
        return;
      }

      // Đợi một chút để React re-render và processedMessages được cập nhật
      setTimeout(() => {
        // Tính toán index trong processedMessages (có thể có time separators)
        let targetIndex = -1;
        for (let i = 0; i < processedMessages.length; i++) {
          if (processedMessages[i]._id === message._id) {
            targetIndex = i;
            break;
          }
        }

        if (targetIndex !== -1 && flatListRef.current) {
          console.log('📌 Scrolling to message at index:', targetIndex);

          // Sử dụng scrollToOffset thay vì scrollToIndex để an toàn hơn
          flatListRef.current.scrollToIndex({
            index: targetIndex,
            animated: true,
            viewPosition: 0.5,
            viewOffset: 0,
          });

          // Backup method nếu scrollToIndex fails
          setTimeout(() => {
            if (flatListRef.current) {
              try {
                flatListRef.current.scrollToIndex({
                  index: targetIndex,
                  animated: false,
                  viewPosition: 0.5,
                });
              } catch (scrollError) {
                console.log('📌 Using fallback scroll method');
                // Fallback: scroll to approximate position
                const estimatedOffset = targetIndex * 80; // Estimate message height
                flatListRef.current.scrollToOffset({
                  offset: estimatedOffset,
                  animated: true,
                });
              }
            }
          }, 100);
        }
      }, 50); // Giảm từ 200ms xuống 50ms

      // Tắt highlight sau 3 giây
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 3000);
    } catch (error) {
      console.error('📌 Error navigating to pinned message:', error);
      setNotification({
        visible: true,
        type: 'error',
        message: 'Không thể cuộn đến tin nhắn này',
      });
    }
  };

  // Thêm hàm xử lý nhấp vào tin nhắn reply
  const handleReplyMessagePress = (message: Message) => {
    try {
      console.log('💬 Navigating to replied message:', message._id);

      // Tìm index của tin nhắn trong danh sách messages gốc
      const messageIndex = messageOps.messages.findIndex((msg) => msg._id === message._id);

      if (messageIndex === -1) {
        console.warn('💬 Replied message not found in current messages list');
        setNotification({
          visible: true,
          type: 'error',
          message: 'Không tìm thấy tin nhắn được trả lời',
        });
        return;
      }

      // Highlight tin nhắn
      setHighlightedMessageId(message._id);

      // Đợi một chút để React re-render và processedMessages được cập nhật
      setTimeout(() => {
        // Tính toán index trong processedMessages (có thể có time separators)
        let targetIndex = -1;
        for (let i = 0; i < processedMessages.length; i++) {
          if (processedMessages[i]._id === message._id) {
            targetIndex = i;
            break;
          }
        }

        if (targetIndex !== -1 && flatListRef.current) {
          console.log('💬 Scrolling to message at index:', targetIndex);

          // Sử dụng scrollToIndex với error handling
          flatListRef.current.scrollToIndex({
            index: targetIndex,
            animated: true,
            viewPosition: 0.5,
            viewOffset: 0,
          });

          // Backup method nếu scrollToIndex fails
          setTimeout(() => {
            if (flatListRef.current) {
              try {
                flatListRef.current.scrollToIndex({
                  index: targetIndex,
                  animated: false,
                  viewPosition: 0.5,
                });
              } catch (scrollError) {
                console.log('💬 Using fallback scroll method');
                // Fallback: scroll to approximate position
                const estimatedOffset = targetIndex * 80; // Estimate message height
                flatListRef.current.scrollToOffset({
                  offset: estimatedOffset,
                  animated: true,
                });
              }
            }
          }, 100);
        }
      }, 200); // Đợi 200ms để React re-render
    } catch (error) {
      console.error('💬 Error navigating to replied message:', error);
      setNotification({
        visible: true,
        type: 'error',
        message: 'Không thể cuộn đến tin nhắn được trả lời',
      });
    }
  };

  // Memoize processed messages data
  const processedMessages = useMemo(() => {
    const messagesWithTime: any[] = [];
    for (let i = 0; i < messageOps.messages.length; i++) {
      const item = messageOps.messages[i];
      const prevMsg = messageOps.messages[i - 1];
      const isDifferentDay =
        prevMsg?.createdAt &&
        new Date(item.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
      const timeGap = prevMsg?.createdAt
        ? new Date(item.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()
        : null;
      const showTime =
        !prevMsg?.createdAt || isDifferentDay || (!!timeGap && timeGap > 10 * 60 * 1000);

      if (showTime) {
        messagesWithTime.push({
          type: 'time',
          time: item.createdAt,
          _id: `time-${item.createdAt}-${item._id}`,
        });
      }
      messagesWithTime.push(item);
    }
    const processed = [...messagesWithTime].reverse();
    return processed;
  }, [messageOps.messages]);

  // Thêm hàm xử lý swipe reply
  const handleSwipeReply = useCallback((message: Message) => {
    setReplyTo(message);
    // Có thể thêm haptic feedback ở đây nếu muốn
    // import { Haptics } from 'expo-haptics';
    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // Memoized key extractor
  const keyExtractor = useCallback((item: Message | any) => {
    return item.type === 'time' ? item._id : item._id;
  }, []);

  // Thêm hàm xử lý chuyển tiếp tin nhắn
  const handleForwardMessage = async (userId: string) => {
    if (!selectedMessage?._id) return; // Thêm check null/undefined

    try {
      const response = await fetch(`${BASE_URL}/api/messages/forward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await AsyncStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          messageId: selectedMessage._id,
          toUserId: userId,
          fromUserId: currentUser?._id,
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể chuyển tiếp tin nhắn');
      }

      return await response.json();
    } catch (error) {
      console.error('Lỗi khi chuyển tiếp tin nhắn:', error);
      throw error;
    }
  };

  const handleForwardToUser = async (userId: string) => {
    try {
      if (!selectedMessage || !currentUserId) return;

      const response = await fetch(`${BASE_URL}/api/messages/forward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await AsyncStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          messageId: selectedMessage._id,
          toUserId: userId,
          fromUserId: currentUserId,
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể chuyển tiếp tin nhắn');
      }

      setNotification({
        visible: true,
        type: 'success',
        message: 'Đã chuyển tiếp tin nhắn thành công',
      });
      setShowForwardSheet(false);
      setSelectedMessage(null);
    } catch (error) {
      console.error('Lỗi khi chuyển tiếp tin nhắn:', error);
      setNotification({
        visible: true,
        type: 'error',
        message: 'Không thể chuyển tiếp tin nhắn',
      });
    }
  };

  // Thêm hàm chuyển đổi ảnh sang WebP
  const convertToWebP = async (uri: string): Promise<string> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [], // Không thay đổi kích thước hoặc xoay ảnh
        {
          compress: 0.7, // Nén ảnh với chất lượng 70%
          format: ImageManipulator.SaveFormat.WEBP,
        }
      );
      return result.uri;
    } catch (error) {
      console.error('Lỗi khi chuyển đổi ảnh sang WebP:', error);
      return uri; // Trả về URI gốc nếu có lỗi
    }
  };

  // Hàm xử lý khi nhấn vào ảnh
  const handleImagePress = (images: string[], index: number) => {
    const processedImages = images.map((url) => ({
      uri: url.startsWith('http') ? url : `${BASE_URL}${url}`,
    }));
    setViewerImages(processedImages);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  };

  // Optimized renderItem with better memoization
  const renderItem = useCallback(
    ({ item, index }: { item: Message | any; index: number }) => {
      if (item.type === 'time') {
        const d = new Date(item.time);
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dayStr = days[d.getDay()];
        const dateStr = `${d.getDate()} Tháng ${d.getMonth() + 1}`;
        const hour = d.getHours().toString().padStart(2, '0');
        const min = d.getMinutes().toString().padStart(2, '0');
        return (
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <Text style={{ color: '#BEBEBE', fontSize: 14, fontFamily: 'Mulish-Semibold' }}>
              {`${dayStr}, ${dateStr}, lúc ${hour}:${min}`}
            </Text>
          </View>
        );
      }

      const { isFirst, isLast } = getMessageGroupPosition(processedMessages, index, isDifferentDay);
      const isMe =
        currentUserId &&
        item.sender &&
        typeof item.sender === 'object' &&
        item.sender._id === currentUserId;
      const showAvatar = !isMe && isFirst;

      return (
        <SwipeableMessageBubble
          chat={chat}
          message={item}
          currentUserId={currentUserId}
          customEmojis={customEmojis}
          isFirst={isFirst}
          isLast={isLast}
          showAvatar={showAvatar}
          onLongPressIn={handleMessageLongPressIn}
          onLongPressOut={handleMessageLongPressOut}
          onImagePress={handleImagePress}
          messageScaleAnim={messageScaleAnim}
          formatMessageTime={formatMessageTime}
          getAvatar={getAvatar}
          isLatestMessage={item._id === messageOps.messages[messageOps.messages.length - 1]?._id}
          onReplyPress={handleReplyMessagePress}
          highlightedMessageId={highlightedMessageId}
          onReply={handleSwipeReply}
        />
      );
    },
    [
      chat,
      currentUserId,
      customEmojis,
      processedMessages,
      handleMessageLongPressIn,
      handleMessageLongPressOut,
      handleImagePress,
      messageScaleAnim,
      messageOps.messages,
      formatMessageTime,
      getAvatar,
      isDifferentDay,
      handleReplyMessagePress,
      highlightedMessageId,
      handleSwipeReply,
    ]
  );

  // Hàm lấy tin nhắn đã ghim
  const fetchPinnedMessages = async (chatId: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.log('No token for fetchPinnedMessages');
        return;
      }

      const pinnedRes = await fetch(`${CHAT_SERVICE_URL}/${chatId}/pinned-messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!pinnedRes.ok) {
        const contentType = pinnedRes.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          console.warn(
            `💡 Pinned messages API endpoint not available (Status: ${pinnedRes.status})`
          );
          console.warn('Backend server may not be running or endpoint not implemented yet.');
          return;
        }

        const errorText = await pinnedRes.text();
        console.warn('Pinned messages API unavailable:', pinnedRes.status, errorText);
        return;
      }

      // Kiểm tra content type trước khi parse JSON
      const contentType = pinnedRes.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await pinnedRes.text();
        console.warn(
          'Pinned messages API returned non-JSON response:',
          responseText.substring(0, 100)
        );
        return;
      }

      const pinnedData = await pinnedRes.json();
      if (Array.isArray(pinnedData)) {
        setPinnedMessages(pinnedData);
      } else {
        console.warn('Pinned messages response is not an array:', pinnedData);
        setPinnedMessages([]);
      }
    } catch (error) {
      console.warn('💡 Lỗi khi lấy tin nhắn đã ghim:', error);
      setPinnedMessages([]);
    }
  };

  // Thêm hàm xử lý yêu cầu thu hồi
  const handleRequestRevoke = (message: any) => {
    setMessageToRevoke(message);
    setShowRevokeConfirm(true);
  };

  // Thu hồi tin nhắn
  const handleConfirmRevoke = async () => {
    if (!messageToRevoke) return;

    try {
      await messageOps.revokeMessage(messageToRevoke._id);

      setShowRevokeConfirm(false);
      setMessageToRevoke(null);
      setNotification({
        visible: true,
        type: 'success',
        message: 'Đã thu hồi tin nhắn',
      });
    } catch (error) {
      setNotification({
        visible: true,
        type: 'error',
        message: error instanceof Error ? error.message : 'Không thể thu hồi tin nhắn',
      });
    }
  };

  // Thêm các hàm utility còn thiếu
  const removeImage = (idx: number) => {
    setImagesToSend((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if (imagesToSend.length > 0) {
      // Nếu có nhiều hơn 6 ảnh, chia thành nhiều nhóm mỗi nhóm 6 ảnh
      if (imagesToSend.length > 6) {
        // Chia nhỏ mảng ảnh thành các nhóm 6 ảnh
        const imageGroups = [];
        for (let i = 0; i < imagesToSend.length; i += 6) {
          imageGroups.push(imagesToSend.slice(i, i + 6));
        }

        // Gửi từng nhóm ảnh
        for (const group of imageGroups) {
          if (group.length === 1) {
            await uploadAttachment(group[0], 'image');
          } else {
            await uploadMultipleImages(group);
          }
        }
      } else {
        // Số ảnh <= 6, xử lý như trước
        if (imagesToSend.length === 1) {
          await uploadAttachment(imagesToSend[0], 'image');
        } else {
          await uploadMultipleImages(imagesToSend);
        }
      }
      setImagesToSend([]);
    }

    if (input.trim() && chat) {
      await sendMessage();
    }
  };

  const forwardSingleMessage = async (toUserId: string) => {
    if (!forwardMessage) return;
    const token = await AsyncStorage.getItem('authToken');
    try {
      const res = await fetch(`${CHAT_SERVICE_URL}/message/forward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messageId: forwardMessage._id,
          toUserId,
        }),
      });
      const data = await res.json();

      // nếu forward tới chính phòng đang mở → chèn ngay vào UI
      if (data && chat && data.chat === chat._id) {
        messageOps.setMessages((prev) => [...prev, data]);
      }
    } catch (err) {
      console.error('Error forwarding message:', err);
    }
  };

  return (
    <View
      style={{
        flex: 1,
      }}>
      <ImageBackground
        source={require('../../assets/chat-background.png')}
        style={{
          flex: 1,
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
        }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            enabled>
            <View className="flex-row items-center border-gray-200 p-3">
              <TouchableOpacity onPress={() => navigationProp.goBack()} className="mr-2">
                <MaterialIcons name="arrow-back-ios" size={32} color="#009483" />
              </TouchableOpacity>
              <View style={{ position: 'relative', marginRight: 12 }}>
                <>
                  <Image
                    source={{ uri: getAvatar(chatPartner) }}
                    style={{ width: 48, height: 48, borderRadius: 24 }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 14,
                      height: 14,
                      borderRadius: 9999,
                      backgroundColor: isUserOnline(chatPartner._id) ? 'green' : '#bbb',
                      borderWidth: 2,
                      borderColor: 'white',
                    }}
                  />
                </>
              </View>
              <View style={{ justifyContent: 'center', flex: 1 }}>
                <Text className="font-bold text-lg" style={{ marginBottom: 0 }}>
                  {chatPartner.fullname}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#444',
                    fontFamily: 'Inter',
                    fontWeight: 'medium',
                  }}>
                  {socketConnection.otherTyping
                    ? 'đang soạn tin...'
                    : isUserOnline(chatPartner._id)
                      ? 'Đang hoạt động'
                      : getFormattedLastSeen(chatPartner._id)}
                </Text>
              </View>
              {/* Thêm nút thông tin */}
              <TouchableOpacity
                onPress={() => {
                  navigationProp.navigate(ROUTES.SCREENS.CHAT_INFO as any, {
                    user: chatPartner,
                    chatId: routeChatId,
                  });
                }}
                className="ml-2">
                <MaterialIcons name="info" size={24} color="#009483" />
              </TouchableOpacity>
            </View>

            {/* Hiển thị banner tin nhắn ghim */}
            {pinnedMessages.length > 0 && (
              <PinnedMessageBanner
                pinnedMessages={pinnedMessages}
                onPress={handlePinnedMessagePress}
                onUnpin={handleUnpinMessage}
              />
            )}

            <View style={{ flex: 1 }}>
              {messageOps.loading ? (
                <View className="flex-1 items-center justify-center">
                  <Text style={{ fontFamily: 'Inter', fontWeight: 'medium' }}>
                    Đang tải tin nhắn...
                  </Text>
                </View>
              ) : messageOps.messages.length === 0 ? (
                <View className="flex-1 items-center justify-center">
                  <Text style={{ fontFamily: 'Inter', fontWeight: 'medium' }}>
                    Chưa có tin nhắn nào
                  </Text>
                  <Text style={{ fontFamily: 'Inter', fontSize: 12, color: '#666', marginTop: 4 }}>
                    Hãy gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện
                  </Text>
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={processedMessages}
                  inverted
                  keyExtractor={keyExtractor}
                  ListHeaderComponent={() => (
                    <>
                      {socketConnection.otherTyping && (
                        <View className="mx-2 mb-1 mt-4 flex-row items-end justify-start">
                          <View className="relative mr-1.5">
                            <Image
                              source={{ uri: getAvatar(chatPartner) }}
                              className="h-8 w-8 rounded-full"
                            />
                          </View>
                          <View className="flex-row items-center rounded-2xl bg-[#F5F5ED] px-4 py-2">
                            <TypingIndicator />
                          </View>
                        </View>
                      )}
                    </>
                  )}
                  ListFooterComponent={() => (
                    <>
                      {messageOps.isLoadingMore && (
                        <View style={{ padding: 10, alignItems: 'center' }}>
                          <Text
                            style={{
                              fontFamily: 'Inter',
                              fontSize: 12,
                              color: '#666',
                            }}>
                            Đang tải thêm tin nhắn...
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                  style={{ flex: 1 }}
                  renderItem={renderItem}
                  contentContainerStyle={{
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    paddingBottom: keyboardVisible ? 10 : insets.bottom + 50,
                    flexGrow: 1,
                  }}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={20}
                  windowSize={21}
                  updateCellsBatchingPeriod={100}
                  initialNumToRender={25}
                  onEndReachedThreshold={0.3}
                  onEndReached={messageOps.hasMoreMessages ? messageOps.handleLoadMore : undefined}
                  legacyImplementation={false}
                  onScroll={() => {
                    // Emit messageRead khi user scroll để đảm bảo real-time tracking
                    if (
                      currentUserId &&
                      chatIdRef.current &&
                      socketConnection.socket &&
                      socketConnection.socket.connected
                    ) {
                      socketConnection.emitMessageRead(currentUserId, chatIdRef.current);
                    }
                  }}
                  scrollEventThrottle={2000} // Throttle để tránh spam
                  onScrollToIndexFailed={(info) => {
                    console.warn('📱 ScrollToIndex failed:', info);

                    // Thử scroll đến vị trí gần đúng bằng offset
                    const estimatedOffset = info.index * 80; // Ước tính chiều cao tin nhắn

                    setTimeout(() => {
                      if (flatListRef.current) {
                        try {
                          flatListRef.current.scrollToOffset({
                            offset: Math.min(estimatedOffset, info.highestMeasuredFrameIndex * 80),
                            animated: true,
                          });
                        } catch (error) {
                          console.log('📱 Using final fallback - scroll to end');
                          flatListRef.current.scrollToEnd({ animated: true });
                        }
                      }
                    }, 100);
                  }}
                />
              )}
            </View>

            {/* Chat Input Bar */}
            <ChatInputBar
              input={input}
              handleInputChange={handleInputChange}
              imagesToSend={imagesToSend}
              removeImage={removeImage}
              handleSend={handleSend}
              showEmojiPicker={showEmojiPicker}
              setShowEmojiPicker={setShowEmojiPicker}
              handlePickFile={handlePickFile}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              keyboardVisible={keyboardVisible}
              insets={insets}
              setImagesToSend={setImagesToSend}
            />

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <EmojiPicker
                customEmojis={customEmojis}
                handleSendEmoji={handleSendEmoji}
                setShowEmojiPicker={setShowEmojiPicker}
              />
            )}
          </KeyboardAvoidingView>

          {/* Thêm component ImageViewer vào render */}
          <ImageViewing
            images={viewerImages}
            imageIndex={viewerInitialIndex}
            visible={viewerVisible}
            onRequestClose={() => setViewerVisible(false)}
            swipeToCloseEnabled={true}
            doubleTapToZoomEnabled={true}
            presentationStyle="fullScreen"
            animationType="fade"
            backgroundColor="rgba(0, 0, 0, 0.95)"
            HeaderComponent={({ imageIndex }) => (
              <View
                style={{
                  padding: 16,
                  paddingTop: Platform.OS === 'ios' ? 50 : 16,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  width: '100%',
                }}>
                <TouchableOpacity onPress={() => setViewerVisible(false)} style={{ padding: 8 }}>
                  <Text
                    style={{
                      color: 'white',
                      fontSize: 16,
                      fontFamily: 'Inter',
                      fontWeight: 'medium',
                    }}>
                    ✕
                  </Text>
                </TouchableOpacity>
                <Text
                  style={{
                    color: 'white',
                    fontSize: 16,
                    fontFamily: 'Inter',
                    fontWeight: 'medium',
                  }}>
                  {imageIndex + 1}/{viewerImages.length}
                </Text>
              </View>
            )}
          />
          {/* Thêm component ImageViewerModal vào render */}
          <ImageViewerModal
            images={viewerImages}
            imageIndex={viewerInitialIndex}
            visible={viewerVisible}
            onRequestClose={() => setViewerVisible(false)}
          />

          {/* Message Reaction Modal */}
          <MessageReactionModal
            visibleReactionBar={showReactionModal}
            visibleActionBar={showReactionModal}
            onCloseReactionBar={closeReactionModal}
            onCloseActionBar={closeReactionModal}
            position={reactionModalPosition}
            onReactionSelect={handleReactionSelect}
            onActionSelect={handleActionSelect}
            selectedMessage={selectedMessage}
            onSuccess={refreshMessages}
            currentUserId={currentUserId}
            showPinOption={true}
            isPinned={selectedMessage?.isPinned || false}
            onRequestRevoke={handleRequestRevoke}
          />

          {forwardMessage && currentUserId && currentUser && (
            <ForwardMessageSheet
              visible={showForwardSheet}
              onClose={() => {
                setShowForwardSheet(false);
                setForwardMessage(null);
              }}
              message={forwardMessage}
              currentUser={currentUser}
              onForward={forwardSingleMessage}
            />
          )}
        </SafeAreaView>
      </ImageBackground>
      <NotificationModal
        visible={notification.visible}
        type={notification.type}
        message={notification.message}
        onClose={() => setNotification((prev) => ({ ...prev, visible: false }))}
      />
      {/* Modal xác nhận thu hồi */}
      <ConfirmModal
        visible={showRevokeConfirm}
        title="Thu hồi tin nhắn"
        message="Bạn có chắc chắn muốn thu hồi tin nhắn này?"
        onCancel={() => {
          setShowRevokeConfirm(false);
          setMessageToRevoke(null);
        }}
        onConfirm={handleConfirmRevoke}
      />
    </View>
  );
};

export default ChatDetailScreen;
