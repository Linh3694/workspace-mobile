/**
 * Sheet duyệt vấn đề — người duyệt chốt phân công trước khi gửi.
 *
 * Backend `approve_issue` BẮT BUỘC `departments` và `issue_group`; trước đây mobile duyệt
 * thẳng bằng giá trị sẵn có nên vấn đề chưa có Nhóm vấn đề không bao giờ duyệt được.
 * Đồng bộ dialog duyệt của web `IssueDetailDialogsV2`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';
import type {
  CRMIssue,
  CRMIssueGroup,
  CRMIssuePriority,
  IssueParticipant,
  IssuePicCandidate,
} from '../../../types/crmIssue';
import {
  CRM_ISSUE_GROUP_OPTIONS,
  CRM_ISSUE_PRIORITY_ORDER,
  labelForCrmIssuePriority,
} from '../../../types/crmIssue';
import { getIssuePicCandidates, previewIssueParticipants } from '../../../services/crmIssueService';
import { getIssueUnitOptions, type IssueUnitOption } from '../../../services/organizationService';
import { descendantUnitsOf, keepGroupsUnderDepartments } from '../shared/issueOrgUnits';
import { MultiPickerSheet, type PickerOption } from './MultiPickerSheet';
import { IssueParticipantsPreview } from './IssueParticipantsPreview';

export type ApprovePayload = {
  departments: string[];
  related_groups: string[];
  related_users: string[];
  issue_group: CRMIssueGroup;
  priority: CRMIssuePriority;
  pic?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  issue: CRMIssue;
  onConfirm: (payload: ApprovePayload) => void;
  loading?: boolean;
};

export const ApproveIssueSheet: React.FC<Props> = ({
  visible,
  onClose,
  issue,
  onConfirm,
  loading,
}) => {
  const { t } = useTranslation();

  const [unitOptions, setUnitOptions] = useState<IssueUnitOption[]>([]);
  const [picItems, setPicItems] = useState<IssuePicCandidate[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [issueGroup, setIssueGroup] = useState<CRMIssueGroup | ''>('');
  const [priority, setPriority] = useState<CRMIssuePriority>('Trung binh');
  const [pic, setPic] = useState('');

  const [participants, setParticipants] = useState<IssueParticipant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const [showDept, setShowDept] = useState(false);
  const [showGroups, setShowGroups] = useState(false);

  // Mở sheet: nạp danh mục + lấy giá trị hiện có của vấn đề làm điểm khởi đầu
  useEffect(() => {
    if (!visible) return;
    setDeptIds(
      ((issue.issue_departments ?? []).map((r) => r.department).filter(Boolean) as string[]).length >
        0
        ? ((issue.issue_departments ?? []).map((r) => r.department).filter(Boolean) as string[])
        : issue.department
          ? [issue.department]
          : []
    );
    setGroupIds((issue.issue_related_groups ?? []).map((r) => r.unit).filter(Boolean) as string[]);
    setIssueGroup((issue.issue_group as CRMIssueGroup) || '');
    setPriority((issue.priority as CRMIssuePriority) || 'Trung binh');
    setPic(issue.pic || '');

    let cancelled = false;
    setLoadingMeta(true);
    void Promise.all([getIssueUnitOptions(), getIssuePicCandidates(issue.name)])
      .then(([u, p]) => {
        if (cancelled) return;
        if (u.success) setUnitOptions(u.data);
        if (p.success && p.data) setPicItems(p.data);
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, issue]);

  // Bỏ phòng ban thì nhóm con của nó cũng rời khỏi lựa chọn
  useEffect(() => {
    setGroupIds((prev) => {
      const next = keepGroupsUnderDepartments(unitOptions, deptIds, prev);
      return next.length === prev.length ? prev : next;
    });
  }, [unitOptions, deptIds]);

  useEffect(() => {
    if (!visible) return;
    if (deptIds.length === 0 && groupIds.length === 0) {
      setParticipants([]);
      return;
    }
    let cancelled = false;
    setLoadingParticipants(true);
    const timer = setTimeout(() => {
      void previewIssueParticipants({ departments: deptIds, related_groups: groupIds })
        .then((res) => {
          if (cancelled) return;
          setParticipants(res.success && res.data ? res.data.participants : []);
        })
        .finally(() => {
          if (!cancelled) setLoadingParticipants(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, deptIds, groupIds]);

  const unitLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of unitOptions) map[u.name] = u.department_name;
    return map;
  }, [unitOptions]);

  const departmentOptions = useMemo<PickerOption[]>(
    () =>
      unitOptions
        .filter((u) => u.is_department)
        .map((u) => ({ value: u.name, label: u.department_name })),
    [unitOptions]
  );

  const groupOptions = useMemo<PickerOption[]>(
    () =>
      descendantUnitsOf(unitOptions, deptIds).map((u) => ({
        value: u.name,
        label: u.department_name,
      })),
    [unitOptions, deptIds]
  );

  const canSubmit = deptIds.length > 0 && !!issueGroup && !loading;

  return (
    <>
      <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={85} fillHeight>
        <View className="flex-1 px-4 pb-4 pt-4">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-[#002855]">{t('crm_issue.approve_title')}</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <Text className="mb-4 text-sm text-gray-500">{t('crm_issue.approve_hint')}</Text>

          {loadingMeta ? <ActivityIndicator className="mb-3" color="#002855" /> : null}

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Phòng ban liên quan — bắt buộc */}
            <Text className="mb-2 text-sm font-medium text-gray-600">
              {t('crm_issue.department')} <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setShowDept(true)}
              className="mb-4 flex-row items-center justify-between rounded-xl border border-gray-200 bg-[#F9FAFB] px-3 py-3">
              <Text
                className={`min-w-0 flex-1 pr-2 text-sm ${deptIds.length === 0 ? 'text-gray-400' : 'text-[#002855]'}`}
                numberOfLines={2}>
                {deptIds.length === 0
                  ? t('crm_issue.select_department')
                  : deptIds.map((id) => unitLabelById[id] || id).join(', ')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Nhóm liên quan */}
            <Text className="mb-2 text-sm font-medium text-gray-600">
              {t('crm_issue.related_groups')}
            </Text>
            <TouchableOpacity
              disabled={deptIds.length === 0}
              onPress={() => setShowGroups(true)}
              className={`mb-4 flex-row items-center justify-between rounded-xl border border-gray-200 bg-[#F9FAFB] px-3 py-3 ${
                deptIds.length === 0 ? 'opacity-60' : ''
              }`}>
              <Text
                className={`min-w-0 flex-1 pr-2 text-sm ${groupIds.length === 0 ? 'text-gray-400' : 'text-[#002855]'}`}
                numberOfLines={2}>
                {deptIds.length === 0
                  ? t('crm_issue.pick_department_first')
                  : groupIds.length === 0
                    ? t('crm_issue.select_related_groups')
                    : groupIds.map((id) => unitLabelById[id] || id).join(', ')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Nhóm vấn đề — bắt buộc */}
            <Text className="mb-2 text-sm font-medium text-gray-600">
              {t('crm_issue.issue_group')} <Text className="text-red-500">*</Text>
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {CRM_ISSUE_GROUP_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setIssueGroup(opt.value)}
                  className={`rounded-full border px-4 py-2.5 ${
                    issueGroup === opt.value
                      ? 'border-[#002855] bg-[#EBF0F7]'
                      : 'border-gray-200 bg-white'
                  }`}>
                  <Text
                    className={`text-sm ${issueGroup === opt.value ? 'font-semibold text-[#002855]' : 'text-gray-700'}`}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Mức độ */}
            <Text className="mb-2 text-sm font-medium text-gray-600">
              {t('crm_issue.priority')}
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {CRM_ISSUE_PRIORITY_ORDER.map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setPriority(value)}
                  className={`rounded-full border px-4 py-2.5 ${
                    priority === value ? 'border-[#002855] bg-[#EBF0F7]' : 'border-gray-200 bg-white'
                  }`}>
                  <Text
                    className={`text-sm ${priority === value ? 'font-semibold text-[#002855]' : 'text-gray-700'}`}>
                    {labelForCrmIssuePriority(value, t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Người thực hiện — bỏ trống thì server tự gán theo ngữ cảnh */}
            <Text className="mb-2 text-sm font-medium text-gray-600">{t('crm_issue.pic')}</Text>
            <View className="mb-2 flex-row flex-wrap gap-2">
              <TouchableOpacity
                onPress={() => setPic('')}
                className={`rounded-full border px-4 py-2.5 ${
                  !pic ? 'border-[#002855] bg-[#EBF0F7]' : 'border-gray-200 bg-white'
                }`}>
                <Text className={`text-sm ${!pic ? 'font-semibold text-[#002855]' : 'text-gray-700'}`}>
                  {t('crm_issue.pic_auto')}
                </Text>
              </TouchableOpacity>
              {picItems.map((u) => (
                <TouchableOpacity
                  key={u.user_id}
                  onPress={() => setPic(u.user_id)}
                  className={`rounded-full border px-4 py-2.5 ${
                    pic === u.user_id
                      ? 'border-[#002855] bg-[#EBF0F7]'
                      : 'border-gray-200 bg-white'
                  }`}>
                  <Text
                    className={`text-sm ${pic === u.user_id ? 'font-semibold text-[#002855]' : 'text-gray-700'}`}
                    numberOfLines={1}>
                    {u.full_name || u.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <IssueParticipantsPreview
              participants={participants}
              loading={loadingParticipants}
            />
          </ScrollView>

          {!canSubmit && !loading ? (
            <Text className="mt-3 text-xs text-[#B45309]">
              {t('crm_issue.approve_required_hint')}
            </Text>
          ) : null}

          <View className="mt-3 flex-row gap-3 border-t border-gray-100 pt-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              className="flex-1 items-center rounded-xl bg-gray-100 py-3">
              <Text className="font-semibold text-gray-600">{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!canSubmit}
              onPress={() =>
                onConfirm({
                  departments: deptIds,
                  related_groups: groupIds,
                  related_users: [],
                  issue_group: issueGroup as CRMIssueGroup,
                  priority,
                  ...(pic ? { pic } : {}),
                })
              }
              className={`flex-1 items-center rounded-xl py-3 ${canSubmit ? 'bg-[#002855]' : 'bg-gray-300'}`}>
              <Text className="font-semibold text-white">
                {loading ? '...' : t('crm_issue.approve_confirm')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheetModal>

      <MultiPickerSheet
        visible={showDept}
        onClose={() => setShowDept(false)}
        title={t('crm_issue.select_department')}
        options={departmentOptions}
        selected={deptIds}
        onToggle={(value) =>
          setDeptIds((prev) =>
            prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
          )
        }
        emptyText={t('crm_issue.no_departments')}
        onClear={() => setDeptIds([])}
      />

      <MultiPickerSheet
        visible={showGroups}
        onClose={() => setShowGroups(false)}
        title={t('crm_issue.related_groups')}
        options={groupOptions}
        selected={groupIds}
        onToggle={(value) =>
          setGroupIds((prev) =>
            prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
          )
        }
        emptyText={t('crm_issue.no_related_groups')}
        onClear={() => setGroupIds([])}
      />
    </>
  );
};
