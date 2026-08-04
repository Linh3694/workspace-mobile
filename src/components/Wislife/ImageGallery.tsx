import React, { useState, useEffect } from 'react';
import { View, Text, Image, Dimensions } from 'react-native';
import { TouchableOpacity } from '../Common';
import { resolveSocialMediaUrl } from '../../utils/resolveSocialMediaUrl';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 2; // Khoảng cách giữa các ảnh

/** Một phần tử media trong bài đăng — ảnh hoặc video. */
export interface GalleryMedia {
  url: string;
  kind: 'image' | 'video';
}

interface ImageGalleryProps {
  /**
   * Ảnh VÀ video chung một danh sách, đúng thứ tự hiển thị.
   * Trước đây chỉ nhận ảnh nên video bị bày thành khối riêng bên dưới và không
   * được tính vào "+N" — lệch hẳn với bản web (03/08/2026).
   */
  media: GalleryMedia[];
  baseUrl: string;
  onImagePress: (index: number) => void;
}

/** URL hiển thị — giữ nguyên CDN signed, chỉ prefix path tương đối. */
function mediaUri(path: string, baseUrl: string) {
  return resolveSocialMediaUrl(path, baseUrl);
}

/**
 * Một ô trong lưới. Video KHÔNG vẽ được bằng `<Image>` nên hiện nền tối kèm
 * biểu tượng play — bấm vào vẫn mở trình xem đầy đủ như ảnh.
 *
 * (Server có sinh sẵn ảnh poster `_poster.webp` cho video, nhưng `Post.videos`
 * là mảng chuỗi thuần nên chưa có chỗ lưu đường dẫn poster — xem SIS-174.)
 */
function MediaTile({
  item,
  baseUrl,
  width,
  height,
}: {
  item: GalleryMedia;
  baseUrl: string;
  width: number;
  height: number;
}) {
  if (item.kind === 'video') {
    return (
      <View style={{ width, height, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(255,255,255,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#111', fontSize: 20, marginLeft: 3 }}>▶</Text>
        </View>
      </View>
    );
  }
  return (
    <Image source={{ uri: mediaUri(item.url, baseUrl) }} style={{ width, height }} resizeMode="cover" />
  );
}

/**
 * 📸 Image Gallery Component - Facebook/Instagram Style
 *
 * Layout theo số ảnh:
 * - 1 ảnh: Full width, tỉ lệ gốc (max height 400)
 * - 2 ảnh: 2 cột bằng nhau
 * - 3 ảnh: 1 ảnh lớn bên trái (2/3), 2 ảnh nhỏ bên phải (1/3)
 * - 4 ảnh: Grid 2x2
 * - 5+ ảnh: Grid 2x2, ô cuối hiển thị "+N"
 */
const ImageGallery: React.FC<ImageGalleryProps> = ({ media, baseUrl, onImagePress }) => {
  const [imageAspectRatios, setImageAspectRatios] = useState<{ [key: number]: number }>({});

  // Lấy aspect ratio của ảnh đầu tiên (cho layout 1 ảnh)
  useEffect(() => {
    // Chỉ đo tỉ lệ khi phần tử duy nhất là ẢNH — Image.getSize không đọc được video.
    if (media.length === 1 && media[0].kind === 'image') {
      Image.getSize(
        mediaUri(media[0].url, baseUrl),
        (width, height) => {
          setImageAspectRatios({ 0: width / height });
        },
        () => {
          // Fallback nếu không lấy được size
          setImageAspectRatios({ 0: 4 / 3 });
        }
      );
    }
  }, [media, baseUrl]);

  if (media.length === 0) return null;

  // 1 ẢNH - Full width, giữ tỉ lệ gốc
  if (media.length === 1) {
    const aspectRatio = imageAspectRatios[0] || 4 / 3;
    const maxHeight = 400;
    const calculatedHeight = SCREEN_WIDTH / aspectRatio;
    const finalHeight = Math.min(calculatedHeight, maxHeight);

    return (
      <TouchableOpacity onPress={() => onImagePress(0)} activeOpacity={0.9}>
        <MediaTile item={media[0]} baseUrl={baseUrl} width={SCREEN_WIDTH} height={finalHeight} />
      </TouchableOpacity>
    );
  }

  // 2 ẢNH - 2 cột bằng nhau
  if (media.length === 2) {
    const imageWidth = (SCREEN_WIDTH - GAP) / 2;
    const imageHeight = imageWidth * 1.2; // Tỉ lệ 1:1.2

    return (
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity onPress={() => onImagePress(0)} activeOpacity={0.9}>
          <MediaTile item={media[0]} baseUrl={baseUrl} width={imageWidth} height={imageHeight} />
        </TouchableOpacity>
        <View style={{ width: GAP }} />
        <TouchableOpacity onPress={() => onImagePress(1)} activeOpacity={0.9}>
          <MediaTile item={media[1]} baseUrl={baseUrl} width={imageWidth} height={imageHeight} />
        </TouchableOpacity>
      </View>
    );
  }

  // 3 ẢNH - 1 lớn bên trái, 2 nhỏ bên phải (Facebook style)
  if (media.length === 3) {
    const leftWidth = (SCREEN_WIDTH - GAP) * 0.6;
    const rightWidth = (SCREEN_WIDTH - GAP) * 0.4;
    const totalHeight = leftWidth * 1.2;
    const smallHeight = (totalHeight - GAP) / 2;

    return (
      <View style={{ flexDirection: 'row' }}>
        {/* Ảnh lớn bên trái */}
        <TouchableOpacity onPress={() => onImagePress(0)} activeOpacity={0.9}>
          <MediaTile item={media[0]} baseUrl={baseUrl} width={leftWidth} height={totalHeight} />
        </TouchableOpacity>

        <View style={{ width: GAP }} />

        {/* 2 ảnh nhỏ bên phải */}
        <View>
          <TouchableOpacity onPress={() => onImagePress(1)} activeOpacity={0.9}>
            <MediaTile item={media[1]} baseUrl={baseUrl} width={rightWidth} height={smallHeight} />
          </TouchableOpacity>
          <View style={{ height: GAP }} />
          <TouchableOpacity onPress={() => onImagePress(2)} activeOpacity={0.9}>
            <MediaTile item={media[2]} baseUrl={baseUrl} width={rightWidth} height={smallHeight} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 4+ ẢNH - Grid 2x2
  const imageWidth = (SCREEN_WIDTH - GAP) / 2;
  const imageHeight = imageWidth;
  const displayMedia = media.slice(0, 4);
  const remainingCount = media.length - 4;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {displayMedia.map((item, index) => {
        const isRight = index % 2 === 1;
        const isBottom = index >= 2;
        const isLastWithMore = index === 3 && remainingCount > 0;

        return (
          <TouchableOpacity
            key={index}
            onPress={() => onImagePress(index)}
            activeOpacity={0.9}
            style={{
              marginLeft: isRight ? GAP : 0,
              marginTop: isBottom ? GAP : 0,
            }}
          >
            <MediaTile item={item} baseUrl={baseUrl} width={imageWidth} height={imageHeight} />

            {/* Overlay "+N" cho ảnh cuối */}
            {isLastWithMore && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontSize: 28,
                    fontWeight: 'bold',
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowOffset: { width: 1, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  +{remainingCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default ImageGallery;
