/**
 * Màn quét khuôn mặt để điểm danh — nối `FaceCamera` với API `face_scan`.
 *
 * Chuyển năm kết quả của backend thành năm trạng thái giao diện, và quyết định cái
 * nào tự tan, cái nào phải chờ giám sát trả lời:
 *
 * | Backend | Giao diện | Tự tan |
 * |---|---|---|
 * | `checked_in` | thẻ xanh, tên em | 1,5s |
 * | `already` | thẻ xám, "đã điểm danh trước đó" | 2s |
 * | `confirm` | thẻ có ảnh + nút xác nhận | không — chờ trả lời |
 * | `unknown` | "không nhận ra em nào" + lối sang điểm danh tay | 4s |
 * | `no_face` | "không thấy khuôn mặt, chụp lại" | 2s |
 * | lỗi hạ tầng | dải đỏ + lối sang điểm danh tay | không — phải thấy |
 *
 * Lỗi hạ tầng cố ý KHÔNG tự tan: nếu nó biến mất như mọi thông báo khác thì giám sát
 * sẽ đứng bấm máy trước cửa xe trong khi dịch vụ đã chết.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FaceCamera, type FaceScanUiResult } from '../../components/FaceRecognition';
import { busService } from '../../services/busService';
import { getFullImageUrl } from '../../utils/imageUtils';
import { toast } from '../../utils/toast';

type RootStackParamList = {
  FaceCamera: { tripId: string; tripType: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'FaceCamera'>;

/** Thời gian tự tan của từng loại kết quả (ms). Không có mặt trong bảng = không tan. */
const TU_TAN_MS: Partial<Record<FaceScanUiResult['kind'], number>> = {
  checked_in: 1500,
  already: 2000,
  no_face: 2000,
  retake: 2500,
  unknown: 4000,
  offer_photo: 6000,
};

const FaceCameraScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { tripId, tripType } = route.params;

  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [result, setResult] = useState<FaceScanUiResult | null>(null);
  // Ảnh học sinh không nằm trong kết quả quét (backend chỉ trả tên, mã, lớp), nên lấy
  // một lần lúc mở màn thay vì gọi thêm mỗi lượt quét — lúc quét là lúc cần nhanh.
  const [anhTheoHocSinh, setAnhTheoHocSinh] = useState<Record<string, string>>({});
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  // Khung hình của lượt quét gần nhất — để gửi làm ảnh bus sau khi giám sát xác nhận
  // (PM-TASK-6711341). Chỉ giữ trong bộ nhớ, không ghi ra đĩa.
  const anhVuaQuetRef = useRef<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const xoaTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hienKetQua = useCallback(
    (ketQua: FaceScanUiResult) => {
      xoaTimer();
      setResult(ketQua);
      const han = TU_TAN_MS[ketQua.kind];
      if (han) {
        timerRef.current = setTimeout(() => setResult(null), han);
      }
    },
    [xoaTimer]
  );

  useEffect(() => xoaTimer, [xoaTimer]);

  useEffect(() => {
    let huy = false;
    void (async () => {
      const res = await busService.getDailyTripDetail(tripId);
      if (huy || !res.success || !res.data?.students) return;
      const map: Record<string, string> = {};
      for (const s of res.data.students) {
        const url = getFullImageUrl(s.photo_url);
        if (s.student_id && url) map[s.student_id] = url;
      }
      setAnhTheoHocSinh(map);
    })();
    return () => {
      huy = true;
    };
  }, [tripId]);

  /** Gửi ảnh làm ảnh bus; server tự nhận diện lại rồi quyết định thay ngay hay chờ duyệt. */
  const guiAnhBus = useCallback(
    async (studentId: string, origin: 'scan_auto' | 'scan_confirm', imageBase64: string | null) => {
      if (!imageBase64) return null;
      return busService.submitScanPhoto(tripId, studentId, imageBase64, origin);
    },
    [tripId]
  );

  const handleCapture = useCallback(
    async (imageBase64: string) => {
      setIsProcessing(true);
      anhVuaQuetRef.current = imageBase64;
      try {
        const res = await busService.scanCheckin(tripId, imageBase64);

        if (!res.success) {
          // `fallback` phân biệt "dịch vụ hỏng" với "ảnh không dùng được". Trộn hai
          // thứ này thì một lần mất mạng sẽ hiện thành "chụp lại".
          if (res.data?.fallback === 'retake') {
            hienKetQua({ kind: 'retake', message: res.message || 'Chụp lại giúp em' });
          } else {
            hienKetQua({
              kind: 'service_down',
              message: res.message || 'Quét mặt tạm không khả dụng',
            });
          }
          return;
        }

        const data = res.data;
        const student = data?.student;

        switch (data?.result) {
          case 'checked_in':
            hienKetQua({
              kind: 'checked_in',
              studentName: student?.student_name || '',
              message: res.message || 'Đã điểm danh',
            });
            // Máy tự điểm danh chỉ khi em đã có ảnh bus và điểm cao: cập nhật ảnh mới
            // nhất trong im lặng để ảnh đăng ký theo kịp trẻ đang lớn. Không chờ,
            // không báo — hàng học sinh ở cửa xe không đợi được.
            if (student?.student_id && data?.photo_source === 'Bus') {
              void guiAnhBus(student.student_id, 'scan_auto', imageBase64);
            }
            break;
          case 'already':
            hienKetQua({
              kind: 'already',
              studentName: student?.student_name || '',
              message: res.message || 'Em này đã được điểm danh trước đó',
            });
            break;
          case 'confirm':
            if (student) {
              hienKetQua({
                kind: 'confirm',
                student,
                photoUrl: anhTheoHocSinh[student.student_id],
                photoSource: data?.photo_source ?? null,
              });
            } else {
              hienKetQua({ kind: 'unknown', message: 'Không nhận ra em nào trong chuyến' });
            }
            break;
          case 'no_face':
            hienKetQua({
              kind: 'no_face',
              message: res.message || 'Không thấy khuôn mặt, chụp lại giúp em',
            });
            break;
          default:
            hienKetQua({
              kind: 'unknown',
              message: res.message || 'Không nhận ra em nào trong chuyến',
            });
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [anhTheoHocSinh, guiAnhBus, hienKetQua, tripId]
  );

  const handleConfirm = useCallback(async () => {
    if (result?.kind !== 'confirm') return;
    const student = result.student;

    setIsConfirming(true);
    try {
      const res = await busService.confirmScanCheckin(tripId, student.student_id);
      if (res.success) {
        toast.success(`Đã điểm danh ${student.student_name}`);
        // Em chưa có ảnh bus (máy phải hỏi vì ảnh đăng ký là ảnh hồ sơ/FaceID): hỏi
        // một câu có lưu khung hình vừa quét không. Thẻ tự tan sau 6s, camera vẫn
        // chụp được em kế tiếp — không chặn hàng ở cửa xe.
        if (result.photoSource && result.photoSource !== 'Bus' && anhVuaQuetRef.current) {
          hienKetQua({
            kind: 'offer_photo',
            student,
            message: 'Em chưa có ảnh bus. Lưu ảnh vừa quét làm ảnh bus?',
          });
        } else {
          // Xoá thẻ ngay để camera sẵn sàng cho em kế tiếp — không hỏi lại, không
          // quay về màn danh sách. Hàng học sinh ở cửa xe không chờ được.
          xoaTimer();
          setResult(null);
        }
      } else {
        hienKetQua({
          kind: 'service_down',
          message: res.message || 'Không điểm danh được',
        });
      }
    } finally {
      setIsConfirming(false);
    }
  }, [hienKetQua, result, tripId, xoaTimer]);

  const handleSavePhoto = useCallback(async () => {
    if (result?.kind !== 'offer_photo') return;
    const student = result.student;
    setIsSavingPhoto(true);
    try {
      const res = await guiAnhBus(student.student_id, 'scan_confirm', anhVuaQuetRef.current);
      if (!res) return;
      const outcome = res.data?.outcome;
      if (res.success && outcome === 'applied') {
        toast.success(`Đã cập nhật ảnh bus của ${student.student_name}`);
      } else if (res.success && outcome === 'queued') {
        toast.info('Đã gửi ảnh, bộ phận bus sẽ duyệt');
      } else {
        toast.error(res.message || 'Không lưu được ảnh');
      }
    } finally {
      setIsSavingPhoto(false);
      xoaTimer();
      setResult(null);
    }
  }, [guiAnhBus, result, xoaTimer]);

  const handleReject = useCallback(() => {
    xoaTimer();
    setResult(null);
  }, [xoaTimer]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <FaceCamera
        onCapture={handleCapture}
        onClose={handleClose}
        isProcessing={isProcessing}
        result={result}
        // Nhãn nói đúng việc sắp xảy ra thay vì một chữ "Xác nhận" chung chung —
        // giám sát bấm rất nhanh và cần đọc lướt là hiểu.
        confirmLabel={tripType === 'Đón' ? 'Đúng — cho lên xe' : 'Đúng — đã xuống xe'}
        isConfirming={isConfirming}
        onConfirm={handleConfirm}
        onRejectSuggestion={handleReject}
        onSavePhoto={handleSavePhoto}
        isSavingPhoto={isSavingPhoto}
        onManualFallback={handleClose}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

export default FaceCameraScreen;
