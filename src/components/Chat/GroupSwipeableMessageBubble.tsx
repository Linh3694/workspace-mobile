import React, { memo, useRef } from 'react';
// @ts-ignore
import { View, Animated } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import GroupMessageBubble from './GroupMessageBubble';
import { Message, Chat } from '../../types/message';
import { CustomEmoji } from '../../types/chat';

interface GroupSwipeableMessageBubbleProps {
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
    showSenderName?: boolean;
}

const SWIPE_THRESHOLD = 50;
const REPLY_ICON_SIZE = 24;

const GroupSwipeableMessageBubble = memo(({
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
    onReply,
    showSenderName = true
}: GroupSwipeableMessageBubbleProps) => {
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
        .activeOffsetX([-10, 10])
        .failOffsetY([-15, 15])
        .minDistance(10)
        .maxPointers(1)
        .onUpdate((event) => {
            const { translationX, translationY } = event;
            
            if (Math.abs(translationY) > Math.abs(translationX)) {
                return;
            }
            
            let validTranslation = 0;
            let iconOpacity = 0;
            let iconScale = 0.8;

            if (isMe) {
                if (translationX < -10) {
                    validTranslation = Math.max(translationX, -SWIPE_THRESHOLD * 1.5);
                    const progress = Math.min(Math.abs(validTranslation) / SWIPE_THRESHOLD, 1);
                    iconOpacity = progress;
                    iconScale = 0.8 + (progress * 0.4);
                }
            } else {
                if (translationX > 10) {
                    validTranslation = Math.min(translationX, SWIPE_THRESHOLD * 1.5);
                    const progress = Math.min(validTranslation / SWIPE_THRESHOLD, 1);
                    iconOpacity = progress;
                    iconScale = 0.8 + (progress * 0.4);
                }
            }

            translateX.setValue(validTranslation);
            replyIconOpacity.setValue(iconOpacity);
            replyIconScale.setValue(iconScale);
        })
        .onEnd((event) => {
            const { translationX, translationY } = event;
            
            if (Math.abs(translationY) > Math.abs(translationX)) {
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
                shouldTriggerReply = translationX < -SWIPE_THRESHOLD;
            } else {
                shouldTriggerReply = translationX > SWIPE_THRESHOLD;
            }

            if (shouldTriggerReply) {
                runOnJS(handleReply)();
                
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
                {/* Reply Icon Background */}
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

                {/* Group Message Bubble với swipe animation */}
                <Animated.View
                    style={{
                        transform: [{ translateX }],
                    }}
                >
                    <GroupMessageBubble
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
                        showSenderName={showSenderName}
                    />
                </Animated.View>
            </View>
        </GestureDetector>
    );
});

export default GroupSwipeableMessageBubble; 