import React from 'react';
import { View } from 'react-native';

import { TextField, IconButton, AppText } from '../../level-0-atoms';
import { color, space } from '../../../../theme/tokens';

/**
 * Ô tìm kiếm — dáng viên thuốc, có nút xoá và nút mở bộ lọc ở cuối ô.
 *
 * Dòng tóm tắt bộ lọc bên dưới cố ý là một phần của molecule này: người dùng cần
 * biết "đang lọc gì" ngay cạnh chỗ họ gõ, không phải mở lại sheet mới thấy.
 */

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Có bộ lọc đang áp dụng → nút lọc đổi màu, hiện dòng tóm tắt. */
  filterCount?: number;
  onOpenFilter?: () => void;
  /** Xoá cả từ khoá lẫn bộ lọc. */
  onClearAll?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder,
  filterCount = 0,
  onOpenFilter,
  onClearAll,
}) => {
  const hasQuery = value.trim().length > 0;
  const isFiltering = filterCount > 0 || hasQuery;

  return (
    <View style={{ gap: space[8] }}>
      <TextField
        shape="pill"
        leadingIcon="search"
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {hasQuery ? (
              <IconButton
                name="close"
                size={18}
                tone="description"
                accessibilityLabel="Xoá từ khoá"
                onPress={() => onChangeText('')}
                style={{ width: 32, height: 32 }}
              />
            ) : null}
            {onOpenFilter ? (
              <IconButton
                name="filter"
                size={20}
                tone={filterCount > 0 ? 'brand' : 'description'}
                accessibilityLabel="Mở bộ lọc"
                onPress={onOpenFilter}
                style={{ width: 32, height: 32 }}
              />
            ) : null}
          </View>
        }
      />

      {isFiltering && onClearAll ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <AppText variant="footnote" tone="brand">
            {filterCount > 0 ? `${filterCount} bộ lọc đang áp dụng` : 'Đang tìm theo từ khoá'}
          </AppText>
          <AppText
            variant="footnote"
            onPress={onClearAll}
            suppressHighlighting
            style={{ color: color.content.description }}>
            Xoá tất cả
          </AppText>
        </View>
      ) : null}
    </View>
  );
};

export default SearchBar;
