import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (title: string, content: string) => void;
  /** Khi có — chế độ sửa log (API update_process_log) */
  editLogName?: string | null;
  initialTitle?: string;
  initialContent?: string;
  loading?: boolean;
};

export const ProcessLogModal: React.FC<Props> = ({
  visible,
  onClose,
  onConfirm,
  editLogName,
  initialTitle,
  initialContent,
  loading,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (visible) {
      if (editLogName) {
        setTitle((initialTitle || '').trim());
        setContent((initialContent || '').trim());
      } else {
        setTitle('');
        setContent('');
      }
    }
  }, [visible, editLogName, initialTitle, initialContent]);

  const handleConfirm = () => {
    if (!title.trim() || !content.trim()) return;
    onConfirm(title.trim(), content.trim());
  };

  const canSubmit = title.trim() && content.trim();

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={55}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ minHeight: 200 }}>
        <View className="px-4 pb-4 pt-4">
          <Text className="mb-1 text-lg font-bold text-[#002855]">
            {editLogName ? t('crm_issue.edit_log') || 'Sửa log' : t('crm_issue.add_log')}
          </Text>
          <Text className="mb-4 text-xs text-gray-400">
            {t('crm_issue.add_log_hint') || 'Nhập tiêu đề và nội dung để ghi nhận bước xử lý.'}
          </Text>

          <TextInput
            className="mb-3 rounded-xl border border-gray-200 bg-[#F9FAFB] px-3 py-3 text-sm text-gray-900"
            placeholder={`${t('crm_issue.log_title_placeholder') || 'Tiêu đề'} *`}
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            editable={!loading}
          />
          <TextInput
            className="rounded-xl border border-gray-200 bg-[#F9FAFB] px-3 py-3 text-sm text-gray-900"
            style={{ height: 120, textAlignVertical: 'top' }}
            multiline
            placeholder={`${t('crm_issue.log_content_placeholder') || 'Nội dung'} *`}
            placeholderTextColor="#9CA3AF"
            value={content}
            onChangeText={setContent}
            editable={!loading}
          />

          <View className="mt-4 flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              className="flex-1 items-center rounded-xl bg-gray-100 py-3">
              <Text className="font-semibold text-gray-600">{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={loading || !canSubmit}
              className={`flex-1 items-center justify-center rounded-xl py-3 ${
                !canSubmit ? 'bg-gray-200' : 'bg-[#F05023]'
              }`}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className={`font-semibold ${canSubmit ? 'text-white' : 'text-gray-400'}`}>
                  {t('crm_issue.add_log_confirm') || 'Thêm'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </BottomSheetModal>
  );
};
