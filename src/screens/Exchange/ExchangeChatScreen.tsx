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
  ChatMessage,
  ChatPoll,
  ChatPollVotersData,
  CreateChatPollPayload,
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
  type ChatListRow,
} from './exchangeChatThreadUtils';
import { ChatComposerExchange } from './components/ChatComposerExchange';
import { CreatePollSheet } from './components/CreatePollSheet';
import { PollVotersSheet } from './components/PollVotersSheet';
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
  teacherEmail?: string | null
): string {
  if (isMine) {
    return resolveParticipantAvatarUrl(
      teacherAvatar || message.senderSnapshot?.avatarUrl,
      teacherEmail || message.senderSnapshot?.name || 'gv'
    );
  }
  return resolveParticipantAvatarUrl(
    message.senderSnapshot?.avatarUrl,
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
  const [votersSheetFor, setVotersSheetFor] = useState<string | null>(null);
  const [pendingPollIds, setPendingPollIds] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    messagesPageRef.current = messagesPage;
  }, [messagesPage]);

  useEffect(() => {
    selectedIdRef.current = mongoConversationIdForApi;
    convIdRef.current = mongoConversationIdForApi || conversationIdFromRoute;
  }, [mongoConversationIdForApi, conversationIdFromRoute]);

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

  const openThread = useCallback(async () => {
    if (isDraftTeacherGuardianThread) {
      if (!draftClassId || !draftSchoolYearId || !draftTeacherId || !draftGuardianId) {
        setLoading(false);
        Alert.alert(t('common.error'), t('exchange.load_thread_error'));
        navigation.goBack();
        return;
      }
      setLoading(true);
      setMessagesPage(1);
      messagesPageRef.current = 1;
      setHasMoreMessages(false);
      try {
        const conv = await chatService.openTeacherGuardianChat({
          teacherId: draftTeacherId,
          guardianId: draftGuardianId,
          classId: draftClassId,
          schoolYearId: draftSchoolYearId,
        });
        setConversation(conv);
        setMessages([]);
        setHasMoreMessages(false);
      } catch (e) {
        console.warn(e);
        Alert.alert(t('common.error'), t('exchange.load_thread_error'));
        navigation.goBack();
      } finally {
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

    setLoading(true);
    setMessagesPage(1);
    messagesPageRef.current = 1;
    setHasMoreMessages(false);

    // CRITICAL: chỉ getMessages mới được phép bung lỗi "Không tải được lịch sử chat".
    let loadedConversation: ChatConversation | null = null;
    try {
      const data = await chatService.getMessages(cid, 1, CHAT_INITIAL_PAGE_LIMIT);
      const sorted = [...(data.messages || [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setMessages(sorted);
      setConversation(data.conversation);
      loadedConversation = data.conversation;
      setHasMoreMessages(Boolean(data.pagination?.hasNext));
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
  }, [
    isDraftTeacherGuardianThread,
    draftClassId,
    draftSchoolYearId,
    draftTeacherId,
    draftGuardianId,
    conversationIdFromRoute,
    teacherEmail,
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
          const displayName = formatChatDisplayName(name) || sender || 'Phụ huynh';
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

  const handleOpenPollVoters = useCallback((message: ChatMessage) => {
    setVotersSheetFor(normalizeMongoId(message._id));
  }, []);

  /** Tin đang mở sheet người bầu — lấy từ state để poll luôn là bản mới nhất. */
  const votersPollTarget = useMemo(
    () =>
      votersSheetFor
        ? messages.find((m) => normalizeMongoId(m._id) === votersSheetFor) ?? null
        : null,
    [votersSheetFor, messages]
  );

  const handleSend = async ({
    content,
    attachments,
    replyToMessageId,
  }: {
    content: string;
    attachments?: ChatAttachment[];
    replyToMessageId?: string;
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
      Alert.alert('Đã sao chép', 'Nội dung đã vào bảng nhớ.');
    } catch {
      Alert.alert('Lỗi', 'Không thể sao chép.');
    }
    closeActionOverlay();
  }, [overlayMessage, closeActionOverlay]);

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
      const avatarUri = resolveBubbleAvatarUri(msgItem, isMine, teacherAvatar, teacherEmail);
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
          onOpenActionMenu={handleOpenActionMenu}
          pollPending={pendingPollIds.has(normalizeMongoId(msgItem._id))}
          pollReadOnly={locked || viewerReadOnly}
          viewerIsHomeroom={viewerIsHomeroom}
          onTogglePollOption={handleTogglePollOption}
          onOpenPollVoters={handleOpenPollVoters}
          onClosePoll={handleClosePoll}
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
      handleOpenActionMenu,
      highlightedMessageId,
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

  /** Tap pill ghim → cuộn inverted list tới bubble + nháy viền. */
  const scrollToPinnedMessage = useCallback(
    (messageIdRaw: string) => {
      const mid = normalizeMongoId(messageIdRaw);
      if (!mid) return;
      const idx = reversedChatRows.findIndex(
        (r) => r.kind === 'message' && normalizeMongoId(r.message._id) === mid
      );
      if (idx < 0) {
        Alert.alert(
          'Thông báo',
          'Không thấy tin ghim trong phần đang tải — thử cuộn lên để tải thêm lịch sử.'
        );
        return;
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
    },
    [reversedChatRows]
  );

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
              onPress={() => scrollToPinnedMessage(conversation.pinnedMessage!.messageId)}
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
                onCancelReply={() => setReplyTo(null)}
                onTyping={() => void sendTypingPulse()}
                onTypingStop={() => void sendTypingStop()}
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
                onCancelReply={() => setReplyTo(null)}
                onTyping={() => void sendTypingPulse()}
                onTypingStop={() => void sendTypingStop()}
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
        {votersPollTarget?.poll ? (
          <PollVotersSheet
            visible
            messageId={normalizeMongoId(votersPollTarget._id)}
            poll={votersPollTarget.poll}
            onClose={() => setVotersSheetFor(null)}
          />
        ) : null}
      </SafeAreaView>
    </ImageBackground>
  );
}
