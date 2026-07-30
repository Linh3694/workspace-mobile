/**
 * Thông tin hội thoại Trao đổi — thành viên / ảnh-video / tệp (giống sidebar phải bản web).
 * Mỗi mục hiển thị mặc định 3 + "Xem thêm" mở trang đầy đủ.
 * GV có quyền chat (là participant GV của lớp) → bấm PH mở đoạn chat 1-1.
 * Dữ liệu: getMessages(id, 1, 50) trả về conversation (thành viên) + attachments (media/tệp).
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { chatService, resolveChatAttachmentUrl } from '../../services/chatService';
import type { ChatAttachment, ChatConversation } from '../../types/chat';

import { ChatImagePreviewModal } from './components/ChatImagePreviewModal';
import { ChatVideoThumbnail } from './components/ChatVideoThumbnail';
import { ExchangeGroupChatAvatar } from './components/ExchangeGroupChatAvatar';
import { InfoMemberRow } from './components/InfoMemberRow';
import { conversationHeaderTitle } from './exchangeChatThreadUtils';
import { isConversationPinned, togglePinned } from './chatPinStore';
import {
  buildConversationMembers,
  isViewerHomeroom,
  resolveCallerTeacherId,
} from './exchangeInfoUtils';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.EXCHANGE_CHAT_INFO>;

const PREVIEW_COUNT = 3;

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ExchangeChatInfoScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  const conversationId = String(route.params?.conversationId || '').trim();
  const [conversation, setConversation] = useState<ChatConversation | null>(
    route.params?.conversation ?? null
  );
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [writeModeBusy, setWriteModeBusy] = useState(false);

  const viewerEmails = useMemo(
    () => [String(user?.email || '').trim()].filter(Boolean),
    [user?.email]
  );

  const roleLabels = useMemo(
    () => ({
      teacher: t('exchange.info_role_teacher'),
      subjectTeacher: t('exchange.info_role_subject_teacher'),
      parent: t('exchange.info_role_parent'),
      homeroom: t('exchange.info_role_homeroom'),
      viceHomeroom: t('exchange.info_role_vice_homeroom'),
    }),
    [t]
  );

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await chatService.getMessages(conversationId, 1, 50);
        if (!mounted) return;
        if (data.conversation) setConversation(data.conversation);
        setAttachments((data.messages || []).flatMap((m) => m.attachments || []));
      } catch (e) {
        console.warn('[ExchangeChatInfo] load failed', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    void isConversationPinned(conversationId).then((p) => {
      if (mounted) setPinned(p);
    });
    return () => {
      mounted = false;
    };
  }, [conversationId]);

  const members = useMemo(
    () => buildConversationMembers(conversation, roleLabels),
    [conversation, roleLabels]
  );
  const callerTeacherId = useMemo(
    () => resolveCallerTeacherId(conversation, user?.email),
    [conversation, user?.email]
  );
  const canOpenOneToOne = Boolean(callerTeacherId);

  const media = useMemo(
    () => attachments.filter((a) => a.kind === 'image' || a.kind === 'video'),
    [attachments]
  );
  const imagesOnly = useMemo(() => media.filter((a) => a.kind === 'image'), [media]);
  const files = useMemo(() => attachments.filter((a) => a.kind === 'file'), [attachments]);

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const title = conversationHeaderTitle(conversation) || t('exchange.title_detail');
  const subtitle = [
    conversation?.className,
    members.length ? t('exchange.info_members_count', { n: members.length }) : '',
  ]
    .filter(Boolean)
    .join(' • ');

  const onTogglePin = async () => {
    const p = await togglePinned(conversationId);
    setPinned(p);
  };

  // Khóa nhóm về "chỉ GV được nhắn" — chỉ nhóm lớp và chỉ GVCN/phó (backend check lại theo scope).
  const canManageWriteMode =
    isViewerHomeroom(conversation, user?.email) && conversation?.type === 'class_general';
  const teachersOnly = conversation?.writeMode === 'teachers_only';

  const onToggleWriteMode = async () => {
    if (!conversation || writeModeBusy) return;
    setWriteModeBusy(true);
    try {
      const updated = await chatService.setConversationWriteMode(
        conversationId,
        teachersOnly ? 'all' : 'teachers_only'
      );
      setConversation(updated);
    } catch (e) {
      console.warn('[ExchangeChatInfo] setConversationWriteMode failed', e);
      Alert.alert(t('common.error'), t('exchange.info_write_mode_error'));
    } finally {
      setWriteModeBusy(false);
    }
  };

  const openAttachment = (url?: string) => {
    const u = resolveChatAttachmentUrl(url || '');
    if (u) void Linking.openURL(u).catch(() => undefined);
  };

  /** Bấm 1 media: ảnh → lightbox trong app (giống chat); video → mở ngoài. */
  const onTapMedia = (att: ChatAttachment) => {
    if (att.kind === 'video') {
      openAttachment(att.url);
      return;
    }
    const i = imagesOnly.findIndex((x) => x.url === att.url);
    if (i >= 0) setPreviewIndex(i);
    else openAttachment(att.url);
  };

  /** Mở đoạn chat 1-1 GV↔PH (draft get-or-create) — chỉ khi GV có quyền chat. */
  const openOneToOne = (guardianId?: string) => {
    if (!canOpenOneToOne || !guardianId || !conversation) return;
    navigation.navigate(ROUTES.SCREENS.EXCHANGE_CHAT, {
      conversationId: 'new',
      classId: conversation.classId,
      schoolYearId: conversation.schoolYearId,
      teacherId: callerTeacherId,
      guardianId,
    });
  };

  const openMembersScreen = () =>
    navigation.navigate(ROUTES.SCREENS.EXCHANGE_CHAT_MEMBERS, {
      conversationId,
      conversation: conversation ?? undefined,
      classId: conversation?.classId,
      schoolYearId: conversation?.schoolYearId,
    });

  const openAttachmentsScreen = (kind: 'media' | 'files') =>
    navigation.navigate(ROUTES.SCREENS.EXCHANGE_CHAT_ATTACHMENTS, {
      conversationId,
      kind,
      title: kind === 'media' ? t('exchange.info_media') : t('exchange.info_files'),
    });

  const mediaTile = Math.floor((windowWidth - 32 - 16) / 3); // px-4 (32) + 2 gaps (8*2)
  const previewMembers = members.slice(0, PREVIEW_COUNT);
  const previewMedia = media.slice(0, PREVIEW_COUNT);
  const previewFiles = files.slice(0, PREVIEW_COUNT);

  const SeeMore = ({ onPress }: { onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} className="flex-row items-center justify-center py-3">
      <Text className="text-sm font-semibold text-[#0A9488]">{t('exchange.info_see_more')}</Text>
      <Ionicons name="chevron-forward" size={16} color="#0A9488" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-100 px-2 py-2">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#0A2240" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-[#0A2240]">
          {t('exchange.info_title')}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Hero */}
        <View className="items-center px-4 pt-6">
          {conversation ? (
            <ExchangeGroupChatAvatar
              conversation={conversation}
              viewerEmails={viewerEmails}
              size={80}
            />
          ) : (
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#E5E7EB' }} />
          )}
          <Text className="mt-3 text-center text-xl font-bold text-[#0A2240]" numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="mt-1 text-center text-sm text-[#6B7280]">{subtitle}</Text>
          ) : null}

          {/* Quick actions: Ghim / Thành viên / Khóa nhóm (GVCN-phó, nhóm lớp) */}
          <View className="mt-4 w-full flex-row" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={onTogglePin}
              className="flex-1 items-center rounded-2xl border border-gray-100 py-3"
              style={{ backgroundColor: pinned ? '#FFF4E5' : '#F9FAFB' }}>
              <Ionicons
                name={pinned ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={pinned ? '#F97316' : '#0A2240'}
              />
              <Text className="mt-1 text-sm font-semibold text-[#0A2240]">
                {pinned ? t('exchange.info_unpin') : t('exchange.info_pin')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openMembersScreen}
              className="flex-1 items-center rounded-2xl border border-gray-100 py-3"
              style={{ backgroundColor: '#F9FAFB' }}>
              <Ionicons name="people-outline" size={20} color="#0A2240" />
              <Text className="mt-1 text-sm font-semibold text-[#0A2240]">
                {t('exchange.info_members')}
              </Text>
            </TouchableOpacity>
            {canManageWriteMode ? (
              <TouchableOpacity
                onPress={() => void onToggleWriteMode()}
                disabled={writeModeBusy}
                className="flex-1 items-center rounded-2xl border border-gray-100 py-3"
                style={{
                  backgroundColor: teachersOnly ? '#FFF4E5' : '#F9FAFB',
                  opacity: writeModeBusy ? 0.5 : 1,
                }}>
                <Ionicons
                  name={teachersOnly ? 'lock-closed' : 'lock-open-outline'}
                  size={20}
                  color={teachersOnly ? '#F97316' : '#0A2240'}
                />
                <Text className="mt-1 text-sm font-semibold text-[#0A2240]">
                  {teachersOnly ? t('exchange.info_unlock_group') : t('exchange.info_lock_group')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {loading && !conversation ? (
          <View className="items-center py-10">
            <ActivityIndicator size="large" color="#FF7A00" />
          </View>
        ) : null}

        {/* Thành viên (mặc định 3) */}
        <View className="mt-6 px-4">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">
            {t('exchange.info_members')} ({members.length})
          </Text>
          {previewMembers.map((m) => (
            <InfoMemberRow
              key={m.key}
              member={m}
              onPress={
                m.isGuardian && canOpenOneToOne && m.guardianId
                  ? () => openOneToOne(m.guardianId)
                  : undefined
              }
            />
          ))}
          {members.length > PREVIEW_COUNT ? <SeeMore onPress={openMembersScreen} /> : null}
        </View>

        {/* Ảnh & Video (mặc định 3) */}
        <View className="mt-6 px-4">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">
            {t('exchange.info_media')}
          </Text>
          {media.length === 0 ? (
            <Text className="py-2 text-sm text-[#9CA3AF]">{t('exchange.info_no_media')}</Text>
          ) : (
            <>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {previewMedia.map((a, i) => (
                  <Pressable
                    key={`${a.url}-${i}`}
                    onPress={() => onTapMedia(a)}
                    className="relative overflow-hidden rounded-lg bg-black/10"
                    style={{ width: mediaTile, height: mediaTile }}>
                    {a.kind === 'video' ? (
                      <ChatVideoThumbnail
                        uri={resolveChatAttachmentUrl(a.url)}
                        width={mediaTile}
                        height={mediaTile}
                        playIconSize={30}
                        dimmed={false}
                      />
                    ) : (
                      <Image
                        source={{ uri: resolveChatAttachmentUrl(a.url) }}
                        style={{ width: mediaTile, height: mediaTile }}
                        resizeMode="cover"
                      />
                    )}
                  </Pressable>
                ))}
              </View>
              {media.length > PREVIEW_COUNT ? (
                <SeeMore onPress={() => openAttachmentsScreen('media')} />
              ) : null}
            </>
          )}
        </View>

        {/* Tệp (mặc định 3) */}
        <View className="mt-6 px-4">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">
            {t('exchange.info_files')}
          </Text>
          {files.length === 0 ? (
            <Text className="py-2 text-sm text-[#9CA3AF]">{t('exchange.info_no_files')}</Text>
          ) : (
            <>
              {previewFiles.map((f, i) => (
                <TouchableOpacity
                  key={`${f.url}-${i}`}
                  onPress={() => openAttachment(f.url)}
                  className="flex-row items-center gap-3 rounded-xl py-2">
                  <View
                    className="items-center justify-center rounded-lg"
                    style={{ width: 40, height: 40, backgroundColor: '#FEF2F2' }}>
                    <Ionicons name="document-text-outline" size={22} color="#EF4444" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-semibold text-[#0A2240]" numberOfLines={1}>
                      {f.name || 'Tệp đính kèm'}
                    </Text>
                    {f.size != null ? (
                      <Text className="text-xs text-[#9CA3AF]">{formatFileSize(f.size)}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
              {files.length > PREVIEW_COUNT ? (
                <SeeMore onPress={() => openAttachmentsScreen('files')} />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {previewIndex != null ? (
        <ChatImagePreviewModal
          images={imagesOnly}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
