/**
 * Trao đổi — danh sách hội thoại GV ↔ PH (lọc theo lớp nếu có param)
 */
// @ts-nocheck
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
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

import {
  NewConversationSheet,
  type GuardianStudentRow,
} from './components/NewConversationSheet';
import { ExchangeGroupChatAvatar } from './components/ExchangeGroupChatAvatar';
import {
  conversationHeaderTitle,
  isMessageFromTeacherViewer,
  mergeUnreadCountOnSocketMessage,
  normalizeMongoId,
} from './exchangeChatThreadUtils';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.EXCHANGE_LIST>;

/** _id Mongo 24 hex — mới gọi được API ẩn / vuốt xóa khỏi danh sách. */
function isPersistentConversationId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(String(id || '').trim());
}

/**
 * Hàng danh sách Trao đổi — vuốt (native) lộ nút xóa: chỉ ẩn khỏi danh sách user, không hard delete.
 */
function ExchangeConversationSwipeRow({
  item,
  chatViewerEmails,
  conversationTitle,
  subtitle,
  timeLabel,
  guardianFallbackTitle,
  onPress,
  onHiddenFromList,
}: {
  item: ChatConversation;
  chatViewerEmails: string[];
  conversationTitle: string;
  subtitle: string;
  timeLabel: string;
  guardianFallbackTitle: string;
  onPress: () => void;
  onHiddenFromList?: () => void;
}) {
  const swipeRef = useRef(null);
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
              Alert.alert(
                'Lỗi',
                e instanceof Error ? e.message : 'Không thể ẩn cuộc trò chuyện.',
              );
            }
          },
        },
      ],
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
      onPress={onPress}>
      <View style={{ marginRight: 12 }}>
        <ExchangeGroupChatAvatar
          conversation={item}
          viewerEmails={chatViewerEmails}
          size={44}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: 'Mulish-Bold', fontSize: 16, color: '#111' }} numberOfLines={1}>
          {conversationTitle || g?.name || guardianFallbackTitle}
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
}

export default function ExchangeListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { t } = useLanguage();
  const { user } = useAuth();

  const chatViewerEmails = useMemo(
    () => [String(user?.email || '').trim()].filter(Boolean),
    [user?.email],
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
  const listFocusCountRef = useRef(0);
  const socketChatMessageDedupeRef = useRef(new Set());

  /** Nhãn pill lớp — giống ClassActivity / Đơn từ (tránh lặp "Lớp Lớp"). */
  const classPillLabel = useMemo(() => {
    if (classTitleParam) {
      return /^lớp\s/i.test(classTitleParam) ? classTitleParam : `Lớp ${classTitleParam}`;
    }
    if (!classId) return '';
    const conv = items.find(
      (c) => String(c.classId || '').trim() === String(classId).trim()
    );
    const name = conv?.className?.trim();
    if (!name) return '';
    return /^lớp\s/i.test(name) ? name : `Lớp ${name}`;
  }, [classTitleParam, classId, items]);

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const list = await chatService.getConversations(
          classId ? { classId, schoolYearId } : undefined
        );
        setItems(list || []);
      } catch (e) {
        console.warn(e);
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [classId, schoolYearId]
  );

  useFocusEffect(
    useCallback(() => {
      listFocusCountRef.current += 1;
      const silent = listFocusCountRef.current > 1;
      void load(silent);
    }, [load]),
  );

  /** Realtime cập nhật preview/ unread danh sách (parent GuardianChatScreen). */
  useFocusEffect(
    useCallback(() => {
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
            (!classId ||
              String(conversation.classId || '').trim() === String(classId).trim()) &&
            (!schoolYearId ||
              String(conversation.schoolYearId || '').trim() ===
                String(schoolYearId).trim());

          setItems((prev) => {
            const idx = prev.findIndex((x) => normalizeMongoId(x._id) === conversationId);
            if (idx < 0) {
              if (!matchesScope) return prev;
              if (duplicateEvent) return prev;
              const unreadCount = mergeUnreadCountOnSocketMessage(
                    conversation,
                    null,
                    fromTeacherSelf,
                    viewingThisThread,
                  );
              return [{ ...conversation, unreadCount }, ...prev];
            }
            return prev.map((item) => {
              if (normalizeMongoId(item._id) !== conversationId) return item;
              const unreadCount = duplicateEvent
                ? Math.max(0, Number(item.unreadCount ?? 0))
                : mergeUnreadCountOnSocketMessage(
                    conversation,
                    item,
                    fromTeacherSelf,
                    viewingThisThread,
                  );
              return { ...conversation, unreadCount };
            });
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
            }),
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
    }, [classId, schoolYearId, user?.email]),
  );

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

  const handleOpenNewSheet = useCallback(() => {
    setShowNewSheet(true);
    void loadScope();
  }, [loadScope]);

  const handleSelectGuardian = useCallback(
    async (row: GuardianStudentRow) => {
      if (!classId || !schoolYearId) return;
      if (!callerTeacherId) {
        Alert.alert(
          t('exchange.title'),
          'Không xác định được giáo viên — vui lòng tải lại.',
        );
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
        const msg =
          e instanceof Error
            ? e.message
            : 'Không thể mở chat với phụ huynh này.';
        Alert.alert(t('exchange.title'), msg);
      } finally {
        setOpeningGuardianId(null);
      }
    },
    [callerTeacherId, classId, schoolYearId, load, navigation, t],
  );

  const sorted = useMemo(() => {
    let list = [...items];
    if (classId) {
      list = list.filter((c) => String(c.classId || '').trim() === String(classId).trim());
    }
    if (schoolYearId) {
      list = list.filter(
        (c) => String(c.schoolYearId || '').trim() === String(schoolYearId).trim(),
      );
    }
    return list.sort((a, b) => {
      const ua = Number(a.unreadCount || 0) > 0 ? 1 : 0;
      const ub = Number(b.unreadCount || 0) > 0 ? 1 : 0;
      if (ua !== ub) return ub - ua;
      const ta = new Date(a.updatedAt || a.lastMessage?.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.lastMessage?.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [items, classId, schoolYearId]);

  const renderItem = ({ item }: { item: ChatConversation }) => {
    // Dòng phụ: chỉ tên người gửi + nội dung tin cuối (không lặp tên lớp/title).
    const lastContent = item.lastMessage?.content?.trim() || '';
    const lastSender = item.lastMessage?.senderName?.trim() || '';
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
        onPress={() =>
          navigation.navigate(ROUTES.SCREENS.EXCHANGE_CHAT, {
            conversationId: item._id,
            classId: item.classId,
            schoolYearId: item.schoolYearId || schoolYearId || '',
          })
        }
        onHiddenFromList={() => void load(true)}
      />
    );
  };

  const showClassPill = Boolean(classId && classPillLabel);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header giống Hoạt động / Đơn từ: back + tiêu đề căn giữa + nút Tạo mới (44px) */}
      <View className="px-4 pt-4">
        <View className="mb-4 flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: -8,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color="#0A2240" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-2xl font-bold text-[#0A2240]" numberOfLines={1}>
            {t('exchange.title')}
          </Text>
          {classId && schoolYearId ? (
            <TouchableOpacity
              onPress={handleOpenNewSheet}
              style={{
                width: 44,
                height: 44,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: -8,
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Tạo cuộc trò chuyện mới">
              <Ionicons name="create-outline" size={24} color="#0A2240" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
        {showClassPill ? (
          <View className="mb-2 items-center px-4">
            <View
              className="rounded-full px-4 py-2"
              style={{ backgroundColor: '#E5EAF0' }}>
              <Text
                className="max-w-[280px] text-base font-semibold text-[#002855]"
                numberOfLines={1}>
                {classPillLabel}
              </Text>
            </View>
          </View>
        ) : null}
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
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(c) => c._id}
          renderItem={renderItem}
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
