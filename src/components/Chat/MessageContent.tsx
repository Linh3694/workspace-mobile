// components/MessageContent.tsx
import React from 'react';
// @ts-ignore
import { View, Text, Image, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ImageGrid from './ImageGrid';
import { Message } from '../../types/message';
import { processImageUrl } from '../../utils/image';

interface MessageContentProps {
    message: Message;
    isPreview?: boolean;
    isMe?: boolean;
    customEmojis?: any[];
    onLongPress?: (event: any) => void;
    onLongPressOut?: () => void;
    onImagePress?: (images: string[], index: number) => void;
    textStyle?: any;
}

const MessageContent: React.FC<MessageContentProps> = ({ 
    message, 
    isPreview = false, 
    isMe = false, 
    customEmojis = [],
    onLongPress,
    onLongPressOut,
    onImagePress,
    textStyle
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
                    style={{ 
                        marginTop: 4
                    }}
                    onPress={() => onImagePress && onImagePress([processImageUrl(message.fileUrl)], 0)}
                    onLongPress={onLongPress}
                    onPressOut={onLongPressOut}
                    delayLongPress={200}
                >
                    <Image
                        source={{ uri: processImageUrl(message.fileUrl) }}
                        style={{
                            width: 180,
                            height: 180,
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
                <View>
                    <ImageGrid 
                        images={message.fileUrls || []} 
                        onPress={(index) => onImagePress && onImagePress(message.fileUrls || [], index)} 
                        onLongPress={(index, event) => onLongPress && onLongPress(event)}
                        onPressOut={onLongPressOut}
                    />
                </View>
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
                <Text
                    style={{
                        color: isPreview ? '#666' : (isMe ? '#fff' : '#757575'),
                        fontFamily: 'Mulish-SemiBold',
                        fontSize: 16,
                        lineHeight: 22,
                        textAlign: 'left',
                        alignSelf: 'flex-start',
                        maxWidth: '100%',
                        ...textStyle
                    }}
                    ellipsizeMode="tail"
                    allowFontScaling={false}
                    adjustsFontSizeToFit={false}
                    selectable={false}
                    
                >
                    {message.content}
                </Text>
            );
    }
};

export default MessageContent;