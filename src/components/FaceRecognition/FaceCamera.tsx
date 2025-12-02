/**
 * FaceCamera Component
 * Camera view with manual face capture for attendance
 * Note: Auto face detection removed due to expo-face-detector deprecation
 * CompreFace will handle face detection on the server side
 */

// @ts-nocheck
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

const { width: screenWidth } = Dimensions.get('window');

interface FaceCameraProps {
  onCapture: (imageBase64: string) => Promise<void>;
  onClose: () => void;
  autoCapture?: boolean;
  isProcessing?: boolean;
  lastResult?: {
    success: boolean;
    studentName?: string;
    message?: string;
  } | null;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  onCapture,
  onClose,
  isProcessing = false,
  lastResult = null,
}) => {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back'); // Default to back camera for monitor to capture student face
  const [isCapturing, setIsCapturing] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const lastCaptureTimeRef = useRef<number>(0);
  const CAPTURE_COOLDOWN = 2000; // 2 seconds cooldown between captures

  const handleCapture = useCallback(async () => {
    console.log('[FaceCamera] 🔘 handleCapture called');
    console.log(
      '[FaceCamera] State check - cameraRef:',
      !!cameraRef.current,
      'isCapturing:',
      isCapturing,
      'isProcessing:',
      isProcessing
    );

    if (!cameraRef.current) {
      console.log('[FaceCamera] ❌ No camera ref, returning');
      return;
    }
    if (isCapturing) {
      console.log('[FaceCamera] ❌ Already capturing, returning');
      return;
    }
    if (isProcessing) {
      console.log('[FaceCamera] ❌ Still processing, returning');
      return;
    }

    const now = Date.now();
    const timeSinceLastCapture = now - lastCaptureTimeRef.current;
    if (timeSinceLastCapture < CAPTURE_COOLDOWN) {
      console.log('[FaceCamera] ❌ In cooldown, time since last:', timeSinceLastCapture, 'ms');
      return;
    }

    setIsCapturing(true);
    setCooldown(true);
    lastCaptureTimeRef.current = now;

    try {
      console.log('[FaceCamera] 📸 Taking picture...');
      console.log('[FaceCamera] Camera facing:', facing);

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.9,
        skipProcessing: false, // Enable processing for back camera
        exif: false,
      });

      console.log('[FaceCamera] Photo taken, size:', photo?.width, 'x', photo?.height);
      console.log('[FaceCamera] Original base64 length:', photo?.base64?.length);

      if (photo?.uri) {
        // Process image for CompreFace compatibility
        const actions: ImageManipulator.Action[] = [];

        // Flip horizontally for front camera to correct mirror effect
        if (facing === 'front') {
          actions.push({ flip: ImageManipulator.FlipType.Horizontal });
          console.log('[FaceCamera] Adding horizontal flip for front camera');
        }

        // For back camera on iOS, images might need rotation correction
        // Check if image is in portrait mode (height > width in landscape capture)
        console.log('[FaceCamera] Original dimensions:', photo.width, 'x', photo.height);

        // Resize to optimal size for face detection (max 640px)
        const maxSize = 640;
        if (photo.width > maxSize || photo.height > maxSize) {
          const maxDim = Math.max(photo.width, photo.height);
          const scale = maxSize / maxDim;
          actions.push({
            resize: {
              width: Math.round(photo.width * scale),
              height: Math.round(photo.height * scale),
            },
          });
          console.log('[FaceCamera] Resizing image, scale:', scale.toFixed(2));
        }

        // Always process the image to ensure consistent JPEG format
        console.log('[FaceCamera] Processing with actions:', JSON.stringify(actions));
        const manipResult = await ImageManipulator.manipulateAsync(photo.uri, actions, {
          compress: 0.9, // Higher quality for better face detection
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        });

        const finalBase64 = manipResult.base64;
        console.log('[FaceCamera] Final image size:', manipResult.width, 'x', manipResult.height);
        console.log('[FaceCamera] Final base64 length:', finalBase64?.length);

        if (finalBase64) {
          await onCapture(finalBase64);
        } else {
          console.error('[FaceCamera] No base64 data after processing');
          Alert.alert('Lỗi', 'Không thể xử lý ảnh');
        }
      } else {
        console.error('[FaceCamera] No photo URI');
        Alert.alert('Lỗi', 'Không thể chụp ảnh');
      }
    } catch (error) {
      console.error('[FaceCamera] Capture error:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsCapturing(false);
      // Reset cooldown after delay
      setTimeout(() => setCooldown(false), CAPTURE_COOLDOWN);
    }
  }, [isCapturing, isProcessing, onCapture, facing]);

  const toggleFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#FFFFFF" />
          <Text style={styles.permissionText}>Ứng dụng cần quyền truy cập camera để điểm danh</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Cấp quyền</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.instructionBadge}>
              <Ionicons name="person" size={16} color="#FFFFFF" />
              <Text style={styles.instructionText}>Đưa khuôn mặt vào khung</Text>
            </View>
          </View>

          {/* Face Frame */}
          <View style={styles.faceFrameContainer}>
            <View style={[styles.faceFrame, isProcessing && styles.faceFrameProcessing]}>
              {isProcessing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.processingText}>Đang nhận diện...</Text>
                </View>
              )}
            </View>

            {/* Status text */}
            <View style={styles.statusContainer}>
              {isProcessing ? (
                <Text style={styles.statusText}>Đang gửi ảnh lên hệ thống...</Text>
              ) : cooldown ? (
                <Text style={styles.statusText}>Đang xử lý, vui lòng đợi...</Text>
              ) : (
                <Text style={styles.statusText}>Nhấn nút chụp để điểm danh</Text>
              )}
            </View>
          </View>

          {/* Result Banner */}
          {lastResult && (
            <View
              style={[
                styles.resultBanner,
                lastResult.success ? styles.resultSuccess : styles.resultError,
              ]}>
              <Ionicons
                name={lastResult.success ? 'checkmark-circle' : 'alert-circle'}
                size={24}
                color="#FFFFFF"
              />
              <View style={styles.resultContent}>
                {lastResult.studentName && (
                  <Text style={styles.resultStudentName}>{lastResult.studentName}</Text>
                )}
                <Text style={styles.resultMessage}>{lastResult.message}</Text>
              </View>
            </View>
          )}

          {/* Bottom Controls */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.sideButton} onPress={toggleFacing}>
              <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.captureButton,
                (isCapturing || isProcessing || cooldown) && styles.captureButtonDisabled,
              ]}
              onPress={handleCapture}
              disabled={isCapturing || isProcessing || cooldown}>
              <View style={styles.captureButtonInner}>
                {isCapturing || isProcessing ? (
                  <ActivityIndicator size="small" color="#002855" />
                ) : (
                  <Ionicons name="camera" size={36} color="#002855" />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.sideButton} />
          </View>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 8,
  },
  faceFrameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceFrame: {
    width: screenWidth * 0.75,
    height: screenWidth * 0.95,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceFrameProcessing: {
    borderColor: '#3B82F6',
    borderWidth: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  processingOverlay: {
    alignItems: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
  },
  statusContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
  },
  resultSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
  },
  resultError: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  resultContent: {
    marginLeft: 12,
    flex: 1,
  },
  resultStudentName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resultMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginTop: 2,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 50,
  },
  sideButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#002855',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});

export default FaceCamera;
