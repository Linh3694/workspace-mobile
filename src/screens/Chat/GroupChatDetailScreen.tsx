import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo, memo } from 'react';
// @ts-ignore
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, Platform, KeyboardAvoidingView, Animated, ImageBackground, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL } from '../../config/constants';
import GroupAvatar from '../../components/Chat/GroupAvatar';
import GroupSwipeableMessageBubble from '../../components/Chat/GroupSwipeableMessageBubble';
import GroupTypingIndicator from '../../components/Chat/GroupTypingIndicator';
import ChatInputBar from '../../components/Chat/ChatInputBar';
import EmojiPicker from '../../components/Chat/EmojiPicker';
import MessageReactionModal from '../../components/Chat/MessageReactionModal';
import ImageViewerModal from '../../components/Chat/ImageViewerModal';
import ForwardMessageSheet from '../../components/Chat/ForwardMessageSheet';
import PinnedMessageBanner from '../../components/Chat/PinnedMessageBanner';
import NotificationModal from '../../components/NotificationModal';
import ConfirmModal from '../../components/ConfirmModal';
import ImageGrid from '../../components/Chat/ImageGrid';
import type { GroupInfo, Message, User } from '../../types/message';
import { NotificationType } from '../../types/chat';
import { CustomEmoji } from '../../hooks/useEmojis';
import { formatMessageTime, formatMessageDate, getAvatar, isDifferentDay } from '../../utils/messageUtils';
import { getMessageGroupPosition } from '../../utils/messageGroupUtils';
import { useEmojis } from '../../hooks/useEmojis';
import { useGroupSocket } from '../../hooks/useGroupSocket';
import { useGroupMessageOperations } from '../../hooks/useGroupMessageOperations';
import { ROUTES } from '../../constants/routes';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import ImageViewing from 'react-native-image-viewing';

interface GroupChatDetailScreenProps {
  route: {
    params: {
      chat: GroupInfo;
    };
  };
}

const GroupChatDetailScreen: React.FC<GroupChatDetailScreenProps> = () => {
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isScreenActive, setIsScreenActive] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [imagesToSend, setImagesToSend] = useState<any[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [reactionModalPosition, setReactionModalPosition] = useState<{ x: number, y: number } | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [showForwardSheet, setShowForwardSheet] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [messageToRevoke, setMessageToRevoke] = useState<any>(null);
  const [notification, setNotification] = useState<{
    visible: boolean;
    type: 'success' | 'error';
    message: string;
  }>({
    visible: false,
    type: 'success',
    message: ''
  });
  
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute();
  const { chat } = route.params as { chat: GroupInfo };
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageScaleAnim = useRef(new Animated.Value(1)).current;

  // Custom hooks
  const { customEmojis } = useEmojis();
  
  // Group message operations
  const groupMessageOps = useGroupMessageOperations({
    groupInfo,
    currentUserId
  });

  // Socket event handlers
  const handleGroupMemberAdded = useCallback((data: { chatId: string; newMember: any; addedBy: any }) => {
    if (data.chatId === groupInfo?._id) {
      setGroupInfo(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: [...prev.participants, data.newMember]
        };
      });
      setNotification({
        visible: true,
        type: 'success',
        message: `${data.newMember.fullname} đã được thêm vào nhóm`
      });
    }
  }, [groupInfo?._id]);

  const handleGroupMemberRemoved = useCallback((data: { chatId: string; removedUserId: string; removedBy: any }) => {
    if (data.chatId === groupInfo?._id) {
      if (data.removedUserId === currentUserId) {
        // Current user was removed
        setNotification({
          visible: true,
          type: 'error',
          message: 'Bạn đã bị xóa khỏi nhóm'
        });
        setTimeout(() => navigation.goBack(), 2000);
      } else {
        // Someone else was removed
        setGroupInfo(prev => {
          if (!prev) return prev;
          const removedUser = prev.participants.find(p => p._id === data.removedUserId);
          return {
            ...prev,
            participants: prev.participants.filter(p => p._id !== data.removedUserId)
          };
        });
        setNotification({
          visible: true,
          type: 'success',
          message: 'Một thành viên đã bị xóa khỏi nhóm'
        });
      }
    }
  }, [groupInfo?._id, currentUserId, navigation]);

  const handleGroupInfoUpdated = useCallback((data: { chatId: string; changes: any; updatedBy: any }) => {
    if (data.chatId === groupInfo?._id) {
      setGroupInfo(prev => prev ? { ...prev, ...data.changes } : prev);
      setNotification({
        visible: true,
        type: 'success',
        message: 'Thông tin nhóm đã được cập nhật'
      });
    }
  }, [groupInfo?._id]);

  const handleMessagePinned = useCallback((data: { chatId: string; message: Message }) => {
    if (data.chatId === groupInfo?._id) {
      // Cập nhật message trong danh sách
      groupMessageOps.setMessages(prev =>
        prev.map(msg => msg._id === data.message._id ? data.message : msg)
      );
      
      // Thêm vào pinned messages nếu chưa có
      setPinnedMessages(prev => {
        const exists = prev.find(msg => msg._id === data.message._id);
        if (!exists) {
          return [...prev, data.message];
        }
        return prev.map(msg => msg._id === data.message._id ? data.message : msg);
      });
    }
  }, [groupInfo?._id, groupMessageOps.setMessages]);

  const handleMessageUnpinned = useCallback((data: { chatId: string; messageId: string }) => {
    if (data.chatId === groupInfo?._id) {
      // Cập nhật message trong danh sách
      groupMessageOps.setMessages(prev =>
        prev.map(msg => 
          msg._id === data.messageId 
            ? { ...msg, isPinned: false } 
            : msg
        )
      );
      
      // Xóa khỏi pinned messages
      setPinnedMessages(prev => prev.filter(msg => msg._id !== data.messageId));
    }
  }, [groupInfo?._id, groupMessageOps.setMessages]);

  // Group socket - Only create when we have necessary data
  const groupSocket = useGroupSocket({
    authToken,
    chatId: groupInfo?._id || '',
    currentUserId,
    isScreenActive,
    onNewMessage: groupMessageOps.handleNewMessage,
    onMessageRead: groupMessageOps.handleMessageRead,
    onMessageRevoked: groupMessageOps.handleMessageRevoked,
    onGroupMemberAdded: handleGroupMemberAdded,
    onGroupMemberRemoved: handleGroupMemberRemoved,
    onGroupInfoUpdated: handleGroupInfoUpdated
  });

  // Initialize data
  useEffect(() => {
    setGroupInfo(chat);
    fetchCurrentUser();
  }, [chat]);

  useEffect(() => {
    const getAuthToken = async () => {
      const token = await AsyncStorage.getItem('authToken');
      setAuthToken(token);
    };
    getAuthToken();
  }, []);

  useEffect(() => {
    if (currentUserId && groupInfo) {
      const isGroupAdmin = groupInfo.admins.some(admin => admin._id === currentUserId);
      console.log('👑 [Admin Check] currentUserId:', currentUserId);
      console.log('👑 [Admin Check] groupInfo.admins:', groupInfo.admins.map(a => ({ id: a._id, name: a.fullname })));
      console.log('👑 [Admin Check] isGroupAdmin:', isGroupAdmin);
      setIsAdmin(isGroupAdmin);
    }
  }, [currentUserId, groupInfo]);

  // Load messages when group is available
  useEffect(() => {
    if (groupInfo?._id && currentUserId && authToken) {
      groupMessageOps.loadMessages(groupInfo._id);
      loadPinnedMessages();
    }
  }, [groupInfo?._id, currentUserId, authToken]);

  // Hide tab bar
  useLayoutEffect(() => {
    const parent = navigation.getParent?.();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  // Keyboard listeners
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Focus & blur handlers
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsScreenActive(true);
      
      // Emit messageRead ngay lập tức khi focus
      if (currentUserId && groupInfo?._id && groupSocket.socket && groupSocket.isConnected) {
        groupSocket.emitMessageRead(currentUserId, groupInfo._id);
      }
      
      setTimeout(() => {
        if (currentUserId && groupInfo?._id) {
          const fetchToken = async () => {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
              groupMessageOps.markMessagesAsRead(groupInfo._id, currentUserId, token);
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
  }, [navigation, currentUserId, groupInfo?._id, groupMessageOps.markMessagesAsRead, groupSocket]);

  const fetchCurrentUser = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        const decoded: any = jwtDecode(token);
        const userId = decoded._id || decoded.id;

        const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
          setCurrentUserId(userId);
        }
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  // Load pinned messages
  const loadPinnedMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || !groupInfo?._id) return;

      const response = await fetch(`${API_BASE_URL}/api/chats/${groupInfo._id}/pinned-messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const pinnedData = await response.json();
        setPinnedMessages(pinnedData);
      }
    } catch (error) {
      console.error('Error loading pinned messages:', error);
    }
  };

  // Pin/Unpin message
  const handlePinMessage = async (messageId: string, shouldPin: boolean) => {
    console.log('📌 [Pin] Starting pin/unpin:', { messageId, shouldPin });
    
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.log('📌 [Pin] No auth token');
        return false;
      }

      const endpoint = `${API_BASE_URL}/api/chats/message/${messageId}/pin`;
      const method = shouldPin ? 'POST' : 'DELETE';
      
      console.log('📌 [Pin] Making API request to:', endpoint, 'with method:', method);
      
      const response = await fetch(endpoint, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('📌 [Pin] API response status:', response.status);
      console.log('📌 [Pin] Response headers:', response.headers.get('content-type'));

      if (response.ok) {
        const responseText = await response.text();
        console.log('📌 [Pin] Raw response:', responseText);
        
        let updatedMessage;
        try {
          updatedMessage = JSON.parse(responseText);
        } catch (parseError) {
          console.error('📌 [Pin] JSON parse error:', parseError);
          console.error('📌 [Pin] Response was:', responseText);
          return false;
        }
        
        console.log('📌 [Pin] Updated message:', updatedMessage);
        
        // Cập nhật messages list
        groupMessageOps.setMessages(prev =>
          prev.map(msg => msg._id === updatedMessage._id ? updatedMessage : msg)
        );

        // Cập nhật pinned messages list
        if (shouldPin) {
          setPinnedMessages(prev => [...prev, updatedMessage]);
          setNotification({
            visible: true,
            type: 'success',
            message: 'Đã ghim tin nhắn'
          });
        } else {
          setPinnedMessages(prev => prev.filter(msg => msg._id !== messageId));
          setNotification({
            visible: true,
            type: 'success',
            message: 'Đã bỏ ghim tin nhắn'
          });
        }

        return true;
      } else {
        const errorText = await response.text();
        console.error('📌 [Pin] API error:', response.status, errorText);
        
        // Try to parse as JSON, if fails show raw text
        let errorMessage = 'Không thể ghim/bỏ ghim tin nhắn';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        setNotification({
          visible: true,
          type: 'error',
          message: errorMessage
        });
        
        return false;
      }
    } catch (error) {
      console.error('📌 [Pin] Exception:', error);
      setNotification({
        visible: true,
        type: 'error',
        message: 'Lỗi kết nối. Vui lòng thử lại.'
      });
      return false;
    }
  };

  // Handle forward message
  const handleForwardMessage = async (chatIds: string[], message: Message) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return false;

      const forwardPromises = chatIds.map(chatId =>
        fetch(`${API_BASE_URL}/api/chats/message/forward`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messageId: message._id,
            targetChatId: chatId,
          }),
        })
      );

      const results = await Promise.all(forwardPromises);
      const successCount = results.filter(res => res.ok).length;

      if (successCount > 0) {
        setNotification({
          visible: true,
          type: 'success',
          message: `Đã chuyển tiếp tin nhắn đến ${successCount} cuộc trò chuyện`
        });
        setShowForwardSheet(false);
        setForwardMessage(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error forwarding message:', error);
      return false;
    }
  };

  // Handle forward message for ForwardMessageSheet - sửa lại signature
  const handleForwardMessageToUser = async (userId: string) => {
    if (!forwardMessage) return;
    
    console.log('🔄 [Forward] Starting forward message:', { forwardMessage: forwardMessage._id, toUserId: userId });
    
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.error('🔄 [Forward] No auth token found');
        return;
      }

      console.log('🔄 [Forward] Making API request...');
      const response = await fetch(`${API_BASE_URL}/api/chats/message/forward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messageId: forwardMessage._id,
          toUserId: userId,
        }),
      });

      console.log('🔄 [Forward] API response status:', response.status);

      if (response.ok) {
        const responseData = await response.json();
        console.log('🔄 [Forward] Success response:', responseData);
        
        setNotification({
          visible: true,
          type: 'success',
          message: 'Đã chuyển tiếp tin nhắn'
        });
        setShowForwardSheet(false);
        setForwardMessage(null);
      } else {
        const errorData = await response.json();
        console.error('🔄 [Forward] API error:', response.status, errorData);
        
        setNotification({
          visible: true,
          type: 'error',
          message: errorData.message || 'Không thể chuyển tiếp tin nhắn'
        });
      }
    } catch (error) {
      console.error('🔄 [Forward] Exception:', error);
      setNotification({
        visible: true,
        type: 'error',
        message: 'Không thể chuyển tiếp tin nhắn'
      });
    }
  };

  // Handle unpin message
  const handleUnpinMessage = async (messageId: string) => {
    console.log('📌 [Unpin] Starting unpin message:', messageId);
    const success = await handlePinMessage(messageId, false);
    console.log('📌 [Unpin] Unpin result:', success);
    return success;
  };

  // Handle input change with typing indicator
  const handleInputChange = useCallback((text: string) => {
  
    
    setInput(text);
    
    // Only emit typing if we have text and socket is connected
    if (text.trim() && groupSocket.socket && groupSocket.isConnected && groupInfo?._id && currentUserId) {
      groupSocket.emitTyping();
    } else if (!text.trim() && groupSocket.socket && groupSocket.isConnected) {
      // Stop typing when input is empty
      groupSocket.emitStopTyping();
    }
  }, [groupInfo?._id, currentUserId, groupSocket]);

  // Send message
  const sendMessage = useCallback(async (emojiParam?: CustomEmoji) => {
    if (!input.trim() && !emojiParam) return;

    

    const replyToMessage = replyTo;
    setReplyTo(null);

    const result = await groupMessageOps.sendMessage(input, emojiParam, replyToMessage?._id);
    
    if (result && result._id) {
      setInput('');
    } else {
      setReplyTo(replyToMessage);
    }
  }, [input, groupMessageOps.sendMessage, replyTo]);

  // Handle message long press
  const handleMessageLongPressIn = (message: Message, event: any) => {
    longPressTimeoutRef.current = setTimeout(() => {
      setSelectedMessage(message);
      if (event?.nativeEvent?.pageX !== undefined && event?.nativeEvent?.pageY !== undefined) {
        setReactionModalPosition({
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY
        });
      } else {
        setReactionModalPosition({ x: 200, y: 400 });
      }

      Animated.sequence([
        Animated.timing(messageScaleAnim, {
          toValue: 1.05,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(messageScaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true
        })
      ]).start();

      setShowReactionModal(true);
    }, 500);
  };

  const handleMessageLongPressOut = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  // Handle swipe reply
  const handleSwipeReply = useCallback((message: Message) => {
    setReplyTo(message);
  }, []);

  // Handle image press
  const handleImagePress = (images: string[], index: number) => {
    const processedImages = images.map(url => ({
      uri: url.startsWith('http') ? url : `${API_BASE_URL}${url}`
    }));
    setViewerImages(processedImages);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  };

  // Handle file picking
  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled) {
      await groupMessageOps.uploadAttachment(result, 'file');
    }
  };

  // Upload nhiều ảnh sử dụng groupMessageOps  
  const uploadMultipleImages = useCallback(async (images: any[]) => {
    const result = await groupMessageOps.uploadMultipleAttachments(images, 'image');
    if (result) {
      // Animate layout change if needed
    }
  }, [groupMessageOps.uploadMultipleAttachments]);

  // Handle send emoji
  const handleSendEmoji = async (emoji: CustomEmoji) => {
    setShowEmojiPicker(false);
    await sendMessage(emoji);
  };

  // Handle reaction select
  const handleReactionSelect = async (reaction: { code: string; isCustom: boolean }) => {
    if (!selectedMessage) return false;
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(
        `${API_BASE_URL}/api/chats/message/${selectedMessage._id}/react`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            emojiCode: reaction.code,
            isCustom: reaction.isCustom,
          }),
        }
      );
      if (!res.ok) return false;
      
      const updatedMessage: Message = await res.json();
      groupMessageOps.setMessages(prev =>
        prev.map(msg => msg._id === updatedMessage._id ? updatedMessage : msg)
      );
      closeReactionModal();
      return true;
    } catch (error) {
      console.error('Error sending reaction:', error);
      return false;
    }
  };

  // Close reaction modal
  const closeReactionModal = () => {
    setShowReactionModal(false);
    setSelectedMessage(null);
    setReactionModalPosition(null);
  };

  // Handle action select
  const handleActionSelect = (action: string) => {
    if (!selectedMessage?._id) return;

    console.log('📌 [GroupChatDetailScreen] handleActionSelect called with action:', action);

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
        // Handle copy action for text messages
        if (selectedMessage.type === 'text' && selectedMessage.content) {
          // Add copy to clipboard functionality here if needed
          console.log('📌 [Copy] Copying text:', selectedMessage.content);
          setNotification({
            visible: true,
            type: 'success',
            message: 'Đã sao chép tin nhắn'
          });
        }
        closeReactionModal();
        break;
      case 'pin':
        console.log('📌 [Pin Action] Pinning message');
        handlePinMessage(selectedMessage._id, true);
        closeReactionModal();
        break;
      case 'unpin':
        console.log('📌 [Unpin Action] Unpinning message');
        handlePinMessage(selectedMessage._id, false);
        closeReactionModal();
        break;
      default:
        console.log('📌 [Action] Unknown action:', action);
        break;
    }
  };

  // Log values before rendering MessageReactionModal
  useEffect(() => {
    if (showReactionModal && selectedMessage) {
      console.log('📌 [GroupChatDetailScreen] Rendering MessageReactionModal with:');
      console.log('📌 [GroupChatDetailScreen] isAdmin:', isAdmin);
      console.log('📌 [GroupChatDetailScreen] showPinOption: true (Cho phép tất cả thành viên pin tin nhắn)');
      console.log('📌 [GroupChatDetailScreen] selectedMessage.isPinned:', selectedMessage.isPinned);
      console.log('📌 [GroupChatDetailScreen] currentUserId:', currentUserId);
      console.log('📌 [GroupChatDetailScreen] selectedMessage.sender._id:', selectedMessage.sender._id);
    }
  }, [showReactionModal, selectedMessage, isAdmin, currentUserId]);

  // Remove image from imagesToSend
  const removeImage = (idx: number) => {
    setImagesToSend(prev => prev.filter((_, i) => i !== idx));
  };

  // Handle send with images
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
            await groupMessageOps.uploadAttachment(group[0], 'image');
          } else {
            await uploadMultipleImages(group);
          }
        }
      } else {
        // Số ảnh <= 6, xử lý như trước
        if (imagesToSend.length === 1) {
          await groupMessageOps.uploadAttachment(imagesToSend[0], 'image');
        } else {
          await uploadMultipleImages(imagesToSend);
        }
      }
      setImagesToSend([]);
    }

    if (input.trim()) {
      await sendMessage();
    }
  };

  // Process messages with time separators
  const processedMessages = useMemo(() => {
    const messagesWithTime: any[] = [];
    for (let i = 0; i < groupMessageOps.messages.length; i++) {
      const item = groupMessageOps.messages[i];
      const prevMsg = groupMessageOps.messages[i - 1];
      const isDifferentDay = prevMsg?.createdAt && (new Date(item.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString());
      const timeGap = prevMsg?.createdAt ? (new Date(item.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) : null;
      const showTime = !prevMsg?.createdAt || isDifferentDay || (!!timeGap && timeGap > 10 * 60 * 1000);
      
      if (showTime) {
        messagesWithTime.push({
          type: 'time',
          time: item.createdAt,
          _id: `time-${item.createdAt}-${item._id}`
        });
      }
      messagesWithTime.push(item);
    }
    return [...messagesWithTime].reverse();
  }, [groupMessageOps.messages]);

  // Handle reply message press
  const handleReplyMessagePress = useCallback((message: Message) => {
    try {
      
      // Tìm index của tin nhắn trong danh sách messages gốc
      const messageIndex = groupMessageOps.messages.findIndex(msg => msg._id === message._id);
      
      if (messageIndex === -1) {
        setNotification({
          visible: true,
          type: 'error',
          message: 'Không tìm thấy tin nhắn được trả lời'
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
          
          // Sử dụng scrollToIndex với error handling
          flatListRef.current.scrollToIndex({
            index: targetIndex,
            animated: true,
            viewPosition: 0.5,
            viewOffset: 0
          });

          // Backup method nếu scrollToIndex fails
          setTimeout(() => {
            if (flatListRef.current) {
              try {
                flatListRef.current.scrollToIndex({
                  index: targetIndex,
                  animated: false,
                  viewPosition: 0.5
                });
              } catch (scrollError) {
                // Fallback: scroll to approximate position
                const estimatedOffset = targetIndex * 80; // Estimate message height
                flatListRef.current.scrollToOffset({
                  offset: estimatedOffset,
                  animated: true
                });
              }
            }
          }, 100);
        }
      }, 200); // Đợi 200ms để React re-render
      
      // Tắt highlight sau 3 giây
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 3000);
      
    } catch (error) {
      console.error('💬 [GroupChatDetailScreen] Error navigating to replied message:', error);
      setNotification({
        visible: true,
        type: 'error',
        message: 'Không thể cuộn đến tin nhắn được trả lời'
      });
    }
  }, [groupMessageOps.messages, processedMessages]);

  // Handle pinned message press
  const handlePinnedMessagePress = useCallback((message: Message) => {
    handleReplyMessagePress(message);
  }, [handleReplyMessagePress]);

  // Render message item
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
      const isMe = currentUserId && item.sender._id === currentUserId;
      const showAvatar = !isMe && isFirst;
      
      return (
        <View>
          <GroupSwipeableMessageBubble
            chat={groupInfo}
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
            isLatestMessage={item._id === groupMessageOps.messages[groupMessageOps.messages.length - 1]?._id}
            onReplyPress={handleReplyMessagePress}
            highlightedMessageId={highlightedMessageId}
            onReply={handleSwipeReply}
            showSenderName={true}
          />
        </View>
      );
    },
    [
      processedMessages, groupInfo, currentUserId, customEmojis,
      handleMessageLongPressIn, handleMessageLongPressOut,
      handleImagePress, messageScaleAnim, formatMessageTime,
      getAvatar, groupMessageOps.messages, highlightedMessageId,
      handleReplyMessagePress, handleSwipeReply, isDifferentDay
    ]
  );

  // Key extractor
  const keyExtractor = useCallback((item: Message | any) => {
    return item.type === 'time' ? item._id : item._id;
  }, []);

  if (groupMessageOps.loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Inter', fontWeight: 'medium' }}>Đang tải tin nhắn...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={require('../../assets/chat-background.png')}
        style={{
          flex: 1,
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            enabled
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 8 }}>
                <MaterialIcons name="arrow-back-ios" size={32} color="#009483" />
              </TouchableOpacity>
              
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
                <GroupAvatar
                  size={48}
                  groupAvatar={groupInfo?.avatar}
                  participants={groupInfo?.participants || []}
                  currentUserId={currentUserId}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', fontFamily: 'Mulish-Bold' }}>
                    {groupInfo?.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#444', fontFamily: 'Inter', fontWeight: 'medium' }}>
                      {groupInfo?.participants.length} thành viên
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate(ROUTES.SCREENS.GROUP_INFO as any, { groupInfo })}
                style={{ padding: 8 }}
              >
                <MaterialIcons name="info" size={24} color="#009483" />
              </TouchableOpacity>
            </View>

            {/* Pinned Messages Banner */}
            {pinnedMessages.length > 0 && (
              <PinnedMessageBanner
                pinnedMessages={pinnedMessages}
                onPress={handlePinnedMessagePress}
                onUnpin={handleUnpinMessage}
              />
            )}

            {/* Messages */}
            <View style={{ flex: 1 }}>
              <FlatList
                ref={flatListRef}
                data={processedMessages}
                inverted
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                ListHeaderComponent={() => (
                  <GroupTypingIndicator typingUsers={groupSocket.typingUsers} />
                )}
                ListFooterComponent={() => (
                  <>
                    {groupMessageOps.isLoadingMore && (
                      <View style={{ padding: 10, alignItems: 'center' }}>
                        <Text style={{ fontFamily: 'Inter', fontSize: 12, color: '#666' }}>
                          Đang tải thêm tin nhắn...
                        </Text>
                      </View>
                    )}
                  </>
                )}
                style={{ flex: 1 }}
                contentContainerStyle={{
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  paddingBottom: keyboardVisible ? 10 : (insets.bottom + 50),
                  flexGrow: 1,
                }}
                removeClippedSubviews={true}
                maxToRenderPerBatch={20}
                windowSize={21}
                updateCellsBatchingPeriod={100}
                initialNumToRender={25}
                onEndReachedThreshold={0.3}
                onEndReached={groupMessageOps.hasMoreMessages ? groupMessageOps.handleLoadMore : undefined}
                legacyImplementation={false}
                onScroll={() => {
                  // Emit messageRead khi user scroll để đảm bảo real-time tracking
                  if (currentUserId && groupInfo?._id && groupSocket.socket && groupSocket.isConnected) {
                    groupSocket.emitMessageRead(currentUserId, groupInfo._id);
                  }
                }}
                scrollEventThrottle={2000} // Throttle để tránh spam
                onScrollToIndexFailed={(info) => {
                  console.warn('📱 [GroupChatDetailScreen] ScrollToIndex failed:', info);
                  
                  // Thử scroll đến vị trí gần đúng bằng offset
                  const estimatedOffset = info.index * 80; // Ước tính chiều cao tin nhắn
                  
                  setTimeout(() => {
                    if (flatListRef.current) {
                      try {
                        flatListRef.current.scrollToOffset({
                          offset: Math.min(estimatedOffset, info.highestMeasuredFrameIndex * 80),
                          animated: true
                        });
                      } catch (error) {
                        flatListRef.current.scrollToEnd({ animated: true });
                      }
                    }
                  }, 100);
                }}
              />
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

          {/* Image Viewer */}
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
              <View style={{
                padding: 16,
                paddingTop: Platform.OS === 'ios' ? 50 : 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
                width: '100%'
              }}>
                <TouchableOpacity onPress={() => setViewerVisible(false)} style={{ padding: 8 }}>
                  <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Inter', fontWeight: 'medium' }}>✕</Text>
                </TouchableOpacity>
                <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Inter', fontWeight: 'medium' }}>
                  {imageIndex + 1}/{viewerImages.length}
                </Text>
              </View>
            )}
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
            currentUserId={currentUserId}
            showPinOption={true}
            isPinned={selectedMessage?.isPinned || false}
            onRequestRevoke={() => {}}
          />

        </SafeAreaView>
      </ImageBackground>

      {/* Notification Modal */}
      <NotificationModal
        visible={notification.visible}
        type={notification.type}
        message={notification.message}
        onClose={() => setNotification(prev => ({ ...prev, visible: false }))}
      />

      {/* Forward Message Sheet */}
      {forwardMessage && currentUser && (
        <ForwardMessageSheet
          visible={showForwardSheet}
          message={forwardMessage}
          currentUser={currentUser}
          onClose={() => {
            setShowForwardSheet(false);
            setForwardMessage(null);
          }}
          onForward={handleForwardMessageToUser}
        />
      )}
    </View>
  );
};

export default GroupChatDetailScreen; 