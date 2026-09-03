import React, { forwardRef } from 'react';
import { TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { color, layout, radius, space, typography } from '../../../../theme/tokens';
import Icon, { type IconSet } from '../media/Icon';

/**
 * Ô nhập một dòng. Thay cho `TextInput` trần (hiện 72 file dùng thẳng).
 *
 * Khác web: không có focus-ring của trình duyệt. Trạng thái focus thể hiện bằng
 * đổi màu viền, nên component phải tự giữ state focus.
 *
 * Nền `surface.subtle` — ô nhập nằm BÊN TRONG thẻ trắng nên phải tối hơn thẻ một bậc.
 */

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Icon đầu ô (vd kính lúp cho ô tìm kiếm). */
  leadingIcon?: string;
  leadingIconSet?: IconSet;
  /** Nút/nội dung cuối ô — vd nút xoá, nút mở bộ lọc. */
  trailing?: React.ReactNode;
  /** `pill` cho ô tìm kiếm, `rounded` cho ô trong biểu mẫu. */
  shape?: 'pill' | 'rounded';
  invalid?: boolean;
  containerStyle?: ViewStyle;
  /**
   * Khai báo tường minh thay vì để kế thừa từ `TextInputProps` — kiểu của
   * `react-native` không resolve được trong repo này (933 lỗi baseline), nên
   * `Omit<TextInputProps, …>` đánh rơi mất hai prop này.
   */
  onFocus?: TextInputProps['onFocus'];
  onBlur?: TextInputProps['onBlur'];
}

const TextField = forwardRef<TextInput, TextFieldProps>(
  (
    { leadingIcon, leadingIconSet = 'auto', trailing, shape = 'rounded', invalid, containerStyle, onFocus, onBlur, ...rest },
    ref
  ) => {
    const [focused, setFocused] = React.useState(false);

    const borderColor = invalid
      ? color.danger.DEFAULT
      : focused
        ? color.brand.DEFAULT
        : 'transparent';

    return (
      <View
        style={[
          {
            minHeight: layout.controlHeight,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[8],
            paddingHorizontal: space[16],
            borderRadius: shape === 'pill' ? radius.full : radius[14],
            backgroundColor: color.surface.subtle,
            borderWidth: 1,
            borderColor,
          },
          containerStyle,
        ]}>
        {leadingIcon ? (
          <Icon name={leadingIcon} set={leadingIconSet} size={20} tone="description" />
        ) : null}

        <TextInput
          ref={ref}
          placeholderTextColor={color.content.disabled}
          style={[
            typography.body,
            { flex: 1, color: color.content.DEFAULT, paddingVertical: space[8] },
          ]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {trailing}
      </View>
    );
  }
);

TextField.displayName = 'TextField';

export default TextField;
