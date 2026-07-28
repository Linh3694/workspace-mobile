import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { useLanguage } from '../../../hooks/useLanguage';
import type { ChatPoll, ChatPollVoter } from '../../../types/chat';
import { MY_MESSAGE_BUBBLE_BG } from '../exchangeChatThreadUtils';

const MAX_INLINE_VOTERS = 3;
const ACCENT = MY_MESSAGE_BUBBLE_BG;

type Translate = (key: string, params?: Record<string, unknown>) => string;

function deadlineLabel(poll: ChatPoll, t: Translate): string {
  if (poll.isClosed) return t('exchange.poll_closed');
  if (!poll.closesAt) return '';
  const remain = new Date(poll.closesAt).getTime() - Date.now();
  if (remain <= 0) return t('exchange.poll_closed');
  const minutes = Math.floor(remain / 60000);
  if (minutes < 60) return t('exchange.poll_remaining_minutes', { count: Math.max(1, minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('exchange.poll_remaining_hours', { count: hours });
  return t('exchange.poll_remaining_days', { count: Math.floor(hours / 24) });
}

function VoterAvatars({ voters }: { voters: ChatPollVoter[] }) {
  const shown = voters.slice(0, MAX_INLINE_VOTERS);
  const rest = voters.length - shown.length;
  return (
    <View className="flex-row items-center">
      {shown.map((v, index) => (
        <View
          key={v.userId || v.email || `${v.name}-${index}`}
          style={{ marginLeft: index === 0 ? 0 : -6 }}
        >
          {v.avatarUrl ? (
            <Image
              source={{ uri: v.avatarUrl }}
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#FFFFFF',
                backgroundColor: '#E5E7EB',
              }}
            />
          ) : (
            <View className="h-5 w-5 items-center justify-center rounded-full border border-white bg-gray-200">
              <Text className="font-mulish-bold text-[9px] text-gray-600">
                {(v.name || '?').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      ))}
      {rest > 0 ? (
        <View
          style={{ marginLeft: -6 }}
          className="h-5 w-5 items-center justify-center rounded-full border border-white bg-gray-200"
        >
          <Text className="font-mulish-medium text-[9px] text-gray-600">+{rest}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Thẻ bình chọn trong luồng Trao đổi.
 * Render không khung bong bóng để đọc được như nhau ở tin của mình lẫn của người khác —
 * bubble "của mình" nền teal chữ trắng sẽ nuốt mất thanh phần trăm.
 */
export function ExchangePollCard({
  poll,
  pending,
  canClose,
  readOnly,
  maxWidth,
  onToggleOption,
  onOpenVoters,
  onClose,
}: {
  poll: ChatPoll;
  /** Đang chờ server phản hồi lượt bỏ phiếu. */
  pending?: boolean;
  /** Người xem được kết thúc sớm (người tạo hoặc GVCN/phó). */
  canClose?: boolean;
  /** Nhóm khóa → không bỏ phiếu được. */
  readOnly?: boolean;
  maxWidth?: number;
  onToggleOption: (optionId: string) => void;
  onOpenVoters: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const myVote = poll.myVote ?? [];
  const disabled = Boolean(pending || readOnly || poll.isClosed);
  const remaining = useMemo(() => deadlineLabel(poll, t as Translate), [poll, t]);

  return (
    <View
      style={{ maxWidth, borderColor: '#E5E7EB' }}
      className="w-full overflow-hidden rounded-2xl border bg-white"
    >
      <View className="flex-row items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
        <Ionicons name="stats-chart-outline" size={14} color={ACCENT} />
        <Text style={{ color: ACCENT }} className="font-mulish-bold text-[11px] uppercase">
          {t('exchange.poll_label')}
        </Text>
        {pending ? <ActivityIndicator size="small" color="#9CA3AF" /> : null}
        <View className="ml-auto flex-row items-center gap-1">
          {poll.isClosed ? <Ionicons name="lock-closed" size={11} color="#6B7280" /> : null}
          <Text className="font-mulish-medium text-[11px] text-gray-500">{remaining}</Text>
        </View>
      </View>

      <View className="px-3 pt-2.5">
        <Text className="font-mulish-bold text-base text-gray-900">{poll.question}</Text>
        <Text className="mt-0.5 font-mulish-medium text-[11px] text-gray-500">
          {poll.allowMultiple ? t('exchange.poll_hint_multiple') : t('exchange.poll_hint_single')}
          {poll.anonymous ? ` · ${t('exchange.poll_hint_anonymous')}` : ''}
        </Text>
      </View>

      <View className="gap-1.5 p-3">
        {poll.options.map((option) => {
          const picked = myVote.includes(option.id);
          const percent =
            poll.totalVoters > 0 ? Math.round((option.voteCount / poll.totalVoters) * 100) : 0;
          return (
            <Pressable
              key={option.id}
              disabled={disabled}
              onPress={() => onToggleOption(option.id)}
              style={{
                borderColor: picked ? ACCENT : '#E5E7EB',
                backgroundColor: picked ? 'rgba(13,148,136,0.06)' : '#FFFFFF',
              }}
              className="relative flex-row items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-2"
            >
              {/* Thanh phần trăm nằm dưới nội dung */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${percent}%`,
                  backgroundColor: 'rgba(13,148,136,0.12)',
                }}
              />
              <View
                style={{
                  borderColor: picked ? ACCENT : '#D1D5DB',
                  backgroundColor: picked ? ACCENT : '#FFFFFF',
                  borderRadius: poll.allowMultiple ? 4 : 8,
                }}
                className="h-4 w-4 items-center justify-center border"
              >
                {picked ? <Ionicons name="checkmark" size={11} color="#FFFFFF" /> : null}
              </View>
              <Text className="flex-1 font-mulish-medium text-sm text-gray-900">{option.text}</Text>
              {option.voters?.length ? <VoterAvatars voters={option.voters} /> : null}
              <Text className="font-mulish-medium text-[11px] text-gray-500">
                {option.voteCount}
                {poll.totalVoters > 0 ? ` · ${percent}%` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-center gap-3 border-t border-gray-100 px-3 py-2">
        <Text className="font-mulish-medium text-[11px] text-gray-500">
          {t('exchange.poll_total_voters', { count: poll.totalVoters })}
        </Text>
        {poll.canSeeVoters && poll.totalVoters > 0 ? (
          <Pressable onPress={onOpenVoters}>
            <Text style={{ color: ACCENT }} className="font-mulish-bold text-[11px]">
              {t('exchange.poll_view_voters')}
            </Text>
          </Pressable>
        ) : null}
        {canClose && !poll.isClosed ? (
          <Pressable onPress={onClose} className="ml-auto">
            <Text className="font-mulish-bold text-[11px] text-gray-500">
              {t('exchange.poll_close_action')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default ExchangePollCard;
