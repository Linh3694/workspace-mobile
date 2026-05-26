/**
 * Thanh nhập Trao đổi — cùng layout ChatComposer parent-portal: pill, camera, emoji panel, gallery, file, gửi teal.
 */
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { chatService } from '../../../services/chatService';
import type { ChatAttachment, ChatMessage } from '../../../types/chat';
import { formatChatWislifeStickerContent } from '../../../utils/chatWislifeSticker';

import { replyQuoteSnippet } from '../exchangeChatThreadUtils';
import { ChatEmojiPickerPanel } from './ChatEmojiPickerPanel';

const ORANGE_CAMERA = '#F05023';
const TEAL_ICON = '#0d9488';
const EMOJI_PANEL_GAP = 8;
const KEYBOARD_VERTICAL_OFFSET = 12;
const INPUT_PLACEHOLDER_HEX = '#64748B';

type LocalPick = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'video' | 'file';
};

export type ChatComposerExchangeProps = {
  locked: boolean;
  conversationId: string | null;
  teacherGuardianUploadContext?: {
    classId: string;
    schoolYearId: string;
    teacherId: string;
    guardianId: string;
  };
  placeholder?: string;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  onTyping: () => void;
  onTypingStop: () => void;
  onEmojiOpenChange?: (open: boolean) => void;
  onSend: (payload: {
    content: string;
    attachments?: ChatAttachment[];
    replyToMessageId?: string;
  }) => Promise<void>;
};

function guessMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.m4v')) return 'video/x-m4v';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function newPickId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function localPickFromMediaAsset(
  asset: ImagePicker.ImagePickerAsset,
  fallbackPrefix: string
): LocalPick {
  const isVideo = asset.type === 'video';
  const fallbackExt = isVideo ? 'mp4' : 'jpg';
  const fallbackName = `${fallbackPrefix}-${Date.now()}.${fallbackExt}`;
  const name = asset.fileName || fallbackName;
  return {
    id: newPickId(),
    uri: asset.uri,
    name,
    mimeType:
      asset.mimeType || (isVideo ? 'video/mp4' : guessMimeFromName(name || fallbackName)),
    kind: isVideo ? 'video' : 'image',
  };
}

export function ChatComposerExchange({
  locked,
  conversationId,
  teacherGuardianUploadContext,
  placeholder = 'Nhập tin nhắn',
  replyTo,
  onCancelReply,
  onTyping,
  onTypingStop,
  onEmojiOpenChange,
  onSend,
}: ChatComposerExchangeProps) {
  const inputRef = useRef<TextInput>(null);
  const closeEmojiAfterKeyboardShowRef = useRef(false);

  const { height: winH } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const defaultEmojiPanelH = Math.min(320, Math.max(260, Math.round(winH * 0.34)));
  const keyboardReplacementHeight =
    keyboardHeight > 0
      ? Math.max(
          180,
          keyboardHeight - (Platform.OS === 'ios' ? KEYBOARD_VERTICAL_OFFSET : 0) - EMOJI_PANEL_GAP
        )
      : defaultEmojiPanelH;
  const emojiPanelHeight = Math.round(Math.min(Math.max(keyboardReplacementHeight, 180), winH * 0.46));

  const [value, setValue] = useState('');
  const [localPicks, setLocalPicks] = useState<LocalPick[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const setEmojiPanelOpen = useCallback(
    (open: boolean) => {
      if (open) closeEmojiAfterKeyboardShowRef.current = false;
      setEmojiOpen(open);
      onEmojiOpenChange?.(open);
    },
    [onEmojiOpenChange]
  );

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', (event) => {
      const nextHeight = Math.round(event.endCoordinates.height);
      if (nextHeight > 0) setKeyboardHeight(nextHeight);
      if (closeEmojiAfterKeyboardShowRef.current) {
        closeEmojiAfterKeyboardShowRef.current = false;
        setEmojiPanelOpen(false);
      }
    });
    return () => subscription.remove();
  }, [setEmojiPanelOpen]);

  useEffect(() => () => onEmojiOpenChange?.(false), [onEmojiOpenChange]);

  const canWire =
    Boolean(conversationId) ||
    Boolean(
      teacherGuardianUploadContext?.classId &&
        teacherGuardianUploadContext?.schoolYearId &&
        teacherGuardianUploadContext?.teacherId &&
        teacherGuardianUploadContext?.guardianId
    );

  const canSend =
    !locked &&
    canWire &&
    (value.trim().length > 0 || localPicks.length > 0) &&
    !sending;

  const openCamera = useCallback(async () => {
    if (locked) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Quyền camera', 'Cần quyền camera để chụp ảnh/quay video.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setLocalPicks((prev) => {
      const blockedByFile = prev.some((p) => p.kind === 'file');
      const media = blockedByFile
        ? []
        : prev.filter((p) => p.kind === 'image' || p.kind === 'video');
      return [...media, localPickFromMediaAsset(a, 'camera')].slice(-10);
    });
  }, [locked]);

  const openGallery = useCallback(async () => {
    if (locked) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Thư viện ảnh', 'Cần quyền truy cập ảnh/video để đính kèm.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    setLocalPicks((prev) => {
      const blockedByFile = prev.some((p) => p.kind === 'file');
      if (blockedByFile) {
        Alert.alert('Đính kèm', 'Đã chọn tệp; xóa tệp để thêm ảnh/video.');
        return prev;
      }
      const media = prev.filter((p) => p.kind === 'image' || p.kind === 'video');
      const remaining = 10 - media.length;
      if (remaining <= 0) {
        Alert.alert('Giới hạn', 'Tối đa 10 ảnh/video.');
        return prev;
      }
      const add = result.assets!.slice(0, remaining).map((asset) => localPickFromMediaAsset(asset, 'media'));
      return [...media, ...add].slice(-10);
    });
  }, [locked]);

  const openFile = useCallback(async () => {
    if (locked) return;
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setLocalPicks([
      {
        id: newPickId(),
        uri: a.uri,
        name: a.name || 'file',
        mimeType: a.mimeType || guessMimeFromName(a.name || ''),
        kind: 'file',
      },
    ]);
  }, [locked]);

  const removePick = (id: string) => {
    setLocalPicks((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleEmojiPanel = useCallback(() => {
    if (locked || !canWire) return;
    if (emojiOpen) {
      setEmojiPanelOpen(false);
      return;
    }
    setEmojiPanelOpen(true);
    inputRef.current?.blur();
    Keyboard.dismiss();
    void onTypingStop();
  }, [canWire, emojiOpen, locked, onTypingStop, setEmojiPanelOpen]);

  const handleSend = async () => {
    if (!canSend) return;
    const text = value.trim();
    try {
      setSending(true);
      let attachments: ChatAttachment[] | undefined;
      if (localPicks.length) {
        if (conversationId) {
          attachments = await chatService.uploadAttachments(
            conversationId,
            localPicks.map((p) => ({
              uri: p.uri,
              name: p.name,
              mimeType: p.mimeType,
            }))
          );
        } else if (teacherGuardianUploadContext) {
          attachments = await chatService.uploadTeacherGuardianAttachments(
            teacherGuardianUploadContext,
            localPicks.map((p) => ({
              uri: p.uri,
              name: p.name,
              mimeType: p.mimeType,
            }))
          );
        }
      }
      await onSend({
        content: text,
        attachments,
        replyToMessageId: replyTo?._id,
      });
      setValue('');
      setLocalPicks([]);
      setEmojiPanelOpen(false);
      void onTypingStop();
    } catch (e) {
      console.error('[ChatComposerExchange] send', e);
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
    }
  };

  const handleSendWislifeSticker = useCallback(
    async (code: string) => {
      const wire = formatChatWislifeStickerContent(code);
      if (!wire || locked || !canWire || sending) return;
      try {
        setSending(true);
        setEmojiPanelOpen(false);
        await onSend({ content: wire, replyToMessageId: replyTo?._id });
        void onTypingStop();
      } catch (e) {
        console.error('[ChatComposerExchange] wislife sticker', e);
        Alert.alert('Lỗi', 'Không thể gửi emoji.');
      } finally {
        setSending(false);
      }
    },
    [canWire, locked, onSend, sending, setEmojiPanelOpen, replyTo?._id, onTypingStop]
  );

  const showAttachToolbar =
    !locked && canWire && !value.trim() && localPicks.length === 0;

  const showSend = !locked && canWire && (value.trim().length > 0 || localPicks.length > 0);

  const replySnippet = replyTo ? replyQuoteSnippet(replyTo) : '';

  return (
    <View className="px-3 py-2">
      {replyTo ? (
        <View className="mb-2 flex-row items-center rounded-xl border border-[#0d9488]/25 bg-[#0d9488]/08 px-3 py-2">
          <View className="min-w-0 flex-1 border-l-4 border-[#0d9488] pl-2">
            <Text className="font-mulish-bold text-xs text-[#002855]/80">
              Trả lời {replyTo.senderSnapshot?.name || '…'}
            </Text>
            <Text className="mt-0.5 font-mulish-medium text-sm text-[#002855]" numberOfLines={2}>
              {replySnippet}
            </Text>
          </View>
          {onCancelReply ? (
            <Pressable onPress={onCancelReply} hitSlop={8} className="ml-2 p-1">
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {localPicks.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-2 max-h-20"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
          {localPicks.map((p) => (
            <View key={p.id} className="relative">
              {p.kind === 'image' ? (
                <Image source={{ uri: p.uri }} className="size-14 rounded-xl" />
              ) : p.kind === 'video' ? (
                <View className="size-14 items-center justify-center rounded-xl bg-gray-800">
                  <Ionicons name="play-circle" size={26} color="#fff" />
                  <Text className="mt-0.5 font-mulish-bold text-[9px] text-white">Video</Text>
                </View>
              ) : (
                <View className="h-14 min-w-[120px] max-w-[200px] justify-center rounded-xl bg-gray-200 px-2">
                  <Text numberOfLines={1} className="font-mulish-semibold text-xs text-[#002855]">
                    {p.name}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => removePick(p.id)}
                className="absolute -right-1 -top-1 size-6 items-center justify-center rounded-full bg-gray-800">
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View className="flex-row items-end">
        <View
          className="min-w-0 flex-1 flex-row items-end gap-2 rounded-full border border-teal-600/20 bg-white/95 px-1.5 py-1.5 shadow-sm"
          style={{ minHeight: 52 }}>
          <Pressable
            disabled={locked}
            onPress={() => void openCamera()}
            className="mb-0.5 size-11 shrink-0 items-center justify-center rounded-full active:opacity-90"
            style={{ backgroundColor: ORANGE_CAMERA }}>
            <Ionicons name="camera" size={22} color="#fff" />
          </Pressable>

          <TextInput
            ref={inputRef}
            value={value}
            editable={!locked}
            onFocus={() => {
              if (emojiOpen) {
                closeEmojiAfterKeyboardShowRef.current = true;
                return;
              }
              setEmojiPanelOpen(false);
            }}
            onChangeText={(t) => {
              setValue(t);
              if (!t.trim()) void onTypingStop();
              else onTyping();
            }}
            placeholder={locked ? 'Nhóm chỉ đọc' : placeholder}
            placeholderTextColor={INPUT_PLACEHOLDER_HEX}
            multiline
            maxLength={5000}
            className="max-h-28 min-h-10 flex-1 px-1 py-0 font-mulish-medium text-base text-[#0f172a]"
            style={{
              lineHeight: 22,
              textAlignVertical: 'center',
            }}
          />

          {showAttachToolbar ? (
            <View className="mb-0.5 flex-row shrink-0 items-center gap-0.5 pr-1">
              <Pressable
                disabled={locked}
                onPress={toggleEmojiPanel}
                className="size-10 items-center justify-center rounded-full active:bg-gray-100">
                <Ionicons name={emojiOpen ? 'happy' : 'happy-outline'} size={24} color={TEAL_ICON} />
              </Pressable>
              <Pressable
                disabled={locked}
                onPress={() => void openGallery()}
                className="size-10 items-center justify-center rounded-full active:bg-gray-100">
                <Ionicons name="images-outline" size={24} color={TEAL_ICON} />
              </Pressable>
              <Pressable
                disabled={locked}
                onPress={() => void openFile()}
                className="size-10 items-center justify-center rounded-full active:bg-gray-100">
                <Ionicons name="attach-outline" size={24} color={TEAL_ICON} />
              </Pressable>
            </View>
          ) : showSend ? (
            <Pressable
              disabled={sending || !canSend}
              onPress={() => void handleSend()}
              className="mb-0.5 size-11 shrink-0 items-center justify-center rounded-full active:opacity-90"
              style={{
                backgroundColor: sending || !canSend ? '#94a3b8' : TEAL_ICON,
              }}>
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>

      {emojiOpen ? (
        <View className="overflow-hidden" style={{ height: emojiPanelHeight, marginTop: EMOJI_PANEL_GAP }}>
          <ChatEmojiPickerPanel
            maxHeight={Math.max(160, emojiPanelHeight - 48)}
            showUnicodeTab={false}
            onSendWislifeSticker={handleSendWislifeSticker}
          />
        </View>
      ) : null}
    </View>
  );
}
