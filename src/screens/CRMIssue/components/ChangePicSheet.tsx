/**
 * Đổi người thực hiện (PIC) của vấn đề.
 *
 * Truyền `issueName` để server bổ sung Team phòng ban của chính vấn đề đó vào danh sách
 * ứng viên (`get_issue_pic_candidates?issue=`), giống web.
 *
 * Dùng `MultiPickerSheet` chế độ chọn-một để giống mọi ô chọn khác của Vấn đề chung.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPicDisplayName } from '../../../utils/nameUtils';
import type { IssuePicCandidate } from '../../../types/crmIssue';
import { getIssuePicCandidates } from '../../../services/crmIssueService';
import { MultiPickerSheet, type PickerOption } from './MultiPickerSheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  issueName: string;
  currentPic?: string;
  onConfirm: (pic: string) => void;
  loading?: boolean;
};

export const ChangePicSheet: React.FC<Props> = ({
  visible,
  onClose,
  issueName,
  currentPic,
  onConfirm,
  loading,
}) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<IssuePicCandidate[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setFetching(true);
    void getIssuePicCandidates(issueName)
      .then((res) => {
        if (cancelled) return;
        setItems(res.success && res.data ? res.data : []);
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, issueName]);

  const options = useMemo<PickerOption[]>(
    () =>
      items.map((u) => ({
        value: u.user_id,
        label: getPicDisplayName(u.full_name, u.email),
        subtitle: u.job_title ? `${u.job_title} · ${u.email}` : u.email,
      })),
    [items]
  );

  return (
    <MultiPickerSheet
      visible={visible}
      onClose={onClose}
      mode="single"
      title={t('crm_issue.change_pic')}
      options={options}
      selected={currentPic ? [currentPic] : []}
      searchPlaceholder={t('crm_issue.pic_search_placeholder')}
      emptyText={fetching ? t('common.loading') : t('crm_issue.no_pic_candidates')}
      onToggle={(value) => {
        if (!loading) onConfirm(value);
      }}
    />
  );
};
