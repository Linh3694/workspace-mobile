/**
 * Trao đổi chi tiết — UI thread khớp GuardianChatScreen (parent-portal): wallpaper, blur chrome, bubble teal, separator, reply, overlay.
 */
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackActions, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { InlineToast, useInlineToast } from '../../components/Common';
import { useAuth } from '../../context/AuthContext';
import { setFocusedChatConversationId } from '../../lib/chatNotificationFocus';
import { ROUTES } from '../../constants/routes';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { CHAT_EVENTS } from '../../realtime/chatEvents';
import { chatService } from '../../services/chatService';
import type {
  ChatAttachment,
  ChatConversation,
  ChatEmoji,
  ChatFormat,
  ChatMention,
  ChatMessage,
  ChatPoll,
  ChatPollVotersData,
  CreateChatPollPayload,
  UpdateChatPollPayload,
  PinnedMessageSnapshot,
} from '../../types/chat';

import {
  CHAT_BUBBLE_MAX_WIDTH_RATIO,
  CHAT_INITIAL_PAGE_LIMIT,
  CHAT_LOAD_MORE_LIMIT,
  RECALL_WINDOW_MS,
  REMOTE_TYPING_TTL_MS,
  applyLocalReactionToggleViewer,
  applyPollUpdate,
  buildChatRows,
  buildMessageThreadMeta,
  conversationHeaderTitle,
  conversationSubtitle,
  formatChatDisplayName,
  mergeIncomingMessagesPage,
  mergePollVoters,
  mergeOlderMessagesDeduped,
  normalizeMongoId,
  overlayPreviewPlainText,
  replyQuoteSnippet,
  resolveChatSenderAvatarUrl,
  resolveChatSenderDisplayName,
  type ChatListRow,
} from './exchangeChatThreadUtils';
import { ChatComposerExchange } from './components/ChatComposerExchange';
import { CreatePollSheet } from './components/CreatePollSheet';
import { MessageReadersSheet } from './components/MessageReadersSheet';
import { PollVotersSheet } from './components/PollVotersSheet';
import { ReactionViewersSheet } from './components/ReactionViewersSheet';
import { listMessageReactionViewers } from './reactionViewerModel';
import { ExchangeGroupChatAvatar } from './components/ExchangeGroupChatAvatar';
import { TypingDotsLine } from './components/TypingDotsLine';
import { ExchangeMessageBubble } from './components/ExchangeMessageBubble';
import { MessageActionOverlay, type MessageActionAnchor } from './components/MessageActionOverlay';
import { PinnedMessageBanner } from './components/PinnedMessageBanner';
import { isViewerHomeroom } from './exchangeInfoUtils';
import { resolveParticipantAvatarUrl } from './lib/chatMemberAvatar';
import { useLanguage } from '../../hooks/useLanguage';

const CHAT_THREAD_WALLPAPER = require('../../../assets/images/chat-background.png');

/** Meta mặc định khi chưa có trong map gom nhóm bubble. */
const DEFAULT_THREAD_META = { showName: true, showAvatar: true, showTimestamp: true } as const;

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.EXCHANGE_CHAT>;

function isLikelyMongoObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(String(id || '').trim());
}

function isMineMessage(msg: ChatMessage, email?: string | null): boolean {
  const e = String(email || '').trim().toLowerCase();
  const m = String(msg.senderSnapshot?.email || '').trim().toLowerCase();
  return msg.senderSnapshot?.role === 'teacher' && !!e && !!m && e === m;
}

/**
 * Viewer chỉ-xem (observer) — giống cờ `readOnly` bên web (TeacherMessagingPage).
 * App này là staff-only (GV/BOD): participant thực sự nằm trong `conversation.teachers[]`.
 * BOD mở hội thoại của lớp không phải mình dạy → không có trong teachers[] → chỉ được xem.
 * Backend cũng chặn write của observer (markRead/typing/send → 403 "Tài khoản chỉ có quyền xem").
 * teachers[] rỗng/không rõ → KHÔNG khoá (tránh chặn nhầm participant thật khi snapshot thiếu).
 */
function isConversationObserver(
  conversation: ChatConversation | null,
  email?: string | null
): boolean {
  const e = String(email || '').trim().toLowerCase();
  if (!e || !conversation) return false;
  const teachers = conversation.teachers || [];
  if (teachers.length === 0) return false;
  return !teachers.some((tt) => String(tt.email || '').trim().toLowerCase() === e);
}

function resolveBubbleAvatarUri(
  message: ChatMessage,
  isMine: boolean,
  teacherAvatar?: string | null,
  teacherEmail?: string | null,
  conversation?: ChatConversation | null
): string {
  if (isMine) {
    return resolveParticipantAvatarUrl(
      teacherAvatar || message.senderSnapshot?.avatarUrl,
      teacherEmail || message.senderSnapshot?.name || 'gv'
    );
  }
  // Roster hội thoại có ảnh PH hiện tại — snapshot lúc gửi hay trống.
  const fromRoster = resolveChatSenderAvatarUrl(conversation, {
    avatarUrl: message.senderSnapshot?.avatarUrl,
    email: message.senderSnapshot?.email,
    role: message.senderSnapshot?.role,
  });
  return resolveParticipantAvatarUrl(
    fromRoster,
    message.senderSnapshot?.email || message.senderSnapshot?.name || 'ph'
  );
}

export default function ExchangeChatScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();
  const overlayBubbleMaxWidth = Math.round(screenWidth * CHAT_BUBBLE_MAX_WIDTH_RATIO);

  const conversationIdFromRoute = String(route.params?.conversationId || '').trim();
  const isDraftTeacherGuardianThread = conversationIdFromRoute === 'new';
  const draftClassId = String(route.params?.classId ?? '').trim();
  const draftSchoolYearId = String(route.params?.schoolYearId ?? '').trim();
  const draftTeacherId = String(route.params?.teacherId ?? '').trim();
  const draftGuardianId = String(route.params?.guardianId ?? '').trim();
  /**
   * Mở từ thông báo (SIS-180): tin nhắn cần cuộn tới + nháy viền. Giữ trong ref để
   * `loadExistingThread` gọi kèm `around` và effect cuộn tiêu thụ đúng MỘT lần.
   */
  const focusMessageIdFromRoute = String(route.params?.messageId ?? '').trim();
  const pendingFocusMessageIdRef = useRef<string | null>(focusMessageIdFromRoute || null);
  /** Định danh cặp GV↔PH của lần mở này — dùng để không mở lại chính nó lần thứ hai. */
  const draftKey = `${draftClassId}|${draftSchoolYearId}|${draftTeacherId}|${draftGuardianId}`;

  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messagesPage, setMessagesPage] = useState(1);
  const [typingNames, setTypingNames] = useState<Record<string, string>>({});
  /** Nháy viền bubble khi cuộn tới tin ghim. */
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  /** Toast trong màn, hiện ngay trên thanh soạn tin. */
  const { toast, showToast, hideToast } = useInlineToast();

  const [actionTarget, setActionTarget] = useState<{
    message: ChatMessage;
    anchor: MessageActionAnchor;
  } | null>(null);

  const highlightClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList<ChatListRow>>(null);

  const dedupeRef = useRef(new Set());

  const mongoConversationIdForApi = useMemo(() => {
    const fromDoc = normalizeMongoId(conversation?._id);
    if (fromDoc) return fromDoc;
    if (isDraftTeacherGuardianThread) return '';
    return isLikelyMongoObjectId(conversationIdFromRoute) ? conversationIdFromRoute : '';
  }, [conversation?._id, conversationIdFromRoute, isDraftTeacherGuardianThread]);

  const convIdRef = useRef(conversationIdFromRoute);
  const conversationRef = useRef<ChatConversation | null>(null);

  const teacherEmail = user?.email;
  const teacherAvatar = user?.avatar;
  const teacherDisplayName = formatChatDisplayName(user?.fullname) || user?.email || 'Bạn';

  const chatViewerEmails = useMemo(
    () => [String(teacherEmail || '').trim()].filter(Boolean),
    [teacherEmail]
  );

  /** Viewer chỉ-xem (observer/BOD không phải participant) — giống readOnly bên web. */
  const viewerReadOnly = useMemo(
    () => isConversationObserver(conversation, teacherEmail),
    [conversation, teacherEmail]
  );

  /** GVCN/phó của nhóm lớp → được tạo/kết thúc bình chọn (backend kiểm lại theo scope Frappe). */
  const viewerIsHomeroom = useMemo(
    () => isViewerHomeroom(conversation, teacherEmail),
    [conversation, teacherEmail]
  );

  /** Bình chọn: sheet tạo, sheet danh sách người bầu, và các tin đang chờ server phản hồi. */
  const [pollSheetOpen, setPollSheetOpen] = useState(false);
  const [creatingPoll, setCreatingPoll] = useState(false);
  /** Tin bình chọn đang mở sheet SỬA — cùng một CreatePollSheet, chỉ khác `mode`. */
  const [editPollFor, setEditPollFor] = useState<string | null>(null);
  const [savingPoll, setSavingPoll] = useState(false);
  const [votersSheetFor, setVotersSheetFor] = useState<string | null>(null);
  /** Tin đang mở sheet "Ai đã bày tỏ cảm xúc" (chạm chip dưới bong bóng). */
  const [reactionsSheetFor, setReactionsSheetFor] = useState<string | null>(null);
  /** Tin đang mở sheet "Người đã đọc". */
  const [readersSheetFor, setReadersSheetFor] = useState<string | null>(null);
  const [pendingPollIds, setPendingPollIds] = useState<Set<string>>(new Set());

  /** Số thành viên trừ người gửi — mẫu số "Đã đọc N/M". */
  const readReceiptParticipantCount = useMemo(() => {
    const n =
      (conversation?.teachers || []).filter((x) => !x.removedAt).length +
      (conversation?.guardians || []).filter((x) => !x.removedAt).length;
    return Math.max(0, n - 1);
  }, [conversation]);

  /**
   * Chiều cao bàn phím trên Android — Expo SDK 54 bật edge-to-edge (`edgeToEdgeEnabled=true`) nên
   * `windowSoftInputMode=adjustResize` KHÔNG còn thu nhỏ cửa sổ: bàn phím phủ lên UI và che mất
   * thanh soạn tin. `KeyboardAvoidingView` tính chồng lấn theo `screenY` của sự kiện bàn phím —
   * ở chế độ này screenY vẫn là đáy màn hình nên ra 0, không nâng gì cả; phải tự đệm theo chiều cao.
   * RN báo `height` = insets bàn phím ĐÃ TRỪ thanh điều hướng, mà SafeAreaView `edges=['bottom']`
   * cũng đã chừa đúng phần đó → đệm bằng `height` là khớp mép bàn phím (giống BottomSheetModal,
   * AIAssistantScreen). iOS giữ nguyên `KeyboardAvoidingView behavior="padding"`.
   */
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setAndroidKeyboardHeight(Math.max(0, Math.round(e.endCoordinates?.height ?? 0)));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setAndroidKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /** TTL typing đối phương — đồng bộ REMOTE_TYPING_TTL_MS phía Guardian. */
  const remoteTypingTtlTimersRef = useRef({});

  const messagesPageRef = useRef(1);
  const loadOlderLockRef = useRef(false);
  const selectedIdRef = useRef(mongoConversationIdForApi);
  /** Cặp GV↔PH đã mở xong — chặn effect chạy lại (do `_id` vừa resolve) mở lại từ đầu. */
  const openedDraftKeyRef = useRef<string | null>(null);

  useEffect(() => {
    messagesPageRef.current = messagesPage;
  }, [messagesPage]);

  useEffect(() => {
    selectedIdRef.current = mongoConversationIdForApi;
    convIdRef.current = mongoConversationIdForApi || conversationIdFromRoute;
    conversationRef.current = conversation;
  }, [mongoConversationIdForApi, conversationIdFromRoute, conversation]);

  const chatListRows = useMemo(() => buildChatRows(messages, new Date()), [messages]);

  const reversedChatRows = useMemo(() => [...chatListRows].reverse(), [chatListRows]);

  const messageThreadMetaById = useMemo(() => buildMessageThreadMeta(messages), [messages]);

  const overlayMessage = useMemo(() => {
    if (!actionTarget) return null;
    return messages.find((m) => m._id === actionTarget.message._id) ?? actionTarget.message;
  }, [actionTarget, messages]);

  const overlayReplyQuote = useMemo(() => {
    if (!overlayMessage?.replyTo) return undefined;
    const tgt = messages.find((m) => m._id === overlayMessage.replyTo?.messageId);
    return tgt?.recalledAt
      ? 'Tin nhắn đã thu hồi'
      : tgt
        ? replyQuoteSnippet(tgt)
        : overlayMessage.replyTo.content;
  }, [overlayMessage, messages]);

  const overlayIsMine = overlayMessage ? isMineMessage(overlayMessage, teacherEmail) : false;

  const overlayThreadMeta = useMemo(() => {
    if (!overlayMessage) return DEFAULT_THREAD_META;
    return messageThreadMetaById.get(overlayMessage._id) ?? DEFAULT_THREAD_META;
  }, [overlayMessage, messageThreadMetaById]);

  const overlayShowSenderName =
    !overlayIsMine && (Platform.OS === 'web' || overlayThreadMeta.showName);
  const overlayShowTimestamp = Platform.OS === 'web' || overlayThreadMeta.showTimestamp;

  const overlayShowRecallButton = useMemo(() => {
    if (locked) return false;
    if (!overlayMessage || !overlayIsMine) return false;
    if (overlayMessage.recalledAt) return false;
    return true;
  }, [locked, overlayMessage, overlayIsMine]);

  /** Còn trong 15 phút — BE `RECALL_WINDOW_MS`. */
  const overlayCanRecall = useMemo(() => {
    if (!overlayShowRecallButton || !overlayMessage) return false;
    return Date.now() - new Date(overlayMessage.createdAt).getTime() <= RECALL_WINDOW_MS;
  }, [overlayShowRecallButton, overlayMessage]);

  const overlayIsPinned = useMemo(() => {
    if (!overlayMessage || !conversation?.pinnedMessage?.messageId) return false;
    return (
      normalizeMongoId(overlayMessage._id) ===
      normalizeMongoId(conversation.pinnedMessage.messageId)
    );
  }, [overlayMessage, conversation?.pinnedMessage?.messageId]);

  useEffect(() => {
    setActionTarget(null);
    setHighlightedMessageId(null);
    if (highlightClearTimerRef.current) {
      clearTimeout(highlightClearTimerRef.current);
      highlightClearTimerRef.current = null;
    }
  }, [conversationIdFromRoute]);

  /**
   * Nạp lịch sử + markRead + join phòng cho hội thoại ĐÃ có trên server.
   * Dùng chung cho thread mở thẳng theo id và cho chat 1-1 vừa resolve được từ nháp.
   */
  const loadExistingThread = useCallback(
    async (cid: string) => {
      setLoading(true);
      setMessagesPage(1);
      messagesPageRef.current = 1;
      setHasMoreMessages(false);

      // CRITICAL: chỉ getMessages mới được phép bung lỗi "Không tải được lịch sử chat".
      let loadedConversation: ChatConversation | null = null;
      try {
        // Mở từ thông báo: xin server nạp liền mạch tới tận tin đích, kể cả khi tin đã cũ.
        const around = pendingFocusMessageIdRef.current || '';
        const data = await chatService.getMessages(
          cid,
          1,
          CHAT_INITIAL_PAGE_LIMIT,
          around ? { around } : undefined
        );
        const sorted = [...(data.messages || [])].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setMessages(sorted);
        setConversation(data.conversation);
        loadedConversation = data.conversation;
        setHasMoreMessages(Boolean(data.pagination?.hasNext));

        // Trang kế phải bám theo SỐ TIN ĐÃ NẠP, không phải theo `currentPage` của server:
        // lần đầu dùng CHAT_INITIAL_PAGE_LIMIT còn tải thêm dùng CHAT_LOAD_MORE_LIMIT, và khi
        // có `around` server trả nhiều trang gộp lại. Tính sai là kéo lên mãi không ra tin mới.
        const nextBasePage = Math.max(1, Math.floor(sorted.length / CHAT_LOAD_MORE_LIMIT));
        setMessagesPage(nextBasePage);
        messagesPageRef.current = nextBasePage;

        if (around && data.pagination?.aroundResolved === false) {
          pendingFocusMessageIdRef.current = null;
          showToast('Không tìm thấy tin nhắn — có thể đã thu hồi hoặc quá cũ', 'error');
        }
      } catch (e) {
        console.warn('[ExchangeChat] getMessages failed', e);
        Alert.alert(t('common.error'), t('exchange.load_thread_error'));
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }

      // markRead: chỉ khi là participant thực sự. Observer/BOD gọi markRead → 403
      // "Tài khoản chỉ có quyền xem" (giống web bỏ markRead khi readOnly). Best-effort.
      if (!isConversationObserver(loadedConversation, teacherEmail)) {
        try {
          const updated = await chatService.markRead(cid);
          setConversation(updated);
        } catch (e) {
          console.warn('[ExchangeChat] markRead (non-fatal)', e);
        }
      }

      // socket join: best-effort, không được chặn việc hiển thị lịch sử chat.
      try {
        const socket = await chatService.getSocket();
        socket?.emit(CHAT_EVENTS.JOIN, { conversationId: String(cid) });
      } catch (e) {
        console.warn('[ExchangeChat] socket join (non-fatal)', e);
      }
    },
    [teacherEmail, t, showToast]
  );

  const openThread = useCallback(async () => {
    if (isDraftTeacherGuardianThread) {
      if (!draftClassId || !draftSchoolYearId || !draftTeacherId || !draftGuardianId) {
        setLoading(false);
        Alert.alert(t('common.error'), t('exchange.load_thread_error'));
        navigation.goBack();
        return;
      }
      // Resolve xong là `_id` có giá trị → effect chạy lại. Cặp này mở rồi thì thôi, khỏi làm lại.
      if (openedDraftKeyRef.current === draftKey) return;
      openedDraftKeyRef.current = draftKey;

      setLoading(true);
      setMessagesPage(1);
      messagesPageRef.current = 1;
      setMessages([]);
      setHasMoreMessages(false);

      let conv: ChatConversation | null = null;
      try {
        conv = await chatService.openTeacherGuardianChat({
          teacherId: draftTeacherId,
          guardianId: draftGuardianId,
          classId: draftClassId,
          schoolYearId: draftSchoolYearId,
        });
        setConversation(conv);
      } catch (e) {
        console.warn(e);
        openedDraftKeyRef.current = null;
        setLoading(false);
        Alert.alert(t('common.error'), t('exchange.load_thread_error'));
        navigation.goBack();
        return;
      }

      // Endpoint là get-or-create: cặp đã từng chat thì server trả về hội thoại CŨ, phải nạp lịch sử
      // của nó — bỏ qua bước này là màn trắng trơn dù đoạn chat đầy tin. Điều kiện bám theo id Mongo
      // (giống mongoConversationIdForApi) chứ không theo cờ isDraft: có id thật thì getMessages chạy
      // được, và nháp thật thì không có id nên rơi xuống nhánh dưới, rỗng là đúng.
      const existingId = normalizeMongoId(conv?._id);
      if (isLikelyMongoObjectId(existingId)) {
        await loadExistingThread(existingId);
      } else {
        setLoading(false);
      }
      return;
    }

    const cid = isLikelyMongoObjectId(conversationIdFromRoute)
      ? conversationIdFromRoute
      : '';
    if (!cid) {
      setLoading(false);
      return;
    }

    await loadExistingThread(cid);
  }, [
    isDraftTeacherGuardianThread,
    draftClassId,
    draftSchoolYearId,
    draftTeacherId,
    draftGuardianId,
    draftKey,
    conversationIdFromRoute,
    loadExistingThread,
    navigation,
    t,
  ]);

  const loadMoreMessages = useCallback(async () => {
    const mongoId = mongoConversationIdForApi;
    if (
      !mongoId ||
      loadOlderLockRef.current ||
      loadingMore ||
      loading ||
      !hasMoreMessages
    ) {
      return;
    }
    loadOlderLockRef.current = true;
    setLoadingMore(true);
    const pageToLoad = messagesPageRef.current + 1;
    try {
      const data = await chatService.getMessages(mongoId, pageToLoad, CHAT_LOAD_MORE_LIMIT);
      if (String(selectedIdRef.current).trim() !== String(mongoId).trim()) return;
      setMessages((prev) => mergeOlderMessagesDeduped(data.messages || [], prev));
      setMessagesPage(pageToLoad);
      messagesPageRef.current = pageToLoad;
      setHasMoreMessages(Boolean(data.pagination?.hasNext));
    } catch (e) {
      console.warn('[ExchangeChat] loadMoreMessages', e);
    } finally {
      loadOlderLockRef.current = false;
      setLoadingMore(false);
    }
  }, [mongoConversationIdForApi, hasMoreMessages, loadingMore, loading]);

  useEffect(() => {
    setFocusedChatConversationId(mongoConversationIdForApi || null);
    void openThread();
    return () => {
      setFocusedChatConversationId(null);
    };
  }, [conversationIdFromRoute, mongoConversationIdForApi, openThread]);

  const clearRemoteTypingTtl = (userId: string) => {
    const t = remoteTypingTtlTimersRef.current[userId];
    if (t) clearTimeout(t);
    delete remoteTypingTtlTimersRef.current[userId];
  };

  /** Realtime: cùng tên sự kiện với parent-portal / social-service. */
  useEffect(() => {
    let mounted = true;
    let off;

    const run = async () => {
      const socket = await chatService.getSocket();
      if (!socket || !mounted) return;

      const onMsg = ({ conversation: conv, message }) => {
        const openCid = normalizeMongoId(convIdRef.current);
        const incomingCid = normalizeMongoId(conv._id);
        if (!incomingCid || incomingCid !== openCid) return;
        const mid = normalizeMongoId(message._id);
        const key = `${incomingCid}:${mid}`;
        if (dedupeRef.current.has(key)) return;
        dedupeRef.current.add(key);
        if (dedupeRef.current.size > 400) dedupeRef.current.clear();
        setMessages((prev) => {
          const exists = prev.some((m) => normalizeMongoId(m._id) === mid);
          if (exists) {
            return prev.map((m) => (normalizeMongoId(m._id) === mid ? message : m));
          }
          return [...prev, message].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        setConversation(conv);
      };

      const onReaction = (payload) => {
        if (normalizeMongoId(payload.conversationId) !== normalizeMongoId(convIdRef.current)) return;
        const mid = normalizeMongoId(payload.messageId);
        setMessages((prev) =>
          prev.map((m) =>
            normalizeMongoId(m._id) === mid ? { ...m, reactions: payload.reactions } : m
          )
        );
      };

      const onRecall = ({ conversationId: cid, messageId, recalledAt }) => {
        if (normalizeMongoId(cid) !== normalizeMongoId(convIdRef.current)) return;
        const mid = normalizeMongoId(messageId);
        setMessages((prev) =>
          prev.map((m) => (normalizeMongoId(m._id) === mid ? { ...m, recalledAt } : m))
        );
      };

      // Ai đó bỏ phiếu / kết thúc bình chọn. Payload broadcast KHÔNG kèm myVote (một payload cho
      // mọi người xem) nên applyPollUpdate giữ lại lựa chọn của chính mình.
      const onPoll = (payload: {
        conversationId?: string;
        messageId?: string;
        poll: ChatPoll;
      }) => {
        if (normalizeMongoId(payload?.conversationId) !== normalizeMongoId(convIdRef.current)) {
          return;
        }
        const mid = normalizeMongoId(payload?.messageId);
        setMessages((prev) =>
          prev.map((m) =>
            normalizeMongoId(m._id) === mid
              ? { ...m, poll: applyPollUpdate(m.poll, payload.poll) }
              : m
          )
        );
      };

      // Poll ẩn danh: danh tính người bầu đi riêng bằng event chỉ-GV, không nằm trong broadcast
      // chung. Trộn vào thẻ để avatar dưới từng phương án không bị mất sau mỗi lượt bỏ phiếu.
      const onPollVoters = (payload: ChatPollVotersData) => {
        const mid = normalizeMongoId(payload?.messageId);
        if (!mid) return;
        setMessages((prev) =>
          prev.map((m) =>
            normalizeMongoId(m._id) === mid ? { ...m, poll: mergePollVoters(m.poll, payload) } : m
          )
        );
      };

      const onConversationPinned = (payload: {
        conversationId?: string;
        pinnedMessage: PinnedMessageSnapshot | null;
      }) => {
        if (
          normalizeMongoId(payload?.conversationId) !== normalizeMongoId(convIdRef.current)
        ) {
          return;
        }
        setConversation((prev) =>
          prev ? { ...prev, pinnedMessage: payload.pinnedMessage ?? null } : prev
        );
      };

      const onTyping = ({
        conversationId: cid,
        userId,
        senderEmail,
        name,
        isTyping,
      }) => {
        if (normalizeMongoId(cid) !== normalizeMongoId(convIdRef.current)) return;
        const sender = String(senderEmail || '').trim().toLowerCase();
        const me = String(teacherEmail || '').trim().toLowerCase();
        if (sender && me && sender === me) return;
        const key = userId || sender || name || 'peer';
        if (isTyping) {
          clearRemoteTypingTtl(key);
          const portalGuardian = sender.endsWith('@parent.wellspring.edu.vn');
          const displayName = (
            portalGuardian
              ? resolveChatSenderDisplayName(conversationRef.current, {
                  name,
                  email: sender,
                  role: 'guardian',
                })
              : formatChatDisplayName(name) || sender || 'Phụ huynh'
          ).trim();
          setTypingNames((prev) => ({ ...prev, [key]: displayName }));
          remoteTypingTtlTimersRef.current[key] = setTimeout(() => {
            delete remoteTypingTtlTimersRef.current[key];
            setTypingNames((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }, REMOTE_TYPING_TTL_MS);
        } else {
          clearRemoteTypingTtl(key);
          setTypingNames((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      };

      /** GVCN/phó khóa/mở khóa nhóm ở thiết bị khác — cập nhật subtitle ngay. */
      const onConversationWriteMode = (payload: {
        conversationId?: string;
        writeMode: ChatConversation['writeMode'];
      }) => {
        if (
          normalizeMongoId(payload?.conversationId) !== normalizeMongoId(convIdRef.current)
        ) {
          return;
        }
        setConversation((prev) => (prev ? { ...prev, writeMode: payload.writeMode } : prev));
      };

      // PH/GV đánh dấu đã đọc → cập nhật readBy trên tin đang mở.
      const onChatRead = (payload: { conversationId?: string; userId?: string }) => {
        if (normalizeMongoId(payload?.conversationId) !== normalizeMongoId(convIdRef.current)) {
          return;
        }
        const readerId = normalizeMongoId(payload?.userId);
        if (!readerId) return;
        const readAt = new Date().toISOString();
        setMessages((prev) =>
          prev.map((m) => {
            const existing = m.readBy || [];
            if (existing.some((r) => normalizeMongoId(r.user) === readerId)) return m;
            return { ...m, readBy: [...existing, { user: readerId, readAt }] };
          })
        );
      };

      const onConnect = () => {
        const raw = String(convIdRef.current || '').trim();
        if (!isLikelyMongoObjectId(raw)) return;
        socket.emit(CHAT_EVENTS.JOIN, { conversationId: raw });
      };

      /**
       * Social-service emit `chat:joined` sau khi join phòng — kéo lại trang tin 1
       * để không lỡ tin PH gửi trong khoảng race mở thread / gắn listener.
       */
      const onChatJoined = async (payload: { conversationId?: string }) => {
        const jid = normalizeMongoId(payload?.conversationId);
        const cur = normalizeMongoId(convIdRef.current);
        if (!jid || !cur || jid !== cur) return;
        try {
          const data = await chatService.getMessages(
            String(convIdRef.current),
            1,
            CHAT_INITIAL_PAGE_LIMIT
          );
          if (normalizeMongoId(selectedIdRef.current) !== cur) return;
          const incoming = data.messages || [];
          setMessages((prev) => mergeIncomingMessagesPage(incoming, prev));
          if (data.conversation) setConversation(data.conversation);
          setHasMoreMessages(Boolean(data.pagination?.hasNext));
        } catch (err) {
          console.warn('[ExchangeChat] chat:joined resync', err);
        }
      };

      socket.on(CHAT_EVENTS.MESSAGE, onMsg);
      socket.on(CHAT_EVENTS.REACTION, onReaction);
      socket.on(CHAT_EVENTS.RECALLED, onRecall);
      socket.on(CHAT_EVENTS.POLL, onPoll);
      socket.on(CHAT_EVENTS.POLL_VOTERS, onPollVoters);
      socket.on(CHAT_EVENTS.PINNED, onConversationPinned);
      socket.on(CHAT_EVENTS.WRITE_MODE, onConversationWriteMode);
      socket.on(CHAT_EVENTS.READ, onChatRead);
      socket.on(CHAT_EVENTS.TYPING, onTyping);
      socket.on('connect', onConnect);
      socket.on('chat:joined', onChatJoined);

      off = () => {
        socket.off(CHAT_EVENTS.MESSAGE, onMsg);
        socket.off(CHAT_EVENTS.REACTION, onReaction);
        socket.off(CHAT_EVENTS.RECALLED, onRecall);
        socket.off(CHAT_EVENTS.POLL, onPoll);
        socket.off(CHAT_EVENTS.POLL_VOTERS, onPollVoters);
        socket.off(CHAT_EVENTS.PINNED, onConversationPinned);
        socket.off(CHAT_EVENTS.WRITE_MODE, onConversationWriteMode);
        socket.off(CHAT_EVENTS.READ, onChatRead);
        socket.off(CHAT_EVENTS.TYPING, onTyping);
        socket.off('connect', onConnect);
        socket.off('chat:joined', onChatJoined);
        Object.keys(remoteTypingTtlTimersRef.current).forEach((k) => clearRemoteTypingTtl(k));
      };
    };

    void run();
    return () => {
      mounted = false;
      off?.();
      void chatService.getSocket().then((s) => {
        const raw = String(convIdRef.current || '').trim();
        if (!isLikelyMongoObjectId(raw)) return;
        s?.emit(CHAT_EVENTS.TYPING, {
          conversationId: raw,
          isTyping: false,
        });
      });
    };
  }, [mongoConversationIdForApi, conversationIdFromRoute, teacherEmail]);

  const sendTypingPulse = async () => {
    if (viewerReadOnly) return;
    const cid = mongoConversationIdForApi;
    if (!cid) return;
    const socket = await chatService.getSocket();
    socket?.emit(CHAT_EVENTS.TYPING, {
      conversationId: String(cid),
      isTyping: true,
      name: user?.fullname,
      senderEmail: teacherEmail,
    });
  };

  const sendTypingStop = async () => {
    const cid = mongoConversationIdForApi;
    if (!cid) return;
    const socket = await chatService.getSocket();
    socket?.emit(CHAT_EVENTS.TYPING, {
      conversationId: String(cid),
      isTyping: false,
      senderEmail: teacherEmail,
    });
  };

  // ===== Bình chọn =====

  const markPollPending = useCallback((messageId: string, pending: boolean) => {
    setPendingPollIds((prev) => {
      if (pending === prev.has(messageId)) return prev;
      const next = new Set(prev);
      if (pending) next.add(messageId);
      else next.delete(messageId);
      return next;
    });
  }, []);

  const patchPollFromServer = useCallback((messageId: string, poll: ChatPoll) => {
    setMessages((prev) =>
      prev.map((m) =>
        normalizeMongoId(m._id) === normalizeMongoId(messageId)
          ? { ...m, poll: applyPollUpdate(m.poll, poll) }
          : m
      )
    );
  }, []);

  const handleCreatePoll = useCallback(
    async (payload: CreateChatPollPayload) => {
      const cid = mongoConversationIdForApi;
      if (!cid) return;
      try {
        setCreatingPoll(true);
        const data = await chatService.createPoll(String(cid), payload);
        if (data.message) {
          setMessages((prev) => mergeIncomingMessagesPage([data.message], prev));
        }
        if (data.conversation) setConversation(data.conversation);
        setPollSheetOpen(false);
      } catch (error) {
        console.warn('[ExchangeChat] createPoll error:', error);
        const status = (error as { status?: number })?.status;
        Alert.alert(
          t('common.error'),
          status === 403 ? t('exchange.poll_create_forbidden') : t('exchange.poll_create_failed')
        );
      } finally {
        setCreatingPoll(false);
      }
    },
    [mongoConversationIdForApi, t]
  );

  /**
   * Bấm một phương án: cập nhật lạc quan (KHÔNG đụng `rev` để broadcast của người khác vẫn
   * thắng), gọi API rồi áp kết quả server; lỗi thì trả lại trạng thái trước đó.
   */
  const handleTogglePollOption = useCallback(
    async (message: ChatMessage, optionId: string) => {
      const poll = message.poll;
      if (!poll || poll.isClosed) return;
      const messageId = normalizeMongoId(message._id);
      if (!messageId) return;

      const current = poll.myVote ?? [];
      const nextVote = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : poll.allowMultiple
          ? [...current, optionId]
          : [optionId];

      const optimistic: ChatPoll = {
        ...poll,
        myVote: nextVote,
        options: poll.options.map((o) => {
          const had = current.includes(o.id);
          const has = nextVote.includes(o.id);
          if (had === has) return o;
          return { ...o, voteCount: Math.max(0, o.voteCount + (has ? 1 : -1)) };
        }),
        totalVoters:
          current.length === 0 && nextVote.length > 0
            ? poll.totalVoters + 1
            : current.length > 0 && nextVote.length === 0
              ? Math.max(0, poll.totalVoters - 1)
              : poll.totalVoters,
      };

      setMessages((prev) =>
        prev.map((m) => (normalizeMongoId(m._id) === messageId ? { ...m, poll: optimistic } : m))
      );
      markPollPending(messageId, true);
      try {
        const data = await chatService.votePoll(messageId, nextVote);
        patchPollFromServer(messageId, data.poll);
      } catch (error) {
        console.warn('[ExchangeChat] votePoll error:', error);
        const code = (error as { code?: string })?.code;
        setMessages((prev) =>
          prev.map((m) =>
            normalizeMongoId(m._id) === messageId
              ? { ...m, poll: code === 'POLL_CLOSED' ? { ...poll, isClosed: true } : poll }
              : m
          )
        );
        Alert.alert(
          t('common.error'),
          code === 'POLL_CLOSED' ? t('exchange.poll_closed_toast') : t('exchange.poll_vote_failed')
        );
      } finally {
        markPollPending(messageId, false);
      }
    },
    [markPollPending, patchPollFromServer, t]
  );

  const handleClosePoll = useCallback(
    async (message: ChatMessage) => {
      const messageId = normalizeMongoId(message._id);
      if (!messageId) return;
      markPollPending(messageId, true);
      try {
        const data = await chatService.closePoll(messageId);
        patchPollFromServer(messageId, data.poll);
      } catch (error) {
        console.warn('[ExchangeChat] closePoll error:', error);
        Alert.alert(t('common.error'), t('exchange.poll_close_failed'));
      } finally {
        markPollPending(messageId, false);
      }
    },
    [markPollPending, patchPollFromServer, t]
  );

  /**
   * Lưu sửa bình chọn. Backend là nơi chốt bộ quy tắc (đã có phiếu thì chỉ thêm phương án, đổi
   * hạn/nhắc/ẩn danh/cách chọn) nên lỗi 400 hiện nguyên văn message của server cho GV hiểu.
   */
  const handleUpdatePoll = useCallback(
    async (messageId: string, payload: UpdateChatPollPayload) => {
      if (!messageId) return;
      markPollPending(messageId, true);
      try {
        setSavingPoll(true);
        const data = await chatService.updatePoll(messageId, payload);
        patchPollFromServer(messageId, data.poll);
        setEditPollFor(null);
      } catch (error) {
        console.warn('[ExchangeChat] updatePoll error:', error);
        const status = (error as { status?: number })?.status;
        const serverMessage = (error as { message?: string })?.message;
        Alert.alert(
          t('common.error'),
          status === 403
            ? t('exchange.poll_edit_forbidden')
            : serverMessage || t('exchange.poll_edit_failed')
        );
      } finally {
        setSavingPoll(false);
        markPollPending(messageId, false);
      }
    },
    [markPollPending, patchPollFromServer, t]
  );

  const handleOpenPollVoters = useCallback((message: ChatMessage) => {
    setVotersSheetFor(normalizeMongoId(message._id));
  }, []);

  const handleEditPoll = useCallback((message: ChatMessage) => {
    setEditPollFor(normalizeMongoId(message._id));
  }, []);

  const handleOpenReactions = useCallback((message: ChatMessage) => {
    setReactionsSheetFor(normalizeMongoId(message._id));
  }, []);

  /**
   * Người đã bày tỏ cảm xúc trên tin đang mở sheet. Bám theo `messages` nên ai thả/gỡ cảm xúc
   * lúc sheet đang mở thì danh sách tự cập nhật, và tự đóng khi cảm xúc cuối cùng bị gỡ.
   */
  const reactionViewers = useMemo(
    () =>
      reactionsSheetFor
        ? listMessageReactionViewers(
            messages.find((m) => normalizeMongoId(m._id) === reactionsSheetFor),
            conversation,
            teacherEmail
          )
        : [],
    [reactionsSheetFor, messages, conversation, teacherEmail]
  );

  /** Tin đang mở sheet người bầu — lấy từ state để poll luôn là bản mới nhất. */
  const votersPollTarget = useMemo(
    () =>
      votersSheetFor
        ? messages.find((m) => normalizeMongoId(m._id) === votersSheetFor) ?? null
        : null,
    [votersSheetFor, messages]
  );

  /** Tin đang mở sheet sửa bình chọn — cũng lấy từ state để form nạp đúng bản mới nhất. */
  const editPollTarget = useMemo(
    () =>
      editPollFor ? messages.find((m) => normalizeMongoId(m._id) === editPollFor) ?? null : null,
    [editPollFor, messages]
  );

  const handleSend = async ({
    content,
    attachments,
    replyToMessageId,
    mentions,
    formats,
  }: {
    content: string;
    attachments?: ChatAttachment[];
    replyToMessageId?: string;
    mentions?: ChatMention[];
    formats?: ChatFormat[];
  }) => {
    const draftSend =
      isDraftTeacherGuardianThread &&
      Boolean(conversation?.isDraft) &&
      draftClassId &&
      draftSchoolYearId &&
      draftTeacherId &&
      draftGuardianId;

    try {
      let result: { message?: ChatMessage; conversation?: ChatConversation };
      if (draftSend) {
        result = await chatService.sendTeacherGuardianMessage({
          classId: draftClassId,
          schoolYearId: draftSchoolYearId,
          teacherId: draftTeacherId,
          guardianId: draftGuardianId,
          content: content || (attachments?.length ? ' ' : ''),
          attachments: attachments?.length ? attachments : undefined,
          replyTo: replyToMessageId,
          formats: formats?.length ? formats : undefined,
        });
        navigation.dispatch(
          StackActions.replace(ROUTES.SCREENS.EXCHANGE_CHAT, {
            conversationId: result.conversation!._id,
            classId: draftClassId,
            schoolYearId: draftSchoolYearId,
          }),
        );
      } else {
        const cid = mongoConversationIdForApi;
        if (!cid) return;
        result = await chatService.sendMessage(cid, {
          content: content || (attachments?.length ? ' ' : ''),
          attachments: attachments?.length ? attachments : undefined,
          replyTo: replyToMessageId,
          mentions: mentions?.length ? mentions : undefined,
          formats: formats?.length ? formats : undefined,
        });
      }
      setReplyTo(null);
      if (result?.message) {
        const rid = normalizeMongoId(result.conversation?._id);
        const mid = normalizeMongoId(result.message._id);
        if (rid && mid) {
          dedupeRef.current.add(`${rid}:${mid}`);
        }
        setMessages((prev) => mergeIncomingMessagesPage([result.message], prev));
      }
      if (result?.conversation) setConversation(result.conversation);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'send_failed';
      Alert.alert(t('common.error'), msg);
    }
  };

  const locked = conversation?.status === 'locked';
  const chatChromeIntensity = Platform.OS === 'ios' ? 28 : Platform.OS === 'android' ? 42 : 0;

  const teacherGuardianUploadComposer = useMemo(
    () =>
      isDraftTeacherGuardianThread &&
      draftClassId &&
      draftSchoolYearId &&
      draftTeacherId &&
      draftGuardianId
        ? {
            classId: draftClassId,
            schoolYearId: draftSchoolYearId,
            teacherId: draftTeacherId,
            guardianId: draftGuardianId,
          }
        : undefined,
    [
      isDraftTeacherGuardianThread,
      draftClassId,
      draftSchoolYearId,
      draftTeacherId,
      draftGuardianId,
    ],
  );

  const closeActionOverlay = useCallback(() => setActionTarget(null), []);

  const handleOpenActionMenu = useCallback((payload) => {
    setActionTarget(payload);
  }, []);

  const handleOverlayReply = useCallback(() => {
    if (!overlayMessage) return;
    setReplyTo(overlayMessage);
    closeActionOverlay();
  }, [overlayMessage, closeActionOverlay]);

  const handleOverlayCopy = useCallback(async () => {
    if (!overlayMessage) return;
    const text = overlayPreviewPlainText(overlayMessage.content, overlayMessage.recalledAt);
    try {
      await Clipboard.setStringAsync(text);
      // Toast trong màn (trên thanh soạn tin) — sao chép không đáng để chặn bằng Alert.
      showToast('Đã sao chép');
    } catch {
      showToast('Không thể sao chép', 'error');
    }
    closeActionOverlay();
  }, [overlayMessage, closeActionOverlay, showToast]);

  const viewerEmailSet = useMemo(
    () => new Set([String(teacherEmail || '').toLowerCase().trim()].filter(Boolean)),
    [teacherEmail]
  );

  const handleOverlayReact = useCallback(
    async (emoji: ChatEmoji) => {
      if (!actionTarget) return;
      const id = actionTarget.message._id;
      setMessages((prev) =>
        applyLocalReactionToggleViewer(prev, id, emoji, viewerEmailSet, teacherDisplayName)
      );
      try {
        const data = await chatService.toggleReaction(id, emoji);
        setMessages((prev) =>
          prev.map((m) => (m._id === id ? { ...m, reactions: data.reactions } : m))
        );
      } catch (e) {
        console.warn(e);
        if (mongoConversationIdForApi) {
          const data = await chatService.getMessages(mongoConversationIdForApi);
          setMessages(data.messages || []);
        }
        Alert.alert(t('common.error'), e?.message || 'reaction_failed');
      }
      closeActionOverlay();
    },
    [actionTarget, viewerEmailSet, teacherDisplayName, mongoConversationIdForApi, closeActionOverlay, t]
  );

  const handleOverlayRecall = useCallback(async () => {
    if (!overlayMessage) return;
    try {
      await chatService.recallMessage(overlayMessage._id);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || 'recall_failed');
    }
    closeActionOverlay();
  }, [overlayMessage, closeActionOverlay, t]);

  const handleBannerUnpin = useCallback(async () => {
    if (!mongoConversationIdForApi || locked) return;
    try {
      const { conversation } = await chatService.unpinMessage(mongoConversationIdForApi);
      setConversation(conversation);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
    }
  }, [mongoConversationIdForApi, locked, t]);

  const handleOverlayPin = useCallback(async () => {
    if (!overlayMessage || !mongoConversationIdForApi || locked) return;
    closeActionOverlay();
    try {
      const { conversation } = await chatService.pinMessage(
        mongoConversationIdForApi,
        overlayMessage._id
      );
      setConversation(conversation);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
    }
  }, [overlayMessage, mongoConversationIdForApi, locked, closeActionOverlay, t]);

  const handleOverlayUnpin = useCallback(async () => {
    closeActionOverlay();
    await handleBannerUnpin();
  }, [closeActionOverlay, handleBannerUnpin]);

  const renderChatRow = useCallback(
    ({ item }: { item: ChatListRow }) => {
      if (item.kind === 'separator') {
        return (
          <View className="items-center justify-center px-6 py-2">
            <Text className="text-center font-mulish-medium text-[11px] text-[#002855]/65">
              {item.label}
            </Text>
          </View>
        );
      }
      const msgItem = item.message;
      const isMine = isMineMessage(msgItem, teacherEmail);
      const threadMeta = messageThreadMetaById.get(msgItem._id) ?? DEFAULT_THREAD_META;
      const avatarUri = resolveBubbleAvatarUri(
        msgItem,
        isMine,
        teacherAvatar,
        teacherEmail,
        conversation
      );
      const replyTarget = msgItem.replyTo?.messageId
        ? messages.find((m) => m._id === msgItem.replyTo?.messageId)
        : undefined;
      const replyQuoteContent = msgItem.replyTo
        ? replyTarget?.recalledAt
          ? 'Tin nhắn đã thu hồi'
          : replyTarget
            ? replyQuoteSnippet(replyTarget)
            : msgItem.replyTo.content
        : undefined;
      const senderDisplayName = resolveChatSenderDisplayName(conversation, {
        name: msgItem.senderSnapshot?.name,
        email: msgItem.senderSnapshot?.email,
        role: msgItem.senderSnapshot?.role,
      });
      const replySenderDisplayName = msgItem.replyTo
        ? resolveChatSenderDisplayName(conversation, {
            name: msgItem.replyTo.senderName,
            email: replyTarget?.senderSnapshot?.email,
            role: replyTarget?.senderSnapshot?.role,
          })
        : undefined;
      // Người gửi luôn có trong readBy lúc gửi → trừ 1 khi đếm người đã đọc khác mình.
      const othersRead = Math.max(0, (msgItem.readBy?.length || 0) - (isMine ? 1 : 0));
      const readReceiptLabel =
        isMine && !msgItem.recalledAt && (othersRead > 0 || readReceiptParticipantCount > 0)
          ? readReceiptParticipantCount > 0
            ? `Đã đọc ${othersRead}/${readReceiptParticipantCount}`
            : `Đã đọc ${othersRead}`
          : undefined;

      return (
        <ExchangeMessageBubble
          message={msgItem}
          isMine={isMine}
          highlighted={
            highlightedMessageId != null &&
            normalizeMongoId(msgItem._id) === highlightedMessageId
          }
          replyDisabled={locked}
          threadMeta={threadMeta}
          avatarUri={avatarUri}
          replyQuoteContent={replyQuoteContent}
          senderDisplayName={senderDisplayName}
          replySenderDisplayName={replySenderDisplayName}
          readReceiptLabel={readReceiptLabel}
          onOpenReaders={(m) => setReadersSheetFor(normalizeMongoId(m._id))}
          onOpenActionMenu={handleOpenActionMenu}
          pollPending={pendingPollIds.has(normalizeMongoId(msgItem._id))}
          pollReadOnly={locked || viewerReadOnly}
          viewerIsHomeroom={viewerIsHomeroom}
          onTogglePollOption={handleTogglePollOption}
          onOpenPollVoters={handleOpenPollVoters}
          onOpenReactions={handleOpenReactions}
          onClosePoll={handleClosePoll}
          onEditPoll={locked || viewerReadOnly ? undefined : handleEditPoll}
          onReply={() => !locked && setReplyTo(msgItem)}
        />
      );
    },
    [
      teacherEmail,
      messageThreadMetaById,
      messages,
      teacherAvatar,
      locked,
      viewerReadOnly,
      viewerIsHomeroom,
      pendingPollIds,
      handleTogglePollOption,
      handleOpenPollVoters,
      handleClosePoll,
      handleEditPoll,
      handleOpenActionMenu,
      highlightedMessageId,
      conversation,
      readReceiptParticipantCount,
    ]
  );

  const chatListFooter = useMemo(
    () =>
      loadingMore ? (
        <View className="items-center justify-center py-4">
          <ActivityIndicator color="#F97316" />
        </View>
      ) : null,
    [loadingMore]
  );

  const headerTitle = conversationHeaderTitle(conversation);
  const headerSubtitle =
    conversation ? conversationSubtitle(conversation, locked) : '';

  /** Mở màn thông tin hội thoại (thành viên / ảnh-video / tệp) — giống sidebar web. */
  const openInfo = useCallback(() => {
    if (!conversation?._id) return;
    navigation.navigate(ROUTES.SCREENS.EXCHANGE_CHAT_INFO, {
      conversationId: conversation._id,
      conversation,
    });
  }, [conversation, navigation]);

  const typingLine = useMemo(() => {
    const vals = Object.values(typingNames)
      .map((n) => String(n || '').trim())
      .filter(Boolean);
    if (!vals.length) return '';
    return `${vals.join(', ')} đang soạn tin nhắn`;
  }, [typingNames]);

  /**
   * Cuộn inverted list tới bubble + nháy viền. Dùng chung cho pill tin ghim và cho deep link
   * từ thông báo (SIS-180) — đừng viết bản sao thứ hai.
   *
   * `alertWhenMissing` chỉ bật cho pill ghim: người dùng vừa chủ động bấm nên cần lời giải
   * thích. Deep link thì im lặng, đã có toast riêng khi server báo không tới được tin.
   */
  const scrollToMessage = useCallback(
    (messageIdRaw: string, opts?: { alertWhenMissing?: boolean }) => {
      const mid = normalizeMongoId(messageIdRaw);
      if (!mid) return false;
      const idx = reversedChatRows.findIndex(
        (r) => r.kind === 'message' && normalizeMongoId(r.message._id) === mid
      );
      if (idx < 0) {
        if (opts?.alertWhenMissing) {
          Alert.alert(
            'Thông báo',
            'Không thấy tin ghim trong phần đang tải — thử cuộn lên để tải thêm lịch sử.'
          );
        }
        return false;
      }
      if (highlightClearTimerRef.current) {
        clearTimeout(highlightClearTimerRef.current);
        highlightClearTimerRef.current = null;
      }
      flatListRef.current?.scrollToIndex({ index: idx, viewPosition: 0.35, animated: true });
      setHighlightedMessageId(mid);
      highlightClearTimerRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
        highlightClearTimerRef.current = null;
      }, 1200);
      return true;
    },
    [reversedChatRows]
  );

  /**
   * Mở từ thông báo: cuộn tới tin nhắn đích ngay khi danh sách đã dựng xong, đúng một lần.
   * Chờ theo `reversedChatRows` chứ không gọi thẳng trong `loadExistingThread` vì lúc đó
   * FlatList chưa có hàng nào để `scrollToIndex` bám vào.
   */
  useEffect(() => {
    const mid = pendingFocusMessageIdRef.current;
    if (!mid || loading || !reversedChatRows.length) return;
    const target = normalizeMongoId(mid);
    const present = reversedChatRows.some(
      (r) => r.kind === 'message' && normalizeMongoId(r.message._id) === target
    );
    if (!present) return;
    // Chỉ xoá hàng đợi khi ĐÃ cuộn được: tin nhắn mới về trong lúc chờ sẽ đổi
    // `reversedChatRows` → cleanup huỷ timer này, effect chạy lại và hẹn lại với danh sách mới.
    const timer = setTimeout(() => {
      if (scrollToMessage(mid)) {
        pendingFocusMessageIdRef.current = null;
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [loading, reversedChatRows, scrollToMessage]);

  /** Điều hướng lại vào cùng màn với tin khác (bấm thông báo thứ hai) → xếp hàng cuộn mới. */
  useEffect(() => {
    if (focusMessageIdFromRoute) {
      pendingFocusMessageIdRef.current = focusMessageIdFromRoute;
    }
  }, [focusMessageIdFromRoute]);

  return (
    <ImageBackground
      source={CHAT_THREAD_WALLPAPER}
      className="flex-1"
      style={{ flex: 1 }}
      resizeMode="cover">
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1 bg-transparent" edges={['top', 'bottom']}>
        {chatChromeIntensity > 0 ? (
          <BlurView
            intensity={chatChromeIntensity}
            tint="light"
            style={{ overflow: 'hidden' }}
            className="border-b border-white/35">
            <View className="flex-row items-center gap-3 px-4 py-3">
              <Pressable onPress={() => navigation.goBack()} className="p-2">
                <Ionicons name="chevron-back" size={26} color="#002855" />
              </Pressable>
              {conversation ? (
                <ExchangeGroupChatAvatar
                  conversation={conversation}
                  viewerEmails={chatViewerEmails}
                  size={44}
                />
              ) : (
                <View style={{ width: 44, height: 44 }} />
              )}
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-mulish-bold text-lg text-[#002855]">
                  {headerTitle || t('exchange.title_detail')}
                </Text>
                <Text numberOfLines={1} className="font-mulish-medium text-sm text-[#002855]/65">
                  {headerSubtitle}
                </Text>
              </View>
              {conversation?._id ? (
                <Pressable
                  onPress={openInfo}
                  className="p-2"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={t('exchange.info_title')}>
                  <Ionicons name="ellipsis-vertical" size={22} color="#002855" />
                </Pressable>
              ) : null}
            </View>
          </BlurView>
        ) : (
          <View className="border-b border-white/40 bg-[#FFF9F3]/90">
            <View className="flex-row items-center gap-3 px-4 py-3">
              <Pressable onPress={() => navigation.goBack()} className="p-2">
                <Ionicons name="chevron-back" size={26} color="#002855" />
              </Pressable>
              {conversation ? (
                <ExchangeGroupChatAvatar
                  conversation={conversation}
                  viewerEmails={chatViewerEmails}
                  size={44}
                />
              ) : null}
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-mulish-bold text-lg text-[#002855]">
                  {headerTitle || t('exchange.title_detail')}
                </Text>
                <Text numberOfLines={1} className="font-mulish-medium text-sm text-[#002855]/65">
                  {headerSubtitle}
                </Text>
              </View>
              {conversation?._id ? (
                <Pressable
                  onPress={openInfo}
                  className="p-2"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={t('exchange.info_title')}>
                  <Ionicons name="ellipsis-vertical" size={22} color="#002855" />
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        <KeyboardAvoidingView
          className="flex-1"
          style={androidKeyboardHeight > 0 ? { paddingBottom: androidKeyboardHeight } : undefined}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {!loading && conversation?.pinnedMessage ? (
            <PinnedMessageBanner
              pinnedMessage={conversation.pinnedMessage}
              onPress={() =>
                scrollToMessage(conversation.pinnedMessage!.messageId, { alertWhenMissing: true })
              }
              showClose={!locked}
              onUnpin={
                locked ? undefined : () => {
                  void handleBannerUnpin();
                }
              }
            />
          ) : null}
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#F97316" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={reversedChatRows}
              inverted
              keyExtractor={(row) => row.key}
              renderItem={renderChatRow}
              onEndReached={loadMoreMessages}
              onEndReachedThreshold={0.35}
              ListFooterComponent={chatListFooter}
              contentContainerStyle={{ paddingVertical: 12 }}
              onScrollToIndexFailed={({ averageItemLength, index }) => {
                flatListRef.current?.scrollToOffset({
                  offset: Math.max(0, averageItemLength * index),
                  animated: true,
                });
              }}
            />
          )}

          {typingLine ? (
            <TypingDotsLine
              baseText={typingLine}
              className="px-5 pb-1 font-mulish-italic text-xs text-[#0d9488]"
            />
          ) : null}

          {toast ? (
            <InlineToast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onHide={hideToast}
            />
          ) : null}

          {viewerReadOnly ? (
            <View className="border-t border-white/45 bg-[#FFF9F3]/88 px-5 py-4">
              <Text className="text-center font-mulish text-sm text-[#6B7280]">
                {t('exchange.read_only_notice')}
              </Text>
            </View>
          ) : chatChromeIntensity > 0 ? (
            <BlurView
              intensity={chatChromeIntensity + 8}
              tint="light"
              style={{ overflow: 'hidden' }}
              className="border-t border-white/40">
              <ChatComposerExchange
                locked={locked}
                conversationId={mongoConversationIdForApi ? mongoConversationIdForApi : null}
                teacherGuardianUploadContext={teacherGuardianUploadComposer}
                replyTo={replyTo}
                replySenderLabel={
                  replyTo
                    ? resolveChatSenderDisplayName(conversation, {
                        name: replyTo.senderSnapshot?.name,
                        email: replyTo.senderSnapshot?.email,
                        role: replyTo.senderSnapshot?.role,
                      })
                    : undefined
                }
                onCancelReply={() => setReplyTo(null)}
                onTyping={() => void sendTypingPulse()}
                onTypingStop={() => void sendTypingStop()}
                conversation={conversation}
                viewerEmail={teacherEmail}
                onSend={handleSend}
                canCreatePoll={viewerIsHomeroom}
                onCreatePoll={() => setPollSheetOpen(true)}
              />
            </BlurView>
          ) : (
            <View className="border-t border-white/45 bg-[#FFF9F3]/88">
              <ChatComposerExchange
                locked={locked}
                conversationId={mongoConversationIdForApi ? mongoConversationIdForApi : null}
                teacherGuardianUploadContext={teacherGuardianUploadComposer}
                replyTo={replyTo}
                replySenderLabel={
                  replyTo
                    ? resolveChatSenderDisplayName(conversation, {
                        name: replyTo.senderSnapshot?.name,
                        email: replyTo.senderSnapshot?.email,
                        role: replyTo.senderSnapshot?.role,
                      })
                    : undefined
                }
                onCancelReply={() => setReplyTo(null)}
                onTyping={() => void sendTypingPulse()}
                onTypingStop={() => void sendTypingStop()}
                conversation={conversation}
                viewerEmail={teacherEmail}
                onSend={handleSend}
                canCreatePoll={viewerIsHomeroom}
                onCreatePoll={() => setPollSheetOpen(true)}
              />
            </View>
          )}
        </KeyboardAvoidingView>

        {actionTarget && overlayMessage ? (
          <MessageActionOverlay
            visible
            anchor={actionTarget.anchor}
            message={overlayMessage}
            isMine={overlayIsMine}
            replyQuoteContent={overlayReplyQuote}
            showSenderName={overlayShowSenderName}
            showTimestamp={overlayShowTimestamp}
            senderDisplayName={resolveChatSenderDisplayName(conversation, {
              name: overlayMessage.senderSnapshot?.name,
              email: overlayMessage.senderSnapshot?.email,
              role: overlayMessage.senderSnapshot?.role,
            })}
            replySenderDisplayName={
              overlayMessage.replyTo
                ? resolveChatSenderDisplayName(conversation, {
                    name: overlayMessage.replyTo.senderName,
                  })
                : undefined
            }
            locked={locked}
            showRecallButton={overlayShowRecallButton}
            canRecall={overlayCanRecall}
            bubbleMaxWidth={overlayBubbleMaxWidth}
            isPinned={overlayIsPinned}
            onPin={locked ? undefined : () => void handleOverlayPin()}
            onUnpin={locked ? undefined : () => void handleOverlayUnpin()}
            onClose={closeActionOverlay}
            onReply={handleOverlayReply}
            onCopy={handleOverlayCopy}
            onReact={handleOverlayReact}
            onRecall={handleOverlayRecall}
          />
        ) : null}

        {viewerIsHomeroom ? (
          <CreatePollSheet
            visible={pollSheetOpen}
            submitting={creatingPoll}
            onSubmit={(payload) => void handleCreatePoll(payload)}
            onClose={() => setPollSheetOpen(false)}
          />
        ) : null}
        {editPollTarget?.poll ? (
          <CreatePollSheet
            // Đổi tin đang sửa phải dựng lại form từ đầu — cùng instance thì effect nạp dữ liệu
            // (chỉ chạy khi `visible` đổi) sẽ không chạy lại và form giữ nội dung bình chọn trước.
            key={normalizeMongoId(editPollTarget._id)}
            visible
            mode="edit"
            poll={editPollTarget.poll}
            submitting={savingPoll}
            onSubmit={(payload) => void handleCreatePoll(payload)}
            onUpdate={(payload) =>
              void handleUpdatePoll(normalizeMongoId(editPollTarget._id), payload)
            }
            onClose={() => setEditPollFor(null)}
          />
        ) : null}
        {votersPollTarget?.poll ? (
          <PollVotersSheet
            visible
            messageId={normalizeMongoId(votersPollTarget._id)}
            poll={votersPollTarget.poll}
            onClose={() => setVotersSheetFor(null)}
          />
        ) : null}
        <ReactionViewersSheet
          visible={reactionViewers.length > 0}
          viewers={reactionViewers}
          onClose={() => setReactionsSheetFor(null)}
        />
        {readersSheetFor && mongoConversationIdForApi ? (
          <MessageReadersSheet
            visible
            conversationId={mongoConversationIdForApi}
            messageId={readersSheetFor}
            participantCount={readReceiptParticipantCount}
            onClose={() => setReadersSheetFor(null)}
          />
        ) : null}
      </SafeAreaView>
    </ImageBackground>
  );
}
