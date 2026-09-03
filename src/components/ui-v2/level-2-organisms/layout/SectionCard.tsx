import React from 'react';
import { View } from 'react-native';

import { AppText, Card, Icon, type IconSet } from '../../level-0-atoms';
import { color, radius, space } from '../../../../theme/tokens';

/**
 * Thẻ có tiêu đề — khối gom nội dung theo nhóm trong sheet và màn chi tiết.
 * Tiêu đề nhỏ, xám; nội dung mới là phần chính (§NGÔN NGỮ THIẾT KẾ mục 4).
 */

export interface SectionCardProps {
  title: string;
  /** Icon nhỏ trước tiêu đề, đặt trong ô bo tròn nền nhạt. */
  icon?: string;
  iconSet?: IconSet;
  /** Nội dung góc phải tiêu đề — vd nút "Xoá", số lượng đã chọn. */
  action?: React.ReactNode;
  children?: React.ReactNode;
  /** Bỏ nền thẻ — dùng khi section nằm sẵn trong một thẻ khác (vd trong sheet). */
  plain?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  icon,
  iconSet = 'auto',
  action,
  children,
  plain = false,
}) => {
  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[8],
        marginBottom: space[12],
      }}>
      {icon ? (
        <View
          style={{
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius[8],
            backgroundColor: color.brand[50],
          }}>
          <Icon name={icon} set={iconSet} size={16} tone="brand" />
        </View>
      ) : null}
      <AppText variant="headline" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </AppText>
      {action}
    </View>
  );

  if (plain) {
    return (
      <View>
        {header}
        {children}
      </View>
    );
  }

  return (
    <Card>
      {header}
      {children}
    </Card>
  );
};

export default SectionCard;
