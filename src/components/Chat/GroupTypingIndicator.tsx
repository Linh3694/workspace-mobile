import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { View, Text, Animated, Image } from 'react-native';
import { getAvatar } from '../../utils/avatar';

interface TypingUser {
    _id: string;
    fullname: string;
    avatarUrl?: string;
}

interface GroupTypingIndicatorProps {
    typingUsers: TypingUser[];
}

const GroupTypingIndicator: React.FC<GroupTypingIndicatorProps> = ({ 
    typingUsers
}) => {
    const [dots, setDots] = useState('.');
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Debug log
    useEffect(() => {
        console.log('⌨️ [GroupTypingIndicator] Typing users updated:', typingUsers);
    }, [typingUsers]);

    useEffect(() => {
        if (typingUsers.length > 0) {
            console.log('⌨️ [GroupTypingIndicator] Showing typing indicator for:', typingUsers.map(u => u.fullname));
            
            // Dots animation
            const interval = setInterval(() => {
                setDots(prev => {
                    if (prev === '...') return '.';
                    if (prev === '..') return '...';
                    if (prev === '.') return '..';
                    return '.';
                });
            }, 500);

            // Scale animation
            const scaleAnimation = Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, {
                        toValue: 1.1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            );
            scaleAnimation.start();

            return () => {
                clearInterval(interval);
                scaleAnimation.stop();
            };
        }
    }, [typingUsers.length, scaleAnim]);

    if (typingUsers.length === 0) {
        return null;
    }

    const getTypingText = () => {
        console.log('🔍 [GroupTypingIndicator] getTypingText called with:', {
            length: typingUsers.length,
            users: typingUsers.map(u => ({ id: u._id, name: u.fullname }))
        });
        
        if (typingUsers.length === 1) {
            const result = `${typingUsers[0].fullname} đang soạn tin...`;
            console.log('🔍 [GroupTypingIndicator] Single user result:', result);
            return result;
        } else if (typingUsers.length === 2) {
            const result = `2 người khác đang soạn tin...`;
            console.log('🔍 [GroupTypingIndicator] Two users result:', result);
            return result;
        } else {
            const result = `${typingUsers[0].fullname} và ${typingUsers.length - 1} người khác đang soạn tin...`;
            console.log('🔍 [GroupTypingIndicator] Multiple users result:', result);
            return result;
        }
    };

    return (
        <View 
            className="flex-row justify-start items-end mx-2 mt-4 mb-1"
        >
            {/* Avatar hiển thị người đang typing */}
            <View className="relative mr-1.5">
                {(() => {
                    const user = typingUsers[0];
                    const avatarUrl = getAvatar(user);
                    console.log('🖼️ [GroupTypingIndicator] Avatar debug:', {
                        user,
                        avatarUrl,
                        fullname: user?.fullname,
                        avatarUrl_prop: user?.avatarUrl
                    });
                    return (
                        <Image
                            source={{ uri: avatarUrl }}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: '#F3F4F6'
                            }}
                            onError={(error) => {
                                console.error('🖼️ [GroupTypingIndicator] Avatar load error:', error.nativeEvent.error);
                            }}
                            onLoad={() => {
                                console.log('🖼️ [GroupTypingIndicator] Avatar loaded successfully:', avatarUrl);
                            }}
                        />
                    );
                })()}
            </View>
            
            <View className="bg-[#F5F5ED] rounded-2xl py-2 px-4 flex-row items-center">
                <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    paddingHorizontal: 8,
                    paddingVertical: 4
                }}>
                    <Animated.View style={{
                        transform: [{ scale: scaleAnim }],
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}>
                        <View style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#4A4A4A',
                            marginRight: 4,
                            opacity: dots.length >= 1 ? 1 : 0.3
                        }} />
                        <View style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#4A4A4A',
                            marginRight: 4,
                            opacity: dots.length >= 2 ? 1 : 0.3
                        }} />
                        <View style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#4A4A4A',
                            marginRight: 8,
                            opacity: dots.length >= 3 ? 1 : 0.3
                        }} />
                    </Animated.View>
                    <Text style={{ 
                        color: '#4A4A4A', 
                        fontSize: 12, 
                        fontStyle: 'italic',
                        fontFamily: 'Mulish-Italic'
                    }}>
                        {getTypingText()}
                    </Text>
                </View>
            </View>
        </View>
    );
};

export default GroupTypingIndicator; 