/**
 * Xem trước những người sẽ nhận thông báo của vấn đề.
 *
 * Số liệu do server tính bằng ĐÚNG logic gửi thật (`preview_issue_participants`) —
 * tự suy ở client sẽ lệch ngay khi quy tắc đổi. Đồng bộ web `IssueParticipantsPreview`.
 */
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { IssueParticipant } from '../../../types/crmIssue';

type Props = {
  participants: IssueParticipant[];
  loading?: boolean;
};

export const IssueParticipantsPreview: React.FC<Props> = ({ participants, loading }) => {
  const { t } = useTranslation();

  return (
    <View className="mt-3 rounded-xl bg-white p-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-[#002855]">
          {t('crm_issue.participants_title')}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color="#002855" />
        ) : (
          <Text className="text-xs text-gray-500">
            {t('crm_issue.participants_count', { count: participants.length })}
          </Text>
        )}
      </View>

      {!loading && participants.length === 0 ? (
        <Text className="text-xs text-gray-400">{t('crm_issue.participants_empty')}</Text>
      ) : (
        <View className="flex-row flex-wrap gap-1.5">
          {participants.map((p) => (
            <View key={p.user} className="rounded-full bg-[#F1F5F9] px-2.5 py-1">
              <Text className="text-xs text-[#002855]" numberOfLines={1}>
                {p.full_name?.trim() || p.user}
                {p.source_label ? (
                  <Text className="text-gray-500"> · {p.source_label}</Text>
                ) : null}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};
