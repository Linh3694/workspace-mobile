import React from 'react';
import { View, Text } from 'react-native';
import type { CRMIssueLog } from '../../../types/crmIssue';
import { formatIssuePersonDisplayName } from '../../../utils/nameUtils';

type Props = {
  logs: CRMIssueLog[];
};

export const ProcessLogTimeline: React.FC<Props> = ({ logs }) => {
  const sorted = [...(logs || [])].sort(
    (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  );

  if (!sorted.length) {
    return (
      <Text className="px-4 py-6 text-center text-sm text-gray-500">Chưa có log xử lý</Text>
    );
  }

  return (
    <View className="px-4 pb-4">
      {sorted.map((log, idx) => (
        <View key={log.name || `${idx}`} className="mb-4 border-l-2 border-amber-400 pl-3">
          <Text className="text-xs text-gray-500">
            {log.logged_at ? new Date(log.logged_at).toLocaleString('vi-VN') : ''}
            {log.logged_by_name || log.logged_by
              ? ` · ${formatIssuePersonDisplayName({
                  fullName: log.logged_by_name,
                  userId: log.logged_by,
                })}`
              : ''}
          </Text>
          <Text className="mt-1 text-sm font-semibold text-gray-900">{log.title}</Text>
          <Text className="mt-1 text-sm text-gray-700">{log.content}</Text>
        </View>
      ))}
    </View>
  );
};
