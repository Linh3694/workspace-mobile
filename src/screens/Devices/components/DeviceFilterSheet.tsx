import React from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, ButtonGhost, ButtonPrimary, IconButton, TextField } from '@atoms';
import { CheckRow, SelectableChip } from '@molecules';
import { AppSheet, SectionCard } from '@organisms';
import { layout, space } from '../../../theme/tokens';
import type { DeviceFilter, DeviceFilterOptions } from '../../../types/devices';
import { DEVICE_STATUS } from '../deviceStatus';

/**
 * Sheet bộ lọc thiết bị — component NGHIỆP VỤ, đặt cạnh màn hình dùng nó.
 * Không re-export qua `@organisms`: nó biết "thiết bị", "nhà sản xuất", "năm sản
 * xuất" nên theo quy tắc phân tầng thì không thuộc catalog dùng chung.
 */

export interface DeviceFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onClosed: () => void;
  /** Bộ lọc đang chỉnh — cha giữ state để nút "Áp dụng" có thể huỷ thay đổi. */
  value: DeviceFilter;
  onChange: (next: DeviceFilter) => void;
  options: DeviceFilterOptions;
  /** Lọc theo "Loại" chỉ có nghĩa với laptop. */
  showTypeFilter: boolean;
  onReset: () => void;
  onApply: () => void;
  activeCount: number;
}

/** Bật/tắt một giá trị trong nhóm lọc dạng mảng. */
const toggle = (list: string[], value: string): string[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const DeviceFilterSheet: React.FC<DeviceFilterSheetProps> = ({
  visible,
  onClose,
  onClosed,
  value,
  onChange,
  options,
  showTypeFilter,
  onReset,
  onApply,
  activeCount,
}) => (
  <AppSheet
    visible={visible}
    onClose={onClose}
    onClosed={onClosed}
    title="Bộ lọc"
    headerAction={
      activeCount > 0 ? (
        <IconButton
          name="update"
          size={20}
          tone="brand"
          accessibilityLabel="Đặt lại bộ lọc"
          onPress={onReset}
        />
      ) : null
    }
    footer={
      <>
        <ButtonPrimary label="Áp dụng" block onPress={onApply} />
        <ButtonGhost label="Huỷ bỏ" block onPress={onClose} />
      </>
    }>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: layout.screenPadding, gap: space[24] }}>
      <SectionCard title="Trạng thái" icon="activity" plain>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
          {options.statuses.map((status) => (
            <SelectableChip
              key={status}
              label={DEVICE_STATUS[status]?.label ?? status}
              selected={value.status.includes(status)}
              onPress={() => onChange({ ...value, status: toggle(value.status, status) })}
            />
          ))}
        </View>
      </SectionCard>

      {showTypeFilter && options.types.length > 0 ? (
        <SectionCard title="Loại" icon="layout" plain>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
            {options.types.map((type) => (
              <SelectableChip
                key={type}
                label={type}
                selected={value.type.includes(type)}
                onPress={() => onChange({ ...value, type: toggle(value.type, type) })}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {options.manufacturers.length > 0 ? (
        <SectionCard title="Nhà sản xuất" icon="building" plain>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
            {options.manufacturers.filter(Boolean).map((manufacturer) => (
              <SelectableChip
                key={manufacturer as string}
                label={manufacturer as string}
                selected={value.manufacturer.includes(manufacturer as string)}
                onPress={() =>
                  onChange({
                    ...value,
                    manufacturer: toggle(value.manufacturer, manufacturer as string),
                  })
                }
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="Năm sản xuất" icon="calendar" plain>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[12] }}>
          <View style={{ flex: 1, gap: space[6] }}>
            <AppText variant="caption" tone="description">
              Từ năm
            </AppText>
            <TextField
              value={String(value.yearRange[0])}
              keyboardType="number-pad"
              maxLength={4}
              textAlign="center"
              onChangeText={(text) => {
                const parsed = parseInt(text, 10);
                onChange({
                  ...value,
                  yearRange: [
                    Number.isNaN(parsed) ? options.yearRange[0] : parsed,
                    value.yearRange[1],
                  ],
                });
              }}
            />
          </View>

          <AppText variant="body" tone="description" style={{ paddingBottom: space[12] }}>
            –
          </AppText>

          <View style={{ flex: 1, gap: space[6] }}>
            <AppText variant="caption" tone="description">
              Đến năm
            </AppText>
            <TextField
              value={String(value.yearRange[1])}
              keyboardType="number-pad"
              maxLength={4}
              textAlign="center"
              onChangeText={(text) => {
                const parsed = parseInt(text, 10);
                onChange({
                  ...value,
                  yearRange: [
                    value.yearRange[0],
                    Number.isNaN(parsed) ? options.yearRange[1] : parsed,
                  ],
                });
              }}
            />
          </View>
        </View>
      </SectionCard>

      {options.departments.length > 0 ? (
        <SectionCard title="Phòng ban" icon="contacts" plain>
          <View>
            {options.departments.filter(Boolean).map((department) => (
              <CheckRow
                key={department as string}
                label={department as string}
                checked={value.departments.includes(department as string)}
                onPress={() =>
                  onChange({
                    ...value,
                    departments: toggle(value.departments, department as string),
                  })
                }
              />
            ))}
          </View>
        </SectionCard>
      ) : null}
    </ScrollView>
  </AppSheet>
);

export default DeviceFilterSheet;
