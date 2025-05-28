import React from 'react';
// @ts-ignore
import { View, TextInput, TouchableOpacity, ScrollView, Image, Platform, Keyboard, Alert } from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { Message } from '../../types/message';
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
    setImagesToSend: React.Dispatch<React.SetStateAction<any[]>>;
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
    insets,
    setImagesToSend
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
                alignItems: 'flex-end',
                width: '100%',
                minHeight: 28,
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
                        marginRight: 10,
                        marginBottom:4 ,
                    }}
                    onPress={async () => {
                        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
                        if (cameraStatus !== 'granted') {
                            Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập camera để chụp ảnh.');
                            return;
                        }

                        const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            quality: 0.7,
                            allowsEditing: false,
                            exif: true,
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
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        minHeight: 40,
                        maxHeight: 120,
                        backgroundColor: 'transparent',
                        fontFamily: 'Mulish-Regular',
                        textAlignVertical: 'top',
                        lineHeight: 20,
                        marginBottom: 4
                    }}
                    multiline={true}
                    textAlignVertical="top"
                    scrollEnabled={true}
                    autoFocus={false}
                    onFocus={() => setShowEmojiPicker(false)}
                />

                {/* Container cho các nút bên phải */}
                <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'flex-end', // Căn các nút ở bottom
                    marginBottom: 10, // Thêm margin bottom để căn với text input
                }}>
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

                                    const result = await ImagePicker.launchImageLibraryAsync({
                                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                        allowsMultipleSelection: true,
                                        quality: 0.7,
                                        allowsEditing: false,
                                        exif: true,
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
                        <TouchableOpacity onPress={handleSend} style={{ marginLeft: 8 , marginRight : 8 }}>
                            <Ionicons name="send" size={24} color="#F05023" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
};

export default ChatInputBar; 