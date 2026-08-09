import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, TextInput } from 'react-native';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';
import { useTranslation } from 'react-i18next';
import type { CRMIssueResult, CRMIssueStatus } from '../../../types/crmIssue';
import {
  CRM_ISSUE_RESULT_LABELS,
  CRM_ISSUE_RESULT_OPTION_ORDER,
  CRM_ISSUE_STATUS_LABELS,
} from '../../../types/crmIssue';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (status: CRMIssueStatus, result?: CRMIssueResult | '', note?: string) => void;
  loading?: boolean;
  /** Bước hợp lệ theo trạng thái + quyền hiện tại (getAllowedStatusTransitions) */
  allowedStatuses: CRMIssueStatus[];
  /** Trạng thái đang có của vấn đề — dùng làm lựa chọn mặc định */
  currentStatus: CRMIssueStatus;
};

/**
 * Cập nhật xử lý — đổi trạng thái + ghi chú, đồng bộ web `IssueUpdateStatusModal`.
 *
 * Chỉ hiện bước backend chấp nhận: trước đây modal luôn liệt kê cứng
 * `Dang xu ly / Hoan thanh / Dong` nên user chọn bước sai rồi nhận lỗi kỹ thuật.
 * Ghi chú gửi kèm `change_issue_status`; backend ghi thành một dòng log "Cập nhật xử lý".
 */
export const StatusChangeModal: React.FC<Props> = ({
  visible,
  onClose,
  onConfirm,
  loading,
  allowedStatuses,
  currentStatus,
}) => {
  const { t } = useTranslation();

  /** Bước kế tiếp gợi ý: bước hợp lệ đầu tiên khác trạng thái hiện tại */
  const defaultStatus = useMemo(
    () => allowedStatuses.find((s) => s !== currentStatus) ?? currentStatus,
    [allowedStatuses, currentStatus]
  );

  const [status, setStatus] = useState<CRMIssueStatus>(defaultStatus);
  const [result, setResult] = useState<CRMIssueResult | ''>('');
  const [note, setNote] = useState('');

  // Mở lại sheet thì trả về mặc định — tránh giữ lựa chọn của lần trước
  useEffect(() => {
    if (visible) {
      setStatus(defaultStatus);
      setResult('');
      setNote('');
    }
  }, [visible, defaultStatus]);

  const confirm = () => {
    if (status === 'Hoan thanh' && (result === '' || result == null)) {
      Alert.alert(t('common.error'), t('crm_issue.result_required_when_complete'));
      return;
    }
    onConfirm(
      status,
      status === 'Hoan thanh' ? result : undefined,
      note.trim() ? note.trim() : undefined
    );
  };

  const nothingToDo = allowedStatuses.filter((s) => s !== currentStatus).length === 0;

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={75}>
      <View className="px-4 pb-4 pt-4">
        <Text className="mb-1 text-lg font-bold text-[#002855]">
          {t('crm_issue.update_processing')}
        </Text>
        <Text className="mb-4 text-sm text-gray-500">{t('crm_issue.update_processing_hint')}</Text>

        {nothingToDo ? (
          <Text className="py-4 text-center text-sm text-gray-500">
            {t('crm_issue.no_status_transition')}
          </Text>
        ) : (
          <>
            <Text className="mb-2 text-sm font-medium text-gray-600">{t('crm_issue.status')}</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {allowedStatuses.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStatus(s)}
                  className={`rounded-full border px-4 py-2.5 ${
                    status === s ? 'border-[#002855] bg-[#EBF0F7]' : 'border-gray-200 bg-white'
                  }`}>
                  <Text
                    className={`text-sm ${status === s ? 'font-semibold text-[#002855]' : 'text-gray-700'}`}>
                    {CRM_ISSUE_STATUS_LABELS[s]}
                    {s === currentStatus ? ` (${t('crm_issue.status_current')})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {status === 'Hoan thanh' ? (
              <>
                <Text className="mb-2 text-sm font-medium text-gray-600">
                  {t('crm_issue.result')}
                </Text>
                <View className="mb-4 flex-row flex-wrap gap-2">
                  {CRM_ISSUE_RESULT_OPTION_ORDER.map((r) => {
                    const label =
                      r === ''
                        ? t('crm_issue.result_none')
                        : CRM_ISSUE_RESULT_LABELS[r as CRMIssueResult];
                    return (
                      <TouchableOpacity
                        key={r === '' ? '__empty__' : r}
                        onPress={() => setResult(r)}
                        className={`rounded-full border px-4 py-2.5 ${
                          result === r ? 'border-[#002855] bg-[#EBF0F7]' : 'border-gray-200 bg-white'
                        }`}>
                        <Text
                          className={`text-xs ${result === r ? 'font-semibold text-[#002855]' : 'text-gray-700'}`}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text className="mb-2 text-sm font-medium text-gray-600">
              {t('crm_issue.status_note')}
            </Text>
            <TextInput
              className="mb-1 min-h-[88px] rounded-xl border border-gray-200 bg-[#F9FAFB] px-3 py-2.5 text-sm text-gray-800"
              placeholder={t('crm_issue.status_note_placeholder')}
              placeholderTextColor="#9CA3AF"
              value={note}
              onChangeText={setNote}
              multiline
              textAlignVertical="top"
            />
            <Text className="mb-2 text-xs text-gray-400">{t('crm_issue.status_note_hint')}</Text>
          </>
        )}

        <View className="mt-4 flex-row gap-3 border-t border-gray-100 pt-3">
          <TouchableOpacity
            onPress={onClose}
            disabled={loading}
            className="flex-1 items-center rounded-xl bg-gray-100 py-3">
            <Text className="font-semibold text-gray-600">{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirm}
            disabled={loading || nothingToDo}
            className={`flex-1 items-center rounded-xl py-3 ${
              nothingToDo ? 'bg-gray-300' : 'bg-[#002855]'
            }`}>
            <Text className="font-semibold text-white">{loading ? '...' : t('common.save')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetModal>
  );
};
