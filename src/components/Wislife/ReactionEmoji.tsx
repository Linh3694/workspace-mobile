/**
 * 🎭 ReactionEmoji Component - Wislife/Social Module
 * Hiển thị emoji reaction với Lottie animation hoặc fallback text
 * Pattern giống TicketProcessingGuest.tsx
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { getEmojiByCode, hasLottieAnimation, WislifeEmoji } from '../../utils/emojiUtils';

interface ReactionEmojiProps {
  // Emoji code: like, love, haha, wow, sad, angry
  code: string;
  // Kích thước emoji
  size?: number;
  // Có hiển thị với glow effect không (khi được chọn)
  isSelected?: boolean;
  // Có autoPlay animation không
  autoPlay?: boolean;
  // Có loop animation không
  loop?: boolean;
  // Custom style cho container
  style?: any;
}

const ReactionEmoji: React.FC<ReactionEmojiProps> = ({
  code,
  size = 24,
  isSelected = false,
  autoPlay = true,
  loop = true,
  style,
}) => {
  const emoji = getEmojiByCode(code);

  if (!emoji) {
    // Fallback khi không tìm thấy emoji
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <Text style={{ fontSize: size * 0.7 }}>👍</Text>
      </View>
    );
  }

  // Nếu có Lottie animation
  if (hasLottieAnimation(emoji)) {
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        {isSelected && (
          <View
            style={[
              styles.glowRing,
              {
                width: size + 8,
                height: size + 8,
                borderRadius: (size + 8) / 2,
                borderColor: emoji.color || '#F5AA1E',
              },
            ]}
          />
        )}
        <View
          style={[
            styles.emojiContainer,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: isSelected ? '#FFFBE8' : 'transparent',
            },
          ]}>
          <LottieView
            source={emoji.lottieSource}
            autoPlay={autoPlay}
            loop={loop}
            style={{ width: size * 0.85, height: size * 0.85 }}
          />
        </View>
      </View>
    );
  }

  // Fallback: hiển thị text emoji
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {isSelected && (
        <View
          style={[
            styles.glowRing,
            {
              width: size + 8,
              height: size + 8,
              borderRadius: (size + 8) / 2,
              borderColor: emoji.color || '#F5AA1E',
            },
          ]}
        />
      )}
      <View
        style={[
          styles.emojiContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isSelected ? '#FFFBE8' : 'transparent',
          },
        ]}>
        <Text style={{ fontSize: size * 0.7 }}>{emoji.fallbackText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  emojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ReactionEmoji;
