import React from 'react';
import {
  TouchableOpacity as RNTouchableOpacity,
  TouchableOpacityProps as RNTouchableOpacityProps,
  GestureResponderEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';

export interface TouchableOpacityProps extends Omit<RNTouchableOpacityProps, 'style'> {
  children?: React.ReactNode;
  activeOpacity?: number;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
  delayPressIn?: number;
  delayPressOut?: number;
  delayLongPress?: number;
}

/**
 * Custom TouchableOpacity wrapper với activeOpacity mặc định = 0.8
 * Giảm thiểu hiệu ứng mờ khi nhấn để cải thiện UX
 */
const TouchableOpacity: React.FC<TouchableOpacityProps> = ({
  activeOpacity = 0.8,
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  className,
  delayPressIn,
  delayPressOut,
  delayLongPress,
  ...props
}) => {
  return (
    <RNTouchableOpacity
      activeOpacity={activeOpacity}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={style}
      className={className}
      delayPressIn={delayPressIn}
      delayPressOut={delayPressOut}
      delayLongPress={delayLongPress}
      {...props}>
      {children}
    </RNTouchableOpacity>
  );
};

export default TouchableOpacity;

