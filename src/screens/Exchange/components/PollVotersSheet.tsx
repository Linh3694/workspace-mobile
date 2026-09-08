/**
 * Bottom sheet danh sách người bầu theo từng phương án + tab "Chưa bình chọn" để GV rà ai cần
 * nhắn nhắc.
 *
 * Với bình chọn ẩn danh, danh tính KHÔNG đi kèm broadcast chung mà tới qua event riêng
 * `chat:message:poll:voters` chỉ phát cho room giáo viên — nên sheet này vừa fetch REST vừa
 * nghe event đó để cập nhật realtime. Danh sách chưa bầu CHỈ server trả cho giáo viên
 * (phụ huynh không có `pending` trong payload) và chỉ có trong REST ⇒ tải lại theo `poll.rev`.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';

import BottomSheetModal from '../../../components/Common/BottomSheetModal';
import { SheetHeader } from '../../../components/Common/SheetHeader';
import { useLanguage } from '../../../hooks/useLanguage';
import { CHAT_EVENTS } from '../../../realtime/chatEvents';
import { chatService } from '../../../services/chatService';
import type { ChatPoll, ChatPollStudentRow, ChatPollVotersData } from '../../../types/chat';
import { makeRelationshipTranslator } from '../../../utils/relationshipLabels';
import { formatChatDisplayName, MY_MESSAGE_BUBBLE_BG } from '../exchangeChatThreadUtils';

const ACCENT = MY_MESSAGE_BUBBLE_BG;
const ACCENT_SOFT = 'rgba(13,148,136,0.08)';

type VotersTab = 'voted' | 'pending' | 'students';

/** Một hàng người trong danh sách (dùng chung cho tab đã bầu và tab chưa bầu). */
function PersonRow({
  name,
  role,
  avatarUrl,
  roleLabel,
  note,
  trailing,
}: {
  name: string;
  role?: string;
  avatarUrl?: string;
  roleLabel: (role?: string) => string;
  /** Chữ phụ ngay sau tên — tab "Học sinh" dùng cho quan hệ PH ("Mẹ"). */
  note?: string;
  /** Thay cho nhãn vai trò ở mép phải — tab "Học sinh" dùng cho phương án đã chọn. */
  trailing?: string;
}) {
  return (
    <View className="flex-row items-center gap-2 py-1.5">
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB' }}
        />
      ) : (
        <View className="h-7 w-7 items-center justify-center rounded-full bg-gray-200">
          <Text className="font-mulish-bold text-[11px] text-gray-600">
            {(name || '?').trim().charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <Text className="flex-1 font-mulish-medium text-sm text-gray-900" numberOfLines={1}>
        {name}
        {note ? <Text className="text-[11px] text-gray-500">{`  ·  ${note}`}</Text> : null}
      </Text>
      <Text className="ml-2 font-mulish-medium text-[11px] text-gray-500">
        {trailing !== undefined ? trailing : roleLabel(role)}
      </Text>
    </View>
  );
}

/**
 * Một học sinh ở tab "Học sinh": bấm để bung danh sách PH và phương án từng người đã chọn.
 *
 * Số bên phải là "PH đã bầu / tổng PH của em đó" chứ không phải số phiếu — một PH chọn nhiều
 * phương án vẫn là một người, giống cách `totalVoters` đếm ở hai tab kia.
 */
function StudentRow({
  row,
  optionText,
  expanded,
  onToggle,
  roleLabel,
  translateRelationship,
  noReplyLabel,
  guardianPendingLabel,
  noGuardianLabel,
}: {
  row: ChatPollStudentRow;
  optionText: (optionId: string) => string;
  expanded: boolean;
  onToggle: () => void;
  roleLabel: (role?: string) => string;
  translateRelationship: (raw: string) => string;
  noReplyLabel: string;
  guardianPendingLabel: string;
  noGuardianLabel: string;
}) {
  const answered = row.voterCount > 0;
  const rowKey = row.studentId || row.studentName;

  return (
    <View className="mb-1">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="flex-row items-center gap-2 py-2"
      >
        <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={14} color="#6B7280" />
        <Text className="flex-1 font-mulish-medium text-sm text-gray-900" numberOfLines={1}>
          {row.studentName}
        </Text>
        <Text className="font-mulish-medium text-[11px] text-gray-500">
          {answered ? `${row.voterCount}/${row.guardianCount}` : noReplyLabel}
        </Text>
      </Pressable>

      {expanded ? (
        <View className="pl-5">
          {row.guardians.length ? (
            row.guardians.map((guardian) => (
              <PersonRow
                key={`${rowKey}-${guardian.email || guardian.userId || guardian.name}`}
                name={formatChatDisplayName(guardian.name)}
                avatarUrl={guardian.avatarUrl}
                roleLabel={roleLabel}
                // Snapshot lưu mã EN ('mother') — in thẳng thì cả 2 ngôn ngữ đều ra "mother".
                note={guardian.relationship ? translateRelationship(guardian.relationship) : undefined}
                trailing={
                  guardian.optionIds.length
                    ? guardian.optionIds.map(optionText).filter(Boolean).join(', ')
                    : guardianPendingLabel
                }
              />
            ))
          ) : (
            <Text className="font-mulish-medium text-[11px] text-gray-400">{noGuardianLabel}</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function PollVotersSheet({
  visible,
  messageId,
  poll,
  onClose,
}: {
  visible: boolean;
  messageId: string;
  poll: ChatPoll;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [data, setData] = useState<ChatPollVotersData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<VotersTab>('voted');
  const [expandedStudents, setExpandedStudents] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setTab('voted');
      setExpandedStudents([]);
    }
  }, [visible, messageId]);

  const load = useCallback(
    (silent: boolean) => {
      if (!messageId) return () => {};
      let cancelled = false;
      if (!silent) setLoading(true);
      setError('');
      chatService
        .getPollVoters(messageId)
        .then((res) => {
          if (!cancelled) setData(res);
        })
        .catch((err) => {
          console.warn('[PollVotersSheet] getPollVoters error:', err);
          if (!cancelled) setError(t('exchange.poll_voters_load_failed'));
        })
        .finally(() => {
          if (!cancelled && !silent) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [messageId, t]
  );

  // Có người vừa bỏ phiếu (rev tăng) ⇒ tải lại để cả hai tab bám theo, vì `pending` chỉ có ở REST.
  useEffect(() => {
    if (!visible) return undefined;
    return load(Boolean(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, messageId, poll.rev]);

  useEffect(() => {
    if (!visible || !messageId) return undefined;
    let detach: (() => void) | undefined;
    let disposed = false;

    void chatService.getSocket().then((socket) => {
      if (!socket || disposed) return;
      const handler = (payload: ChatPollVotersData) => {
        if (String(payload?.messageId) !== String(messageId)) return;
        // Bỏ payload đến trễ (rev không lùi). Event này KHÔNG kèm `pending`/`participantCount`/
        // `students` nên giữ lại giá trị từ lần fetch REST gần nhất thay vì ghi đè bằng undefined
        // — ghi đè thì tab tương ứng biến mất ngay khi có người bỏ phiếu trên poll ẩn danh.
        setData((prev) => {
          if (prev && payload.rev < prev.rev) return prev;
          return {
            ...payload,
            pending: prev?.pending,
            participantCount: prev?.participantCount,
            students: prev?.students,
          };
        });
      };
      socket.on(CHAT_EVENTS.POLL_VOTERS, handler);
      detach = () => socket.off(CHAT_EVENTS.POLL_VOTERS, handler);
    });

    return () => {
      disposed = true;
      detach?.();
    };
  }, [visible, messageId]);

  const votersOf = (optionId: string) =>
    data?.options.find((o) => o.id === optionId)?.voters ?? [];
  /** `pending` chỉ có với giáo viên ⇒ phụ huynh không thấy tab "Chưa bình chọn". */
  const pending = data?.pending ?? null;
  /** `students` cũng chỉ có với giáo viên — server lược y như `pending`. */
  const students = data?.students ?? null;
  const answeredStudents = students?.filter((s) => s.voterCount > 0).length ?? 0;
  const totalVoters = data?.totalVoters ?? poll.totalVoters;
  const roleLabel = (role?: string) =>
    role === 'teacher' ? t('exchange.poll_role_teacher') : t('exchange.poll_role_guardian');
  const translateRelationship = useMemo(() => makeRelationshipTranslator(t), [t]);

  /** Nhãn phương án lấy từ `poll` chứ không từ `data` — `data.options` chỉ có id + voters. */
  const optionText = (optionId: string) => poll.options.find((o) => o.id === optionId)?.text || '';
  const toggleStudent = (key: string) =>
    setExpandedStudents((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={80}>
      <SheetHeader
        icon="people-outline"
        iconColor={ACCENT}
        title={t('exchange.poll_voters_title')}
        subtitle={poll.question}
        closeLabel={t('common.close')}
        onClose={onClose}
      />

      {loading && !data ? (
        <View className="items-center py-10">
          <ActivityIndicator size="small" color={ACCENT} />
        </View>
      ) : error ? (
        <Text className="px-4 py-10 text-center font-mulish-medium text-sm text-gray-500">
          {error}
        </Text>
      ) : (
        <ScrollView className="px-4">
          {pending ? (
            <View className="mb-4 flex-row gap-2">
              {(
                [
                  { key: 'voted' as VotersTab, label: t('exchange.poll_tab_voted', { count: totalVoters }) },
                  {
                    key: 'pending' as VotersTab,
                    label: t('exchange.poll_tab_pending', { count: pending.length }),
                  },
                  // Chỉ hiện khi server có trả `students` — server chưa deploy thì sheet vẫn
                  // chạy đúng 2 tab như cũ thay vì hiện một tab rỗng.
                  ...(students
                    ? [
                      {
                        key: 'students' as VotersTab,
                        label: t('exchange.poll_tab_students', {
                          done: answeredStudents,
                          total: students.length,
                        }),
                      },
                    ]
                    : []),
                ]
              ).map((item) => {
                const active = tab === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setTab(item.key)}
                    style={{
                      borderColor: active ? ACCENT : '#E5E7EB',
                      backgroundColor: active ? ACCENT_SOFT : '#FFFFFF',
                    }}
                    className="flex-1 items-center rounded-xl border py-2"
                  >
                    <Text
                      style={{ color: active ? ACCENT : '#374151' }}
                      className="text-center font-mulish-bold text-[13px]"
                      numberOfLines={2}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {tab === 'students' && students ? (
            students.length ? (
              students.map((row) => {
                const key = row.studentId || row.studentName;
                return (
                  <StudentRow
                    key={key}
                    row={row}
                    optionText={optionText}
                    expanded={expandedStudents.includes(key)}
                    onToggle={() => toggleStudent(key)}
                    roleLabel={roleLabel}
                    translateRelationship={translateRelationship}
                    noReplyLabel={t('exchange.poll_student_no_reply')}
                    guardianPendingLabel={t('exchange.poll_student_guardian_pending')}
                    noGuardianLabel={t('exchange.poll_student_no_guardian')}
                  />
                );
              })
            ) : (
              <Text className="py-8 text-center font-mulish-medium text-sm text-gray-500">
                {t('exchange.poll_no_students')}
              </Text>
            )
          ) : tab === 'pending' && pending ? (
            pending.length ? (
              pending.map((member) => (
                <PersonRow
                  key={member.userId || member.email || member.name}
                  name={formatChatDisplayName(member.name)}
                  role={member.role}
                  avatarUrl={member.avatarUrl}
                  roleLabel={roleLabel}
                />
              ))
            ) : (
              <Text className="py-8 text-center font-mulish-medium text-sm text-gray-500">
                {t('exchange.poll_all_voted')}
              </Text>
            )
          ) : (
            poll.options.map((option) => {
              const voters = votersOf(option.id);
              return (
                <View key={option.id} className="mb-4">
                  <View className="mb-1 flex-row items-center justify-between">
                    <Text className="flex-1 font-mulish-bold text-sm text-gray-900">
                      {option.text}
                    </Text>
                    <Text className="font-mulish-medium text-sm text-gray-500">{voters.length}</Text>
                  </View>
                  {voters.length ? (
                    voters.map((voter) => (
                      <PersonRow
                        key={`${option.id}-${voter.userId || voter.email || voter.name}`}
                        name={formatChatDisplayName(voter.name)}
                        role={voter.role}
                        avatarUrl={voter.avatarUrl}
                        roleLabel={roleLabel}
                      />
                    ))
                  ) : (
                    <Text className="font-mulish-medium text-[11px] text-gray-400">
                      {t('exchange.poll_no_voters')}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </BottomSheetModal>
  );
}

export default PollVotersSheet;
