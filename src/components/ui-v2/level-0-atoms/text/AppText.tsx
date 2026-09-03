import React from 'react';
import { Text, StyleSheet, type TextProps, type TextStyle } from 'react-native';

import { color, typography, type TypographyVariant } from '../../../../theme/tokens';

/**
 * Chữ — atom quan trọng nhất của ui-v2 trên mobile.
 *
 * Khác web: RN `<Text>` KHÔNG kế thừa style từ View cha. Đặt màu chữ ở container
 * không có tác dụng gì. Nên đây là chỗ DUY NHẤT ép được typography + màu chữ cho
 * toàn app — mọi chữ hiển thị phải đi qua component này, không dùng `<Text>` trần.
 *
 * @example
 * <AppText variant="title1">Quản lý thiết bị</AppText>
 * <AppText variant="footnote" tone="description">12 thiết bị</AppText>
 * <AppText variant="headline" tone="brand" numberOfLines={1}>{device.name}</AppText>
 */

export type AppTextTone =
  /** Chữ nổi bật nhất — tiêu đề, con số. */
  | 'emphasized'
  /** Chữ nội dung mặc định. */
  | 'default'
  /** Chữ phụ, chú thích. */
  | 'description'
  /** Chữ đã vô hiệu. */
  | 'disabled'
  /** Chữ trên nền tối / nền màu thương hiệu. */
  | 'inverse'
  | 'brand'
  | 'brandSecondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info';

const TONE_COLOR: Record<AppTextTone, string> = {
  emphasized: color.content.emphasized,
  default: color.content.DEFAULT,
  description: color.content.description,
  disabled: color.content.disabled,
  inverse: color.content.inverse,
  brand: color.brand.DEFAULT,
  brandSecondary: color.brandSecondary.DEFAULT,
  success: color.success.DEFAULT,
  danger: color.danger.DEFAULT,
  warning: color.warning.DEFAULT,
  info: color.info.DEFAULT,
};

export interface AppTextProps extends TextProps {
  /** Gói cỡ chữ + giãn dòng + độ đậm. Mặc định `body`. */
  variant?: TypographyVariant;
  /** Màu chữ theo ngữ nghĩa. Mặc định suy từ `variant`. */
  tone?: AppTextTone;
  /** Căn chữ. */
  align?: TextStyle['textAlign'];
  children?: React.ReactNode;
}

/** Tiêu đề mặc định dùng màu đậm nhất; phần còn lại dùng màu nội dung. */
const defaultToneFor = (variant: TypographyVariant): AppTextTone =>
  variant === 'title1' || variant === 'title2' || variant === 'title3' || variant === 'headline'
    ? 'emphasized'
    : variant === 'caption' || variant === 'footnote'
      ? 'description'
      : 'default';

const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  tone,
  align,
  style,
  children,
  ...rest
}) => (
  <Text
    style={StyleSheet.flatten([
      typography[variant],
      { color: TONE_COLOR[tone ?? defaultToneFor(variant)] },
      align ? { textAlign: align } : null,
      style,
    ])}
    {...rest}>
    {children}
  </Text>
);

export default AppText;
