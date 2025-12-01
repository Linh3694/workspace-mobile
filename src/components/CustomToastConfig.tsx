import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

// Custom toast component với icon và blur background
const CustomToast = ({ 
  text1,
  iconName,
  iconColor,
}: {
  text1?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}) => {
  return (
    <View style={styles.wrapper}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint="light" style={styles.container}>
          <View style={styles.content}>
            <Ionicons name={iconName} size={18} color={iconColor} style={styles.icon} />
            <Text style={styles.text} numberOfLines={2}>
              {text1}
            </Text>
          </View>
        </BlurView>
      ) : (
        <View style={[styles.container, styles.androidContainer]}>
          <View style={styles.content}>
            <Ionicons name={iconName} size={18} color={iconColor} style={styles.icon} />
            <Text style={styles.text} numberOfLines={2}>
              {text1}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const CustomToastConfig = {
  success: (props: any) => (
    <CustomToast
      text1={props.text1}
      iconName="checkmark-circle"
      iconColor="#16a34a"
    />
  ),
  error: (props: any) => (
    <CustomToast
      text1={props.text1}
      iconName="close-circle"
      iconColor="#dc2626"
    />
  ),
  info: (props: any) => (
    <CustomToast
      text1={props.text1}
      iconName="information-circle"
      iconColor="#0284c7"
    />
  ),
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: '100%',
  },
  container: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    maxWidth: 320,
  },
  androidContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
  },
});

export default CustomToastConfig;
