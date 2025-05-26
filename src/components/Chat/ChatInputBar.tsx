import React from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, Image, Platform, Keyboard, Alert } from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { Message } from '../../types/chat';
import { ReplyPreview } from './ReplyPreview';
import ImageGrid from './ImageGrid';

interface ChatInputBarProps {
    input: string;
    handleInputChange: (text: string) => void;
    imagesToSend: any[];
    removeImage: (idx: number) => void;
    handleSend: () => void;
    showEmojiPicker: boolean;
    setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>;
    handlePickFile: () => void;
    replyTo: Message | null;
    setReplyTo: (message: Message | null) => void;
    keyboardVisible: boolean;
    insets: { bottom: number };
}

const ChatInputBar: React.FC<ChatInputBarProps> = ({
    input,
    handleInputChange,
    imagesToSend,
    removeImage,
    handleSend,
    showEmojiPicker,
    setShowEmojiPicker,
    handlePickFile,
    replyTo,
    setReplyTo,
    keyboardVisible,
    insets
}) => {
    return (
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
                <BlurView
                    intensity={8}
                    tint="default"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: 32,
                        zIndex: 0,
                    }}
                />
            )}

            {/* Preview tin nhắn đang trả lời */}
            {replyTo && (
                <ReplyPreview message={replyTo} onCancel={() => setReplyTo(null)} />
            )}

            {/* Dòng preview ảnh (nếu có) */}
            {imagesToSend.length > 0 && (
                <ImageGrid
                    images={imagesToSend.map(img => img.uri)}
                    onPress={() => { }}
                    onLongPress={(index) => removeImage(index)}
                />
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
                            quality: 1,
                            allowsEditing: true,
                        });
                        if (!result.canceled && result.assets && result.assets.length > 0) {
                            // Giả sử có một hàm xử lý thêm ảnh
                            // Trong component cha, sẽ cần truyền hàm này vào
                            const addImage = (assets: any[]) => {
                                const newImagesToSend = [...imagesToSend, ...assets];
                                // Cần một cách để cập nhật state ở component cha
                                // Vì vậy chúng ta sẽ truyền một hàm callback
                            };
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
                                        quality: 1,
                                        allowsEditing: false,
                                    });
                                    if (!result.canceled && result.assets && result.assets.length > 0) {
                                        // Cũng cần một cách để cập nhật state ở component cha
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
    );
};

export default ChatInputBar; 