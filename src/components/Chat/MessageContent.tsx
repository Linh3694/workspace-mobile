// components/MessageContent.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ImageGrid from './ImageGrid';
import { Message } from '../../types/chat';
import { processImageUrl } from '../../utils/image';

interface MessageContentProps {
    message: Message;
    isPreview?: boolean;
    isMe?: boolean;
    customEmojis?: any[];
    onLongPress?: (event: any) => void;
    onLongPressOut?: () => void;
}

const MessageContent: React.FC<MessageContentProps> = ({ 
    message, 
    isPreview = false, 
    isMe = false, 
    customEmojis = [],
    onLongPress,
    onLongPressOut
}) => {
    if (message.isEmoji && typeof message.content === 'string') {
        const emoji = customEmojis.find(e => e.code === message.content || e.name === message.content);
        if (emoji) {
            return (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <Image
                        source={{ uri: emoji.url?.startsWith('http') ? emoji.url : `${require('../../config/constants').API_BASE_URL}${emoji.url}` }}
                        style={{ width: 48, height: 48, borderRadius: 8 }}
                        resizeMode="contain"
                    />
                </View>
            );
        }
    }
    switch (message.type) {
        case 'image':
            return isPreview ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="image-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#666', fontSize: 14 }}>
                        Hình ảnh
                    </Text>
                </View>
            ) : (
                <TouchableOpacity 
                    style={{ marginTop: 4 }}
                    onLongPress={onLongPress}
                    onPressOut={onLongPressOut}
                    delayLongPress={500}
                >
                    <Image
                        source={{ uri: processImageUrl(message.fileUrl) }}
                        style={{
                            width: 200,
                            height: 200,
                            borderRadius: 12
                        }}
                        resizeMode="cover"
                    />
                </TouchableOpacity>
            );
        case 'multiple-images':
            return isPreview ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="images-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#666', fontSize: 14 }}>
                        {message.fileUrls?.length || 0} hình ảnh
                    </Text>
                </View>
            ) : (
                <ImageGrid 
                    images={message.fileUrls || []} 
                    onPress={() => { }} 
                    onLongPress={onLongPress}
                    onPressOut={onLongPressOut}
                />
            );
        case 'file':
            return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="document-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                    <Text style={{ color: isPreview ? '#666' : (isMe ? '#fff' : '#757575'), fontSize: 14 }}>
                        Tệp đính kèm
                    </Text>
                </View>
            );
        default:
            return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                        style={{
                            color: isPreview ? '#666' : (isMe ? '#fff' : '#757575'),
                            fontFamily: 'Mulish-SemiBold',
                            fontSize: 16,
                            flexShrink: 1
                        }}
                        numberOfLines={isPreview ? 1 : undefined}
                    >
                        {message.content}
                    </Text>
                </View>
            );
    }
};

export default MessageContent;