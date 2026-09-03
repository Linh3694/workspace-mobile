import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { color } from '../../../../theme/tokens';
import { ICON_V2, type IconV2Name } from './iconRegistry';

/**
 * Icon — một cửa duy nhất để lấy icon.
 *
 * Ưu tiên **bộ icon-v2 dùng chung với web** (134 icon Iconly, đồng bộ bằng
 * `node scripts/sync-icons-from-web.mjs`). Tên nào không có trong bộ đó thì rơi
 * về `Ionicons` / `MaterialCommunityIcons` — để những màn V1 chưa migrate và các
 * icon nghiệp vụ lẻ vẫn chạy trong lúc chuyển dần.
 *
 * Khác web: web tô màu bằng `filter` CSS trên thẻ `<img>`; RN không có filter đó
 * nên SVG được chuẩn hoá sang `currentColor` và tô bằng prop `color` — kết quả
 * thị giác như nhau vì filter của web vốn cũng cho ra ảnh đơn sắc.
 *
 * @example
 * <Icon name="search" />                       // icon-v2, tone mặc định
 * <Icon name="laptop" size={24} tone="brand" />
 * <Icon name="chevron-back" set="ion" />       // fallback Ionicons
 */

export type IconSet = 'auto' | 'ion' | 'mci';

export type IconTone =
  | 'default'
  | 'description'
  | 'disabled'
  | 'inverse'
  | 'brand'
  | 'brandSecondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info';

const TONE_COLOR: Record<IconTone, string> = {
  default: color.content.emphasized,
  description: color.content.description,
  disabled: color.content.disabled,
  inverse: color.content.inverse,
  brand: color.brand.DEFAULT,
  brandSecondary: color.brandSecondary.DEFAULT,
  success: color.success.DEFAULT,
  danger: color.danger.DEFAULT,
  warning: color.warning.DEFAULT,
  info: color.info.DEFAULT,
};

export interface IconProps {
  /** Tên trong bộ icon-v2, hoặc tên của Ionicons / MaterialCommunityIcons. */
  name: IconV2Name | (string & {});
  /**
   * `auto` (mặc định) — tra bộ icon-v2 trước, không có thì dùng Ionicons.
   * `ion` / `mci` — ép dùng bộ font tương ứng, bỏ qua icon-v2.
   */
  set?: IconSet;
  size?: number;
  tone?: IconTone;
  /**
   * Màu thô — CHỈ dùng khi màu đến từ dữ liệu lúc chạy (vd màu tra từ bảng
   * trạng thái). Đừng truyền hex viết tay; dùng `tone`.
   */
  colorOverride?: string;
}

const Icon: React.FC<IconProps> = ({
  name,
  set = 'auto',
  size = 20,
  tone = 'default',
  colorOverride,
}) => {
  const resolved = colorOverride ?? TONE_COLOR[tone];

  if (set === 'auto') {
    const SvgIcon = ICON_V2[name as IconV2Name];
    if (SvgIcon) return <SvgIcon width={size} height={size} color={resolved} />;
  }

  const Component = set === 'mci' ? MaterialCommunityIcons : Ionicons;
  return <Component name={name as never} size={size} color={resolved} />;
};

export default Icon;
