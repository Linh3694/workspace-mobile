import React from 'react';
import { View, Text } from 'react-native';
import {
  CRM_ISSUE_APPROVAL_BADGE_STYLES,
  CRM_ISSUE_APPROVAL_LABELS,
  CRM_ISSUE_STATUS_BADGE_STYLES,
  CRM_ISSUE_STATUS_LABELS,
  type CRMIssueApprovalStatus,
  type CRMIssueStatus,
} from '../../../types/crmIssue';

type Props = {
  kind: 'status' | 'approval';
  value: string;
};

const FALLBACK_BADGE = { bg: '#F3F4F6', text: '#6B7280' };

export const IssueStatusBadge: React.FC<Props> = ({ kind, value }) => {
  const pair =
    kind === 'status'
      ? CRM_ISSUE_STATUS_BADGE_STYLES[value as CRMIssueStatus] ?? FALLBACK_BADGE
      : CRM_ISSUE_APPROVAL_BADGE_STYLES[value as CRMIssueApprovalStatus] ?? FALLBACK_BADGE;
  const label =
    kind === 'status'
      ? CRM_ISSUE_STATUS_LABELS[value as CRMIssueStatus] || value
      : CRM_ISSUE_APPROVAL_LABELS[value as CRMIssueApprovalStatus] || value;

  // Trạng thái: nền đặc như Ticket HC; phê duyệt: pill pastel
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: pair.bg,
      }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '500',
          color: pair.text,
          fontFamily: 'Mulish',
        }}>
        {label}
      </Text>
    </View>
  );
};
