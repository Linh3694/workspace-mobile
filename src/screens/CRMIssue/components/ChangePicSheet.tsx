/**
 * Đổi người thực hiện (PIC) của vấn đề.
 *
 * Truyền `issueName` để server bổ sung Team phòng ban của chính vấn đề đó vào danh sách
 * ứng viên (`get_issue_pic_candidates?issue=`), giống web.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';
import type { IssuePicCandidate } from '../../../types/crmIssue';
import { getIssuePicCandidates } from '../../../services/crmIssueService';

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

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={65} fillHeight>
      <View className="flex-1 px-4 pb-4 pt-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-[#002855]">{t('crm_issue.change_pic')}</Text>
          <TouchableOpacity onPress={onClose} className="p-1">
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {fetching ? <ActivityIndicator className="py-3" color="#002855" /> : null}

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {!fetching && items.length === 0 ? (
            <Text className="py-4 text-center text-sm text-gray-400">
              {t('crm_issue.no_pic_candidates')}
            </Text>
          ) : (
            items.map((u) => {
              const active = u.user_id === currentPic;
              return (
                <TouchableOpacity
                  key={u.user_id}
                  disabled={loading}
                  onPress={() => onConfirm(u.user_id)}
                  className="flex-row items-center border-b border-gray-100 py-3">
                  <View className="min-w-0 flex-1 pr-2">
                    <Text className="text-base font-medium text-[#002855]" numberOfLines={1}>
                      {u.full_name || u.email}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                      {u.job_title ? `${u.job_title} · ${u.email}` : u.email}
                    </Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </BottomSheetModal>
  );
};
