// @ts-nocheck
import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export interface ActionSheetOption {
  label: string;
  value: string;
  color?: string;
}

interface ActionSheetProps {
  visible: boolean;
  options: ActionSheetOption[];
  onSelect: (value: string) => void;
  onCancel: () => void;
  cancelText?: string;
  title?: string;
}

const ActionSheet: React.FC<ActionSheetProps> = ({
  visible,
  options,
  onSelect,
  onCancel,
  cancelText = 'Hủy',
  title,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        {/* Backdrop - Ấn để đóng */}
        <Pressable style={styles.backdrop} onPress={onCancel} />

        {/* ActionSheet container */}
        <View style={styles.sheetContainer}>
          {/* Main options */}
          <View style={styles.optionsContainer}>
            {title && (
              <View style={styles.titleContainer}>
                <Text style={styles.titleText}>{title}</Text>
              </View>
            )}
            
            {options.map((option, index) => (
              <View key={option.value}>
                <TouchableOpacity
                  onPress={() => onSelect(option.value)}
                  activeOpacity={0.5}
                  style={styles.optionButton}
                >
                  <Text
                    style={[
                      styles.optionText,
                      option.color && { color: option.color },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
                {index < options.length - 1 && <View style={styles.separator} />}
              </View>
            ))}
          </View>

          {/* Cancel button */}
          <View style={styles.cancelContainer}>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.5}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheetContainer: {
    paddingHorizontal: 10,
    paddingBottom: 34,
  },
  optionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  titleContainer: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  titleText: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },
  optionButton: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  optionText: {
    fontSize: 18,
    color: '#002855',
    textAlign: 'center',
    fontWeight: '400',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  cancelContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  cancelButton: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  cancelText: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default ActionSheet;

