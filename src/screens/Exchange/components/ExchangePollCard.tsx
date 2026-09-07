import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { useLanguage } from '../../../hooks/useLanguage';
import type { ChatPoll, ChatPollVoter } from '../../../types/chat';
import { formatChatDisplayName, MY_MESSAGE_BUBBLE_BG } from '../exchangeChatThreadUtils';

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
                {(formatChatDisplayName(v.name) || '?').trim().charAt(0).toUpperCase()}
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
  canEdit,
  readOnly,
  maxWidth,
  timeLabel,
  interactive = true,
  onToggleOption,
  onOpenVoters,
  onEdit,
}: {
  poll: ChatPoll;
  /** Đang chờ server phản hồi lượt bỏ phiếu. */
  pending?: boolean;
  /**
   * Người xem được sửa bình chọn (người tạo hoặc GVCN/phó). Vẫn hiện khi đã kết thúc —
   * "Kết thúc"/"Mở lại" nằm TRONG sheet Sửa nên đây là đường duy nhất vào chúng.
   */
  canEdit?: boolean;
  /** Nhóm khóa → không bỏ phiếu được. */
  readOnly?: boolean;
  maxWidth?: number;
  /**
   * Giờ gửi tin, hiển thị ngay trên hàng "BÌNH CHỌN" thay vì dòng riêng dưới thẻ.
   * Bỏ trống khi tin không ở cuối cụm (bubble tự quyết theo `showTimestamp`).
   */
  timeLabel?: string;
  /**
   * false = bản chỉ-để-nhìn (bản xem trước trong overlay nhấn giữ): ẩn mọi nút, khoá bỏ phiếu.
   * Cần cờ riêng vì `readOnly` chỉ chặn bỏ phiếu, vẫn để lộ nút "Sửa".
   */
  interactive?: boolean;
  onToggleOption: (optionId: string) => void;
  onOpenVoters: () => void;
  onEdit?: () => void;
}) {
  const { t } = useLanguage();
  const myVote = poll.myVote ?? [];
  const disabled = Boolean(pending || readOnly || poll.isClosed || !interactive);
  const remaining = useMemo(() => deadlineLabel(poll, t as Translate), [poll, t]);
  const showEdit = Boolean(interactive && canEdit && onEdit);

  return (
    <View
      style={{
        width: maxWidth,
        maxWidth,
        borderColor: '#E5E7EB',
      }}
      className="overflow-hidden rounded-2xl border bg-white"
    >
      <View className="flex-row items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
        <Ionicons name="stats-chart-outline" size={14} color={ACCENT} />
        <Text style={{ color: ACCENT }} className="font-mulish-bold text-[11px] uppercase">
          {t('exchange.poll_label')}
        </Text>
        {pending ? <ActivityIndicator size="small" color="#9CA3AF" /> : null}
        <View className="ml-auto flex-1 flex-row items-center justify-end gap-1">
          {/* Đã kết thúc: CHỈ ổ khóa, không kèm chữ "Đã kết thúc" — hàng chỉ rộng 0.7 bề ngang
              màn hình, thêm nhãn dài là đẩy nút "Sửa" ra ngoài trên máy màn nhỏ. */}
          {poll.isClosed ? (
            <Ionicons
              name="lock-closed"
              size={13}
              color="#6B7280"
              accessibilityLabel={t('exchange.poll_closed')}
            />
          ) : remaining ? (
            <Text numberOfLines={1} className="shrink font-mulish-medium text-[11px] text-gray-500">
              {remaining}
            </Text>
          ) : null}
          {timeLabel ? (
            <Text numberOfLines={1} className="shrink font-mulish-medium text-[11px] text-gray-400">
              {timeLabel}
            </Text>
          ) : null}
          {/* "Sửa" đứng đúng chỗ nút "Kết thúc" cũ. Kết thúc/Mở lại đã dời vào trong sheet Sửa:
              hàng này không đủ rộng cho hai nút, và chân thẻ thì bị "Xem người bình chọn" chiếm. */}
          {showEdit ? (
            <Pressable onPress={onEdit} hitSlop={8} className="ml-1 shrink-0">
              <Text numberOfLines={1} style={{ color: ACCENT }} className="font-mulish-bold text-[11px]">
                {t('exchange.poll_edit_action')}
              </Text>
            </Pressable>
          ) : null}
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

      {/* Chân thẻ chỉ còn số liệu + xem người bình chọn. Nút "Sửa" đã lên hàng tiêu đề: ở đây,
          khi có phiếu thì "N người đã bình chọn" + "Xem người bình chọn" đã chiếm hết bề ngang
          (thẻ chỉ rộng 0.7 màn hình) và đẩy "Sửa" ra ngoài vùng overflow-hidden trên máy màn nhỏ.
          `flex-wrap` để cỡ chữ hệ thống lớn thì xuống dòng thay vì cắt mất. */}
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 px-3 py-2">
        <Text className="shrink font-mulish-medium text-[11px] text-gray-500">
          {t('exchange.poll_total_voters', { count: poll.totalVoters })}
        </Text>
        {interactive && poll.canSeeVoters && poll.totalVoters > 0 ? (
          <Pressable onPress={onOpenVoters} className="shrink">
            <Text numberOfLines={1} style={{ color: ACCENT }} className="font-mulish-bold text-[11px]">
              {t('exchange.poll_view_voters')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default ExchangePollCard;
