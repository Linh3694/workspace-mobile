/**
 * L1 — MOLECULES
 *
 * Ghép từ atom. Vẫn chưa biết nghiệp vụ: dữ liệu nghiệp vụ (bảng tra trạng thái,
 * danh sách lựa chọn…) do màn hình truyền vào qua prop.
 *
 * Chỉ được import từ `@atoms` và cùng level.
 */

// rows
export { default as ListRow } from './rows/ListRow';
export type { ListRowProps } from './rows/ListRow';

// fields
export { default as FormField } from './fields/FormField';
export type { FormFieldProps } from './fields/FormField';

// controls
export { default as SearchBar } from './controls/SearchBar';
export type { SearchBarProps } from './controls/SearchBar';
export { default as FilterChipRow } from './controls/FilterChipRow';
export type { FilterChipRowProps, FilterChipItem } from './controls/FilterChipRow';
export { SelectableChip, CheckRow } from './controls/SelectableChip';
export type { SelectableChipProps, CheckRowProps } from './controls/SelectableChip';

// data-display
export { default as StatusBadge, resolveStatus, UNKNOWN_STATUS } from './data-display/StatusBadge';
export type { StatusBadgeProps, StatusMap, StatusDescriptor } from './data-display/StatusBadge';
export { default as InlineAlert } from './data-display/InlineAlert';
export type { InlineAlertProps, InlineAlertTone } from './data-display/InlineAlert';
