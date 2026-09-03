import type { StatusMap } from '@molecules';
import type { DeviceType } from '../../types/devices';

/**
 * Bảng tra NGHIỆP VỤ của module Thiết bị: trạng thái → nhãn tiếng Việt + tone màu.
 *
 * Trước đây bảng này nằm rải trong `DevicesScreen.tsx` và `DevicesDetailScreen.tsx`
 * dưới dạng hai hàm `switch` trả hex — hai nơi, hai bộ màu. Gom về một chỗ để đổi
 * nhãn hay đổi màu chỉ sửa một lần.
 *
 * Tone là TOKEN, không phải hex — đổi bộ nhận diện thì màu trạng thái đi theo.
 */
export const DEVICE_STATUS: StatusMap = {
  Active: { label: 'Đang sử dụng', tone: 'success' },
  Standby: { label: 'Sẵn sàng', tone: 'info' },
  Broken: { label: 'Hỏng', tone: 'danger' },
  PendingDocumentation: { label: 'Chờ xử lý', tone: 'warning' },
};

export interface DeviceTypeOption {
  type: DeviceType;
  /** Tên icon trong bộ icon-v2 (dùng chung với web). */
  icon: string;
  label: string;
}

/**
 * Các nhóm thiết bị hiện lên dải chip lọc đầu màn.
 *
 * Icon lấy từ bộ icon-v2 dùng chung với web. Bộ này không có "máy chiếu" và
 * "hộp đồ nghề" nên dùng `tv` và `setting` — gần nghĩa nhất trong 134 icon hiện có.
 * Nếu sau này web bổ sung, chỉ cần chạy lại `scripts/sync-icons-from-web.mjs`.
 */
export const DEVICE_TYPES: DeviceTypeOption[] = [
  { type: 'laptop', icon: 'laptop', label: 'Laptop' },
  { type: 'monitor', icon: 'monitor', label: 'Màn hình' },
  { type: 'printer', icon: 'printer', label: 'Máy in' },
  { type: 'projector', icon: 'tv', label: 'Máy chiếu' },
  { type: 'phone', icon: 'smartphone', label: 'Điện thoại' },
  { type: 'tool', icon: 'setting', label: 'Công cụ' },
];

export const deviceTypeLabel = (type: DeviceType): string =>
  DEVICE_TYPES.find((item) => item.type === type)?.label ?? 'Thiết bị';

export const deviceTypeIcon = (type: DeviceType): string =>
  DEVICE_TYPES.find((item) => item.type === type)?.icon ?? 'monitor';

/**
 * Icon riêng cho từng máy, đoán từ tên/hãng. Giữ tinh thần của bản V1 (V1 dựng cả
 * bảng `deviceSubcategories` rồi chỉ dùng tới nhánh laptop) nhưng rút về bộ icon-v2.
 *
 * Khác V1: bỏ nhánh nhận diện Apple — bộ icon-v2 không có logo Apple, và một logo
 * hãng nằm lẫn giữa các icon nét mảnh trông cũng lạc quẻ. MacBook giờ dùng chung
 * icon `laptop`.
 */
export const deviceIcon = (
  device: { name?: string | null; manufacturer?: string | null },
  type: DeviceType
): string => {
  if (type !== 'laptop') return deviceTypeIcon(type);

  const haystack = `${device.manufacturer ?? ''} ${device.name ?? ''}`.toLowerCase();
  return haystack.includes('desktop') ? 'monitor' : 'laptop';
};

// ─────────────────────────────────────────────────────────────────────────────
// Dữ liệu biểu mẫu tạo thiết bị
//
// Bản V1 nhúng thẳng các ô này vào JSX trong một hàm `renderSpecFields()` dài với
// `switch` 4 nhánh. Tách ra thành dữ liệu để màn hình chỉ còn việc map — thêm loại
// thiết bị mới chỉ phải sửa ở đây, không phải sờ vào JSX.
// ─────────────────────────────────────────────────────────────────────────────

/** Phân loại con — chỉ laptop mới thật sự có nhiều hơn một lựa chọn. */
export const DEVICE_SUBTYPES: Record<DeviceType, { value: string; label: string }[]> = {
  laptop: [
    { value: 'Laptop', label: 'Laptop' },
    { value: 'Desktop', label: 'Desktop' },
  ],
  monitor: [{ value: 'Monitor', label: 'Màn hình' }],
  printer: [{ value: 'Printer', label: 'Máy in' }],
  projector: [{ value: 'Projector', label: 'Máy chiếu' }],
  phone: [{ value: 'Phone', label: 'Điện thoại' }],
  tool: [{ value: 'Tool', label: 'Công cụ' }],
};

export interface SpecFieldDef {
  /** Khoá trong `CreateDeviceData['specs']`. */
  key: string;
  label: string;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'numeric';
}

/** Ô thông số kỹ thuật riêng theo từng loại thiết bị. */
export const SPEC_FIELDS: Record<DeviceType, SpecFieldDef[]> = {
  laptop: [
    { key: 'processor', label: 'CPU', placeholder: 'VD: Intel Core i7-12700H' },
    { key: 'ram', label: 'RAM', placeholder: 'VD: 16GB DDR5' },
    { key: 'storage', label: 'Ổ cứng', placeholder: 'VD: 512GB SSD NVMe' },
    { key: 'display', label: 'Màn hình', placeholder: 'VD: 15.6 inch FHD' },
  ],
  monitor: [
    { key: 'display', label: 'Kích thước', placeholder: 'VD: 27 inch' },
    { key: 'resolution', label: 'Độ phân giải', placeholder: 'VD: 2560x1440 (2K)' },
  ],
  printer: [{ key: 'ip', label: 'Địa chỉ IP', placeholder: 'VD: 192.168.1.100' }],
  projector: [],
  phone: [
    { key: 'imei1', label: 'IMEI 1', placeholder: 'Nhập IMEI 1', keyboardType: 'number-pad' },
    { key: 'imei2', label: 'IMEI 2', placeholder: 'Nhập IMEI 2 (nếu có)', keyboardType: 'number-pad' },
    { key: 'phoneNumber', label: 'Số điện thoại', placeholder: 'VD: 0901234567', keyboardType: 'number-pad' },
  ],
  tool: [],
};
