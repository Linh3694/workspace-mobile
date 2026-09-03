import React from 'react';
import { View } from 'react-native';

import BottomSheetModal from '../../../Common/BottomSheetModal';
import { AppText, IconButton, Divider } from '../../level-0-atoms';
import { color, layout, radius, space } from '../../../../theme/tokens';

/**
 * Sheet trượt từ đáy — dạng overlay chuẩn của ui-v2.
 *
 * ⚠️ VÌ SAO ĐÂY LÀ ORGANISM CHỨ KHÔNG PHẢI WRAPPER MỎNG
 *
 * Trên iOS, mở `Modal` thứ hai trong khi `Modal` thứ nhất chưa tháo xong sẽ **treo
 * app** — màn hình xám, không bấm được gì, phải kill app. Android không tái hiện
 * được, nên lỗi này lọt qua mọi vòng test không chạy trên iOS.
 *
 * Hai cách hợp lệ, và chỉ hai cách:
 *
 *   1. Sheet con nằm BÊN TRONG cây con của sheet cha (cùng một `Modal`).
 *   2. Đóng sheet cha, CHỜ `onClosed`, rồi mới mở sheet kế → dùng `useSheetQueue`.
 *
 * Đừng bao giờ `setShowA(false); setShowB(true);` trong cùng một handler.
 *
 * Bố cục: header cố định · body cuộn được · footer cố định.
 */

export interface AppSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Nội dung góc phải header — vd nút "Đặt lại". */
  headerAction?: React.ReactNode;
  /** Khối nút cố định dưới đáy sheet. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /** % chiều cao màn hình tối đa. */
  maxHeightPercent?: number;
  /** Sheet có ô nhập → thu nhỏ khi bàn phím hiện. */
  keyboardAvoiding?: boolean;
  /** Gọi sau khi animation đóng chạy xong. Bắt buộc dùng khi cần mở sheet kế tiếp. */
  onClosed?: () => void;
}

const AppSheet: React.FC<AppSheetProps> = ({
  visible,
  onClose,
  title,
  headerAction,
  footer,
  children,
  maxHeightPercent = 85,
  keyboardAvoiding = true,
  onClosed,
}) => (
  <BottomSheetModal
    visible={visible}
    onClose={onClose}
    onClosed={onClosed}
    maxHeightPercent={maxHeightPercent}
    keyboardAvoiding={keyboardAvoiding}
    bottomPaddingExtra={space[8]}>
    {/* Tay nắm — dấu hiệu thị giác cho biết kéo xuống đóng được */}
    <View style={{ alignItems: 'center', paddingTop: space[8], paddingBottom: space[4] }}>
      <View
        style={{
          width: 36,
          height: 4,
          borderRadius: radius.full,
          backgroundColor: color.line.DEFAULT,
        }}
      />
    </View>

    {title ? (
      <>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[8],
            paddingHorizontal: layout.screenPadding,
            paddingVertical: space[8],
          }}>
          <AppText variant="title3" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </AppText>
          {headerAction}
          <IconButton name="close" size={22} tone="description" accessibilityLabel="Đóng" onPress={onClose} />
        </View>
        <Divider spacing={0} />
      </>
    ) : null}

    <View style={{ flexShrink: 1 }}>{children}</View>

    {footer ? (
      <>
        <Divider spacing={0} />
        <View style={{ padding: layout.screenPadding, gap: space[10] }}>{footer}</View>
      </>
    ) : null}
  </BottomSheetModal>
);

export default AppSheet;
