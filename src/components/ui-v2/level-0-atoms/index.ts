/**
 * L0 — ATOMS
 *
 * Primitive UI. Không biết nghiệp vụ, không import từ level cao hơn.
 * Consumer luôn import từ đây (`@atoms`), không đi thẳng vào file bên trong —
 * đổi cấu trúc thư mục chỉ phải sửa file này.
 */

// text
export { default as AppText } from './text/AppText';
export type { AppTextProps, AppTextTone } from './text/AppText';

// buttons
export {
  default as Button,
  ButtonPrimary,
  ButtonSecondary,
  ButtonDanger,
  ButtonGhost,
  IconButton,
} from './buttons/Button';
export type { ButtonProps, ButtonVariant, ButtonSize, IconButtonProps } from './buttons/Button';

// inputs
export { default as TextField } from './inputs/TextField';
export type { TextFieldProps } from './inputs/TextField';

// media
export { default as Icon } from './media/Icon';
export type { IconProps, IconSet, IconTone } from './media/Icon';
export { default as Card } from './media/Card';
export type { CardProps } from './media/Card';
export { default as Avatar } from './media/Avatar';
export type { AvatarProps } from './media/Avatar';
export { default as Divider } from './media/Divider';
export type { DividerProps } from './media/Divider';

// feedback
export { default as Spinner } from './feedback/Spinner';
export type { SpinnerProps } from './feedback/Spinner';
export { default as Badge } from './feedback/Badge';
export type { BadgeProps, BadgeTone } from './feedback/Badge';
export { default as ProgressBar } from './feedback/ProgressBar';
export type { ProgressBarProps } from './feedback/ProgressBar';
