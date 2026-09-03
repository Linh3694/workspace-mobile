import React from 'react';
import { Image, View, type ViewStyle } from 'react-native';

import { color, radius, typography } from '../../../../theme/tokens';
import AppText from '../text/AppText';

/**
 * Ảnh đại diện. Thay cho avatar tự dựng (hiện 59 file).
 * Không có ảnh thì hiện chữ cái đầu trên nền màu nhạt.
 */

const SIZE = { sm: 28, md: 36, lg: 48, xl: 64 } as const;

export interface AvatarProps {
  uri?: string | null;
  /** Tên đầy đủ — dùng để lấy chữ cái đầu khi không có ảnh. */
  name?: string | null;
  size?: keyof typeof SIZE;
  tone?: 'brand' | 'brandSecondary' | 'accent';
  style?: ViewStyle;
}

const TONE = {
  brand: { bg: color.brand[50], fg: color.brand.DEFAULT },
  brandSecondary: { bg: color.brandSecondary[50], fg: color.brandSecondary.DEFAULT },
  accent: { bg: color.accent[50], fg: color.accent.hover },
} as const;

/** Lấy tối đa 2 chữ cái đầu; tên tiếng Việt lấy từ cuối vì đó mới là tên gọi. */
const initialsOf = (name?: string | null): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[parts.length - 1].charAt(0) + parts[0].charAt(0)).toUpperCase();
};

const Avatar: React.FC<AvatarProps> = ({ uri, name, size = 'md', tone = 'brandSecondary', style }) => {
  const dimension = SIZE[size];
  const palette = TONE[tone];

  const base: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: palette.bg,
  };

  if (uri) {
    return (
      <View style={[base, style]}>
        <Image source={{ uri }} style={{ width: dimension, height: dimension }} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={[base, style]}>
      <AppText
        variant="caption"
        style={{
          color: palette.fg,
          fontFamily: typography.headline.fontFamily,
          fontSize: dimension * 0.36,
          lineHeight: dimension * 0.44,
        }}>
        {initialsOf(name)}
      </AppText>
    </View>
  );
};

export default Avatar;
