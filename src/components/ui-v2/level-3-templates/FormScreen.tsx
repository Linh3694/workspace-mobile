import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, type AppHeaderProps } from '../level-2-organisms';
import { color, layout, space } from '../../../theme/tokens';

/**
 * Khuôn màn biểu mẫu: safe-area · header · nội dung cuộn · thanh nút dính đáy.
 *
 * VÌ SAO BIỂU MẪU DÀI LÀ TRANG CHỨ KHÔNG PHẢI SHEET
 *
 * Sheet hợp với việc chọn nhanh vài lựa chọn. Biểu mẫu nhiều ô nhập thì không:
 *  - Bàn phím bật lên nuốt ~40% màn; sheet vốn đã chỉ cao 85% nên chỗ còn lại
 *    không đủ để vừa thấy ô đang gõ vừa thấy nút gửi.
 *  - Cuộn dài bên trong sheet đánh nhau với cử chỉ kéo-xuống-để-đóng của chính nó.
 *  - Lỡ tay vuốt xuống hoặc chạm nền là mất trắng biểu mẫu đang điền dở.
 *
 * Trang thì có đủ chiều cao, có nút đóng rõ ràng, và vuốt-để-quay-lại là cử chỉ
 * người dùng đã quen.
 *
 * Template gánh hộ `KeyboardAvoidingView` + safe-area — hiện 23 file tự xoay xở
 * với bàn phím, mỗi file một kiểu.
 */

export interface FormScreenProps {
  header: AppHeaderProps;
  children: React.ReactNode;
  /** Thanh nút dính đáy — không cuộn theo nội dung. */
  footer?: React.ReactNode;
  /** Sheet/modal của màn (vd chọn ngày). Đặt ở đây để chúng luôn là anh em ruột. */
  overlays?: React.ReactNode;
}

const FormScreen: React.FC<FormScreenProps> = ({ header, children, footer, overlays }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: color.surface.page, paddingTop: insets.top }}>
      <AppHeader {...header} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // Bù phần header đã chiếm, nếu không nội dung bị đẩy quá tay trên iOS.
        keyboardVerticalOffset={insets.top + 56}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: layout.screenPadding,
            paddingBottom: space[32],
            gap: space[16],
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>

        {footer ? (
          <View
            style={{
              flexDirection: 'row',
              gap: space[12],
              paddingHorizontal: layout.screenPadding,
              paddingTop: space[12],
              paddingBottom: insets.bottom + space[12],
              borderTopWidth: 1,
              borderTopColor: color.line.subtle,
              backgroundColor: color.surface.DEFAULT,
            }}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {overlays}
    </View>
  );
};

export default FormScreen;
