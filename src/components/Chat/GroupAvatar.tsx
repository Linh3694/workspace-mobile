import React from 'react';
// @ts-ignore
import { View, Text, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { User } from '../../types/message';
import { getAvatar } from '../../utils/avatar';

interface GroupAvatarProps {
  size: number;
  groupAvatar?: string;
  participants: User[];
  currentUserId?: string;
  style?: any;
}

const GroupAvatar: React.FC<GroupAvatarProps> = ({
  size,
  groupAvatar,
  participants,
  currentUserId,
  style
}) => {
  // Nếu có group avatar, hiển thị nó
  if (groupAvatar) {
    return (
      <View className="relative overflow-hidden" style={[{ width: size, height: size }, style]}>
        <Image
          source={{ uri: groupAvatar }}
          className="rounded-full"
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Lọc bỏ current user và lấy tối đa 4 thành viên đầu tiên
  const displayUsers = participants
    .slice(0, 4);

  // Nếu không có thành viên nào để hiển thị, hiển thị icon mặc định
  if (displayUsers.length === 0) {
    return (
      <View 
        className="relative overflow-hidden items-center justify-center bg-blue-100"
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      >
        <MaterialIcons name="group" size={size * 0.5} color="#007AFF" />
      </View>
    );
  }

  // Tính toán layout dựa trên số lượng thành viên
  const renderUserAvatars = () => {
    const totalMembers = participants.length;
    const remainingCount = totalMembers - displayUsers.length;
    const avatarSize = size * 0.58; // Kích thước avatar nhỏ hơn một chút

    if (displayUsers.length === 1) {
      // 1 thành viên: 1 ảnh lớn
      return (
        <UserAvatar user={displayUsers[0]} size={size} />
      );
    }

    if (displayUsers.length === 2) {
      // 2 thành viên: sắp xếp ngang với overlap, avatar phải thấp hơn
      return (
        <View className="flex-row items-start justify-center mt-1">
          <UserAvatar user={displayUsers[0]} size={avatarSize} />
          <View style={{ marginLeft: -avatarSize * 0.3, marginTop: avatarSize * 0.5 }}>
            <UserAvatar user={displayUsers[1]} size={avatarSize} />
          </View>
        </View>
      );
    }

    if (displayUsers.length === 3) {
      // 3 thành viên: 1 ảnh trên, 2 ảnh dưới (hình tam giác)
      return (
        <View className="items-center">
          {/* Avatar trên */}
          <UserAvatar user={displayUsers[0]} size={avatarSize} />
          {/* 2 Avatar dưới */}
          <View className="flex-row" style={{ marginTop: -avatarSize * 0.2 }}>
            <UserAvatar user={displayUsers[1]} size={avatarSize} />
            <View style={{ marginLeft: -avatarSize * 0.3 }}>
              <UserAvatar user={displayUsers[2]} size={avatarSize} />
            </View>
          </View>
        </View>
      );
    }

    // 4+ thành viên: layout 2x2 (2 trên 2 dưới)
    return (
      <View className="items-center">
        {/* Hàng trên: 2 avatar */}
        <View className="flex-row">
          <UserAvatar user={displayUsers[0]} size={avatarSize} />
          <View style={{ marginLeft: -avatarSize * 0.3 }}>
            <UserAvatar user={displayUsers[1]} size={avatarSize} />
          </View>
        </View>
        {/* Hàng dưới: 2 avatar */}
        <View className="flex-row" style={{ marginTop: -avatarSize * 0.2 }}>
          <UserAvatar user={displayUsers[2]} size={avatarSize} />
          {remainingCount > 0 ? (
            <View 
              className="bg-gray-600 items-center justify-center border-2 border-white rounded-full"
              style={{ 
                width: avatarSize, 
                height: avatarSize, 
                marginLeft: -avatarSize * 0.3,
                zIndex: 10
              }}
            >
              <Text 
                className="text-white font-semibold"
                style={{ fontSize: avatarSize * 0.25 }}
              >
                +{remainingCount}
              </Text>
            </View>
          ) : (
            displayUsers[3] && (
              <View style={{ marginLeft: -avatarSize * 0.3 }}>
                <UserAvatar user={displayUsers[3]} size={avatarSize} />
              </View>
            )
          )}
        </View>
      </View>
    );
  };

  return (
    <View className="relative overflow-hidden" style={[{ height: size }, style]}>
      {renderUserAvatars()}
    </View>
  );
};

interface UserAvatarProps {
  user: User;
  size: number;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ user, size }) => {
  return (
    <Image
      source={{ uri: getAvatar(user) }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
      }}
      resizeMode="cover"
    />
  );
};

export default GroupAvatar; 