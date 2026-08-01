/**
 * Toast gọn nằm ngay trong màn (không phải Alert hệ thống) rồi tự tắt. Dùng cho
 * phản hồi nhẹ như "Đã sao chép" / "Đã lưu ảnh".
 *
 * Hai kiểu đặt:
 * - mặc định: chèn vào luồng layout (ví dụ ngay trên thanh soạn tin).
 * - `floating`: nổi tuyệt đối ở đáy — dùng trong lightbox/modal toàn màn hình,
 *   nơi không có chỗ chèn hợp lý.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

export type InlineToastType = 'success' | 'error' | 'info';

const ICON: Record<InlineToastType, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { name: 'checkmark-circle', color: '#16a34a' },
  error: { name: 'close-circle', color: '#dc2626' },
  info: { name: 'information-circle', color: '#0284c7' },
};

export type InlineToastState = { id: number; message: string; type: InlineToastType };

/**
 * State + hàm bắn toast. `id` tăng dần để bấm liên tiếp vẫn chạy lại animation
 * (dùng làm `key` cho `InlineToast`).
 */
export function useInlineToast() {
  const [toast, setToast] = useState<InlineToastState | null>(null);
  const showToast = useCallback((message: string, type: InlineToastType = 'success') => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message, type }));
  }, []);
  const hideToast = useCallback(() => setToast(null), []);
  return { toast, showToast, hideToast };
}

export function InlineToast({
  message,
  type = 'success',
  duration = 1800,
  floating = false,
  bottomOffset = 32,
  onHide,
}: {
  /** Nội dung; component chỉ nên render khi có message (parent gate). */
  message: string;
  type?: InlineToastType;
  duration?: number;
  /** Nổi tuyệt đối ở đáy màn/modal thay vì chèn vào luồng layout. */
  floating?: boolean;
  /** Khoảng cách tới đáy khi `floating` (nhớ cộng safe-area nếu cần). */
  bottomOffset?: number;
  onHide: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  // Giữ callback mới nhất để đổi message không làm chạy lại animation.
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => onHideRef.current());
    }, duration);

    return () => clearTimeout(timer);
  }, [anim, duration, message]);

  const icon = ICON[type];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        },
        floating
          ? { position: 'absolute', left: 0, right: 0, bottom: bottomOffset, zIndex: 30 }
          : null,
      ]}
      className="items-center px-5 pb-2">
      <View className="max-w-full flex-row items-center gap-2 rounded-full bg-[#111827]/90 px-4 py-2">
        <Ionicons name={icon.name} size={16} color={icon.color} />
        <Text numberOfLines={2} className="font-mulish-semibold text-sm text-white">
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

export default InlineToast;
