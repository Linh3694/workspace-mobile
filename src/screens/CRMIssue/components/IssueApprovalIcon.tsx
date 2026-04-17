/**
 * Icon trạng thái phê duyệt (thay badge chữ) — vàng chờ / xanh đã duyệt / đỏ từ chối
 */
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CRMIssueApprovalStatus } from '../../../types/crmIssue';
import { CRM_ISSUE_APPROVAL_LABELS } from '../../../types/crmIssue';

type Props = {
  status: string;
  /** Kích thước icon (mặc định 22 — list card) */
  size?: number;
};

export const IssueApprovalIcon: React.FC<Props> = ({ status, size = 22 }) => {
  const s = status as CRMIssueApprovalStatus;
  const label = CRM_ISSUE_APPROVAL_LABELS[s as CRMIssueApprovalStatus] || status;

  const common = {
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: 'image' as const,
  };

  if (s === 'Cho duyet') {
    return (
      <View {...common}>
        <Ionicons name="time-outline" size={size} color="#EAB308" />
      </View>
    );
  }
  if (s === 'Da duyet') {
    return (
      <View {...common}>
        <Ionicons name="checkmark-circle" size={size} color="#22C55E" />
      </View>
    );
  }
  if (s === 'Tu choi') {
    return (
      <View {...common}>
        <Ionicons name="close-circle" size={size} color="#EF4444" />
      </View>
    );
  }
  return null;
};
