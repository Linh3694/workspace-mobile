import React from 'react';
import { View } from 'react-native';

import { AppText, Icon, ButtonGhost, type IconSet } from '../../level-0-atoms';
import { color, radius, space } from '../../../../theme/tokens';

/**
 * Trạng thái rỗng. Hiện **32 file** tự viết chuỗi "Không có dữ liệu…" theo kiểu
 * riêng, phần lớn chỉ có mỗi dòng chữ xám — không nói người dùng nên làm gì tiếp.
 *
 * Ở đây gói thành một khuôn có chỗ cho hành động, để trạng thái rỗng luôn là một
 * lối ra chứ không phải ngõ cụt.
 */

export interface EmptyStateProps {
  /** Icon trong ô tròn nền nhạt (§NGÔN NGỮ THIẾT KẾ mục 6). */
  icon?: string;
  iconSet?: IconSet;
  title: string;
  description?: string;
  /** Hành động gợi ý — vd "Thử lại", "Xoá bộ lọc". */
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'folder',
  iconSet = 'auto',
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <View
    style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: space[48],
      paddingHorizontal: space[24],
      gap: space[12],
    }}>
    <View
      style={{
        width: 72,
        height: 72,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.full,
        backgroundColor: color.surface.muted,
      }}>
      <Icon name={icon} set={iconSet} size={32} tone="disabled" />
    </View>

    <AppText variant="title3" align="center">
      {title}
    </AppText>

    {description ? (
      <AppText variant="footnote" tone="description" align="center">
        {description}
      </AppText>
    ) : null}

    {actionLabel && onAction ? (
      <ButtonGhost label={actionLabel} onPress={onAction} style={{ marginTop: space[4] }} />
    ) : null}
  </View>
);

export default EmptyState;
