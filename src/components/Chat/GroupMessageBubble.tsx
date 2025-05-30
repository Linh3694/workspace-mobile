import React, { memo } from 'react';
// @ts-ignore
import { View, Text, Animated } from 'react-native';
import MessageBubble from './MessageBubble';
import { Message, Chat } from '../../types/message';
import { CustomEmoji } from '../../types/chat';

interface GroupMessageBubbleProps {
    chat: Chat | null;
    message: Message;
    currentUserId: string | null;
    customEmojis: CustomEmoji[];
    isFirst: boolean;
    isLast: boolean;
    showAvatar: boolean;
    onLongPressIn: (message: Message, event: any) => void;
    onLongPressOut: () => void;
    onImagePress: (images: string[], index: number) => void;
    messageScaleAnim: Animated.Value;
    formatMessageTime: (timestamp: string) => string;
    getAvatar: (user: any) => string;
    isLatestMessage: boolean;
    onReplyPress?: (message: Message) => void;
    highlightedMessageId?: string | null;
    showSenderName?: boolean; // Hiển thị tên người gửi
}

const GroupMessageBubble = memo(({
    chat,
    message,
    currentUserId,
    customEmojis,
    isFirst,
    isLast,
    showAvatar,
    onLongPressIn,
    onLongPressOut,
    onImagePress,
    messageScaleAnim,
    formatMessageTime,
    getAvatar,
    isLatestMessage,
    onReplyPress,
    highlightedMessageId,
    showSenderName = true
}: GroupMessageBubbleProps) => {
    const isMe = currentUserId && message.sender._id === currentUserId;
    const senderInfo = typeof message.sender === 'object' ? message.sender : null;

    return (
        <View style={{ marginVertical: 1 }}>
            {/* Hiển thị tên người gửi cho tin nhắn của người khác và là tin nhắn đầu tiên trong nhóm */}
            {!isMe && showSenderName && isLast && senderInfo && (
                <View style={{
                    marginLeft: showAvatar ? 50 : 50, // Căn chỉnh với bubble
                    marginBottom: 2,
                    marginTop: 10
                }}>
                    <Text style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: '#757575',
                        fontFamily: 'Mulish-SemiBold'
                    }}>
                        {senderInfo.fullname}
                    </Text>
                </View>
            )}
            
            {/* Message Bubble */}
            <MessageBubble
                chat={chat}
                message={message}
                currentUserId={currentUserId}
                customEmojis={customEmojis}
                isFirst={isFirst}
                isLast={isLast}
                showAvatar={showAvatar}
                onLongPressIn={onLongPressIn}
                onLongPressOut={onLongPressOut}
                onImagePress={onImagePress}
                messageScaleAnim={messageScaleAnim}
                formatMessageTime={formatMessageTime}
                getAvatar={getAvatar}
                isLatestMessage={isLatestMessage}
                onReplyPress={onReplyPress}
                highlightedMessageId={highlightedMessageId}
            />
        </View>
    );
});

export default GroupMessageBubble; 