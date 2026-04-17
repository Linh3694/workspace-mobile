import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
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
  onConfirm: (status: CRMIssueStatus, result?: CRMIssueResult | '') => void;
  loading?: boolean;
};

const STATUSES: CRMIssueStatus[] = ['Tiep nhan', 'Dang xu ly', 'Hoan thanh'];

export const StatusChangeModal: React.FC<Props> = ({ visible, onClose, onConfirm, loading }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CRMIssueStatus>('Dang xu ly');
  const [result, setResult] = useState<CRMIssueResult | ''>('');

  const confirm = () => {
    if (status === 'Hoan thanh' && (result === '' || result == null)) {
      Alert.alert(t('common.error'), t('crm_issue.result_required_when_complete'));
      return;
    }
    onConfirm(status, status === 'Hoan thanh' ? result : undefined);
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      maxHeightPercent={55}
      keyboardAvoiding={false}>
      <View className="px-4 pb-4 pt-4">
        <Text className="mb-4 text-lg font-bold text-[#002855]">
          {t('crm_issue.change_status')}
        </Text>
        <Text className="mb-2 text-sm font-medium text-gray-600">{t('crm_issue.status')}</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {STATUSES.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setStatus(s)}
              className={`rounded-full border px-4 py-2.5 ${
                status === s ? 'border-[#002855] bg-[#EBF0F7]' : 'border-gray-200 bg-white'
              }`}>
              <Text
                className={`text-sm ${status === s ? 'font-semibold text-[#002855]' : 'text-gray-700'}`}>
                {CRM_ISSUE_STATUS_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {status === 'Hoan thanh' ? (
          <>
            <Text className="mb-2 text-sm font-medium text-gray-600">
              {t('crm_issue.result')}
            </Text>
            <View className="mb-2 flex-row flex-wrap gap-2">
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
        <View className="mt-4 flex-row gap-3 border-t border-gray-100 pt-3">
          <TouchableOpacity
            onPress={onClose}
            disabled={loading}
            className="flex-1 items-center rounded-xl bg-gray-100 py-3">
            <Text className="font-semibold text-gray-600">{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirm}
            disabled={loading}
            className="flex-1 items-center rounded-xl bg-[#002855] py-3">
            <Text className="font-semibold text-white">
              {loading ? '...' : t('common.save')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetModal>
  );
};
