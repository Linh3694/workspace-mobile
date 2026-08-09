/**
 * Chi tiết vấn đề CRM — redesign theo pattern Ticket/Feedback mobile + web IssueDetail
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  Alert,
  Image,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity, ActionSheet } from '../../components/Common';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons, AntDesign, FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import {
  canChangeIssuePic,
  canWriteCrmIssue,
  canEditSalesStatusResult,
  getIssueDepartmentDocnames,
} from '../../utils/crmIssuePermissions';
import { BASE_URL } from '../../config/constants';
import {
  getIssue,
  approveIssue,
  rejectIssue,
  changeIssueStatus,
  addProcessLog,
  updateProcessLog,
  collectDepartmentMemberEmailsForIssue,
  updateIssue,
  getDepartment,
  getModule,
  getLinkedFeedbackReplies,
  addStaffReplyToFeedback,
  setIssueRelatedUsers,
} from '../../services/crmIssueService';
import type {
  CRMIssue,
  CRMIssueDeptMember,
  CRMIssueResult,
  CRMIssueStatus,
  LinkedFeedbackPayload,
} from '../../types/crmIssue';
import {
  CRM_ISSUE_RESULT_CHIP_STYLES,
  CRM_ISSUE_RESULT_NONE_CHIP_STYLE,
  labelForCrmIssuePriority,
  labelForCrmIssueResult,
} from '../../types/crmIssue';
import { getAllowedStatusTransitions } from './shared/issueStatusTransitions';
import { IssueStatusBadge } from './components/IssueStatusBadge';
import { IssueApprovalIcon } from './components/IssueApprovalIcon';
import { ApproveIssueSheet, type ApprovePayload } from './components/ApproveIssueSheet';
import { ChangePicSheet } from './components/ChangePicSheet';
import { MultiPickerSheet } from './components/MultiPickerSheet';
import { IssueActivityFeedList } from './detail/IssueActivityFeedList';
import { buildIssueActivityFeed } from './shared/issueActivityFeed';
import { searchUsersForPicker } from '../../services/userDirectoryService';
import { getIssueUnitOptions, type IssueUnitOption } from '../../services/organizationService';
import { RejectModal } from './components/RejectModal';
import { StatusChangeModal } from './components/StatusChangeModal';
import { ProcessLogModal } from './components/ProcessLogModal';
import { FeedbackReplyModal } from './components/FeedbackReplyModal';

import { formatIssuePersonDisplayName } from '../../utils/nameUtils';
import { splitIssueContentAndFeedbackFiles } from '../../utils/crmIssueContent';
import { formatSlaOverdueVi, formatSlaRemainingVi } from '../../utils/crmIssueSla';

type Nav = NativeStackNavigationProp<RootStackParamList, typeof ROUTES.SCREENS.CRM_ISSUE_DETAIL>;
type R = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.CRM_ISSUE_DETAIL>;

function fmtDate(s?: string) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return s;
  }
}

function fmtDateTime(s?: string) {
  if (!s) return '—';
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

/** Một dòng hiển thị: Tên (Lớp); không có lớp thì chỉ tên */
function formatStudentLine(displayName: string, classTitle?: string | null): string {
  const n = (displayName || '').trim();
  const c = (classTitle || '').trim();
  if (!n) return '';
  return c ? `${n} (${c})` : n;
}

/** Strip HTML tags → plain text */
function stripHtml(html?: string): string {
  if (!html?.trim()) return '';
  let text = html;
  text = text.replace(/<li>/gi, '• ').replace(/<\/li>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>\s*<p>/gi, '\n');
  text = text.replace(/<\/?(?:p|ul|ol|div|span|strong|em|b|i|h[1-6])[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

const CRMIssueDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { issueId } = route.params;
  const { user } = useAuth();
  const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
  /** Định danh Frappe — ưu tiên email, fallback name (khớp web IssueList) */
  const sessionUserId = useMemo(
    () => (user?.email || (user as { name?: string } | undefined)?.name || '').trim(),
    [user?.email, user],
  );
  useEffect(() => {
    if (!sessionUserId && user) {
      // eslint-disable-next-line no-console
      console.warn('[CRMIssue] User thiếu email/name — phân quyền phòng ban có thể sai');
    }
  }, [sessionUserId, user]);

  const [issue, setIssue] = useState<CRMIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [moduleName, setModuleName] = useState('');
  /** Mã loại vấn đề (CRM Issue Module.code) — FB = tạo từ Góp ý / Feedback phụ huynh */
  const [moduleCode, setModuleCode] = useState('');
  const [deptName, setDeptName] = useState('');
  /** Thành viên phòng ban (user + full_name từ API get_department) */
  const [deptMemberRows, setDeptMemberRows] = useState<CRMIssueDeptMember[]>([]);

  const [showApprove, setShowApprove] = useState(false);
  const [showRelatedUsers, setShowRelatedUsers] = useState(false);
  /** Bản nháp danh sách Người liên quan — chỉ ghi lên server khi đóng sheet */
  const [relatedUserDraft, setRelatedUserDraft] = useState<string[]>([]);
  const [relatedUserLabels, setRelatedUserLabels] = useState<Record<string, string>>({});
  const [showReject, setShowReject] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showDeptSheet, setShowDeptSheet] = useState(false);
  
  /** Đơn vị Sơ đồ tổ chức cho sheet đổi phòng ban + bản nháp lựa chọn */
  const [unitOptions, setUnitOptions] = useState<IssueUnitOption[]>([]);
  const [deptDraft, setDeptDraft] = useState<string[]>([]);
  /** Hai tab như web IssueDetailV2: Yêu cầu (nội dung + phân công) / Tiến trình (dòng thời gian) */
  const [activeTab, setActiveTab] = useState<'request' | 'processing'>('request');
  const [showChangePic, setShowChangePic] = useState(false);
  /** Menu FAB: thêm log vs phản hồi phụ huynh (khi có source_feedback) */
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showReplyFeedback, setShowReplyFeedback] = useState(false);
  const [linkedFeedbackData, setLinkedFeedbackData] = useState<LinkedFeedbackPayload | null>(null);
  const [loadingLinkedFeedback, setLoadingLinkedFeedback] = useState(false);
  /** Email thành viên các phòng ban issue — canWriteCrmIssue */
  const [deptMemberEmails, setDeptMemberEmails] = useState<string[]>([]);
  const [editLogName, setEditLogName] = useState<string | null>(null);
  const [initialLogTitle, setInitialLogTitle] = useState('');
  const [initialLogContent, setInitialLogContent] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await getIssue(issueId);
        if (res.success && res.data) {
          setIssue(res.data);
          const doc = res.data;
          const emails = await collectDepartmentMemberEmailsForIssue(doc);
          setDeptMemberEmails(emails);

          const mod = doc.issue_module
            ? await getModule(doc.issue_module)
            : ({ success: false } as any);
          if (mod.success && mod.data) {
            setModuleName(mod.data.module_name);
            setModuleCode(mod.data.code || '');
          } else {
            setModuleName('');
            setModuleCode('');
          }

          // Gộp phòng ban + thành viên (đa phòng ban) — khớp web.
          // Các đơn vị độc lập nhau nên gọi song song; thứ tự nhãn giữ theo issue.
          const deptIds = getIssueDepartmentDocnames(doc);
          const deps = await Promise.all(deptIds.map((did) => getDepartment(did)));
          const deptLabels: string[] = [];
          const seenUsers = new Set<string>();
          const mergedRows: CRMIssueDeptMember[] = [];
          deps.forEach((dep, idx) => {
            if (!dep.success || !dep.data) return;
            deptLabels.push(dep.data.department_name || deptIds[idx]);
            for (const m of dep.data.members || []) {
              const u = (m.user || '').trim();
              if (u && !seenUsers.has(u)) {
                seenUsers.add(u);
                mergedRows.push({ user: u, full_name: m.full_name });
              }
            }
          });
          setDeptName(deptLabels.join(', '));
          setDeptMemberRows(mergedRows);

          // Lịch sử trao đổi phụ huynh (Feedback liên kết)
          if (doc.source_feedback) {
            setLoadingLinkedFeedback(true);
            try {
              const lr = await getLinkedFeedbackReplies(doc.name);
              if (lr.success && lr.data) {
                setLinkedFeedbackData(lr.data);
              } else {
                setLinkedFeedbackData(null);
              }
            } finally {
              setLoadingLinkedFeedback(false);
            }
          } else {
            setLinkedFeedbackData(null);
          }
        } else {
          setIssue(null);
          setModuleName('');
          setModuleCode('');
          setDeptName('');
          setDeptMemberRows([]);
          setDeptMemberEmails([]);
          setLinkedFeedbackData(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [issueId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Ưu tiên cờ can_* từ get_issue (session Frappe) */
  const canWriteIssue = useMemo(() => {
    if (!issue) return false;
    if (issue.can_write_issue === true || issue.can_write_issue === false) {
      return issue.can_write_issue;
    }
    return sessionUserId ? canWriteCrmIssue(sessionUserId, deptMemberEmails, roles) : false;
  }, [issue, sessionUserId, deptMemberEmails, roles]);

  const canEdit = canWriteIssue;

  const showDeptPickerButton = useMemo(() => {
    if (!issue) return false;
    if (issue.can_change_department === true || issue.can_change_department === false) {
      return issue.can_change_department;
    }
    return (
      !!sessionUserId &&
      issue.approval_status === 'Da duyet' &&
      canWriteCrmIssue(sessionUserId, deptMemberEmails, roles)
    );
  }, [issue, sessionUserId, deptMemberEmails, roles]);

  const showStatusResultButton = useMemo(() => {
    if (!issue) return false;
    if (issue.can_edit_sales_status === true || issue.can_edit_sales_status === false) {
      return issue.can_edit_sales_status;
    }
    return issue.approval_status === 'Da duyet' && canEditSalesStatusResult(roles);
  }, [issue, roles]);

  /**
   * Bước trạng thái backend sẽ chấp nhận — khớp web.
   * `isCareAdmin` suy từ cờ `can_edit_process_log` (chỉ Care Admin sửa được log của người khác),
   * đúng cách web `IssueDetailV2` đang làm.
   */
  const allowedStatuses = useMemo(() => {
    if (!issue) return [] as CRMIssueStatus[];
    return getAllowedStatusTransitions(issue, {
      canEditSalesStatus: showStatusResultButton,
      isCareAdmin: issue.can_edit_process_log === true,
      isPic: !!sessionUserId && (issue.pic || '').trim() === sessionUserId,
    });
  }, [issue, showStatusResultButton, sessionUserId]);

  const canAddLog = useMemo(() => {
    if (!issue) return false;
    if (issue.can_add_process_log === true || issue.can_add_process_log === false) {
      return issue.can_add_process_log;
    }
    return (
      canWriteIssue &&
      issue.approval_status === 'Da duyet' &&
      issue.status === 'Dang xu ly'
    );
  }, [issue, canWriteIssue]);

  const canReplyParent = useMemo(() => {
    if (!issue) return false;
    if (issue.can_reply_parent === true || issue.can_reply_parent === false) {
      return issue.can_reply_parent;
    }
    // Khớp web: chỉ role Sales; backend đã kiểm source_feedback trong _finalize_issue_api_dict
    return canEditSalesStatusResult(roles);
  }, [issue, roles]);

  const isPendingApproval = issue?.approval_status === 'Cho duyet';
  /** Chi tin can_approve_reject tu get_issue — khong fallback JWT (tranh nut hien nhung server tu choi) */
  const canApproveReject = useMemo(() => {
    if (!issue) return false;
    if (issue.can_approve_reject === true || issue.can_approve_reject === false) {
      return issue.can_approve_reject;
    }
    return false;
  }, [issue]);

  // --- Actions ---
  /**
   * Duyệt vấn đề. Phòng ban + Nhóm vấn đề do người duyệt chốt trong sheet — backend
   * `approve_issue` bắt buộc cả hai, duyệt thẳng bằng giá trị cũ sẽ bị từ chối.
   */
  const onApproveConfirm = async (payload: ApprovePayload) => {
    if (!issue) return;
    setActionLoading(true);
    try {
      const res = await approveIssue(issue.name, payload);
      if (res.success) {
        setShowApprove(false);
        Alert.alert(t('common.success'), t('crm_issue.approve_success'));
        await load();
      } else Alert.alert(t('common.error'), res.message || '');
    } finally {
      setActionLoading(false);
    }
  };

  const onReject = async (reason: string) => {
    if (!issue) return;
    setActionLoading(true);
    try {
      const res = await rejectIssue(issue.name, reason);
      setShowReject(false);
      if (res.success) {
        Alert.alert(t('common.success'), t('crm_issue.reject_success'));
        await load();
      } else Alert.alert(t('common.error'), res.message || '');
    } finally {
      setActionLoading(false);
    }
  };

  const onStatusConfirm = async (
    status: CRMIssueStatus,
    result?: CRMIssueResult | '',
    note?: string,
  ) => {
    if (!issue) return;
    setActionLoading(true);
    try {
      const res = await changeIssueStatus(issue.name, status, result, note);
      setShowStatus(false);
      if (res.success) {
        Alert.alert(t('common.success'), res.message || '');
        await load();
      } else Alert.alert(t('common.error'), res.message || '');
    } finally {
      setActionLoading(false);
    }
  };

  const onLogConfirm = async (content: string) => {
    if (!issue) return;
    setActionLoading(true);
    try {
      const res = editLogName
        ? await updateProcessLog({
            issue_name: issue.name,
            log_name: editLogName,
            content,
          })
        : await addProcessLog({ issue_name: issue.name, content });
      setShowLog(false);
      setEditLogName(null);
      setInitialLogTitle('');
      setInitialLogContent('');
      if (res.success) await load();
      else Alert.alert(t('common.error'), res.message || '');
    } finally {
      setActionLoading(false);
    }
  };

  /** Phản hồi phụ huynh qua Feedback (erp_sis.feedback.add_reply) */
  const onReplyParentConfirm = async (content: string) => {
    if (!issue?.source_feedback) return;
    setActionLoading(true);
    try {
      const res = await addStaffReplyToFeedback(issue.source_feedback, content);
      if (res.success) {
        setShowReplyFeedback(false);
        await load();
      } else {
        Alert.alert(t('common.error'), res.message || '');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openDeptSheet = useCallback(async () => {
    // Nạp bản nháp từ phòng ban hiện tại rồi mới mở sheet
    setDeptDraft(issue ? getIssueDepartmentDocnames(issue) : []);
    setShowDeptSheet(true);
    const res = await getIssueUnitOptions();
    setUnitOptions(res.success ? res.data : []);
  }, [issue]);

  /**
   * Lưu TOÀN BỘ danh sách phòng ban.
   * Trước đây sheet này chọn một phòng rồi gửi `departments: [tên]` — vấn đề đang gắn
   * nhiều phòng sẽ bị ghi đè mất, nên đổi sang chọn nhiều như web.
   */
  const saveDepartments = async (nextIds: string[]) => {
    if (!issue) return;
    setActionLoading(true);
    try {
      const res = await updateIssue({
        name: issue.name,
        department: nextIds[0] || undefined,
        departments: nextIds,
      });
      if (res.success) await load();
      else Alert.alert(t('common.error'), res.message || '');
    } finally {
      setActionLoading(false);
    }
  };



  /** Cập nhật nhóm Người liên quan chọn tay (ghi đè toàn bộ danh sách) */
  const saveRelatedUsers = useCallback(
    async (users: string[]) => {
      if (!issue) return;
      setActionLoading(true);
      try {
        const res = await setIssueRelatedUsers(issue.name, users);
        if (res.success) await load();
        else Alert.alert(t('common.error'), res.message || '');
      } finally {
        setActionLoading(false);
      }
    },
    [issue, load, t],
  );

  const onChangePicConfirm = async (nextPic: string) => {
    if (!issue) return;
    setActionLoading(true);
    try {
      const res = await updateIssue({ name: issue.name, pic: nextPic });
      if (res.success) {
        setShowChangePic(false);
        await load();
      } else Alert.alert(t('common.error'), res.message || '');
    } finally {
      setActionLoading(false);
    }
  };

  const departmentPickerOptions = useMemo(
    () =>
      unitOptions
        .filter((u) => u.is_department)
        .map((u) => ({ value: u.name, label: u.department_name })),
    [unitOptions],
  );

  // --- Attachment URL ---
  const attachmentUrl = useMemo(() => {
    if (!issue?.attachment) return '';
    const a = issue.attachment;
    return a.startsWith('http') ? a : `${BASE_URL}${a.startsWith('/') ? '' : '/'}${a}`;
  }, [issue?.attachment]);

  const isImage = useMemo(() => {
    if (!issue?.attachment) return false;
    const ext = issue.attachment.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  }, [issue?.attachment]);

  /** Mỗi học sinh một dòng Tên (Lớp) — API get_issue enrich student_display_name / student_class_title */
  const relatedStudentLines = useMemo(() => {
    if (!issue) return [] as string[];
    const lines: string[] = [];
    for (const r of issue.issue_students || []) {
      const name = r.student_display_name || r.student || '';
      const line = formatStudentLine(name, r.student_class_title);
      if (line) lines.push(line);
    }
    if (lines.length === 0 && issue.student) {
      const line = formatStudentLine(
        issue.student_display_name || issue.student,
        issue.student_class_title,
      );
      if (line) lines.push(line);
    }
    return lines;
  }, [issue]);

  const contentSplit = useMemo(
    () => splitIssueContentAndFeedbackFiles(issue?.content || ''),
    [issue?.content]
  );

  const createdByDisplay = useMemo(() => {
    if (!issue) return '—';
    const creatorId = (issue.created_by_user || issue.owner || '').trim();
    const formatted = formatIssuePersonDisplayName({
      fullName: issue.created_by_name,
      userId: creatorId || undefined,
    });
    const base = formatted !== '—' ? formatted : creatorId || '—';
    // Module code FB: vấn đề sinh từ Góp ý phụ huynh (parent_portal feedback → CRM Issue)
    if (moduleCode === 'FB') return `${base}${t('crm_issue.created_by_parent_suffix')}`;
    return base;
  }, [issue, moduleCode, t]);

  /** Nhóm liên quan — nhãn đơn vị, fallback docname khi API chưa enrich */
  const relatedGroupLabels = useMemo(
    () =>
      (issue?.issue_related_groups ?? [])
        .map((r) => (r.unit_title || r.unit || '').trim())
        .filter(Boolean),
    [issue?.issue_related_groups],
  );

  /** Chỉ người được CHỌN TAY mới sửa ở đây; người do đơn vị kéo vào bỏ bằng cách bỏ đơn vị */
  const manualRelatedUsers = useMemo(
    () => (issue?.related_users ?? []).filter((r) => r.source !== 'auto'),
    [issue?.related_users],
  );

  const canEditRelatedUsers = issue?.can_edit_related_users === true;

  const canChangePic = useMemo(() => {
    if (!issue) return false;
    if (issue.can_change_pic === true || issue.can_change_pic === false) return issue.can_change_pic;
    return canChangeIssuePic(roles);
  }, [issue, roles]);

  /** Banner Đã duyệt / Đã từ chối — khớp web IssueDetail */
  const approvedByDisplayName = useMemo(
    () =>
      issue
        ? formatIssuePersonDisplayName({
            fullName: issue.approved_by_name,
            userId: issue.approved_by_user,
          })
        : '—',
    [issue?.approved_by_name, issue?.approved_by_user, issue],
  );

  const rejectedByDisplayName = useMemo(
    () =>
      issue
        ? formatIssuePersonDisplayName({
            fullName: issue.rejected_by_name,
            userId: issue.rejected_by_user,
          })
        : '—',
    [issue?.rejected_by_name, issue?.rejected_by_user, issue],
  );

  /** Dòng thời gian hợp nhất cho tab Tiến trình */
  const activityFeed = useMemo(() => {
    if (!issue) return [];
    return buildIssueActivityFeed({
      issue,
      approvedByDisplayName,
      rejectedByDisplayName,
      parentReplies: linkedFeedbackData?.replies ?? [],
      linkedFeedbackData,
      isParentPortalIssueFlow: moduleCode === 'FB',
      labels: {
        rejected: t('crm_issue.feed_rejected'),
        rejectedNoReason: t('crm_issue.feed_rejected_no_reason'),
        approved: t('crm_issue.feed_approved'),
        approvedContent: t('crm_issue.feed_approved_content'),
        processLog: t('crm_issue.feed_process_log'),
        replyFromSchool: t('crm_issue.feed_reply_school'),
        replyFromParent: t('crm_issue.feed_reply_parent'),
        parentName: (name: string) => t('crm_issue.feed_parent_name', { name }),
        parentLinkWarning: t('crm_issue.feed_parent_link_warning'),
        parentLinkWarningContent: t('crm_issue.feed_parent_link_warning_content'),
      },
    });
  }, [issue, approvedByDisplayName, rejectedByDisplayName, linkedFeedbackData, moduleCode, t]);

  // --- Loading state ---
  if (loading && !issue) {
    return (
      <SafeAreaView
        className="flex-1 bg-white"
        style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F05023" />
        </View>
      </SafeAreaView>
    );
  }

  // --- Error / not found ---
  if (!issue) {
    return (
      <SafeAreaView
        className="flex-1 bg-white"
        style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-gray-500">{t('crm_issue.not_found')}</Text>
          <TouchableOpacity
            onPress={() => load()}
            className="mt-4 rounded-lg bg-blue-500 px-4 py-2">
            <Text className="font-medium text-white">{t('common.retry') || 'Thử lại'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Render ---
  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
      {/* ====== HEADER ====== */}
      <View className="bg-white">
        {/* Top bar: mã + nút đóng */}
        <View className="w-full flex-row items-start justify-between px-4 py-4">
          <View className="min-w-0 flex-1 pr-2">
            <Text className="text-lg font-medium text-black">{issue.issue_code}</Text>
          </View>
          <View className="flex-shrink-0 flex-row items-center gap-3">
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <AntDesign name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tiêu đề — icon phê duyệt + tiêu đề */}
        <View className="mb-4 flex-row items-start gap-2 px-4">
          <View className="shrink-0 pt-1">
            <IssueApprovalIcon status={issue.approval_status || 'Cho duyet'} size={24} />
          </View>
          <Text className="min-w-0 flex-1 text-xl font-medium text-[#E84A37]">{issue.title}</Text>
        </View>

        {/* Thông tin duyệt / từ chối — khớp web IssueDetail */}
        {issue.approval_status === 'Da duyet' &&
          (issue.approved_at || issue.approved_by_user || issue.approved_by_name) && (
            <View className="mx-4 mb-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
              <Text className="text-sm text-emerald-950">
                <Text className="font-semibold">{t('crm_issue.banner_approved')}</Text>
                {issue.approved_by_name || issue.approved_by_user ? (
                  <Text className="text-emerald-900">
                    {' '}
                    — {t('crm_issue.banner_by')}{' '}
                    <Text className="font-semibold">{approvedByDisplayName}</Text>
                  </Text>
                ) : null}
                {issue.approved_at ? (
                  <Text className="text-emerald-900">
                    {' '}
                    {t('crm_issue.banner_at')} {fmtDateTime(issue.approved_at)}
                  </Text>
                ) : null}
              </Text>
            </View>
          )}
        {issue.approval_status === 'Tu choi' &&
          (issue.rejected_at || issue.rejected_by_user || issue.rejected_by_name) && (
            <View className="mx-4 mb-3 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2.5">
              <Text className="text-sm text-red-950">
                <Text className="font-semibold">{t('crm_issue.banner_rejected')}</Text>
                {issue.rejected_by_name || issue.rejected_by_user ? (
                  <Text className="text-red-900">
                    {' '}
                    — {t('crm_issue.banner_by')}{' '}
                    <Text className="font-semibold">{rejectedByDisplayName}</Text>
                  </Text>
                ) : null}
                {issue.rejected_at ? (
                  <Text className="text-red-900">
                    {' '}
                    {t('crm_issue.banner_at')} {fmtDateTime(issue.rejected_at)}
                  </Text>
                ) : null}
              </Text>
            </View>
          )}

        {/* Cảnh báo SLA — khớp web IssueDetail */}
        {issue.approval_status === 'Da duyet' && issue.sla_status === 'Warning' && issue.sla_deadline ? (
          <View className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <Text className="text-sm text-amber-950">
              Sắp quá SLA — còn {formatSlaRemainingVi(issue.sla_deadline)} trước {fmtDateTime(issue.sla_deadline)}
            </Text>
          </View>
        ) : null}
        {issue.approval_status === 'Da duyet' && issue.sla_status === 'Breached' && issue.sla_deadline ? (
          <View className="mx-4 mb-3 flex-row items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
            <Ionicons name="warning" size={18} color="#B91C1C" style={{ marginTop: 2 }} />
            <Text className="flex-1 text-sm text-red-950">
              Quá SLA — đã trễ {formatSlaOverdueVi(issue.sla_deadline)}. Cần xử lý ngay.
            </Text>
          </View>
        ) : null}
        {issue.approval_status === 'Da duyet' && issue.sla_status === 'Passed' ? (
          <View className="mx-4 mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <Text className="text-sm font-medium text-emerald-900">Đạt SLA</Text>
          </View>
        ) : null}

        {/* Nút hành động */}
        <View className="mb-6 flex-row flex-wrap items-center gap-3 px-4">
          {canApproveReject && isPendingApproval && (
            <TouchableOpacity
              onPress={() => setShowApprove(true)}
              disabled={actionLoading}
              className="h-10 w-10 items-center justify-center rounded-full bg-[#E8F5E9]">
              {actionLoading ? (
                <ActivityIndicator size="small" color="#2E7D32" />
              ) : (
                <Ionicons name="checkmark" size={22} color="#2E7D32" />
              )}
            </TouchableOpacity>
          )}

          {canApproveReject && isPendingApproval && (
            <TouchableOpacity
              onPress={() => setShowReject(true)}
              disabled={actionLoading}
              className="h-10 w-10 items-center justify-center rounded-full bg-[#FFEBEE]">
              <Ionicons name="close" size={20} color="#C62828" />
            </TouchableOpacity>
          )}

          {showDeptPickerButton && (
            <TouchableOpacity
              onPress={openDeptSheet}
              disabled={actionLoading}
              className="h-10 w-10 items-center justify-center rounded-full bg-[#F3E5F5]">
              <Ionicons name="people" size={18} color="#7B1FA2" />
            </TouchableOpacity>
          )}

          {showStatusResultButton && (
            <TouchableOpacity
              onPress={() => setShowStatus(true)}
              disabled={actionLoading}
              className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF3E0]">
              <FontAwesome5 name="sync-alt" size={14} color="#E65100" />
            </TouchableOpacity>
          )}

          {canEdit && (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate(ROUTES.SCREENS.CRM_ISSUE_EDIT, { issueId: issue.name })
              }
              disabled={actionLoading}
              className="h-10 w-10 items-center justify-center rounded-full bg-[#E8EDF2]">
              <Ionicons name="pencil" size={18} color="#002855" />
            </TouchableOpacity>
          )}
        </View>

        {/* Lý do từ chối */}
        {issue.rejection_reason ? (
          <View className="mx-4 mb-4 rounded-xl bg-red-50 p-3">
            <Text className="text-sm font-medium text-red-600">
              {t('crm_issue.rejection_reason')}: {issue.rejection_reason}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ====== TAB NAVIGATION ====== */}
      <View className="flex-row border-b border-gray-200 pl-5">
        {[
          { key: 'request' as const, label: t('crm_issue.tab_request') },
          { key: 'processing' as const, label: t('crm_issue.tab_processing') },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`mr-6 py-3 ${activeTab === tab.key ? 'border-b-2 border-[#002855]' : ''}`}>
            <Text
              className={activeTab === tab.key ? 'font-bold' : 'font-medium'}
              style={{ color: activeTab === tab.key ? '#002855' : '#98A2B3' }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ====== TAB CONTENT ====== */}
      <View className="flex-1">
        {activeTab === 'request' ? (
          <ScrollView
            className="flex-1 bg-white p-4"
            contentContainerStyle={{ paddingBottom: 32 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                colors={['#F05023']}
                tintColor="#F05023"
              />
            }>
            {/* --- Thông tin chung --- */}
            <View className="mb-4 rounded-2xl bg-[#F8F8F8] p-4">
              <Text className="mb-3 text-lg font-semibold text-[#002855]">
                {t('crm_issue.general_info')}
              </Text>
              <InfoRow label={t('crm_issue.issue_code')} value={issue.issue_code} />
              <InfoRow label={t('crm_issue.module')} value={moduleName || issue.issue_module} />
              <InfoRow
                label={t('crm_issue.school_year')}
                value={issue.school_year_title || issue.school_year_id || '—'}
              />
              <InfoRow label={t('crm_issue.issue_group')} value={issue.issue_group || '—'} />
              <InfoRow label={t('crm_issue.received_date')} value={fmtDate(issue.occurred_at)} />
              <InfoRow
                label={t('crm_issue.created_by')}
                value={issue.created_by_title ? `${createdByDisplay}\n${issue.created_by_title}` : createdByDisplay}
              />
              <View className="mb-3 flex-row items-start justify-between">
                <Text className="max-w-[38%] flex-shrink-0 pr-2 text-base font-semibold text-[#757575]">
                  {t('crm_issue.students')}
                </Text>
                <View className="min-w-0 max-w-[62%]">
                  {relatedStudentLines.length > 0 ? (
                    relatedStudentLines.map((line, idx) => (
                      <Text
                        key={`st-${idx}`}
                        className={`text-right text-base font-medium text-[#002855] ${idx > 0 ? 'mt-1' : ''}`}>
                        {line}
                      </Text>
                    ))
                  ) : (
                    <Text className="text-right text-base font-medium text-[#98A2B3]">—</Text>
                  )}
                </View>
              </View>
            </View>

            {/* --- Trạng thái --- */}
            <View className="mb-4 rounded-2xl bg-[#F8F8F8] p-4">
              <Text className="mb-3 text-lg font-semibold text-[#002855]">
                {t('crm_issue.section_status')}
              </Text>
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-base font-semibold text-[#757575]">
                  {t('crm_issue.status')}
                </Text>
                <IssueStatusBadge kind="status" value={issue.status} />
              </View>
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-base font-semibold text-[#757575]">
                  {t('crm_issue.result')}
                </Text>
                {(() => {
                  const raw = issue.result;
                  const hasValue = raw != null && String(raw).trim() !== '';
                  const mapped =
                    hasValue && raw
                      ? CRM_ISSUE_RESULT_CHIP_STYLES[
                          raw as keyof typeof CRM_ISSUE_RESULT_CHIP_STYLES
                        ]
                      : undefined;
                  const style = mapped ?? CRM_ISSUE_RESULT_NONE_CHIP_STYLE;
                  return (
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: style.bg,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                      }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '500',
                          color: style.text,
                          fontFamily: 'Mulish',
                        }}>
                        {labelForCrmIssueResult(raw, t('crm_issue.result_none'))}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <InfoRow
                label={t('crm_issue.priority')}
                value={labelForCrmIssuePriority(issue.priority, t)}
              />
              <View className="mb-3 flex-row items-start justify-between">
                <Text className="max-w-[38%] flex-shrink-0 pr-2 text-base font-semibold text-[#757575]">
                  SLA
                </Text>
                <View className="min-w-0 max-w-[62%] items-end">
                  <Text
                    className="text-right text-base font-medium"
                    style={{
                      color:
                        issue.sla_status === 'Breached'
                          ? '#B91C1C'
                          : issue.sla_status === 'Warning'
                            ? '#B45309'
                            : issue.sla_status === 'Passed'
                              ? '#047857'
                              : '#002855',
                    }}>
                    {issue.sla_status === 'Passed'
                      ? 'Đạt SLA'
                      : issue.sla_status === 'Breached'
                        ? 'Quá SLA'
                        : issue.sla_status === 'Warning'
                          ? 'Sắp quá SLA'
                          : issue.sla_status === 'On track'
                            ? 'Đúng tiến độ'
                            : '—'}
                  </Text>
                  {issue.sla_deadline ? (
                    <Text className="mt-1 text-right text-sm text-gray-500">
                      Hết hạn: {fmtDateTime(issue.sla_deadline)}
                    </Text>
                  ) : (
                    <Text className="mt-1 text-right text-sm text-gray-400">—</Text>
                  )}
                </View>
              </View>
            </View>

            {/* --- Phân công xử lý --- */}
            <View className="mb-4 rounded-2xl bg-[#F8F8F8] p-4">
              <Text className="mb-3 text-lg font-semibold text-[#002855]">
                {t('crm_issue.people_section')}
              </Text>
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-[#757575]">{t('crm_issue.pic')}</Text>
                <View className="max-w-[65%] flex-row items-center gap-2">
                  <Text className="text-right font-medium text-[#002855]" numberOfLines={2}>
                    {formatIssuePersonDisplayName({
                      fullName: issue.pic_full_name,
                      userId: issue.pic,
                    })}
                  </Text>
                  {canChangePic ? (
                    <TouchableOpacity
                      onPress={() => setShowChangePic(true)}
                      disabled={actionLoading}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      className="rounded-lg bg-white p-1.5">
                      <Ionicons name="swap-horizontal" size={16} color="#002855" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Phòng ban: tên phòng + mỗi nhân viên một dòng (Tên) */}
                <View className="mb-4 flex-row items-start justify-between">
                <Text className="max-w-[38%] flex-shrink-0 pr-2 text-base font-semibold text-[#757575]">
                  {t('crm_issue.related_department')}
                </Text>
                <View className="min-w-0 max-w-[62%] flex-1 items-end">
                  {deptName || getIssueDepartmentDocnames(issue).length > 0 ? (
                    <>
                      <Text
                        className="text-right font-medium text-[#002855]"
                        numberOfLines={3}>
                        {deptName || issue.department}
                      </Text>
                      {deptMemberRows.length > 0 ? (
                        deptMemberRows.map((row, idx) => {
                          const display = formatIssuePersonDisplayName({
                            fullName: row.full_name,
                            userId: row.user,
                          });
                          const line = (display || row.user || '').trim();
                          if (!line) return null;
                          return (
                            <Text
                              key={row.user || `dm-${idx}`}
                              className="mt-1 text-right text-sm text-[#002855]">
                              ({line})
                            </Text>
                          );
                        })
                      ) : (
                        <Text className="mt-1 text-right text-sm text-gray-400">
                          {t('crm_issue.department_no_members')}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text className="text-right font-medium text-[#98A2B3]">—</Text>
                  )}
                </View>
              </View>

              {/* Nhóm liên quan — đơn vị con của phòng ban */}
              <View className="mb-4 flex-row items-start justify-between">
                <Text className="max-w-[38%] flex-shrink-0 pr-2 text-base font-semibold text-[#757575]">
                  {t('crm_issue.related_groups')}
                </Text>
                <View className="min-w-0 max-w-[62%] flex-1 items-end">
                  {relatedGroupLabels.length > 0 ? (
                    relatedGroupLabels.map((label, idx) => (
                      <Text
                        key={`grp-${idx}`}
                        className={`text-right font-medium text-[#002855] ${idx > 0 ? 'mt-1' : ''}`}>
                        {label}
                      </Text>
                    ))
                  ) : (
                    <Text className="text-right font-medium text-[#98A2B3]">—</Text>
                  )}
                </View>
              </View>

              {/* Người liên quan — chọn tay; người do đơn vị kéo vào không sửa ở đây */}
              <View className="mb-4 flex-row items-start justify-between">
                <Text className="max-w-[38%] flex-shrink-0 pr-2 text-base font-semibold text-[#757575]">
                  {t('crm_issue.related_users')}
                </Text>
                <View className="min-w-0 max-w-[62%] flex-1 items-end">
                  {manualRelatedUsers.length > 0 ? (
                    manualRelatedUsers.map((r, idx) => (
                      <Text
                        key={r.user || `ru-${idx}`}
                        className={`text-right font-medium text-[#002855] ${idx > 0 ? 'mt-1' : ''}`}>
                        {r.full_name?.trim() || r.user}
                      </Text>
                    ))
                  ) : (
                    <Text className="text-right font-medium text-[#98A2B3]">—</Text>
                  )}
                  {canEditRelatedUsers ? (
                    <TouchableOpacity
                      onPress={() => {
                        // Nạp bản nháp từ danh sách hiện tại rồi mới mở sheet
                        setRelatedUserDraft(manualRelatedUsers.map((r) => r.user));
                        setRelatedUserLabels(
                          Object.fromEntries(
                            manualRelatedUsers.map((r) => [r.user, r.full_name?.trim() || r.user]),
                          ),
                        );
                        setShowRelatedUsers(true);
                      }}
                      disabled={actionLoading}
                      className="mt-2 flex-row items-center gap-1 rounded-lg bg-white px-2.5 py-1.5">
                      <Ionicons name="person-add-outline" size={14} color="#002855" />
                      <Text className="text-xs font-medium text-[#002855]">
                        {manualRelatedUsers.length === 0
                          ? t('crm_issue.add_related_users')
                          : t('crm_issue.edit_related_users')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <InfoRow label={t('crm_issue.updated_date')} value={fmtDate(issue.modified)} />
            </View>

            {/* --- Nội dung vấn đề (tab Yêu cầu, khớp web IssueRequestTabV2) --- */}
            <View className="mb-4 rounded-2xl bg-[#F8F8F8] p-4">
              <Text className="mb-3 text-lg font-semibold text-[#002855]">
                {t('crm_issue.content_section')}
              </Text>

              <View className="mb-3">
                <Text className="mt-1 text-[#757575]">
                  {stripHtml(contentSplit.displayHtml) || '—'}
                </Text>
              </View>

              {contentSplit.embeddedFiles.length > 0 ? (
                <View className="mb-3">
                  <Text className="mb-2 font-semibold text-[#002855]">
                    {t('crm_issue.feedback_embedded_files')}
                  </Text>
                  {contentSplit.embeddedFiles.map((f, fi) => {
                    const u = f.url.startsWith('http')
                      ? f.url
                      : `${BASE_URL}${f.url.startsWith('/') ? '' : '/'}${f.url}`;
                    return (
                      <TouchableOpacity
                        key={`emb-${fi}-${f.url}`}
                        onPress={() =>
                          Linking.openURL(u).catch(() =>
                            Alert.alert(t('common.error'), t('crm_issue.cannot_open_file'))
                          )
                        }
                        className="mb-2 flex-row items-center rounded-lg bg-white p-2">
                        <Ionicons name="attach-outline" size={18} color="#002855" />
                        <Text className="ml-2 flex-1 text-sm text-blue-700" numberOfLines={2}>
                          {f.label || f.url.split('/').pop() || f.url}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {issue.attachment ? (
                <View className="mb-1">
                  <Text className="mb-2 font-semibold text-[#002855]">
                    {t('crm_issue.attachment')}
                  </Text>
                  {isImage ? (
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL(attachmentUrl).catch(() =>
                          Alert.alert(t('common.error'), t('crm_issue.cannot_open_file'))
                        )
                      }>
                      <Image
                        source={{ uri: attachmentUrl }}
                        className="h-32 w-32 rounded-lg"
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL(attachmentUrl).catch(() =>
                          Alert.alert(t('common.error'), t('crm_issue.cannot_open_file'))
                        )
                      }
                      className="flex-row items-center rounded-lg bg-white p-3">
                      <Ionicons name="document-text-outline" size={20} color="#6B7280" />
                      <Text className="ml-2 flex-1 text-sm text-blue-600" numberOfLines={1}>
                        {issue.attachment.split('/').pop() || t('crm_issue.attachment')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
            </View>

          </ScrollView>
        ) : (
          /* ====== TAB: Quá trình xử lý (nội dung vấn đề + timeline log) ====== */
          <>
          <ScrollView
            className="flex-1 bg-white p-4"
            contentContainerStyle={{ paddingBottom: 32 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                colors={['#F05023']}
                tintColor="#F05023"
              />
            }>
            {/* Dòng thời gian hợp nhất: duyệt / từ chối / phản hồi phụ huynh / nhật ký xử lý */}
            <IssueActivityFeedList
              items={activityFeed}
              canEditLog={issue.can_edit_process_log === true}
              onEditLog={(log) => {
                setEditLogName(log.name || null);
                setInitialLogTitle(log.title || '');
                setInitialLogContent(log.content || '');
                setShowLog(true);
              }}
              loadingLinkedFeedback={loadingLinkedFeedback}
            />
          </ScrollView>

          {/* FAB: thêm log / phản hồi phụ huynh (Sales) — khớp web */}
          {(canAddLog || (issue.source_feedback && canReplyParent)) && (
            <TouchableOpacity
              onPress={() => {
                if (issue.source_feedback && canAddLog && canReplyParent) {
                  setShowFabMenu(true);
                } else if (issue.source_feedback && canReplyParent && !canAddLog) {
                  setShowReplyFeedback(true);
                } else if (canAddLog) {
                  setEditLogName(null);
                  setInitialLogTitle('');
                  setInitialLogContent('');
                  setShowLog(true);
                }
              }}
              activeOpacity={0.85}
              style={{
                position: 'absolute',
                right: 20,
                bottom: 24,
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: '#F05023',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
                elevation: 6,
              }}>
              <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
          )}
          </>
        )}
      </View>

      {/* ====== MODALS ====== */}
      <ApproveIssueSheet
        visible={showApprove}
        onClose={() => setShowApprove(false)}
        issue={issue}
        onConfirm={onApproveConfirm}
        loading={actionLoading}
      />
      <ChangePicSheet
        visible={showChangePic}
        onClose={() => setShowChangePic(false)}
        issueName={issue.name}
        currentPic={issue.pic}
        onConfirm={onChangePicConfirm}
        loading={actionLoading}
      />
      <MultiPickerSheet
        visible={showRelatedUsers}
        onClose={() => {
          setShowRelatedUsers(false);
          void saveRelatedUsers(relatedUserDraft);
        }}
        title={t('crm_issue.related_users')}
        options={relatedUserDraft.map((id) => ({
          value: id,
          label: relatedUserLabels[id] || id,
        }))}
        selected={relatedUserDraft}
        searchPlaceholder={t('crm_issue.related_users_search_placeholder')}
        onSearch={async (term) => {
          const res = await searchUsersForPicker(term);
          return res.data.map((u) => ({
            value: u.name,
            label: u.full_name || u.email,
            subtitle: u.email,
          }));
        }}
        onToggle={(value, option) => {
          setRelatedUserLabels((prev) => ({ ...prev, [value]: option.label }));
          setRelatedUserDraft((prev) =>
            prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
          );
        }}
        onClear={() => setRelatedUserDraft([])}
      />
      <RejectModal
        visible={showReject}
        onClose={() => setShowReject(false)}
        onConfirm={onReject}
        loading={actionLoading}
      />
      <StatusChangeModal
        visible={showStatus}
        onClose={() => setShowStatus(false)}
        onConfirm={onStatusConfirm}
        loading={actionLoading}
        allowedStatuses={allowedStatuses}
        currentStatus={issue.status}
      />
      <ProcessLogModal
        visible={showLog}
        onClose={() => {
          setShowLog(false);
          setEditLogName(null);
          setInitialLogTitle('');
          setInitialLogContent('');
        }}
        onConfirm={onLogConfirm}
        editLogName={editLogName}
        initialTitle={initialLogTitle}
        initialContent={initialLogContent}
        loading={actionLoading}
      />
      <FeedbackReplyModal
        visible={showReplyFeedback}
        onClose={() => setShowReplyFeedback(false)}
        onConfirm={onReplyParentConfirm}
        loading={actionLoading}
      />
      <ActionSheet
        visible={showFabMenu}
        title={t('crm_issue.fab_action_title')}
        options={[
          ...(canAddLog ? [{ label: t('crm_issue.add_log'), value: 'log' }] : []),
          ...(canReplyParent ? [{ label: t('crm_issue.reply_parent'), value: 'reply' }] : []),
        ]}
        onSelect={(value) => {
          setShowFabMenu(false);
          if (value === 'log') {
            setEditLogName(null);
            setInitialLogTitle('');
            setInitialLogContent('');
            setShowLog(true);
          }
          if (value === 'reply') setShowReplyFeedback(true);
        }}
        onCancel={() => setShowFabMenu(false)}
      />

      {/* Đổi phòng ban liên quan — chọn nhiều, lưu khi đóng sheet */}
      <MultiPickerSheet
        visible={showDeptSheet}
        onClose={() => {
          setShowDeptSheet(false);
          void saveDepartments(deptDraft);
        }}
        title={t('crm_issue.select_department')}
        options={departmentPickerOptions}
        selected={deptDraft}
        searchPlaceholder={t('crm_issue.dept_search_placeholder')}
        onToggle={(value) =>
          setDeptDraft((prev) =>
            prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
          )
        }
        emptyText={t('crm_issue.no_departments')}
      />
    </SafeAreaView>
  );
};

/** Dòng thông tin: label bên trái, value bên phải */
function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-base font-semibold text-[#757575]">{label}</Text>
      <Text
        className="ml-4 max-w-[60%] text-right text-base font-medium"
        style={{ color: valueColor || '#002855' }}
        numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
  );
}

export default CRMIssueDetailScreen;
