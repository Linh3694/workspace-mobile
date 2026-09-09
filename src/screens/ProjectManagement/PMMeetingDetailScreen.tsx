import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-native-markdown-display';

import { AppText, Avatar, Card, Icon, Spinner } from '@atoms';
import { EmptyState, SectionCard } from '@organisms';
import { ListScreen, SCREEN_PADDING } from '@templates';

import { ROUTES } from '../../constants/routes';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getMeeting, resolveFileUrl } from '../../services/projectManagementService';
import type { PMMeeting } from '../../types/projectManagement';
import { color, space } from '../../theme/tokens';
import { htmlToMarkdown } from './pmText';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRoute = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.PM_MEETING_DETAIL>;

const formatDate = (value?: string): string => {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
};

const formatTime = (value?: string): string => (value ? value.slice(0, 5) : '');

const markdownStyle = {
  body: { color: color.content.DEFAULT },
  heading1: { color: color.content.emphasized },
  heading2: { color: color.content.emphasized },
  link: { color: color.brand.DEFAULT },
  code_inline: { backgroundColor: color.surface.subtle },
  fence: { backgroundColor: color.surface.subtle },
};

/**
 * Chi tiết cuộc họp — màn đích của bốn thông báo `pm_meeting_*`.
 *
 * `pm_meeting_cancelled` cố ý KHÔNG trỏ vào đây: bản ghi đã bị xoá nên mở ra chỉ
 * thấy lỗi. Nó dừng ở danh sách họp của dự án (xem `resolveNotificationTarget`).
 */
const PMMeetingDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<ScreenRoute>();
  const { t } = useTranslation();

  const meetingId = route.params?.meetingId ?? '';
  const [meeting, setMeeting] = useState<PMMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!meetingId) {
      setError('Thiếu mã cuộc họp');
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await getMeeting(meetingId);
    if (!mounted.current) return;
    if (res.success && res.data) {
      setMeeting(res.data);
      setError(null);
    } else {
      setError(res.message ?? 'Không tải được cuộc họp');
    }
    setLoading(false);
  }, [meetingId]);

  useEffect(() => {
    load();
  }, [load]);

  const minutesMd = useMemo(
    () => (meeting?.minutes ? htmlToMarkdown(meeting.minutes) : ''),
    [meeting?.minutes]
  );
  const actionItemsMd = useMemo(
    () => (meeting?.action_items ? htmlToMarkdown(meeting.action_items) : ''),
    [meeting?.action_items]
  );

  const header = {
    title: meeting?.title || t('project_management.cuoc_hop', 'Cuộc họp'),
    onBack: () => navigation.goBack(),
  };

  if (loading) {
    return (
      <ListScreen header={header}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner />
        </View>
      </ListScreen>
    );
  }

  if (error || !meeting) {
    return (
      <ListScreen header={header}>
        <EmptyState
          icon="issue"
          title={t('common.error', 'Đã có lỗi')}
          description={error ?? undefined}
          actionLabel={t('common.retry', 'Thử lại')}
          onAction={load}
        />
      </ListScreen>
    );
  }

  const when = [formatDate(meeting.meeting_date), formatTime(meeting.start_time)]
    .filter(Boolean)
    .join(' ');
  const timeRange = meeting.end_time ? `${when} – ${formatTime(meeting.end_time)}` : when;

  return (
    <ListScreen header={header}>
      <ScrollView
        contentContainerStyle={{ padding: SCREEN_PADDING, gap: space[12], paddingBottom: space[32] }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6] }}>
            <Icon name="calendar" size={15} tone="description" />
            <AppText variant="footnote">{timeRange}</AppText>
          </View>
          {meeting.location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6], marginTop: space[6] }}>
              <Icon name="location" size={15} tone="description" />
              <AppText variant="footnote">{meeting.location}</AppText>
            </View>
          ) : null}
          {meeting.description ? (
            <AppText variant="footnote" tone="description" style={{ marginTop: space[10] }}>
              {meeting.description}
            </AppText>
          ) : null}
        </Card>

        {meeting.attendees?.length ? (
          <SectionCard
            title={`${t('project_management.nguoi_tham_du', 'Người tham dự')} (${meeting.attendees.length})`}>
            <View style={{ gap: space[8] }}>
              {meeting.attendees.map((a) => (
                <View
                  key={a.user_id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
                  <Avatar uri={resolveFileUrl(a.user_image)} name={a.full_name || a.user_id} size="sm" />
                  <AppText variant="footnote" style={{ flex: 1 }} numberOfLines={1}>
                    {a.full_name || a.user_id}
                  </AppText>
                  {a.attended ? <Icon name="check" size={15} tone="success" /> : null}
                </View>
              ))}
            </View>
          </SectionCard>
        ) : null}

        {minutesMd ? (
          <SectionCard title={t('project_management.bien_ban', 'Biên bản')}>
            <Markdown style={markdownStyle}>{minutesMd}</Markdown>
          </SectionCard>
        ) : null}

        {actionItemsMd ? (
          <SectionCard title={t('project_management.viec_can_lam', 'Việc cần làm')}>
            <Markdown style={markdownStyle}>{actionItemsMd}</Markdown>
          </SectionCard>
        ) : null}
      </ScrollView>
    </ListScreen>
  );
};

export default PMMeetingDetailScreen;
