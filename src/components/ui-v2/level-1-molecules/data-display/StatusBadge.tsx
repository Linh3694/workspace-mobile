import React from 'react';

import { Badge, type BadgeTone } from '../../level-0-atoms';

/**
 * Nhãn trạng thái.
 *
 * Hiện có **19 file** tự map trạng thái → màu, mỗi nơi một bảng khác nhau: cùng một
 * "đang xử lý" mà màn này cam, màn kia vàng. Molecule này không xoá được sự khác
 * nhau đó (mỗi nghiệp vụ có tập trạng thái riêng) nhưng ép tất cả đi qua **một
 * hình dạng bảng tra duy nhất**, và ép màu phải là token chứ không phải hex.
 *
 * Bảng tra là dữ liệu NGHIỆP VỤ nên do màn hình truyền vào — molecule không được
 * biết "Active" hay "Broken" là gì (quy tắc: L1 chưa biết nghiệp vụ).
 *
 * @example
 * const DEVICE_STATUS: StatusMap = {
 *   Active:   { label: 'Đang sử dụng', tone: 'success' },
 *   Broken:   { label: 'Hỏng',         tone: 'danger'  },
 * };
 * <StatusBadge status={device.status} map={DEVICE_STATUS} />
 */

export interface StatusDescriptor {
  label: string;
  tone: BadgeTone;
}

export type StatusMap = Record<string, StatusDescriptor>;

/** Dùng khi trạng thái không có trong bảng tra — không bao giờ để vỡ giao diện. */
export const UNKNOWN_STATUS: StatusDescriptor = { label: 'Không xác định', tone: 'neutral' };

export const resolveStatus = (status: string | null | undefined, map: StatusMap): StatusDescriptor =>
  (status ? map[status] : undefined) ?? UNKNOWN_STATUS;

export interface StatusBadgeProps {
  status: string | null | undefined;
  map: StatusMap;
  fill?: 'soft' | 'solid';
  dot?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, map, fill = 'soft', dot = true }) => {
  const { label, tone } = resolveStatus(status, map);
  return <Badge label={label} tone={tone} fill={fill} dot={dot} />;
};

export default StatusBadge;
