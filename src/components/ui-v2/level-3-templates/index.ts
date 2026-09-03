/**
 * L3 — TEMPLATES
 *
 * Khuôn nguyên màn hình. Gánh hộ màn những thứ mobile bắt buộc phải đúng mà dễ
 * làm sai: safe-area, thứ tự lớp nổi, chỗ đặt overlay.
 *
 * Được import từ mọi level thấp hơn. Không level nào được import ngược lên đây.
 */

export { default as ListScreen, SCREEN_PADDING } from './ListScreen';
export type { ListScreenProps } from './ListScreen';
export { default as FormScreen } from './FormScreen';
export type { FormScreenProps } from './FormScreen';
