import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_HEIGHT = Dimensions.get('window').height;

/** Khi có bàn phím: chừa thêm phía trên để sheet không kéo cao full màn (gọn hơn) */
const KEYBOARD_SHEET_TOP_RESERVE = 150;

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPercent?: number;
  /** Khi true, content dùng height cố định thay vì maxHeight (cần cho form dùng flex-1) */
  fillHeight?: boolean;
  /** Bật thu nhỏ sheet khi bàn phím hiện (tránh tràn màn hình) - dùng cho modal có TextInput */
  keyboardAvoiding?: boolean;
  /** Px cộng thêm sau safe-area đáy; sheet ít nút nên dùng 6–10 để khỏi trống phía dưới */
  bottomPaddingExtra?: number;
}

const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  children,
  maxHeightPercent = 70,
  fillHeight = false,
  keyboardAvoiding = true,
  bottomPaddingExtra = 16,
}) => {
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Lắng nghe bàn phím: thu nhỏ sheet khi keyboard hiện để không tràn màn hình
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      setKeyboardHeight(0);
      backdropOpacity.setValue(0);
      translateY.setValue(SCREEN_HEIGHT);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            damping: 28,
            stiffness: 300,
            mass: 0.8,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else if (modalVisible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible]);

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  const baseMaxH = (SCREEN_HEIGHT * maxHeightPercent) / 100;
  // Khi keyboard hiện: giới hạn thấp hơn — trừ safe top + reserve để sheet thấp hơn, không chiếm trọn vùng trên bàn phím
  const maxH =
    keyboardAvoiding && keyboardHeight > 0
      ? Math.max(
          200,
          SCREEN_HEIGHT -
            keyboardHeight -
            insets.bottom -
            insets.top -
            KEYBOARD_SHEET_TOP_RESERVE -
            16
        )
      : baseMaxH;
  // Quan trọng: chỉ giảm maxHeight là chưa đủ — sheet vẫn neo sát đáy màn hình nên bị bàn phím che.
  // Đẩy cả khối sheet lên bằng marginBottom = chiều cao bàn phím (đồng bộ với maxH).
  const sheetLift = keyboardAvoiding && keyboardHeight > 0 ? keyboardHeight : 0;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.keyboardRoot} pointerEvents="box-none">
        <View style={styles.container}>
          {/* Backdrop - fade riêng */}
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable style={styles.fill} onPress={handleBackdropPress} />
          </Animated.View>

          {/* Content - slide lên từ dưới, height thu nhỏ khi keyboard hiện */}
          <Animated.View
            style={[
              styles.content,
              {
                ...(fillHeight ? { height: maxH } : { maxHeight: maxH }),
                paddingBottom: insets.bottom + bottomPaddingExtra,
                marginBottom: sheetLift,
                transform: [{ translateY }],
              },
            ]}>
            {children}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  fill: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignSelf: 'stretch',
    flexGrow: 0,
  },
});

export default BottomSheetModal;
