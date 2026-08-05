/**
 * Trao đổi — danh sách hội thoại GV ↔ PH (lọc theo lớp nếu có param)
 */
// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

import { ROUTES } from '../../constants/routes';
import { getFocusedChatConversationId } from '../../lib/chatNotificationFocus';
import { CHAT_EVENTS } from '../../realtime/chatEvents';
import type { RootStackParamList } from '../../navigation/AppNavigator';

import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';
import type {
  ChatConversation,
  ClassChatScopeGuardian,
  ClassChatScopeStudent,
} from '../../types/chat';

import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '../../hooks/useLanguage';

import { NewConversationSheet, type GuardianStudentRow } from './components/NewConversationSheet';
import { NewParentChatSheet, type ParentChatCandidate } from './components/NewParentChatSheet';
import { ExchangeGroupChatAvatar } from './components/ExchangeGroupChatAvatar';
import { getPinnedIds } from './chatPinStore';
import {
  conversationHeaderTitle,
  formatChatDisplayName,
  resolveChatSenderDisplayName,
  isMessageFromTeacherViewer,
  mergeUnreadCountOnSocketMessage,
  normalizeMongoId,
} from './exchangeChatThreadUtils';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.EXCHANGE_LIST>;

/** Bộ lọc danh sách hội thoại — giống web (Tất cả / Nhóm / Phụ huynh / Chưa đọc). */
type ConversationFilter = 'all' | 'group' | 'parent' | 'unread';

/** Số hội thoại mỗi trang — cuộn tới đáy thì tải tiếp. */
const CONVERSATION_PAGE_SIZE = 50;

/** Chờ gõ xong rồi mới gọi server (ms). */
const SEARCH_DEBOUNCE_MS = 300;

const FILTER_TABS: { key: ConversationFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'exchange.filter_all' },
  { key: 'group', labelKey: 'exchange.filter_group' },
  { key: 'parent', labelKey: 'exchange.filter_parent' },
  { key: 'unread', labelKey: 'exchange.filter_unread' },
];

// Tìm kiếm + pill lọc đã chuyển xuống SERVER (xem chatService.getConversationsPage): lọc trên
// mảng đã tải bỏ sót hội thoại chưa tải tới, đúng bug BOD không thấy nhóm lớp (SIS-166).

/** _id Mongo 24 hex — mới gọi được API ẩn / vuốt xóa khỏi danh sách. */
function isPersistentConversationId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(String(id || '').trim());
}

/**
 * Hàng danh sách Trao đổi — vuốt (native) lộ nút xóa: chỉ ẩn khỏi danh sách user, không hard delete.
 *
 * `memo` là bắt buộc chứ không phải tối ưu cho vui: mỗi ký tự gõ trong ô tìm kiếm và mỗi tin
 * nhắn realtime đều re-render màn, mà mỗi hàng dựng lại một `Swipeable` (gesture handler) —
 * danh sách của BOD dài nên đó là phần giật thấy được.
 */
const ExchangeConversationSwipeRow = React.memo(function ExchangeConversationSwipeRow({
  item,
  chatViewerEmails,
  conversationTitle,
  subtitle,
  timeLabel,
  guardianFallbackTitle,
  onOpen,
  onHiddenFromList,
}: {
  item: ChatConversation;
  chatViewerEmails: string[];
  conversationTitle: string;
  subtitle: string;
  timeLabel: string;
  guardianFallbackTitle: string;
  /** Nhận `item` thay vì closure sẵn: prop giữ nguyên tham chiếu giữa các lần render ⇒ `memo` mới ăn. */
  onOpen: (item: ChatConversation) => void;
  onHiddenFromList?: () => void;
}) {
  const swipeRef = useRef(null);
  const handlePress = useCallback(() => onOpen(item), [item, onOpen]);
  const persistId = String(item._id || '').trim();
  const swipeEnabled = Platform.OS !== 'web' && isPersistentConversationId(persistId);
  const g = item.guardians?.[0];

  const confirmHide = useCallback(() => {
    Alert.alert(
      'Ẩn cuộc trò chuyện',
      'Đoạn chat sẽ biến mất khỏi danh sách của bạn. Tin nhắn vẫn được lưu; bạn có thể thấy lại khi có tin mới trong hội thoại.',
      [
        { text: 'Huỷ', style: 'cancel', onPress: () => swipeRef.current?.close?.() },
        {
          text: 'Ẩn',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.hideConversationFromList(persistId);
              swipeRef.current?.close?.();
              onHiddenFromList?.();
            } catch (e) {
              swipeRef.current?.close?.();
              Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không thể ẩn cuộc trò chuyện.');
            }
          },
        },
      ]
    );
  }, [onHiddenFromList, persistId]);

  const renderRightActions = useCallback(() => {
    const w = 76;
    return (
      <View
        style={{
          width: w,
          marginLeft: -1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#DC2626',
        }}>
        <Pressable
          onPress={confirmHide}
          style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
          accessibilityLabel="Ẩn khỏi danh sách">
          <Ionicons name="trash-outline" size={26} color="#fff" />
        </Pressable>
      </View>
    );
  }, [confirmHide]);

  const rowInner = (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        backgroundColor: '#fff',
      }}
      activeOpacity={0.7}
      onPress={handlePress}>
      <View style={{ marginRight: 12 }}>
        <ExchangeGroupChatAvatar conversation={item} viewerEmails={chatViewerEmails} size={44} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: 'Mulish-Bold', fontSize: 16, color: '#111' }} numberOfLines={1}>
          {conversationTitle || formatChatDisplayName(g?.name) || guardianFallbackTitle}
        </Text>
        <Text style={{ marginTop: 4, fontSize: 13, color: '#6B7280' }} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
        {timeLabel ? (
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{timeLabel}</Text>
        ) : null}
        {Number(item.unreadCount || 0) > 0 ? (
          <View
            style={{
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#EF4444',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
            }}>
            <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Mulish-Bold' }}>
              {(item.unreadCount || 0) > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (!swipeEnabled) {
    return rowInner;
  }

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      overshootRight={false}
      renderRightActions={renderRightActions}>
      {rowInner}
    </Swipeable>
  );
});

export default function ExchangeListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { t } = useLanguage();
  const { user } = useAuth();

  const chatViewerEmails = useMemo(
    () => [String(user?.email || '').trim()].filter(Boolean),
    [user?.email]
  );

  const classId = route.params?.classId;
  const schoolYearId = route.params?.schoolYearId;
  const classTitleParam = route.params?.classTitle?.trim();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ChatConversation[]>([]);
  // Scope lớp (HS + guardian + key_person) — load on demand khi mở sheet.
  const [scopeGuardians, setScopeGuardians] = useState<ClassChatScopeGuardian[]>([]);
  const [scopeStudents, setScopeStudents] = useState<ClassChatScopeStudent[]>([]);
  const [loadingScope, setLoadingScope] = useState(false);
  const [callerTeacherId, setCallerTeacherId] = useState<string>('');
  const [openingGuardianId, setOpeningGuardianId] = useState<string | null>(null);
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [showAllClassesSheet, setShowAllClassesSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  /** Trang đã tải tới. */
  const pageRef = useRef(1);
  /** Số thứ tự request — bỏ qua phản hồi cũ khi đổi từ khoá/pill giữa chừng. */
  const requestSeqRef = useRef(0);

  // Chờ gõ xong rồi mới hỏi server (server lọc nên mỗi ký tự là một round-trip).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Nạp lại danh sách ghim mỗi khi màn được focus (vd sau khi ghim/bỏ ghim ở màn thông tin).
  useFocusEffect(
    useCallback(() => {
      void getPinnedIds().then((ids) => setPinnedIds(new Set(ids)));
    }, [])
  );
  /** Hội thoại vừa mở — quay lại thì trừ badge tại chỗ thay vì tải lại cả trang. */
  const lastOpenedIdRef = useRef<string>('');
  const socketChatMessageDedupeRef = useRef(new Set());

  /** Nhãn pill lớp — giống ClassActivity / Đơn từ (tránh lặp "Lớp Lớp"). */
  const classPillLabel = useMemo(() => {
    if (classTitleParam) {
      return /^lớp\s/i.test(classTitleParam) ? classTitleParam : `Lớp ${classTitleParam}`;
    }
    if (!classId) return '';
    const conv = items.find((c) => String(c.classId || '').trim() === String(classId).trim());
    const name = conv?.className?.trim();
    if (!name) return '';
    return /^lớp\s/i.test(name) ? name : `Lớp ${name}`;
  }, [classTitleParam, classId, items]);

  const queryParams = useMemo(
    () => ({
      ...(classId ? { classId, schoolYearId } : {}),
      q: debouncedQuery,
      filter,
      limit: CONVERSATION_PAGE_SIZE,
      // Danh sách chỉ vẽ tiêu đề + cụm avatar + tin cuối; roster chi tiết (SĐT, quan hệ HS↔PH,
      // môn dạy) để màn thread tự nạp. Với BOD — một trang toàn nhóm lớp ~40–65 người — đây là
      // khác biệt vài MB mỗi lần tải.
      fields: 'list' as const,
    }),
    [classId, schoolYearId, debouncedQuery, filter]
  );

  const load = useCallback(
    async (silent = false) => {
      const seq = requestSeqRef.current + 1;
      requestSeqRef.current = seq;
      try {
        if (!silent) setLoading(true);
        const res = await chatService.getConversationsPage({ ...queryParams, page: 1 });
        if (seq !== requestSeqRef.current) return;
        pageRef.current = 1;
        setItems(res.items || []);
        setHasMore(res.hasMore);
      } catch (e) {
        if (seq !== requestSeqRef.current) return;
        console.warn(e);
        setItems([]);
        setHasMore(false);
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [queryParams]
  );

  /** Cuộn tới đáy → tải trang kế và nối vào cuối. */
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const seq = requestSeqRef.current;
    const nextPage = pageRef.current + 1;
    try {
      setLoadingMore(true);
      const res = await chatService.getConversationsPage({ ...queryParams, page: nextPage });
      if (seq !== requestSeqRef.current) return;
      pageRef.current = nextPage;
      setItems((prev) => {
        const seen = new Set(prev.map((c) => String(c._id)));
        return [...prev, ...(res.items || []).filter((c) => !seen.has(String(c._id)))];
      });
      setHasMore(res.hasMore);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingMore(false);
    }
  }, [queryParams, loading, loadingMore, hasMore]);

  // Tải khi vào màn và khi ĐỔI từ khoá/pill — giống hệt web GV. Trước đây hook này là
  // `useFocusEffect` nên mỗi lần thoát thread quay lại là một lượt tải trang-1 nữa; với BOD
  // (danh sách toàn nhóm lớp) đó là phần "load khá nhiều" thấy rõ nhất.
  useEffect(() => {
    void load();
  }, [load]);

  /** Quay lại từ một thread: badge của đúng hội thoại đó về 0, khỏi phải tải lại danh sách. */
  useFocusEffect(
    useCallback(() => {
      const openedId = lastOpenedIdRef.current;
      if (!openedId) return;
      lastOpenedIdRef.current = '';
      setItems((prev) =>
        prev.map((c) =>
          String(c._id) === openedId && Number(c.unreadCount || 0) > 0
            ? { ...c, unreadCount: 0 }
            : c
        )
      );
    }, [])
  );

  /**
   * Realtime cập nhật preview/unread danh sách (parent GuardianChatScreen).
   *
   * Gắn theo VÒNG ĐỜI MÀN chứ không theo focus: đang ở trong thread mà listener bị gỡ thì tin
   * nhắn của hội thoại khác không vào được danh sách, và đó chính là lý do trước đây phải tải
   * lại toàn bộ trang-1 mỗi lần quay ra.
   */
  useEffect(() => {
    let mounted = true;
    /** @type {null | (() => void)} */
    let removeListeners = null;

    const setup = async () => {
      const socket = await chatService.getSocket();
      if (!socket || !mounted) return;

      const handleMessage = ({ conversation, message }) => {
        const conversationId = normalizeMongoId(conversation._id);
        const msgId = normalizeMongoId(message._id);
        const dupKey = msgId ? `${conversationId}:${msgId}` : '';
        let duplicateEvent = false;
        if (dupKey) {
          if (socketChatMessageDedupeRef.current.has(dupKey)) {
            duplicateEvent = true;
          } else {
            socketChatMessageDedupeRef.current.add(dupKey);
            if (socketChatMessageDedupeRef.current.size > 500) {
              socketChatMessageDedupeRef.current.clear();
            }
          }
        }

        const openConvId = normalizeMongoId(getFocusedChatConversationId());
        const viewingThisThread = openConvId === conversationId;
        const fromTeacherSelf = isMessageFromTeacherViewer(message, user?.email);

        const matchesScope =
          (!classId || String(conversation.classId || '').trim() === String(classId).trim()) &&
          (!schoolYearId ||
            String(conversation.schoolYearId || '').trim() === String(schoolYearId).trim());

        setItems((prev) => {
          const idx = prev.findIndex((x) => normalizeMongoId(x._id) === conversationId);
          if (idx < 0) {
            if (!matchesScope) return prev;
            if (duplicateEvent) return prev;
            const unreadCount = mergeUnreadCountOnSocketMessage(
              conversation,
              null,
              fromTeacherSelf,
              viewingThisThread
            );
            return [{ ...conversation, unreadCount }, ...prev];
          }
          const previous = prev[idx];
          const unreadCount = duplicateEvent
            ? Math.max(0, Number(previous.unreadCount ?? 0))
            : mergeUnreadCountOnSocketMessage(
                conversation,
                previous,
                fromTeacherSelf,
                viewingThisThread
              );
          const next = { ...conversation, unreadCount };
          // Sự kiện phát trùng: chỉ làm tươi nội dung, GIỮ NGUYÊN vị trí — hội thoại khác có thể
          // đã nhận tin mới hơn trong lúc đó, đẩy lại sẽ chèn sai thứ tự.
          if (duplicateEvent) return prev.map((item, i) => (i === idx ? next : item));
          // Có tin mới → đẩy hội thoại lên đầu. Server chỉ sắp xếp lúc TẢI TRANG còn `sorted` ở
          // client chỉ đẩy hội thoại đã ghim lên đầu, nên realtime phải tự đẩy: thay tại chỗ thì
          // dòng vừa có tin mới nhất vẫn nằm nguyên vị trí cũ.
          return [next, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        });
      };

      const handleMessageRecalled = ({ conversationId, messageId }) => {
        const cid = normalizeMongoId(conversationId);
        const mid = normalizeMongoId(messageId);
        setItems((prev) =>
          prev.map((c) => {
            if (normalizeMongoId(c._id) !== cid) return c;
            const lastMid = c.lastMessage?.messageId;
            if (lastMid && normalizeMongoId(lastMid) === mid) {
              return {
                ...c,
                lastMessage: { ...c.lastMessage, content: '' },
              };
            }
            return c;
          })
        );
      };

      socket.on(CHAT_EVENTS.MESSAGE, handleMessage);
      socket.on(CHAT_EVENTS.RECALLED, handleMessageRecalled);
      removeListeners = () => {
        socket.off(CHAT_EVENTS.MESSAGE, handleMessage);
        socket.off(CHAT_EVENTS.RECALLED, handleMessageRecalled);
      };
      if (!mounted) {
        removeListeners();
      }
    };

    void setup();

    return () => {
      mounted = false;
      removeListeners?.();
    };
  }, [classId, schoolYearId, user?.email]);

  /** Load scope (HS + guardian) khi GV mở sheet — gọi 1 lần / phiên bottom sheet. */
  const loadScope = useCallback(async () => {
    if (!classId || !schoolYearId) {
      setScopeGuardians([]);
      setScopeStudents([]);
      return;
    }
    setLoadingScope(true);
    try {
      const scope = await chatService.getClassChatScope(classId, schoolYearId);
      if (!scope) {
        setScopeGuardians([]);
        setScopeStudents([]);
        return;
      }
      setScopeGuardians(scope.guardians || []);
      setScopeStudents(scope.students || []);
      setCallerTeacherId(scope.callerTeacherId || '');
    } catch (e: unknown) {
      console.warn('[Exchange] getClassChatScope:', e);
      setScopeGuardians([]);
      setScopeStudents([]);
    } finally {
      setLoadingScope(false);
    }
  }, [classId, schoolYearId]);

  /**
   * Vào Trao đổi từ MỘT LỚP ⇒ sheet cũ dựng từ `getClassChatScope` (lọc PH chính, có tên HS).
   * Vào từ hộp thư gộp (không có classId) ⇒ sheet mới dựng từ các nhóm lớp GV là thành viên,
   * để vẫn tạo được chat 1-1 mà không phải mở nhóm lớp trước (đồng bộ bản GV web).
   */
  const handleOpenNewSheet = useCallback(() => {
    if (!classId || !schoolYearId) {
      setShowAllClassesSheet(true);
      return;
    }
    setShowNewSheet(true);
    void loadScope();
  }, [classId, schoolYearId, loadScope]);

  const handleSelectParentCandidate = useCallback(
    (candidate: ParentChatCandidate) => {
      setShowAllClassesSheet(false);
      navigation.navigate(ROUTES.SCREENS.EXCHANGE_CHAT, {
        conversationId: 'new',
        classId: candidate.classId,
        schoolYearId: candidate.schoolYearId,
        teacherId: candidate.teacherId,
        guardianId: candidate.guardianId,
      });
      void load(true);
    },
    [load, navigation]
  );

  const handleSelectGuardian = useCallback(
    async (row: GuardianStudentRow) => {
      if (!classId || !schoolYearId) return;
      if (!callerTeacherId) {
        Alert.alert(t('exchange.title'), 'Không xác định được giáo viên — vui lòng tải lại.');
        return;
      }
      try {
        setOpeningGuardianId(row.guardianId);
        setShowNewSheet(false);
        navigation.navigate(ROUTES.SCREENS.EXCHANGE_CHAT, {
          conversationId: 'new',
          classId,
          schoolYearId,
          teacherId: callerTeacherId,
          guardianId: row.guardianId,
        });
        void load(true);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Không thể mở chat với phụ huynh này.';
        Alert.alert(t('exchange.title'), msg);
      } finally {
        setOpeningGuardianId(null);
      }
    },
    [callerTeacherId, classId, schoolYearId, load, navigation, t]
  );

  const sorted = useMemo(() => {
    let list = [...items];
    if (classId) {
      list = list.filter((c) => String(c.classId || '').trim() === String(classId).trim());
    }
    if (schoolYearId) {
      list = list.filter(
        (c) => String(c.schoolYearId || '').trim() === String(schoolYearId).trim()
      );
    }
    // Khớp web ChatConversationList: server đã sort (chưa đọc → lastMessage.createdAt → updatedAt);
    // client chỉ đẩy hội thoại đã ghim lên đầu, giữ thứ tự tương đối còn lại. Hội thoại vừa có tin
    // mới do handler `chat:message` tự đưa lên đầu `items` — không sort lại theo thời gian ở đây.
    return list.sort(
      (a, b) => Number(pinnedIds.has(String(b._id))) - Number(pinnedIds.has(String(a._id)))
    );
  }, [items, classId, schoolYearId, pinnedIds]);

  /** Server đã lọc theo từ khoá + pill; ở đây chỉ còn đẩy ghim lên đầu. */
  const filtered = sorted;

  const openConversation = useCallback(
    (item: ChatConversation) => {
      lastOpenedIdRef.current = String(item._id);
      navigation.navigate(ROUTES.SCREENS.EXCHANGE_CHAT, {
        conversationId: item._id,
        classId: item.classId,
        schoolYearId: item.schoolYearId || schoolYearId || '',
      });
    },
    [navigation, schoolYearId]
  );

  const handleHiddenFromList = useCallback(() => void load(true), [load]);

  // `useCallback` để FlatList không coi mọi lần render là "renderItem mới" rồi dựng lại toàn bộ
  // hàng đang mount — mỗi ký tự gõ trong ô tìm kiếm là một lần render như vậy.
  const renderItem = useCallback(
    ({ item }: { item: ChatConversation }) => {
      // Dòng phụ: chỉ tên người gửi + nội dung tin cuối (không lặp tên lớp/title).
      const lastContent = item.lastMessage?.content?.trim() || '';
      // lastMessage thiếu role/email — suy PH từ roster (đặc biệt chat 1-1).
      const lastSender = resolveChatSenderDisplayName(item, {
        name: item.lastMessage?.senderName,
        email: item.lastMessage?.senderEmail,
      });
      const subtitle = lastContent
        ? lastSender
          ? `${lastSender}: ${lastContent}`
          : lastContent
        : 'Chưa có tin nhắn';

      let timeLabel = '';
      try {
        if (item.lastMessage?.createdAt) {
          timeLabel = formatDistanceToNow(new Date(item.lastMessage.createdAt), {
            addSuffix: true,
            locale: vi,
          });
        }
      } catch {
        timeLabel = '';
      }

      return (
        <ExchangeConversationSwipeRow
          item={item}
          chatViewerEmails={chatViewerEmails}
          conversationTitle={conversationHeaderTitle(item) || ''}
          subtitle={subtitle}
          timeLabel={timeLabel}
          guardianFallbackTitle={t('exchange.conversation_fallback')}
          onOpen={openConversation}
          onHiddenFromList={handleHiddenFromList}
        />
      );
    },
    [chatViewerEmails, handleHiddenFromList, openConversation, t]
  );

  const showClassPill = Boolean(classId && classPillLabel);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header: tiêu đề căn giữa, hai bên spacer 44px (màn là tab nên không có back) */}
      <View className="px-4 pt-4">
        <View className="mb-4 flex-row items-center">
          <View style={{ width: 44, height: 44 }} />
          <Text
            className="flex-1 text-center text-2xl text-[#0A2240]"
            style={{ fontFamily: 'Mulish-Bold' }}
            numberOfLines={1}>
            {t('exchange.title')}
          </Text>
          {/* Nút tạo mới đã chuyển xuống cuối thanh tìm kiếm (đồng bộ bản GV web). */}
          <View style={{ width: 44, height: 44 }} />
        </View>
        {showClassPill ? (
          <View className="mb-2 items-center px-4">
            <View className="rounded-full px-4 py-2" style={{ backgroundColor: '#E5EAF0' }}>
              <Text
                className="max-w-[280px] text-base font-semibold text-[#002855]"
                numberOfLines={1}>
                {classPillLabel}
              </Text>
            </View>
          </View>
        ) : null}
        {/* Thanh tìm kiếm + nút tạo mới ở cuối — giống web */}
        <View className="mb-3 flex-row items-center">
          <View
            className="flex-1 flex-row items-center rounded-xl px-3"
            style={{ backgroundColor: '#F1F3F5', height: 44 }}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('exchange.search_placeholder')}
              placeholderTextColor="#9CA3AF"
              className="ml-2 flex-1 text-base text-[#0A2240]"
              style={{ paddingVertical: 0 }}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>
          {/* Lối tắt tạo chat 1-1 với PH — khỏi phải mở nhóm lớp rồi bấm tên PH. */}
          <TouchableOpacity
            onPress={handleOpenNewSheet}
            className="ml-2 items-center justify-center rounded-full"
            style={{ width: 44, height: 44, backgroundColor: '#FF7A00' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Chat riêng với phụ huynh">
            <Ionicons name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {/* Bộ lọc — Tất cả / Nhóm / Phụ huynh / Chưa đọc */}
        <View className="mb-2 flex-row" style={{ gap: 8 }}>
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                className="rounded-full px-3 py-1.5"
                style={{ backgroundColor: active ? '#0A2240' : '#F1F3F5' }}>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: active ? '#FFFFFF' : '#6B7280' }}>
                  {t(tab.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FF7A00" />
        </View>
      ) : sorted.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="chatbubbles-outline" size={56} color="#D1D5DB" />
          <Text style={{ marginTop: 12, fontSize: 16, color: '#6B7280', textAlign: 'center' }}>
            {t('exchange.empty_list')}
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="search-outline" size={48} color="#D1D5DB" />
          <Text style={{ marginTop: 12, fontSize: 15, color: '#6B7280', textAlign: 'center' }}>
            {searchQuery.trim()
              ? t('exchange.search_no_match', { query: searchQuery.trim() })
              : t('exchange.filter_no_match')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c._id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.35}
          // Mặc định của FlatList giữ ~21 màn hình hàng trong cây — với 50 hàng mỗi hàng một
          // `Swipeable` thì gần như không ảo hoá gì. Bó lại quanh vùng nhìn thấy.
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ paddingVertical: 16 }} color="#FF7A00" />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
              colors={['#FF7A00']}
            />
          }
        />
      )}
      <NewParentChatSheet
        visible={showAllClassesSheet}
        viewerEmail={user?.email}
        onSelect={handleSelectParentCandidate}
        onClose={() => setShowAllClassesSheet(false)}
      />
      <NewConversationSheet
        visible={showNewSheet}
        loading={loadingScope}
        guardians={scopeGuardians}
        students={scopeStudents}
        openingGuardianId={openingGuardianId}
        onSelect={handleSelectGuardian}
        onClose={() => setShowNewSheet(false)}
      />
    </SafeAreaView>
  );
}
