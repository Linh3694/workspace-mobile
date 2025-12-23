// @ts-nocheck
// Component animation tuyết rơi cho theme mùa đông/Giáng sinh
import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

// Import các SVG bông tuyết và ngôi sao
import SnowflakeLarge from '../../assets/theme/christmas/Vector.svg';
import SnowflakeMedium from '../../assets/theme/christmas/Vector (1).svg';
import StarSmall from '../../assets/theme/christmas/Vector (2).svg';
import StarLarge from '../../assets/theme/christmas/Vector (3).svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Các loại hình dạng
type ShapeType = 'snowflake-large' | 'snowflake-medium' | 'star-small' | 'star-large' | 'circle';

interface SnowflakeProps {
  index: number;
  size: number;
  startX: number;
  startY: number;
  delay: number;
  duration: number;
  opacity: number;
  shapeType: ShapeType;
  initialProgress: number; // Vị trí ban đầu của animation (0-1) để tuyết có sẵn trên màn hình
}

// Component cho mỗi bông tuyết/ngôi sao
const Snowflake: React.FC<SnowflakeProps> = ({
  index,
  size,
  startX,
  startY,
  delay,
  duration,
  opacity,
  shapeType,
  initialProgress,
}) => {
  // Bắt đầu từ vị trí initialProgress để tuyết đã có sẵn trên màn hình
  const progress = useSharedValue(initialProgress);
  const swayProgress = useSharedValue(Math.random()); // Random vị trí lắc lư ban đầu

  useEffect(() => {
    // Tính thời gian còn lại dựa trên initialProgress
    const remainingDuration = duration * (1 - initialProgress);

    // Animation rơi xuống - bắt đầu từ vị trí hiện tại đến cuối
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: remainingDuration,
        easing: Easing.linear,
      })
    );

    // Sau khi hoàn thành lần đầu, reset về 0 và lặp lại vô hạn
    const timeout = setTimeout(() => {
      // Reset về 0 trước khi bắt đầu loop
      progress.value = 0;
      // Sau đó bắt đầu animation loop vô hạn
      progress.value = withRepeat(
        withTiming(1, {
          duration: duration,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    }, remainingDuration + delay + 50); // +50ms để đảm bảo animation đầu tiên hoàn thành

    // Animation lắc lư
    swayProgress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration: 2000 + Math.random() * 1500,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true // Đảo ngược để tạo hiệu ứng lắc qua lại
      )
    );

    return () => clearTimeout(timeout);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    // Di chuyển từ startY xuống dưới
    const translateY = interpolate(progress.value, [0, 1], [startY, SCREEN_HEIGHT + size]);

    // Lắc lư sang trái phải
    const translateX = interpolate(swayProgress.value, [0, 1], [-25, 25]);

    // Xoay nhẹ
    const rotate = interpolate(swayProgress.value, [0, 1], [-20, 20]);

    return {
      transform: [{ translateY }, { translateX }, { rotate: `${rotate}deg` }],
    };
  });

  // Render hình dạng phù hợp
  const renderShape = () => {
    switch (shapeType) {
      case 'snowflake-large':
        return <SnowflakeLarge width={size} height={size} />;
      case 'snowflake-medium':
        return <SnowflakeMedium width={size} height={size} />;
      case 'star-small':
        return <StarSmall width={size} height={size} />;
      case 'star-large':
        return <StarLarge width={size} height={size} />;
      case 'circle':
      default:
        return (
          <View
            style={[
              styles.circleShape,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
          />
        );
    }
  };

  return (
    <Reanimated.View
      style={[
        styles.snowflake,
        {
          left: startX,
          opacity: opacity,
        },
        animatedStyle,
      ]}>
      {renderShape()}
    </Reanimated.View>
  );
};

interface SnowfallProps {
  count?: number; // Số lượng bông tuyết
  color?: string; // Màu tuyết (chỉ dùng cho circle)
}

const Snowfall: React.FC<SnowfallProps> = ({ count = 50, color = '#FFFFFF' }) => {
  // Tạo mảng các bông tuyết với thuộc tính random
  const snowflakes = useMemo(() => {
    const shapes: ShapeType[] = [
      'snowflake-large',
      'snowflake-medium',
      'star-small',
      'star-large',
      'circle',
      'circle', // Thêm circle để có nhiều hơn
    ];

    return Array.from({ length: count }, (_, index) => {
      const shapeType = shapes[Math.floor(Math.random() * shapes.length)];

      // Kích thước tùy theo loại hình
      let size: number;
      switch (shapeType) {
        case 'snowflake-large':
          size = 20 + Math.random() * 15; // 20-35
          break;
        case 'snowflake-medium':
          size = 14 + Math.random() * 10; // 14-24
          break;
        case 'star-small':
          size = 8 + Math.random() * 6; // 8-14
          break;
        case 'star-large':
          size = 12 + Math.random() * 10; // 12-22
          break;
        case 'circle':
        default:
          size = 4 + Math.random() * 6; // 4-10
          break;
      }

      // Tính toán duration - thời gian rơi
      const duration = 8000 + Math.random() * 6000; // Thời gian rơi 8-14s

      // startY luôn từ trên cao
      const startY = -size;

      // 85% bông tuyết có initialProgress > 0 (đã ở sẵn trên màn hình)
      // 15% còn lại bắt đầu từ trên
      const hasInitialProgress = Math.random() < 0.85;
      
      // initialProgress random từ 0-0.9 để tuyết phân bố khắp màn hình
      const initialProgress = hasInitialProgress ? Math.random() * 0.9 : 0;
      
      // delay = 0 cho tuyết có sẵn, có delay nhỏ cho tuyết mới
      const delay = hasInitialProgress ? 0 : Math.random() * 2000;

      return {
        index,
        size,
        startX: Math.random() * SCREEN_WIDTH, // Vị trí X random
        startY: startY,
        delay: delay,
        duration: duration,
        opacity: 0.4 + Math.random() * 0.5, // Độ trong suốt 0.4-0.9
        shapeType,
        initialProgress, // Vị trí ban đầu để tuyết có sẵn trên màn hình
      };
    });
  }, [count]);

  return (
    <View style={styles.container} pointerEvents="none">
      {snowflakes.map((flake) => (
        <Snowflake key={flake.index} {...flake} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: 'hidden',
  },
  snowflake: {
    position: 'absolute',
    top: 0,
  },
  circleShape: {
    backgroundColor: '#FFFFFF',
    // Thêm hiệu ứng glow nhẹ
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 2,
  },
});

export default Snowfall;
