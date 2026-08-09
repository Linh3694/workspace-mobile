/**
 * Bottom sheet danh sách người bầu theo từng phương án + tab "Chưa bình chọn" để GV rà ai cần
 * nhắn nhắc.
 *
 * Với bình chọn ẩn danh, danh tính KHÔNG đi kèm broadcast chung mà tới qua event riêng
 * `chat:message:poll:voters` chỉ phát cho room giáo viên — nên sheet này vừa fetch REST vừa
 * nghe event đó để cập nhật realtime. Danh sách chưa bầu CHỈ server trả cho giáo viên
 * (phụ huynh không có `pending` trong payload) và chỉ có trong REST ⇒ tải lại theo `poll.rev`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';

import BottomSheetModal from '../../../components/Common/BottomSheetModal';
import { SheetHeader } from '../../../components/Common/SheetHeader';
import { useLanguage } from '../../../hooks/useLanguage';
import { CHAT_EVENTS } from '../../../realtime/chatEvents';
import { chatService } from '../../../services/chatService';
import type { ChatPoll, ChatPollVotersData } from '../../../types/chat';
import { formatChatDisplayName, MY_MESSAGE_BUBBLE_BG } from '../exchangeChatThreadUtils';

const ACCENT = MY_MESSAGE_BUBBLE_BG;
const ACCENT_SOFT = 'rgba(13,148,136,0.08)';

type VotersTab = 'voted' | 'pending';

/** Một hàng người trong danh sách (dùng chung cho tab đã bầu và tab chưa bầu). */
function PersonRow({
  name,
  role,
  avatarUrl,
  roleLabel,
}: {
  name: string;
  role?: string;
  avatarUrl?: string;
  roleLabel: (role?: string) => string;
}) {
  return (
    <View className="flex-row items-center gap-2 py-1.5">
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB' }}
        />
      ) : (
        <View className="h-7 w-7 items-center justify-center rounded-full bg-gray-200">
          <Text className="font-mulish-bold text-[11px] text-gray-600">
            {(name || '?').trim().charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <Text className="flex-1 font-mulish-medium text-sm text-gray-900">{name}</Text>
      <Text className="font-mulish-medium text-[11px] text-gray-500">{roleLabel(role)}</Text>
    </View>
  );
}

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
  const [tab, setTab] = useState<VotersTab>('voted');

  useEffect(() => {
    if (visible) setTab('voted');
  }, [visible, messageId]);

  const load = useCallback(
    (silent: boolean) => {
      if (!messageId) return () => {};
      let cancelled = false;
      if (!silent) setLoading(true);
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
          if (!cancelled && !silent) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [messageId, t]
  );

  // Có người vừa bỏ phiếu (rev tăng) ⇒ tải lại để cả hai tab bám theo, vì `pending` chỉ có ở REST.
  useEffect(() => {
    if (!visible) return undefined;
    return load(Boolean(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, messageId, poll.rev]);

  useEffect(() => {
    if (!visible || !messageId) return undefined;
    let detach: (() => void) | undefined;
    let disposed = false;

    void chatService.getSocket().then((socket) => {
      if (!socket || disposed) return;
      const handler = (payload: ChatPollVotersData) => {
        if (String(payload?.messageId) !== String(messageId)) return;
        // Bỏ payload đến trễ (rev không lùi). Event này KHÔNG kèm `pending`/`participantCount`
        // nên giữ lại giá trị từ lần fetch REST gần nhất thay vì ghi đè bằng undefined.
        setData((prev) => {
          if (prev && payload.rev < prev.rev) return prev;
          return { ...payload, pending: prev?.pending, participantCount: prev?.participantCount };
        });
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
  /** `pending` chỉ có với giáo viên ⇒ phụ huynh không thấy tab "Chưa bình chọn". */
  const pending = data?.pending ?? null;
  const totalVoters = data?.totalVoters ?? poll.totalVoters;
  const roleLabel = (role?: string) =>
    role === 'teacher' ? t('exchange.poll_role_teacher') : t('exchange.poll_role_guardian');

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={80}>
      <SheetHeader
        icon="people-outline"
        iconColor={ACCENT}
        title={t('exchange.poll_voters_title')}
        subtitle={poll.question}
        closeLabel={t('common.close')}
        onClose={onClose}
      />

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
          {pending ? (
            <View className="mb-4 flex-row gap-2">
              {(
                [
                  { key: 'voted' as VotersTab, label: t('exchange.poll_tab_voted', { count: totalVoters }) },
                  {
                    key: 'pending' as VotersTab,
                    label: t('exchange.poll_tab_pending', { count: pending.length }),
                  },
                ]
              ).map((item) => {
                const active = tab === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setTab(item.key)}
                    style={{
                      borderColor: active ? ACCENT : '#E5E7EB',
                      backgroundColor: active ? ACCENT_SOFT : '#FFFFFF',
                    }}
                    className="flex-1 items-center rounded-xl border py-2"
                  >
                    <Text
                      style={{ color: active ? ACCENT : '#374151' }}
                      className="font-mulish-bold text-[13px]"
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {tab === 'pending' && pending ? (
            pending.length ? (
              pending.map((member) => (
                <PersonRow
                  key={member.userId || member.email || member.name}
                  name={formatChatDisplayName(member.name)}
                  role={member.role}
                  avatarUrl={member.avatarUrl}
                  roleLabel={roleLabel}
                />
              ))
            ) : (
              <Text className="py-8 text-center font-mulish-medium text-sm text-gray-500">
                {t('exchange.poll_all_voted')}
              </Text>
            )
          ) : (
            poll.options.map((option) => {
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
                      <PersonRow
                        key={`${option.id}-${voter.userId || voter.email || voter.name}`}
                        name={formatChatDisplayName(voter.name)}
                        role={voter.role}
                        avatarUrl={voter.avatarUrl}
                        roleLabel={roleLabel}
                      />
                    ))
                  ) : (
                    <Text className="font-mulish-medium text-[11px] text-gray-400">
                      {t('exchange.poll_no_voters')}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </BottomSheetModal>
  );
}

export default PollVotersSheet;
