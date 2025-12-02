import React from 'react';
// @ts-ignore
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StandardHeaderProps {
  logo: React.ReactNode;
  rightButton?: React.ReactNode;
}

const StandardHeader: React.FC<StandardHeaderProps> = ({ logo, rightButton }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-b border-gray-100 bg-white"
      style={{
        paddingTop: insets.top,
      }}>
      <View className="min-h-[60px] flex-row items-center justify-between px-4 py-3">
        <View className="flex-1">{logo}</View>
        {rightButton && <View className="ml-3">{rightButton}</View>}
      </View>
    </View>
  );
};

export default StandardHeader; 