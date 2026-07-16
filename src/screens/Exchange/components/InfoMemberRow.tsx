/** Hàng thành viên trong màn Thông tin — PH bấm được (mở 1-1) khi truyền onPress. */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

import type { InfoMember } from '../exchangeInfoUtils';

export function InfoMemberRow({
  member,
  onPress,
  onRemove,
}: {
  member: InfoMember;
  onPress?: () => void;
  /** GVCN gỡ GV bộ môn — hiện nút thùng rác khi có. */
  onRemove?: () => void;
}) {
  const inner = (
    <>
      <Image
        source={{ uri: member.avatar }}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB' }}
      />
      <View className="ml-3 min-w-0 flex-1">
        <Text className="text-base font-semibold text-[#0A2240]" numberOfLines={1}>
          {member.name}
        </Text>
        <Text className="text-xs text-[#6B7280]" numberOfLines={1}>
          {member.role}
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {member.pill ? (
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#FEE2E2' }}>
            <Text className="text-xs font-bold text-[#EF4444]">{member.pill}</Text>
          </View>
        ) : onPress ? (
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#0A9488" />
        ) : null}
        {onRemove ? (
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="p-1">
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} className="flex-row items-center py-2">
        {inner}
      </TouchableOpacity>
    );
  }
  return <View className="flex-row items-center py-2">{inner}</View>;
}
