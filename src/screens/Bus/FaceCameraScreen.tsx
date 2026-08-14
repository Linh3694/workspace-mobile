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

  const handleCapture = useCallback(
    async (imageBase64: string) => {
      setIsProcessing(true);
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
    [anhTheoHocSinh, hienKetQua, tripId]
  );

  const handleConfirm = useCallback(async () => {
    if (result?.kind !== 'confirm') return;
    const student = result.student;

    setIsConfirming(true);
    try {
      const res = await busService.confirmScanCheckin(tripId, student.student_id);
      if (res.success) {
        toast.success(`Đã điểm danh ${student.student_name}`);
        // Xoá thẻ ngay để camera sẵn sàng cho em kế tiếp — không hỏi lại, không
        // quay về màn danh sách. Hàng học sinh ở cửa xe không chờ được.
        xoaTimer();
        setResult(null);
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
