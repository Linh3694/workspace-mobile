/**
 * Ảnh / video / file trong bubble chat Trao đổi — RN Image + modal (đồng bộ Guardian attachments).
 */
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import React, { useState } from 'react';
import {
  ActivityIndicator,
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

import { InlineToast, useInlineToast } from '../../../components/Common';
import { resolveChatAttachmentUrl } from '../../../services/chatService';
import type { ChatAttachment } from '../../../types/chat';
import { saveMediaToDevice } from '../../../utils/mediaDownload';

import { ChatImagePreviewModal } from './ChatImagePreviewModal';
import { ChatVideoThumbnail } from './ChatVideoThumbnail';

import { CHAT_BUBBLE_MAX_WIDTH_RATIO } from '../exchangeChatThreadUtils';
import { useChatAttachmentDownload } from '../lib/chatAttachmentDownload';

function formatChatFileSize(bytes?: number): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExchangeMessageAttachments({
  attachments,
  onLongPress,
}: {
  attachments: ChatAttachment[];
  /** Long-press attachment → mở overlay reaction/hành động (giống bubble text). */
  onLongPress?: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewVideo, setPreviewVideo] = useState<ChatAttachment | null>(null);
  const [savingVideo, setSavingVideo] = useState(false);
  const { toast, showToast, hideToast } = useInlineToast();
  const { downloadingUrl, view } = useChatAttachmentDownload();

  /** Lưu video đang xem vào album (không được thì mở bảng chia sẻ). */
  const handleSaveVideo = async () => {
    if (!previewVideo || savingVideo) return;
    const url = resolveChatAttachmentUrl(previewVideo.url);
    if (!url) return;
    try {
      setSavingVideo(true);
      const result = await saveMediaToDevice({
        url,
        name: previewVideo.name,
        mimeType: previewVideo.mimeType,
        kind: 'video',
      });
      if (result === 'saved-to-library') showToast('Đã lưu video vào album');
    } catch (error) {
      console.error('[ExchangeMessageAttachments] save video', error);
      showToast('Không thể tải hoặc lưu video', 'error');
    } finally {
      setSavingVideo(false);
    }
  };

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

  return (
    <View className="mb-2 gap-2">
      {images.length === 1 ? (
        <Pressable
          onPress={() => openImage(0)}
          onLongPress={onLongPress}
          delayLongPress={420}
          className="overflow-hidden rounded-xl"
          style={{ width: imageMaxW }}>
          <Image
            source={{ uri: resolveChatAttachmentUrl(images[0].url) }}
            style={{ width: imageMaxW, height: singleImageH }}
            resizeMode="cover"
          />
        </Pressable>
      ) : images.length > 1 ? (
        <Pressable
          onPress={() => openImage(0)}
          onLongPress={onLongPress}
          delayLongPress={420}
          hitSlop={4}
          style={{ width: imageMaxW }}>
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
          onLongPress={onLongPress}
          delayLongPress={420}
          className="overflow-hidden rounded-xl"
          style={{ width: videoThumbW }}>
          <ChatVideoThumbnail
            uri={resolveChatAttachmentUrl(v.url)}
            width={videoThumbW}
            height={videoThumbH}
          />
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
            <View className="h-14 flex-row items-center justify-end gap-2 px-4">
              <Pressable
                disabled={savingVideo}
                onPress={() => void handleSaveVideo()}
                hitSlop={12}
                className="size-11 items-center justify-center rounded-full bg-white/15">
                {savingVideo ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="download-outline" size={22} color="#fff" />
                )}
              </Pressable>
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
            {toast ? (
              <InlineToast
                key={toast.id}
                message={toast.message}
                type={toast.type}
                floating
                bottomOffset={insets.bottom + 32}
                onHide={hideToast}
              />
            ) : null}
          </View>
        </Modal>
      ) : null}

      {/* Tap = xem ngay trong app (tải về cache GIỮ TÊN GỐC rồi mở QuickLook/intent);
          không mở được thì rơi xuống bảng chia sẻ. Mở URL trực tiếp thì tệp lưu ra
          mang tên hash của CDN.

          Thẻ tệp KHÔNG đổi màu theo bên gửi: từ khi bong bóng của mình chuyển sang nền
          teal rất nhạt (#F0FDFA), cả hai chiều đều là nền sáng nên chữ trắng sẽ chìm. */}
      {files.map((f) => (
        <Pressable
          key={f.url}
          onPress={() => void view(f)}
          disabled={downloadingUrl === f.url}
          onLongPress={onLongPress}
          delayLongPress={420}
          className="flex-row items-center gap-2 rounded-xl bg-white/85 px-3 py-2"
          style={{ width: fileCardW }}>
          {downloadingUrl === f.url ? (
            <ActivityIndicator size="small" color="#0f766e" />
          ) : (
            <Ionicons name="document-outline" size={22} color="#0f766e" />
          )}
          <View className="min-w-0" style={{ flexShrink: 1, width: fileCardW - 56 }}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className="font-mulish-semibold text-sm text-[#002855]">
              {f.name || 'Tệp đính kèm'}
            </Text>
            {f.size != null ? (
              <Text className="font-mulish-medium text-xs text-gray-500">{formatChatFileSize(f.size)}</Text>
            ) : null}
          </View>
        </Pressable>
      ))}

      {previewIndex != null ? (
        <ChatImagePreviewModal
          images={images}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      ) : null}
    </View>
  );
}
