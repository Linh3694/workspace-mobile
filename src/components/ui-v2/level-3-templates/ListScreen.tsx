import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, type AppHeaderProps } from '../level-2-organisms';
import { color, layout, space } from '../../../theme/tokens';

/**
 * Khuôn màn danh sách: safe-area · header · vùng lọc · danh sách · lớp nổi.
 *
 * Khác web: template gánh SAFE-AREA hộ màn hình. Hiện `SafeAreaView` xuất hiện ở
 * 41 file, mỗi file tự quyết định chừa trên hay chừa dưới, chừa bao nhiêu — nên
 * cùng một app mà mỗi màn cách đỉnh một khác. Gom vào đây để chỉ còn một cách làm.
 *
 * Nền là `surface.page` (xám nhạt) — thẻ trắng bên trong mới nổi lên được
 * (§NGÔN NGỮ THIẾT KẾ mục 1).
 *
 * @example
 * <ListScreen
 *   header={{ title: 'Quản lý thiết bị', onBack: () => navigation.goBack() }}
 *   toolbar={<SearchBar … />}
 *   floating={<Fab … />}
 *   overlays={<AppSheet … />}
 * >
 *   <RefreshableList … />
 * </ListScreen>
 */

export interface ListScreenProps {
  header: AppHeaderProps;
  /** Vùng dính dưới header: ô tìm kiếm, dải chip lọc, băng lỗi. Không cuộn theo danh sách. */
  toolbar?: React.ReactNode;
  /** Danh sách — thường là `<RefreshableList/>`. Chiếm hết chỗ còn lại. */
  children: React.ReactNode;
  /** Lớp nổi tuyệt đối: FAB, thanh hành động đáy. */
  floating?: React.ReactNode;
  /**
   * Sheet/modal của màn. Đặt ở đây để chúng luôn là anh em ruột — không sheet nào
   * lồng trong cây con của sheet khác (xem `AppSheet`).
   */
  overlays?: React.ReactNode;
}

const ListScreen: React.FC<ListScreenProps> = ({
  header,
  toolbar,
  children,
  floating,
  overlays,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: color.surface.page, paddingTop: insets.top }}>
      <AppHeader {...header} />

      {toolbar ? (
        <View style={{ paddingBottom: space[10], gap: space[10] }}>{toolbar}</View>
      ) : null}

      <View style={{ flex: 1 }}>{children}</View>

      {floating}
      {overlays}
    </View>
  );
};

/** Lề ngang chuẩn — dùng cho nội dung trong `toolbar` để thẳng hàng với danh sách. */
export const SCREEN_PADDING = layout.screenPadding;

export default ListScreen;
