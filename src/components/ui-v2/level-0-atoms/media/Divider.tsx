import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { color, space } from '../../../../theme/tokens';

/** Đường kẻ mảnh ngăn cách. `StyleSheet.hairlineWidth` cho nét 1px thật trên mọi mật độ. */
export interface DividerProps {
  spacing?: number;
  style?: ViewStyle;
}

const Divider: React.FC<DividerProps> = ({ spacing = space[12], style }) => (
  <View
    style={[
      { height: 1, backgroundColor: color.line.subtle, marginVertical: spacing },
      style,
    ]}
  />
);

export default Divider;
