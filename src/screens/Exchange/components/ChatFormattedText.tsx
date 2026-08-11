/**
 * Nội dung tin nhắn có định dạng trên React Native — dùng chung cho bong bóng, overlay nhấn giữ
 * và dải xem trước trong ô soạn (app GV). App PH chỉ dùng ở bong bóng.
 *
 * HAI CHỖ RN KHÁC HẲN WEB, cả hai đều đã cắn một lần:
 *
 * 1. **In đậm / nghiêng KHÔNG dùng `fontWeight` / `fontStyle`.** App nạp mỗi kiểu chữ một file
 *    font riêng (`Mulish-Medium`, `Mulish-Bold`…), mà khi đã chỉ định `fontFamily` thì RN chọn
 *    font theo TÊN HỌ và bỏ qua hai thuộc tính kia — đặt `fontWeight: '700'` là không có gì xảy
 *    ra. Phải đổi thẳng `fontFamily`, xem bảng `FONTS`.
 *
 * 2. **Nền tô sáng không bo góc được bằng `<Text>` lồng nhau** (nền inline vẽ như span nên
 *    `borderRadius`/`padding` bị bỏ qua). Tin CÓ nền tô sáng vì vậy đổi sang hàng flex bọc dòng,
 *    mỗi từ một ô, ô tô sáng là `<View>` bo góc thật.
 *    CỐ Ý KHÔNG nhúng `<View>` vào trong `<Text>`: RN căn view nhúng theo baseline của dòng chữ
 *    nên chữ tô sáng bị đội lên khỏi dòng, và bù thủ công thì phụ thuộc font/cỡ chữ. Trong hàng
 *    flex, mọi ô cùng cỡ chữ ⇒ cùng chiều cao ⇒ `alignItems: 'center'` cho ra đúng một đường
 *    chữ, không cần con số bù nào.
 *    Tin KHÔNG có nền tô sáng (đa số) vẫn đi nhánh `<Text>` lồng nhau như cũ, để giữ
 *    `numberOfLines` và bôi chọn được cả tin.
 *
 * Bản sao: parent-portal-mobile/components/journal/guardianChat/ChatFormattedText.tsx
 * — chỉ khác dòng `import` và bảng `FONTS` (tên font đăng ký ở hai app không giống nhau).
 */
import React from 'react';
import { Text, View } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';

import { linkedChildren } from '../../../components/Common/LinkedText';
import type { ChatFormat, ChatMention } from '../../../types/chat';
import { chatFormatColorHex, chatHighlightHex, splitFormattedParts } from '../lib/chatFormats';
import type { ChatFormatMarks } from '../lib/chatFormats';

/**
 * Tên font theo từng tổ hợp đậm/nghiêng.
 *
 * KHÁC NHAU giữa hai app: workspace-mobile nạp file `.ttf` cục bộ (`Mulish-Bold`),
 * parent-portal-mobile dùng `@expo-google-fonts/mulish` (`Mulish_700Bold`). Thêm/đổi tên ở đây
 * thì phải đăng ký font tương ứng trong `App.tsx` / `app/_layout.tsx` — thiếu đăng ký là chữ rơi
 * về font hệ thống mà KHÔNG báo lỗi gì.
 */
const FONTS = {
  bold: 'Mulish-Bold',
  italic: 'Mulish-MediumItalic',
  boldItalic: 'Mulish-BoldItalic',
} as const;

/** Bo góc + đệm ngang của nền tô sáng — khớp bản web (4px / 3px). */
const HIGHLIGHT_RADIUS = 4;
const HIGHLIGHT_PAD_X = 3;

function fontFamilyForMarks(marks: ChatFormatMarks | undefined): string | undefined {
  if (marks?.bold && marks?.italic) return FONTS.boldItalic;
  if (marks?.bold) return FONTS.bold;
  if (marks?.italic) return FONTS.italic;
  return undefined; // không có mark ⇒ giữ nguyên font của className
}

/** Style chữ của một mảnh — export để ô nhập dùng lại, tránh lặp bảng font. */
export function marksToStyle(marks: ChatFormatMarks | undefined): TextStyle {
  const color = chatFormatColorHex(marks);
  const fontFamily = fontFamilyForMarks(marks);
  return {
    ...(fontFamily ? { fontFamily } : null),
    ...(marks?.underline ? { textDecorationLine: 'underline' as const } : null),
    ...(color ? { color } : null),
  };
}

/**
 * Cắt một mảnh thành các mẩu KẾT THÚC ở chỗ được phép xuống dòng ("a b c" → ["a ", "b ", "c"]).
 * Khoảng trắng đi kèm từ đứng trước để nền tô sáng liền mạch, không hở giữa các từ.
 */
function splitWrapChunks(text: string): string[] {
  const chunks = text.match(/\S+\s*|\s+/g);
  return chunks && chunks.length ? chunks : [text];
}

type Props = {
  content: string;
  mentions?: ChatMention[] | null;
  formats?: ChatFormat[] | null;
  /** Cỡ chữ / họ font / màu mặc định. Phải lặp lại ở MỌI `<Text>` con — xem ghi chú trong code. */
  className?: string;
  linkClassName?: string;
  mentionClassName?: string;
  /** Bỏ tách link — dùng cho dải xem trước trong ô soạn. */
  disableLinks?: boolean;
  /** Chỉ có tác dụng ở nhánh không có nền tô sáng (hàng flex không cắt dòng được). */
  numberOfLines?: number;
};

export function ChatFormattedText({
  content,
  mentions,
  formats,
  className,
  linkClassName,
  mentionClassName,
  disableLinks,
  numberOfLines,
}: Props) {
  const parts = splitFormattedParts(content, mentions, formats);
  const hasHighlight = parts.some((part) => Boolean(chatHighlightHex(part.marks)));

  const childrenOf = (text: string, mention: boolean) => {
    if (mention || disableLinks) return text;
    return linkedChildren(text, { linkClassName });
  };

  if (!hasHighlight) {
    return (
      <Text className={className} numberOfLines={numberOfLines}>
        {parts.map((part, index) => (
          <Text
            key={index}
            className={part.mention ? mentionClassName : undefined}
            style={marksToStyle(part.marks)}
          >
            {childrenOf(part.text, Boolean(part.mention))}
          </Text>
        ))}
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
      {parts.flatMap((part, index) => {
        const style = marksToStyle(part.marks);
        const background = chatHighlightHex(part.marks);
        const chunks = splitWrapChunks(part.text);
        /**
         * `className` phải lặp lại ở TỪNG `<Text>`: ở nhánh này chúng là anh em trong flex chứ
         * không phải con của một `<Text>` bao ngoài, nên không kế thừa cỡ chữ/họ font của ai.
         * Thiếu là chữ nhỏ lại và lệch dòng.
         */
        const chunkClass = part.mention
          ? `${className ?? ''} ${mentionClassName ?? ''}`.trim()
          : className;

        return chunks.map((chunk, chunkIndex) => {
          const inner = (
            <Text className={chunkClass} style={style}>
              {childrenOf(chunk, Boolean(part.mention))}
            </Text>
          );
          if (!background) {
            return <React.Fragment key={`t-${index}-${chunkIndex}`}>{inner}</React.Fragment>;
          }
          const first = chunkIndex === 0;
          const last = chunkIndex === chunks.length - 1;
          // Chỉ bo góc hai đầu đoạn — chỗ ngắt dòng có cạnh vuông, giống hệt cách trình duyệt
          // bo góc một phần tử inline bị wrap.
          const boxStyle: ViewStyle = {
            backgroundColor: background,
            borderTopLeftRadius: first ? HIGHLIGHT_RADIUS : 0,
            borderBottomLeftRadius: first ? HIGHLIGHT_RADIUS : 0,
            borderTopRightRadius: last ? HIGHLIGHT_RADIUS : 0,
            borderBottomRightRadius: last ? HIGHLIGHT_RADIUS : 0,
            paddingLeft: first ? HIGHLIGHT_PAD_X : 0,
            paddingRight: last ? HIGHLIGHT_PAD_X : 0,
          };
          return (
            <View key={`h-${index}-${chunkIndex}`} style={boxStyle}>
              {inner}
            </View>
          );
        });
      })}
    </View>
  );
}

export default ChatFormattedText;
