import React from 'react';
import { View } from 'react-native';

import { AppText, IconButton } from '../../level-0-atoms';
import { layout, space } from '../../../../theme/tokens';

/**
 * Thanh tiêu đề màn hình.
 *
 * Khác web: không có breadcrumb (không đủ chỗ) — điều hướng lên một cấp là nút
 * back bên trái. Hai bên giữ chiều rộng cố định để tiêu đề căn giữa THẬT SỰ, kể
 * cả khi chỉ có nút một bên.
 *
 * Không tự xử lý safe-area — việc đó do template L3 làm, để header còn dùng được
 * bên trong sheet hoặc tab.
 */

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /**
   * Icon nút trái. `chevron-left` cho màn đẩy ngang (mặc định); `close` cho màn
   * trình bày kiểu modal — người dùng đọc dấu X là "huỷ việc đang làm", còn mũi
   * tên là "quay lại chỗ cũ".
   */
  backIcon?: string;
  /** Nút/nội dung góc phải. */
  action?: React.ReactNode;
  /** Căn trái thay vì giữa — dùng cho màn gốc của tab (không có nút back). */
  align?: 'center' | 'left';
}

const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backIcon = 'chevron-left',
  action,
  align = 'center',
}) => {
  const centered = align === 'center';

  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space[8],
        paddingVertical: space[4],
      }}>
      <View style={{ width: layout.minTouch, alignItems: 'flex-start' }}>
        {onBack ? (
          <IconButton
            name={backIcon}
            size={backIcon === 'close' ? 22 : 26}
            accessibilityLabel={backIcon === 'close' ? 'Đóng' : 'Quay lại'}
            onPress={onBack}
          />
        ) : null}
      </View>

      <View
        style={{
          flex: 1,
          alignItems: centered ? 'center' : 'flex-start',
          paddingHorizontal: space[4],
        }}>
        <AppText variant="title3" numberOfLines={1} align={centered ? 'center' : 'left'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="description" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      <View style={{ minWidth: layout.minTouch, alignItems: 'flex-end' }}>{action}</View>
    </View>
  );
};

export default AppHeader;
