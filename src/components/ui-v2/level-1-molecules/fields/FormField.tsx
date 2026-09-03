import React from 'react';
import { View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { AppText, TextField, type TextFieldProps } from '../../level-0-atoms';
import { color, space } from '../../../../theme/tokens';

/**
 * Một trường trong biểu mẫu: nhãn + dấu bắt buộc + ô nhập + dòng lỗi/gợi ý.
 *
 * Dấu `*` là một **node riêng** màu `danger`, không nối vào chuỗi nhãn — nhãn đi
 * qua i18n, mà nhét `*` vào bản dịch thì nó sẽ ăn màu chữ của nhãn (đen) và lọt
 * vào file locale của mọi ngôn ngữ. Cùng quy ước với web.
 */

export interface FormFieldProps extends Omit<TextFieldProps, 'invalid'> {
  label: string;
  required?: boolean;
  /** Có lỗi thì viền ô đỏ và hiện dòng này thay cho `hint`. */
  error?: string | null;
  /** Chú thích dưới ô, khi không có lỗi. */
  hint?: string;
  /** Ô nhập nhiều dòng. */
  multiline?: TextInputProps['multiline'];
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  error,
  hint,
  ...fieldProps
}) => (
  <View style={{ gap: space[6] }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <AppText variant="footnote" tone="description">
        {label}
      </AppText>
      {required ? (
        <AppText variant="footnote" style={{ color: color.danger.DEFAULT }}>
          *
        </AppText>
      ) : null}
    </View>

    <TextField invalid={!!error} {...fieldProps} />

    {error ? (
      <AppText variant="caption" style={{ color: color.danger.DEFAULT }}>
        {error}
      </AppText>
    ) : hint ? (
      <AppText variant="caption" tone="description">
        {hint}
      </AppText>
    ) : null}
  </View>
);

export default FormField;
