/**
 * Quét tem QR trên thiết bị → mở thẳng hồ sơ máy đó.
 *
 * Ba chỗ buộc phải làm đúng, mỗi chỗ đều đã có tiền lệ trong repo:
 *
 * 1. **Overlay nằm NGOÀI `<CameraView>`.** expo-camera 17 không nhận children —
 *    cùng lý do đã ghi ở `components/FaceRecognition/FaceCamera.tsx`.
 *
 * 2. **Khoá sau lần quét đầu.** `onBarcodeScanned` bắn liên tục theo từng khung
 *    hình, không phải một lần một mã. Không khoá thì một tem dán trước ống kính
 *    sinh ra hàng chục request và vài lần điều hướng chồng nhau.
 *
 * 3. **Tem chỉ chứa mã trần `INV-DEV-xxxxx`, không phải URL** (quyết định
 *    17/09/2026). Nên phải hỏi backend `resolve_device_by_code` mới biết máy loại
 *    gì — màn chi tiết đòi cả `deviceId` lẫn `deviceType`, mà tem không mang loại.
 */

import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { AppText, ButtonGhost, ButtonPrimary, Icon, Spinner } from '@atoms';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import deviceService from '../../services/deviceService';
import { color, radius, space } from '../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList, typeof ROUTES.SCREENS.DEVICE_SCAN>;

type ScanState =
  | { kind: 'scanning' }
  | { kind: 'resolving'; code: string }
  | { kind: 'error'; message: string; code: string };

const DeviceScanScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ kind: 'scanning' });

  // Khoá đồng bộ, KHÔNG dùng state: setState là bất đồng bộ nên khung hình kế
  // tiếp vẫn đọc được giá trị cũ và lọt thêm vài lần quét nữa.
  const busyRef = useRef(false);

  const resetScan = useCallback(() => {
    busyRef.current = false;
    setState({ kind: 'scanning' });
  }, []);

  const handleScanned = useCallback(
    async ({ data }: { data: string }) => {
      const code = (data || '').trim();
      if (busyRef.current || !code) return;
      busyRef.current = true;
      setState({ kind: 'resolving', code });

      try {
        const device = await deviceService.resolveDeviceByCode(code);
        if (!device) {
          setState({
            kind: 'error',
            code,
            message: 'Không tìm thấy thiết bị nào mang mã này.',
          });
          return;
        }
        // `replace` chứ không `navigate`: bấm Quay lại từ hồ sơ máy nên về danh
        // sách, không rơi lại vào camera đang mở.
        navigation.replace(ROUTES.SCREENS.DEVICE_DETAIL, {
          deviceId: device.id,
          deviceType: device.deviceType,
        });
      } catch (error) {
        setState({
          kind: 'error',
          code,
          message:
            error instanceof Error && error.message
              ? error.message
              : 'Không kết nối được máy chủ. Kiểm tra mạng rồi quét lại.',
        });
      }
    },
    [navigation]
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Spinner />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Icon name="qrcode-scan" set="mci" size={64} tone="inverse" />
        <AppText variant="body" style={styles.permissionText}>
          Ứng dụng cần quyền camera để quét tem thiết bị
        </AppText>
        <ButtonPrimary label="Cấp quyền" onPress={requestPermission} />
        <ButtonGhost label="Quay lại" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const scanning = state.kind === 'scanning';

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        // Ngừng nhận khung hình mới khi đã bắt được mã — đỡ hao pin và bớt nhiễu.
        onBarcodeScanned={scanning ? handleScanned : undefined}
      />

      {/* Overlay tách khỏi CameraView — xem chú thích đầu file. */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Đóng màn quét">
            <Icon name="close" set="ion" size={26} tone="inverse" />
          </TouchableOpacity>
        </View>

        <View style={styles.viewfinder} />

        <View style={styles.bottomPanel}>
          {state.kind === 'scanning' ? (
            <AppText variant="body" style={styles.hint}>
              Đưa tem QR trên thiết bị vào khung
            </AppText>
          ) : null}

          {state.kind === 'resolving' ? (
            <View style={styles.row}>
              <Spinner />
              <AppText variant="body" style={styles.hint}>
                Đang tra {state.code}…
              </AppText>
            </View>
          ) : null}

          {state.kind === 'error' ? (
            <>
              <AppText variant="body" style={styles.hint}>
                {state.message}
              </AppText>
              <AppText variant="caption" style={styles.code}>
                Mã đã quét: {state.code}
              </AppText>
              <ButtonPrimary label="Quét lại" onPress={resetScan} />
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[16],
    padding: space[24],
    backgroundColor: '#000000',
  },
  // Nền camera luôn tối, nên chữ ở lớp overlay dùng tone inverse thay vì tone
  // mặc định theo nền trang.
  permissionText: { color: color.content.inverse, textAlign: 'center' },
  overlay: { justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', padding: space[16], paddingTop: space[48] },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  viewfinder: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: radius[20],
    borderWidth: 2,
    borderColor: color.content.inverse,
  },
  bottomPanel: {
    gap: space[12],
    alignItems: 'center',
    padding: space[24],
    paddingBottom: space[48],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[10] },
  hint: { color: color.content.inverse, textAlign: 'center' },
  code: { color: color.content.inverse, opacity: 0.7 },
});

export default DeviceScanScreen;
