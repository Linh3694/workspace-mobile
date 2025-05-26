import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEmojis } from '../../hooks/useEmojis';

const { width, height } = Dimensions.get('window');

interface EmojiReactionModalProps {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emojiCode: string) => void;
  position?: { x: number; y: number };
}

const EmojiReactionModal: React.FC<EmojiReactionModalProps> = ({
  visible,
  onClose,
  onEmojiSelect,
  position,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.5));
  const { customEmojis, loading } = useEmojis();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.5,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  // Calculate position - default to center if no position provided
  const modalWidth = 250;
  const modalHeight = 60;
  const modalTop = position ? Math.max(10, position.y - modalHeight - 10) : height / 2 - modalHeight / 2;
  const modalLeft = position 
    ? Math.max(10, Math.min(width - modalWidth - 10, position.x - modalWidth / 2)) 
    : (width - modalWidth) / 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1" style={{ position: 'relative' }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View
              className="bg-white rounded-full shadow-lg px-3 py-2 absolute"
              style={{
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
                top: modalTop,
                left: modalLeft,
                width: modalWidth,
                elevation: 10,
                shadowColor: '#000',
                shadowOffset: {
                  width: 0,
                  height: 4,
                },
                shadowOpacity: 0.3,
                shadowRadius: 10,
              }}
            >
              {loading ? (
                <View className="py-3 px-4">
                  <Text className="text-gray-500 text-center">Đang tải...</Text>
                </View>
              ) : (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 5 }}
                  className="max-h-12"
                >
                  <View className="flex-row items-center justify-center">
                    {customEmojis.map((emoji, index) => (
                      <TouchableOpacity
                        key={emoji._id}
                        onPress={() => {
                          onEmojiSelect(emoji.code);
                        }}
                        onPressIn={() => setHoveredIndex(index)}
                        onPressOut={() => setHoveredIndex(null)}
                        className="items-center justify-center px-1 py-1"
                        style={{
                          transform: [
                            { scale: hoveredIndex === index ? 1.4 : 1 }
                          ],
                        }}
                      >
                        <Image
                          source={emoji.url}
                          className="w-10 h-10"
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
              {/* Small arrow pointing down */}
              {position && (
                <View 
                  className="absolute bg-white"
                  style={{
                    bottom: -5,
                    left: Math.max(5, Math.min(modalWidth - 15, position.x - modalLeft)),
                    width: 10,
                    height: 10,
                    transform: [{ rotate: '45deg' }],
                    elevation: 8,
                  }}
                />
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default EmojiReactionModal; 