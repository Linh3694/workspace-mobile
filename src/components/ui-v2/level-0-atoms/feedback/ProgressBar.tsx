import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { color, radius } from '../../../../theme/tokens';

/**
 * Thanh tiến trình mảnh đặt dưới chân một chỉ số (§NGÔN NGỮ THIẾT KẾ mục 7).
 * Phần đã đạt tô màu thương hiệu, phần còn lại `surface.muted`.
 */

export interface ProgressBarProps {
  /** 0…1. Giá trị ngoài khoảng sẽ bị kẹp lại. */
  value: number;
  tone?: 'brand' | 'brandSecondary' | 'accent' | 'success' | 'danger';
  height?: number;
  style?: ViewStyle;
}

const TONE = {
  brand: color.brand.DEFAULT,
  brandSecondary: color.brandSecondary.DEFAULT,
  accent: color.accent.DEFAULT,
  success: color.success.DEFAULT,
  danger: color.danger.DEFAULT,
} as const;

const ProgressBar: React.FC<ProgressBarProps> = ({ value, tone = 'brand', height = 4, style }) => {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

  return (
    <View
      style={[
        {
          height,
          borderRadius: radius.full,
          backgroundColor: color.surface.muted,
          overflow: 'hidden',
        },
        style,
      ]}>
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: TONE[tone],
        }}
      />
    </View>
  );
};

export default ProgressBar;
