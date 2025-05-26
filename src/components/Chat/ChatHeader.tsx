import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { User } from '../../navigation/AppNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChatDetailParams } from '../../types/chat';
import Avatar from './Avatar';

interface ChatHeaderProps {
    user: User;
    isUserOnline: (userId: string) => boolean;
    getFormattedLastSeen: (userId: string) => string;
    navigation: NativeStackNavigationProp<{ ChatDetail: ChatDetailParams }, 'ChatDetail'>;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
    user,
    isUserOnline,
    getFormattedLastSeen,
    navigation
}) => {
    return (
        <View className="flex-row items-center p-3 border-gray-200">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-2">
                <MaterialIcons name="arrow-back-ios" size={32} color="#009483" />
            </TouchableOpacity>
            <Avatar user={user} size={48} statusSize={14} />
            <View style={{ justifyContent: 'center' }}>
                <Text className="font-bold text-lg" style={{ marginBottom: 0 }}>{user.fullname}</Text>
                <Text style={{ fontSize: 12, color: '#444', fontFamily: 'Inter', fontWeight: 'medium' }}>
                    {isUserOnline(user._id) ? 'Đang hoạt động' : getFormattedLastSeen(user._id)}
                </Text>
            </View>
        </View>
    );
};

export default ChatHeader; 