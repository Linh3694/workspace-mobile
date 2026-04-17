import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
};

export const RejectModal: React.FC<Props> = ({ visible, onClose, onConfirm, loading }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={55} fillHeight>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, minHeight: 180 }}>
        {/* pt: tránh tiêu đề dính sát mép bo trên của bottom sheet */}
        <View className="flex-1 px-4 pb-4 pt-6">
          <Text className="mb-1 text-lg font-bold text-[#002855]">
            {t('crm_issue.reject_title')}
          </Text>
          <Text className="mb-3 text-sm text-gray-500">
            {t('crm_issue.reject_hint')}
          </Text>
          <TextInput
            className="min-h-[80px] flex-1 rounded-xl border border-gray-200 bg-[#F9FAFB] p-3 text-sm text-gray-900"
            multiline
            placeholder={t('crm_issue.reject_reason_placeholder')}
            value={reason}
            onChangeText={setReason}
            editable={!loading}
            textAlignVertical="top"
          />
          <View className="mt-4 flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              className="flex-1 items-center rounded-xl bg-gray-100 py-3">
              <Text className="font-semibold text-gray-600">{t('common.cancel') || 'Huỷ'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(reason.trim())}
              disabled={loading}
              className="flex-1 items-center rounded-xl bg-[#002855] py-3">
              <Text className="font-semibold text-white">
                {loading ? '...' : t('common.confirm') || 'Xác nhận'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </BottomSheetModal>
  );
};
