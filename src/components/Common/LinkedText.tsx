/**
 * Văn bản thuần có link bấm được — chạm là mở trình duyệt ngoài (đồng bộ bản web mở tab mới).
 * Bản sao logic tách link nằm ở `utils/linkify.ts`, tồn tại ở cả 4 app — sửa thì sửa cả 4.
 */
import type { ReactNode } from "react";
import { Alert, Linking, Text } from "react-native";

import { normalizeLineBreaks } from "../../utils/lineBreaks";
import { splitTextWithLinks } from "../../utils/linkify";

/** Mở link ngoài app; URL hỏng / không có app xử lý thì báo nhẹ thay vì crash. */
export async function openExternalLink(href: string) {
  try {
    const ok = await Linking.canOpenURL(href);
    if (!ok) return;
    await Linking.openURL(href);
  } catch {
    Alert.alert("", href);
  }
}

/**
 * Dựng mảng con của một `<Text>`: đoạn link thành `<Text onPress>`, đoạn chữ do caller tự
 * render (`renderPlain`) để giữ được phần tô @nhắc-tên vốn có của từng màn.
 */
export function linkedChildren(
  text: string | undefined | null,
  {
    linkClassName = "text-[#0B63CE] underline",
    renderPlain,
  }: {
    linkClassName?: string;
    renderPlain?: (chunk: string, key: string) => ReactNode;
  } = {},
): ReactNode[] {
  // Android chỉ ngắt dòng ở '\n' còn iOS ngắt cả ở U+2028/U+2029 — chuẩn hoá ở đây để mọi chỗ
  // dùng chung (tin nhắn, bài viết, bình luận) hiện giống nhau trên hai nền tảng.
  return splitTextWithLinks(normalizeLineBreaks(text)).map((seg, i) => {
    if (seg.type === "link") {
      return (
        <Text
          key={`l-${i}`}
          className={linkClassName}
          onPress={() => void openExternalLink(seg.href)}
          suppressHighlighting
        >
          {seg.value}
        </Text>
      );
    }
    return renderPlain ? renderPlain(seg.value, `t-${i}`) : seg.value;
  });
}

/** Bọc sẵn trong một `<Text>` — dùng cho chỗ không có @nhắc-tên (tin nhắn, nội dung bài). */
export function LinkedText({
  text,
  className,
  linkClassName,
}: {
  text?: string | null;
  className?: string;
  linkClassName?: string;
}) {
  return <Text className={className}>{linkedChildren(text, { linkClassName })}</Text>;
}
