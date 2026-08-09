/**
 * Danh sách dòng thời gian của tab "Tiến trình" — hai nhánh Trao đổi / Lịch sử
 * và nút đổi thứ tự mới ↔ cũ, bám theo web `IssueProcessingTabV2`.
 */
import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from '../../../components/Common';
import type { CRMIssueLog, CRMIssueLogAccent } from '../../../types/crmIssue';
import {
  ISSUE_COMMENT_KINDS,
  type IssueActivityItem,
  type IssueActivityItemKind,
} from '../shared/issueActivityFeed';

type ActivityTab = 'comments' | 'history';
type FeedSortOrder = 'newest' | 'oldest';

type Props = {
  items: IssueActivityItem[];
  /** Sửa được nhật ký xử lý của người khác (Care Admin) */
  canEditLog?: boolean;
  onEditLog?: (log: CRMIssueLog) => void;
  /** Đang tải hội thoại phụ huynh liên kết */
  loadingLinkedFeedback?: boolean;
};

/** Viền trái theo nguồn của log — giữ đúng bảng màu đang dùng */
function accentColor(kind: IssueActivityItemKind, accent?: CRMIssueLogAccent): string {
  if (kind === 'approved') return '#10B981';
  if (kind === 'rejected') return '#EF4444';
  if (kind === 'parent_reply') return '#6366F1';
  if (kind === 'parent_link_warning') return '#F59E0B';
  if (accent === 'bod') return '#FF4500';
  if (accent === 'sales') return '#002855';
  if (accent === 'dept') return '#0D9488';
  return '#9CA3AF';
}

function fmtDateTime(s?: string): string {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}

export const IssueActivityFeedList: React.FC<Props> = ({
  items,
  canEditLog,
  onEditLog,
  loadingLinkedFeedback,
}) => {
  const { t } = useTranslation();
  const [activity, setActivity] = useState<ActivityTab>('comments');
  const [sortOrder, setSortOrder] = useState<FeedSortOrder>('newest');

  const shown = useMemo(() => {
    const inTab = items.filter((item) =>
      activity === 'comments'
        ? ISSUE_COMMENT_KINDS.includes(item.kind)
        : !ISSUE_COMMENT_KINDS.includes(item.kind)
    );
    return [...inTab].sort((a, b) =>
      sortOrder === 'newest' ? b.sortAt - a.sortAt : a.sortAt - b.sortAt
    );
  }, [items, activity, sortOrder]);

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        {/* Nhánh Trao đổi / Lịch sử */}
        <View className="flex-row rounded-full bg-gray-100 p-0.5">
          {(
            [
              { key: 'comments' as const, label: t('crm_issue.activity_comments') },
              { key: 'history' as const, label: t('crm_issue.activity_history') },
            ]
          ).map((tab) => {
            const active = activity === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActivity(tab.key)}
                className={`rounded-full px-3.5 py-1.5 ${active ? 'bg-white' : ''}`}>
                <Text
                  className={`text-sm ${active ? 'font-semibold text-[#002855]' : 'text-gray-500'}`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => setSortOrder((p) => (p === 'newest' ? 'oldest' : 'newest'))}
          className="flex-row items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5">
          <Ionicons
            name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'}
            size={13}
            color="#6B7280"
          />
          <Text className="text-xs text-gray-600">
            {sortOrder === 'newest' ? t('crm_issue.sort_newest') : t('crm_issue.sort_oldest')}
          </Text>
        </TouchableOpacity>
      </View>

      {activity === 'comments' && loadingLinkedFeedback ? (
        <Text className="mb-3 text-sm text-gray-500">{t('crm_issue.loading_conversation')}</Text>
      ) : null}

      {shown.length === 0 ? (
        <Text className="py-6 text-center text-sm text-gray-400">
          {t('crm_issue.no_activity')}
        </Text>
      ) : (
        shown.map((item) => (
          <View
            key={item.id}
            className="mb-3 rounded-xl bg-white p-4"
            style={{
              borderLeftWidth: 3,
              borderLeftColor: accentColor(item.kind, item.log?.log_accent),
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}>
            <View className="mb-1 flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-base font-semibold text-[#002855]">
                {item.kindLabel}
              </Text>
              {canEditLog && item.kind === 'process_log' && item.log?.name && onEditLog ? (
                <TouchableOpacity
                  onPress={() => onEditLog(item.log as CRMIssueLog)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="p-1">
                  <Ionicons name="pencil" size={18} color="#002855" />
                </TouchableOpacity>
              ) : null}
            </View>

            {item.content ? (
              <Text className="text-sm text-[#757575]">{item.content}</Text>
            ) : null}

            <View className="mt-3 flex-row flex-wrap items-center">
              <Text className="text-xs text-gray-400">{fmtDateTime(item.at)}</Text>
              {item.authorName ? (
                <>
                  <Text className="mx-1 text-xs text-gray-300">·</Text>
                  <Text className="text-xs font-medium text-[#002855]">{item.authorName}</Text>
                </>
              ) : null}
              {item.authorSubtitle ? (
                <Text className="ml-1 text-xs text-gray-500"> ({item.authorSubtitle})</Text>
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
};
