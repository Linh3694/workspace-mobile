import React, { useState, useEffect } from 'react';
import { View, Text, Image, Dimensions } from 'react-native';
import { TouchableOpacity } from '../Common';
import { resolveSocialMediaUrl } from '../../utils/resolveSocialMediaUrl';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 2; // Khoảng cách giữa các ảnh

interface ImageGalleryProps {
  images: string[];
  baseUrl: string;
  onImagePress: (index: number) => void;
}

/** URL hiển thị — giữ nguyên CDN signed, chỉ prefix path tương đối. */
function mediaUri(path: string, baseUrl: string) {
  return resolveSocialMediaUrl(path, baseUrl);
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
const ImageGallery: React.FC<ImageGalleryProps> = ({ images, baseUrl, onImagePress }) => {
  const [imageAspectRatios, setImageAspectRatios] = useState<{ [key: number]: number }>({});

  // Lấy aspect ratio của ảnh đầu tiên (cho layout 1 ảnh)
  useEffect(() => {
    if (images.length === 1) {
      Image.getSize(
        mediaUri(images[0], baseUrl),
        (width, height) => {
          setImageAspectRatios({ 0: width / height });
        },
        () => {
          // Fallback nếu không lấy được size
          setImageAspectRatios({ 0: 4 / 3 });
        }
      );
    }
  }, [images, baseUrl]);

  if (images.length === 0) return null;

  // 1 ẢNH - Full width, giữ tỉ lệ gốc
  if (images.length === 1) {
    const aspectRatio = imageAspectRatios[0] || 4 / 3;
    const maxHeight = 400;
    const calculatedHeight = SCREEN_WIDTH / aspectRatio;
    const finalHeight = Math.min(calculatedHeight, maxHeight);

    return (
      <TouchableOpacity onPress={() => onImagePress(0)} activeOpacity={0.9}>
        <Image
          source={{ uri: mediaUri(images[0], baseUrl) }}
          style={{
            width: SCREEN_WIDTH,
            height: finalHeight,
          }}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }

  // 2 ẢNH - 2 cột bằng nhau
  if (images.length === 2) {
    const imageWidth = (SCREEN_WIDTH - GAP) / 2;
    const imageHeight = imageWidth * 1.2; // Tỉ lệ 1:1.2

    return (
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity onPress={() => onImagePress(0)} activeOpacity={0.9}>
          <Image
            source={{ uri: mediaUri(images[0], baseUrl) }}
            style={{
              width: imageWidth,
              height: imageHeight,
            }}
            resizeMode="cover"
          />
        </TouchableOpacity>
        <View style={{ width: GAP }} />
        <TouchableOpacity onPress={() => onImagePress(1)} activeOpacity={0.9}>
          <Image
            source={{ uri: mediaUri(images[1], baseUrl) }}
            style={{
              width: imageWidth,
              height: imageHeight,
            }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>
    );
  }

  // 3 ẢNH - 1 lớn bên trái, 2 nhỏ bên phải (Facebook style)
  if (images.length === 3) {
    const leftWidth = (SCREEN_WIDTH - GAP) * 0.6;
    const rightWidth = (SCREEN_WIDTH - GAP) * 0.4;
    const totalHeight = leftWidth * 1.2;
    const smallHeight = (totalHeight - GAP) / 2;

    return (
      <View style={{ flexDirection: 'row' }}>
        {/* Ảnh lớn bên trái */}
        <TouchableOpacity onPress={() => onImagePress(0)} activeOpacity={0.9}>
          <Image
            source={{ uri: mediaUri(images[0], baseUrl) }}
            style={{
              width: leftWidth,
              height: totalHeight,
            }}
            resizeMode="cover"
          />
        </TouchableOpacity>

        <View style={{ width: GAP }} />

        {/* 2 ảnh nhỏ bên phải */}
        <View>
          <TouchableOpacity onPress={() => onImagePress(1)} activeOpacity={0.9}>
            <Image
              source={{ uri: mediaUri(images[1], baseUrl) }}
              style={{
                width: rightWidth,
                height: smallHeight,
              }}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <View style={{ height: GAP }} />
          <TouchableOpacity onPress={() => onImagePress(2)} activeOpacity={0.9}>
            <Image
              source={{ uri: mediaUri(images[2], baseUrl) }}
              style={{
                width: rightWidth,
                height: smallHeight,
              }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 4+ ẢNH - Grid 2x2
  const imageWidth = (SCREEN_WIDTH - GAP) / 2;
  const imageHeight = imageWidth;
  const displayImages = images.slice(0, 4);
  const remainingCount = images.length - 4;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {displayImages.map((image, index) => {
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
            <Image
              source={{ uri: mediaUri(image, baseUrl) }}
              style={{
                width: imageWidth,
                height: imageHeight,
              }}
              resizeMode="cover"
            />

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
