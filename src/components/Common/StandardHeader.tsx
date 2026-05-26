import React from 'react';
// @ts-ignore
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StandardHeaderProps {
  /** Cột trái (logo / branding) — dùng khi không có `center` */
  logo?: React.ReactNode;
  rightButton?: React.ReactNode;
  /** Nút trái (vd. back) — dùng cùng `center` để tiêu đề vào giữa */
  leftButton?: React.ReactNode;
  /** Nội dung căn giữa (vd. tiêu đề + badge dưới) */
  center?: React.ReactNode;
}

const StandardHeader: React.FC<StandardHeaderProps> = ({
  logo,
  rightButton,
  leftButton,
  center,
}) => {
  const insets = useSafeAreaInsets();
  const useThreeColumn = center != null || leftButton != null;

  return (
    <View
      className="border-b border-gray-100 bg-white"
      style={{
        paddingTop: insets.top,
      }}>
      {useThreeColumn ? (
        <View className="min-h-[76px] flex-row items-center justify-between px-3 py-2">
          {/* Cố định hai bên để khối giữa thật sự căn giữa màn hình */}
          <View className="w-11 shrink-0 items-start justify-center">
            {leftButton ?? <View className="h-11 w-11" />}
          </View>
          <View className="max-w-[100%] min-w-0 flex-1 flex-row items-center justify-center px-1">
            {center}
          </View>
          <View className="w-11 shrink-0 items-end justify-center">
            {rightButton ?? <View className="h-11 min-w-[24px]" />}
          </View>
        </View>
      ) : (
        <View className="min-h-[60px] flex-row items-center justify-between px-4 py-3">
          <View className="min-w-0 flex-1">{logo}</View>
          {rightButton && <View className="ml-3">{rightButton}</View>}
        </View>
      )}
    </View>
  );
};

export default StandardHeader; 