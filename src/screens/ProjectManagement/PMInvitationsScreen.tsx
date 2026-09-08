import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { ButtonPrimary, ButtonSecondary } from '@atoms';
import { ListRow, resolveStatus } from '@molecules';
import { RefreshableList } from '@organisms';
import { ListScreen, SCREEN_PADDING } from '@templates';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  acceptInvitation,
  declineInvitation,
  getMyInvitations,
} from '../../services/projectManagementService';
import type { PMProjectInvitation } from '../../types/projectManagement';
import { space } from '../../theme/tokens';
import { PROJECT_ROLE, i18nKey } from './pmStatus';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Lời mời tham gia dự án — màn đích của thông báo `pm_project_invited`.
 *
 * Chỉ hiện lời mời đang chờ. Lời mời đã trả lời hoặc hết hạn không còn việc gì
 * để làm, giữ lại chỉ khiến danh sách dài ra rồi người dùng bỏ qua cả màn.
 */
const PMInvitationsScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { t } = useTranslation();

  const [items, setItems] = useState<PMProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /**
   * Lời mời đang gửi + hành động nào. Nút của ui-v2 tự suy trạng thái vô hiệu
   * từ `loading`, nên chặn bấm hai lần bằng chính biến này ở đầu handler chứ
   * không bằng prop `disabled`.
   */
  const [busy, setBusy] = useState<{ id: string; accept: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const res = await getMyInvitations('pending');
    if (!mounted.current) return;

    if (res.success) {
      setItems(res.data ?? []);
      setError(null);
    } else {
      setError(res.message ?? 'Không tải được danh sách lời mời');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Trả lời một lời mời rồi gỡ khỏi danh sách ngay.
   *
   * Không gọi `load()` lại: server vừa đổi trạng thái xong nhưng lời mời có thể
   * chưa rời khỏi bộ lọc `pending` kịp, và người dùng sẽ thấy dòng vừa bấm nhấp
   * nháy hiện lại.
   */
  const respond = useCallback(
    async (invitation: PMProjectInvitation, accept: boolean) => {
      if (busy) return;
      setBusy({ id: invitation.name, accept });
      const res = accept
        ? await acceptInvitation(invitation.name)
        : await declineInvitation(invitation.name);
      if (!mounted.current) return;
      setBusy(null);

      if (!res.success) {
        Alert.alert(
          t('common.error', 'Đã có lỗi'),
          res.message ?? t('common.try_again', 'Vui lòng thử lại')
        );
        return;
      }
      setItems((prev) => prev.filter((x) => x.name !== invitation.name));
    },
    [busy, t]
  );

  const renderItem = useCallback(
    ({ item }: { item: PMProjectInvitation }) => {
      const roleInfo = resolveStatus(item.role, PROJECT_ROLE);
      const pending = busy?.id === item.name;

      return (
        <ListRow
          title={item.project_title || item.project_id}
          subtitle={[
            item.inviter_full_name || item.inviter_id,
            t(i18nKey.role(item.role), roleInfo.label),
          ]
            .filter(Boolean)
            .join(' · ')}
          icon="mail"
          footer={
            <View style={{ flexDirection: 'row', gap: space[8] }}>
              <ButtonSecondary
                label={t('project_management.tu_choi', 'Từ chối')}
                size="sm"
                loading={pending && !busy?.accept}
                onPress={() => respond(item, false)}
              />
              <ButtonPrimary
                label={t('project_management.tham_gia', 'Tham gia')}
                size="sm"
                loading={pending && !!busy?.accept}
                onPress={() => respond(item, true)}
              />
            </View>
          }
        />
      );
    },
    [busy, respond, t]
  );

  return (
    <ListScreen
      header={{
        title: t('project_management.loi_moi', 'Lời mời dự án'),
        onBack: () => navigation.goBack(),
      }}
    >
      <RefreshableList
        data={items}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        contentPadding={SCREEN_PADDING}
        empty={{
          icon: 'mail',
          title: error
            ? t('common.error', 'Đã có lỗi')
            : t('project_management.khong_co_loi_moi', 'Không có lời mời nào'),
          description:
            error ??
            t(
              'project_management.khong_co_loi_moi_desc',
              'Lời mời tham gia dự án sẽ xuất hiện ở đây.'
            ),
          actionLabel: t('common.retry', 'Thử lại'),
          onAction: () => load(true),
        }}
      />
    </ListScreen>
  );
};

export default PMInvitationsScreen;
