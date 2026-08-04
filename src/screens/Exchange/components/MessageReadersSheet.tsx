/**
 * Bottom sheet danh sách người đã đọc một tin — chỉ GV mở được.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import BottomSheetModal from '../../../components/Common/BottomSheetModal';
import { SheetHeader } from '../../../components/Common/SheetHeader';
import { useLanguage } from '../../../hooks/useLanguage';
import { chatService } from '../../../services/chatService';
import type { ChatMessageReader } from '../../../types/chat';
import { formatChatTimeVi, MY_MESSAGE_BUBBLE_BG } from '../exchangeChatThreadUtils';

const ACCENT = MY_MESSAGE_BUBBLE_BG;

export function MessageReadersSheet({
  visible,
  conversationId,
  messageId,
  participantCount,
  onClose,
}: {
  visible: boolean;
  conversationId: string;
  messageId: string;
  participantCount?: number;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [readers, setReaders] = useState<ChatMessageReader[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(participantCount ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !conversationId || !messageId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setTotalParticipants(participantCount ?? 0);
    void chatService
      .getMessageReaders(conversationId, messageId)
      .then((res) => {
        if (cancelled) return;
        setReaders(res.readers || []);
        setTotalParticipants(res.participantCount ?? 0);
      })
      .catch((err) => {
        console.warn('[MessageReadersSheet] load error:', err);
        if (!cancelled) setError(t('exchange.readers_load_failed') || 'Không tải được danh sách đã đọc');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, conversationId, messageId, participantCount, t]);

  const subtitle =
    totalParticipants > 0
      ? `Đã đọc ${readers.length}/${totalParticipants}`
      : `Đã đọc ${readers.length}`;

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={80}>
      <SheetHeader
        icon="eye-outline"
        iconColor={ACCENT}
        title={t('exchange.readers_title') || 'Người đã đọc'}
        subtitle={subtitle}
        closeLabel={t('common.close') || 'Đóng'}
        onClose={onClose}
      />
      {loading && !readers.length ? (
        <View className="items-center py-10">
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : error && !readers.length ? (
        <Text className="px-4 py-8 text-center font-mulish-medium text-sm text-red-500">
          {error}
        </Text>
      ) : readers.length === 0 ? (
        <Text className="px-4 py-8 text-center font-mulish-medium text-sm text-gray-400">
          {t('exchange.readers_empty') || 'Chưa có ai đọc tin này'}
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingBottom: 24 }}>
          {readers.map((r) => (
            <View
              key={r.userId}
              className="flex-row items-center gap-3 border-b border-gray-50 px-4 py-3">
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 40, height: 40, backgroundColor: '#E0F2F1' }}>
                <Text className="font-mulish-bold text-sm text-[#0D9488]">
                  {(r.name || '?').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-mulish-semibold text-base text-[#0A2240]" numberOfLines={2}>
                  {r.name}
                </Text>
                {r.readAt ? (
                  <Text className="mt-0.5 font-mulish-medium text-xs text-gray-400">
                    {formatChatTimeVi(r.readAt)}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </BottomSheetModal>
  );
}
