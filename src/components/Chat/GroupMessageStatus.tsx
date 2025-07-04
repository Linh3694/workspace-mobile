import React from 'react';
// @ts-ignore
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Message, Chat, User } from '../../types/message';
import Avatar from './Avatar';

interface GroupMessageStatusProps {
    message: Message;
    currentUserId: string | null;
    chat: Chat | null;
    iconColor?: string;
    showText?: boolean;
}

const GroupMessageStatus: React.FC<GroupMessageStatusProps> = ({
    message,
    currentUserId,
    chat,
    iconColor = '#757575',
    showText = false
}) => {
    // Debug logging
    console.log('🔍 [GroupMessageStatus] Debug:', {
        currentUserId,
        messageSenderId: message.sender && typeof message.sender === 'object' ? message.sender._id : message.sender,
        messageId: message._id,
        isMyMessage: currentUserId && message.sender && typeof message.sender === 'object' && message.sender._id === currentUserId,
        chatParticipantsLength: chat?.participants?.length
    });

    // Chỉ hiển thị status cho tin nhắn của mình
    if (!currentUserId || !message.sender || typeof message.sender !== 'object' || message.sender._id !== currentUserId) {
        console.log('🔍 [GroupMessageStatus] Not showing - not my message');
        return null;
    }

    // Nếu chưa gửi hoặc đang gửi (không có _id)
    if (!message._id) {
        console.log('🔍 [GroupMessageStatus] Showing - sending status');
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {showText && (
                    <Text style={{
                        color: iconColor,
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular',
                        marginRight: 4
                    }}>
                        Đang gửi
                    </Text>
                )}
                <MaterialCommunityIcons name="clock-outline" size={12} color={iconColor} />
            </View>
        );
    }

    // Không có chat hoặc không có người tham gia
    if (!chat || !Array.isArray(chat.participants) || chat.participants.length === 0) {
        console.log('🔍 [GroupMessageStatus] No chat or participants, showing default sent status');
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {showText && (
                    <Text style={{
                        color: iconColor,
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular',
                        marginRight: 4
                    }}>
                        Đã gửi
                    </Text>
                )}
                <MaterialCommunityIcons name="check" size={14} color={iconColor} />
            </View>
        );
    }

    // Lấy danh sách người tham gia trừ người gửi
    const otherParticipants = chat.participants.filter(user => user._id !== currentUserId);

    // Nếu không có người tham gia khác
    if (otherParticipants.length === 0) {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {showText && (
                    <Text style={{
                        color: iconColor,
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular',
                        marginRight: 4
                    }}>
                        Đã gửi
                    </Text>
                )}
                <MaterialCommunityIcons name="check" size={14} color={iconColor} />
            </View>
        );
    }

    // Đảm bảo readBy là một mảng
    const readByArray = Array.isArray(message.readBy) ? [...message.readBy] : [];

    // Lọc ra những người đã đọc tin nhắn (không tính người gửi)
    const usersWhoRead = otherParticipants.filter(user => 
        readByArray.includes(user._id)
    );

    console.log('🔍 [GroupMessageStatus] Read status:', {
        messageId: message._id,
        readByArray,
        otherParticipants: otherParticipants.map(u => ({ id: u._id, name: u.fullname })),
        usersWhoRead: usersWhoRead.map(u => ({ id: u._id, name: u.fullname })),
        usersWhoReadLength: usersWhoRead.length,
        messageContent: message.content?.substring(0, 30),
        messageCreatedAt: message.createdAt
    });

    // Nếu có người đã đọc, hiển thị avatar của họ
    if (usersWhoRead.length > 0) {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {showText && (
                    <Text style={{
                        color: '#009483',
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular',
                        marginRight: 6
                    }}>
                        Đã xem
                    </Text>
                )}
                <View style={{ 
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginLeft: showText ? 0 : 4
                }}>
                    {usersWhoRead.slice(0, 3).map((user, index) => (
                        <View
                            key={user._id}
                            style={{
                                marginLeft: index > 0 ? -8 : 0,
                                borderWidth: 1,
                                borderColor: 'white',
                                borderRadius: 10,
                                zIndex: usersWhoRead.length - index,
                                marginTop: 2
                            }}
                        >
                            <Avatar
                                user={user}
                                size={20}
                                statusSize={0}
                            />
                        </View>
                    ))}
                    {usersWhoRead.length > 3 && (
                        <View style={{
                            marginLeft: -8,
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            backgroundColor: '#009483',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: 'white',
                            zIndex: 0
                        }}>
                            <Text style={{
                                color: 'white',
                                fontSize: 8,
                                fontFamily: 'Mulish-Bold'
                            }}>
                                +{usersWhoRead.length - 3}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        );
    }

    // Kiểm tra xem tin nhắn đã được nhận chưa (delivered)
    // Tin nhắn được coi là đã nhận nếu có _id (đã lưu vào DB) và có người tham gia khác
    const isDelivered = message._id && otherParticipants.length > 0;
    
    if (isDelivered) {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {showText && (
                    <Text style={{
                        color: iconColor,
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular',
                        marginRight: 4
                    }}>
                        Đã nhận
                    </Text>
                )}
                <MaterialCommunityIcons name="check-all" size={14} color={iconColor} />
            </View>
        );
    }

    // Mặc định là đã gửi
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {showText && (
                <Text style={{
                    color: iconColor,
                    fontSize: 12,
                    fontFamily: 'Mulish-Regular',
                    marginRight: 4
                }}>
                    Đã gửi
                </Text>
            )}
            <MaterialCommunityIcons name="check" size={14} color={iconColor} />
        </View>
    );
};

export default GroupMessageStatus; 