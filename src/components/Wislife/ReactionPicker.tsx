/**
 * 🎭 ReactionPicker Component - Wislife/Social Module
 * Modal hiển thị các emoji để chọn reaction
 * Sử dụng Lottie animations - compact design
 */

import React from 'react';
import { View, Text, Modal, StyleSheet, Dimensions } from 'react-native';
import { TouchableOpacity } from '../Common';
import LottieView from 'lottie-react-native';
import { 
  WISLIFE_EMOJIS, 
  hasLottieAnimation, 
  WislifeEmoji 
} from '../../utils/emojiUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emojiCode: string) => void;
  currentReaction?: string | null;
  anchorPosition?: { x: number; y: number };
}

const ReactionPicker: React.FC<ReactionPickerProps> = ({
  visible,
  onClose,
  onSelect,
  currentReaction,
  anchorPosition,
}) => {
  const handleSelect = (code: string) => {
    onSelect(code);
    onClose();
  };

  const renderEmoji = (emoji: WislifeEmoji) => {
    const isSelected = currentReaction === emoji.code;

    return (
      <TouchableOpacity
        key={emoji.code}
        onPress={() => handleSelect(emoji.code)}
        style={styles.emojiButton}>
        <View
          style={[
            styles.emojiBackground,
            {
              backgroundColor: isSelected ? '#FFFBE8' : 'transparent',
              borderWidth: isSelected ? 2 : 0,
              borderColor: emoji.color || '#F5AA1E',
            },
          ]}>
          {hasLottieAnimation(emoji) ? (
            <LottieView
              source={emoji.lottieSource}
              autoPlay
              loop
              style={styles.lottie}
            />
          ) : (
            <Text style={styles.fallbackText}>{emoji.fallbackText}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}>
        <View 
          style={[
            styles.container,
            anchorPosition && {
              position: 'absolute',
              left: Math.max(10, Math.min(anchorPosition.x - 120, SCREEN_WIDTH - 260)),
              top: Math.max(80, anchorPosition.y - 60),
            },
          ]}>
          <View style={styles.emojiRow}>
            {WISLIFE_EMOJIS.map(renderEmoji)}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiButton: {
    padding: 2,
  },
  emojiBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: 30,
    height: 30,
  },
  fallbackText: {
    fontSize: 22,
  },
});

export default ReactionPicker;

