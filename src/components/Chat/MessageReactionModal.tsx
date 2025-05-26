import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    Dimensions,
    Animated,
    Easing,
    TouchableWithoutFeedback,
    Image,
} from 'react-native';
import { Message } from '../../types/chat';
import ReplySvg from '../../assets/reply.svg';
import ForwardSvg from '../../assets/forward.svg';
import CopySvg from '../../assets/copy.svg';
import RevokeSvg from '../../assets/revoke.svg';
import PinSvg from '../../assets/pin.svg';
import PinOffSvg from '../../assets/pin-off.svg';
import MessageContent from './MessageContent';
import { useEmojis } from '../../hooks/useEmojis';

const { width, height } = Dimensions.get('window');

type MessageReactionModalProps = {
    visibleReactionBar: boolean;
    visibleActionBar: boolean;
    onCloseReactionBar: () => void;
    onCloseActionBar: () => void;
    position: { x: number, y: number } | null;
    onReactionSelect: (reaction: { code: string; isCustom: boolean }) => Promise<boolean>;
    onActionSelect: (action: string) => void;
    selectedMessage?: Message | null;
    onSuccess?: () => void;
    showPinOption?: boolean;
    isPinned?: boolean;
    currentUserId: string | null;
    onRequestRevoke?: (message: Message) => void;
};

const REACTION_CODES = ['clap', 'laugh', 'wow', 'cry', 'heart'];

const initializeActions = (isPinned: boolean, messageType: string) => {
    const actions = [
        { icon: 'forward', text: 'Chuyển tiếp', value: 'forward', Svg: ForwardSvg },
        { icon: 'reply', text: 'Trả lời', value: 'reply', Svg: ReplySvg },
    ];

    // Chỉ thêm nút copy cho tin nhắn text
    if (messageType === 'text') {
        actions.push({ icon: 'copy', text: 'Sao chép', value: 'copy', Svg: CopySvg });
    }

    // Thêm tùy chọn ghim hoặc bỏ ghim dựa vào trạng thái hiện tại
    if (isPinned) {
        actions.push({ icon: 'unpin', text: 'Bỏ ghim', value: 'unpin', Svg: PinOffSvg });
    } else {
        actions.push({ icon: 'pin', text: 'Ghim tin nhắn', value: 'pin', Svg: PinSvg });
    }

    // Thêm tùy chọn thu hồi (nếu cần)
    actions.push({ icon: 'revoke', text: 'Thu hồi', value: 'revoke', Svg: RevokeSvg });

    return actions;
};

const MessageReactionModal = ({
    visibleReactionBar,
    visibleActionBar,
    onCloseReactionBar,
    onCloseActionBar,
    position,
    onReactionSelect,
    onActionSelect,
    selectedMessage,
    onSuccess,
    showPinOption = false,
    isPinned = false,
    currentUserId,
    onRequestRevoke
}: MessageReactionModalProps) => {
    const [fadeAnim] = useState(new Animated.Value(0));
    const [scaleAnim] = useState(new Animated.Value(0.5));
    const { customEmojis, loading: isLoading } = useEmojis();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionBarHeight, setActionBarHeight] = useState(0);
    const [reactBarHeight, setReactBarHeight] = useState(0);

    useEffect(() => {
        if (visibleReactionBar || visibleActionBar) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 200,
                    easing: Easing.out(Easing.back(1.5)),
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.5,
                    duration: 150,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [visibleReactionBar, visibleActionBar]);

    // Reaction bar shows all loaded custom emojis
    const reactionEmojis = customEmojis;

    // Danh sách actions (sử dụng hàm khởi tạo mới với messageType)
    const actions = initializeActions(isPinned, selectedMessage?.type || 'text');

    // Xác định vị trí của modal
    const modalPosition = position ? {
        top: position.y - 150, // Hiện phía trên vị trí nhấn
        left: Math.max(10, Math.min(position.x - 100, width - 210)) // Giữa màn hình có thể
    } : { top: height / 2 - 100, left: width / 2 - 100 };

    // Xử lý khi chọn emoji
    const handleReactionSelect = async (reaction: { code: string, isCustom: boolean }) => {
        setLoading(true);
        try {
            const success = await onReactionSelect(reaction);
            if (success) {
                onSuccess?.();
                onCloseReactionBar();
            }
        } catch (error) {
            console.error('Error adding reaction:', error);
        } finally {
            setLoading(false);
        }
    };

    // Tính toán kích thước của các components
    const onReactBarLayout = (event: any) => {
        setReactBarHeight(event.nativeEvent.layout.height);
        setLoading(false);
    };

    const onActionBarLayout = (event: any) => {
        setActionBarHeight(event.nativeEvent.layout.height);
        setLoading(false);
    };

    if ((!visibleReactionBar && !visibleActionBar) || !position) return null;

    return (
        <Modal
            transparent
            visible={visibleReactionBar || visibleActionBar}
            animationType="none"
            onRequestClose={() => {
                onCloseReactionBar();
                onCloseActionBar();
            }}
        >
            <TouchableWithoutFeedback onPress={() => {
                onCloseReactionBar();
                onCloseActionBar();
            }}>
                <View className={`flex-1 bg-black/50 justify-center ${selectedMessage && currentUserId && selectedMessage.sender._id === currentUserId ? 'items-end pr-[3%]' : 'items-start pl-[3%]'}`}>
                    {/* Selected Message Preview */}
                    {selectedMessage && (
                        <View className={`bg-white p-3 rounded-xl max-w-[80%] mb-3 `}>
                            <Text className="text-sm font-bold text-[#00687F] mb-1">{selectedMessage.sender.fullname}</Text>
                            {selectedMessage.isEmoji ? (() => {
                                // Debug log
                                console.log('selectedMessage.content:', selectedMessage.content);
                                console.log('customEmojis:', customEmojis);
                                const emoji = customEmojis.find(
                                    e =>
                                        e.code === selectedMessage.content ||
                                        e.name === selectedMessage.content ||
                                        (e.code && e.code.replace(/:/g, '') === selectedMessage.content) ||
                                        (e.name && e.name.replace(/:/g, '') === selectedMessage.content)
                                );
                                return emoji ? (
                                    <Image
                                        source={typeof emoji.url === 'string' ? { uri: emoji.url } : emoji.url}
                                        style={{ width: 80, height: 80 }}
                                        resizeMode="contain"
                                    />
                                ) : (
                                    <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ fontSize: 32 }}>{selectedMessage.content}</Text>
                                    </View>
                                );
                            })() : (
                                <MessageContent message={selectedMessage} isPreview={true} />
                            )}
                        </View>
                    )}

                    {/* Reaction Bar */}
                    {visibleReactionBar && (
                        <Animated.View
                            className="bg-white rounded-full mb-2 shadow-lg"
                            style={{
                                opacity: fadeAnim,
                                transform: [{ scale: scaleAnim }],
                            }}
                        >
                            <View className="flex-row justify-around items-center px-2">
                                {isLoading ? (
                                    <Text>Đang tải...</Text>
                                ) : reactionEmojis.length > 0 ? (
                                    reactionEmojis.map((emoji, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            activeOpacity={0.7}
                                            onPress={async () => {
                                                const success = await onReactionSelect({ code: emoji.code, isCustom: true });
                                                if (success) {
                                                    onSuccess?.();
                                                    onCloseReactionBar();
                                                }
                                            }}
                                            onPressIn={() => setHoveredIndex(index)}
                                            onPressOut={() => setHoveredIndex(null)}
                                            className="p-2"
                                            style={{
                                                transform: [
                                                    { scale: hoveredIndex === index ? 1.3 : 1 }
                                                ],
                                            }}
                                        >
                                            <Image
                                                source={emoji.url}
                                                className="w-12 h-12"
                                                resizeMode="contain"
                                            />
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text>Không tìm thấy emoji nào</Text>
                                )}
                            </View>
                        </Animated.View>
                    )}

                    {/* Action Bar */}
                    {visibleActionBar && (
                        <Animated.View
                            className="bg-white rounded-2xl w-[65%] shadow-lg"
                            style={{
                                opacity: fadeAnim,
                                transform: [{ scale: scaleAnim }],
                            }}
                        >
                            <View className="py-4 px-2">
                                {/* Chia 2 hàng, mỗi hàng 3 action */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                                    {[0, 1, 2].map(idx => {
                                        const action = actions[idx];
                                        if (!action) return <View key={idx} style={{ flex: 1 }} />;
                                        const SvgIcon = action.Svg;
                                        return (
                                            <TouchableOpacity
                                                key={idx}
                                                style={{ flex: 1, alignItems: 'center' }}
                                                onPress={() => {
                                                    onActionSelect(action.value);
                                                    onCloseActionBar();
                                                }}
                                            >
                                                <SvgIcon width={32} height={32} />
                                                <Text style={{ marginTop: 8, fontSize: 14, color: '#212121', fontFamily: 'Mulish-Regular', textAlign: 'center' }}>{action.text}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    {[3, 4, 5].map(idx => {
                                        const action = actions[idx];
                                        if (!action) return <View key={idx} style={{ flex: 1 }} />;
                                        const SvgIcon = action.Svg;
                                        if (action.value === 'revoke' && onRequestRevoke && selectedMessage) {
                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={{ flex: 1, alignItems: 'center' }}
                                                    onPress={() => {
                                                        onRequestRevoke(selectedMessage);
                                                        onCloseActionBar();
                                                    }}
                                                >
                                                    <SvgIcon width={32} height={32} />
                                                    <Text style={{ marginTop: 8, fontSize: 14, color: '#212121', fontFamily: 'Mulish-Regular', textAlign: 'center' }}>{action.text}</Text>
                                                </TouchableOpacity>
                                            );
                                        }
                                        return (
                                            <TouchableOpacity
                                                key={idx}
                                                style={{ flex: 1, alignItems: 'center' }}
                                                onPress={() => {
                                                    onActionSelect(action.value);
                                                    onCloseActionBar();
                                                }}
                                            >
                                                <SvgIcon width={32} height={32} />
                                                <Text style={{ marginTop: 8, fontSize: 14, color: '#212121', fontFamily: 'Mulish-Regular', textAlign: 'center' }}>{action.text}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        </Animated.View>
                    )}
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

export default MessageReactionModal; 