import React from 'react';
import { View } from 'react-native';

import { AppText, Icon, IconButton } from '../../level-0-atoms';
import { color, radius, space } from '../../../../theme/tokens';

/**
 * Băng thông báo nằm trong luồng nội dung (không phải toast nổi).
 * Dùng cho lỗi tải dữ liệu, cảnh báo — thứ người dùng cần thấy cho đến khi xử lý xong.
 */

export type InlineAlertTone = 'danger' | 'warning' | 'info' | 'success';

const TONE = {
  danger: { bg: color.danger[50], fg: color.danger.DEFAULT, icon: 'alert-circle' },
  warning: { bg: color.warning[50], fg: color.warning.hover, icon: 'warning' },
  info: { bg: color.info[50], fg: color.info.DEFAULT, icon: 'information-circle' },
  success: { bg: color.success[50], fg: color.success.DEFAULT, icon: 'checkmark-circle' },
} as const;

export interface InlineAlertProps {
  message: string;
  tone?: InlineAlertTone;
  /** Có truyền thì hiện nút đóng. */
  onDismiss?: () => void;
}

const InlineAlert: React.FC<InlineAlertProps> = ({ message, tone = 'danger', onDismiss }) => {
  const palette = TONE[tone];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[10],
        padding: space[12],
        paddingRight: onDismiss ? space[4] : space[12],
        borderRadius: radius[14],
        backgroundColor: palette.bg,
      }}>
      <Icon name={palette.icon} size={20} colorOverride={palette.fg} />
      <AppText variant="footnote" style={{ flex: 1, color: palette.fg }}>
        {message}
      </AppText>
      {onDismiss ? (
        <IconButton
          name="close"
          size={18}
          accessibilityLabel="Đóng thông báo"
          onPress={onDismiss}
          tone="description"
          style={{ width: 32, height: 32 }}
        />
      ) : null}
    </View>
  );
};

export default InlineAlert;
