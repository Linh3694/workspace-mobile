import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ROUTES } from '../constants/routes';

/**
 * Công tắc so sánh V1 ↔ V2 trong lúc dựng ui-v2.
 *
 * Trước đây là hằng số biên dịch (đổi `true`/`false` rồi reload app). Giờ là cờ
 * chạy thật, bật/tắt ngay trong màn Hồ sơ — nhưng CHỈ quản trị hệ thống mới thấy
 * nút đó, xem `canSwitchUiVersion`. Người dùng thường luôn ở V1 cho tới khi V2
 * được duyệt.
 *
 * Khi bản V2 được duyệt: cho điểm vào trỏ thẳng V2, xoá file V1, xoá cả file này
 * và hàng công tắc trong `ProfileScreen`.
 */

/** Mặc định của MỌI người: giao diện cũ. V2 là bản xem trước, phải tự bật. */
const DEFAULT_ENABLED = false;

const STORAGE_KEY = 'uiV2Enabled';

/** Vai trò được phép đổi giao diện. Khớp cách gọi tên vai trò của Frappe. */
const UI_SWITCH_ROLES = ['System Manager'] as const;

let enabled: boolean = DEFAULT_ENABLED;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const setEnabled = (next: boolean) => {
  if (next === enabled) return;
  enabled = next;
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Nạp cờ đã lưu — chạy một lần lúc import.
 *
 * Không cần chờ ở đâu cả: `devicesRoute()` chỉ được gọi khi người dùng bấm vào ô
 * Thiết bị (sau splash ~2,9s), còn hàng công tắc trong Hồ sơ vẽ lại qua
 * `useUiV2Enabled` ngay khi AsyncStorage trả lời.
 */
export const uiV2Hydrated: Promise<void> = (async () => {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved !== null) setEnabled(saved === 'true');
  } catch (error) {
    console.warn('[uiV2] không đọc được cờ giao diện, giữ mặc định:', error);
  }
})();

/** Người dùng này có được thấy nút đổi giao diện không. */
export function canSwitchUiVersion(roles?: unknown): boolean {
  if (!Array.isArray(roles)) return false;
  return UI_SWITCH_ROLES.some((role) => roles.includes(role));
}

/** Trạng thái công tắc, đọc được ngoài React (dùng trong handler điều hướng). */
export const isUiV2Enabled = (): boolean => enabled;

/**
 * Cờ CÓ hiệu lực hay không — luôn kiểm cả vai trò, không chỉ công tắc.
 *
 * Cờ lưu theo MÁY chứ không theo người: máy dùng chung, admin bật V2 rồi đăng
 * xuất thì người sau vẫn phải thấy V1. Mọi điểm vào V2 phải đi qua hàm này.
 */
export const isUiV2Active = (roles?: unknown): boolean =>
  isUiV2Enabled() && canSwitchUiVersion(roles);

export async function setUiV2Enabled(next: boolean): Promise<void> {
  setEnabled(next);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(next));
  } catch (error) {
    console.warn('[uiV2] không lưu được cờ giao diện:', error);
  }
}

/** Cờ giao diện dạng React state — component tự vẽ lại khi công tắc đổi. */
export const useUiV2Enabled = (): boolean =>
  useSyncExternalStore(subscribe, isUiV2Enabled, isUiV2Enabled);

/** Điểm vào màn Thiết bị — trỏ V1 hay V2 tuỳ công tắc + vai trò ở trên. */
export const devicesRoute = (roles?: unknown) =>
  isUiV2Active(roles) ? ROUTES.SCREENS.DEVICES_V2 : ROUTES.SCREENS.DEVICES;
