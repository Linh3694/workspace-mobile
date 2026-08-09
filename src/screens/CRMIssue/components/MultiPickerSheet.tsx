/**
 * Sheet chọn nhiều mục có ô tìm — dùng chung cho Phòng ban, Nhóm liên quan,
 * Người liên quan, Phụ huynh liên quan của Vấn đề chung.
 *
 * Hai chế độ tìm:
 *  - `onSearch` không truyền → lọc client trên `options` (danh sách ngắn, đã tải sẵn).
 *  - `onSearch` có truyền  → hỏi server, debounce 300ms (danh bạ dài: user, phụ huynh).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';

export type PickerOption = {
  value: string;
  label: string;
  /** Dòng phụ: lớp học sinh, SĐT phụ huynh, email user… */
  subtitle?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  selected: string[];
  onToggle: (value: string, option: PickerOption) => void;
  searchPlaceholder?: string;
  /** Tìm ở server; trả về danh sách hiển thị thay cho `options` */
  onSearch?: (term: string) => Promise<PickerOption[]>;
  /** Số ký tự tối thiểu mới gọi `onSearch` */
  minSearchChars?: number;
  emptyText?: string;
  /** Cho phép bỏ chọn tất cả */
  onClear?: () => void;
  clearLabel?: string;
};

const normalize = (text: string): string => {
  try {
    return (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  } catch {
    return (text || '').toLowerCase();
  }
};

export const MultiPickerSheet: React.FC<Props> = ({
  visible,
  onClose,
  title,
  options,
  selected,
  onToggle,
  searchPlaceholder,
  onSearch,
  minSearchChars = 2,
  emptyText,
  onClear,
  clearLabel,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [remoteHits, setRemoteHits] = useState<PickerOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (visible) return;
    // Đóng sheet thì xoá từ khoá để lần mở sau bắt đầu sạch
    setSearch('');
    setRemoteHits([]);
  }, [visible]);

  useEffect(() => {
    if (!visible || !onSearch) return;
    const term = search.trim();
    if (term.length < minSearchChars) {
      setRemoteHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void onSearch(term)
        .then((hits) => {
          if (!cancelled) setRemoteHits(hits);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, visible, onSearch, minSearchChars]);

  const shown = useMemo(() => {
    if (onSearch) {
      // Người đang chọn luôn hiện đầu danh sách để còn bỏ chọn được
      const picked = options.filter((o) => selected.includes(o.value));
      const rest = remoteHits.filter((h) => !selected.includes(h.value));
      return [...picked, ...rest];
    }
    const q = search.trim();
    if (!q) return options;
    const nq = normalize(q);
    return options.filter(
      (o) => normalize(o.label).includes(nq) || normalize(o.subtitle || '').includes(nq)
    );
  }, [onSearch, options, remoteHits, search, selected]);

  const hintText = useMemo(() => {
    if (onSearch && search.trim().length < minSearchChars) {
      return t('crm_issue.picker_min_chars', { count: minSearchChars });
    }
    return emptyText || t('crm_issue.picker_empty');
  }, [onSearch, search, minSearchChars, emptyText, t]);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={75} fillHeight>
      <View className="flex-1 px-4 pb-4 pt-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-[#002855]">{title}</Text>
          <TouchableOpacity onPress={onClose} className="p-1">
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <TextInput
          className="mb-3 rounded-lg border border-gray-200 bg-[#F9FAFB] px-3 py-2.5 text-sm"
          placeholder={searchPlaceholder || t('crm_issue.picker_search_placeholder')}
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />

        {onClear && selected.length > 0 ? (
          <TouchableOpacity onPress={onClear} className="mb-2 self-start">
            <Text className="text-sm font-medium text-[#F05023]">
              {clearLabel || t('crm_issue.picker_clear')}
            </Text>
          </TouchableOpacity>
        ) : null}

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {searching ? <ActivityIndicator className="py-3" color="#002855" /> : null}
          {shown.length === 0 && !searching ? (
            <Text className="py-4 text-center text-sm text-gray-400">{hintText}</Text>
          ) : (
            shown.map((opt) => {
              const isPicked = selected.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => onToggle(opt.value, opt)}
                  className="flex-row items-center border-b border-gray-100 py-3">
                  <View className="min-w-0 flex-1 pr-2">
                    <Text className="text-base font-medium text-[#002855]" numberOfLines={2}>
                      {opt.label}
                    </Text>
                    {opt.subtitle ? (
                      <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                        {opt.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={isPicked ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isPicked ? '#10B981' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        <TouchableOpacity
          onPress={onClose}
          className="mt-3 items-center rounded-xl bg-[#002855] py-3">
          <Text className="font-semibold text-white">
            {t('crm_issue.picker_done', { count: selected.length })}
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};
