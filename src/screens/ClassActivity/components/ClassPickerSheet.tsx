// @ts-nocheck
/**
 * Bottom sheet chọn lớp chủ nhiệm — đồng bộ pattern các module khác (Modal + nền trong)
 */
import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { HomeroomClassOption } from '../../../utils/homeroomClassUtils';

type Props = {
  visible: boolean;
  options: HomeroomClassOption[];
  selectedId?: string | null;
  onClose: () => void;
  onSelect: (opt: HomeroomClassOption) => void;
  /** Chuỗi i18n tiêu đề */
  title?: string;
};

export function ClassPickerSheet({
  visible,
  options,
  selectedId,
  onClose,
  onSelect,
  title = 'Chọn lớp',
}: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            {options.map((o) => {
              const active = o.id === selectedId;
              return (
                <Pressable
                  key={o.id}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => {
                    onSelect(o);
                    onClose();
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{o.title}</Text>
                    <Text style={styles.rowSub}>
                      {o.roleLabel === 'vice'
                        ? `${t('class_activity.sheet_role_vice')} · ${o.id}`
                        : `${t('class_activity.sheet_role_homeroom')} · ${o.id}`}
                    </Text>
                  </View>
                  {active ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 28,
    paddingTop: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'Mulish-Bold',
    paddingHorizontal: 20,
    marginBottom: 8,
    color: '#0A2240',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowActive: { backgroundColor: '#F0F9FF' },
  rowTitle: { fontSize: 16, fontFamily: 'Mulish-SemiBold', color: '#111' },
  rowSub: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  check: { fontSize: 18, color: '#0A2240', marginLeft: 8 },
});
