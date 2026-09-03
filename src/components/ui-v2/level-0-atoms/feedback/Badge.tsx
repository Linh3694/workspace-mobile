import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { color, radius, space } from '../../../../theme/tokens';
import AppText from '../text/AppText';

/**
 * Nhãn nhỏ dáng viên thuốc. Thay cho badge tự chế (hiện 50 file).
 *
 * Hai kiểu tô:
 *  - `soft`  — nền màu nhạt, chữ màu đậm. Mặc định; dùng cho nhãn thông tin.
 *  - `solid` — nền màu đặc, chữ trắng. Dùng khi cần hút mắt (§NGÔN NGỮ THIẾT KẾ mục 3).
 */

export type BadgeTone = 'brand' | 'brandSecondary' | 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const TONE: Record<BadgeTone, { soft: string; solid: string; text: string }> = {
  brand: { soft: color.brand[50], solid: color.brand.DEFAULT, text: color.brand.DEFAULT },
  brandSecondary: {
    soft: color.brandSecondary[50],
    solid: color.brandSecondary.DEFAULT,
    text: color.brandSecondary.DEFAULT,
  },
  accent: { soft: color.accent[50], solid: color.accent.DEFAULT, text: color.accent.hover },
  success: { soft: color.success[50], solid: color.success.DEFAULT, text: color.success.DEFAULT },
  danger: { soft: color.danger[50], solid: color.danger.DEFAULT, text: color.danger.DEFAULT },
  warning: { soft: color.warning[50], solid: color.warning.DEFAULT, text: color.warning.hover },
  info: { soft: color.info[50], solid: color.info.DEFAULT, text: color.info.DEFAULT },
  neutral: { soft: color.surface.muted, solid: color.content.description, text: color.content.description },
};

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  fill?: 'soft' | 'solid';
  /** Chấm tròn màu đứng trước nhãn — dùng cho trạng thái. */
  dot?: boolean;
  style?: ViewStyle;
}

const Badge: React.FC<BadgeProps> = ({ label, tone = 'neutral', fill = 'soft', dot, style }) => {
  const palette = TONE[tone];
  const solid = fill === 'solid';

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[6],
          alignSelf: 'flex-start',
          paddingHorizontal: space[10],
          paddingVertical: space[4],
          borderRadius: radius.full,
          backgroundColor: solid ? palette.solid : palette.soft,
        },
        style,
      ]}>
      {dot ? (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: radius.full,
            backgroundColor: solid ? color.content.inverse : palette.solid,
          }}
        />
      ) : null}
      <AppText
        variant="caption"
        numberOfLines={1}
        style={{ color: solid ? color.content.inverse : palette.text }}>
        {label}
      </AppText>
    </View>
  );
};

export default Badge;
