/**
 * FaceCamera — khung chụp khuôn mặt để điểm danh học sinh lên/xuống xe bus.
 *
 * Bố cục giữ nguyên bản đã dùng trước đây (thanh trên, khung ngắm, dải trạng thái,
 * thẻ kết quả neo đáy, nút chụp). Ba chỗ buộc phải khác vì môi trường đã đổi:
 *
 * 1. **Overlay nằm NGOÀI `<CameraView>`.** expo-camera 17 không hỗ trợ children —
 *    `CameraView.render()` cảnh báo thẳng "does not support children… may lead to
 *    inconsistent behaviour or crashes" và khuyên dùng absolute positioning. Repo
 *    đang bật New Architecture, nơi gắn view React vào trong native camera view là
 *    chỗ dễ vỡ nhất. Giao diện ra y hệt, chỉ khác cấu trúc cây.
 * 2. **Thu nhỏ về 1280px, không phải 640px.** Dịch vụ nhận diện tự hạ về 1280
 *    (`recognize_max_px`) và căn khuôn mặt từ ảnh ĐỘ PHÂN GIẢI GỐC để crop 112x112
 *    không mất chi tiết. Gửi 640 là tự vứt đi phần chi tiết đó — đúng lúc bài toán
 *    khó nhất là điểm tương đồng thấp.
 * 3. **Bỏ lật ngang cho camera trước.** expo-camera 17 có `mirror` mặc định `false`,
 *    tức ảnh chụp ra đã không bị soi gương; lật thêm là lật ngược lại.
 *
 * Cũng bỏ toàn bộ `console.log` của bản cũ: mỗi lần chụp ghi ~20 dòng, trong đó có
 * cả đoạn đầu chuỗi base64 — tức là dữ liệu ảnh khuôn mặt trẻ em nằm trong log thiết
 * bị. Phần chẩn đoán còn lại chỉ chạy khi `__DEV__` và không bao giờ chạm vào ảnh.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
// Phải là `import * as`: với named import thì `ImageManipulator` là native module
// (chỉ có `.manipulate()/.Context`) và KHÔNG có `SaveFormat`.
import * as ImageManipulator from 'expo-image-manipulator';
import { colors } from '../../theme';
import type { FaceScanStudent } from '../../services/busService';

const { width: screenWidth } = Dimensions.get('window');

/** Khớp `recognize_max_px` của dịch vụ nhận diện. */
const MAX_ANH_PX = 1280;
const CHO_GIUA_HAI_LAN_CHUP_MS = 800;

export type FaceScanUiResult =
  | { kind: 'checked_in'; studentName: string; message: string }
  | { kind: 'already'; studentName: string; message: string }
  | { kind: 'confirm'; student: FaceScanStudent; photoUrl?: string }
  | { kind: 'unknown'; message: string }
  | { kind: 'no_face'; message: string }
  /** Dịch vụ hỏng hoặc mất mạng — chuyển sang điểm danh tay */
  | { kind: 'service_down'; message: string }
  /** Ảnh không dùng được — chụp lại */
  | { kind: 'retake'; message: string };

interface FaceCameraProps {
  onCapture: (imageBase64: string) => Promise<void>;
  onClose: () => void;
  isProcessing?: boolean;
  result?: FaceScanUiResult | null;
  /** Nhãn nút xác nhận, đổi theo chiều chuyến (đón / trả) */
  confirmLabel: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onRejectSuggestion: () => void;
  onManualFallback: () => void;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  onCapture,
  onClose,
  isProcessing = false,
  result = null,
  confirmLabel,
  isConfirming = false,
  onConfirm,
  onRejectSuggestion,
  onManualFallback,
}) => {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  // Mặc định camera sau: giám sát cầm máy quay về phía học sinh.
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const lastCaptureTimeRef = useRef(0);

  // Đang chờ giám sát trả lời thì không cho chụp đè lên câu hỏi.
  const dangHoiXacNhan = result?.kind === 'confirm';
  const khoaChup = isCapturing || isProcessing || isConfirming || dangHoiXacNhan;

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || khoaChup) return;

    const now = Date.now();
    if (now - lastCaptureTimeRef.current < CHO_GIUA_HAI_LAN_CHUP_MS) return;

    setIsCapturing(true);
    lastCaptureTimeRef.current = now;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
        exif: false,
      });

      if (!photo?.uri) {
        Alert.alert('Lỗi', 'Không chụp được ảnh');
        return;
      }

      const actions: ImageManipulator.Action[] = [];
      const canhDaiNhat = Math.max(photo.width, photo.height);
      if (canhDaiNhat > MAX_ANH_PX) {
        const tyLe = MAX_ANH_PX / canhDaiNhat;
        actions.push({
          resize: {
            width: Math.round(photo.width * tyLe),
            height: Math.round(photo.height * tyLe),
          },
        });
      }

      const anh = await ImageManipulator.manipulateAsync(photo.uri, actions, {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });

      if (!anh.base64) {
        Alert.alert('Lỗi', 'Không xử lý được ảnh');
        return;
      }

      if (__DEV__) {
        // Chỉ số đo, tuyệt đối không log nội dung ảnh.
        console.log(
          `[FaceCamera] ${photo.width}x${photo.height} -> ${anh.width}x${anh.height}, ` +
            `${Math.round(anh.base64.length / 1024)}KB base64`
        );
      }

      await onCapture(anh.base64);
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không chụp được ảnh');
    } finally {
      setIsCapturing(false);
    }
  }, [khoaChup, onCapture]);

  const toggleFacing = useCallback(() => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

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
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />

      {/* Overlay tách khỏi CameraView — xem chú thích đầu file.
          `box-none` để các khoảng trống không nuốt chạm của lớp dưới. */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.instructionBadge}>
            <Ionicons name="person" size={16} color="#FFFFFF" />
            <Text style={styles.instructionText}>Đưa khuôn mặt vào khung</Text>
          </View>
        </View>

        <View style={styles.faceFrameContainer} pointerEvents="none">
          <View style={[styles.faceFrame, isProcessing && styles.faceFrameProcessing]}>
            {isProcessing ? (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.processingText}>Đang nhận diện...</Text>
              </View>
            ) : null}
          </View>

          {!result ? (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>
                {isProcessing ? 'Đang gửi ảnh lên hệ thống...' : 'Nhấn nút chụp để điểm danh'}
              </Text>
            </View>
          ) : null}
        </View>

        {result ? (
          <ResultCard
            result={result}
            confirmLabel={confirmLabel}
            isConfirming={isConfirming}
            onConfirm={onConfirm}
            onRejectSuggestion={onRejectSuggestion}
            onManualFallback={onManualFallback}
          />
        ) : null}

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.sideButton} onPress={toggleFacing}>
            <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureButton, khoaChup && styles.captureButtonDisabled]}
            onPress={handleCapture}
            disabled={khoaChup}>
            <View style={styles.captureButtonInner}>
              {isCapturing || isProcessing ? (
                <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
              ) : (
                <Ionicons name="camera" size={36} color={colors.primary.DEFAULT} />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.sideButton} />
        </View>
      </View>
    </View>
  );
};

/**
 * Thẻ kết quả neo đáy.
 *
 * Cố ý KHÔNG dùng Modal cho mức "cần xác nhận": modal tốn hai chạm (bấm xác nhận rồi
 * đóng) và chặn lượt quét kế tiếp. Mà trong giai đoạn đầu — khi phần lớn học sinh vẫn
 * đăng ký bằng ảnh hồ sơ — "cần xác nhận" là đường ĐI CHÍNH chứ không phải ngoại lệ,
 * nên nó phải gọn hơn luồng tự động chứ không nặng hơn.
 *
 * Cũng không hiện điểm tương đồng cho giám sát: con số chỉ khiến người ta tự chấm
 * điểm cái máy rồi do dự, trong khi việc cần làm chỉ là nhìn mặt em và trả lời.
 */
/**
 * Ảnh học sinh trong thẻ xác nhận, có đường lui khi ảnh tải hỏng.
 *
 * Cần thật chứ không phải phòng xa: `photo_url` của chuyến trỏ vào `/files/...` trên
 * Frappe, mà ảnh học sinh đã được chuyển sang kho CDN và xoá khỏi đĩa — nginx phục vụ
 * `/files/` thẳng từ đĩa nên phần lớn ảnh sẽ trả 404. Không bắt lỗi thì giám sát thấy
 * một vòng tròn trống, tưởng ứng dụng lỗi; bắt lỗi thì rơi về đúng biểu tượng người.
 *
 * Đặt `key` theo mã học sinh ở nơi dùng để trạng thái lỗi không dính sang em kế tiếp.
 */
const ConfirmAvatar: React.FC<{ photoUrl?: string }> = ({ photoUrl }) => {
  const [loi, setLoi] = useState(false);

  if (!photoUrl || loi) {
    return (
      <View style={[styles.avatar, styles.avatarPlaceholder]}>
        <Ionicons name="person" size={28} color="#FFFFFF" />
      </View>
    );
  }

  return (
    <Image source={{ uri: photoUrl }} style={styles.avatar} onError={() => setLoi(true)} />
  );
};

const ResultCard: React.FC<{
  result: FaceScanUiResult;
  confirmLabel: string;
  isConfirming: boolean;
  onConfirm: () => void;
  onRejectSuggestion: () => void;
  onManualFallback: () => void;
}> = ({ result, confirmLabel, isConfirming, onConfirm, onRejectSuggestion, onManualFallback }) => {
  if (result.kind === 'confirm') {
    const { student, photoUrl } = result;
    return (
      <View style={[styles.resultCard, styles.resultConfirm]}>
        <View style={styles.confirmHeader}>
          <ConfirmAvatar key={student.student_id} photoUrl={photoUrl} />
          <View style={styles.confirmInfo}>
            <Text style={styles.confirmName} numberOfLines={1}>
              {student.student_name}
            </Text>
            <Text style={styles.confirmMeta} numberOfLines={1}>
              {[student.student_code, student.class_name].filter(Boolean).join(' • ')}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={onConfirm}
          disabled={isConfirming}
          activeOpacity={0.85}>
          {isConfirming ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rejectButton}
          onPress={onRejectSuggestion}
          disabled={isConfirming}>
          <Text style={styles.rejectButtonText}>Không phải em này</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (result.kind === 'service_down') {
    return (
      <View style={[styles.resultCard, styles.resultDanger]}>
        <View style={styles.simpleRow}>
          <Ionicons name="cloud-offline" size={24} color="#FFFFFF" />
          <View style={styles.simpleContent}>
            <Text style={styles.simpleText}>{result.message}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.confirmButton} onPress={onManualFallback}>
          <Text style={styles.confirmButtonText}>Chuyển sang điểm danh tay</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (result.kind === 'unknown') {
    return (
      <View style={[styles.resultCard, styles.resultNeutral]}>
        <View style={styles.simpleRow}>
          <Ionicons name="help-circle" size={24} color="#FFFFFF" />
          <View style={styles.simpleContent}>
            <Text style={styles.simpleText}>{result.message}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.rejectButton} onPress={onManualFallback}>
          <Text style={styles.rejectButtonText}>Điểm danh tay</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tone =
    result.kind === 'checked_in'
      ? styles.resultSuccess
      : result.kind === 'already'
        ? styles.resultNeutral
        : styles.resultNeutral;
  const icon =
    result.kind === 'checked_in'
      ? 'checkmark-circle'
      : result.kind === 'already'
        ? 'information-circle'
        : 'camera-reverse';

  return (
    <View style={[styles.resultCard, tone]}>
      <View style={styles.simpleRow}>
        <Ionicons name={icon} size={24} color="#FFFFFF" />
        <View style={styles.simpleContent}>
          {'studentName' in result && result.studentName ? (
            <Text style={styles.resultStudentName}>{result.studentName}</Text>
          ) : null}
          <Text style={styles.simpleText}>{result.message}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
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
    fontFamily: 'Mulish',
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
    fontFamily: 'Mulish',
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
    fontFamily: 'Mulish',
  },
  resultCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
  },
  resultSuccess: {
    backgroundColor: 'rgba(52, 199, 89, 0.95)',
  },
  resultNeutral: {
    backgroundColor: 'rgba(30, 30, 30, 0.92)',
  },
  resultDanger: {
    backgroundColor: 'rgba(255, 59, 48, 0.95)',
  },
  resultConfirm: {
    backgroundColor: 'rgba(20, 20, 20, 0.94)',
  },
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  simpleContent: {
    marginLeft: 12,
    flex: 1,
  },
  simpleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Mulish',
  },
  resultStudentName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Mulish',
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmInfo: {
    marginLeft: 14,
    flex: 1,
  },
  confirmName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Mulish',
  },
  confirmMeta: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    marginTop: 2,
    fontFamily: 'Mulish',
  },
  confirmButton: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: colors.secondary.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Mulish',
  },
  rejectButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  rejectButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 15,
    fontFamily: 'Mulish',
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
    fontFamily: 'Mulish',
  },
  permissionButton: {
    backgroundColor: colors.primary.DEFAULT,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Mulish',
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Mulish',
  },
});

export default FaceCamera;
