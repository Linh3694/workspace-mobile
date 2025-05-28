import React, { memo, useMemo, useRef, useEffect } from 'react';
// @ts-ignore
import { View, Text, Image, TouchableOpacity, Animated, Pressable, Linking, StyleSheet, ImageSourcePropType } from 'react-native';
import { Message, Chat } from '../../types/message';
import { CustomEmoji } from '../../types/chat';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Entypo } from '@expo/vector-icons';
import { API_BASE_URL } from '../../config/constants';
import ImageGrid from './ImageGrid';
import MessageStatus from './MessageStatus';
import { processImageUrl } from '../../utils/image';
import { useOnlineStatus } from '../../context/OnlineStatusContext';
import Avatar from './Avatar';
import MessageContent from './MessageContent';

// Extend the Message type to specify the exact type of isForwarded
interface MessageWithForwarded extends Message {
    isForwarded: boolean;
}

type MessageBubbleProps = {
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
    chat: Chat | null;
    showTime?: boolean;
    prevMsg?: Message;
    onReplyPress?: (message: Message) => void;
    highlightedMessageId?: string | null;
};

// Component hiển thị thông tin chuyển tiếp
const ForwardedLabel = ({ message, isMe }: { message: Message, isMe: boolean }) => {
    return (
        <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            marginBottom: 4,
            paddingHorizontal: 2,
            opacity: 0.8
        }}>
            <MaterialCommunityIcons name="share" size={14} color={isMe ? '#f0f0f0' : '#757575'} />
            <Text style={{ 
                fontSize: 12, 
                color: isMe ? '#f0f0f0' : '#757575', 
                marginLeft: 4,
                fontFamily: 'Mulish-Italic'
            }}>
                Đã chuyển tiếp từ {message.originalSender?.fullname || 'người dùng khác'}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    bubble: {
        backgroundColor: 'transparent',
        alignSelf: 'flex-start' as const,
        maxWidth: '100%',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    }
});

const MessageBubble = memo(({
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
    chat,
    showTime = false,
    prevMsg,
    onReplyPress,
    highlightedMessageId
}: MessageBubbleProps) => {
    const isMe = currentUserId && message.sender._id === currentUserId;
    
    // Memoize emoji lookup
    const emoji = useMemo(() => 
        customEmojis.find(e => e.code === message.content), 
        [customEmojis, message.content]
    );
    
    const isCustomEmoji = !!emoji;
    const { isUserOnline, getFormattedLastSeen } = useOnlineStatus();

    // Tạo animation cho highlight effect
    const highlightAnim = useRef(new Animated.Value(0)).current;
    const isHighlighted = highlightedMessageId === message._id;

    // Effect để chạy animation khi highlight
    useEffect(() => {
        if (isHighlighted) {
            // Hiệu ứng pulse: fade in -> fade out -> fade in -> fade out
            Animated.sequence([
                Animated.timing(highlightAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: false,
                }),
                Animated.timing(highlightAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: false,
                }),
                Animated.timing(highlightAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: false,
                }),
                Animated.timing(highlightAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: false,
                })
            ]).start();
        }
    }, [isHighlighted, highlightAnim]);

    // Kiểm tra tin nhắn có hợp lệ không
    if (!message || !message.sender) {
        console.error('Invalid message:', message);
        return null;
    }

    // Tính toán style cho bubble
    const getBubbleStyle = () => {
        // Only treat actual images and multi-image messages as media content
        const isMediaContent = message.type === 'image' || message.type === 'multiple-images';

        const isAlone = isFirst && isLast;
        
        return {
            ...styles.bubble,
            backgroundColor: isMediaContent ? 'transparent' : (isMe ? '#009483' : '#F5F5ED'),
            paddingHorizontal: isMediaContent ? 0 : 14,
            paddingVertical: isMediaContent ? 0 : 8,
            borderTopLeftRadius: isMe ? 20 : (isLast ? 20 : 4),
            borderTopRightRadius: isMe ? (isLast ? 20 : 4) : 20,
            borderBottomRightRadius: isMe ? (isFirst ? 20 : 4) : 20,
            borderBottomLeftRadius: isMe ? 20 : (isFirst ? 20 : 4),
            minWidth: 48,
            minHeight: 36,
            alignSelf: isMe ? 'flex-end' : 'flex-start',
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
        };
    };

    // Xử lý hiển thị tin nhắn dựa trên loại
    const renderMessageContent = () => {
        // Nếu là tin nhắn bị thu hồi
        if ((message as any).isRevoked) {
            return (
                <View style={{
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    marginTop: 4,
                    borderWidth: 1,
                    borderColor: '#E5E5E5', // border-gray-100
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    backgroundColor: 'transparent',
                }}>
                    <Text style={{
                        color: '#757575',
                        fontStyle: 'italic',
                        fontSize: 18,
                        textAlign: isMe ? 'right' : 'left',
                        fontFamily: 'Mulish-Italic',
                        paddingHorizontal: 0,
                        paddingVertical: 0,
                    }}>
                       {isMe ? 'Tin nhắn đã bị thu hồi' :'Bạn đã xoá tin nhắn'}
                    </Text>
                </View>
            );
        }
        if (isCustomEmoji && emoji) {
            return (
                <View style={{
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    justifyContent: 'center',
                    width: '100%',
                    paddingVertical: 8,
                    paddingHorizontal: 0,
                }}>
                    <Image
                        source={typeof emoji.url === 'string' ? { uri: emoji.url } : emoji.url}
                        style={{ width: 80, height: 80 }}
                        resizeMode="contain"
                    />
                </View>
            );
        }
        // Chỉ loại bỏ bubble nếu là image mà không có fileUrl, hoặc multiple-images mà không có fileUrls
        if (
            (message.type === 'image' && !message.fileUrl) ||
            (message.type === 'multiple-images' && (!message.fileUrls || message.fileUrls.length === 0))
        ) {
            return null;
        }
        // Luôn render MessageContent cho các trường hợp còn lại
        return <MessageContent 
            message={message} 
            isMe={!!isMe} 
            customEmojis={customEmojis}
            onLongPress={(e) => onLongPressIn(message, e)}
            onLongPressOut={onLongPressOut}
            onImagePress={onImagePress}
        />;
    };

    // Xử lý trạng thái tin nhắn
    const renderMessageStatus = () => {
        if (!isMe || !isLatestMessage) return null;

        // Nếu chưa gửi hoặc đang gửi (không có _id)
        if (!message._id) {
            return (
                <>
                    <Text style={{
                        color: '#757575',
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular',
                        marginRight: 4
                    }}>
                        Đang gửi
                    </Text>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#757575" />
                </>
            );
        }

        // Lấy danh sách người tham gia trừ người gửi
        const otherParticipants = chat?.participants
            ?.filter(user => user._id !== currentUserId)
            ?.map(user => user._id) || [];

        // Đảm bảo readBy là một mảng
        const readByArray = Array.isArray(message.readBy) ? [...message.readBy] : [];

        // Lọc ra ID của người đã đọc, không tính người gửi
        const readByOthers = readByArray.filter(id =>
            id !== currentUserId && otherParticipants.includes(id)
        );

        // Kiểm tra xem tất cả người tham gia khác đã đọc chưa
        const allParticipantsRead = otherParticipants.length > 0 &&
            otherParticipants.every(participantId => readByArray.includes(participantId));

        // Nếu tất cả đã đọc hoặc có người đã đọc
        if (allParticipantsRead || readByOthers.length > 0) {
            return (
                <>
                    <Text style={{
                        color: '#009483',
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular',
                        marginRight: 4
                    }}>
                        Đã xem
                    </Text>
                    <MaterialCommunityIcons name="check-all" size={16} color="#009483" />
                </>
            );
        }

        // Kiểm tra xem tin nhắn đã được nhận chưa (delivered)
        const isDelivered = message._id && otherParticipants.length > 0;
        
        if (isDelivered) {
            return (
                <>
                    <Text style={{
                        color: '#757575',
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular',
                        marginRight: 4
                    }}>
                        Đã nhận
                    </Text>
                    <MaterialCommunityIcons name="check-all" size={16} color="#757575" />
                </>
            );
        }

        // Mặc định là đã gửi
        return (
            <>
                <Text style={{
                    color: '#757575',
                    fontSize: 12,
                    fontFamily: 'Mulish-Regular',
                    marginRight: 4
                }}>
                    Đã gửi
                </Text>
                <MaterialCommunityIcons name="check" size={16} color="#757575" />
            </>
        );
    };

    // Render footer cho tin nhắn
    const renderMessageFooter = () => {
        if (!showTime) return null;

        return (
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 4,
                marginRight: 4
            }}>
                <Text style={{
                    color: '#757575',
                    fontSize: 12,
                    fontFamily: 'Mulish-Regular',
                    marginRight: 4
                }}>
                    {formatMessageTime(message.createdAt)}
                </Text>
                {!isMe && (
                    <Text style={{
                        color: '#757575',
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular'
                    }}>
                        • {isUserOnline(message.sender._id) ? 'Đang hoạt động' : getFormattedLastSeen(message.sender._id)}
                    </Text>
                )}
                {isMe && (
                    <MessageStatus message={message} currentUserId={currentUserId} chat={chat} />
                )}
            </View>
        );
    };

    return (
        <View>
            <Pressable
                onPressIn={(e) => onLongPressIn(message, e)}
                onPressOut={onLongPressOut}
                delayLongPress={500}
            >

                <Animated.View
                    style={[
                        {
                            flexDirection: isMe ? 'row-reverse' : 'row',
                            alignItems: 'flex-end',
                            marginBottom: (message.reactions && message.reactions.length > 0) ? 12 : 2,
                            transform: [{ scale: messageScaleAnim }],
                            backgroundColor: highlightAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['transparent', 'rgba(0, 148, 131, 0.15)']
                            }),
                            borderRadius: isHighlighted ? 8 : 0,
                            paddingHorizontal: isHighlighted ? 4 : 0,
                            paddingVertical: isHighlighted ? 2 : 0,
                        }
                    ]}
                >
                    {showAvatar ? (
                        <View style={!isMe ? { marginLeft: 8 } : {}}>
                            <Avatar user={message.sender} size={40} statusSize={12} />
                        </View>
                    ) : (
                            <View style={{ width: isMe ? 8 : 36, marginLeft: 6, marginRight: 6 }} />
                    )}

                    {/* Nếu là emoji thì không render bubble, chỉ render emoji to */}
                    {isCustomEmoji ? (
                        <View style={{ flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '95%', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                            {renderMessageContent()}
                        </View>
                    ) : (
                        // Nếu là tin nhắn thu hồi thì KHÔNG render bubble ngoài
                        (message as any).isRevoked ? (
                                <View style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '95%' }}>
                                    {renderMessageContent()}
                                </View>
                        ) : (
                            // Container chứa cả reply và bubble tin nhắn
                            <View style={{
                                flexDirection: 'column',
                                paddingTop: 1,
                                paddingBottom: 1,
                                paddingLeft: isMe ? 0 : 8,
                                         paddingRight: isMe ? 8 : 0,
                                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                                        alignItems: isMe ? 'flex-end' : 'flex-start',
                            }}>
                                {/* Preview tin nhắn reply */}
                                {message.replyTo && (
                                    <View style={{
                                        marginBottom: -15,
                                        marginLeft: isMe ? 0 : 10,
                                        marginRight: isMe ? 10 : 0,
                                        backgroundColor: isMe ? '#F5F5ED' : '#98D3C6',
                                        borderRadius: 20,
                                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                                        paddingVertical: 10,
                                        paddingHorizontal: 10,
                                        elevation: 1,
                                        alignItems: isMe ? 'flex-end' : 'flex-start',
                                        minHeight: 40,
                                    }}>
                                        <TouchableOpacity
                                            onPress={() => onReplyPress?.(message.replyTo)}
                                            style={{
                                                flexDirection: 'column',
                                                alignItems: isMe ? 'flex-end' : 'flex-start',
                                                width: '100%'
                                            }}
                                        >
                                            
                                            {/* Hiển thị ảnh với kích thước đầy đủ */}
                                            {message.replyTo.type === 'image' && (
                                                <Image
                                                    source={{
                                                        uri: processImageUrl(message.replyTo.fileUrl)
                                                    }}
                                                    style={{
                                                        width: 200,
                                                        height: 200,
                                                        borderRadius: 12,
                                                        marginTop: 4
                                                    }}
                                                    resizeMode="cover"
                                                />
                                            )}
                                            
                                            {/* Hiển thị nhiều ảnh với ImageGrid */}
                                            {message.replyTo.type === 'multiple-images' && message.replyTo.fileUrls && (
                                                <View style={{ marginTop: 4 }}>
                                                    <ImageGrid 
                                                        images={message.replyTo.fileUrls} 
                                                        onPress={(index) => onImagePress && onImagePress(message.replyTo.fileUrls || [], index)}
                                                    />
                                                </View>
                                            )}

                                            {/* Hiển thị file */}
                                            {message.replyTo.type === 'file' && (
                                                <Text style={{
                                                    fontSize: 14,
                                                    color: isMe ? '#757575' : 'white',
                                                    textAlign: isMe ? 'right' : 'left',
                                                    fontFamily: 'Mulish-Regular',
                                                    marginTop: 4
                                                }}>
                                                    [Tệp đính kèm]
                                                </Text>
                                            )}
                                            
                                            {/* Hiển thị text */}
                                            {message.replyTo.type !== 'image' && message.replyTo.type !== 'multiple-images' && message.replyTo.type !== 'file' && (
                                                <Text 
                                                    style={{
                                                        fontSize: 14,
                                                        color: isMe ? '#757575' : 'white',
                                                        fontFamily: 'Mulish-Regular',
                                                        textAlign: isMe ? 'right' : 'left',
                                                        flexWrap: 'wrap',
                                                        flexShrink: 1,
                                                        marginTop: 4
                                                    }}
                                                    numberOfLines={3}
                                                    ellipsizeMode="tail"
                                                >
                                                    {message.replyTo.content}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {/* Forwarded header */}
                                {message.isForwarded === true && (
                                    <View style={{
                                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                                        marginBottom: 6,
                                    }}>
                                        <Text style={{
                                            fontSize: 14,
                                            color: '#BEBEBE',
                                            fontFamily: 'Mulish-Regular'
                                        }}>
                                            {isMe ? 'Bạn' : message.sender.fullname} đã chuyển tiếp tin nhắn từ
                                        </Text>
                                        {message.originalSender && (
                                            <Text style={{
                                                fontSize: 14,
                                                color: '#757575',
                                                fontFamily: 'Mulish-SemiBold',
                                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                                marginTop: 4
                                            }}>
                                                {message.originalSender.fullname}
                                            </Text>
                                        )}
                                    </View>
                                )}
                                {/* Bubble + vertical bar wrapper */}
                                {message.isForwarded === true ? (
                                    <View style={{
                                        flexDirection: isMe ? 'row-reverse' : 'row',
                                        alignItems: 'flex-start'
                                    }}>
                                        {/* bar */}
                                        <View style={{
                                            width: 4,
                                            backgroundColor: isMe ? '#009483' : '#E6E6E6',
                                            borderRadius: 2,
                                            alignSelf: 'stretch'
                                        }} />
                                        {/* gap */}
                                        <View style={{ width: 8 }} />
                                        {/* bubble */}
                                        <View style={getBubbleStyle()}>
                                            <View style={{ position: 'relative' }}>
                                                {/* Nội dung chính */}
                                                {renderMessageContent()}

                                                {/* Reactions */}
                                                {(message.reactions && message.reactions.length > 0) ? (
                                                    <View style={{
                                                        position: 'absolute',
                                                        bottom: 20,
                                                        right: (message.type === 'image' || message.type === 'multiple-images') ? 12 : 0,
                                                        flexDirection: 'row',
                                                        backgroundColor: 'white',
                                                        borderRadius: 12,
                                                        paddingHorizontal: 2,
                                                        paddingVertical: 1,
                                                        shadowColor: '#000',
                                                        shadowOffset: { width: 0, height: 1 },
                                                        shadowOpacity: 0.08,
                                                        shadowRadius: 2,
                                                        elevation: 2,
                                                    }}>
                                                        {message.reactions.map((reaction, idx) => {
                                                            if (!reaction.isCustom) {
                                                                return (
                                                                    <Text key={idx} style={{ fontSize: 16, marginRight: 2 }}>
                                                                        {reaction.emojiCode}
                                                                    </Text>
                                                                );
                                                            } else {
                                                                const emoji = customEmojis.find(e => e.code === reaction.emojiCode);
                                                                if (!emoji) return null;
                                                                return (
                                                                    <Image
                                                                        key={idx}
                                                                        source={typeof emoji.url === 'string' ? { uri: emoji.url } : emoji.url}
                                                                        style={{ width: 24, height: 24, marginRight: 4, marginTop: 12 }}
                                                                        resizeMode="contain"
                                                                    />
                                                                );
                                                            }
                                                        })}
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                    </View>
                                ) : (
                                    // Original bubble (non-forwarded)
                                    <View style={getBubbleStyle()}>
                                        <View style={{ position: 'relative' }}>
                                            {/* Nội dung chính */}
                                            {renderMessageContent()}
                                            {/* Reactions */}
                                            {(message.reactions && message.reactions.length > 0) ? (
                                                <View style={{
                                                    position: 'absolute',
                                                    bottom: -20,
                                                    right: (message.type === 'image' || message.type === 'multiple-images') ? 12 : 0,
                                                    flexDirection: 'row',
                                                    backgroundColor: 'white',
                                                    borderRadius: 12,
                                                    paddingHorizontal: 2,
                                                    paddingVertical: 1,
                                                    shadowColor: '#000',
                                                    shadowOffset: { width: 0, height: 1 },
                                                    shadowOpacity: 0.08,
                                                    shadowRadius: 2,
                                                    elevation: 2,
                                                }}>
                                                    {message.reactions.map((reaction, idx) => {
                                                        if (!reaction.isCustom) {
                                                            return (
                                                                <Text key={idx} style={{ fontSize: 16, marginRight: 2 }}>
                                                                    {reaction.emojiCode}
                                                                </Text>
                                                            );
                                                        } else {
                                                            const emoji = customEmojis.find(e => e.code === reaction.emojiCode);
                                                            if (!emoji) return null;
                                                            return (
                                                                <Image
                                                                    key={idx}
                                                                    source={typeof emoji.url === 'string' ? { uri: emoji.url } : emoji.url}
                                                                    style={{ width: 18, height: 18, }}
                                                                    resizeMode="contain"
                                                                />
                                                            );
                                                        }
                                                    })}
                                                </View>
                                            ) : null}
                                        </View>
                                    </View>
                                )}
                                {/* Trạng thái tin nhắn cuối cùng */}
                                {isMe && isLatestMessage && (
                                    <View style={{
                                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                        marginRight: 4,
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                    }}>
                                        {renderMessageStatus()}
                                    </View>
                                )}
                                {/* Footer với thời gian và trạng thái online */}
                                {renderMessageFooter()}
                            </View>
                        )
                    )}
                </Animated.View>
            </Pressable>
        </View>
    );
});

export default MessageBubble;