/**
 * Header dùng chung cho các bottom sheet.
 *
 * Khuôn lấy nguyên từ sheet "Tạo bình chọn" — mỗi sheet trước đây tự dựng header nên padding trên
 * lệch nhau (4px, 14px, có cái không có), nhìn dính sát mép sheet. Gom về một chỗ để không lệch nữa:
 * pt-5 cho thoáng mép trên, icon 18 màu nhấn, tiêu đề 18 đậm, phụ đề 11, nút đóng bên phải.
 *
 * Sheet cần phần dẫn khác icon (avatar thành viên) thì truyền `leading`; cần thêm hàng phụ dưới
 * tiêu đề (pill vai trò) thì truyền `children`.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

export function SheetHeader({
  title,
  subtitle,
  icon,
  iconColor = '#6B7280',
  leading,
  children,
  closeLabel,
  onClose,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  /** Node thay chỗ icon — dùng cho avatar, để tránh dựng lại cả header. */
  leading?: React.ReactNode;
  /** Hàng phụ dưới tiêu đề khi một dòng chữ là không đủ. */
  children?: React.ReactNode;
  closeLabel?: string;
  onClose: () => void;
}) {
  return (
    <View
      className="flex-row items-center px-4 pb-3 pt-5"
      // Avatar to hơn icon nên cần khoảng thở rộng hơn một nhịp.
      style={{ gap: leading ? 12 : 8 }}>
      {leading ?? (icon ? <Ionicons name={icon} size={18} color={iconColor} /> : null)}
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-mulish-bold text-lg text-gray-900">
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            className="mt-0.5 font-mulish-medium text-[11px] text-gray-500">
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
      <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={closeLabel}>
        <Ionicons name="close" size={22} color="#6B7280" />
      </Pressable>
    </View>
  );
}

export default SheetHeader;
