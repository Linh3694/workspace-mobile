import React from 'react';
import { View, Text } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import type { CRMIssue } from '../../../types/crmIssue';
import { IssueStatusBadge } from './IssueStatusBadge';
import { IssueApprovalIcon } from './IssueApprovalIcon';
import { getPicDisplayName } from '../../../utils/nameUtils';
import { formatSlaRemainingVi } from '../../../utils/crmIssueSla';

type Props = {
  item: CRMIssue;
  moduleLabel?: string;
  /** Phòng ban liên quan — mỗi phần tử một badge */
  departmentLabels?: string[];
  onPress: () => void;
};

export const IssueCard: React.FC<Props> = ({
  item,
  moduleLabel,
  departmentLabels = [],
  onPress,
}) => {
  // Người tạo: API enrich created_by_name; fallback owner/email giống CRMIssueDetailScreen
  const creatorId = (item.created_by_user || item.owner || '').trim();
  const creatorDisplay =
    getPicDisplayName(item.created_by_name, creatorId || undefined) || creatorId || '';
  // Luôn ghép mã + module (có nhãn hoặc placeholder)
  const codeWithModule = `${item.issue_code} · ${moduleLabel?.trim() || '—'}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="mb-3 rounded-xl bg-[#F8F8F8] p-4">
      {/* 1. Icon phê duyệt sát đầu dòng + tiêu đề (tránh flex-1 đẩy icon ra mép phải) */}
      <View className="flex-row items-start gap-2">
        {item.approval_status ? (
          <View className="shrink-0 pt-0.5">
            <IssueApprovalIcon status={item.approval_status} />
          </View>
        ) : null}
        <Text className="min-w-0 flex-1 text-lg font-medium text-[#E84A37]" numberOfLines={2}>
          {item.title || '—'}
        </Text>
      </View>

      {/* 2. Mã + module — đối diện: người tạo (một hàng) */}
      <View className="mt-3 flex-row items-center justify-between gap-2">
        <Text className="min-w-0 flex-1 text-sm font-medium text-gray-600" numberOfLines={1}>
          {codeWithModule}
        </Text>
        <Text
          className={`max-w-[48%] shrink-0 text-right text-sm font-semibold ${
            creatorDisplay ? 'text-[#002855]' : 'text-gray-400'
          }`}
          numberOfLines={1}>
          {creatorDisplay || '—'}
        </Text>
      </View>

      {/* 3. Phòng ban (wrap trái) + badge trạng thái (phải, cùng hàng) */}
      <View className="mt-3 flex-row items-start gap-2">
        <View className="min-w-0 flex-1 flex-row flex-wrap gap-1.5">
          {departmentLabels.map((label, idx) => (
            <View
              key={`${label}-${idx}`}
              className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5">
              <Text className="text-xs font-medium text-gray-600" numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View className="shrink-0 self-start">
          <IssueStatusBadge kind="status" value={item.status} />
        </View>
      </View>

      {/* 4. Badge SLA — khớp web IssueList */}
      {item.sla_deadline || item.sla_status ? (
        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          {item.sla_status === 'Breached' ? (
            <View className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5">
              <Text className="text-xs font-semibold text-red-800">Quá SLA</Text>
            </View>
          ) : item.sla_status === 'Warning' ? (
            <View className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5">
              <Text className="text-xs font-semibold text-amber-900">Sắp quá SLA</Text>
            </View>
          ) : item.sla_status === 'Passed' ? (
            <View className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5">
              <Text className="text-xs font-semibold text-emerald-800">Đạt SLA</Text>
            </View>
          ) : item.sla_status === 'On track' && item.sla_deadline ? (
            <Text className="text-xs text-gray-600">{formatSlaRemainingVi(item.sla_deadline)}</Text>
          ) : item.sla_deadline ? (
            <Text className="text-xs text-gray-600">{formatSlaRemainingVi(item.sla_deadline)}</Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};
