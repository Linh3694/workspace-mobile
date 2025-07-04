import React from 'react';
// @ts-ignore
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Message, Chat } from '../../types/message';

interface MessageStatusProps {
    message: Message;
    currentUserId: string | null;
    chat: Chat | null;
    iconColor?: string;
    showText?: boolean;
}

const MessageStatus: React.FC<MessageStatusProps> = ({
    message,
    currentUserId,
    chat,
    iconColor = '#757575',
    showText = false
}) => {
    // Debug logging
    console.log('🔍 [MessageStatus] Debug:', {
        currentUserId,
        messageSenderId: message.sender && typeof message.sender === 'object' ? message.sender._id : message.sender,
        messageId: message._id,
        isMyMessage: currentUserId && message.sender && typeof message.sender === 'object' && message.sender._id === currentUserId,
        chatParticipantsLength: chat?.participants?.length
    });

    // Chỉ hiển thị status cho tin nhắn của mình
    if (!currentUserId || !message.sender || typeof message.sender !== 'object' || message.sender._id !== currentUserId) {
        console.log('🔍 [MessageStatus] Not showing - not my message');
        return null;
    }

    // Nếu chưa gửi hoặc đang gửi (không có _id)
    if (!message._id) {
        console.log('🔍 [MessageStatus] Showing - sending status');
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
        console.log('🔍 [MessageStatus] No chat or participants, showing default sent status');
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
    const otherParticipants = chat.participants
        .filter(user => user._id !== currentUserId)
        .map(user => user._id);

    // Nếu không có người tham gia khác
    if (otherParticipants.length === 0) {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {showText && (
                    <Text style={{
                        color: iconColor,
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular',
                        marginRight: 12
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

    // Lọc ra ID của người đã đọc, không tính người gửi
    const readByOthers = readByArray.filter(id =>
        id !== currentUserId && otherParticipants.includes(id)
    );

    console.log('🔍 [MessageStatus] Read status:', {
        messageId: message._id,
        readByArray,
        otherParticipants,
        readByOthers,
        currentUserId
    });

    // Kiểm tra xem tất cả người tham gia khác đã đọc chưa
    const allParticipantsRead = otherParticipants.length > 0 &&
        otherParticipants.every(participantId => readByArray.includes(participantId));

    // Nếu tất cả đã đọc
    if (allParticipantsRead) {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {showText && (
                    <Text style={{
                        color: '#009483',
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular',
                        marginRight: 4
                    }}>
                        Đã xem
                    </Text>
                )}
                <MaterialCommunityIcons name="check-all" size={14} color="#009483" />
            </View>
        );
    }

    // Nếu có người đã đọc nhưng không phải tất cả
    if (readByOthers.length > 0) {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {showText && (
                    <Text style={{
                        color: '#009483',
                        fontSize: 12,
                        fontFamily: 'Mulish-Regular',
                        marginRight: 4
                    }}>
                        Đã xem
                    </Text>
                )}
                <MaterialCommunityIcons name="check-all" size={14} color="#009483" />
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

export default MessageStatus; 