import React, { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, ButtonPrimary } from '@atoms';
import { FilterChipRow, type FilterChipItem } from '@molecules';
import { AppSheet } from '@organisms';

import { createTask } from '../../../services/projectManagementService';
import type { TaskPriority, TaskStatus, TaskType } from '../../../types/projectManagement';
import { TASK_TYPES } from '../../../types/projectManagement';
import { color, radius, space } from '../../../theme/tokens';
import { TASK_PRIORITY, TASK_STATUS, TASK_TYPE, i18nKey } from '../pmStatus';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

export interface PMAddTaskSheetProps {
  visible: boolean;
  projectId: string;
  /** Cột bấm nút "Thêm" — task tạo ra nằm luôn ở cột đó. */
  status: TaskStatus;
  onClose: () => void;
  onClosed: () => void;
  onCreated: () => void;
}

/**
 * Tạo nhanh một công việc từ bảng.
 *
 * Cố ý CHỈ có tiêu đề, loại, độ ưu tiên: mô tả, người thực hiện, hạn, việc con
 * đều sửa được ở màn chi tiết ngay sau đó. Bắt điền đủ mọi thứ trên một sheet
 * điện thoại là cách chắc chắn để không ai tạo task trên app.
 *
 * `status` lấy từ cột đang đứng — người dùng bấm "Thêm" ở cột nào thì task rơi
 * vào đúng cột đó, không phải kéo lại.
 */
const PMAddTaskSheet: React.FC<PMAddTaskSheetProps> = ({
  visible,
  projectId,
  status,
  onClose,
  onClosed,
  onCreated,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mỗi lần mở lại là một task mới — giữ lại nội dung cũ sẽ tạo nhầm bản sao.
  useEffect(() => {
    if (visible) {
      setTitle('');
      setType('task');
      setPriority('medium');
      setError(null);
    }
  }, [visible]);

  const typeChips: FilterChipItem<TaskType>[] = TASK_TYPES.map((x) => ({
    value: x,
    label: t(i18nKey.taskType(x), TASK_TYPE[x]?.label ?? x),
  }));

  const priorityChips: FilterChipItem<TaskPriority>[] = PRIORITIES.map((x) => ({
    value: x,
    label: t(i18nKey.priority(x), TASK_PRIORITY[x]?.label ?? x),
  }));

  const submit = useCallback(async () => {
    const name = title.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(null);

    const res = await createTask({ project_id: projectId, title: name, type, priority, status });
    setSaving(false);

    if (res.success) {
      onCreated();
      onClose();
    } else {
      setError(res.message ?? t('common.try_again', 'Vui lòng thử lại'));
    }
  }, [title, saving, projectId, type, priority, status, onCreated, onClose, t]);

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      keyboardAvoiding
      title={`${t('project_management.them_cong_viec', 'Thêm công việc')} · ${t(
        i18nKey.taskStatus(status),
        TASK_STATUS[status]?.label ?? status
      )}`}
      footer={
        <ButtonPrimary
          label={t('common.create', 'Tạo')}
          block
          loading={saving}
          onPress={submit}
        />
      }>
      <View style={{ gap: space[12] }}>
        <View
          style={{
            borderWidth: 1,
            borderColor: color.line.subtle,
            borderRadius: radius[12],
            backgroundColor: color.surface.DEFAULT,
            paddingHorizontal: space[12],
            paddingVertical: space[10],
          }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('project_management.tieu_de_cong_viec', 'Tiêu đề công việc')}
            placeholderTextColor={color.content.disabled}
            multiline
            autoFocus
            style={{ color: color.content.DEFAULT, maxHeight: 96, padding: 0 }}
          />
        </View>

        <View style={{ gap: space[6] }}>
          <AppText variant="caption" tone="description">
            {t('project_management.loai', 'Loại')}
          </AppText>
          <FilterChipRow<TaskType>
            items={typeChips}
            value={type}
            onChange={setType}
            edgePadding={0}
          />
        </View>

        <View style={{ gap: space[6] }}>
          <AppText variant="caption" tone="description">
            {t('project_management.uu_tien', 'Độ ưu tiên')}
          </AppText>
          <FilterChipRow<TaskPriority>
            items={priorityChips}
            value={priority}
            onChange={setPriority}
            edgePadding={0}
          />
        </View>

        {error ? (
          <AppText variant="footnote" tone="danger">
            {error}
          </AppText>
        ) : null}
      </View>
    </AppSheet>
  );
};

export default PMAddTaskSheet;
