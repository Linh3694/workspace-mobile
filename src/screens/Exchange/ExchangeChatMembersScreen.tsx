/**
 * Danh sách đầy đủ thành viên hội thoại + tìm kiếm + quản lý (thêm/gỡ GV bộ môn).
 * - GV có quyền chat → bấm PH mở đoạn chat 1-1.
 * - GVCN/Phó CN (viewerIsHomeroom) → thêm GV bộ môn / gỡ GV bộ môn đã thêm (logic giống web).
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
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

import { InfoMemberRow } from './components/InfoMemberRow';
import {
  buildConversationMembers,
  isViewerHomeroom,
  resolveCallerTeacherId,
} from './exchangeInfoUtils';
import { resolveParticipantAvatarUrl } from './lib/chatMemberAvatar';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.EXCHANGE_CHAT_MEMBERS>;

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

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

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addable, setAddable] = useState<AddableTeacher[]>([]);
  const [loadingAddable, setLoadingAddable] = useState(false);
  const [selectedAddIds, setSelectedAddIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const roleLabels = useMemo(
    () => ({
      teacher: t('exchange.info_role_teacher'),
      subjectTeacher: t('exchange.info_role_subject_teacher'),
      parent: t('exchange.info_role_parent'),
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

  const members = useMemo(
    () => buildConversationMembers(conversation, roleLabels),
    [conversation, roleLabels]
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

  const filtered = useMemo(() => {
    const needle = normalizeForSearch(searchQuery);
    if (!needle) return members;
    return members.filter((m) => normalizeForSearch(`${m.name} ${m.role}`).includes(needle));
  }, [members, searchQuery]);

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

  const openAddModal = async () => {
    setAddModalVisible(true);
    setSelectedAddIds(new Set());
    setLoadingAddable(true);
    try {
      const list = await chatService.getAddableTeachers(conversationId);
      setAddable(list || []);
    } catch (e) {
      console.warn('[ExchangeChatMembers] addable failed', e);
      setAddable([]);
    } finally {
      setLoadingAddable(false);
    }
  };

  const toggleSelectAdd = (teacherId: string) => {
    setSelectedAddIds((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) next.delete(teacherId);
      else next.add(teacherId);
      return next;
    });
  };

  /** Thêm tuần tự từng GV (giống web) — lần cuối trả về conversation mới nhất. */
  const confirmAdd = async () => {
    const ids = Array.from(selectedAddIds);
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      let updated: ChatConversation | null = conversation;
      for (const id of ids) {
        updated = await chatService.addConversationTeacher(conversationId, id);
      }
      if (updated) setConversation(updated);
      setSelectedAddIds(new Set());
      setAddModalVisible(false);
    } catch (e) {
      console.warn('[ExchangeChatMembers] add failed', e);
      Alert.alert(t('common.error'), t('exchange.info_add_error'));
    } finally {
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
            onPress={
              item.isGuardian && canOpenOneToOne && item.guardianId
                ? () => openOneToOne(item.guardianId)
                : undefined
            }
            onRemove={
              viewerIsHomeroom && item.removable && item.teacherId
                ? () => confirmRemove(item.teacherId, item.name)
                : undefined
            }
          />
        )}
        ListFooterComponent={
          viewerIsHomeroom ? (
            <Text className="mt-4 px-1 text-xs text-[#9CA3AF]">{t('exchange.info_manage_note')}</Text>
          ) : null
        }
        ListEmptyComponent={
          <Text className="mt-8 text-center text-sm text-[#9CA3AF]">
            {t('exchange.info_members_no_match')}
          </Text>
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

            {loadingAddable ? (
              <View className="items-center py-10">
                <ActivityIndicator size="large" color="#FF7A00" />
              </View>
            ) : addable.length === 0 ? (
              <Text className="px-4 py-8 text-center text-sm text-[#9CA3AF]">
                {t('exchange.info_no_addable')}
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
                      onPress={() => toggleSelectAdd(tt.teacherId)}
                      className="flex-row items-center py-2">
                      <Image
                        source={{
                          uri: resolveParticipantAvatarUrl(tt.avatarUrl, tt.email || tt.name || 'gv'),
                        }}
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB' }}
                      />
                      <View className="ml-3 min-w-0 flex-1">
                        <Text className="text-base font-semibold text-[#0A2240]" numberOfLines={1}>
                          {tt.name || tt.email}
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
                disabled={busy || selectedAddIds.size === 0}
                className="items-center rounded-2xl py-3"
                style={{
                  backgroundColor: busy || selectedAddIds.size === 0 ? '#D1D5DB' : '#0A2240',
                }}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    {t('exchange.info_add_count', { n: selectedAddIds.size })}
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
