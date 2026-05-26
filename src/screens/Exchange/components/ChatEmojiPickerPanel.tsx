/**
 * Panel emoji chat — đồng bộ parent-portal/components/journal/ChatEmojiPicker.tsx
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import ReactionEmoji from '../../../components/Wislife/ReactionEmoji';
import { CHAT_UNICODE_EMOJI_GROUPS } from '../../../utils/chatEmojiCatalog';
import { getEmojiFallbackText, WISLIFE_EMOJIS } from '../../../utils/emojiUtils';

export type ChatEmojiPickerPanelProps = {
  maxHeight: number;
  onInsert?: (text: string) => void;
  onSendWislifeSticker?: (code: string) => void | Promise<void>;
  onRequestClose?: () => void;
  closeOnUnicodePick?: boolean;
  showUnicodeTab?: boolean;
};

export function ChatEmojiPickerPanel({
  maxHeight,
  onInsert,
  onSendWislifeSticker,
  onRequestClose,
  closeOnUnicodePick = false,
  showUnicodeTab = true,
}: ChatEmojiPickerPanelProps) {
  const [tab, setTab] = useState<'wislife' | 'unicode'>('wislife');
  const tabs = showUnicodeTab
    ? [
        { id: 'wislife' as const, label: 'Emoji' },
        { id: 'unicode' as const, label: 'Unicode' },
      ]
    : [{ id: 'wislife' as const, label: 'Emoji' }];

  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-teal-600/20 bg-white shadow-sm">
      <View className="flex-row items-center border-b border-gray-100 pl-3 pr-1">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="min-w-0 flex-1"
          contentContainerStyle={{ gap: 18 }}>
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                disabled={active}
                onPress={() => setTab(item.id)}
                className={`border-b-2 py-2.5 ${active ? 'border-[#0d9488]' : 'border-transparent'}`}>
                <Text
                  className={`font-mulish-bold text-sm ${active ? 'text-[#0d9488]' : 'text-gray-500'}`}
                  numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {onRequestClose ? (
          <Pressable onPress={onRequestClose} hitSlop={8} className="size-9 items-center justify-center">
            <Ionicons name="close" size={18} color="#64748B" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={{ maxHeight }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 8 }}>
        {tab === 'wislife' ? (
          <View className="flex-row flex-wrap gap-3">
            {WISLIFE_EMOJIS.map((e) => (
              <Pressable
                key={e.code}
                onPress={() => {
                  void (async () => {
                    if (onSendWislifeSticker) {
                      await onSendWislifeSticker(e.code);
                    } else {
                      onInsert?.(getEmojiFallbackText(e.code));
                    }
                    onRequestClose?.();
                  })();
                }}
                className="items-center justify-center rounded-full p-1.5 active:bg-gray-100">
                <ReactionEmoji code={e.code} size={32} loop={false} autoPlay />
              </Pressable>
            ))}
          </View>
        ) : (
          CHAT_UNICODE_EMOJI_GROUPS.map((g) => (
            <View key={g.id} className="mb-3">
              <Text className="mb-1.5 font-mulish-bold text-[10px] text-gray-500">{g.label}</Text>
              <View className="flex-row flex-wrap gap-1">
                {g.emojis.map((ch, i) => (
                  <Pressable
                    key={`${g.id}-${i}`}
                    onPress={() => {
                      onInsert?.(ch);
                      if (closeOnUnicodePick) onRequestClose?.();
                    }}
                    className="size-8 items-center justify-center rounded-lg active:bg-gray-100">
                    <Text className="text-xl">{ch}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
