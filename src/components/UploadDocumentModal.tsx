import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface UploadDocumentModalProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onDocument: () => void;
  isUploading?: boolean;
}

const { height } = Dimensions.get('window');

const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  visible,
  onClose,
  onCamera,
  onGallery,
  onDocument,
  isUploading = false
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            opacity: fadeAnim,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={{
                width: '80%',
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                overflow: 'hidden',
                transform: [{ translateY: slideAnim }],
              }}
            >
              <View style={{ padding: 20 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    textAlign: 'center',
                    marginBottom: 15,
                  }}
                >
                  Tải lên biên bản
                </Text>

                <TouchableOpacity
                  onPress={onCamera}
                  disabled={isUploading}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                >
                  <MaterialCommunityIcons
                    name="camera"
                    size={24}
                    color={isUploading ? '#999999' : '#002855'}
                  />
                  <Text
                    style={{
                      fontSize: 16,
                      marginLeft: 10,
                      color: isUploading ? '#999999' : '#333333',
                    }}
                  >
                    Chụp ảnh
                  </Text>
                  {isUploading && (
                    <ActivityIndicator size="small" style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onGallery}
                  disabled={isUploading}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                >
                  <MaterialCommunityIcons
                    name="image"
                    size={24}
                    color={isUploading ? '#999999' : '#002855'}
                  />
                  <Text
                    style={{
                      fontSize: 16,
                      marginLeft: 10,
                      color: isUploading ? '#999999' : '#333333',
                    }}
                  >
                    Chọn từ thư viện
                  </Text>
                  {isUploading && (
                    <ActivityIndicator size="small" style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onDocument}
                  disabled={isUploading}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                >
                  <MaterialCommunityIcons
                    name="file-document"
                    size={24}
                    color={isUploading ? '#999999' : '#002855'}
                  />
                  <Text
                    style={{
                      fontSize: 16,
                      marginLeft: 10,
                      color: isUploading ? '#999999' : '#333333',
                    }}
                  >
                    Chọn từ tài liệu
                  </Text>
                  {isUploading && (
                    <ActivityIndicator size="small" style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>

                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: '#E5E5E5',
                    marginTop: 15,
                  }}
                />

                <TouchableOpacity
                  onPress={onClose}
                  style={{ paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '500', color: '#666666' }}>
                    Hủy
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default UploadDocumentModal;

