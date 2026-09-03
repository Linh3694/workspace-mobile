import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconSet } from '../../level-0-atoms';
import { color, elevation, layout, radius, space } from '../../../../theme/tokens';

/**
 * Nút nổi hành động chính, neo góc phải dưới.
 *
 * Đây là một trong số ít vật ĐƯỢC PHÉP đổ bóng — nó thật sự bay trên nội dung
 * đang cuộn phía dưới (§NGÔN NGỮ THIẾT KẾ mục 1).
 *
 * Tự cộng safe-area đáy để không đè lên thanh home indicator của iPhone. Danh sách
 * phía dưới nhớ truyền `bottomInset={FAB_CLEARANCE}` cho `RefreshableList`, nếu
 * không mục cuối sẽ bị nút che.
 */

/** Chiều cao cần chừa dưới đáy danh sách để FAB không che mục cuối. */
export const FAB_CLEARANCE = 80;

export interface FabProps {
  icon?: string;
  iconSet?: IconSet;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'brand' | 'brandSecondary';
}

const Fab: React.FC<FabProps> = ({
  icon = 'plus',
  iconSet = 'auto',
  onPress,
  accessibilityLabel,
  tone = 'brand',
}) => {
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        {
          position: 'absolute',
          right: layout.screenPadding,
          bottom: insets.bottom + space[16],
          width: 56,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.full,
          backgroundColor: tone === 'brand' ? color.brand.DEFAULT : color.brandSecondary.DEFAULT,
        },
        elevation.floating,
      ]}>
      <Icon name={icon} set={iconSet} size={26} tone="inverse" />
    </TouchableOpacity>
  );
};

export default Fab;
