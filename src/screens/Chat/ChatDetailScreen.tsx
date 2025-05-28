import React, { useEffect, useState, useRef, useLayoutEffect, useCallback, useMemo, memo } from 'react';
// @ts-ignore
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, KeyboardAvoidingView, SafeAreaView, Linking, Alert, ActionSheetIOS, ScrollView, Dimensions, Modal, StatusBar, PanResponder, GestureResponderEvent, Keyboard, ImageBackground, Animated, Pressable, Clipboard } from 'react-native';
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
import io from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useOnlineStatus } from '../../context/OnlineStatusContext';
import { Video, ResizeMode } from 'expo-av';
import ImageViewing from 'react-native-image-viewing';
// @ts-ignore
import { AppState, AppStateStatus } from 'react-native';
import { API_BASE_URL } from '../../config/constants';
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
import ImageViewerModal from '../../components/Chat/ImageViewerModal';
import ForwardMessageSheet from '../../components/Chat/ForwardMessageSheet';
import { formatMessageTime, formatMessageDate, getAvatar, isDifferentDay } from '../../utils/messageUtils';
import MessageStatus from '../../components/Chat/MessageStatus';
import { getMessageGroupPosition } from '../../utils/messageGroupUtils';
import EmojiPicker from '../../components/Chat/EmojiPicker';
import { useEmojis } from '../../hooks/useEmojis';
import ConfirmModal from '../../components/ConfirmModal';


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}


const TypingIndicator = memo(() => {
    const [dots, setDots] = useState('.');
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => {
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
        <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 4
        }}>
            <Animated.View style={{
                transform: [{ scale: scaleAnim }],
                flexDirection: 'row',
                alignItems: 'center',
            }}>
                <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#4A4A4A',
                    marginRight: 4,
                    opacity: dots.length >= 1 ? 1 : 0.3
                }} />
                <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#4A4A4A',
                    marginRight: 4,
                    opacity: dots.length >= 2 ? 1 : 0.3
                }} />
                <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#4A4A4A',
                    marginRight: 8,
                    opacity: dots.length >= 3 ? 1 : 0.3
                }} />
            </Animated.View>
            <Text style={{ 
                color: '#4A4A4A', 
                fontSize: 12, 
                fontStyle: 'italic',
                fontFamily: 'Mulish-Italic'
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
    const [messages, setMessages] = useState<Message[]>([]);
    const [chat, setChat] = useState<Chat | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [page, setPage] = useState(1);
    const [isOnline, setIsOnline] = useState(false);
    const { customEmojis, loading: emojisLoading } = useEmojis();
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
    const [forwardMessage, setForwardMessage] = useState<Message | null>(null);

    const [input, setInput] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const navigationProp = useNavigation<NativeStackNavigationProp<{ ChatDetail: ChatDetailParams }, 'ChatDetail'>>();
    const socketRef = useRef<any>(null);
    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const debouncedTypingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const insets = useSafeAreaInsets();
    const { isUserOnline, getFormattedLastSeen } = useOnlineStatus();
    const [otherTyping, setOtherTyping] = useState(false);
    let typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingOpacityAnim = useRef(new Animated.Value(0)).current;
    const [imagesToSend, setImagesToSend] = useState<any[]>([]);
    const bottomSheetHeight = 60 + (insets.bottom || 10);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);
    const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
    const [isScreenActive, setIsScreenActive] = useState(true);
    const chatIdRef = useRef<string | null>(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [showReactionModal, setShowReactionModal] = useState(false);
    const [reactionModalPosition, setReactionModalPosition] = useState<{ x: number, y: number } | null>(null);
    const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const messageScaleAnim = useRef(new Animated.Value(1)).current;
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    // State to hold an emoji selected for sending
    const [selectedEmoji, setSelectedEmoji] = useState<CustomEmoji | null>(null);
    // Thêm state cho tính năng ghim tin nhắn
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    const [notification, setNotification] = useState<{
        visible: boolean;
        type: 'success' | 'error';
        message: string;
    }>({
        visible: false,
        type: 'success',
        message: ''
    });
    const [showForwardSheet, setShowForwardSheet] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
    const [messageToRevoke, setMessageToRevoke] = useState<any>(null);

    // Batched storage operations
    const saveMessagesQueue = useRef<Map<string, Message[]>>(new Map());
    const saveMessagesTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Hàm lưu tin nhắn vào AsyncStorage với batching
    const saveMessagesToStorage = useCallback(async (chatId: string, messages: Message[]) => {
        // Add to queue
        saveMessagesQueue.current.set(chatId, messages);
        
        // Clear existing timeout
        if (saveMessagesTimeout.current) {
            clearTimeout(saveMessagesTimeout.current);
        }
        
        // Batch save operations
        saveMessagesTimeout.current = setTimeout(async () => {
            try {
                const promises = Array.from(saveMessagesQueue.current.entries()).map(([id, msgs]) => {
                    const key = `chat_messages_${id}`;
                    return AsyncStorage.setItem(key, JSON.stringify(msgs));
                });
                
                await Promise.all(promises);
                saveMessagesQueue.current.clear();
            } catch (error) {
                console.error('Error saving messages to storage:', error);
            }
        }, 1000); // Batch operations every 1 second
    }, []);

    // Hàm lấy tin nhắn từ AsyncStorage
    const loadMessagesFromStorage = async (chatId: string) => {
        try {
            const key = `chat_messages_${chatId}`;
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                const messages = JSON.parse(stored) as Message[];
                return messages;
            }
        } catch (error) {
            console.error('Error loading messages from storage:', error);
        }
        return [];
    };



    // Hàm load tin nhắn từ server
    const loadMessages = async (chatId: string, pageNum: number = 1, append: boolean = false) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) {
                console.error('No auth token found');
                return;
            }

            if (append && isLoadingMore) {
                console.log('Already loading more messages, skipping...');
                return;
            }

            setIsLoadingMore(true);
            
            // Gọi API với pagination
            const url = `${API_BASE_URL}/api/chats/messages/${chatId}?page=${pageNum}&limit=20`;
            console.log(`Loading messages: ${url}`);

            const response = await fetch(url, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`Response status: ${response.status}`);

            if (response.ok) {
                const contentType = response.headers.get('content-type');                
                if (!contentType || !contentType.includes('application/json')) {
                    const textResponse = await response.text();
                    console.error('Expected JSON but got:', textResponse.substring(0, 200));
                    throw new Error('Server returned non-JSON response');
                }
                
                const data = await response.json();
                console.log('Received data:', {
                    success: data.success,
                    messagesCount: data.messages?.length,
                    pagination: data.pagination
                });

                // Kiểm tra cấu trúc response - ưu tiên cấu trúc mới
                let messages = [];
                let hasMore = false;
                
                if (data && typeof data === 'object' && data.success === true && Array.isArray(data.messages)) {
                    // Cấu trúc response mới với pagination
                    messages = data.messages;
                    hasMore = data.pagination?.hasMore || false;
                    console.log(`New format: ${messages.length} messages, hasMore: ${hasMore}`);
                } else if (Array.isArray(data)) {
                    // Cấu trúc response cũ - trả về trực tiếp array
                    messages = data;
                    hasMore = messages.length >= 20;
                    console.log(`Old format: ${messages.length} messages, hasMore: ${hasMore}`);
                } else {
                    // Nếu không có tin nhắn nào, set empty array
                    messages = [];
                    hasMore = false;
                    console.log('No messages found');
                }
                
                setHasMoreMessages(hasMore);

                // Validate messages structure
                const validMessages = messages.filter(msg => 
                    msg && msg._id && msg.sender && msg.createdAt
                );

                if (validMessages.length !== messages.length) {
                    console.warn(`Filtered out ${messages.length - validMessages.length} invalid messages`);
                }

                // Sắp xếp tin nhắn theo thời gian
                const sortedMessages = validMessages.sort(
                    (a: Message, b: Message) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );

                if (append) {
                    // Thêm tin nhắn cũ vào đầu danh sách, tránh duplicate
                    setMessages(prevMessages => {
                        const existingIds = new Set(prevMessages.map(msg => msg._id));
                        const newMessages = sortedMessages.filter(msg => !existingIds.has(msg._id));
                        console.log(`Appending ${newMessages.length} new messages to existing ${prevMessages.length}`);
                        return [...newMessages, ...prevMessages];
                    });
                } else {
                    console.log(`Setting ${sortedMessages.length} messages`);
                    setMessages(sortedMessages);
                }

                // Lưu vào storage (chỉ lưu khi không append để tránh duplicate)
                if (!append && sortedMessages.length > 0) {
                    await saveMessagesToStorage(chatId, sortedMessages);
                }
            } else {
                const errorText = await response.text();
                console.error(`API Error ${response.status}:`, errorText);
                
                // Fallback: load từ storage nếu API thất bại và không phải append
                if (!append) {
                    try {
                        console.log('Attempting to load from storage...');
                        const storedMessages = await loadMessagesFromStorage(chatId);
                        if (storedMessages.length > 0) {
                            console.log(`Loaded ${storedMessages.length} messages from storage`);
                            setMessages(storedMessages);
                            setHasMoreMessages(false);
                        } else {
                            console.log('No messages in storage');
                            setMessages([]);
                        }
                    } catch (storageError) {
                        console.error('Error loading from storage:', storageError);
                        setMessages([]);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading messages:', error);

            // Fallback: load từ storage nếu API thất bại và không phải append
            if (!append) {
                try {
                    console.log('Attempting to load from storage after error...');
                    const storedMessages = await loadMessagesFromStorage(chatId);
                    if (storedMessages.length > 0) {
                        console.log(`Loaded ${storedMessages.length} messages from storage after error`);
                        setMessages(storedMessages);
                        setHasMoreMessages(false);
                    } else {
                        console.log('No messages in storage after error');
                        setMessages([]);
                    }
                } catch (storageError) {
                    console.error('Error loading from storage after error:', storageError);
                    setMessages([]);
                }
            }
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Xử lý load more khi scroll lên trên
    const handleLoadMore = () => {
        console.log('handleLoadMore called:', {
            isLoadingMore,
            hasMoreMessages,
            chatId: chat?._id,
            currentPage: page
        });

        if (isLoadingMore) {
            console.log('Already loading, skipping...');
            return;
        }

        if (!hasMoreMessages) {
            console.log('No more messages to load');
            return;
        }

        if (!chat?._id) {
            console.log('No chat ID available');
            return;
        }

        const nextPage = page + 1;
        console.log(`Loading page ${nextPage}`);
        setPage(nextPage);
        loadMessages(chat._id, nextPage, true);
    };

    // Focus & blur handlers for tracking when screen is active/inactive
    useEffect(() => {
        const unsubscribeFocus = navigation.addListener('focus', () => {
            setIsScreenActive(true);

            // Mark messages as read when screen comes into focus với delay nhỏ
            setTimeout(() => {
                if (currentUserId && chatIdRef.current) {
                    const fetchToken = async () => {
                        const token = await AsyncStorage.getItem('authToken');
                        if (token) {
                            markMessagesAsRead(chatIdRef.current, currentUserId, token);
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
    }, [navigation, currentUserId]);

    useEffect(() => {
        // Lấy currentUserId từ token
        const fetchCurrentUser = async () => {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
                try {
                    const decoded: any = jwtDecode(token);
                    const userId = decoded._id || decoded.id;

                    // Lấy thông tin đầy đủ của current user từ API
                    const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
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
            setLoading(true);
            try {
                const authToken = await AsyncStorage.getItem('authToken');
                if (!authToken) {
                    setLoading(false);
                    return;
                }

                if (routeChatId) {
                    // Lấy thông tin chat
                    const chatRes = await fetch(`${API_BASE_URL}/api/chats/${routeChatId}`, {
                        headers: { Authorization: `Bearer ${authToken}` },
                    });

                    if (!chatRes.ok) {
                        throw new Error('Failed to fetch chat data');
                    }

                    const chatData = await chatRes.json();
                    setChat(chatData);
                    chatIdRef.current = routeChatId;

                    // Load tin nhắn từ server
                    await loadMessages(routeChatId);

                    // Lấy tin nhắn đã ghim
                    await fetchPinnedMessages(routeChatId);

                    // Thiết lập Socket.IO
                    setupSocket(authToken, routeChatId);
                } else {
                    // Trường hợp không có chatId - tạo chat mới hoặc tìm chat hiện có
                    try {
                        const createChatRes = await fetch(`${API_BASE_URL}/api/chats/createOrGet`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                            },
                            body: JSON.stringify({
                                participantId: chatPartner._id
                            })
                        });

                        if (createChatRes.ok) {
                            const chatData = await createChatRes.json();
                            setChat(chatData);
                            chatIdRef.current = chatData._id;

                            // Load tin nhắn từ server (nếu có)
                            await loadMessages(chatData._id);

                            // Lấy tin nhắn đã ghim
                            await fetchPinnedMessages(chatData._id);

                            // Thiết lập Socket.IO
                            setupSocket(authToken, chatData._id);
                        } else {
                            console.error('Failed to create/get chat');
                        }
                    } catch (createError) {
                        console.error('Error creating chat:', createError);
                    }
                }
            } catch (err) {
                console.error('Error in fetchData:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Cleanup function
        return () => {
            // Clear all timeouts
            if (typingTimeout.current) {
                clearTimeout(typingTimeout.current);
            }
            if (debouncedTypingRef.current) {
                clearTimeout(debouncedTypingRef.current);
            }
            if (saveMessagesTimeout.current) {
                clearTimeout(saveMessagesTimeout.current);
            }
            if (longPressTimeoutRef.current) {
                clearTimeout(longPressTimeoutRef.current);
            }

            // Disconnect socket
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [chatPartner._id, routeChatId, currentUserId]);

    const markMessagesAsRead = async (chatId: string | null, userId: string, token: string) => {
        if (!chatId) return;

        try {
            const timestamp = new Date().toISOString();

            console.log('🔵 [MARK READ] Starting mark messages as read:', { chatId, userId, timestamp });

            // Cập nhật UI ngay lập tức để responsive hơn
            setMessages(prevMessages =>
                prevMessages.map(msg => {
                    if (msg.sender._id !== userId && (!msg.readBy || !msg.readBy.includes(userId))) {
                        return {
                            ...msg,
                            readBy: [...(msg.readBy || []), userId]
                        };
                    }
                    return msg;
                })
            );

            // Gửi thông báo qua socket ngay lập tức
            if (socketRef.current && socketRef.current.connected) {
                console.log('📤 [MARK READ] Emitting messageRead event for chat:', chatId);
                socketRef.current.emit('messageRead', {
                    userId: userId,
                    chatId: chatId,
                    timestamp: timestamp
                });
            }

            // Gọi API để đồng bộ với server
            console.log('🌐 [MARK READ] Calling API to mark messages as read');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(`${API_BASE_URL}/api/chats/read-all/${chatId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ timestamp }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            console.log('✅ [MARK READ] API response status:', response.status);

            if (response.ok) {
                const result = await response.json();
                console.log('✅ [MARK READ] Successfully marked messages as read:', result);
            } else {
                const errorText = await response.text();
                console.error('❌ [MARK READ] Failed to mark messages as read:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText
                });
            }
        } catch (error) {
            console.error('❌ [MARK READ] Error marking messages as read:', error);
        }
    };

    // Socket.IO setup
    const setupSocket = async (authToken: string | null, chatId: string) => {
        if (!authToken) {
            console.log('No auth token available for socket setup');
            return;
        }

        try {
            console.log('Setting up socket connection for chat:', chatId);
            // Kết nối socket
            const socket = io(API_BASE_URL, {
                query: { token: authToken },
                transports: ['websocket']
            });

            socketRef.current = socket;

            // Add connection event listeners for debugging
            socket.on('connect', () => {
                console.log('Socket connected successfully, ID:', socket.id);
                
                // Join vào phòng chat ngay sau khi connect
                console.log('🏠 [SOCKET] Joining chat room:', chatId);
                socket.emit('joinChat', chatId);
                
                // Emit user online
                if (currentUserId) {
                    socket.emit('userOnline', { userId: currentUserId, chatId });
                }
            });

            socket.on('disconnect', (reason) => {
                console.log('Socket disconnected, reason:', reason);
            });

            socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
            });

            // Lắng nghe tin nhắn mới với batching và typing reset
            const messageUpdateQueue = new Set<string>();
            let messageUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
            
            socket.on('receiveMessage', (newMessage: Message) => {
                console.log('Received new message:', {
                    messageId: newMessage._id,
                    senderId: newMessage.sender._id,
                    content: newMessage.content?.substring(0, 50),
                    type: newMessage.type,
                    chatId: newMessage.chat || 'unknown'
                });
                
                // Reset typing indicator khi nhận tin nhắn mới từ người đang typing
                if (newMessage.sender._id === chatPartner._id) {
                    console.log('Resetting typing indicator for partner');
                    setOtherTyping(false);
                }
                
                // Cập nhật tin nhắn ngay lập tức thay vì batching để responsive hơn
                setMessages(prev => {
                    // Kiểm tra tin nhắn đã tồn tại chưa
                    const exists = prev.some(msg => msg._id === newMessage._id);
                    if (exists) {
                        console.log('Message already exists, skipping');
                        return prev;
                    }

                    console.log(`Adding new message to ${prev.length} existing messages`);
                    // Thêm tin nhắn mới và sắp xếp lại
                    const updatedMessages = [...prev, newMessage].sort(
                        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    );

                    // Lưu vào storage
                    saveMessagesToStorage(chatId, updatedMessages);
                    return updatedMessages;
                });

                // Tự động đánh dấu đã đọc nếu screen đang active và tin nhắn không phải từ mình
                if (isScreenActive && newMessage.sender._id !== currentUserId) {
                    console.log('Auto-marking message as read');
                    setTimeout(async () => {
                        const token = await AsyncStorage.getItem('authToken');
                        if (token && currentUserId) {
                            markMessagesAsRead(chatId, currentUserId, token);
                        }
                    }, 1000); // Delay 1 giây để đảm bảo user đã thấy tin nhắn
                }
            });

            // Lắng nghe trạng thái đã đọc
            socket.on('messageRead', ({ userId, chatId: updatedChatId }) => {
                console.log('Received messageRead event:', { userId, chatId: updatedChatId });
                if (updatedChatId === chatId) {
                    // Cập nhật UI ngay lập tức
                    setMessages(prev => prev.map(msg => ({
                        ...msg,
                        readBy: msg.readBy?.includes(userId) ? msg.readBy : [...(msg.readBy || []), userId]
                    })));
                }
            });

            // Lắng nghe trạng thái online/offline
            socket.on('userOnline', ({ userId }) => {
                if (chatPartner._id === userId) {
                    setIsOnline(true);
                }
            });

            socket.on('userOffline', ({ userId }) => {
                if (chatPartner._id === userId) {
                    setIsOnline(false);
                }
            });

            // Ping để duy trì kết nối
            const pingInterval = setInterval(() => {
                if (socket.connected) {
                    socket.emit('ping', { userId: currentUserId });
                }
            }, 30000);

            return () => {
                clearInterval(pingInterval);
                socket.disconnect();
            };
        } catch (error) {
            console.error('Socket setup error:', error);
        }
    };

    // ===================================================
    // Gửi tin nhắn – hỗ trợ gửi emoji custom trực tiếp
    // ===================================================
    const sendMessage = async (emojiParam?: CustomEmoji) => {
        if ((!input.trim() && !emojiParam) || !chat) return;

        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        const replyToMessage = replyTo;
        setReplyTo(null);

        let content = input.trim();
        let url = `${API_BASE_URL}/api/chats/message`;
        let body: any = {
            chatId: chat._id,
            content,
            type: 'text',
        };

        if (emojiParam) {
            // Nếu là emoji custom (có _id là ObjectId)
            if (emojiParam._id && emojiParam._id.length === 24) {
                body.isEmoji   = true;
                body.emojiId   = emojiParam._id;
                body.emojiType = emojiParam.type;
                body.emojiName = emojiParam.name;
                body.emojiUrl  = emojiParam.url;
                body.content   = ''; // custom emoji không cần text
            } else {
                // Nếu là emoji unicode, chỉ gửi content là ký tự emoji, KHÔNG set isEmoji
                body.content = emojiParam.code;
            }
        }

        // Trường hợp reply
        if (replyToMessage) {
            url = `${API_BASE_URL}/api/chats/message/reply`;
            body.replyToId = replyToMessage._id;
        }

        try {
            // DEBUG: log request details
            console.log('Posting to:', url, 'body:', body);
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            // Tránh lỗi parse JSON khi server trả HTML/text
            if (!res.ok) {
                const errText = await res.text();
                console.error('Failed to send message:', res.status, errText);
                Alert.alert('Lỗi gửi tin nhắn', `Server trả về ${res.status}: ${errText}`);
                return;
            }

            const newMessage = await res.json();
            console.log('Sent new message:', newMessage);

            if (newMessage && newMessage._id) {
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
                
                setMessages(prev => {
                    const exists = prev.some(m => m._id === newMessage._id);
                    return exists ? prev : [...prev, newMessage];
                });
                setInput('');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            Alert.alert('Lỗi gửi tin nhắn', (error as Error).message);
            // Khôi phục input & replyTo nếu gửi thất bại
            setInput(content);
            setReplyTo(replyToMessage);
        }
    };

    // Optimized real-time online/offline status tracking
    useEffect(() => {
        if (!socketRef.current || !chat?._id) return;

        // Hàm xử lý sự kiện người dùng online
        const handleUserOnline = ({ userId }: { userId: string }) => {
            console.log('User online event received:', userId, 'comparing with:', chatPartner._id);
            if (userId === chatPartner._id) {
                console.log('Setting other user to online');
                // Update online status immediately via context
                // The useOnlineStatus hook will handle the state update
            }
        };

        // Hàm xử lý sự kiện người dùng offline
        const handleUserOffline = ({ userId }: { userId: string }) => {
            console.log('User offline event received:', userId, 'comparing with:', chatPartner._id);
            if (userId === chatPartner._id) {
                console.log('Setting other user to offline');
                // Khi người dùng offline, đảm bảo trạng thái typing cũng bị reset
                setOtherTyping(false);
            }
        };

        // Xử lý sự kiện userStatus từ server với heartbeat
        const handleUserStatus = ({ userId, status, lastSeen }: { userId: string, status: string, lastSeen?: string }) => {
            console.log('User status received:', userId, status, 'lastSeen:', lastSeen, 'comparing with:', chatPartner._id);
            if (userId === chatPartner._id) {
                console.log('Setting other user status to:', status);
                // Khi người dùng offline, đảm bảo trạng thái typing cũng bị reset
                if (status === 'offline') {
                    setOtherTyping(false);
                }
            }
        };

        // Heartbeat để duy trì kết nối và cập nhật status
        const handleHeartbeat = ({ onlineUsers }: { onlineUsers: string[] }) => {
            // Server gửi danh sách user online, cập nhật ngay lập tức
            console.log('Heartbeat received, online users:', onlineUsers);
        };

        // Kiểm tra trạng thái online ngay khi kết nối
        console.log('Checking online status for user:', chatPartner._id);
        socketRef.current.emit('checkUserStatus', { userId: chatPartner._id });

        // Thiết lập các listeners
        socketRef.current.on('userOnline', handleUserOnline);
        socketRef.current.on('userOffline', handleUserOffline);
        socketRef.current.on('userStatus', handleUserStatus);
        socketRef.current.on('heartbeat', handleHeartbeat);

        // Thông báo mình online với heartbeat
        if (currentUserId) {
            console.log('Emitting userOnline for', currentUserId, 'in chat', chat._id);
            socketRef.current.emit('userOnline', { userId: currentUserId, chatId: chat._id });
            
            // Kiểm tra ngay lập tức trạng thái của chat partner
            setTimeout(() => {
                socketRef.current.emit('checkUserStatus', { userId: chatPartner._id });
            }, 1000);
        }

        // Heartbeat mỗi 10 giây thay vì 20 giây để realtime hơn
        const heartbeatInterval = setInterval(() => {
            if (socketRef.current && socketRef.current.connected) {
                // Gửi heartbeat để duy trì kết nối
                socketRef.current.emit('heartbeat', { 
                    userId: currentUserId, 
                    chatId: chat._id,
                    timestamp: Date.now()
                });
                
                // Kiểm tra status của chat partner
                socketRef.current.emit('checkUserStatus', { userId: chatPartner._id });
            }
        }, 5000); // Giảm từ 10 giây xuống 5 giây để responsive hơn

        // Ping server mỗi 5 giây để đảm bảo kết nối
        const pingInterval = setInterval(() => {
            if (socketRef.current && socketRef.current.connected) {
                socketRef.current.emit('ping', { 
                    userId: currentUserId,
                    timestamp: Date.now()
                });
            }
        }, 5000);

        return () => {
            socketRef.current?.off('userOnline', handleUserOnline);
            socketRef.current?.off('userOffline', handleUserOffline);
            socketRef.current?.off('userStatus', handleUserStatus);
            socketRef.current?.off('heartbeat', handleHeartbeat);
            clearInterval(heartbeatInterval);
            clearInterval(pingInterval);
        };
    }, [chatPartner._id, currentUserId, chat?._id]);

    // Optimized typing indicator with auto-reset
    useEffect(() => {
        if (!socketRef.current || !chat?._id) {
            console.log('❌ [TYPING SETUP] Missing requirements:', {
                socket: !!socketRef.current,
                connected: socketRef.current?.connected,
                chatId: chat?._id
            });
            return;
        }

        let typingResetTimeout: ReturnType<typeof setTimeout> | null = null;

        // Hàm xử lý sự kiện người dùng đang nhập
        const handleTyping = ({ userId, chatId }: { userId: string, chatId: string }) => {
            console.log('🟢 [TYPING EVENT] Received typing event:', {
                userId,
                chatId,
                chatPartner: chatPartner._id,
                currentChat: chat._id,
                match: chatId === chat._id && userId === chatPartner._id,
                currentOtherTyping: otherTyping
            });
            
            // Chỉ xử lý typing event cho chat hiện tại và từ đúng user
            if (chatId === chat._id && userId === chatPartner._id) {
                console.log('✅ [TYPING] Setting typing indicator to true');
                setOtherTyping(true);
                
                // Đảm bảo animation value đúng
                typingOpacityAnim.setValue(1);
                
                // Clear existing timeout để reset lại thời gian
                if (typingResetTimeout) {
                    clearTimeout(typingResetTimeout);
                }
                
                // Auto-reset typing indicator after 4 seconds
                typingResetTimeout = setTimeout(() => {
                    console.log('⏰ [TYPING] Auto-resetting typing indicator after timeout');
                    setOtherTyping(false);
                    typingOpacityAnim.setValue(0);
                    typingResetTimeout = null;
                }, 4000);
            } else {
                console.log('❌ [TYPING] Ignoring typing event - different chat or user');
            }
        };

        // Hàm xử lý sự kiện người dùng ngừng nhập
        const handleStopTyping = ({ userId, chatId }: { userId: string, chatId: string }) => {
            console.log('🔴 [STOP TYPING] Received stop typing event:', {
                userId,
                chatId,
                chatPartner: chatPartner._id,
                currentChat: chat._id,
                match: chatId === chat._id && userId === chatPartner._id,
                currentOtherTyping: otherTyping
            });
            
            // Chỉ xử lý stop typing event cho chat hiện tại và từ đúng user
            if (chatId === chat._id && userId === chatPartner._id) {
                console.log('✅ [STOP TYPING] Setting typing indicator to false');
                setOtherTyping(false);
                typingOpacityAnim.setValue(0);
                
                // Clear auto-reset timeout
                if (typingResetTimeout) {
                    clearTimeout(typingResetTimeout);
                    typingResetTimeout = null;
                }
            } else {
                console.log('❌ [STOP TYPING] Ignoring stop typing event - different chat or user');
            }
        };

        console.log('🔧 [TYPING SETUP] Setting up typing event listeners for chat:', chat._id);
        
        // Thiết lập các listeners
        socketRef.current.on('userTyping', handleTyping);
        socketRef.current.on('userStopTyping', handleStopTyping);

        return () => {
            console.log('🧹 [TYPING CLEANUP] Cleaning up typing listeners');
            if (typingResetTimeout) {
                clearTimeout(typingResetTimeout);
            }
            socketRef.current?.off('userTyping', handleTyping);
            socketRef.current?.off('userStopTyping', handleStopTyping);
        };
    }, [chatPartner._id, chat?._id, typingOpacityAnim]);

    // Debounced typing handler
    
    const handleInputChange = useCallback((text: string) => {
        setInput(text);
        const socket = socketRef.current;

        if (!socket || !chat?._id || !currentUserId) {
            return;
        }
        
        // Clear previous debounced call
        if (debouncedTypingRef.current) {
            clearTimeout(debouncedTypingRef.current);
        }
        
        // Emit typing event ngay lập tức
        socketRef.current.emit('typing', { 
            chatId: chat._id, 
            userId: currentUserId 
        });
        
        // Debounce stop typing
        if (debouncedTypingRef.current) clearTimeout(debouncedTypingRef.current);
    debouncedTypingRef.current = setTimeout(() => {
        socket.emit('stopTyping', { chatId: chatIdRef.current, userId: currentUserId });
    }, 2500);
    }, [chat?._id, currentUserId]);

    // Hàm upload file/ảnh lên server
    const uploadAttachment = async (file: any, type: 'image' | 'file') => {
        if (!chat) return;
        const token = await AsyncStorage.getItem('authToken');
        const formData = new FormData();
        formData.append('chatId', chat._id);
        if (type === 'image') {
            formData.append('file', {
                uri: file.uri,
                name: file.fileName || file.name || 'image.jpg',
                type: file.mimeType || file.type || 'image/jpeg',
            } as any);
        } else {
            formData.append('file', {
                uri: file.uri,
                name: file.name,
                type: file.mimeType || 'application/octet-stream',
            } as any);
        }
        try {
            const res = await fetch(`${API_BASE_URL}/api/chats/upload-attachment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });
            const newMessage = await res.json();
            if (newMessage && newMessage._id) {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setMessages(prevMessages => {
                    const exists = prevMessages.some(m => m._id === newMessage._id);
                    return exists ? prevMessages : [...prevMessages, newMessage];
                });
            }
        } catch (err) {
            Alert.alert('Lỗi', 'Không thể gửi file/ảnh.');
        }
    };

    // Hàm chọn/chụp ảnh với ActionSheet
    const handleImageAction = () => {
        ActionSheetIOS.showActionSheetWithOptions(
            {
                options: ['Chụp ảnh', 'Chọn từ thư viện', 'Hủy'],
                cancelButtonIndex: 2,
            },
            async (buttonIndex) => {
                if (buttonIndex === 0) {
                    // Chụp ảnh - kiểm tra quyền trước
                    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
                    if (cameraStatus !== 'granted') {
                        Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập camera để chụp ảnh.');
                        return;
                    }

                    const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        quality: 0.7, // Giảm chất lượng xuống 70%
                        allowsEditing: false, // Bỏ tính năng crop
                        exif: true, // Giữ thông tin EXIF
                    });
                    if (!result.canceled && result.assets && result.assets.length > 0) {
                        setImagesToSend(prev => [...prev, ...result.assets]);
                    }
                } else if (buttonIndex === 1) {
                    // Chọn từ thư viện - kiểm tra quyền trước
                    const { status: libStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (libStatus !== 'granted') {
                        Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
                        return;
                    }

                    // Chọn từ thư viện (cho phép nhiều ảnh)
                    const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        allowsMultipleSelection: true,
                        quality: 0.7, // Giảm chất lượng xuống 70%
                        allowsEditing: false, // Bỏ tính năng crop
                        exif: true, // Giữ thông tin EXIF
                    });
                    if (!result.canceled && result.assets && result.assets.length > 0) {
                        setImagesToSend(prev => [...prev, ...result.assets]);
                    }
                }
            }
        );
    };
    // Xóa ảnh khỏi preview
    const removeImage = (idx: number) => {
        setImagesToSend(prev => prev.filter((_, i) => i !== idx));
    };
    // Sửa hàm gửi ảnh để gửi nhiều ảnh cùng lúc
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
        if (!forwardMessage) return;                 // forwardMessage đã lưu tin gốc
        const token = await AsyncStorage.getItem('authToken');
        try {
            const res = await fetch(`${API_BASE_URL}/api/chats/message/forward`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    messageId: forwardMessage._id,
                    toUserId
                })
            });
            const data = await res.json();

            // nếu forward tới chính phòng đang mở → chèn ngay vào UI
            if (data && chat && data.chat === chat._id) {
                setMessages(prev => [...prev, data]);
            }
        } catch (err) {
            console.error('Error forwarding message:', err);
        }
    };

    // Thêm hàm mới để upload nhiều ảnh
    const uploadMultipleImages = async (images: any[]) => {
        if (!chat) return;
        const token = await AsyncStorage.getItem('authToken');

        try {
            console.log('Preparing to upload multiple images:', images.length);
            const formData = new FormData();
            formData.append('chatId', chat._id);
            formData.append('type', 'multiple-images');

            // Chuyển đổi và thêm các ảnh vào formData
            await Promise.all(images.map(async (img, index) => {
                try {
                    // Chuyển đổi ảnh sang WebP
                    const webpUri = await convertToWebP(img.uri);

                    const fileInfo = {
                        uri: webpUri,
                        name: `image_${index}.webp`, // Đổi phần mở rộng thành .webp
                        type: 'image/webp', // Đổi kiểu MIME thành image/webp
                    };
                    console.log(`Adding WebP image ${index} to formData:`, fileInfo);
                    formData.append('files', fileInfo as any);
                } catch (error) {
                    console.error(`Error processing image ${index}:`, error);
                    // Nếu có lỗi, sử dụng ảnh gốc
                    const fileInfo = {
                        uri: img.uri,
                        name: img.fileName || img.name || `image_${index}.jpg`,
                        type: img.mimeType || img.type || 'image/jpeg',
                    };
                    formData.append('files', fileInfo as any);
                }
            }));

            console.log('Sending request to upload-multiple endpoint');
            const res = await fetch(`${API_BASE_URL}/api/chats/upload-multiple`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            const newMessage = await res.json();
            console.log('Server response for multiple images upload:', newMessage);

            if (newMessage && newMessage._id) {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setMessages(prevMessages => {
                    const exists = prevMessages.some(m => m._id === newMessage._id);
                    return exists ? prevMessages : [...prevMessages, newMessage];
                });
            }
        } catch (err) {
            console.error("Error uploading multiple images:", err);
            Alert.alert('Lỗi', 'Không thể gửi nhiều ảnh cùng lúc.');
        }
    };

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
                            markMessagesAsRead(chat._id, currentUserId, token);
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
    }, [isScreenActive, currentUserId, chat?._id]);

    // Kiểm tra và cập nhật thông tin đầy đủ của chat
    useEffect(() => {
        const fetchFullChatInfo = async () => {
            if (!chat?._id || !currentUserId) return;

            try {
                const token = await AsyncStorage.getItem('authToken');
                if (!token) return;

                // Lấy thông tin đầy đủ của chat bao gồm participants
                const response = await fetch(`${API_BASE_URL}/api/chats/${chat._id}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
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
                    y: event.nativeEvent.pageY
                });
            } else {
                // Fallback position khi event không có pageX/pageY
                setReactionModalPosition({
                    x: 200, // vị trí mặc định
                    y: 400
                });
            }

            // Hiệu ứng phóng to tin nhắn
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

            const msgRes = await fetch(`${API_BASE_URL}/api/chats/messages/${chat._id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const msgData = await msgRes.json();
            if (Array.isArray(msgData)) {
                const sortedMessages = [...msgData].sort((a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                setMessages(sortedMessages);
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
            if (!res.ok) {
                console.error('Failed to add reaction:', res.status);
                return false;
            }
            // Get updated message from server
            const updatedMessage: Message = await res.json();
            // Update local state to include new reactions
            setMessages(prev =>
                prev.map(msg =>
                    msg._id === updatedMessage._id ? updatedMessage : msg
                )
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
    const renderReaction = (reaction: { emojiCode: string, isCustom: boolean }) => {
        if (!reaction.isCustom) {
            // Unicode emoji (nếu còn dùng)
            return <Text>{reaction.emojiCode}</Text>;
            } else {
            // Custom emoji/GIF từ URL
            const emoji = customEmojis.find(e => e.code === reaction.emojiCode);
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

        switch (action) {
            case 'forward':
                setForwardMessage(selectedMessage);
                setShowForwardSheet(true);
                closeReactionModal();
                break;
            case 'reply':
                setReplyTo(selectedMessage);
                break;
            case 'copy':
                Clipboard.setString(selectedMessage.content);
                setNotification({
                    visible: true,
                    type: 'success',
                    message: 'Đã sao chép nội dung tin nhắn'
                });
                break;
            case 'pin':
                handlePinMessage(selectedMessage._id);
                break;
            case 'unpin':
                handleUnpinMessage(selectedMessage._id);
                break;
            default:
                break;
        }
    };

    // Handle selecting an emoji and delegate to sendMessage
    const handleSendEmoji = async (emoji: CustomEmoji) => {
        if (!chat) return;
        setShowEmojiPicker(false);        // đóng picker
        await sendMessage(emoji);         // truyền emoji vào hàm gửi
      };

    // Thêm hàm xử lý tin nhắn ghim
    const handlePinMessage = async (messageId: string) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}/api/chats/message/${messageId}/pin`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const pinnedMessage = await response.json();

                // Lấy lại toàn bộ danh sách tin nhắn đã ghim
                if (chatIdRef.current) {
                    const pinnedRes = await fetch(`${API_BASE_URL}/api/chats/${chatIdRef.current}/pinned-messages`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const pinnedData = await pinnedRes.json();
                    if (Array.isArray(pinnedData)) {
                        setPinnedMessages(pinnedData);
                    }
                }

                // Cập nhật trạng thái isPinned trong danh sách tin nhắn
                setMessages(prev => prev.map(msg =>
                    msg._id === messageId ? { ...msg, isPinned: true, pinnedBy: currentUserId || undefined } : msg
                ));

                setNotification({
                    visible: true,
                    type: 'success',
                    message: 'Đã ghim tin nhắn'
                });
            } else {
                const error = await response.json();
                if (error.pinnedCount >= 3) {
                    setNotification({
                        visible: true,
                        type: 'error',
                        message: 'Đã đạt giới hạn tin nhắn ghim (tối đa 3 tin nhắn)'
                    });
                } else {
                    setNotification({
                        visible: true,
                        type: 'error',
                        message: error.message || 'Không thể ghim tin nhắn'
                    });
                }
            }
        } catch (error) {
            console.error('Lỗi khi ghim tin nhắn:', error);
            setNotification({
                visible: true,
                type: 'error',
                message: 'Không thể ghim tin nhắn'
            });
        }
    };

    // Hàm xử lý bỏ ghim tin nhắn
    const handleUnpinMessage = async (messageId: string) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}/api/chats/message/${messageId}/pin`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {

                // Cập nhật trạng thái isPinned trong danh sách tin nhắn
                setMessages(prev => prev.map(msg =>
                    msg._id === messageId ? { ...msg, isPinned: false, pinnedBy: undefined } : msg
                ));

                // Reload toàn bộ dữ liệu chat
                if (chatIdRef.current) {
                    try {
                        // Lấy lại danh sách tin nhắn đã ghim
                        const pinnedRes = await fetch(`${API_BASE_URL}/api/chats/${chatIdRef.current}/pinned-messages`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const pinnedData = await pinnedRes.json();
                        if (Array.isArray(pinnedData)) {
                            setPinnedMessages(pinnedData);
                        }

                        // Lấy lại toàn bộ tin nhắn
                        const msgRes = await fetch(`${API_BASE_URL}/api/chats/messages/${chatIdRef.current}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const msgData = await msgRes.json();
                        if (Array.isArray(msgData)) {
                            // Sắp xếp tin nhắn từ cũ đến mới
                            const sortedMessages = [...msgData].sort((a, b) =>
                                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                            );
                            setMessages(sortedMessages);
                        }
                    } catch (reloadError) {
                        console.error('Lỗi khi reload dữ liệu sau khi bỏ ghim:', reloadError);
                    }
                }

                setNotification({
                    visible: true,
                    type: 'success',
                    message: 'Đã bỏ ghim tin nhắn'
                });
            } else {
                setNotification({
                    visible: true,
                    type: 'error',
                    message: 'Không thể bỏ ghim tin nhắn'
                });
            }
        } catch (error) {
            console.error('Lỗi khi bỏ ghim tin nhắn:', error);
            setNotification({
                visible: true,
                type: 'error',
                message: 'Không thể bỏ ghim tin nhắn'
            });
        }
    };

    // Thêm component ReplyPreview để hiển thị preview tin nhắn đang trả lời
    const ReplyPreview = ({ message, onCancel }: { message: Message | null, onCancel: () => void }) => {
        if (!message) return null;

        const isImage = message.type === 'image';
        const isMultipleImages = message.type === 'multiple-images';
        const isFile = message.type === 'file';
        const imageUrl = isImage
            ? (message.fileUrl?.startsWith('http') ? message.fileUrl : `${API_BASE_URL}${message.fileUrl}`)
            : (isMultipleImages && message.fileUrls && message.fileUrls.length > 0
                ? (message.fileUrls[0].startsWith('http') ? message.fileUrls[0] : `${API_BASE_URL}${message.fileUrls[0]}`)
                : null
            );

        return (
            <View style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: 10,
                paddingHorizontal: 16,
                marginBottom: -8,
                position: 'relative'
            }}>
                {/* Thêm BlurView */}
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    overflow: 'hidden'
                }}>
                    <BlurView
                        intensity={8}
                        tint="default"
                    />
                </View>

                <View style={{
                    width: 3,
                    height: 40,
                    marginRight: 8,
                    borderRadius: 3
                }} />

                {/* Thumbnail ảnh nếu là ảnh hoặc nhiều ảnh */}
                {(isImage || isMultipleImages) && imageUrl && (
                    <Image
                        source={{ uri: imageUrl }}
                        style={{ width: 36, height: 36, borderRadius: 8, marginRight: 8 }}
                        resizeMode="cover"
                    />
                )}

                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#3F4246', fontFamily: 'Mulish-SemiBold', fontSize: 14 }}>
                        Trả lời {message.sender.fullname}
                    </Text>

                    {isImage && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="image-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                            <Text style={{ color: '#666', fontSize: 14, fontFamily: 'Mulish-Regular' }}>
                                Hình ảnh
                            </Text>
                        </View>
                    )}
                    {isMultipleImages && message.fileUrls && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="images-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                            <Text style={{ color: '#666', fontSize: 14, fontFamily: 'Mulish-Regular' }}>
                                {message.fileUrls.length} hình ảnh
                            </Text>
                        </View>
                    )}
                    {isFile && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="document-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                            <Text style={{ color: '#666', fontSize: 14, fontFamily: 'Mulish-Regular' }}>
                                Tệp đính kèm
                            </Text>
                        </View>
                    )}
                    {!isImage && !isMultipleImages && !isFile && (
                        <Text style={{
                            color: '#666',
                            fontSize: 14,
                            fontFamily: 'Mulish-Regular',
                            flexShrink: 1,
                            flexWrap: 'wrap'
                        }}>
                            {message.content}
                        </Text>
                    )}
                </View>

                <TouchableOpacity onPress={onCancel} style={{ padding: 5 }}>
                    <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
            </View>
        );
    };


    // Thêm hàm xử lý nhấp vào tin nhắn ghim
    const handlePinnedMessagePress = (message: Message) => {
        // Tìm index của tin nhắn trong danh sách
        const messageIndex = messages.findIndex(msg => msg._id === message._id);
        if (messageIndex !== -1) {
            // Cuộn đến tin nhắn và highlight
            setHighlightedMessageId(message._id);

            // Cuộn đến vị trí tin nhắn (lưu ý FlatList đã bị đảo ngược)
            if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                    index: messages.length - 1 - messageIndex,
                    animated: true,
                    viewPosition: 0.5
                });
            }

            // Tắt highlight sau 2 giây
            setTimeout(() => {
                setHighlightedMessageId(null);
            }, 2000);
        }
    };

    // Thêm hàm xử lý nhấp vào tin nhắn reply
    const handleReplyMessagePress = (message: Message) => {
        // Tìm index của tin nhắn trong danh sách
        const messageIndex = messages.findIndex(msg => msg._id === message._id);
        if (messageIndex !== -1) {
            // Cuộn đến tin nhắn và highlight
            setHighlightedMessageId(message._id);

            // Cuộn đến vị trí tin nhắn (lưu ý FlatList đã bị đảo ngược)
            if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                    index: messages.length - 1 - messageIndex,
                    animated: true,
                    viewPosition: 0.5
                });
            }

            // Tắt highlight sau 2 giây
            setTimeout(() => {
                setHighlightedMessageId(null);
            }, 2000);
        }
    };

    // Memoize processed messages data
    const processedMessages = useMemo(() => {
        const messagesWithTime: any[] = [];
        for (let i = 0; i < messages.length; i++) {
            const item = messages[i];
            const prevMsg = messages[i - 1];
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
        const processed = [...messagesWithTime].reverse();
        return processed;
    }, [messages]);

    // Memoized key extractor
    const keyExtractor = useCallback((item: Message | any) => {
        return item.type === 'time' ? item._id : item._id;
    }, []);

    // Thêm hàm xử lý chuyển tiếp tin nhắn
    const handleForwardMessage = async (userId: string) => {
        if (!selectedMessage?._id) return; // Thêm check null/undefined

        try {
            const response = await fetch(`${API_BASE_URL}/api/messages/forward`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    messageId: selectedMessage._id,
                    toUserId: userId,
                    fromUserId: currentUser?._id
                })
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

            const response = await fetch(`${API_BASE_URL}/api/messages/forward`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    messageId: selectedMessage._id,
                    toUserId: userId,
                    fromUserId: currentUserId
                })
            });

            if (!response.ok) {
                throw new Error('Không thể chuyển tiếp tin nhắn');
            }

            setNotification({
                visible: true,
                type: 'success',
                message: 'Đã chuyển tiếp tin nhắn thành công'
            });
            setShowForwardSheet(false);
            setSelectedMessage(null);
        } catch (error) {
            console.error('Lỗi khi chuyển tiếp tin nhắn:', error);
            setNotification({
                visible: true,
                type: 'error',
                message: 'Không thể chuyển tiếp tin nhắn'
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
        const processedImages = images.map(url => ({
            uri: url.startsWith('http') ? url : `${API_BASE_URL}${url}`
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
            const isMe = currentUserId && item.sender._id === currentUserId;
            const showAvatar = !isMe && isFirst;
            
            return (
                <MessageBubble
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
                    isLatestMessage={item._id === messages[messages.length - 1]?._id}
                    onReplyPress={handleReplyMessagePress}
                    highlightedMessageId={highlightedMessageId}
                />
            );
        },
        [
            chat, currentUserId, customEmojis, processedMessages,
            handleMessageLongPressIn, handleMessageLongPressOut,
            handleImagePress, messageScaleAnim, messages,
            formatMessageTime, getAvatar, isDifferentDay,
            handleReplyMessagePress, highlightedMessageId,
        ]
    );

    // Hàm lấy tin nhắn đã ghim
    const fetchPinnedMessages = async (chatId: string) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) return;

            const pinnedRes = await fetch(`${API_BASE_URL}/api/chats/${chatId}/pinned-messages`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const pinnedData = await pinnedRes.json();
            if (Array.isArray(pinnedData)) {
                setPinnedMessages(pinnedData);
            }
        } catch (error) {
            console.error('Lỗi khi lấy tin nhắn đã ghim:', error);
        }
    };



    // Thêm hàm xử lý yêu cầu thu hồi
    const handleRequestRevoke = (message: any) => {
        setMessageToRevoke(message);
        setShowRevokeConfirm(true);
    };

    // Hàm xác nhận thu hồi tin nhắn (FE mock, chưa gọi BE)
    const handleConfirmRevoke = async () => {
        if (!messageToRevoke) return;
        
        try {
            const authToken = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}/api/chats/message/${messageToRevoke._id}/revoke`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            // Thêm log chi tiết
            const responseText = await response.text();

            if (!response.ok) {
                throw new Error('Failed to revoke message');
            }

            // Cập nhật local state
            setMessages(prev => prev.map(msg =>
                msg._id === messageToRevoke._id
                    ? { 
                        ...msg, 
                        isRevoked: true, 
                        content: '',
                        fileUrl: undefined,
                        fileUrls: undefined,
                        fileName: undefined,
                        fileSize: undefined,
                        emojiUrl: undefined,
                        emojiType: undefined,
                        emojiId: undefined,
                        isEmoji: false
                    }
                    : msg
            ));

            setShowRevokeConfirm(false);
            setMessageToRevoke(null);
            setNotification({
                visible: true,
                type: 'success',
                message: 'Đã thu hồi tin nhắn'
            });
        } catch (error) {
            console.error('Error revoking message:', error);
            setNotification({
                visible: true,
                type: 'error',
                message: 'Không thể thu hồi tin nhắn'
            });
        }
    };

    // Debug logging cho typing state
    useEffect(() => {
        console.log('🔵 otherTyping state changed:', otherTyping);
    }, [otherTyping]);

    // Debug typing state và reset animation
    useEffect(() => {
        console.log('🔵 Typing indicator state changed:', otherTyping);
        
        // Reset animation value khi typing state change
        if (!otherTyping) {
            typingOpacityAnim.setValue(0);
        }
    }, [otherTyping, typingOpacityAnim]);

    useEffect(() => {
        if (!socketRef.current || !chat?._id) return;

        // Tăng tần suất heartbeat
        const heartbeatInterval = setInterval(() => {
            if (socketRef.current?.connected) {
                socketRef.current.emit('heartbeat', { 
                    userId: currentUserId,
                    chatId: chat._id,
                    timestamp: Date.now()
                });
            }
        }, 3000); // Giảm xuống 3 giây

        // Thêm ping để kiểm tra kết nối
        const pingInterval = setInterval(() => {
            if (socketRef.current?.connected) {
                socketRef.current.emit('ping', { 
                    userId: currentUserId,
                    timestamp: Date.now()
                });
            }
        }, 5000);

        return () => {
            clearInterval(heartbeatInterval);
            clearInterval(pingInterval);
        };
    }, [chat?._id, currentUserId]);

    useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !chat?._id) return;

    const handleUserTyping = ({ userId, chatId }) => {
        if (chatId !== chat?._id || userId === currentUserId) return;
        setOtherTyping(true);

        // Tự ẩn sau 3,5 s nếu không nhận event mới
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setOtherTyping(false);
            typingTimeoutRef.current = null;
        }, 3500);
    };

    const handleUserStopTyping = ({ userId, chatId }) => {
        if (chatId !== chat?._id || userId === currentUserId) return;
        setOtherTyping(false);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
    };

    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);

    return () => {
        socket.off('userTyping', handleUserTyping);
        socket.off('userStopTyping', handleUserStopTyping);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
    };
}, [chat?._id, currentUserId]);

    return (
        <View style={{
            flex: 1,

        }}>

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
                        <View className="flex-row items-center p-3 border-gray-200">
                            <TouchableOpacity onPress={() => navigationProp.goBack()} className="mr-2">
                                <MaterialIcons name="arrow-back-ios" size={32} color="#009483" />
                            </TouchableOpacity>
                            <View style={{ position: 'relative', marginRight: 12 }}>
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
                            </View>
                            <View style={{ justifyContent: 'center', flex: 1 }}>
                                <Text className="font-bold text-lg" style={{ marginBottom: 0 }}>{chatPartner.fullname}</Text>
                                <Text style={{ fontSize: 12, color: '#444', fontFamily: 'Inter', fontWeight: 'medium' }}>
                                    {otherTyping 
                                        ? 'đang soạn tin...' 
                                        : (isUserOnline(chatPartner._id) ? 'Đang hoạt động' : getFormattedLastSeen(chatPartner._id))
                                    }
                                </Text>
                            </View>
                            

                            

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
                            {loading ? (
                                <View className="flex-1 items-center justify-center">
                                    <Text style={{ fontFamily: 'Inter', fontWeight: 'medium' }}>Đang tải tin nhắn...</Text>
                                </View>
                            ) : messages.length === 0 ? (
                                <View className="flex-1 items-center justify-center">
                                    <Text style={{ fontFamily: 'Inter', fontWeight: 'medium' }}>Chưa có tin nhắn nào</Text>
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
                                            {otherTyping && (
                                                <View 
                                                    style={{
                                                        backgroundColor: 'yellow', // Thêm background để debug
                                                        padding: 4,
                                                        marginBottom: 8
                                                    }}
                                                    className="flex-row justify-start items-end mx-2 mt-4 mb-1"
                                                >
                                                    <View className="relative mr-1.5">
                                                        <Image
                                                            source={{ uri: getAvatar(chatPartner) }}
                                                            className="w-8 h-8 rounded-full"
                                                        />
                                                    </View>
                                                    <View className="bg-[#F5F5ED] rounded-2xl py-2 px-4 flex-row items-center">
                                                        <TypingIndicator />
                                                    </View>
                                                </View>
                                            )}
                                            {isLoadingMore && (
                                                <View style={{ padding: 10, alignItems: 'center' }}>
                                                    <Text style={{ 
                                                        fontFamily: 'Inter', 
                                                        fontSize: 12, 
                                                        color: '#666' 
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
                                        paddingHorizontal: 4,
                                        paddingBottom: keyboardVisible ? 10 : (insets.bottom + 50),
                                    }}
                                    removeClippedSubviews={true}
                                    maxToRenderPerBatch={20}
                                    windowSize={21}
                                    updateCellsBatchingPeriod={100}
                                    initialNumToRender={25}
                                    onEndReachedThreshold={0.1}
                                    onEndReached={handleLoadMore}
                                    legacyImplementation={false}
                                    onScrollToIndexFailed={(info) => {
                                        console.warn('ScrollToIndex failed:', info);
                                        // Fallback: scroll to end
                                        setTimeout(() => {
                                            flatListRef.current?.scrollToEnd({ animated: true });
                                        }, 100);
                                    }}
                                />
                            )}
                        </View>

                        {/* Input chat */}
                        <View
                            style={{
                                borderRadius: 32,
                                paddingHorizontal: 6,
                                paddingVertical: 6,
                                backgroundColor: 'transparent',
                                width: '90%',
                                alignSelf: 'center',
                                minHeight: 40,
                                paddingBottom: Platform.OS === 'ios' ? 2 : (keyboardVisible ? 2 : insets.bottom),
                                marginBottom: 5,
                                overflow: 'hidden',
                            }}
                        >
                            {/* Màu nền tiêu chuẩn - hiển thị khi không có ảnh preview và không có reply */}
                            {!imagesToSend.length && !replyTo && (
                                <View
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: 'rgba(245, 245, 237, 1)',
                                        borderRadius: 32,
                                        zIndex: 0,
                                    }}
                                />
                            )}

                            {/* BlurView - hiển thị khi có ảnh preview hoặc có reply */}
                            {(imagesToSend.length > 0 || replyTo) && (
                                <View style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    borderRadius: 32,
                                    zIndex: 0,
                                    overflow: 'hidden'
                                }}>
                                    <BlurView
                                        intensity={8}
                                        tint="default"
                                    />
                                </View>
                            )}

                            {/* Preview tin nhắn đang trả lời */}
                            {replyTo && (
                                <ReplyPreview message={replyTo} onCancel={() => setReplyTo(null)} />
                            )}

                            {/* Dòng preview ảnh (nếu có) */}
                            {imagesToSend.length > 0 && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{
                                        alignItems: 'center',
                                        marginBottom: 8,
                                        paddingVertical: 4
                                    }}
                                    style={{ maxHeight: 64, zIndex: 2 }}
                                >
                                    {imagesToSend.map((img, idx) => (
                                        <View key={idx} style={{ position: 'relative', marginRight: 8 }}>
                                            <Image source={{ uri: img.uri }} style={{ width: 48, height: 48, borderRadius: 8 }} />
                                            <TouchableOpacity
                                                onPress={() => removeImage(idx)}
                                                style={{
                                                    position: 'absolute',
                                                    top: -5,
                                                    right: -5,
                                                    backgroundColor: '#fff',
                                                    borderRadius: 10,
                                                    padding: 2,
                                                    zIndex: 3
                                                }}
                                            >
                                                <MaterialIcons name="close" size={16} color="#002855" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            )}

                            {/* Dòng chứa TextInput và các nút */}
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                width: '100%',
                                minHeight: 44,
                                zIndex: 2,
                            }}>
                                {/* Nút camera (chụp ảnh) */}
                                <TouchableOpacity
                                    style={{
                                        width: 40,
                                        height: 40,
                                        backgroundColor: '#F05023',
                                        borderRadius: 20,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginRight: 10
                                    }}
                                    onPress={async () => {
                                        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
                                        if (cameraStatus !== 'granted') {
                                            Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập camera để chụp ảnh.');
                                            return;
                                        }

                                        const result = await ImagePicker.launchCameraAsync({
                                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                            quality: 0.7, // Giảm chất lượng xuống 70%
                                            allowsEditing: false, // Bỏ tính năng crop
                                            exif: true, // Giữ thông tin EXIF
                                        });
                                        if (!result.canceled && result.assets && result.assets.length > 0) {
                                            setImagesToSend(prev => [...prev, ...result.assets]);
                                        }
                                    }}
                                >
                                    <Ionicons name="camera" size={22} color="#fff" />
                                </TouchableOpacity>

                                {/* Input tin nhắn */}
                                <TextInput
                                    value={input}
                                    onChangeText={handleInputChange}
                                    placeholder="Nhập tin nhắn"
                                    style={{
                                        flex: 1,
                                        fontSize: 16,
                                        color: '#002855',
                                        paddingVertical: 8,
                                        minHeight: 24,
                                        backgroundColor: 'transparent',
                                        fontFamily: 'Mulish-Regular',
                                    }}
                                    multiline={false}
                                    autoFocus={false}
                                    onFocus={() => setShowEmojiPicker(false)}
                                />

                                {/* Container cho các nút bên phải */}
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {/* Các nút chỉ hiển thị khi không nhập text */}
                            {!input.trim() && (
                                <>
                                            {/* Nút emoji */}
                                            <TouchableOpacity
                                                style={{ marginHorizontal: 8 }}
                                                onPress={() => {
                                                    Keyboard.dismiss();
                                                    setShowEmojiPicker(prev => !prev);
                                                }}
                                            >
                                                <FontAwesome
                                                    name={showEmojiPicker ? "keyboard-o" : "smile-o"}
                                                    size={22}
                                                    color="#00687F"
                                                />
                                            </TouchableOpacity>

                                            {/* Nút chọn ảnh từ thư viện */}
                                            <TouchableOpacity
                                                style={{ marginHorizontal: 8 }}
                                                onPress={async () => {
                                                    const { status: libStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                                                    if (libStatus !== 'granted') {
                                                        Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
                                                        return;
                                                    }

                                                    // Chọn từ thư viện (cho phép nhiều ảnh)
                                                    const result = await ImagePicker.launchImageLibraryAsync({
                                                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                                        allowsMultipleSelection: true,
                                                        quality: 0.7, // Giảm chất lượng xuống 70%
                                                        allowsEditing: false, // Bỏ tính năng crop
                                                        exif: true, // Giữ thông tin EXIF
                                                    });
                                                    if (!result.canceled && result.assets && result.assets.length > 0) {
                                                        setImagesToSend(prev => [...prev, ...result.assets]);
                                                    }
                                                }}
                                            >
                                                <Ionicons name="image-outline" size={24} color="#00687F" />
                                            </TouchableOpacity>

                                            {/* Nút đính kèm file */}
                                            <TouchableOpacity style={{ marginHorizontal: 8 }} onPress={handlePickFile}>
                                                <MaterialIcons name="attach-file" size={24} color="#00687F" />
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    {/* Nút gửi chỉ hiển thị khi có text hoặc hình ảnh để gửi */}
                            {(input.trim() !== '' || imagesToSend.length > 0) && (
                                        <TouchableOpacity onPress={handleSend} style={{ marginLeft: 8 }}>
                                    <Ionicons name="send" size={24} color="#F05023" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                        </View>

                        {/* Emoji Picker */}
                        {showEmojiPicker && (
                            <EmojiPicker
                                customEmojis={customEmojis}
                                handleSendEmoji={handleSendEmoji}
                                setShowEmojiPicker={setShowEmojiPicker}
                            />
                        )}

                    </KeyboardAvoidingView >

            {/* Thêm component ImageViewer vào render */}
                    < ImageViewing
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
                        <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Inter', fontWeight: 'medium' }}>{imageIndex + 1}/{viewerImages.length}</Text>
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
                            currentUser={currentUser} // Sửa: Truyền đúng currentUser
                            onForward={forwardSingleMessage}
                        />
                    )}

                </SafeAreaView >
            </ImageBackground >
            <NotificationModal
                visible={notification.visible}
                type={notification.type}
                message={notification.message}
                onClose={() => setNotification(prev => ({ ...prev, visible: false }))}
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