/**
 * Dòng thời gian hợp nhất của chi tiết vấn đề.
 *
 * Gộp duyệt / từ chối / phản hồi phụ huynh / nhật ký xử lý về MỘT danh sách rồi mới chia
 * nhánh hiển thị — trước đây mobile để ba nguồn này ở ba khối rời nên đọc không ra trình tự.
 *
 * Port từ `frappe-sis-frontend/src/pages/Admission/Issues/shared/issueActivityFeed.ts`.
 */

import type { CRMIssue, CRMIssueLog, LinkedFeedbackPayload, LinkedFeedbackReplyRow } from '../../../types/crmIssue';
import { formatIssuePersonDisplayName } from '../../../utils/nameUtils';

export type IssueActivityItemKind =
  | 'rejected'
  | 'approved'
  | 'parent_reply'
  | 'process_log'
  | 'parent_link_warning';

export type IssueActivityItem = {
  id: string;
  kind: IssueActivityItemKind;
  /** Timestamp ms — dùng để sắp xếp */
  sortAt: number;
  kindLabel: string;
  content: string;
  at: string;
  authorName?: string;
  /** Nhãn sau tên: BOD / Phòng TS / tên phòng ban */
  authorSubtitle?: string;
  /** Log gốc — cần khi bấm sửa */
  log?: CRMIssueLog;
};

/** Nhánh "Trao đổi": những gì con người viết ra. Còn lại là "Lịch sử" (mốc hệ thống). */
export const ISSUE_COMMENT_KINDS: IssueActivityItemKind[] = [
  'process_log',
  'parent_reply',
  'parent_link_warning',
];

export type BuildIssueActivityFeedParams = {
  issue: CRMIssue;
  approvedByDisplayName: string;
  rejectedByDisplayName: string;
  parentReplies: LinkedFeedbackReplyRow[];
  linkedFeedbackData: LinkedFeedbackPayload | null;
  /** Vấn đề sinh từ Góp ý của phụ huynh (loại vấn đề mã FB) */
  isParentPortalIssueFlow: boolean;
  /** Nhãn đã dịch — hàm này không gọi i18n để còn test được độc lập */
  labels: {
    rejected: string;
    rejectedNoReason: string;
    approved: string;
    approvedContent: string;
    processLog: string;
    replyFromSchool: string;
    replyFromParent: string;
    parentName: (name: string) => string;
    parentLinkWarning: string;
    parentLinkWarningContent: string;
  };
};

function parseAt(iso?: string | null): number {
  if (!iso?.trim()) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Gộp mọi mốc thành một dòng thời gian, sắp xếp cũ → mới. */
export function buildIssueActivityFeed(params: BuildIssueActivityFeedParams): IssueActivityItem[] {
  const {
    issue,
    approvedByDisplayName,
    rejectedByDisplayName,
    parentReplies,
    linkedFeedbackData,
    isParentPortalIssueFlow,
    labels,
  } = params;

  const items: IssueActivityItem[] = [];

  if (issue.approval_status === 'Tu choi') {
    const at = issue.rejected_at || issue.modified || '';
    const reason = (issue.rejection_reason || '').trim();
    items.push({
      id: 'rejected',
      kind: 'rejected',
      sortAt: parseAt(at),
      kindLabel: labels.rejected,
      content: reason || labels.rejectedNoReason,
      at,
      authorName:
        rejectedByDisplayName !== '—' ? rejectedByDisplayName : issue.rejected_by_user || undefined,
    });
  }

  if (issue.approval_status === 'Da duyet') {
    const at = issue.approved_at || '';
    items.push({
      id: 'approved',
      kind: 'approved',
      // Chưa có mốc duyệt (bản ghi cũ) thì xếp ngay sau lúc tạo
      sortAt: parseAt(at) || parseAt(issue.creation) + 1,
      kindLabel: labels.approved,
      content: labels.approvedContent,
      at: at || issue.creation || '',
      authorName:
        approvedByDisplayName !== '—' ? approvedByDisplayName : issue.approved_by_user || undefined,
    });
  }

  if (isParentPortalIssueFlow && !issue.source_feedback?.trim()) {
    items.push({
      id: 'parent-link-warning',
      kind: 'parent_link_warning',
      sortAt: parseAt(issue.modified),
      kindLabel: labels.parentLinkWarning,
      content: labels.parentLinkWarningContent,
      at: issue.modified || '',
    });
  }

  parentReplies.forEach((reply, index) => {
    const isStaff = reply.reply_by_type === 'Staff';
    const displayName = isStaff
      ? (() => {
          const n = formatIssuePersonDisplayName({
            fullName: reply.reply_by_full_name,
            userId: reply.reply_by,
          });
          return n !== '—' ? n : reply.reply_by || '—';
        })()
      : labels.parentName(linkedFeedbackData?.guardian_info?.name || '—');

    items.push({
      id: `parent-${index}-${reply.reply_date}`,
      kind: 'parent_reply',
      sortAt: parseAt(reply.reply_date),
      kindLabel: isStaff ? labels.replyFromSchool : labels.replyFromParent,
      content: reply.content || '',
      at: reply.reply_date,
      authorName: displayName,
    });
  });

  (issue.process_logs || []).forEach((log) => {
    const author =
      log.logged_by || log.logged_by_name
        ? formatIssuePersonDisplayName({ fullName: log.logged_by_name, userId: log.logged_by })
        : '';
    const src = (log.log_source_label || '').trim();
    items.push({
      id: log.name || `log-${log.logged_at}`,
      kind: 'process_log',
      sortAt: parseAt(log.logged_at),
      kindLabel: log.title?.trim() || labels.processLog,
      content: log.content || '',
      at: log.logged_at,
      authorName: author !== '—' ? author : undefined,
      authorSubtitle: src || undefined,
      log,
    });
  });

  return items.sort((a, b) => a.sortAt - b.sortAt);
}
