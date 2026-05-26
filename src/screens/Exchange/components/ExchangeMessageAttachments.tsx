/**
 * Ảnh / video / file trong bubble chat Trao đổi — RN Image + modal (đồng bộ Guardian attachments).
 */
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveChatAttachmentUrl } from '../../../services/chatService';
import type { ChatAttachment } from '../../../types/chat';

import { CHAT_BUBBLE_MAX_WIDTH_RATIO } from '../exchangeChatThreadUtils';

function formatChatFileSize(bytes?: number): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExchangeMessageAttachments({
  attachments,
  isMine,
}: {
  attachments: ChatAttachment[];
  isMine: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewVideo, setPreviewVideo] = useState<ChatAttachment | null>(null);

  const images = attachments.filter((a) => a.kind === 'image');
  const videos = attachments.filter((a) => a.kind === 'video');
  const files = attachments.filter((a) => a.kind === 'file');

  const imageMaxW = Math.min(Math.round(windowWidth * 0.58), 268);
  const videoThumbW = imageMaxW;
  const videoThumbH = Math.round(videoThumbW * 0.62);
  const fileCardW = Math.max(180, Math.round(windowWidth * CHAT_BUBBLE_MAX_WIDTH_RATIO) - 32);

  const singleImage = images[0];
  const singleAspect =
    singleImage?.width && singleImage?.height
      ? Math.max(0.72, Math.min(1.65, singleImage.width / singleImage.height))
      : 4 / 3;
  const singleImageH = Math.round(Math.min(320, imageMaxW / singleAspect));
  const imgExtra = images.length > 4 ? images.length - 4 : 0;
  const imgsDisplay = images.slice(0, 4);
  const gridTile = Math.floor((imageMaxW - 4) / 2);
  const imageGridRows = [imgsDisplay.slice(0, 2), imgsDisplay.slice(2, 4)].filter((row) => row.length > 0);

  const openImage = (index: number) => {
    if (Platform.OS === 'web') {
      const u = resolveChatAttachmentUrl(images[index]?.url || '');
      if (u) void Linking.openURL(u);
      return;
    }
    setPreviewIndex(index);
  };

  const subMuted = isMine ? 'text-white/75' : 'text-gray-500';

  return (
    <View className="mb-2 gap-2">
      {images.length === 1 ? (
        <Pressable
          onPress={() => openImage(0)}
          className="overflow-hidden rounded-xl"
          style={{ width: imageMaxW }}>
          <Image
            source={{ uri: resolveChatAttachmentUrl(images[0].url) }}
            style={{ width: imageMaxW, height: singleImageH }}
            resizeMode="cover"
          />
        </Pressable>
      ) : images.length > 1 ? (
        <Pressable onPress={() => openImage(0)} hitSlop={4} style={{ width: imageMaxW }}>
          {imageGridRows.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={{
                flexDirection: 'row',
                marginTop: rowIndex > 0 ? 4 : 0,
              }}>
              {row.map((img, colIndex) => {
                const imageIndex = rowIndex * 2 + colIndex;
                const isLastVisible = imageIndex === 3 && imgExtra > 0;
                return (
                  <View
                    key={`${img.url}-${imageIndex}`}
                    className="relative overflow-hidden rounded-xl bg-black/10"
                    style={{
                      width: gridTile,
                      height: gridTile,
                      marginLeft: colIndex > 0 ? 4 : 0,
                    }}>
                    <Image
                      source={{ uri: resolveChatAttachmentUrl(img.url) }}
                      style={{ width: gridTile, height: gridTile }}
                      resizeMode="cover"
                    />
                    {isLastVisible ? (
                      <View
                        pointerEvents="none"
                        className="absolute inset-0 items-center justify-center bg-black/50">
                        <Text className="font-mulish-bold text-lg text-white">+{imgExtra}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {row.length === 1 ? <View style={{ width: gridTile, height: gridTile, marginLeft: 4 }} /> : null}
            </View>
          ))}
        </Pressable>
      ) : null}

      {videos.map((v) => (
        <Pressable
          key={v.url}
          onPress={() =>
            Platform.OS === 'web'
              ? void Linking.openURL(resolveChatAttachmentUrl(v.url))
              : setPreviewVideo(v)
          }
          className="overflow-hidden rounded-xl"
          style={{ width: videoThumbW }}>
          <View className="relative bg-black/20" style={{ width: videoThumbW, height: videoThumbH }}>
            <Image
              source={{ uri: resolveChatAttachmentUrl(v.url) }}
              style={{ width: videoThumbW, height: videoThumbH }}
              resizeMode="cover"
            />
            <View className="absolute inset-0 items-center justify-center bg-black/25">
              <Ionicons name="play-circle" size={48} color="#fff" />
            </View>
          </View>
        </Pressable>
      ))}

      {previewVideo ? (
        <Modal visible animationType="fade" onRequestClose={() => setPreviewVideo(null)}>
          <View
            className="flex-1 bg-black"
            style={{
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: insets.bottom,
            }}>
            <View className="h-14 flex-row items-center justify-end px-4">
              <Pressable
                onPress={() => setPreviewVideo(null)}
                hitSlop={12}
                className="size-11 items-center justify-center rounded-full bg-white/15">
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>
            <View className="flex-1 items-center justify-center">
              <Video
                source={{ uri: resolveChatAttachmentUrl(previewVideo.url) }}
                style={{ width: windowWidth, height: '100%' }}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {files.map((f) => (
        <Pressable
          key={f.url}
          onPress={() => void Linking.openURL(resolveChatAttachmentUrl(f.url))}
          className={`flex-row items-center gap-2 rounded-xl px-3 py-2 ${
            isMine ? 'bg-white/15' : 'bg-white/85'
          }`}
          style={{ width: fileCardW }}>
          <Ionicons name="document-outline" size={22} color={isMine ? '#fff' : '#0f766e'} />
          <View className="min-w-0" style={{ flexShrink: 1, width: fileCardW - 56 }}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className={`font-mulish-semibold text-sm ${isMine ? 'text-white' : 'text-[#002855]'}`}>
              {f.name || 'Tệp đính kèm'}
            </Text>
            {f.size != null ? (
              <Text className={`font-mulish-medium text-xs ${subMuted}`}>{formatChatFileSize(f.size)}</Text>
            ) : null}
          </View>
        </Pressable>
      ))}

      {previewIndex != null ? (
        <Modal visible animationType="fade" transparent={false} onRequestClose={() => setPreviewIndex(null)}>
          <View
            className="flex-1 bg-black"
            style={{
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: insets.bottom,
            }}>
            <View className="h-14 flex-row items-center justify-between px-4">
              <Text className="font-mulish-semibold text-sm text-white/80">
                {`${previewIndex + 1}/${images.length}`}
              </Text>
              <Pressable
                onPress={() => setPreviewIndex(null)}
                hitSlop={12}
                className="size-11 items-center justify-center rounded-full bg-white/15">
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              initialScrollIndex={previewIndex}
              getItemLayout={(_, index) => ({
                length: windowWidth,
                offset: windowWidth * index,
                index,
              })}
              keyExtractor={(item, index) => `${item.url}-${index}`}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const next = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
                setPreviewIndex(next);
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
      ) : null}
    </View>
  );
}
