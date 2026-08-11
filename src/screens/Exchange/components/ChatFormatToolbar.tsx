/**
 * Thanh định dạng cho ô soạn tin trên app GV (in đậm / nghiêng / gạch chân / màu chữ).
 *
 * React Native KHÔNG có contenteditable, nên không thể bê tiptap của web sang. Cách làm ở đây:
 * người dùng BÔI ĐEN một đoạn chữ rồi bấm nút — mark được ghi vào mảng `formats` neo theo offset
 * (xem `lib/chatFormats.ts`), đúng cấu trúc mà web gửi lên. Không bôi đen thì thanh này mờ đi.
 *
 * Chỉ hiện khi ô soạn có nội dung — chat vẫn phải gõ nhanh được, thanh công cụ không được chiếm
 * chỗ thường trực.
 *
 * VỊ TRÍ: đặt DƯỚI ô nhập (xem ChatComposerExchange). Bôi đen chữ là Android bung menu hệ thống
 * ngay phía trên vùng chọn, che mất thanh này nếu để ở trên.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ChatFormat, ChatHighlight, ChatTextColor } from '../../../types/chat';
import {
  CHAT_HIGHLIGHTS,
  CHAT_HIGHLIGHT_ORDER,
  CHAT_HIGHLIGHT_TEXT,
  CHAT_TEXT_COLORS,
  CHAT_TEXT_COLOR_ORDER,
  activeColorInRange,
  activeHighlightInRange,
  applyMarkToRange,
  isMarkActiveInRange,
  type ChatFormatFlag,
} from '../lib/chatFormats';

/** Nhãn theo tên trong bộ nhận diện Wellspring. */
const COLOR_LABELS: Record<ChatTextColor, string> = { 'oxford-blue': 'Oxford Blue', teal: 'Teal' };
const HIGHLIGHT_LABELS: Record<ChatHighlight, string> = { amber: 'Amber', lime: 'Lime', honey: 'Honey' };

const ACTIVE_BG = '#CCFBF1';
const ACTIVE_FG = '#0D9488';
const IDLE_FG = '#64748B';

type Props = {
  text: string;
  formats: ChatFormat[];
  selection: { start: number; end: number };
  disabled?: boolean;
  onChange: (next: ChatFormat[]) => void;
};

function FlagButton({
  flag,
  glyph,
  label,
  textStyle,
  text,
  formats,
  selection,
  disabled,
  onChange,
}: Props & {
  flag: ChatFormatFlag;
  /** Dùng chữ B/I/U thay vì icon: Ionicons không có bộ icon định dạng nào đọc ra nghĩa. */
  glyph: string;
  label: string;
  textStyle?: { fontStyle?: 'italic'; textDecorationLine?: 'underline' };
}) {
  const hasSelection = selection.end > selection.start;
  const off = disabled || !hasSelection;
  const active = hasSelection && isMarkActiveInRange(formats, selection.start, selection.end, flag, text.length);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled: off }}
      disabled={off}
      onPress={() =>
        onChange(applyMarkToRange(formats, selection.start, selection.end, { flag }, text.length))
      }
      // Nền chỉ đổi khi mark đang bật cho CẢ vùng chọn — giống trạng thái nút của editor web.
      style={{ opacity: off ? 0.35 : 1, backgroundColor: active ? ACTIVE_BG : 'transparent' }}
      className="size-8 items-center justify-center rounded-lg">
      <Text
        style={{ color: active ? ACTIVE_FG : IDLE_FG, fontWeight: '700', ...textStyle }}
        className="text-base">
        {glyph}
      </Text>
    </Pressable>
  );
}

export function ChatFormatToolbar(props: Props) {
  const { text, formats, selection, disabled, onChange } = props;
  const hasSelection = selection.end > selection.start;
  const activeColor: ChatTextColor | null = hasSelection
    ? activeColorInRange(formats, selection.start, selection.end, text.length)
    : null;
  const activeHighlight: ChatHighlight | null = hasSelection
    ? activeHighlightInRange(formats, selection.start, selection.end, text.length)
    : null;

  const setColor = (color: ChatTextColor | null) => {
    onChange(applyMarkToRange(formats, selection.start, selection.end, { color }, text.length));
  };

  const setHighlight = (highlight: ChatHighlight | null) => {
    onChange(applyMarkToRange(formats, selection.start, selection.end, { highlight }, text.length));
  };

  /**
   * Tẩy màu chữ VÀ nền trong MỘT lần gọi.
   *
   * KHÔNG gọi `setColor(null)` rồi `setHighlight(null)`: cả hai cùng đọc `formats` của lần render
   * hiện tại (prop, không phải state nội bộ), nên lệnh sau ghi đè kết quả của lệnh trước và luôn
   * mất đúng một trong hai. `applyMarkToRange` nhận cả hai mark cùng lúc nên gộp lại là đủ.
   */
  const clearColors = () => {
    onChange(
      applyMarkToRange(
        formats,
        selection.start,
        selection.end,
        { color: null, highlight: null },
        text.length,
      ),
    );
  };

  // Chưa bôi đen thì mọi nút đều vô tác dụng ⇒ thay bằng một dòng gợi ý, không nhét chung một
  // hàng. Nhồi 9 nút + chữ vào cùng hàng thì trên máy hẹp chữ bị cắt cụt ("Bôi đe…").
  if (!hasSelection) {
    return (
      <View className="px-3 pt-2">
        <Text className="font-mulish-medium text-xs text-gray-400">
          Bôi đen chữ để in đậm, đổi màu hoặc tô sáng
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap items-center gap-1 px-2 pt-2">
      <FlagButton {...props} flag="bold" glyph="B" label="In đậm" />
      <FlagButton {...props} flag="italic" glyph="I" label="In nghiêng" textStyle={{ fontStyle: 'italic' }} />
      <FlagButton
        {...props}
        flag="underline"
        glyph="U"
        label="Gạch chân"
        textStyle={{ textDecorationLine: 'underline' }}
      />

      <View className="mx-1 h-4 w-px bg-gray-200" />

      {/* Màu CHỮ — chỉ hai màu đậm của bộ Wellspring đủ tương phản ở cỡ chữ chat. */}
      {CHAT_TEXT_COLOR_ORDER.map((token) => (
        <Pressable
          key={token}
          accessibilityRole="button"
          accessibilityLabel={`Màu chữ ${COLOR_LABELS[token]}`}
          accessibilityState={{ selected: activeColor === token, disabled: disabled || !hasSelection }}
          disabled={disabled || !hasSelection}
          onPress={() => setColor(token)}
          style={{
            backgroundColor: '#fff',
            opacity: disabled || !hasSelection ? 0.35 : 1,
            borderWidth: activeColor === token ? 2 : 1,
            borderColor: activeColor === token ? '#0F172A' : '#E2E8F0',
          }}
          className="size-7 items-center justify-center rounded-lg">
          <Text style={{ color: CHAT_TEXT_COLORS[token], fontWeight: '700' }} className="text-xs">
            A
          </Text>
        </Pressable>
      ))}

      {/*
        Nền TÔ SÁNG — nhóm màu tươi của Wellspring. Làm màu chữ thì chỉ đạt 1.4–1.8:1 nên bắt
        buộc dùng ở vai nền, chữ tối đè lên (7.9–10.5:1).
      */}
      {CHAT_HIGHLIGHT_ORDER.map((token) => (
        <Pressable
          key={token}
          accessibilityRole="button"
          accessibilityLabel={`Tô sáng ${HIGHLIGHT_LABELS[token]}`}
          accessibilityState={{ selected: activeHighlight === token, disabled: disabled || !hasSelection }}
          disabled={disabled || !hasSelection}
          onPress={() => setHighlight(token)}
          style={{
            backgroundColor: CHAT_HIGHLIGHTS[token],
            opacity: disabled || !hasSelection ? 0.35 : 1,
            borderWidth: activeHighlight === token ? 2 : 1,
            borderColor: activeHighlight === token ? '#0F172A' : '#E2E8F0',
          }}
          className="size-7 items-center justify-center rounded-lg">
          <Text style={{ color: CHAT_HIGHLIGHT_TEXT, fontWeight: '700' }} className="text-xs">
            A
          </Text>
        </Pressable>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bỏ màu chữ và nền"
        disabled={disabled || !hasSelection}
        onPress={clearColors}
        style={{ opacity: disabled || !hasSelection ? 0.35 : 1 }}
        className="size-8 items-center justify-center rounded-lg">
        <Ionicons name="ban-outline" size={18} color={IDLE_FG} />
      </Pressable>
    </View>
  );
}

export default ChatFormatToolbar;
