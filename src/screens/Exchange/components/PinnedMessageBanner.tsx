/**
 * Thanh tin ghim — viền gradient #BED232 → #009483 (đồng bộ GuardianChat).
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, Text, View } from 'react-native';

import { resolveChatAttachmentUrl } from '../../../services/chatService';
import type { PinnedMessageSnapshot } from '../../../types/chat';

const AVATAR = 40;

function initialsFromName(name?: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function previewLine(pinned: PinnedMessageSnapshot): string {
  const t = String(pinned.contentPreview || '').trim();
  if (t) return t;
  const n = Math.max(0, Number(pinned.attachmentsCount) || 0);
  if (n <= 0) return 'Tin nhắn';
  return n === 1 ? 'Đã gửi 1 tệp đính kèm' : `Đã gửi ${n} tệp đính kèm`;
}

type Props = {
  pinnedMessage: PinnedMessageSnapshot;
  onPress: () => void;
  showClose?: boolean;
  onUnpin?: () => void;
};

export function PinnedMessageBanner({ pinnedMessage, onPress, showClose = true, onUnpin }: Props) {
  const uri = String(pinnedMessage.avatarUrl || '').trim();
  const fullUri = uri ? resolveChatAttachmentUrl(uri) : '';

  return (
    <LinearGradient
      colors={['#BED232', '#009483']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        marginHorizontal: 12,
        marginTop: 8,
        marginBottom: 6,
        borderRadius: 9999,
        padding: 2,
      }}>
      <Pressable
        onPress={onPress}
        style={{
          borderRadius: 9997,
          overflow: 'hidden',
          backgroundColor: 'rgba(255, 249, 243, 0.96)',
        }}>
        <View className="flex-row items-center py-1 pl-1 pr-2">
          <View
            style={{
              width: AVATAR,
              height: AVATAR,
              borderRadius: AVATAR / 2,
              overflow: 'hidden',
              backgroundColor: '#E5E7EB',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {fullUri ? (
              <Image source={{ uri: fullUri }} style={{ width: AVATAR, height: AVATAR }} resizeMode="cover" />
            ) : (
              <Text className="font-mulish-bold text-sm text-[#002855]/70">
                {initialsFromName(pinnedMessage.senderName)}
              </Text>
            )}
          </View>
          <Text numberOfLines={1} className="ml-2 min-w-0 flex-1 font-mulish-medium text-base text-[#002855]">
            {previewLine(pinnedMessage)}
          </Text>
          {showClose && onUnpin ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onUnpin();
              }}
              hitSlop={12}
              accessibilityLabel="Bỏ ghim"
              className="p-2">
              <Ionicons name="close" size={22} color="#475569" />
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </LinearGradient>
  );
}
