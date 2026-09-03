import React from 'react';
import { TouchableOpacity, View, type ViewStyle } from 'react-native';

import { color, radius, space } from '../../../../theme/tokens';

/**
 * Thẻ trắng nổi trên nền xám — đơn vị bố cục cơ bản của ngôn ngữ thiết kế
 * (§NGÔN NGỮ THIẾT KẾ mục 1 & 2).
 *
 * Cố ý KHÔNG đổ bóng: độ sâu đến từ tương phản `surface.page` ↔ `surface.DEFAULT`.
 * Vật cần bay lên trên nội dung thì dùng token `elevation`, không dùng thẻ.
 */

export interface CardProps {
  children?: React.ReactNode;
  /** Có `onPress` thì thẻ tự thành vùng bấm được, kèm phản hồi chạm. */
  onPress?: () => void;
  /** `subtle` cho thẻ lồng trong thẻ khác. */
  tone?: 'default' | 'subtle';
  padding?: number;
  style?: ViewStyle;
}

const Card: React.FC<CardProps> = ({
  children,
  onPress,
  tone = 'default',
  padding = space[16],
  style,
}) => {
  const base: ViewStyle = {
    backgroundColor: tone === 'subtle' ? color.surface.subtle : color.surface.DEFAULT,
    borderRadius: radius[20],
    padding,
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      onPress={onPress}
      style={[base, style]}>
      {children}
    </TouchableOpacity>
  );
};

export default Card;
