import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    ScrollView,
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    SafeAreaView,
    Dimensions,
    ActionSheetIOS,
    Alert,
    InteractionManager
} from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import io from 'socket.io-client';
import * as DocumentPicker from 'expo-document-picker';

interface TicketChatProps {
    ticketId: string;
    onRefresh?: () => void;
}

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

interface OptimizedMessage extends Message {
    isFirst: boolean;
    isLast: boolean;
    isMe: boolean;
}

// Tối ưu: Message batching để reduce re-renders
const MESSAGE_BATCH_SIZE = 20;
const VIRTUAL_LIST_THRESHOLD = 100;

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const TicketChat: React.FC<TicketChatProps> = ({ ticketId, onRefresh }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const flatListRef = useRef<FlatList>(null);
    const [showImageOptions, setShowImageOptions] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const socketRef = useRef<any>(null);
    const [imageError, setImageError] = useState<{[key: string]: boolean}>({});
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [imagesToSend, setImagesToSend] = useState<string[]>([]);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    
    // Tối ưu: Message batching state
    const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
    const [lastBatchTime, setLastBatchTime] = useState(Date.now());
    const batchTimeoutRef = useRef<NodeJS.Timeout>();

    // Tối ưu: Debounce cho scroll
    const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const messagesRef = useRef<Message[]>(messages);
    messagesRef.current = messages;

    // Tối ưu: Virtual scrolling cho many messages
    const shouldUseVirtualScrolling = useMemo(() => {
        return messages.length > VIRTUAL_LIST_THRESHOLD;
    }, [messages.length]);

    // Tối ưu: Memoized message processing với stable reference
    const optimizedMessages = useMemo(() => {
        const allMessages = [...messages, ...pendingMessages];
        
        return allMessages.map((message, index) => {
            const prevMsg = allMessages[index - 1];
            const nextMsg = allMessages[index + 1];
            const isMe = message.sender._id === currentUserId;
            const isPrevSameSender = prevMsg?.sender?._id === message.sender._id;
            const isNextSameSender = nextMsg?.sender?._id === message.sender._id;

            return {
                ...message,
                isFirst: !isPrevSameSender,
                isLast: !isNextSameSender,
                isMe
            } as OptimizedMessage;
        });
    }, [messages, pendingMessages, currentUserId]);

    // Tối ưu: Batch message updates + Debug
    const batchAddMessage = useCallback((newMsg: Message) => {
        console.log('🔄 BATCH ADD MESSAGE called:', {
            messageId: newMsg._id,
            sender: newMsg.sender?.fullname,
            pendingCount: pendingMessages.length
        });

        setPendingMessages(prev => {
            // Check for duplicates in pending
            const isDuplicate = prev.some(m => m._id === newMsg._id || (m.tempId && m.tempId === newMsg.tempId));
            if (isDuplicate) {
                console.log('⚠️ Duplicate message in pending:', newMsg._id);
                return prev;
            }
            
            console.log('➕ Adding message to pending batch:', newMsg._id);
            return [...prev, newMsg];
        });

        // Clear existing timeout
        if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
            console.log('⏱️ Cleared existing batch timeout');
        }

        // Set new timeout for batch processing
        batchTimeoutRef.current = setTimeout(() => {
            console.log('⚡ Processing message batch...');
            
            setPendingMessages(pending => {
                if (pending.length === 0) {
                    console.log('📭 No pending messages to process');
                    return pending;
                }
                
                console.log(`📬 Processing ${pending.length} pending messages`);
                
                setMessages(prev => {
                    const combined = [...prev];
                    let addedCount = 0;
                    
                    pending.forEach(pendingMsg => {
                        const exists = combined.some(m => m._id === pendingMsg._id);
                        if (!exists) {
                            combined.push(pendingMsg);
                            addedCount++;
                        } else {
                            console.log('⚠️ Message already exists in main list:', pendingMsg._id);
                        }
                    });
                    
                    console.log(`✅ Added ${addedCount} new messages to main list`);
                    
                    const sorted = combined.sort((a, b) => 
                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );
                    
                    console.log(`📋 Total messages after sort: ${sorted.length}`);
                    return sorted;
                });
                
                console.log('📜 Scrolling to end after batch processing');
                scrollToEnd(false);
                return [];
            });
            setLastBatchTime(Date.now());
        }, 100); // 100ms batch window

    }, [pendingMessages.length]);

    // Tối ưu: Debounced scroll to end với InteractionManager
    const scrollToEnd = useCallback((animated = false) => {
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        
        scrollTimeoutRef.current = setTimeout(() => {
            InteractionManager.runAfterInteractions(() => {
                flatListRef.current?.scrollToEnd({ 
                    animated: animated && messages.length < 50 // Only animate for smaller lists
                });
            });
        }, animated ? 150 : 50);
    }, [messages.length]);

    // Tối ưu: Memoized socket setup với stable dependencies + Debug
    const setupSocket = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            console.log('🔍 Setting up socket with token:', token ? 'Token exists' : 'No token');
            
            if (!token) {
                console.error('❌ No auth token found for socket connection');
                return;
            }
            
            if (socketRef.current) {
                console.log('🔄 Socket already exists, cleaning up first');
                cleanupSocket();
            }

            console.log('🚀 Creating new socket connection to:', API_BASE_URL);
            const socket = io(API_BASE_URL, {
                query: { token },
                transports: ['websocket'],
                forceNew: true,
                timeout: 10000,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            socket.on('connect', () => {
                console.log('✅ Socket connected successfully! Socket ID:', socket.id);
                console.log('🎫 Joining ticket room:', ticketId);
                updateSocketStatus('connected');
                socket.emit('joinTicketRoom', ticketId);
            });

            // Debug: Listen for join success/error
            socket.on('error', (error: any) => {
                console.error('❌ Socket error received:', error);
                updateSocketStatus('error');
                Alert.alert('Lỗi kết nối', error.message || 'Có lỗi xảy ra với kết nối chat');
            });

            socket.on('authError', (error: any) => {
                console.error('🔐 Socket auth error:', error);
                updateSocketStatus('auth_error');
                Alert.alert('Lỗi xác thực', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
            });

            socket.on('newMessage', (message: Message) => {
                console.log('📨 NEW MESSAGE RECEIVED:', {
                    messageId: message._id,
                    sender: message.sender?.fullname,
                    text: message.text?.substring(0, 50) + '...',
                    type: message.type,
                    timestamp: message.timestamp
                });
                
                // Cập nhật debug info
                setLastMessageReceived(`${message.sender?.fullname}: ${message.text?.substring(0, 30)}...`);
                
                // Kiểm tra message có hợp lệ không
                if (!message._id || !message.sender) {
                    console.error('❌ Invalid message received:', message);
                    return;
                }
                
                batchAddMessage(message);
            });

            socket.on('connect_error', (err: any) => {
                console.error('❌ Socket connection error:', err.message || err);
                updateSocketStatus('connect_error');
            });

            socket.on('disconnect', (reason: string) => {
                console.log('🔌 Socket disconnected. Reason:', reason);
                updateSocketStatus('disconnected');
                if (reason === 'io server disconnect') {
                    console.log('⏳ Server disconnected, attempting reconnect in 1s...');
                    setTimeout(() => socket.connect(), 1000);
                }
            });

            // Enhanced reconnection handling
            socket.on('reconnect', (attemptNumber: number) => {
                console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
                console.log('🎫 Re-joining ticket room after reconnect:', ticketId);
                updateSocketStatus('reconnected');
                socket.emit('joinTicketRoom', ticketId);
                
                // Refresh messages after reconnect
                console.log('🔄 Refreshing messages after reconnect...');
                fetchMessages();
            });

            socket.on('reconnect_error', (error: any) => {
                console.error('❌ Socket reconnection error:', error);
                updateSocketStatus('reconnect_error');
            });

            // Debug: Listen for successful room join
            socket.on('userOnline', (data: any) => {
                console.log('👤 User online event:', data);
            });

            // Listen for message confirmations
            socket.on('messageConfirmed', (data: any) => {
                console.log('✅ Message confirmed:', data);
            });

            socketRef.current = socket;
            console.log('✅ Socket setup completed');
        } catch (error) {
            console.error('💥 Socket setup error:', error);
        }
    }, [ticketId, batchAddMessage, cleanupSocket]);

    // Tối ưu: Cleanup socket với proper teardown
    const cleanupSocket = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        
        if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
        }
    }, []);

    // Xử lý bàn phím và socket
    useEffect(() => {
        let isMounted = true;

        const initializeChat = async () => {
            try {
                const userId = await AsyncStorage.getItem('userId');
                if (userId && isMounted) {
                    setCurrentUserId(userId);
                }

                await Promise.all([
                    fetchMessages(),
                    fetchCurrentUser(),
                    setupSocket()
                ]);
            } catch (error) {
                console.error('Chat initialization error:', error);
            }
        };

        // Keyboard listeners
        const keyboardWillShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                if (!isMounted) return;
                setKeyboardHeight(e.endCoordinates.height);
                setKeyboardVisible(true);
                scrollToEnd(false);
            }
        );

        const keyboardWillHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                if (!isMounted) return;
                setKeyboardHeight(0);
                setKeyboardVisible(false);
            }
        );

        initializeChat();

        // Tự động refresh thông minh hơn
        const refreshInterval = setInterval(() => {
            if (isMounted && !socketRef.current?.connected) {
                fetchMessages();
            }
        }, 30000); // Chỉ refresh khi socket disconnect

        return () => {
            isMounted = false;
            keyboardWillShowListener.remove();
            keyboardWillHideListener.remove();
            clearInterval(refreshInterval);
            cleanupSocket();
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [ticketId, setupSocket, cleanupSocket, scrollToEnd]);

    const fetchCurrentUser = async () => {
        try {
            const userData = await AsyncStorage.getItem('user');
            const userId = await AsyncStorage.getItem('userId');
            if (userData) {
                setCurrentUser(JSON.parse(userData));
            }
            if (userId) {
                setCurrentUserId(userId);
            }
        } catch (error) {
            console.error('Lỗi khi lấy thông tin người dùng:', error);
        }
    };

    const fetchMessages = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await axios.get(`${API_BASE_URL}/api/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setMessages(response.data.ticket.messages || []);
                scrollToEnd(false);
            }
        } catch (error) {
            console.error('Lỗi khi lấy tin nhắn:', error);
        } finally {
            setLoading(false);
        }
    };

    // Tối ưu: Debounced send message
    const sendMessage = useCallback(async () => {
        if (!newMessage.trim() || sending) return;

        const messageToSend = newMessage.trim();
        setNewMessage('');
        setSending(true);

        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await axios.post(`${API_BASE_URL}/api/tickets/${ticketId}/messages`,
                { text: messageToSend },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                await fetchMessages();
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error('Lỗi khi gửi tin nhắn:', error);
            setNewMessage(messageToSend); // Restore message nếu fail
            Alert.alert('Lỗi', 'Không thể gửi tin nhắn. Vui lòng thử lại.');
        } finally {
            setSending(false);
        }
    }, [newMessage, sending, ticketId, onRefresh]);

    // Tối ưu image handling
    const pickImage = useCallback(async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Quyền truy cập', 'Cần quyền truy cập thư viện ảnh để tải lên hình ảnh');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.7,
            allowsMultipleSelection: false,
        });

        if (!result.canceled && result.assets.length > 0) {
            const asset = result.assets[0];
            setImagesToSend(prev => [...prev, asset.uri]);
        }
    }, []);

    const takePhoto = useCallback(async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Quyền truy cập', 'Cần quyền truy cập camera để chụp ảnh');
            return;
        }

        let result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.7,
        });

        if (!result.canceled && result.assets.length > 0) {
            const asset = result.assets[0];
            setImagesToSend(prev => [...prev, asset.uri]);
        }
    }, []);

    const handleAttachmentOptions = useCallback(() => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Chụp ảnh', 'Chọn từ thư viện', 'Chọn file', 'Hủy'],
                    cancelButtonIndex: 3,
                },
                async (buttonIndex) => {
                    if (buttonIndex === 0) {
                        await takePhoto();
                    } else if (buttonIndex === 1) {
                        await pickImage();
                    } else if (buttonIndex === 2) {
                        await handlePickDocument();
                    }
                }
            );
        } else {
            setShowImageOptions(true);
        }
    }, [takePhoto, pickImage]);

    const handlePickDocument = useCallback(async () => {
        const result = await DocumentPicker.getDocumentAsync({ 
            type: '*/*', 
            copyToCacheDirectory: true 
        });
        
        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            await sendImage(asset.uri);
        }
    }, []);

    // Tối ưu: Progressive image compression
    const compressImage = useCallback(async (uri: string, quality = 0.7) => {
        try {
            // Lấy thông tin kích thước ảnh
            const imageInfo = await manipulateAsync(uri, [], { format: SaveFormat.JPEG });
            
            let targetQuality = quality;
            let targetWidth = 1024;
            
            // Dynamic compression based on image size
            const fileSize = await fetch(uri).then(r => r.blob()).then(b => b.size);
            if (fileSize > 5 * 1024 * 1024) { // > 5MB
                targetQuality = 0.5;
                targetWidth = 800;
            } else if (fileSize > 2 * 1024 * 1024) { // > 2MB
                targetQuality = 0.6;
                targetWidth = 900;
            }

            const manipulationOptions = [];
            
            // Resize if needed
            if (imageInfo.width > targetWidth) {
                manipulationOptions.push({ resize: { width: targetWidth } });
            }

            const result = await manipulateAsync(
                uri,
                manipulationOptions,
                { 
                    compress: targetQuality, 
                    format: SaveFormat.JPEG,
                    base64: false // Don't need base64, saves memory
                }
            );

            return result;
        } catch (error) {
            console.error('Image compression error:', error);
            // Fallback to original
            return { uri };
        }
    }, []);

    // Tối ưu: Batch image sending với progress
    const sendImageBatch = useCallback(async (uris: string[]) => {
        setSending(true);
        
        try {
            for (let i = 0; i < uris.length; i++) {
                const uri = uris[i];
                
                // Show progress for multiple images
                if (uris.length > 1) {
                    console.log(`Uploading image ${i + 1}/${uris.length}`);
                }

                const compressedImage = await compressImage(uri);
                await sendSingleImage(compressedImage.uri);
                
                // Small delay between uploads to prevent server overload
                if (i < uris.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        } catch (error) {
            console.error('Batch image send error:', error);
            Alert.alert('Lỗi', 'Không thể gửi một số ảnh. Vui lòng thử lại.');
        } finally {
            setSending(false);
        }
    }, [compressImage]);

    const sendSingleImage = useCallback(async (uri: string) => {
        const formData = new FormData();
        const filename = uri.split('/').pop() || `image_${Date.now()}.jpg`;

        formData.append('file', {
            uri,
            name: filename,
            type: 'image/jpeg'
        } as any);

        const token = await AsyncStorage.getItem('authToken');
        
        // Add retry logic
        let retries = 3;
        while (retries > 0) {
            try {
                const response = await axios.post(
                    `${API_BASE_URL}/api/tickets/${ticketId}/messages`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data',
                        },
                        timeout: 30000,
                    }
                );

                if (response.data.success) {
                    await fetchMessages();
                    if (onRefresh) onRefresh();
                    return;
                }
                break;
            } catch (error) {
                retries--;
                if (retries === 0) {
                    throw error;
                }
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }, [ticketId, onRefresh]);

    const sendImage = useCallback(async (uri: string) => {
        await sendImageBatch([uri]);
    }, [sendImageBatch]);

    const removeImage = useCallback((idx: number) => {
        setImagesToSend(prev => prev.filter((_, i) => i !== idx));
    }, []);

    const handleSend = useCallback(async () => {
        if (sending) return;

        if (imagesToSend.length > 0) {
            for (const uri of imagesToSend) {
                await sendImage(uri);
            }
            setImagesToSend([]);
        }
        if (newMessage.trim()) {
            await sendMessage();
        }
    }, [imagesToSend, newMessage, sending, sendImage, sendMessage]);

    const formatDate = useCallback((dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }, []);
    
    // Tối ưu: Memoized image error handler
    const handleImageError = useCallback((messageId: string) => {
        console.log("Lỗi hiển thị ảnh cho tin nhắn:", messageId);
        setImageError(prev => ({...prev, [messageId]: true}));
    }, []);

    // Tối ưu: Memoized image URL
    const getImageUrl = useCallback((imagePath: string) => {
        if (imagePath.startsWith('http')) {
            return imagePath;
        }

        if (imagePath.includes('/uploads/Messages/')) {
            return `${API_BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
        }

        return `${API_BASE_URL}/uploads/Messages/${imagePath}`;
    }, []);

    // Tối ưu: Memoized render item với keyExtractor
    const renderItem = useCallback(({ item: message }: { item: OptimizedMessage }) => {
        const { isFirst, isLast, isMe } = message;

        let borderRadiusStyle: any = {};
        if (isMe) {
            if (isFirst && isLast) {
                borderRadiusStyle = { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 20 };
            } else if (isLast) {
                borderRadiusStyle = { borderTopLeftRadius: 20, borderTopRightRadius: 4, borderBottomRightRadius: 20, borderBottomLeftRadius: 20 };
            } else if (isFirst) {
                borderRadiusStyle = { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 4, borderBottomLeftRadius: 20 };
            } else {
                borderRadiusStyle = { borderTopLeftRadius: 20, borderTopRightRadius: 4, borderBottomRightRadius: 4, borderBottomLeftRadius: 20 };
            }
        } else {
            if (isFirst && isLast) {
                borderRadiusStyle = { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 20 };
            } else if (isLast) {
                borderRadiusStyle = { borderTopLeftRadius: 4, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 4 };
            } else if (isFirst) {
                borderRadiusStyle = { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 4 };
            } else {
                borderRadiusStyle = { borderTopLeftRadius: 4, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 4 };
            }
        }

        const showAvatar = !isMe && isLast;
        const containerDirection = isMe ? 'row-reverse' : 'row';
        const bubbleBg = message.type === 'image' ? 'transparent' : (isMe ? '#002855' : '#F8F8F8');

        return (
            <View className={`flex-row items-end ${isMe ? 'flex-row-reverse' : ''} ${isLast ? 'mb-2' : 'mb-0.5'}`}>
                {showAvatar ? (
                    <Image
                        source={{
                            uri: message.sender.avatarUrl
                                ? `${API_BASE_URL}/uploads/Avatar/${message.sender.avatarUrl}`
                                : `https://ui-avatars.com/api/?name=${encodeURIComponent(message.sender.fullname)}`
                        }}
                        className="w-9 h-9 rounded-full mx-1"
                    />
                ) : (
                        <View className={`${isMe ? 'w-1' : 'w-11'}`} />
                )}

                <View
                    className={`${message.type === 'image' ? 'p-0' : 'py-2 px-3.5'} max-w-[75%]`}
                    style={{
                        backgroundColor: bubbleBg,
                        ...borderRadiusStyle
                    }}
                >
                    {message.type === 'image' ? (
                        <Image
                            source={{ uri: getImageUrl(message.text) }}
                            className="w-50 h-37.5 rounded-3"
                            resizeMode="cover"
                            onError={() => handleImageError(message._id)}
                        />
                    ) : (
                            <Text className={`${isMe ? 'text-white' : 'text-gray-800'}`}>{message.text}</Text>
                    )}
                    <Text className={`text-xs ${isMe ? 'text-gray-300' : 'text-gray-500'} mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                        {formatDate(message.timestamp)}
                    </Text>
                </View>
            </View>
        );
    }, [getImageUrl, handleImageError, formatDate]);

    // Tối ưu: Memoized key extractor
    const keyExtractor = useCallback((item: OptimizedMessage, index: number) => {
        return item._id || `temp-${index}`;
    }, []);

    // Tối ưu: Memoized getItemLayout cho FlatList performance
    const getItemLayout = useCallback((data: any, index: number) => ({
        length: 80, // Estimate height
        offset: 80 * index,
        index,
    }), []);

    // Debug Panel State
    const [debugMode, setDebugMode] = useState(__DEV__); // Chỉ hiện trong dev mode
    const [socketStatus, setSocketStatus] = useState('disconnected');
    const [lastMessageReceived, setLastMessageReceived] = useState<string>('');

    // Cập nhật socket status
    const updateSocketStatus = useCallback((status: string) => {
        setSocketStatus(status);
        console.log('🔌 Socket status changed to:', status);
    }, []);

    // Test function để gửi message thông qua socket
    const testSocketMessage = useCallback(() => {
        if (socketRef.current?.connected) {
            const testMessage = `Test message at ${new Date().toLocaleTimeString()}`;
            console.log('🧪 Sending test message via socket:', testMessage);
            
            socketRef.current.emit('sendMessage', {
                ticketId: ticketId,
                text: testMessage,
                type: 'text',
                tempId: `test_${Date.now()}`
            });
        } else {
            Alert.alert('Debug', 'Socket không kết nối!');
        }
    }, [ticketId]);

    // Debug component
    const DebugPanel = () => {
        if (!debugMode) return null;

        return (
            <View style={{ 
                position: 'absolute', 
                top: 50, 
                right: 10, 
                backgroundColor: 'rgba(0,0,0,0.8)', 
                padding: 10, 
                borderRadius: 8,
                zIndex: 1000
            }}>
                <Text style={{ color: 'white', fontSize: 12 }}>
                    🔌 Socket: {socketStatus}
                </Text>
                <Text style={{ color: 'white', fontSize: 12 }}>
                    📬 Messages: {messages.length} + {pendingMessages.length} pending
                </Text>
                <Text style={{ color: 'white', fontSize: 12 }}>
                    🎫 Ticket: {ticketId}
                </Text>
                <Text style={{ color: 'white', fontSize: 12 }}>
                    📨 Last: {lastMessageReceived}
                </Text>
                <TouchableOpacity 
                    onPress={testSocketMessage}
                    style={{ backgroundColor: 'blue', padding: 5, marginTop: 5, borderRadius: 3 }}
                >
                    <Text style={{ color: 'white', fontSize: 10 }}>Test Socket</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setupSocket()}
                    style={{ backgroundColor: 'green', padding: 5, marginTop: 3, borderRadius: 3 }}
                >
                    <Text style={{ color: 'white', fontSize: 10 }}>Reconnect</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setDebugMode(false)}
                    style={{ backgroundColor: 'red', padding: 5, marginTop: 3, borderRadius: 3 }}
                >
                    <Text style={{ color: 'white', fontSize: 10 }}>Hide</Text>
                </TouchableOpacity>
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#002855" />
                <Text className="mt-3 text-base text-gray-600">Đang tải tin nhắn...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            <FlatList
                data={optimizedMessages}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ref={flatListRef}
                onContentSizeChange={scrollToEnd}
                onLayout={scrollToEnd}
                className="flex-1"
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 8,
                    paddingBottom: keyboardVisible ? keyboardHeight + 20 : 80
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                removeClippedSubviews={true}
                initialNumToRender={20}
                maxToRenderPerBatch={10}
                windowSize={10}
                updateCellsBatchingPeriod={50}
                getItemLayout={getItemLayout}
                ListEmptyComponent={
                    <View className="flex-1 justify-center items-center py-8">
                        <Text className="text-gray-600 text-base font-medium">Chưa có tin nhắn nào</Text>
                    </View>
                }
            />

            {imagesToSend.length > 0 && (
                <View className="border-t border-gray-300 bg-white py-2">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
                        {imagesToSend.map((uri, idx) => (
                            <View key={idx} className="relative mr-3">
                                <Image source={{ uri }} className="w-20 h-20 rounded-2" />
                                <TouchableOpacity
                                    onPress={() => removeImage(idx)}
                                    className="absolute -top-2 -right-2 bg-black/60 rounded-3 p-1"
                                >
                                    <Ionicons name="close" size={16} color="#ffffff" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            <View
                className="flex-row items-center border-t border-gray-300 p-2 px-3 bg-white w-full z-10"
                style={{
                    position: 'absolute',
                    bottom: keyboardVisible ? keyboardHeight : 0,
                    left: 0,
                    right: 0,
                    paddingBottom: Platform.OS === 'ios' ? 2 : (keyboardVisible ? 2 : 0)
                }}
            >
                <TouchableOpacity
                    onPress={handleAttachmentOptions}
                    className="p-2"
                    activeOpacity={0.7}
                >
                    <Ionicons name="attach-outline" size={24} color="#002855" />
                </TouchableOpacity>

                <TextInput
                    className="flex-1 bg-gray-100 rounded-3xl px-4 py-2.5 mx-2 text-base max-h-25"
                    placeholder="Nhập tin nhắn..."
                    value={newMessage}
                    onChangeText={setNewMessage}
                    multiline
                    maxLength={500}
                    onFocus={scrollToEnd}
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                    blurOnSubmit={false}
                />

                <TouchableOpacity
                    onPress={handleSend}
                    disabled={sending || (!newMessage.trim() && imagesToSend.length === 0)}
                    className={`p-2 rounded-5 ${((!newMessage.trim() && imagesToSend.length === 0) || sending) ? 'opacity-50' : ''}`}
                    activeOpacity={0.7}
                >
                    {sending ? (
                        <ActivityIndicator size="small" color="#002855" />
                    ) : (
                        <Ionicons name="send" size={24} color="#F05023" />
                    )}
                </TouchableOpacity>
            </View>

            {Platform.OS === 'android' && (
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowImageOptions(false)}
                    className={`absolute top-0 left-0 right-0 bottom-0 bg-black/30 z-20 ${showImageOptions ? 'flex' : 'hidden'}`}
                />
            )}

            {Platform.OS === 'android' && showImageOptions && (
                <View
                    className="absolute left-2.5 right-2.5 z-30 items-center"
                    style={{
                        bottom: keyboardVisible ? keyboardHeight + 60 : 70
                    }}
                >
                    <View className="bg-white w-full rounded-3 shadow-lg overflow-hidden">
                        <TouchableOpacity
                            className="flex-row items-center p-4 border-b border-gray-100"
                            onPress={() => {
                                setShowImageOptions(false);
                                takePhoto();
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="camera-outline" size={24} color="#002855" />
                            <Text className="ml-3 text-base font-medium">Chụp ảnh mới</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-row items-center p-4 border-b border-gray-100"
                            onPress={() => {
                                setShowImageOptions(false);
                                pickImage();
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="images-outline" size={24} color="#002855" />
                            <Text className="ml-3 text-base font-medium">Chọn từ thư viện</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-row items-center p-4"
                            onPress={() => {
                                setShowImageOptions(false);
                                handlePickDocument();
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="document-outline" size={24} color="#002855" />
                            <Text className="ml-3 text-base font-medium">Chọn tệp</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <DebugPanel />
        </View>
    );
};

export default TicketChat; 