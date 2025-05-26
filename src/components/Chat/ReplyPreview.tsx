import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../../types/chat';
import { API_BASE_URL } from '../../config/constants';
import { processImageUrl } from '../../utils/image';
import MessageContent from './MessageContent';

interface ReplyPreviewProps {
    message: Message | null;
    onCancel: () => void;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({ message, onCancel }) => {
    if (!message) return null;

    const isImage = message.type === 'image';
    const isMultipleImages = message.type === 'multiple-images';
    const isFile = message.type === 'file';
    const imageUrl = isImage ? processImageUrl(message.fileUrl) :
        isMultipleImages && message.fileUrls && message.fileUrls.length > 0 ? processImageUrl(message.fileUrls[0]) : null;

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 10,
            paddingHorizontal: 16,
            marginBottom: -8,
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Thêm BlurView */}
            <BlurView
                intensity={8}
                tint="default"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                }}
            />

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
                        <Text style={{ color: '#666', fontSize: 14, fontFamily: 'Mulish-Regular' }} numberOfLines={1}>
                            Hình ảnh
                        </Text>
                    </View>
                )}
                {isMultipleImages && message.fileUrls && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="images-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#666', fontSize: 14, fontFamily: 'Mulish-Regular' }} numberOfLines={1}>
                            {message.fileUrls.length} hình ảnh
                        </Text>
                    </View>
                )}
                {isFile && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="document-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#666', fontSize: 14, fontFamily: 'Mulish-Regular' }} numberOfLines={1}>
                            Tệp đính kèm
                        </Text>
                    </View>
                )}
                {!isImage && !isMultipleImages && !isFile && (
                    <MessageContent message={message} isPreview={true} />
                )}
            </View>

            <TouchableOpacity onPress={onCancel} style={{ padding: 5 }}>
                <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
        </View>
    );
}; 