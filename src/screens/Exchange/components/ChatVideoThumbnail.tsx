/**
 * Khung xem trước video trong Trao đổi (bubble, lưới Ảnh & Video).
 *
 * `Image` của React Native KHÔNG giải mã được file video nên trỏ `<Image>` vào .mp4 chỉ ra ô xám.
 * Backend cũng chưa trả ảnh bìa (`ChatAttachment` không có trường thumbnail) → dùng luôn player
 * expo-av ở trạng thái DỪNG: tắt tiếng, `shouldPlay={false}`, tua tới ~0.3s để lấy khung hình đầu
 * (giây 0 của video quay bằng điện thoại hay là khung đen).
 *
 * Chỉ tải phần đầu file để dựng khung hình — không tự phát, không tốn data như phát cả video.
 *
 * LƯU Ý: mỗi khung xem trước giữ một player (ExoPlayer/AVPlayer) nên số codec chạy song song có
 * hạn. Trong thread thì FlatList tự huỷ hàng ngoài màn hình; nếu lưới Ảnh & Video sau này có RẤT
 * nhiều video một lúc thì nên chuyển sang sinh ảnh tĩnh (expo-video-thumbnails) rồi cache lại.
 */
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import React, { memo, useCallback, useRef } from 'react';
import { View } from 'react-native';

/** Tua qua khung đen đầu video rồi mới lấy hình. */
const THUMBNAIL_POSITION_MS = 300;

type Props = {
  uri: string;
  width: number;
  height: number;
  /** Cỡ nút play chồng lên khung hình. */
  playIconSize?: number;
  /** Lớp phủ tối cho nút play nổi trên nền sáng (bubble dùng, lưới media không cần). */
  dimmed?: boolean;
};

export const ChatVideoThumbnail = memo(function ChatVideoThumbnail({
  uri,
  width,
  height,
  playIconSize = 48,
  dimmed = true,
}: Props) {
  const videoRef = useRef<Video>(null);

  /**
   * ExoPlayer (Android) có lúc chưa vẽ khung hình nào nếu chỉ đặt `positionMillis` lúc khởi tạo —
   * tua lại một lần nữa ngay sau khi nạp xong thì chắc chắn có hình.
   */
  const seekToFirstFrame = useCallback(() => {
    void videoRef.current?.setPositionAsync(THUMBNAIL_POSITION_MS).catch(() => {
      // Video ngắn hơn mốc tua hoặc lỗi mạng → giữ nền tối + nút play như cũ.
    });
  }, []);

  return (
    <View className="relative bg-black/20" style={{ width, height }}>
      {/* pointerEvents=none: để Pressable bọc ngoài nhận tap mở trình phát toàn màn hình. */}
      <View pointerEvents="none" style={{ width, height }}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={{ width, height }}
          resizeMode={ResizeMode.COVER}
          positionMillis={THUMBNAIL_POSITION_MS}
          shouldPlay={false}
          isMuted
          useNativeControls={false}
          onLoad={seekToFirstFrame}
        />
      </View>
      <View
        pointerEvents="none"
        className={`absolute inset-0 items-center justify-center ${dimmed ? 'bg-black/25' : ''}`}>
        <Ionicons name="play-circle" size={playIconSize} color="#fff" />
      </View>
    </View>
  );
});
