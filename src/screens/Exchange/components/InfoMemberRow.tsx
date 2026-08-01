/**
 * Hàng thành viên trong màn Thông tin — layout khớp bản web:
 * avatar · tên + chip quan hệ · vai trò · SĐT · danh sách con (kèm chip "PH chính").
 * PH bấm được (mở popup thông tin) khi truyền onPress.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '../../../hooks/useLanguage';
import { memberInitials, type InfoMember } from '../exchangeInfoUtils';

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
  const { t } = useLanguage();
  const inner = (
    <>
      <Image
        source={{ uri: member.avatar }}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB' }}
      />
      <View className="ml-3 min-w-0 flex-1">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text className="shrink text-base font-semibold text-[#0A2240]" numberOfLines={1}>
            {member.name}
          </Text>
          {member.relationPill ? (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#F1F3F5' }}>
              <Text className="text-[11px] font-semibold text-[#6B7280]">{member.relationPill}</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-xs text-[#6B7280]" numberOfLines={1}>
          {member.role}
        </Text>
        {member.phone ? (
          <Text className="text-xs text-[#6B7280]" numberOfLines={1}>
            {member.phone}
          </Text>
        ) : null}
        {member.students.map((student, index) => (
          <View
            key={student.studentId || `${student.name}:${index}`}
            className="mt-1 flex-row items-center"
            style={{ gap: 6 }}>
            <View
              className="h-5 w-5 items-center justify-center rounded-full"
              style={{ backgroundColor: '#FEE2E2' }}>
              <Text className="text-[9px] font-bold text-[#EF4444]">{memberInitials(student.name)}</Text>
            </View>
            <Text className="shrink text-xs text-[#0A2240]" numberOfLines={1}>
              {student.name}
            </Text>
            {student.keyPerson ? (
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#DCFCE7' }}>
                <Text className="text-[10px] font-semibold text-[#15803D]">
                  {t('exchange.member_key_guardian')}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {member.pill ? (
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#FEE2E2' }}>
            <Text className="text-xs font-bold text-[#EF4444]">{member.pill}</Text>
          </View>
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
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
  // Nhiều dòng (SĐT + danh sách con) → canh trên cho avatar khỏi bị đẩy xuống giữa khối.
  const rowClass = `flex-row py-2 ${member.students.length ? 'items-start' : 'items-center'}`;
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} className={rowClass}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View className={rowClass}>{inner}</View>;
}
