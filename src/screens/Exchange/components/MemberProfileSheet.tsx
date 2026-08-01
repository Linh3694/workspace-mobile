/**
 * Bottom sheet thông tin phụ huynh — bản mobile của `ChatMemberProfilePopover` bên web:
 * SĐT (bấm để gọi) · email (bấm để soạn mail) · các con kèm vai trò ở TỪNG con,
 * CTA duy nhất là "Nhắn tin".
 *
 * "PH chính" đọc theo từng liên kết HS↔PH (một người có thể là PH chính của HS này và
 * PH phụ của HS khác) — không phải thuộc tính của con người.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import BottomSheetModal from '../../../components/Common/BottomSheetModal';
import { SheetHeader } from '../../../components/Common/SheetHeader';
import { useLanguage } from '../../../hooks/useLanguage';
import { memberInitials, type InfoMember } from '../exchangeInfoUtils';

type CopyField = 'phone' | 'email';

/** Số để bấm gọi — giữ dấu + đầu chuỗi, bỏ mọi ký tự trình bày còn lại. */
function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned.startsWith('+') ? `+${cleaned.slice(1).replace(/\+/g, '')}` : cleaned}`;
}

function InfoField({
  icon,
  label,
  value,
  emptyLabel,
  onPressValue,
  onCopy,
  copied,
  copyLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  emptyLabel: string;
  onPressValue?: () => void;
  onCopy?: () => void;
  copied: boolean;
  copyLabel: string;
}) {
  return (
    <View className="flex-row items-center px-4 py-3" style={{ gap: 12 }}>
      <View
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: '#F1F3F5' }}>
        <Ionicons name={icon} size={16} color="#6B7280" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
          {label}
        </Text>
        {value ? (
          <Text
            onPress={onPressValue}
            className={`text-base ${onPressValue ? 'text-[#0A9488]' : 'text-[#0A2240]'}`}
            numberOfLines={1}>
            {value}
          </Text>
        ) : (
          <Text className="text-base text-[#9CA3AF]">{emptyLabel}</Text>
        )}
      </View>
      {value && onCopy ? (
        <Pressable onPress={onCopy} hitSlop={8} accessibilityLabel={copyLabel}>
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={18}
            color={copied ? '#15803D' : '#9CA3AF'}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export function MemberProfileSheet({
  member,
  visible,
  onClose,
  studentMeta,
  onMessage,
}: {
  member: InfoMember | null;
  visible: boolean;
  onClose: () => void;
  /** Dòng phụ dưới tên HS — lớp của hội thoại; bỏ trống thì ẩn hẳn. */
  studentMeta?: string;
  /** Có hàm này → hiện CTA "Nhắn tin" (ẩn khi người xem không được mở chat 1-1). */
  onMessage?: () => void;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState<CopyField | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  // Đóng sheet → xoá trạng thái "đã sao chép" để lần mở sau không còn dấu tick cũ.
  useEffect(() => {
    if (!visible) setCopied(null);
  }, [visible]);

  const handleCopy = useCallback(async (field: CopyField, value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setCopied(field);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1600);
    } catch (error) {
      console.warn('[MemberProfileSheet] copy error:', error);
    }
  }, []);

  if (!member) return null;

  const notUpdated = t('exchange.member_profile_not_updated');
  const copyLabel = t('exchange.member_profile_copy');

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={80}>
      <SheetHeader
        title={member.name}
        closeLabel={t('common.close')}
        onClose={onClose}
        leading={
          <Image
            source={{ uri: member.avatar }}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#E5E7EB' }}
          />
        }>
        <View className="mt-1 flex-row items-center" style={{ gap: 6 }}>
          {member.relationPill ? (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#F1F3F5' }}>
              <Text className="text-[11px] font-semibold text-[#6B7280]">{member.relationPill}</Text>
            </View>
          ) : null}
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#FEE2E2' }}>
            <Text className="text-[11px] font-semibold text-[#EF4444]">{member.role}</Text>
          </View>
        </View>
      </SheetHeader>

      <ScrollView>
        <InfoField
          icon="call-outline"
          label={t('exchange.member_profile_phone')}
          value={member.phone}
          emptyLabel={notUpdated}
          onPressValue={member.phone ? () => void Linking.openURL(telHref(member.phone!)) : undefined}
          onCopy={member.phone ? () => void handleCopy('phone', member.phone!) : undefined}
          copied={copied === 'phone'}
          copyLabel={copyLabel}
        />
        <InfoField
          icon="mail-outline"
          label={t('exchange.member_profile_email')}
          value={member.email}
          emptyLabel={notUpdated}
          onPressValue={member.email ? () => void Linking.openURL(`mailto:${member.email}`) : undefined}
          onCopy={member.email ? () => void handleCopy('email', member.email!) : undefined}
          copied={copied === 'email'}
          copyLabel={copyLabel}
        />

        <View className="px-4 pb-2 pt-3">
          <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            {t('exchange.member_profile_students')}
          </Text>
          {member.students.length === 0 ? (
            <Text className="py-2 text-sm text-[#9CA3AF]">
              {t('exchange.member_profile_no_students')}
            </Text>
          ) : (
            member.students.map((student, index) => (
              <View
                key={student.studentId || `${student.name}:${index}`}
                className="mb-2 flex-row items-center rounded-2xl px-3 py-2"
                style={{ backgroundColor: '#F8F9FA', gap: 10 }}>
                <View
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: '#FEE2E2' }}>
                  <Text className="text-[11px] font-bold text-[#EF4444]">
                    {memberInitials(student.name)}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-[#0A2240]" numberOfLines={1}>
                    {student.name}
                  </Text>
                  {studentMeta ? (
                    <Text className="text-xs text-[#9CA3AF]" numberOfLines={1}>
                      {studentMeta}
                    </Text>
                  ) : null}
                </View>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: student.keyPerson ? '#DCFCE7' : '#F1F3F5' }}>
                  <Text
                    className="text-[10px] font-semibold"
                    style={{ color: student.keyPerson ? '#15803D' : '#6B7280' }}>
                    {student.keyPerson
                      ? t('exchange.member_key_guardian')
                      : t('exchange.member_secondary_guardian')}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {onMessage ? (
          <View className="px-4 pb-2 pt-2">
            <Pressable
              onPress={onMessage}
              className="flex-row items-center justify-center rounded-2xl py-3"
              style={{ backgroundColor: '#0A2240', gap: 8 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
              <Text className="text-base font-semibold text-white">
                {t('exchange.member_profile_message')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </BottomSheetModal>
  );
}

export default MemberProfileSheet;
