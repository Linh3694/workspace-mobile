/**
 * Lightbox xem ảnh toàn màn hình — dùng chung cho bubble chat và các màn Thông tin.
 * Vuốt ngang chuyển ảnh, đếm "n/total", nút đóng. (Tách từ ExchangeMessageAttachments.)
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Image, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveChatAttachmentUrl } from '../../../services/chatService';

export type PreviewImage = { url: string };

export function ChatImagePreviewModal({
  images,
  initialIndex,
  onClose,
}: {
  images: PreviewImage[];
  /** Chỉ số ảnh mở đầu. Component chỉ nên render khi >= 0 (parent gate). */
  initialIndex: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={onClose}>
      <View
        className="flex-1 bg-black"
        style={{ paddingTop: Math.max(insets.top, 16), paddingBottom: insets.bottom }}>
        <View className="h-14 flex-row items-center justify-between px-4">
          <Text className="font-mulish-semibold text-sm text-white/80">
            {`${index + 1}/${images.length}`}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            className="size-11 items-center justify-center rounded-full bg-white/15">
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: windowWidth, offset: windowWidth * i, index: i })}
          keyExtractor={(item, i) => `${item.url}-${i}`}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
            setIndex(next);
          }}
          renderItem={({ item }) => (
            <View className="items-center justify-center" style={{ width: windowWidth }}>
              <Image
                source={{ uri: resolveChatAttachmentUrl(item.url) }}
                style={{ width: windowWidth, height: '88%' }}
                resizeMode="contain"
              />
            </View>
          )}
        />
      </View>
    </Modal>
  );
}
