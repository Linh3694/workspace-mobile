// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, ScrollView, Image, Animated } from 'react-native';
import { TouchableOpacity } from '../Common';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { Reaction } from '../../types/post';
import { getAvatar } from '../../utils/avatar';
import { getEmojiByCode, hasLottieAnimation } from '../../utils/emojiUtils';
import { normalizeVietnameseName } from '../../utils/nameFormatter';

interface ReactionsListModalProps {
  visible: boolean;
  onClose: () => void;
  reactions: Reaction[];
}

const ReactionsListModal: React.FC<ReactionsListModalProps> = ({ visible, onClose, reactions }) => {
  const insets = useSafeAreaInsets();
  const [selectedReactionFilter, setSelectedReactionFilter] = useState<string | null>(null);

  // Animation
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(500)).current;

  // Tính toán reaction counts
  const getReactionCounts = () => {
    const counts: Record<string, number> = {};
    reactions.forEach((reaction) => {
      counts[reaction.type] = (counts[reaction.type] || 0) + 1;
    });
    return counts;
  };

  const reactionCounts = getReactionCounts();
  const totalReactions = reactions.length;

  // Animation khi mở/đóng modal
  useEffect(() => {
    if (visible) {
      // Mở modal: fade backdrop + slide sheet
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Đóng modal: fade out + slide down
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 500,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      // Reset filter khi đóng modal
      setSelectedReactionFilter(null);
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="none" transparent={true} onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        {/* Backdrop - Fade animation riêng */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            opacity: backdropOpacity,
          }}
        />
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />

        {/* ActionSheet Content - Slide animation riêng, chiều cao cố định 50% màn hình */}
        <Animated.View
          className="rounded-t-3xl bg-white"
          style={{
            height: '50%',
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: sheetTranslateY }],
          }}>
          {/* Handle bar */}
          <View className="items-center py-3">
            <View className="h-1 w-10 rounded-full bg-gray-300" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-gray-100 px-4 pb-3">
            <Text className="text-lg font-semibold text-gray-900">Lượt thích</Text>
            <TouchableOpacity
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <Ionicons name="close" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Reaction Type Tabs - Có thể ấn để filter */}
          <View className="flex-row border-b border-gray-100 px-4">
            {/* Tab Tất cả */}
            <TouchableOpacity
              onPress={() => setSelectedReactionFilter(null)}
              className={`mr-4 py-3 ${selectedReactionFilter === null ? 'border-b-2 border-gray-900' : ''}`}
              activeOpacity={0.7}>
              <Text
                className={`font-medium ${selectedReactionFilter === null ? 'text-gray-900' : 'text-gray-500'}`}>
                Tất cả {totalReactions}
              </Text>
            </TouchableOpacity>

            {/* Tabs cho từng loại reaction */}
            {Object.entries(reactionCounts).map(([emojiCode, count]) => {
              const emoji = getEmojiByCode(emojiCode);
              if (!emoji || count === 0) return null;
              const isSelected = selectedReactionFilter === emojiCode;
              return (
                <TouchableOpacity
                  key={emojiCode}
                  onPress={() => setSelectedReactionFilter(emojiCode)}
                  className={`mr-4 flex-row items-center py-3 ${isSelected ? 'border-b-2 border-gray-900' : ''}`}
                  activeOpacity={0.7}>
                  {hasLottieAnimation(emoji) ? (
                    <LottieView
                      source={emoji.lottieSource}
                      autoPlay
                      loop
                      style={{ width: 20, height: 20 }}
                    />
                  ) : (
                    <Text style={{ fontSize: 16 }}>{emoji.fallbackText}</Text>
                  )}
                  <Text
                    className={`ml-1 text-sm ${isSelected ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Reactions List - Filter theo tab đang chọn, flex-1 để scroll */}
          <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={true}>
            {reactions
              .filter(
                (reaction) =>
                  selectedReactionFilter === null || reaction.type === selectedReactionFilter
              )
              .map((reaction, index) => {
                const emoji = getEmojiByCode(reaction.type);
                const reactionUser = reaction.user;
                return (
                  <View
                    key={reaction._id || index}
                    className="flex-row items-center border-b border-gray-50 py-4">
                    {/* Avatar với emoji overlay */}
                    <View className="relative">
                      <View className="h-14 w-14 overflow-hidden rounded-full bg-gray-200">
                        <Image
                          source={{ uri: getAvatar(reactionUser) }}
                          className="h-full w-full"
                        />
                      </View>
                      {/* Emoji badge */}
                      <View
                        className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full bg-white"
                        style={{
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 2,
                          elevation: 2,
                        }}>
                        {emoji && hasLottieAnimation(emoji) ? (
                          <LottieView
                            source={emoji.lottieSource}
                            autoPlay
                            loop
                            style={{ width: 20, height: 20 }}
                          />
                        ) : emoji ? (
                          <Text style={{ fontSize: 16 }}>{emoji.fallbackText}</Text>
                        ) : null}
                      </View>
                    </View>

                    {/* User info */}
                    <View className="ml-4 flex-1">
                      <Text className="text-base font-semibold text-gray-900">
                        {reactionUser
                          ? normalizeVietnameseName(reactionUser.fullname)
                          : 'Người dùng'}
                      </Text>
                      {reactionUser?.jobTitle && (
                        <Text className="mt-0.5 text-sm text-gray-500">
                          {reactionUser.jobTitle}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}

            {/* Empty state */}
            {reactions.filter(
              (r) => selectedReactionFilter === null || r.type === selectedReactionFilter
            ).length === 0 && (
              <View className="items-center py-8">
                <Text className="text-gray-400">Chưa có lượt thích nào</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default ReactionsListModal;




