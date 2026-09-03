import { useCallback, useRef, useState } from 'react';

/**
 * Điều phối nhiều sheet trên cùng một màn hình sao cho **không bao giờ có hai
 * `Modal` cùng sống một lúc** — điều kiện bắt buộc để app không treo trên iOS
 * (xem phần đầu `AppSheet.tsx`).
 *
 * Cách dùng: màn hình khai báo tên các sheet, hook giữ đúng một cái đang mở.
 * Khi đang mở A mà gọi `open('B')`, hook đóng A trước, chờ `onClosed` của A rồi
 * mới mở B — thay vì mở chồng lên nhau.
 *
 * @example
 * const sheet = useSheetQueue<'filter' | 'create'>();
 *
 * <ButtonGhost label="Lọc" onPress={() => sheet.open('filter')} />
 *
 * <AppSheet
 *   visible={sheet.isOpen('filter')}
 *   onClose={sheet.close}
 *   onClosed={sheet.handleClosed}   // ← BẮT BUỘC, nếu thiếu thì sheet kế không mở
 * />
 */
export interface SheetQueue<T extends string> {
  /** Sheet đang mở, `null` nếu không có. */
  current: T | null;
  isOpen: (name: T) => boolean;
  /** Mở sheet. Nếu đang có sheet khác thì xếp hàng chờ sheet đó đóng xong. */
  open: (name: T) => void;
  /** Đóng sheet đang mở. */
  close: () => void;
  /**
   * Nối vào prop `onClosed` của MỌI `AppSheet` trên màn. Đây là tín hiệu cho hook
   * biết `Modal` đã tháo xong và an toàn để mở cái tiếp theo.
   */
  handleClosed: () => void;
}

export function useSheetQueue<T extends string>(): SheetQueue<T> {
  const [current, setCurrent] = useState<T | null>(null);
  const pendingRef = useRef<T | null>(null);

  const open = useCallback((name: T) => {
    setCurrent((active) => {
      if (active === null || active === name) return name;
      // Đang mở sheet khác: xếp hàng, đóng cái hiện tại trước.
      pendingRef.current = name;
      return null;
    });
  }, []);

  const close = useCallback(() => {
    pendingRef.current = null;
    setCurrent(null);
  }, []);

  const handleClosed = useCallback(() => {
    const next = pendingRef.current;
    if (next) {
      pendingRef.current = null;
      setCurrent(next);
    }
  }, []);

  const isOpen = useCallback((name: T) => current === name, [current]);

  return { current, isOpen, open, close, handleClosed };
}

export default useSheetQueue;
