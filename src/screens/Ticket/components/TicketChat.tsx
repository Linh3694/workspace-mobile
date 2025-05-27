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
}

interface OptimizedMessage extends Message {
    isFirst: boolean;
    isLast: boolean;
    isMe: boolean;
}

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

    // Tối ưu: Debounce cho scroll
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>();
    const messagesRef = useRef<Message[]>(messages);
    messagesRef.current = messages;

    // Tối ưu: Cache cho optimized messages
    const optimizedMessages = useMemo(() => {
        return messages.map((message, index) => {
            const prevMsg = messages[index - 1];
            const nextMsg = messages[index + 1];
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
    }, [messages, currentUserId]);

    // Tối ưu: Debounced scroll to end
    const scrollToEnd = useCallback((animated = false) => {
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        
        scrollTimeoutRef.current = setTimeout(() => {
            InteractionManager.runAfterInteractions(() => {
                flatListRef.current?.scrollToEnd({ animated });
            });
        }, animated ? 100 : 50);
    }, []);

    // Tối ưu: Memoized socket setup
    const setupSocket = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const userId = await AsyncStorage.getItem('userId');
            if (!token || socketRef.current) return;

            const socket = io(API_BASE_URL, {
                query: { token },
                transports: ['websocket'],
                forceNew: true,
            });

            socket.on('connect', () => {
                console.log('🔗 Socket connected to ticket:', ticketId);
                socket.emit('joinTicketRoom', ticketId);
            });

            socket.on('newMessage', (message: Message) => {
                console.log('📨 New message received:', message._id);

                setMessages(prev => {
                    // Tối ưu: Kiểm tra duplicate nhanh
                    if (prev.some(m => m._id === message._id)) {
                        return prev;
                    }

                    const newMessages = [...prev, message];
                    scrollToEnd(false);
                    return newMessages;
                });
            });

            socket.on('connect_error', (err: any) => {
                console.error('❌ Socket connection error:', err);
            });

            socket.on('disconnect', (reason: string) => {
                console.log('🔌 Socket disconnected:', reason);
                if (reason === 'io server disconnect') {
                    // Server ngắt kết nối, cần reconnect
                    socket.connect();
                }
            });

            socketRef.current = socket;
        } catch (error) {
            console.error('Socket setup error:', error);
        }
    }, [ticketId, scrollToEnd]);

    // Tối ưu: Cleanup socket
    const cleanupSocket = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
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

    const sendImage = useCallback(async (uri: string) => {
        try {
            setSending(true);

            // Nén ảnh
            const manipResult = await manipulateAsync(
                uri,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: SaveFormat.JPEG }
            );

            const formData = new FormData();
            const filename = uri.split('/').pop() || 'image.jpg';

            formData.append('file', {
                uri: manipResult.uri,
                name: filename,
                type: 'image/jpeg'
            } as any);

            const token = await AsyncStorage.getItem('authToken');
            const response = await axios.post(
                `${API_BASE_URL}/api/tickets/${ticketId}/messages`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                    timeout: 30000, // 30s timeout
                }
            );

            if (response.data.success) {
                await fetchMessages();
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error('Lỗi khi gửi ảnh:', error);
            Alert.alert('Lỗi', 'Không thể gửi ảnh. Vui lòng thử lại sau.');
        } finally {
            setSending(false);
        }
    }, [ticketId, onRefresh]);

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
        </View>
    );
};

export default TicketChat; 