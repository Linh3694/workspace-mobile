import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import { AppText, Icon, type IconSet } from '../../level-0-atoms';
import { color, layout, radius, space } from '../../../../theme/tokens';

/**
 * Dải chip lọc cuộn ngang.
 *
 * Khác web: không có dropdown. Lựa chọn nằm phơi hết ra một dải cuộn ngang được —
 * người dùng thấy ngay có những gì mà không phải mở menu.
 *
 * Trạng thái đang chọn = TÔ ĐẶC (§NGÔN NGỮ THIẾT KẾ mục 3), không dùng viền.
 */

export interface FilterChipItem<T extends string = string> {
  value: T;
  label: string;
  /** Icon nhỏ trước nhãn. */
  icon?: string;
  iconSet?: IconSet;
  /** Con số phụ sau nhãn, vd số bản ghi. */
  count?: number;
}

export interface FilterChipRowProps<T extends string = string> {
  items: FilterChipItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Màu khi được chọn. */
  tone?: 'brand' | 'brandSecondary';
  /** Lề hai đầu dải cuộn. */
  edgePadding?: number;
}

function FilterChipRow<T extends string = string>({
  items,
  value,
  onChange,
  tone = 'brandSecondary',
  edgePadding = layout.screenPadding,
}: FilterChipRowProps<T>) {
  const activeBg = tone === 'brand' ? color.brand.DEFAULT : color.brandSecondary.DEFAULT;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: edgePadding, gap: space[8] }}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <TouchableOpacity
            key={item.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.value)}
            activeOpacity={0.7}
            style={{
              minHeight: 38,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[6],
              paddingHorizontal: space[16],
              borderRadius: radius.full,
              backgroundColor: active ? activeBg : color.surface.DEFAULT,
            }}>
            {item.icon ? (
              <Icon
                name={item.icon}
                set={item.iconSet ?? 'auto'}
                size={16}
                colorOverride={active ? color.content.inverse : color.content.description}
              />
            ) : null}

            <AppText
              variant="footnote"
              numberOfLines={1}
              style={{ color: active ? color.content.inverse : color.content.normal }}>
              {item.label}
            </AppText>

            {typeof item.count === 'number' ? (
              <View
                style={{
                  minWidth: 18,
                  paddingHorizontal: space[4],
                  borderRadius: radius.full,
                  alignItems: 'center',
                  backgroundColor: active ? color.overlay.onBrand : color.surface.muted,
                }}>
                <AppText
                  variant="caption"
                  style={{ color: active ? color.content.inverse : color.content.description }}>
                  {item.count}
                </AppText>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default FilterChipRow;
