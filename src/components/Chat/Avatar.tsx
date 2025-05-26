// components/Avatar.tsx
import React from 'react';
import { View, Image } from 'react-native';
import { getAvatar } from '../../utils/avatar';
import { useOnlineStatus } from '../../context/OnlineStatusContext';

interface AvatarProps {
    user: { _id: string; fullname: string; avatarUrl?: string };
    size?: number;
    statusSize?: number;
}

const Avatar: React.FC<AvatarProps> = ({ user, size = 48, statusSize = 14 }) => {
    const { isUserOnline } = useOnlineStatus();
    return (
        <View style={{ position: 'relative' }}>
            <Image
                source={{ uri: getAvatar(user) }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
            />
            <View
                style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: statusSize,
                    height: statusSize,
                    borderRadius: statusSize / 2,
                    backgroundColor: isUserOnline(user._id) ? 'green' : '#bbb',
                    borderWidth: 2,
                    borderColor: 'white',
                }}
            />
        </View>
    );
};

export default Avatar;