import React from 'react';
import { TouchableOpacity, View } from 'react-native';

import { AppText, Icon } from '../../level-0-atoms';
import { color, radius, space } from '../../../../theme/tokens';

/**
 * Chip chọn NHIỀU — dùng trong sheet bộ lọc, khác `FilterChipRow` (chọn MỘT,
 * cuộn ngang, luôn hiển thị). Chip này xuống dòng tự do trong một khối.
 */
export interface SelectableChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: 'brand' | 'brandSecondary';
}

export const SelectableChip: React.FC<SelectableChipProps> = ({
  label,
  selected,
  onPress,
  tone = 'brandSecondary',
}) => {
  const activeBg = tone === 'brand' ? color.brand.DEFAULT : color.brandSecondary.DEFAULT;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: space[16],
        borderRadius: radius.full,
        backgroundColor: selected ? activeBg : color.surface.subtle,
      }}>
      <AppText
        variant="footnote"
        style={{ color: selected ? color.content.inverse : color.content.normal }}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
};

/**
 * Hàng có ô tick — dùng khi danh sách dài và nhãn có thể dài (vd phòng ban),
 * lúc đó chip xuống dòng trông rối hơn là một cột tick.
 */
export interface CheckRowProps {
  label: string;
  checked: boolean;
  onPress: () => void;
}

export const CheckRow: React.FC<CheckRowProps> = ({ label, checked, onPress }) => (
  <TouchableOpacity
    accessibilityRole="checkbox"
    accessibilityState={{ checked }}
    onPress={onPress}
    activeOpacity={0.6}
    style={{
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[12],
    }}>
    <View
      style={{
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius[6],
        borderWidth: checked ? 0 : 1.5,
        borderColor: color.line.DEFAULT,
        backgroundColor: checked ? color.brand.DEFAULT : 'transparent',
      }}>
      {checked ? <Icon name="check" size={14} tone="inverse" /> : null}
    </View>
    <AppText variant="body" style={{ flex: 1 }} numberOfLines={2}>
      {label}
    </AppText>
  </TouchableOpacity>
);

export default SelectableChip;
