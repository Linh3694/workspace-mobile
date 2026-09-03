import React from 'react';
import {
  ActivityIndicator,
  TouchableOpacity,
  type TouchableOpacityProps,
  type ViewStyle,
} from 'react-native';

import { color, layout, radius, space } from '../../../../theme/tokens';
import AppText from '../text/AppText';
import Icon, { type IconSet } from '../media/Icon';

/**
 * Nút — dáng viên thuốc, tô đặc cho hành động chính (§NGÔN NGỮ THIẾT KẾ mục 2 & 8).
 *
 * Khác web:
 *  - Không có `:hover`. Phản hồi chạm là `activeOpacity` của TouchableOpacity.
 *  - Chiều cao tối thiểu 48 (≥ 44pt theo iOS HIG) — atom tự bảo đảm, callsite
 *    không phải nhớ.
 *
 * Bốn biến thể xuất ra ở `index.ts` dưới tên `ButtonPrimary` / `ButtonSecondary` /
 * `ButtonDanger` / `ButtonGhost` — callsite không truyền prop `variant` bằng tay.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'sm';

interface VariantStyle {
  background: string;
  /** Màu chữ + icon. */
  foreground: string;
  borderColor?: string;
}

const VARIANT: Record<ButtonVariant, VariantStyle> = {
  primary: { background: color.brand.DEFAULT, foreground: color.brand.foreground },
  secondary: { background: color.brandSecondary.DEFAULT, foreground: color.brandSecondary.foreground },
  danger: { background: color.danger.DEFAULT, foreground: color.content.inverse },
  ghost: { background: color.surface.subtle, foreground: color.content.normal },
};

export interface ButtonProps extends Omit<TouchableOpacityProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Tên icon đặt trước nhãn. */
  icon?: string;
  iconSet?: IconSet;
  /** Tràn hết bề ngang — dùng cho hành động chính ở đáy màn. */
  block?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  iconSet = 'auto',
  block = false,
  loading = false,
  disabled,
  style,
  ...rest
}) => {
  const tone = VARIANT[variant];
  const isDisabled = disabled || loading;
  const height = size === 'sm' ? layout.controlHeightSm : layout.controlHeight;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        {
          minHeight: height,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[8],
          paddingHorizontal: size === 'sm' ? space[16] : space[24],
          borderRadius: radius.full,
          backgroundColor: tone.background,
          alignSelf: block ? 'stretch' : 'flex-start',
          opacity: isDisabled ? 0.45 : 1,
        },
        tone.borderColor ? { borderWidth: 1, borderColor: tone.borderColor } : null,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator size="small" color={tone.foreground} />
      ) : (
        <>
          {icon ? (
            <Icon name={icon} set={iconSet} size={size === 'sm' ? 16 : 18} colorOverride={tone.foreground} />
          ) : null}
          <AppText variant="headline" style={{ color: tone.foreground }} numberOfLines={1}>
            {label}
          </AppText>
        </>
      )}
    </TouchableOpacity>
  );
};

type VariantProps = Omit<ButtonProps, 'variant'>;

export function ButtonPrimary(props: VariantProps) {
  return <Button variant="primary" {...props} />;
}
export function ButtonSecondary(props: VariantProps) {
  return <Button variant="secondary" {...props} />;
}
export function ButtonDanger(props: VariantProps) {
  return <Button variant="danger" {...props} />;
}
export function ButtonGhost(props: VariantProps) {
  return <Button variant="ghost" {...props} />;
}

/** Ô chứa icon đứng một mình — luôn đủ 44pt vùng chạm (§NGÔN NGỮ THIẾT KẾ mục 6). */
export interface IconButtonProps extends Omit<TouchableOpacityProps, 'style' | 'children'> {
  name: string;
  iconSet?: IconSet;
  size?: number;
  /** Nền ô. `none` = không nền, dùng cho nút back trên header. */
  surface?: 'none' | 'subtle' | 'brand' | 'brandSecondary';
  tone?: React.ComponentProps<typeof Icon>['tone'];
  style?: ViewStyle;
}

const ICON_SURFACE: Record<NonNullable<IconButtonProps['surface']>, string | undefined> = {
  none: undefined,
  subtle: color.surface.subtle,
  brand: color.brand.DEFAULT,
  brandSecondary: color.brandSecondary.DEFAULT,
};

export const IconButton: React.FC<IconButtonProps> = ({
  name,
  iconSet = 'auto',
  size = 22,
  surface = 'none',
  tone,
  disabled,
  style,
  ...rest
}) => {
  const background = ICON_SURFACE[surface];
  const resolvedTone: IconButtonProps['tone'] =
    tone ?? (surface === 'brand' || surface === 'brandSecondary' ? 'inverse' : 'default');

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      activeOpacity={0.6}
      style={[
        {
          width: layout.minTouch,
          height: layout.minTouch,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.full,
          backgroundColor: background,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
      {...rest}>
      <Icon name={name} set={iconSet} size={size} tone={resolvedTone} />
    </TouchableOpacity>
  );
};

export default Button;
