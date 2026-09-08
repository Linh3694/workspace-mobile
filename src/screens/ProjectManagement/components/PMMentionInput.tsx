import React, { useCallback, useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, ButtonPrimary, Card } from '@atoms';
import { ListRow } from '@molecules';

import type { PMProjectMember } from '../../../types/projectManagement';
import { color, radius, space } from '../../../theme/tokens';
import { formatMention } from '../pmText';

export interface PMMentionInputProps {
  members: PMProjectMember[];
  onSubmit: (text: string) => Promise<void> | void;
  sending?: boolean;
  placeholder?: string;
}

/** Ký tự trước con trỏ tính từ `@` gần nhất — dùng để bắt lúc người dùng đang gõ tên. */
const MENTION_TRIGGER = /@([^\s@[\]()]*)$/;

/**
 * Ô soạn bình luận có nhắc tên.
 *
 * Chèn mention dưới dạng `@[Tên hiển thị](email)` — đúng cú pháp
 * `MENTION_PATTERN` mà backend parse. Người dùng nhìn thấy chuỗi thô này trong
 * ô nhập; đổi lại, không phải dựng một trình soạn thảo rich-text chỉ để giấu nó,
 * và cái gì gửi đi thì cái đó hiện ra.
 *
 * Gợi ý CHỈ lấy từ thành viên dự án. Gõ tay một email ngoài dự án vẫn gửi được
 * nhưng server sẽ lặng lẽ bỏ qua khi đối chiếu — nên đừng để người dùng tự gõ.
 */
const PMMentionInput: React.FC<PMMentionInputProps> = ({
  members,
  onSubmit,
  sending = false,
  placeholder,
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [query, setQuery] = useState<string | null>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.trim().toLowerCase();
    const pool = members.filter((m) => m.user_id);
    if (!q) return pool.slice(0, 5);
    return pool
      .filter(
        (m) =>
          (m.full_name || '').toLowerCase().includes(q) ||
          (m.user_id || '').toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [members, query]);

  const handleChange = useCallback((next: string) => {
    setText(next);
    const upToCursor = next.slice(0, selectionRef.current.start + 1);
    const m = MENTION_TRIGGER.exec(upToCursor);
    setQuery(m ? m[1] : null);
  }, []);

  const insertMention = useCallback(
    (member: PMProjectMember) => {
      const cursor = selectionRef.current.start + 1;
      const head = text.slice(0, cursor);
      const tail = text.slice(cursor);
      // Thay đúng cụm "@abc" đang gõ dở, không đụng phần còn lại.
      const replaced = head.replace(
        MENTION_TRIGGER,
        `${formatMention(member.full_name || member.user_id, member.user_id)} `
      );
      setText(replaced + tail);
      setQuery(null);
    },
    [text]
  );

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    await onSubmit(body);
    setText('');
    setQuery(null);
  }, [text, sending, onSubmit]);

  return (
    <View style={{ gap: space[8] }}>
      {suggestions.length > 0 ? (
        <Card tone="subtle" padding={space[4]}>
          {suggestions.map((m) => (
            <ListRow
              key={m.user_id}
              title={m.full_name || m.user_id}
              subtitle={m.user_id}
              avatarUri={m.user_image}
              avatarName={m.full_name || m.user_id}
              onPress={() => insertMention(m)}
            />
          ))}
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[8] }}>
        <View
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: color.line.subtle,
            borderRadius: radius[12],
            backgroundColor: color.surface.DEFAULT,
            paddingHorizontal: space[10],
            paddingVertical: space[8],
          }}>
          <TextInput
            value={text}
            onChangeText={handleChange}
            onSelectionChange={(e) => {
              selectionRef.current = e.nativeEvent.selection;
            }}
            placeholder={placeholder ?? t('project_management.viet_binh_luan', 'Viết bình luận…')}
            placeholderTextColor={color.content.disabled}
            multiline
            style={{ color: color.content.DEFAULT, maxHeight: 120, padding: 0 }}
          />
        </View>
        <ButtonPrimary
          label={t('common.send', 'Gửi')}
          size="sm"
          loading={sending}
          onPress={send}
        />
      </View>

      {query !== null && suggestions.length === 0 ? (
        <AppText variant="caption" tone="description">
          {t('project_management.khong_tim_thay_thanh_vien', 'Không có thành viên nào khớp')}
        </AppText>
      ) : null}
    </View>
  );
};

export default PMMentionInput;
