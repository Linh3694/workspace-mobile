import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Keyboard, SafeAreaView, Dimensions, ActionSheetIOS, StyleSheet } from 'react-native';
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

    // Xử lý bàn phím và socket
    useEffect(() => {
        // Load userId sớm để sử dụng cho việc kiểm tra thông báo
        AsyncStorage.getItem('userId').then(userId => {
            if (userId) setCurrentUserId(userId);
        });

        // Lắng nghe sự kiện bàn phím hiện/ẩn
        const keyboardWillShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                setKeyboardHeight(e.endCoordinates.height);
                setKeyboardVisible(true);
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                }, 100);
            }
        );
        
        const keyboardWillHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setKeyboardHeight(0);
                setKeyboardVisible(false);
            }
        );

        // Thiết lập socket
        const setupSocket = async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');
                const userId = await AsyncStorage.getItem('userId');
                if (!token) return;

                const socket = io(API_BASE_URL, {
                    query: { token },
                    transports: ['websocket'],
                });

                socket.on('connect', () => {
                    console.log('Socket connected to', API_BASE_URL);
                    socket.emit('joinTicketRoom', ticketId);
                });

                socket.on('newMessage', (message: Message) => {
                    console.log('New message received via socket:', message);
                    
                    // Chỉ hiển thị tin nhắn mới nếu chưa có trong danh sách
                    setMessages(prev => {
                        if (prev.some(m => m._id === message._id)) {
                            return prev;
                        }
                        return [...prev, message];
                    });
                    
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: false });
                    }, 100);
                    
                    // Quan trọng: So sánh ID người gửi với currentUserId để quyết định xem có gửi thông báo hay không
                    if (userId && message.sender._id !== userId) {
                        // Đây là tin nhắn từ người khác, nên cần gửi thông báo
                        console.log('Should send notification to', userId);
                        // Thông báo được xử lý ở server, client chỉ cần xử lý hiển thị tin nhắn
                    } else {
                        console.log('No notification needed, this is user\'s own message');
                    }
                });

                socket.on('connect_error', (err: any) => {
                    console.error('Socket connection error:', err);
                });

                socketRef.current = socket;
            } catch (error) {
                console.error('Error setting up socket:', error);
            }
        };

        fetchMessages();
        fetchCurrentUser();
        setupSocket();

        // Tự động làm mới tin nhắn
        const intervalId = setInterval(() => {
            fetchMessages();
        }, 15000); // Cập nhật mỗi 15 giây

        return () => {
            keyboardWillShowListener.remove();
            keyboardWillHideListener.remove();
            clearInterval(intervalId);
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [ticketId]);

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
                // Scroll xuống cuối sau khi load tin nhắn
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                }, 200);
            }
        } catch (error) {
            console.error('Lỗi khi lấy tin nhắn:', error);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim()) {
            return;
        }

        setSending(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await axios.post(`${API_BASE_URL}/api/tickets/${ticketId}/messages`,
                { text: newMessage },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setNewMessage('');
                fetchMessages();
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error('Lỗi khi gửi tin nhắn:', error);
        } finally {
            setSending(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            alert('Cần quyền truy cập thư viện ảnh để tải lên hình ảnh');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled && result.assets.length > 0) {
            const asset = result.assets[0];
            setImagesToSend(prev => [...prev, asset.uri]);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();

        if (status !== 'granted') {
            alert('Cần quyền truy cập camera để chụp ảnh');
            return;
        }

        let result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled && result.assets.length > 0) {
            const asset = result.assets[0];
            setImagesToSend(prev => [...prev, asset.uri]);
        }
    };

    const handleAttachmentOptions = () => {
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
            // Fallback cho Android - hiện tại giữ nguyên logic hiện tại
            setShowImageOptions(true);
        }
    };

    const handlePickDocument = async () => {
        const result = await DocumentPicker.getDocumentAsync({ 
            type: '*/*', 
            copyToCacheDirectory: true 
        });
        
        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            await sendImage(asset.uri);
        }
    };

    const sendImage = async (uri: string) => {
        try {
            // Nén ảnh
            const manipResult = await manipulateAsync(
                uri,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: SaveFormat.JPEG }
            );

            const formData = new FormData();
            const filename = uri.split('/').pop() || 'image.jpg';

            // Sử dụng 'photo' thay vì 'file' cho phù hợp với server
            formData.append('file', {
                uri: manipResult.uri,
                name: filename,
                type: 'image/jpeg'
            } as any);

            setSending(true);

            const token = await AsyncStorage.getItem('authToken');
            const response = await axios.post(
                `${API_BASE_URL}/api/tickets/${ticketId}/messages`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            if (response.data.success) {
                fetchMessages();
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error('Lỗi khi gửi ảnh:', error);
            alert('Không thể gửi ảnh. Vui lòng thử lại sau.');
        } finally {
            setSending(false);
        }
    };

    const removeImage = (idx: number) => {
        setImagesToSend(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSend = async () => {
        if (imagesToSend.length > 0) {
            for (const uri of imagesToSend) {
                await sendImage(uri);
            }
            setImagesToSend([]);
        }
        if (newMessage.trim()) {
            await sendMessage();
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    // Xử lý lỗi hiển thị ảnh
    const handleImageError = (messageId: string) => {
        console.log("Lỗi hiển thị ảnh cho tin nhắn:", messageId);
        setImageError(prev => ({...prev, [messageId]: true}));
    };

    // Tạo URL đầy đủ cho ảnh
    const getImageUrl = (imagePath: string) => {
        // Kiểm tra xem imagePath là đường dẫn tương đối hay URL đầy đủ
        if (imagePath.startsWith('http')) {
            return imagePath; // Nếu đã là URL đầy đủ thì trả về nguyên vẹn
        }
        
        // Kiểm tra nếu imagePath chỉ là tên file hoặc đường dẫn đầy đủ
        if (imagePath.includes('/uploads/Messages/')) {
            // Đã có đường dẫn đầy đủ, chỉ cần thêm API_BASE_URL
            return `${API_BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
        }
        
        // Trường hợp chỉ là tên file
        return `${API_BASE_URL}/uploads/Messages/${imagePath}`;
    };

    // Render từng tin nhắn
    const renderItem = ({ item: message, index }: { item: Message, index: number }) => {
        const isMe = message.sender._id === currentUserId;
        const prevMsg = messages[index - 1];
        const nextMsg = messages[index + 1];

        const isPrevSameSender = prevMsg?.sender?._id === message.sender._id;
        const isNextSameSender = nextMsg?.sender?._id === message.sender._id;

        const isFirst = !isPrevSameSender;
        const isLast = !isNextSameSender;

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
            <View style={{ flexDirection: containerDirection, alignItems: 'flex-end', marginBottom: isLast ? 8 : 2 }}>
                {showAvatar ? (
                    <Image
                        source={{
                            uri: message.sender.avatarUrl
                                ? `${API_BASE_URL}/uploads/Avatar/${message.sender.avatarUrl}`
                                : `https://ui-avatars.com/api/?name=${encodeURIComponent(message.sender.fullname)}`
                        }}
                        style={{ width: 36, height: 36, borderRadius: 18, marginHorizontal: 4 }}
                    />
                ) : (
                        <View style={{ width: isMe ? 4 : 44 }} />
                )}

                <View style={{
                    backgroundColor: bubbleBg,
                    paddingVertical: message.type === 'image' ? 0 : 8,
                    paddingHorizontal: message.type === 'image' ? 0 : 14,
                    maxWidth: '75%',
                    ...borderRadiusStyle
                }}>
                    {message.type === 'image' ? (
                        <Image
                            source={{ uri: getImageUrl(message.text) }}
                            style={{ width: 200, height: 150, borderRadius: 12 }}
                            resizeMode="cover"
                            onError={() => handleImageError(message._id)}
                        />
                    ) : (
                        <Text style={{ color: isMe ? '#ffffff' : '#333' }}>{message.text}</Text>
                    )}
                    <Text style={{ fontSize: 10, color: isMe ? '#e0e0e0' : '#888', marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>
                        {formatDate(message.timestamp)}
                    </Text>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#002855" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <FlatList
                data={messages}
                renderItem={renderItem}
                keyExtractor={(item, index) => item._id || index.toString()}
                ref={flatListRef}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 8, 
                    paddingBottom: keyboardVisible ? keyboardHeight + 20 : 80
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                ListEmptyComponent={
                    <View className="flex-1 justify-center items-center py-8">
                        <Text className="text-gray-500 font-medium">Chưa có tin nhắn nào</Text>
                    </View>
                }
            />

            {imagesToSend.length > 0 && (
                <View style={styles.imagePreviewContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
                        {imagesToSend.map((uri, idx) => (
                            <View key={idx} style={styles.imagePreviewItem}>
                                <Image source={{ uri }} style={styles.previewImage} />
                                <TouchableOpacity
                                    onPress={() => removeImage(idx)}
                                    style={styles.removeImageButton}
                                >
                                    <Ionicons name="close" size={16} color="#ffffff" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            <View style={[
                styles.inputContainer,
                {
                    position: 'absolute',
                    bottom: keyboardVisible ? keyboardHeight : 0,
                    left: 0,
                    right: 0,
                    paddingBottom: Platform.OS === 'ios' ? 2 : (keyboardVisible ? 2 : 0)
                }
            ]}>
                <TouchableOpacity
                    onPress={handleAttachmentOptions}
                    style={styles.iconButton}
                >
                    <Ionicons name="attach-outline" size={24} color="#002855" />
                </TouchableOpacity>

                <TextInput
                    style={styles.textInput}
                    placeholder="Nhập tin nhắn..."
                    value={newMessage}
                    onChangeText={setNewMessage}
                    multiline
                    maxLength={500}
                    onFocus={() => {
                        setTimeout(() => {
                            flatListRef.current?.scrollToEnd({ animated: true });
                        }, 100);
                    }}
                />

                <TouchableOpacity
                    onPress={handleSend}
                    disabled={sending || (!newMessage.trim() && imagesToSend.length === 0)}
                    style={[
                        styles.sendButton,
                        (!newMessage.trim() && imagesToSend.length === 0 || sending) && { opacity: 0.5 }
                    ]}
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
                    style={[
                        styles.modalOverlay,
                        { display: showImageOptions ? 'flex' : 'none' }
                    ]}
                />
            )}

            {Platform.OS === 'android' && showImageOptions && (
                <View
                    style={[
                        styles.optionsPanel,
                        { bottom: keyboardVisible ? keyboardHeight + 60 : 70 }
                    ]}
                >
                    <View style={styles.optionsPanelContent}>
                        <TouchableOpacity
                            style={styles.optionItem}
                            onPress={() => {
                                setShowImageOptions(false);
                                takePhoto();
                            }}
                        >
                            <Ionicons name="camera-outline" size={24} color="#002855" />
                            <Text style={styles.optionText}>Chụp ảnh mới</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.optionItem}
                            onPress={() => {
                                setShowImageOptions(false);
                                pickImage();
                            }}
                        >
                            <Ionicons name="images-outline" size={24} color="#002855" />
                            <Text style={styles.optionText}>Chọn từ thư viện</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.optionItem, { borderBottomWidth: 0 }]}
                            onPress={() => {
                                setShowImageOptions(false);
                                handlePickDocument();
                            }}
                        >
                            <Ionicons name="document-outline" size={24} color="#002855" />
                            <Text style={styles.optionText}>Chọn tệp</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#e1e1e1',
        padding: 8,
        paddingHorizontal: 12,
        backgroundColor: 'white',
        width: '100%',
        zIndex: 1,
    },
    iconButton: {
        padding: 8,
    },
    textInput: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginHorizontal: 8,
        fontSize: 16,
        maxHeight: 100,
    },
    sendButton: {
        padding: 8,
        borderRadius: 20,
    },
    imagePreviewContainer: {
        borderTopWidth: 1,
        borderTopColor: '#e1e1e1',
        backgroundColor: 'white',
        paddingVertical: 8,
    },
    imagePreviewItem: {
        position: 'relative',
        marginRight: 12,
    },
    previewImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
    },
    removeImageButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        padding: 4,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 2,
    },
    optionsPanel: {
        position: 'absolute',
        left: 10,
        right: 10,
        zIndex: 3,
        alignItems: 'center',
    },
    optionsPanelContent: {
        backgroundColor: 'white',
        width: '100%',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        overflow: 'hidden',
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    optionText: {
        marginLeft: 12,
        fontSize: 16,
        fontWeight: '500',
    }
});

export default TicketChat; 