import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-native-markdown-display';

import { AppText, Avatar, ButtonGhost, Card, Divider, Icon, Spinner } from '@atoms';
import { StatusBadge } from '@molecules';
import { AppSheet, EmptyState, SectionCard, useSheetQueue } from '@organisms';
import { ListScreen, SCREEN_PADDING } from '@templates';

import { ROUTES } from '../../constants/routes';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  createTaskComment,
  getProjectMembers,
  getTask,
  getTaskComments,
  moveTask,
  updateTask,
} from '../../services/projectManagementService';
import type {
  PMProjectMember,
  PMTask,
  PMTaskComment,
  TaskStatus,
} from '../../types/projectManagement';
import { color, radius, space } from '../../theme/tokens';
import PMMentionInput from './components/PMMentionInput';
import { htmlToMarkdown, parseMentionSegments } from './pmText';
import { BOARD_COLUMN_ORDER, TASK_PRIORITY, TASK_STATUS, TASK_TYPE, i18nKey } from './pmStatus';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRoute = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.PM_TASK_DETAIL>;

const formatDateTime = (value?: string): string => {
  if (!value) return '';
  const [datePart, timePart = ''] = value.split(' ');
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}${timePart ? ` ${timePart.slice(0, 5)}` : ''}`;
};

/** Bình luận: mention hiện đậm, phần còn lại là chữ thường. */
const CommentBody: React.FC<{ text: string }> = ({ text }) => (
  <AppText variant="body">
    {parseMentionSegments(text).map((seg, i) =>
      seg.type === 'mention' ? (
        <AppText key={i} variant="body" tone="brandSecondary">
          @{seg.text}
        </AppText>
      ) : (
        <AppText key={i} variant="body">
          {seg.text}
        </AppText>
      )
    )}
  </AppText>
);

/**
 * Chi tiết công việc — màn đích của phần lớn thông báo PM.
 *
 * Nhận `taskId` qua route nên deep-link từ push vào thẳng được, kể cả với
 * SUBTASK (subtask không nằm trên bảng vì `get_board_tasks` lọc
 * `parent_task_id` rỗng).
 */
const PMTaskDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<ScreenRoute>();
  const { t } = useTranslation();
  const sheet = useSheetQueue<'status'>();

  const taskId = route.params?.taskId ?? '';
  const [task, setTask] = useState<PMTask | null>(null);
  const [comments, setComments] = useState<PMTaskComment[]>([]);
  const [members, setMembers] = useState<PMProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadComments = useCallback(async (id: string) => {
    const res = await getTaskComments(id);
    if (mounted.current && res.success) setComments(res.data ?? []);
  }, []);

  const load = useCallback(async () => {
    if (!taskId) {
      setError('Thiếu mã công việc');
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await getTask(taskId);
    if (!mounted.current) return;

    if (!res.success || !res.data) {
      setError(res.message ?? 'Không tải được công việc');
      setLoading(false);
      return;
    }
    setTask(res.data);
    setError(null);
    setLoading(false);

    // Bình luận và thành viên chỉ phụ trợ — tải sau, hỏng cũng không chặn màn.
    loadComments(taskId);
    if (res.data.project_id) {
      const mem = await getProjectMembers(res.data.project_id);
      if (mounted.current && mem.success) setMembers(mem.data ?? []);
    }
  }, [taskId, loadComments]);

  useEffect(() => {
    load();
  }, [load]);

  const descriptionMd = useMemo(
    () => (task?.description ? htmlToMarkdown(task.description) : ''),
    [task?.description]
  );

  const changeStatus = useCallback(
    async (to: TaskStatus) => {
      sheet.close();
      if (!task || to === task.status) return;

      // `moveTask` chứ không phải `updateTask({status})`: chỉ nó phân biệt được
      // đổi cột với sắp xếp lại, nên chỉ nó bắn đúng một thông báo.
      const res = await moveTask({
        task_id: task.name,
        from_status: task.status,
        to_status: to,
        new_order_index: 0,
      });
      if (!mounted.current) return;
      if (res.success) setTask((prev) => (prev ? { ...prev, status: to } : prev));
      else
        Alert.alert(
          t('common.error', 'Đã có lỗi'),
          res.message ?? t('common.try_again', 'Vui lòng thử lại')
        );
    },
    [task, sheet, t]
  );

  const toggleSubtask = useCallback(
    async (subtask: PMTask) => {
      const to: TaskStatus = subtask.status === 'done' ? 'todo' : 'done';
      const res = await updateTask(subtask.name, { status: to });
      if (!mounted.current) return;
      if (res.success) load();
      else
        Alert.alert(
          t('common.error', 'Đã có lỗi'),
          res.message ?? t('common.try_again', 'Vui lòng thử lại')
        );
    },
    [load, t]
  );

  const submitComment = useCallback(
    async (text: string) => {
      if (!task) return;
      setSending(true);
      const res = await createTaskComment(task.name, text);
      if (!mounted.current) return;
      setSending(false);
      if (res.success) loadComments(task.name);
      else
        Alert.alert(
          t('common.error', 'Đã có lỗi'),
          res.message ?? t('common.try_again', 'Vui lòng thử lại')
        );
    },
    [task, loadComments, t]
  );

  if (loading) {
    return (
      <ListScreen header={{ title: t('project_management.cong_viec_ct', 'Công việc'), onBack: () => navigation.goBack() }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner />
        </View>
      </ListScreen>
    );
  }

  if (error || !task) {
    return (
      <ListScreen header={{ title: t('project_management.cong_viec_ct', 'Công việc'), onBack: () => navigation.goBack() }}>
        <EmptyState
          icon="alert-circle"
          title={t('common.error', 'Đã có lỗi')}
          description={error ?? undefined}
          actionLabel={t('common.retry', 'Thử lại')}
          onAction={load}
        />
      </ListScreen>
    );
  }

  const subtasks = task.subtasks ?? [];

  return (
    <ListScreen
      header={{
        title: task.name,
        subtitle: task.project_title || undefined,
        onBack: () => navigation.goBack(),
      }}
      overlays={
        <AppSheet
          visible={sheet.isOpen('status')}
          onClose={sheet.close}
          onClosed={sheet.handleClosed}
          title={t('project_management.chuyen_cot', 'Chuyển cột')}>
          <View style={{ gap: space[4] }}>
            {BOARD_COLUMN_ORDER.map((s) => (
              <View
                key={s}
                style={{
                  borderRadius: radius[12],
                  backgroundColor: task.status === s ? color.surface.subtle : 'transparent',
                }}>
                <ButtonGhost
                  label={t(i18nKey.taskStatus(s), TASK_STATUS[s]?.label ?? s)}
                  block
                  onPress={() => changeStatus(s)}
                />
              </View>
            ))}
          </View>
        </AppSheet>
      }>
      <ScrollView
        contentContainerStyle={{ padding: SCREEN_PADDING, gap: space[12], paddingBottom: space[32] }}
        keyboardShouldPersistTaps="handled">
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6] }}>
            <StatusBadge status={task.type} map={TASK_TYPE} />
            <StatusBadge status={task.priority} map={TASK_PRIORITY} dot />
          </View>
          <AppText variant="title3" style={{ marginTop: space[8] }}>
            {task.title}
          </AppText>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8], marginTop: space[12] }}>
            <StatusBadge status={task.status} map={TASK_STATUS} fill="solid" />
            <ButtonGhost
              label={t('project_management.doi_trang_thai', 'Đổi trạng thái')}
              size="sm"
              onPress={() => sheet.open('status')}
            />
          </View>

          {task.parent_task_id ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], marginTop: space[10] }}>
              <Icon name="corner-up-left" size={13} tone="description" />
              <AppText variant="caption" tone="description" numberOfLines={1}>
                {t('project_management.thuoc_task', 'Thuộc')}: {task.parent_title || task.parent_task_id}
              </AppText>
            </View>
          ) : null}
        </Card>

        <SectionCard title={t('project_management.thong_tin', 'Thông tin')}>
          <InfoLine label={t('project_management.nguoi_thuc_hien', 'Người thực hiện')}>
            {task.assignees?.length ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6], flexWrap: 'wrap' }}>
                {task.assignees.map((a) => (
                  <View key={a.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
                    <Avatar uri={a.user_image} name={a.full_name || a.user_id} size="sm" />
                    <AppText variant="footnote">{a.full_name || a.user_id}</AppText>
                  </View>
                ))}
              </View>
            ) : (
              <AppText variant="footnote" tone="description">
                {t('project_management.chua_giao', 'Chưa giao')}
              </AppText>
            )}
          </InfoLine>

          <InfoLine label={t('project_management.han', 'Hạn')}>
            <AppText variant="footnote" tone={task.due_date ? 'default' : 'description'}>
              {task.due_date ? formatDateTime(task.due_date) : t('project_management.khong_co_han', 'Không có hạn')}
            </AppText>
          </InfoLine>

          <InfoLine label={t('project_management.nguoi_bao_cao', 'Người báo cáo')}>
            <AppText variant="footnote">
              {task.created_by_full_name || task.created_by || '—'}
            </AppText>
          </InfoLine>

          {task.requirement_title ? (
            <InfoLine label={t('project_management.thuoc_yeu_cau', 'Thuộc yêu cầu')}>
              <AppText variant="footnote" numberOfLines={2}>
                {task.requirement_title}
              </AppText>
            </InfoLine>
          ) : null}
        </SectionCard>

        {descriptionMd ? (
          <SectionCard title={t('project_management.mo_ta', 'Mô tả')}>
            {/* Mô tả là HTML từ trình soạn thảo web → đổi sang Markdown rồi render.
                Xem lý do không nhúng WebView ở `pmText.htmlToMarkdown`. */}
            <Markdown
              style={{
                body: { color: color.content.DEFAULT },
                heading1: { color: color.content.emphasized },
                heading2: { color: color.content.emphasized },
                link: { color: color.brand.DEFAULT },
                code_inline: { backgroundColor: color.surface.subtle },
                fence: { backgroundColor: color.surface.subtle },
              }}>
              {descriptionMd}
            </Markdown>
          </SectionCard>
        ) : null}

        {subtasks.length > 0 ? (
          <SectionCard
            title={`${t('project_management.viec_con', 'Việc con')} (${task.subtask_done_count ?? 0}/${subtasks.length})`}>
            {subtasks.map((sub, i) => (
              <View key={sub.name}>
                {i > 0 ? <Divider /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8], paddingVertical: space[8] }}>
                  <Icon
                    name={sub.status === 'done' ? 'check-square' : 'square'}
                    size={18}
                    tone={sub.status === 'done' ? 'success' : 'description'}
                  />
                  <AppText
                    variant="footnote"
                    tone={sub.status === 'done' ? 'description' : 'default'}
                    style={{ flex: 1 }}
                    numberOfLines={2}
                    onPress={() => toggleSubtask(sub)}>
                    {sub.title}
                  </AppText>
                </View>
              </View>
            ))}
          </SectionCard>
        ) : null}

        <SectionCard title={`${t('project_management.binh_luan', 'Bình luận')} (${comments.length})`}>
          {comments.length === 0 ? (
            <AppText variant="footnote" tone="description">
              {t('project_management.chua_co_binh_luan', 'Chưa có bình luận nào')}
            </AppText>
          ) : (
            comments.map((c, i) => (
              <View key={c.name}>
                {i > 0 ? <Divider /> : null}
                <View style={{ paddingVertical: space[8], gap: space[4] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6] }}>
                    <Avatar uri={c.created_by_image} name={c.created_by_full_name || c.created_by} size="sm" />
                    <AppText variant="footnote" tone="emphasized" style={{ flex: 1 }} numberOfLines={1}>
                      {c.created_by_full_name || c.created_by}
                    </AppText>
                    <AppText variant="caption" tone="description">
                      {formatDateTime(c.creation_date || c.creation)}
                    </AppText>
                  </View>
                  <CommentBody text={c.comment_text} />
                </View>
              </View>
            ))
          )}

          <View style={{ marginTop: space[10] }}>
            <PMMentionInput members={members} onSubmit={submitComment} sending={sending} />
          </View>
        </SectionCard>
      </ScrollView>
    </ListScreen>
  );
};

/** Một dòng nhãn – giá trị trong thẻ thông tin. */
const InfoLine: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={{ paddingVertical: space[6], gap: space[4] }}>
    <AppText variant="caption" tone="description">
      {label}
    </AppText>
    {children}
  </View>
);

export default PMTaskDetailScreen;
