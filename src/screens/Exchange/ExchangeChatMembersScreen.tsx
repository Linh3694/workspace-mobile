/**
 * Danh sách đầy đủ thành viên hội thoại + tìm kiếm + quản lý (thêm/gỡ GV bộ môn).
 * - GV có quyền chat → bấm PH mở đoạn chat 1-1.
 * - GVCN/Phó CN (viewerIsHomeroom) → thêm GV bộ môn / gỡ GV bộ môn đã thêm (logic giống web).
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { chatService } from '../../services/chatService';
import type { AddableTeacher, ChatConversation } from '../../types/chat';

import { makeRelationshipTranslator } from '../../utils/relationshipLabels';

import { InfoMemberRow } from './components/InfoMemberRow';
import { MemberProfileSheet } from './components/MemberProfileSheet';
import { formatChatDisplayName } from './exchangeChatThreadUtils';
import {
  buildConversationMembers,
  filterInfoMembers,
  isViewerHomeroom,
  resolveCallerTeacherId,
  type InfoMember,
} from './exchangeInfoUtils';
import { resolveParticipantAvatarUrl } from './lib/chatMemberAvatar';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.EXCHANGE_CHAT_MEMBERS>;

export default function ExchangeChatMembersScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { t } = useLanguage();
  const { user } = useAuth();

  const conversationId = String(route.params?.conversationId || '').trim();
  const [conversation, setConversation] = useState<ChatConversation | null>(
    route.params?.conversation ?? null
  );
  const [searchQuery, setSearchQuery] = useState('');
  /** PH đang mở sheet thông tin — null là đóng. */
  const [profileMember, setProfileMember] = useState<InfoMember | null>(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addable, setAddable] = useState<AddableTeacher[]>([]);
  const [loadingAddable, setLoadingAddable] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const addSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Giữ nguyên OBJECT đã chọn (không chỉ id): danh sách kết quả đổi theo từ khoá, người đã
   * chọn ở lượt tìm trước phải còn hiện ra để GVCN biết mình sắp thêm ai.
   */
  const [selectedTeachers, setSelectedTeachers] = useState<AddableTeacher[]>([]);
  const selectedAddIds = useMemo(
    () => new Set(selectedTeachers.map((tt) => tt.teacherId)),
    [selectedTeachers]
  );
  /** Tooltip giải thích phạm vi tìm kiếm — mobile không có hover nên bấm icon để bật/tắt. */
  const [scopeHintVisible, setScopeHintVisible] = useState(false);
  const [busy, setBusy] = useState(false);

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
    if (conversation) return;
    let mounted = true;
    void (async () => {
      try {
        const data = await chatService.getMessages(conversationId, 1, 1);
        if (mounted && data.conversation) setConversation(data.conversation);
      } catch (e) {
        console.warn('[ExchangeChatMembers] load failed', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [conversation, conversationId]);

  const translateRelationship = useMemo(() => makeRelationshipTranslator(t), [t]);
  const members = useMemo(
    () => buildConversationMembers(conversation, roleLabels, translateRelationship),
    [conversation, roleLabels, translateRelationship]
  );
  const callerTeacherId = useMemo(
    () => resolveCallerTeacherId(conversation, user?.email),
    [conversation, user?.email]
  );
  const canOpenOneToOne = Boolean(callerTeacherId);
  const viewerIsHomeroom = useMemo(
    () => isViewerHomeroom(conversation, user?.email),
    [conversation, user?.email]
  );

  const filtered = useMemo(() => filterInfoMembers(members, searchQuery), [members, searchQuery]);

  const openOneToOne = (guardianId?: string) => {
    if (!canOpenOneToOne || !guardianId || !conversation) return;
    setProfileMember(null);
    navigation.navigate(ROUTES.SCREENS.EXCHANGE_CHAT, {
      conversationId: 'new',
      classId: conversation.classId,
      schoolYearId: conversation.schoolYearId,
      teacherId: callerTeacherId,
      guardianId,
    });
  };

  const fetchAddable = async (search: string) => {
    setLoadingAddable(true);
    try {
      const list = await chatService.getAddableTeachers(conversationId, search);
      setAddable(list || []);
    } catch (e) {
      console.warn('[ExchangeChatMembers] addable failed', e);
      setAddable([]);
    } finally {
      setLoadingAddable(false);
    }
  };

  const openAddModal = () => {
    setAddModalVisible(true);
    setSelectedTeachers([]);
    setAddSearchQuery('');
    setScopeHintVisible(false);
    void fetchAddable('');
  };

  const onChangeAddSearch = (text: string) => {
    setAddSearchQuery(text);
    setScopeHintVisible(false);
    if (addSearchTimeoutRef.current) clearTimeout(addSearchTimeoutRef.current);
    addSearchTimeoutRef.current = setTimeout(() => {
      void fetchAddable(text);
    }, 300);
  };

  useEffect(
    () => () => {
      if (addSearchTimeoutRef.current) clearTimeout(addSearchTimeoutRef.current);
    },
    []
  );

  const toggleSelectAdd = (teacher: AddableTeacher) => {
    setSelectedTeachers((prev) =>
      prev.some((item) => item.teacherId === teacher.teacherId)
        ? prev.filter((item) => item.teacherId !== teacher.teacherId)
        : [...prev, teacher]
    );
  };

  /** Thêm tuần tự từng GV (giống web) — lần cuối trả về conversation mới nhất. */
  const confirmAdd = async () => {
    if (!selectedTeachers.length || busy) return;
    setBusy(true);
    const addedIds = new Set<string>();
    let updated: ChatConversation | null = conversation;
    try {
      for (const teacher of selectedTeachers) {
        updated = await chatService.addConversationTeacher(conversationId, teacher.teacherId);
        addedIds.add(teacher.teacherId);
      }
      setAddModalVisible(false);
    } catch (e) {
      console.warn('[ExchangeChatMembers] add failed', e);
      // Lỗi giữa chừng: báo rõ đã thêm được bao nhiêu, giữ modal mở để thử lại phần còn lại.
      Alert.alert(
        t('common.error'),
        addedIds.size
          ? t('exchange.info_add_partial_error', { n: addedIds.size })
          : t('exchange.info_add_error')
      );
    } finally {
      if (updated) setConversation(updated);
      // Chỉ bỏ người ĐÃ thêm xong — người lỗi giữ lại để thử lại, không mất lựa chọn.
      setAddable((prev) => prev.filter((item) => !addedIds.has(item.teacherId)));
      setSelectedTeachers((prev) => prev.filter((item) => !addedIds.has(item.teacherId)));
      setBusy(false);
    }
  };

  const confirmRemove = (teacherId?: string, name?: string) => {
    if (!teacherId) return;
    Alert.alert(t('exchange.info_members'), t('exchange.info_remove_confirm', { name: name || '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('exchange.info_remove_action'),
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await chatService.removeConversationTeacher(conversationId, teacherId);
            setConversation(updated);
          } catch (e) {
            console.warn('[ExchangeChatMembers] remove failed', e);
            Alert.alert(t('common.error'), t('exchange.info_remove_error'));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="flex-row items-center border-b border-gray-100 px-2 py-2">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#0A2240" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-[#0A2240]">
          {t('exchange.info_members')} ({members.length})
        </Text>
        {viewerIsHomeroom ? (
          <TouchableOpacity
            onPress={openAddModal}
            style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={t('exchange.info_add_subject_teacher')}>
            <Ionicons name="person-add-outline" size={22} color="#0A2240" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <View className="px-4 pt-3">
        <View
          className="flex-row items-center rounded-xl px-3"
          style={{ backgroundColor: '#F1F3F5', height: 44 }}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('exchange.info_members_search')}
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
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <InfoMemberRow
            member={item}
            onPress={item.isGuardian ? () => setProfileMember(item) : undefined}
            onRemove={
              viewerIsHomeroom && item.removable && item.teacherId
                ? () => confirmRemove(item.teacherId, item.name)
                : undefined
            }
          />
        )}
        ListEmptyComponent={
          <Text className="mt-8 text-center text-sm text-[#9CA3AF]">
            {t('exchange.info_members_no_match')}
          </Text>
        }
      />

      <MemberProfileSheet
        member={profileMember}
        visible={Boolean(profileMember)}
        onClose={() => setProfileMember(null)}
        studentMeta={conversation?.className}
        onMessage={
          canOpenOneToOne && profileMember?.guardianId
            ? () => openOneToOne(profileMember.guardianId)
            : undefined
        }
      />

      {/* Modal thêm GV bộ môn */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[75%] rounded-t-3xl bg-white pb-6">
            <View className="flex-row items-center justify-between px-4 py-4">
              <Text className="text-lg font-bold text-[#0A2240]">
                {t('exchange.info_add_subject_teacher')}
              </Text>
              <TouchableOpacity
                onPress={() => setAddModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* zIndex: tooltip là View tuyệt đối phải nổi trên danh sách bên dưới.
                KHÔNG dùng Modal lồng cho tooltip — trên iOS mở Modal trong Modal gây treo app. */}
            <View className="px-4 pb-3" style={{ zIndex: 10 }}>
              {/* Lớp mốc KHÔNG padding: neo `right-0` của tooltip trùng đúng mép phải ô tìm
                  kiếm, không phụ thuộc cách Yoga tính inset qua padding của thẻ cha. */}
              <View>
              <View
                className="flex-row items-center rounded-xl px-3"
                style={{ backgroundColor: '#F1F3F5', height: 40 }}>
                <Ionicons name="search" size={16} color="#9CA3AF" />
                <TextInput
                  value={addSearchQuery}
                  onChangeText={onChangeAddSearch}
                  placeholder={t('exchange.info_add_search_placeholder')}
                  placeholderTextColor="#9CA3AF"
                  className="ml-2 flex-1 text-sm text-[#0A2240]"
                  style={{ paddingVertical: 0 }}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {addSearchQuery.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => onChangeAddSearch('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => setScopeHintVisible((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={t('exchange.info_add_scope_hint_aria')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="ml-2">
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={scopeHintVisible ? '#0A2240' : '#9CA3AF'}
                  />
                </TouchableOpacity>
              </View>

              {scopeHintVisible ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setScopeHintVisible(false)}
                  accessibilityRole="button"
                  className="absolute right-0 rounded-xl px-3 py-2"
                  style={{
                    top: 44,
                    maxWidth: 280,
                    backgroundColor: '#0A2240',
                    // Nổi trên danh sách ở cả hai nền (iOS dùng shadow, Android dùng elevation).
                    elevation: 6,
                    shadowColor: '#000',
                    shadowOpacity: 0.18,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 },
                  }}>
                  <Text className="text-xs text-white">{t('exchange.info_add_scope_hint')}</Text>
                </TouchableOpacity>
              ) : null}
              </View>
            </View>

            {/* Người đã chọn ở các lượt tìm trước — giữ hiện để không "thêm nhầm người vô hình". */}
            {selectedTeachers.length ? (
              <View className="flex-row flex-wrap px-4 pb-3" style={{ gap: 6 }}>
                {selectedTeachers.map((tt) => (
                  <TouchableOpacity
                    key={tt.teacherId}
                    onPress={() => toggleSelectAdd(tt)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t('exchange.info_unselect_teacher')}
                    className="max-w-full flex-row items-center rounded-full px-3 py-1.5"
                    style={{ backgroundColor: '#F1F3F5', opacity: busy ? 0.6 : 1 }}>
                    <Text className="text-xs text-[#0A2240]" numberOfLines={1}>
                      {formatChatDisplayName(tt.name) || tt.email}
                    </Text>
                    <Ionicons name="close" size={13} color="#6B7280" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {loadingAddable ? (
              <View className="items-center py-10">
                <ActivityIndicator size="large" color="#FF7A00" />
              </View>
            ) : addable.length === 0 ? (
              <Text className="px-4 py-8 text-center text-sm text-[#9CA3AF]">
                {addSearchQuery.trim()
                  ? t('exchange.info_no_teacher_found')
                  : t('exchange.info_no_addable')}
              </Text>
            ) : (
              <ScrollView className="px-4" style={{ maxHeight: 380 }}>
                {addable.map((tt) => {
                  const selected = selectedAddIds.has(tt.teacherId);
                  const subjects = (tt.subjects || [])
                    .map((s) => s?.title)
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <TouchableOpacity
                      key={tt.teacherId}
                      onPress={() => toggleSelectAdd(tt)}
                      className="flex-row items-center py-2">
                      <Image
                        source={{
                          uri: resolveParticipantAvatarUrl(tt.avatarUrl, tt.email || tt.name || 'gv'),
                        }}
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB' }}
                      />
                      <View className="ml-3 min-w-0 flex-1">
                        <Text className="text-base font-semibold text-[#0A2240]" numberOfLines={1}>
                          {formatChatDisplayName(tt.name) || tt.email}
                        </Text>
                        {subjects ? (
                          <Text className="text-xs text-[#6B7280]" numberOfLines={1}>
                            {subjects}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={selected ? '#0A9488' : '#9CA3AF'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View className="px-4 pt-3">
              <TouchableOpacity
                onPress={confirmAdd}
                disabled={busy || selectedTeachers.length === 0}
                className="items-center rounded-2xl py-3"
                style={{
                  backgroundColor: busy || selectedTeachers.length === 0 ? '#D1D5DB' : '#0A2240',
                }}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    {t('exchange.info_add_count', { n: selectedTeachers.length })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
