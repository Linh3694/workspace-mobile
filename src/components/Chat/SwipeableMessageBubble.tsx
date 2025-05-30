import React, { memo, useRef } from 'react';
// @ts-ignore
import { View, Animated } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import MessageBubble from './MessageBubble';
import { Message, Chat } from '../../types/message';
import { CustomEmoji } from '../../types/chat';

interface SwipeableMessageBubbleProps {
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
    onReply: (message: Message) => void; // Callback khi trigger reply
}

const SWIPE_THRESHOLD = 50; // Ngưỡng để trigger reply
const REPLY_ICON_SIZE = 24;

const SwipeableMessageBubble = memo(({
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
    onReply
}: SwipeableMessageBubbleProps) => {
    const isMe = currentUserId && message.sender._id === currentUserId;
    
    // Animation values cho swipe effect
    const translateX = useRef(new Animated.Value(0)).current;
    const replyIconOpacity = useRef(new Animated.Value(0)).current;
    const replyIconScale = useRef(new Animated.Value(0.8)).current;

    // Handle reply action
    const handleReply = () => {
        onReply(message);
    };

    // Pan gesture cho swipe
    const panGesture = Gesture.Pan()
        .activeOffsetX([-10, 10]) // Chỉ activate khi swipe ngang ít nhất 10px
        .failOffsetY([-15, 15]) // Fail nếu swipe dọc quá 15px (ưu tiên scroll)
        .minDistance(10) // Khoảng cách tối thiểu để activate
        .maxPointers(1) // Chỉ cho phép 1 finger
        .onUpdate((event) => {
            const { translationX, translationY } = event;
            
            // Kiểm tra thêm: nếu swipe dọc nhiều hơn ngang thì không xử lý
            if (Math.abs(translationY) > Math.abs(translationX)) {
                return;
            }
            
            // Kiểm tra hướng swipe dựa trên isMe
            let validTranslation = 0;
            let iconOpacity = 0;
            let iconScale = 0.8;

            if (isMe) {
                // Tin nhắn của mình: slide sang trái (translationX âm)
                if (translationX < -10) { // Tăng threshold để tránh trigger nhầm
                    validTranslation = Math.max(translationX, -SWIPE_THRESHOLD * 1.5);
                    
                    // Tính toán opacity và scale cho icon
                    const progress = Math.min(Math.abs(validTranslation) / SWIPE_THRESHOLD, 1);
                    iconOpacity = progress;
                    iconScale = 0.8 + (progress * 0.4); // Scale từ 0.8 đến 1.2
                }
            } else {
                // Tin nhắn của người khác: slide sang phải (translationX dương)
                if (translationX > 10) { // Tăng threshold để tránh trigger nhầm
                    validTranslation = Math.min(translationX, SWIPE_THRESHOLD * 1.5);
                    
                    // Tính toán opacity và scale cho icon
                    const progress = Math.min(validTranslation / SWIPE_THRESHOLD, 1);
                    iconOpacity = progress;
                    iconScale = 0.8 + (progress * 0.4); // Scale từ 0.8 đến 1.2
                }
            }

            // Update animations
            translateX.setValue(validTranslation);
            replyIconOpacity.setValue(iconOpacity);
            replyIconScale.setValue(iconScale);
        })
        .onEnd((event) => {
            const { translationX, translationY } = event;
            
            // Kiểm tra thêm: nếu swipe dọc nhiều hơn ngang thì không trigger reply
            if (Math.abs(translationY) > Math.abs(translationX)) {
                // Reset về vị trí ban đầu
                Animated.parallel([
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: false,
                        tension: 100,
                        friction: 8,
                    }),
                    Animated.timing(replyIconOpacity, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: false,
                    }),
                    Animated.timing(replyIconScale, {
                        toValue: 0.8,
                        duration: 200,
                        useNativeDriver: false,
                    })
                ]).start();
                return;
            }
            
            let shouldTriggerReply = false;

            if (isMe) {
                // Tin nhắn của mình: check slide trái
                shouldTriggerReply = translationX < -SWIPE_THRESHOLD;
            } else {
                // Tin nhắn của người khác: check slide phải
                shouldTriggerReply = translationX > SWIPE_THRESHOLD;
            }

            if (shouldTriggerReply) {
                // Trigger reply và animation feedback
                runOnJS(handleReply)();
                
                // Animation feedback khi trigger reply
                Animated.sequence([
                    Animated.parallel([
                        Animated.timing(translateX, {
                            toValue: isMe ? -SWIPE_THRESHOLD * 0.8 : SWIPE_THRESHOLD * 0.8,
                            duration: 150,
                            useNativeDriver: false,
                        }),
                        Animated.timing(replyIconScale, {
                            toValue: 1.3,
                            duration: 150,
                            useNativeDriver: false,
                        })
                    ]),
                    Animated.parallel([
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: false,
                            tension: 100,
                            friction: 8,
                        }),
                        Animated.timing(replyIconOpacity, {
                            toValue: 0,
                            duration: 200,
                            useNativeDriver: false,
                        }),
                        Animated.timing(replyIconScale, {
                            toValue: 0.8,
                            duration: 200,
                            useNativeDriver: false,
                        })
                    ])
                ]).start();
            } else {
                // Không đạt threshold, về vị trí ban đầu
                Animated.parallel([
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: false,
                        tension: 100,
                        friction: 8,
                    }),
                    Animated.timing(replyIconOpacity, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: false,
                    }),
                    Animated.timing(replyIconScale, {
                        toValue: 0.8,
                        duration: 200,
                        useNativeDriver: false,
                    })
                ]).start();
            }
        })
        .runOnJS(true);

    return (
        <GestureDetector gesture={panGesture}>
            <View style={{ position: 'relative' }}>
                {/* Reply Icon Background - hiển thị khi swipe */}
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        [isMe ? 'right' : 'left']: 10,
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: replyIconOpacity,
                        transform: [{ scale: replyIconScale }],
                        zIndex: 1,
                    }}
                >
                    <View
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(0, 148, 131, 0.15)',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <MaterialIcons 
                            name="reply" 
                            size={REPLY_ICON_SIZE} 
                            color="#009483" 
                        />
                    </View>
                </Animated.View>

                {/* Message Bubble với swipe animation */}
                <Animated.View
                    style={{
                        transform: [{ translateX }],
                    }}
                >
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
                </Animated.View>
            </View>
        </GestureDetector>
    );
});

export default SwipeableMessageBubble; 