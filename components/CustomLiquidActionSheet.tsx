import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from 'react-native';

const { height, width } = Dimensions.get('window');

const GlassPanel = ({ width, height }: any) => (
  <View
    style={{
      width,
      height,
      position: 'absolute',
      backgroundColor: 'rgba(255,255,255,0.25)',
      borderRadius: 26,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    }}
  />
);

interface Props {
  visible: boolean;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
  onCancel: () => void;
}

const LiquidActionSheet: React.FC<Props> = ({ visible, options, onSelect, onCancel }) => {
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      // Reset về vị trí bottom và bắt đầu animation ngay lập tức
      slideAnim.setValue(height);
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate ra ngoài màn hình
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" key={visible ? 'visible' : 'hidden'}>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: slideAnim.interpolate({
            inputRange: [0, height],
            outputRange: ['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)'],
          }),
          justifyContent: 'flex-end',
        }}>
        {/* BACKDROP CLICK */}
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        </TouchableWithoutFeedback>

        {/* SLIDING SHEET */}
        <Animated.View
          style={{
            transform: [{ translateY: slideAnim }],
            paddingBottom: 32,
          }}>
          {/* MAIN SHEET */}
          <View
            style={{
              marginHorizontal: 14,
              borderRadius: 26,
              overflow: 'hidden',
              marginBottom: 14,
              backgroundColor: 'rgba(255,255,255)',
            }}>
            <GlassPanel width={width - 28} height={options.length * 60 + 20} />
            {options.map((op, index) => (
              <View key={op.value}>
                <TouchableOpacity
                  onPress={() => onSelect(op.value)}
                  style={{ paddingVertical: 16 }}>
                  <Text
                    style={{
                      textAlign: 'center',
                      fontSize: 18,
                      color: '#002855',
                      fontWeight: '400',
                    }}>
                    {op.label}
                  </Text>
                </TouchableOpacity>
                {index < options.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: 'rgba(0,0,0,0.08)',
                      marginHorizontal: 16,
                    }}
                  />
                )}
              </View>
            ))}
          </View>

          {/* CANCEL BUTTON */}
          <View
            style={{
              marginHorizontal: 14,
              borderRadius: 26,
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255)',
            }}>
            <GlassPanel width={width - 28} height={60} />
            <TouchableOpacity onPress={onCancel} style={{ paddingVertical: 16 }}>
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: 18,
                  fontWeight: '500',
                  color: '#FF3B30',
                }}>
                Hủy
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default LiquidActionSheet;
