/**
 * Thanh nhập Trao đổi — cùng layout ChatComposer parent-portal: pill, camera, emoji panel, gallery, file, gửi teal.
 */
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  CHAT_MAX_ATTACHMENTS,
  type ChatAttachment,
  type ChatConversation,
  type ChatFormat,
  type ChatMention,
  type ChatMessage,
} from '../../../types/chat';
import { formatChatWislifeStickerContent } from '../../../utils/chatWislifeSticker';

import { formatChatDisplayName, replyQuoteSnippet } from '../exchangeChatThreadUtils';
import {
  buildMentionCandidates,
  findMentionTrigger,
  insertMention,
  syncMentions,
  type ChatMentionCandidate,
  type ChatMentionTrigger,
} from '../lib/chatMentions';
import {
  chatHighlightHex,
  shiftFormats,
  splitFormattedParts,
  trimFormats,
} from '../lib/chatFormats';
import { ChatFormattedText, marksToStyle } from './ChatFormattedText';
import { ChatEmojiPickerPanel } from './ChatEmojiPickerPanel';
import { ChatFormatToolbar } from './ChatFormatToolbar';
import { ChatVideoThumbnail } from './ChatVideoThumbnail';

/**
 * Cách cho người soạn thấy định dạng vừa áp.
 *
 * `false` (mặc định) — dải xem trước NGAY TRÊN ô nhập, ô nhập giữ nguyên là `<TextInput>` chữ
 * phẳng controlled như trước giờ. An toàn tuyệt đối: không đổi một chút nào hành vi gõ đang chạy.
 *
 * `true` — chữ hiện đúng định dạng ngay trong ô nhập (children `<Text>` của `TextInput`). Đẹp hơn
 * nhưng `TextInput` vừa nhận `value` vừa nhận children là chỗ Android ĐÃ TỪNG nhảy con trỏ khi
 * children đổi liên tục. Bật lên thì phải thử trên máy Android thật: gõ chèn vào GIỮA một đoạn
 * đã bôi đậm, kiểm tra con trỏ không nhảy về cuối.
 *
 * Đổi cờ này KHÔNG ảnh hưởng dữ liệu: `content` và `formats` gửi lên server giống hệt nhau.
 */
const RICH_COMPOSER_PREVIEW_INLINE = false;

const ORANGE_CAMERA = '#F05023';
const TEAL_ICON = '#0d9488';
const EMOJI_PANEL_GAP = 8;
const KEYBOARD_VERTICAL_OFFSET = 12;
const INPUT_PLACEHOLDER_HEX = '#64748B';
/** Trần đính kèm mỗi tin — tính chung ảnh + video + tệp (upload gửi 1 lượt). */
const MAX_LOCAL_PICKS = CHAT_MAX_ATTACHMENTS;

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
  /** Tên người được trả lời đã resolve (PH → "Tên PH (PHHS + HS)"). */
  replySenderLabel?: string;
  onCancelReply?: () => void;
  onTyping: () => void;
  onTypingStop: () => void;
  onEmojiOpenChange?: (open: boolean) => void;
  /** Hội thoại đang mở — nguồn danh sách gợi ý @ và quyền tag nhóm (server tính sẵn). */
  conversation?: ChatConversation | null;
  /** Email người đang đăng nhập — không gợi ý tự tag chính mình. */
  viewerEmail?: string;
  onSend: (payload: {
    content: string;
    attachments?: ChatAttachment[];
    replyToMessageId?: string;
    mentions?: ChatMention[];
    formats?: ChatFormat[];
  }) => Promise<void>;
  /** Viewer là GVCN/phó của nhóm lớp → hiện nút tạo bình chọn. */
  canCreatePoll?: boolean;
  onCreatePoll?: () => void;
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

/**
 * SIS-125: nén video trước khi upload để tránh vượt giới hạn dung lượng server và timeout.
 * react-native-compressor là native module → không có trong Expo Go, và nó tạo
 * NativeEventEmitter ngay lúc load module nên import tĩnh sẽ crash cả bundle.
 * Vì vậy require() lười trong try/catch: thiếu native module thì dùng file gốc — KHÔNG crash.
 */
async function compressVideoUri(uri: string): Promise<string> {
  try {
    const { Video: VideoCompressor } = require('react-native-compressor');
    const out = await VideoCompressor.compress(uri, { compressionMethod: 'auto' });
    return typeof out === 'string' && out.length > 0 ? out : uri;
  } catch (err) {
    console.warn('[ChatComposerExchange] nén video không khả dụng, dùng file gốc', err);
    return uri;
  }
}

export function ChatComposerExchange({
  locked,
  conversationId,
  teacherGuardianUploadContext,
  placeholder = 'Nhập tin nhắn',
  replyTo,
  replySenderLabel,
  onCancelReply,
  onTyping,
  onTypingStop,
  onEmojiOpenChange,
  conversation,
  viewerEmail,
  onSend,
  canCreatePoll,
  onCreatePoll,
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
  /** Nhắc tên (@): tag đã chèn, token đang gõ, và vị trí con trỏ mới nhất. */
  const [mentions, setMentions] = useState<ChatMention[]>([]);
  /** Định dạng chữ đang soạn — neo theo offset của `value`, cùng cấu trúc với web. */
  const [formats, setFormats] = useState<ChatFormat[]>([]);
  /**
   * Vùng bôi đen hiện tại. Thanh định dạng áp mark lên đúng dải này, nên phải theo dõi CẢ hai
   * đầu chứ không chỉ vị trí con trỏ như `caretRef`.
   */
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [mentionTrigger, setMentionTrigger] = useState<ChatMentionTrigger | null>(null);
  const caretRef = useRef(0);

  const mentionCandidates = useMemo(
    () => (mentionTrigger
      ? buildMentionCandidates({ conversation, query: mentionTrigger.query, viewerEmail })
      : []),
    [mentionTrigger, conversation, viewerEmail]
  );
  const mentionOpen = Boolean(mentionTrigger) && mentionCandidates.length > 0;

  /** Chọn một gợi ý: chèn `@Tên `, dời offset các tag đứng sau. */
  const pickMentionCandidate = useCallback(
    (candidate: ChatMentionCandidate) => {
      if (!mentionTrigger) return;
      const result = insertMention(value, mentionTrigger, candidate);
      const delta = result.text.length - value.length;
      const shifted = mentions.map((m) => (m.start >= mentionTrigger.start ? { ...m, start: m.start + delta } : m));
      setValue(result.text);
      setMentions(syncMentions(result.text, [...shifted, result.mention]));
      setFormats((prev) => (prev.length ? shiftFormats(value, result.text, prev) : prev));
      setMentionTrigger(null);
      caretRef.current = result.caret;
      // RN không cho set caret trực tiếp; giữ focus để người dùng gõ tiếp ngay sau tag.
      inputRef.current?.focus();
    },
    [mentions, mentionTrigger, value]
  );

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
      if (prev.length >= MAX_LOCAL_PICKS) {
        Alert.alert('Giới hạn', `Tối đa ${MAX_LOCAL_PICKS} tệp đính kèm.`);
        return prev;
      }
      return [...prev, localPickFromMediaAsset(a, 'camera')];
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
      selectionLimit: MAX_LOCAL_PICKS,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    setLocalPicks((prev) => {
      const remaining = MAX_LOCAL_PICKS - prev.length;
      if (remaining <= 0) {
        Alert.alert('Giới hạn', `Tối đa ${MAX_LOCAL_PICKS} tệp đính kèm.`);
        return prev;
      }
      const add = result
        .assets!.slice(0, remaining)
        .map((asset) => localPickFromMediaAsset(asset, 'media'));
      return [...prev, ...add];
    });
  }, [locked]);

  const openFile = useCallback(async () => {
    if (locked) return;
    // SIS-126: cho chọn NHIỀU tệp và CỘNG DỒN (trước đây chỉ 1 tệp và thay thế tệp cũ).
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    setLocalPicks((prev) => {
      const remaining = MAX_LOCAL_PICKS - prev.length;
      if (remaining <= 0) {
        Alert.alert('Giới hạn', `Tối đa ${MAX_LOCAL_PICKS} tệp đính kèm.`);
        return prev;
      }
      const add: LocalPick[] = result.assets!.slice(0, remaining).map((a) => ({
        id: newPickId(),
        uri: a.uri,
        name: a.name || 'file',
        mimeType: a.mimeType || guessMimeFromName(a.name || ''),
        kind: 'file',
      }));
      return [...prev, ...add];
    });
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
      // SIS-125: nén video (nếu có) trước khi upload để giảm dung lượng. Chạy trong lúc `sending`
      // (spinner nút gửi hiển thị như bình thường) — KHÔNG hiện trạng thái nén riêng cho người dùng.
      let picks: LocalPick[] = localPicks;
      if (localPicks.some((p) => p.kind === 'video')) {
        const processed: LocalPick[] = [];
        for (const p of localPicks) {
          processed.push(
            p.kind === 'video' ? { ...p, uri: await compressVideoUri(p.uri) } : p
          );
        }
        picks = processed;
      }
      let attachments: ChatAttachment[] | undefined;
      if (picks.length) {
        if (conversationId) {
          attachments = await chatService.uploadAttachments(
            conversationId,
            picks.map((p) => ({
              uri: p.uri,
              name: p.name,
              mimeType: p.mimeType,
            }))
          );
        } else if (teacherGuardianUploadContext) {
          attachments = await chatService.uploadTeacherGuardianAttachments(
            teacherGuardianUploadContext,
            picks.map((p) => ({
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
        // Server trim `content` ⇒ neo lại offset theo đúng chuỗi sắp gửi (cả tag lẫn định dạng).
        mentions: syncMentions(text, mentions),
        formats: trimFormats(value, formats),
      });
      setValue('');
      setMentions([]);
      setFormats([]);
      setSelection({ start: 0, end: 0 });
      setMentionTrigger(null);
      setLocalPicks([]);
      setEmojiPanelOpen(false);
      void onTypingStop();
    } catch (e) {
      console.error('[ChatComposerExchange] send', e);
      // SIS-125: ưu tiên thông báo cụ thể từ server (vd "Video quá lớn (tối đa 100MB)").
      const raw = e instanceof Error ? e.message : '';
      const friendly =
        raw && !raw.startsWith('HTTP ') && !raw.startsWith('Invalid JSON')
          ? raw
          : 'Không thể gửi tin nhắn.';
      Alert.alert('Lỗi', friendly);
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

  const showSend = !locked && canWire && (value.trim().length > 0 || localPicks.length > 0);

  /**
   * Toolbar đính kèm luôn hiện: chọn xong 1 tệp/ảnh vẫn phải bấm thêm được cái
   * nữa (trước đây toolbar bị thay hẳn bằng nút Gửi nên hết đường thêm).
   * Nút bình chọn nhường chỗ cho nút Gửi để pill không bị chật.
   */
  const showAttachToolbar = !locked && canWire;
  /**
   * Camera / emoji / ảnh / tệp / bình chọn chỉ hiện khi ô soạn TRỐNG — bắt đầu gõ là ẩn hết,
   * nhường toàn bộ bề ngang cho chữ. Muốn đính kèm thì xoá chữ đi, các nút hiện lại ngay.
   */
  const showQuickActions = showAttachToolbar && !value.trim();
  const showPoll = canCreatePoll && !showSend;

  const replySnippet = replyTo ? replyQuoteSnippet(replyTo) : '';

  return (
    <View className="px-3 py-2">
      {replyTo ? (
        <View className="mb-2 flex-row items-center rounded-xl border border-[#0d9488]/25 bg-[#0d9488]/08 px-3 py-2">
          <View className="min-w-0 flex-1 border-l-4 border-[#0d9488] pl-2">
            <Text className="font-mulish-bold text-xs text-[#002855]/80">
              Trả lời{' '}
              {replySenderLabel ||
                formatChatDisplayName(replyTo.senderSnapshot?.name) ||
                '…'}
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
                <View className="overflow-hidden rounded-xl">
                  <ChatVideoThumbnail uri={p.uri} width={56} height={56} playIconSize={26} />
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

      {/* Gợi ý nhắc tên (@) — nổi trên ô nhập, chạm để chèn. */}
      {mentionOpen ? (
        <View className="mb-1 max-h-56 overflow-hidden rounded-2xl border border-teal-600/20 bg-white shadow-sm">
          <ScrollView keyboardShouldPersistTaps="always">
            {mentionCandidates.map((candidate) => (
              <Pressable
                key={candidate.key}
                onPress={() => pickMentionCandidate(candidate)}
                className="flex-row items-center gap-2 px-3 py-2 active:bg-gray-100">
                {candidate.isGroup ? (
                  <View className="size-8 items-center justify-center rounded-full bg-teal-50">
                    <Ionicons
                      name={candidate.type === 'everyone' ? 'at-outline' : 'people-outline'}
                      size={16}
                      color={TEAL_ICON}
                    />
                  </View>
                ) : candidate.avatarUrl ? (
                  <Image source={{ uri: candidate.avatarUrl }} className="size-8 rounded-full" />
                ) : (
                  <View className="size-8 items-center justify-center rounded-full bg-gray-200">
                    <Ionicons name="person-outline" size={16} color="#64748B" />
                  </View>
                )}
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="font-mulish-semibold text-sm text-[#0f172a]">
                    {candidate.name}
                  </Text>
                  {candidate.subtitle ? (
                    <Text numberOfLines={1} className="font-mulish-medium text-xs text-gray-500">
                      {candidate.subtitle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/*
        Dải xem trước: chỉ hiện khi tin THỰC SỰ có định dạng, nên tin thường không bị chiếm chỗ.
        Bật RICH_COMPOSER_PREVIEW_INLINE thì bỏ dải này vì chữ đã hiện đúng ngay trong ô nhập.
      */}
      {!RICH_COMPOSER_PREVIEW_INLINE && !locked && formats.length > 0 ? (
        <View className="mx-2 mb-1 rounded-lg bg-gray-50 px-3 py-2">
          <Text className="mb-0.5 font-mulish-medium text-[10px] uppercase text-gray-400">
            Xem trước
          </Text>
          <ChatFormattedText
            content={value}
            formats={formats}
            className="font-mulish-medium text-sm text-gray-900"
            disableLinks
            numberOfLines={3}
          />
        </View>
      ) : null}

      <View className="flex-row items-end">
        <View
          className="min-w-0 flex-1 flex-row items-end gap-2 border border-teal-600/20 bg-white/95 px-1.5 py-1.5 shadow-sm"
          style={{
            minHeight: 52,
            /**
             * KHÔNG dùng `rounded-full`: bán kính khi đó bằng NỬA CHIỀU CAO, nên tin nhiều dòng
             * làm hai cạnh cong vào rất sâu và các nút tròn 44px thò hẳn ra ngoài khung.
             * Chốt ở 26 = nửa chiều cao tối thiểu ⇒ một dòng vẫn tròn y như cũ, nhiều dòng thì
             * cạnh thẳng và nút nằm gọn bên trong.
             */
            borderRadius: 26,
          }}>
          {showQuickActions ? (
            <Pressable
              disabled={locked}
              onPress={() => void openCamera()}
              className="mb-0.5 size-11 shrink-0 items-center justify-center rounded-full active:opacity-90"
              style={{ backgroundColor: ORANGE_CAMERA }}>
              <Ionicons name="camera" size={22} color="#fff" />
            </Pressable>
          ) : null}

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
              // Con trỏ sau khi gõ: RN bắn onChangeText TRƯỚC onSelectionChange nên tự suy ra
              // vị trí mới từ độ dài thay đổi, nếu không token `@` sẽ tính theo caret cũ.
              const nextCaret = Math.max(0, Math.min(caretRef.current + (t.length - value.length), t.length));
              caretRef.current = nextCaret;
              setValue(t);
              setMentions((prev) => (prev.length ? syncMentions(t, prev) : prev));
              // Định dạng không có token để dò lại như mention ⇒ phải dịch offset theo phần đã sửa.
              setFormats((prev) => (prev.length ? shiftFormats(value, t, prev) : prev));
              setMentionTrigger(findMentionTrigger(t, nextCaret));
              if (!t.trim()) void onTypingStop();
              else onTyping();
            }}
            onSelectionChange={(event) => {
              const next = event.nativeEvent.selection;
              caretRef.current = next.end;
              setSelection({ start: next.start, end: next.end });
            }}
            placeholder={locked ? 'Nhóm chỉ đọc' : placeholder}
            placeholderTextColor={INPUT_PLACEHOLDER_HEX}
            multiline
            maxLength={5000}
            className="max-h-28 min-h-10 flex-1 px-1 py-0 font-mulish-medium text-base text-[#0f172a]"
            style={{
              lineHeight: 22,
              textAlignVertical: 'center',
            }}>
            {/*
              RN không có contenteditable, nhưng `<TextInput>` nhận children `<Text>` có style —
              nhờ vậy chữ hiện ĐÚNG định dạng ngay trong ô soạn thay vì phải xem trước ở chỗ khác.
              `value` vẫn giữ để ô là controlled; children chỉ quyết định phần hiển thị.

              NẾU Android nhảy con trỏ khi gõ giữa đoạn đã định dạng: đặt
              RICH_COMPOSER_PREVIEW_INLINE = false ở đầu file để quay về ô chữ phẳng — nội dung và
              `formats` gửi đi KHÔNG đổi, chỉ mất phần xem trước tại chỗ.
            */}
            {RICH_COMPOSER_PREVIEW_INLINE && formats.length
              ? splitFormattedParts(value, undefined, formats).map((part, index) => (
                  <Text
                    key={index}
                    style={{
                      // Dùng chung helper với bong bóng: in đậm/nghiêng phải đổi `fontFamily`,
                      // `fontWeight` không có tác dụng khi font đã chỉ định theo tên họ.
                      ...marksToStyle(part.marks),
                      // <TextInput> KHÔNG nhúng <View> làm children được, nên nền tô sáng ở
                      // ĐÂY buộc phải là dải vuông. Dải "Xem trước" bên trên mới bo góc.
                      ...(chatHighlightHex(part.marks)
                        ? { backgroundColor: chatHighlightHex(part.marks) }
                        : null),
                    }}>
                    {part.text}
                  </Text>
                ))
              : undefined}
          </TextInput>

          {showQuickActions ? (
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
              {/* Bình chọn — chỉ GVCN/phó của nhóm lớp (backend kiểm lại theo scope Frappe). */}
              {showPoll ? (
                <Pressable
                  disabled={locked}
                  onPress={onCreatePoll}
                  className="size-10 items-center justify-center rounded-full active:bg-gray-100">
                  <Ionicons name="stats-chart-outline" size={22} color={TEAL_ICON} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {showSend ? (
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

      {/*
        Thanh định dạng nằm DƯỚI ô nhập, không phải trên.
        Bôi đen chữ là Android tự bung menu hệ thống ("Dịch / Cắt / Sao chép") ngay PHÍA TRÊN vùng
        chọn — đúng chỗ thanh này từng đứng, nên nó bị che sạch đúng lúc cần dùng nhất. Đặt xuống
        dưới thì hai thứ không tranh chỗ nữa.
        Chỉ hiện khi đã có chữ — chat vẫn phải gõ nhanh, không chiếm chỗ sẵn.
      */}
      {!locked && value.trim().length > 0 ? (
        <ChatFormatToolbar
          text={value}
          formats={formats}
          selection={selection}
          disabled={locked || sending}
          onChange={setFormats}
        />
      ) : null}

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
