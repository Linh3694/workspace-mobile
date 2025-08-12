import React, { useState, useEffect } from 'react';
// @ts-ignore
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
        }),
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
        }),
      ]).start();
    }
  }, [visible]);

  // Chỉ render khi đã có toạ độ neo để tránh hiển thị ở giữa màn hình
  if (!visible || !position) return null;

  const modalWidth = 280;
  const modalHeight = 64;
  // position.x được coi là tâm của nút Like; position.y là đáy của nút Like
  const modalTop = Math.min(height - modalHeight - 10, position.y);
  const modalLeft = Math.max(10, Math.min(width - modalWidth - 10, position.x - modalWidth / 2));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1" style={{ position: 'relative' }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View
              className="absolute rounded-full bg-white px-3 py-2 shadow-lg"
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
              }}>
              {loading ? (
                <View className="px-4 py-3">
                  <Text className="text-center text-gray-500">Đang tải...</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 5 }}
                  className="max-h-12">
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
                          transform: [{ scale: hoveredIndex === index ? 1.4 : 1 }],
                        }}>
                        <Image source={emoji.url} className="h-10 w-10" resizeMode="contain" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default EmojiReactionModal;
