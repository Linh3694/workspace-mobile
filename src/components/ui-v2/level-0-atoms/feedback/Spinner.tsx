import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { color, space } from '../../../../theme/tokens';
import AppText from '../text/AppText';

/**
 * Vòng quay chờ. Thay cho `ActivityIndicator` gọi thẳng (hiện 99 chỗ trong 111 file,
 * mỗi chỗ tự chọn màu — nên màu spinner nằm ngoài tầm token).
 */

export interface SpinnerProps {
  size?: 'small' | 'large';
  tone?: 'brand' | 'brandSecondary' | 'inverse';
  /** Chữ dưới vòng quay. Bỏ trống thì chỉ hiện vòng quay. */
  label?: string;
  /** Căn giữa và chừa khoảng trên dưới — dùng khi spinner đứng một mình. */
  padded?: boolean;
}

const TONE_COLOR = {
  brand: color.brand.DEFAULT,
  brandSecondary: color.brandSecondary.DEFAULT,
  inverse: color.content.inverse,
} as const;

const Spinner: React.FC<SpinnerProps> = ({ size = 'small', tone = 'brand', label, padded }) => (
  <View
    style={{
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: padded ? space[24] : 0,
      gap: space[8],
    }}>
    <ActivityIndicator size={size} color={TONE_COLOR[tone]} />
    {label ? (
      <AppText variant="footnote" tone="description">
        {label}
      </AppText>
    ) : null}
  </View>
);

export default Spinner;
