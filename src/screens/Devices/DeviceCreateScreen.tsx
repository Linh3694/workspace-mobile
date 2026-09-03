import React, { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText, ButtonGhost, ButtonPrimary } from '@atoms';
import { FormField, SelectableChip } from '@molecules';
import { SectionCard } from '@organisms';
import { FormScreen } from '@templates';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import deviceService from '../../services/deviceService';
import type { DeviceType } from '../../types/devices';
import { space } from '../../theme/tokens';
import type { CreateDeviceData } from './components/CreateDeviceModal';
import { DEVICE_SUBTYPES, SPEC_FIELDS, deviceTypeLabel } from './deviceStatus';

/**
 * Tạo thiết bị mới — TRANG, không phải sheet.
 *
 * Bản cũ (`CreateDeviceModal`) là hộp thoại nổi giữa màn kiểu web: biểu mẫu tới 9 ô
 * nhập mà chỉ được ~65% chiều cao, bàn phím bật lên là còn một nhúm; chạm ra ngoài
 * là mất trắng phần đã điền. Xem phần đầu `FormScreen.tsx` để biết vì sao biểu mẫu
 * dài thì phải là trang.
 *
 * Logic nghiệp vụ giữ nguyên: cùng `deviceService.createDevice`, cùng luật bắt buộc
 * (tên + serial), cùng cấu trúc `specs` theo từng loại thiết bị.
 */

type NavProp = NativeStackNavigationProp<RootStackParamList, typeof ROUTES.SCREENS.DEVICE_CREATE>;
type ScreenRoute = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.DEVICE_CREATE>;

const emptyForm = (deviceType: DeviceType): CreateDeviceData => ({
  name: '',
  serial: '',
  manufacturer: '',
  releaseYear: new Date().getFullYear(),
  type: DEVICE_SUBTYPES[deviceType]?.[0]?.value ?? '',
  specs: {},
});

const DeviceCreateScreen = () => {
  const navigation = useNavigation<NavProp>();
  const { deviceType } = useRoute<ScreenRoute>().params;

  const [form, setForm] = useState<CreateDeviceData>(() => emptyForm(deviceType));
  const [submitting, setSubmitting] = useState(false);
  /** Chỉ hiện lỗi sau lần bấm gửi đầu tiên — đừng mắng người dùng khi họ chưa gõ gì. */
  const [showErrors, setShowErrors] = useState(false);

  const subtypes = DEVICE_SUBTYPES[deviceType] ?? [];
  const specFields = SPEC_FIELDS[deviceType] ?? [];

  const errors = useMemo(
    () => ({
      name: form.name.trim() ? null : 'Vui lòng nhập tên thiết bị',
      serial: form.serial.trim() ? null : 'Vui lòng nhập số serial',
    }),
    [form.name, form.serial]
  );

  const setField = useCallback(
    <K extends keyof CreateDeviceData>(field: K, value: CreateDeviceData[K]) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    []
  );

  const setSpec = useCallback(
    (key: string, value: string) =>
      setForm((prev) => ({ ...prev, specs: { ...prev.specs, [key]: value } })),
    []
  );

  const handleSubmit = useCallback(async () => {
    setShowErrors(true);
    if (errors.name || errors.serial) return;

    try {
      setSubmitting(true);
      await deviceService.createDevice(deviceType, form);
      // `popTo` không có ở mọi phiên bản — quay lại màn danh sách rồi báo cho nó tải lại.
      navigation.navigate(ROUTES.SCREENS.DEVICES_V2, { refresh: true });
      Alert.alert('Thành công', 'Đã tạo thiết bị mới.');
    } catch (err) {
      Alert.alert(
        'Lỗi',
        err instanceof Error ? err.message : 'Không thể tạo thiết bị. Vui lòng thử lại.'
      );
    } finally {
      setSubmitting(false);
    }
  }, [deviceType, errors.name, errors.serial, form, navigation]);

  return (
    <FormScreen
      header={{
        title: `Tạo ${deviceTypeLabel(deviceType).toLowerCase()} mới`,
        onBack: () => navigation.goBack(),
        backIcon: 'close',
      }}
      footer={
        <>
          <ButtonGhost
            label="Huỷ"
            onPress={() => navigation.goBack()}
            disabled={submitting}
            style={{ flex: 1 }}
          />
          <ButtonPrimary
            label="Tạo mới"
            onPress={handleSubmit}
            loading={submitting}
            style={{ flex: 1 }}
          />
        </>
      }>
      <SectionCard title="Thông tin chung" icon="document">
        <View style={{ gap: space[16] }}>
          {subtypes.length > 1 ? (
            <View style={{ gap: space[6] }}>
              <AppText variant="footnote" tone="description">
                Loại thiết bị
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
                {subtypes.map((option) => (
                  <SelectableChip
                    key={option.value}
                    label={option.label}
                    selected={form.type === option.value}
                    onPress={() => setField('type', option.value)}
                    tone="brand"
                  />
                ))}
              </View>
            </View>
          ) : null}

          <FormField
            label="Tên thiết bị"
            required
            value={form.name}
            onChangeText={(text) => setField('name', text)}
            placeholder="VD: MacBook Pro 14 inch 2023"
            error={showErrors ? errors.name : null}
            editable={!submitting}
          />

          <FormField
            label="Số Serial"
            required
            value={form.serial}
            onChangeText={(text) => setField('serial', text)}
            placeholder="VD: C02XG2FDJG5J"
            autoCapitalize="characters"
            error={showErrors ? errors.serial : null}
            editable={!submitting}
          />

          <FormField
            label="Hãng sản xuất"
            value={form.manufacturer ?? ''}
            onChangeText={(text) => setField('manufacturer', text)}
            placeholder="VD: Apple, Dell, HP, Lenovo…"
            editable={!submitting}
          />

          <FormField
            label="Năm sản xuất"
            value={form.releaseYear ? String(form.releaseYear) : ''}
            onChangeText={(text) => {
              const parsed = parseInt(text, 10);
              setField('releaseYear', Number.isNaN(parsed) ? undefined : parsed);
            }}
            keyboardType="number-pad"
            maxLength={4}
            editable={!submitting}
          />
        </View>
      </SectionCard>

      {specFields.length > 0 ? (
        <SectionCard title="Thông số kỹ thuật" icon="preferences">
          <View style={{ gap: space[16] }}>
            {specFields.map((field) => (
              <FormField
                key={field.key}
                label={field.label}
                value={form.specs?.[field.key as keyof typeof form.specs] ?? ''}
                onChangeText={(text) => setSpec(field.key, text)}
                placeholder={field.placeholder}
                keyboardType={field.keyboardType}
                editable={!submitting}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}
    </FormScreen>
  );
};

export default DeviceCreateScreen;
