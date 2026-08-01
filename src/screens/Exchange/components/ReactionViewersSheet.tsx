/**
 * Bottom sheet "Ai đã bày tỏ cảm xúc" — mở bằng cách chạm chip cảm xúc dưới bong bóng.
 * Dựng theo đúng khuôn `PollVotersSheet` (BottomSheetModal + hàng avatar/tên/vai trò).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import BottomSheetModal from '../../../components/Common/BottomSheetModal';
import { SheetHeader } from '../../../components/Common/SheetHeader';
import ReactionEmoji from '../../../components/Wislife/ReactionEmoji';
import { useLanguage } from '../../../hooks/useLanguage';
import { resolveChatReactionCode } from '../../../utils/emojiUtils';
import type { ChatReactionViewer } from '../reactionViewerModel';

/** Cam thương hiệu — màu của tab đang chọn, dùng luôn cho icon header cho đồng bộ. */
const TAB_ACTIVE_FG = '#FF7A00';
const TAB_ACTIVE_BG = '#FFEDD5';
const TAB_IDLE_BG = '#F1F3F5';
const TAB_IDLE_FG = '#6B7280';

/**
 * Đếm số người theo từng loại cảm xúc, xếp nhiều → ít (kiểu Facebook).
 * Mã legacy quy về mã hiện hành trước khi đếm, tránh tách "like" cũ/mới thành 2 tab.
 * Code twin của `buildReactionTabs` bên 3 app còn lại — sửa thì sửa cả 4.
 */
function buildReactionTabs(
  viewers: ChatReactionViewer[],
): { code: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of viewers) {
    const code = resolveChatReactionCode(v.emoji);
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return Array.from(counts, ([code, count]) => ({ code, count })).sort(
    (a, b) => b.count - a.count,
  );
}

export function ReactionViewersSheet({
  visible,
  viewers,
  onClose,
}: {
  visible: boolean;
  viewers: ChatReactionViewer[];
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<string>('all');

  const tabs = useMemo(() => buildReactionTabs(viewers), [viewers]);

  // Đóng sheet thì trả tab về "Tất cả" cho lần mở sau (mở tin khác không dính tab cũ).
  useEffect(() => {
    if (!visible) setTab('all');
  }, [visible]);

  // Tab đang chọn biến mất (người cuối cùng của loại đó gỡ cảm xúc) ⇒ rơi về "Tất cả".
  useEffect(() => {
    setTab((cur) => (cur === 'all' || tabs.some((x) => x.code === cur) ? cur : 'all'));
  }, [tabs]);

  const shown = useMemo(
    () =>
      tab === 'all'
        ? viewers
        : viewers.filter((v) => resolveChatReactionCode(v.emoji) === tab),
    [viewers, tab],
  );

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <SheetHeader
        icon="happy-outline"
        iconColor={TAB_ACTIVE_FG}
        title={t('exchange.reaction_viewers_title')}
        subtitle={t('exchange.reaction_viewers_total', { count: viewers.length })}
        closeLabel={t('common.close')}
        onClose={onClose}
      />

      {/* Thanh tab thống kê — hiện ngay khi có cảm xúc, kể cả chỉ một loại (giống Facebook). */}
      {tabs.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-gray-100"
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
          <Pressable
            onPress={() => setTab('all')}
            className="rounded-full px-3 py-1.5"
            style={{ backgroundColor: tab === 'all' ? TAB_ACTIVE_BG : TAB_IDLE_BG }}>
            <Text
              className="font-mulish-bold text-[11px]"
              style={{ color: tab === 'all' ? TAB_ACTIVE_FG : TAB_IDLE_FG }}>
              {t('exchange.reaction_tab_all')} {viewers.length}
            </Text>
          </Pressable>
          {tabs.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => setTab(item.code)}
              className="flex-row items-center rounded-full px-3 py-1.5"
              style={{ backgroundColor: tab === item.code ? TAB_ACTIVE_BG : TAB_IDLE_BG, gap: 4 }}>
              <ReactionEmoji code={item.code} size={16} loop={false} autoPlay />
              <Text
                className="font-mulish-bold text-[11px]"
                style={{ color: tab === item.code ? TAB_ACTIVE_FG : TAB_IDLE_FG }}>
                {item.count}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView className="px-4">
        {shown.map((viewer) => {
          const name = viewer.name || t('exchange.reaction_unknown_member');
          return (
            <View key={viewer.key} className="flex-row items-center gap-2 py-2">
              {viewer.avatarUrl ? (
                <Image
                  source={{ uri: viewer.avatarUrl }}
                  style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB' }}
                />
              ) : (
                <View className="h-7 w-7 items-center justify-center rounded-full bg-gray-200">
                  <Text className="font-mulish-bold text-[11px] text-gray-600">
                    {(name || '?').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text numberOfLines={1} className="flex-1 font-mulish-medium text-sm text-gray-900">
                {viewer.isSelf ? t('exchange.reaction_self_name', { name }) : name}
              </Text>
              {viewer.role !== 'unknown' ? (
                <Text className="font-mulish-medium text-[11px] text-gray-500">
                  {viewer.role === 'teacher'
                    ? t('exchange.poll_role_teacher')
                    : t('exchange.poll_role_guardian')}
                </Text>
              ) : null}
              <ReactionEmoji code={resolveChatReactionCode(viewer.emoji)} size={22} loop={false} autoPlay />
            </View>
          );
        })}
      </ScrollView>
    </BottomSheetModal>
  );
}

export default ReactionViewersSheet;
