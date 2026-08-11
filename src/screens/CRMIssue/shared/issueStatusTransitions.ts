/**
 * Bước trạng thái hợp lệ cho modal "Cập nhật xử lý".
 *
 * Port từ `frappe-sis-frontend/src/pages/Admission/Issues/shared/issueStatusTransitions.ts`,
 * bám đúng luồng backend `change_issue_status` (`erp/api/crm/issue.py`):
 *   Tiếp nhận → Đang xử lý       (PIC / team Care / Sales)
 *   Đang xử lý → Hoàn thành      (CHỈ team Care; bắt buộc có Kết quả)
 *   Hoàn thành → Đang xử lý      (chỉ Care Admin — trả về xử lý tiếp)
 *
 * Bước "Đóng" ĐÃ BỎ: "Hoàn thành" là trạng thái cuối. Giá trị `'Dong'` vẫn còn trong
 * type/nhãn để bản ghi cũ hiển thị đúng, nhưng backend từ chối chuyển tới nó.
 *
 * Quyền đọc TRỰC TIẾP từ cờ `can_*` của API — không suy từ PIC/role ở client nữa, vì
 * "được hoàn thành" giờ là team Care chứ không phải PIC.
 */

import type { CRMIssue, CRMIssueStatus } from '../../../types/crmIssue';
import { CRM_ISSUE_STATUS_LABELS } from '../../../types/crmIssue';

export type IssueStatusTransitionContext = {
  /** Nhóm Care/Admin — đổi Trạng thái / Kết quả */
  canEditSalesStatus: boolean;
  /** API `can_start_processing` — Tiếp nhận → Đang xử lý */
  canStartProcessing: boolean;
  /** API `can_complete_issue` — Đang xử lý → Hoàn thành. Chỉ team Care */
  canCompleteIssue: boolean;
  /** API `can_reopen_issue` — Hoàn thành → Đang xử lý. Chỉ Care Admin */
  canReopenIssue: boolean;
};

const WORKFLOW_ORDER: CRMIssueStatus[] = ['Tiep nhan', 'Dang xu ly', 'Hoan thanh'];

export function getAllowedStatusTransitions(
  issue: Pick<CRMIssue, 'status' | 'approval_status'>,
  ctx: IssueStatusTransitionContext
): CRMIssueStatus[] {
  if (!ctx.canEditSalesStatus || issue.approval_status !== 'Da duyet') {
    return [issue.status];
  }

  const st = issue.status;
  const set = new Set<CRMIssueStatus>([st]);

  if (st === 'Tiep nhan' && ctx.canStartProcessing) {
    set.add('Dang xu ly');
  }
  if (st === 'Dang xu ly' && ctx.canCompleteIssue) {
    set.add('Hoan thanh');
  }
  if (st === 'Hoan thanh' && ctx.canReopenIssue) {
    set.add('Dang xu ly');
  }

  const allowed = WORKFLOW_ORDER.filter((s) => set.has(s));
  // Bản ghi cũ ở `'Dong'` không nằm trong WORKFLOW_ORDER -> filter trả rỗng, picker sẽ trắng.
  // Trả lại chính trạng thái hiện tại để UI vẫn hiển thị được.
  return allowed.length ? allowed : [st];
}

export function statusOptionsForSegment(statuses: CRMIssueStatus[]) {
  return statuses.map((s) => ({
    value: s,
    label: CRM_ISSUE_STATUS_LABELS[s] || s,
  }));
}
