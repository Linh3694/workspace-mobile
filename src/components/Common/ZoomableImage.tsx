/**
 * Khung xem ảnh phóng to được — chụm hai ngón, kéo khi đã phóng, nhấn đúp bật/tắt.
 *
 * VÌ SAO KHÔNG DÙNG ScrollView. `maximumZoomScale` / `minimumZoomScale` /
 * `pinchGestureEnabled` của ScrollView là prop **chỉ chạy trên iOS** — trên Android
 * không phóng được dòng nào. Nặng hơn: hễ đặt `scrollEnabled={false}` để nhường
 * thao tác vuốt-đóng cho màn cha thì UIScrollView ngừng nhận chạm, pinch chết theo,
 * nên cờ "đang phóng" không bao giờ bật lên được và zoom kẹt vĩnh viễn ở 1x.
 *
 * Component nhận CHÍNH thẻ ảnh của màn gọi làm `children` — mỗi màn nạp ảnh một
 * kiểu (expo-image, Image của RN, có/không header xác thực), ở đây chỉ lo phần
 * biến đổi hình học.
 *
 * Màn cha phải khoá thao tác của mình khi `onZoomChange(true)`: vuốt ngang đổi
 * ảnh và vuốt dọc đóng đều tranh chạm với thao tác kéo ảnh đang phóng.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Trên mức này coi như "đang phóng" — chừa sai số của phép nhân dấu phẩy động. */
const ZOOMED_EPSILON = 1.01;
const RESET_DURATION = 180;
/** Cho co nhẹ dưới 1x trong lúc chụm để có phản hồi tay, nhả ra là bật về 1x. */
const PINCH_UNDERSHOOT = 0.85;

export type ZoomableImageProps = {
  /**
   * Kích thước khung (pt) — dùng để chặn biên khi kéo. Bỏ trống thì khung tự
   * chiếm hết chỗ cha cho (`flex: 1`) và tự đo bằng `onLayout`; truyền tay chỉ
   * khi màn cha đã biết sẵn số đo (vd trang trong lightbox vuốt ngang).
   */
  width?: number;
  height?: number;
  children: React.ReactNode;
  /** Báo màn cha biết đang phóng, để khoá vuốt đổi ảnh / vuốt đóng. */
  onZoomChange?: (zoomed: boolean) => void;
  /** Đổi giá trị này thì ảnh về 1x — dùng khi chuyển trang hoặc đóng lightbox. */
  resetKey?: string | number;
  /** Mức phóng tối đa. */
  maxScale?: number;
  /** Mức phóng khi nhấn đúp. */
  doubleTapScale?: number;
  style?: StyleProp<ViewStyle>;
};

export default function ZoomableImage({
  width,
  height,
  children,
  onZoomChange,
  resetKey,
  maxScale = 4,
  doubleTapScale = 2.5,
  style,
}: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  /**
   * Khung thật để tính biên. Là shared value chứ không phải prop vì khi màn cha
   * không truyền số đo, giá trị chỉ có sau `onLayout` — mà worklet đã bắt đầu
   * chạy từ trước đó.
   */
  const frameW = useSharedValue(width ?? 0);
  const frameH = useSharedValue(height ?? 0);

  useEffect(() => {
    if (width) frameW.value = width;
    if (height) frameH.value = height;
  }, [frameH, frameW, height, width]);
  /**
   * Bật/tắt thao tác kéo bằng state React chứ không bằng shared value: chưa phóng
   * thì gesture kéo phải TẮT HẲN, nếu không nó nuốt mất thao tác vuốt-đóng của
   * màn cha ngay từ ngón đầu tiên.
   */
  const [zoomed, setZoomed] = useState(false);

  const emitZoom = useCallback(
    (next: boolean) => {
      setZoomed(next);
      onZoomChange?.(next);
    },
    [onZoomChange],
  );

  useAnimatedReaction(
    () => scale.value > ZOOMED_EPSILON,
    (isZoomed, wasZoomed) => {
      if (isZoomed !== wasZoomed) runOnJS(emitZoom)(isZoomed);
    },
    [emitZoom],
  );

  /** Đưa về khít khung. Gọi được từ cả luồng JS lẫn luồng UI. */
  const resetTransform = useCallback(() => {
    'worklet';
    scale.value = withTiming(1, { duration: RESET_DURATION });
    translateX.value = withTiming(0, { duration: RESET_DURATION });
    translateY.value = withTiming(0, { duration: RESET_DURATION });
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY]);

  useEffect(() => {
    resetTransform();
  }, [resetTransform, resetKey]);

  /** Biên kéo tối đa theo mỗi trục — phần ảnh tràn ra ngoài khung, chia đôi. */
  const clampTranslate = useCallback(
    (x: number, y: number, s: number) => {
      'worklet';
      const w = frameW.value;
      const h = frameH.value;
      const maxX = Math.max(0, (w * s - w) / 2);
      const maxY = Math.max(0, (h * s - h) / 2);
      return {
        x: Math.min(Math.max(x, -maxX), maxX),
        y: Math.min(Math.max(y, -maxY), maxY),
      };
    },
    [frameH, frameW],
  );

  /**
   * Phóng quanh một điểm: giữ nguyên điểm ảnh đang nằm dưới ngón tay.
   * Lấy tâm khung làm gốc, f = điểm chạm lệch tâm, k = tỉ lệ phóng thêm:
   *   t' = f·(1 − k) + t·k
   */
  const zoomAround = useCallback(
    (focalX: number, focalY: number, nextScale: number) => {
      'worklet';
      const k = nextScale / scale.value;
      const fx = focalX - frameW.value / 2;
      const fy = focalY - frameH.value / 2;
      return clampTranslate(
        fx * (1 - k) + translateX.value * k,
        fy * (1 - k) + translateY.value * k,
        nextScale,
      );
    },
    [clampTranslate, frameH, frameW, scale, translateX, translateY],
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          savedScale.value = scale.value;
        })
        .onUpdate((event) => {
          const next = Math.min(
            Math.max(savedScale.value * event.scale, PINCH_UNDERSHOOT),
            maxScale,
          );
          const moved = zoomAround(event.focalX, event.focalY, next);
          scale.value = next;
          translateX.value = moved.x;
          translateY.value = moved.y;
        })
        .onEnd(() => {
          if (scale.value <= 1) {
            resetTransform();
            return;
          }
          savedScale.value = scale.value;
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        }),
    [
      maxScale,
      resetTransform,
      savedScale,
      savedTranslateX,
      savedTranslateY,
      scale,
      translateX,
      translateY,
      zoomAround,
    ],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(zoomed)
        .maxPointers(2)
        .onStart(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        })
        .onUpdate((event) => {
          const moved = clampTranslate(
            savedTranslateX.value + event.translationX,
            savedTranslateY.value + event.translationY,
            scale.value,
          );
          translateX.value = moved.x;
          translateY.value = moved.y;
        })
        .onEnd(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        }),
    [clampTranslate, savedTranslateX, savedTranslateY, scale, translateX, translateY, zoomed],
  );

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        // Khoảng nghỉ giữa hai cú chạm. Mặc định của thư viện là 200ms — chặt hơn
        // ngưỡng nhấn đúp của hệ điều hành (~300ms), nên nhiều người bấm đúng mà
        // vẫn không ăn. KHÔNG đụng `maxDuration`: đó là thời gian giữ MỖI cú chạm
        // (mặc định 500ms), siết lại chỉ làm khó bấm thêm.
        .maxDelay(300)
        // Mặc định Tap KHÔNG có giới hạn quãng đường, tức là dịch ngón bao nhiêu
        // cũng chưa hỏng — đặt trần để cú kéo hỏng ngay và nhường cho thao tác kéo.
        .maxDistance(24)
        .onEnd((event) => {
          if (scale.value > ZOOMED_EPSILON) {
            resetTransform();
            return;
          }
          const moved = zoomAround(event.x, event.y, doubleTapScale);
          scale.value = withTiming(doubleTapScale, { duration: RESET_DURATION });
          translateX.value = withTiming(moved.x, { duration: RESET_DURATION });
          translateY.value = withTiming(moved.y, { duration: RESET_DURATION });
          savedScale.value = doubleTapScale;
          savedTranslateX.value = moved.x;
          savedTranslateY.value = moved.y;
        }),
    [
      doubleTapScale,
      resetTransform,
      savedScale,
      savedTranslateX,
      savedTranslateY,
      scale,
      translateX,
      translateY,
      zoomAround,
    ],
  );

  /**
   * Race chứ KHÔNG phải Exclusive.
   *
   * `Gesture.Exclusive(doubleTap, …)` cài quan hệ `requireToFail`: chụm và kéo
   * phải CHỜ nhấn đúp hỏng mới được chạy. Mà Tap của gesture-handler mặc định
   * không hỏng vì dịch ngón — nó chỉ hỏng khi hết đồng hồ `maxDuration`. Kết quả
   * là mỗi lần chụm hai ngón đều bị treo vài trăm mili giây rồi ảnh mới nhúc nhích.
   *
   * Race thì thao tác nào nhận diện trước sẽ huỷ các thao tác còn lại: chụm hai
   * ngón thắng ngay khi ngón di chuyển, kéo thắng khi vượt ngưỡng trượt, còn nhấn
   * đúp thắng khi không có di chuyển nào — đúng thứ ta cần, và không ai phải chờ ai.
   */
  const gesture = useMemo(
    () => Gesture.Race(Gesture.Simultaneous(pinch, pan), doubleTap),
    [doubleTap, pan, pinch],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    // Ép kiểu là cần: mảng ba phần tử khác hình dạng bị TS suy thành union có
    // `translateY?: undefined`, mà kiểu transform của RN khai các khoá còn lại là
    // `never` — `undefined` không gán được cho `never` nên không khớp. Ép ở đây
    // chỉ là chuyện kiểu, không đổi gì lúc chạy.
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ] as ViewStyle['transform'],
  }));

  // Khung ngoài cắt ảnh và bắt chạm; khung trong mới mang phép biến đổi. Gộp làm
  // một thì vùng cắt phóng to theo ảnh nên chẳng cắt được gì, và toạ độ chạm
  // trả về cũng đã bị scale — sai tâm phóng.
  const boxStyle =
    width && height ? { width, height } : ({ flex: 1 } as const);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[boxStyle, { overflow: 'hidden' }, style]}
        onLayout={
          width && height
            ? undefined
            : (event) => {
                const { width: w, height: h } = event.nativeEvent.layout;
                frameW.value = w;
                frameH.value = h;
              }
        }>
        <Animated.View style={[boxStyle, animatedStyle]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}
