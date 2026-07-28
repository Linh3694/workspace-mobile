/**
 * Bottom sheet danh sách người bầu theo từng phương án.
 *
 * Với bình chọn ẩn danh, danh tính KHÔNG đi kèm broadcast chung mà tới qua event riêng
 * `chat:message:poll:voters` chỉ phát cho room giáo viên — nên sheet này vừa fetch REST vừa
 * nghe event đó để cập nhật realtime.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';

import BottomSheetModal from '../../../components/Common/BottomSheetModal';
import { useLanguage } from '../../../hooks/useLanguage';
import { CHAT_EVENTS } from '../../../realtime/chatEvents';
import { chatService } from '../../../services/chatService';
import type { ChatPoll, ChatPollVotersData } from '../../../types/chat';
import { MY_MESSAGE_BUBBLE_BG } from '../exchangeChatThreadUtils';

const ACCENT = MY_MESSAGE_BUBBLE_BG;

export function PollVotersSheet({
  visible,
  messageId,
  poll,
  onClose,
}: {
  visible: boolean;
  messageId: string;
  poll: ChatPoll;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [data, setData] = useState<ChatPollVotersData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !messageId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    chatService
      .getPollVoters(messageId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        console.warn('[PollVotersSheet] getPollVoters error:', err);
        if (!cancelled) setError(t('exchange.poll_voters_load_failed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, messageId, t]);

  useEffect(() => {
    if (!visible || !messageId) return undefined;
    let detach: (() => void) | undefined;
    let disposed = false;

    void chatService.getSocket().then((socket) => {
      if (!socket || disposed) return;
      const handler = (payload: ChatPollVotersData) => {
        if (String(payload?.messageId) !== String(messageId)) return;
        // Bỏ payload đến trễ (rev không lùi).
        setData((prev) => (prev && payload.rev < prev.rev ? prev : payload));
      };
      socket.on(CHAT_EVENTS.POLL_VOTERS, handler);
      detach = () => socket.off(CHAT_EVENTS.POLL_VOTERS, handler);
    });

    return () => {
      disposed = true;
      detach?.();
    };
  }, [visible, messageId]);

  const votersOf = (optionId: string) =>
    data?.options.find((o) => o.id === optionId)?.voters ?? [];

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={80}>
      <View className="flex-row items-center gap-2 px-4 pb-3">
        <Ionicons name="people-outline" size={18} color={ACCENT} />
        <View className="flex-1">
          <Text className="font-mulish-bold text-lg text-gray-900">
            {t('exchange.poll_voters_title')}
          </Text>
          <Text numberOfLines={1} className="font-mulish-medium text-[11px] text-gray-500">
            {poll.question}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color="#6B7280" />
        </Pressable>
      </View>

      {loading && !data ? (
        <View className="items-center py-10">
          <ActivityIndicator size="small" color={ACCENT} />
        </View>
      ) : error ? (
        <Text className="px-4 py-10 text-center font-mulish-medium text-sm text-gray-500">
          {error}
        </Text>
      ) : (
        <ScrollView className="px-4">
          {poll.options.map((option) => {
            const voters = votersOf(option.id);
            return (
              <View key={option.id} className="mb-4">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="flex-1 font-mulish-bold text-sm text-gray-900">
                    {option.text}
                  </Text>
                  <Text className="font-mulish-medium text-sm text-gray-500">{voters.length}</Text>
                </View>
                {voters.length ? (
                  voters.map((voter) => (
                    <View
                      key={`${option.id}-${voter.userId || voter.email || voter.name}`}
                      className="flex-row items-center gap-2 py-1.5"
                    >
                      {voter.avatarUrl ? (
                        <Image
                          source={{ uri: voter.avatarUrl }}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: '#E5E7EB',
                          }}
                        />
                      ) : (
                        <View className="h-7 w-7 items-center justify-center rounded-full bg-gray-200">
                          <Text className="font-mulish-bold text-[11px] text-gray-600">
                            {(voter.name || '?').trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text className="flex-1 font-mulish-medium text-sm text-gray-900">
                        {voter.name}
                      </Text>
                      <Text className="font-mulish-medium text-[11px] text-gray-500">
                        {voter.role === 'teacher'
                          ? t('exchange.poll_role_teacher')
                          : t('exchange.poll_role_guardian')}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text className="font-mulish-medium text-[11px] text-gray-400">
                    {t('exchange.poll_no_voters')}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </BottomSheetModal>
  );
}

export default PollVotersSheet;
