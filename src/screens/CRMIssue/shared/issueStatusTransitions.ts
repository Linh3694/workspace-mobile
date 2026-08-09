/**
 * Bước trạng thái hợp lệ cho modal "Cập nhật xử lý".
 *
 * Port từ `frappe-sis-frontend/src/pages/Admission/Issues/shared/issueStatusTransitions.ts`,
 * bám đúng luồng backend `change_issue_status` (`erp/api/crm/issue.py`):
 *   Tiếp nhận → Đang xử lý       (PIC / nhóm Care)
 *   Đang xử lý → Hoàn thành      (PIC hoặc Care Admin; bắt buộc có Kết quả)
 *   Hoàn thành → Đóng            (chỉ Care Admin)
 *   Hoàn thành → Đang xử lý      (chỉ Care Admin — trả về xử lý tiếp)
 *
 * Trước đây mobile luôn hiện cứng 3 lựa chọn nên user chọn bước backend sẽ từ chối.
 */

import type { CRMIssue, CRMIssueStatus } from '../../../types/crmIssue';
import { CRM_ISSUE_STATUS_LABELS } from '../../../types/crmIssue';

export type IssueStatusTransitionContext = {
  /** Nhóm Care/Admin — đổi Trạng thái / Kết quả */
  canEditSalesStatus: boolean;
  /** Care Admin — suy từ cờ `can_edit_process_log` của API (khớp web) */
  isCareAdmin: boolean;
  /** User hiện tại là PIC của vấn đề */
  isPic: boolean;
};

const WORKFLOW_ORDER: CRMIssueStatus[] = ['Tiep nhan', 'Dang xu ly', 'Hoan thanh', 'Dong'];

export function getAllowedStatusTransitions(
  issue: Pick<CRMIssue, 'status' | 'approval_status'>,
  ctx: IssueStatusTransitionContext
): CRMIssueStatus[] {
  if (!ctx.canEditSalesStatus || issue.approval_status !== 'Da duyet') {
    return [issue.status];
  }

  const st = issue.status;
  const set = new Set<CRMIssueStatus>([st]);

  if (st === 'Tiep nhan') {
    set.add('Dang xu ly');
  }
  if (st === 'Dang xu ly' && (ctx.isPic || ctx.isCareAdmin)) {
    set.add('Hoan thanh');
  }
  if (st === 'Hoan thanh' && ctx.isCareAdmin) {
    set.add('Dang xu ly');
    set.add('Dong');
  }

  return WORKFLOW_ORDER.filter((s) => set.has(s));
}

export function statusOptionsForSegment(statuses: CRMIssueStatus[]) {
  return statuses.map((s) => ({
    value: s,
    label: CRM_ISSUE_STATUS_LABELS[s] || s,
  }));
}
