/**
 * Ref điều hướng gốc dùng chung — để tầng ngoài React tree (CampusContext, push
 * notification…) điều hướng được mà không cần prop drilling từ App.tsx.
 */
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';
import { ROUTES } from '../constants/routes';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Đưa cả app về Trang chủ với stack MỚI — mọi màn đang mở bị gỡ và nạp lại từ đầu.
 * Tương đương `window.location.reload()` mà web admin làm sau khi đổi campus: state cũ
 * (danh sách lớp, ticket, điểm danh…) thuộc campus cũ không được phép sống sót.
 */
export const resetToHome = (): boolean => {
  if (!navigationRef.isReady()) return false;
  try {
    navigationRef.reset({
      index: 0,
      routes: [
        {
          name: ROUTES.SCREENS.MAIN as never,
          params: { screen: ROUTES.MAIN.HOME } as never,
        },
      ],
    });
    return true;
  } catch (e) {
    console.warn('[navigationRef] resetToHome lỗi:', e);
    return false;
  }
};
