/**
 * Sheet chọn — kiểu picker DUY NHẤT của Vấn đề chung. Mọi dropdown trong module
 * (Năm học, Nhóm vấn đề, Loại vấn đề, Học sinh, Phụ huynh, Phòng ban, Nhóm liên quan,
 * Người liên quan, PIC, Mức độ) đều đi qua đây để trông và bấm giống hệt nhau.
 * Đừng dựng sheet chọn riêng nữa — trước đây mỗi ô một kiểu (chỗ checkbox vuông bên trái,
 * chỗ dấu tích bên phải, chỗ có nút "Xong" chỗ không) nên dùng rất lộn xộn.
 *
 * `mode='single'` cho ô chọn một: bấm là chọn xong và đóng luôn.
 *
 * Ba thứ tự điều chỉnh theo dữ liệu, callsite không phải khai:
 *  - Ô tìm chỉ hiện khi tìm ở server, hoặc danh sách tại chỗ đủ dài (≥8 mục).
 *  - Danh sách dài / tìm ở server mới ảo hoá + kéo cao hết sheet; danh sách ngắn thì
 *    sheet co theo nội dung cho gọn.
 *
 * Hai chế độ tìm:
 *  - `onSearch` không truyền → lọc client trên `options` (danh sách ngắn, đã tải sẵn).
 *  - `onSearch` có truyền  → hỏi server, debounce 300ms (danh bạ dài: user, phụ huynh).
 *    Chế độ này CÓ PHÂN TRANG: cuộn tới đáy thì xin trang kế, không đổ hết một lần.
 *
 * Danh sách render bằng `FlatList` (ảo hoá) chứ không `ScrollView` — danh bạ vài trăm dòng
 * mà mount hết thì cuộn giật.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';

export type PickerOption = {
  value: string;
  label: string;
  /** Dòng phụ: lớp học sinh, SĐT phụ huynh, email user… */
  subtitle?: string;
};

/** Một trang kết quả từ server */
export type PickerSearchPage = {
  items: PickerOption[];
  /** Còn trang sau không — quyết định có gọi tiếp khi cuộn tới đáy */
  hasMore: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  selected: string[];
  onToggle: (value: string, option: PickerOption) => void;
  /** 'single' = chọn một rồi đóng luôn (Năm học, Loại vấn đề, PIC, Mức độ…) */
  mode?: 'single' | 'multi';
  searchPlaceholder?: string;
  /** Tìm ở server theo trang (`page` bắt đầu từ 1); trả về danh sách hiển thị thay cho `options` */
  onSearch?: (term: string, page: number) => Promise<PickerSearchPage>;
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
  mode = 'multi',
  searchPlaceholder,
  onSearch,
  minSearchChars = 2,
  emptyText,
  onClear,
  clearLabel,
}) => {
  const { t } = useTranslation();
  /** Tìm ở server → luôn có ô tìm, luôn ảo hoá; danh sách tại chỗ thì tuỳ độ dài */
  const remote = !!onSearch;
  const searchable = remote || options.length >= 8;
  const virtualized = remote || options.length >= 20;
  const [search, setSearch] = useState('');
  const [remoteHits, setRemoteHits] = useState<PickerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  /** Chặn kết quả của lượt tìm cũ ghi đè lượt mới (gõ nhanh / cuộn khi vừa đổi từ khoá) */
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (visible) return;
    // Đóng sheet thì xoá từ khoá để lần mở sau bắt đầu sạch
    setSearch('');
    setRemoteHits([]);
    setHasMore(false);
    pageRef.current = 1;
  }, [visible]);

  useEffect(() => {
    if (!visible || !onSearch) return;
    const term = search.trim();
    if (term.length < minSearchChars) {
      setRemoteHits([]);
      setHasMore(false);
      setSearching(false);
      return;
    }
    const reqId = ++requestIdRef.current;
    setSearching(true);
    const timer = setTimeout(() => {
      pageRef.current = 1;
      void onSearch(term, 1)
        .then((page) => {
          if (requestIdRef.current !== reqId) return;
          setRemoteHits(page.items);
          setHasMore(page.hasMore);
        })
        .finally(() => {
          if (requestIdRef.current === reqId) setSearching(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [search, visible, onSearch, minSearchChars]);

  /** Cuộn tới đáy → xin trang kế. Bỏ qua nếu đang bận hoặc đã hết trang. */
  const loadMore = useCallback(() => {
    if (!onSearch || !hasMore || searching || loadingMore) return;
    const term = search.trim();
    if (term.length < minSearchChars) return;
    const reqId = requestIdRef.current;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    void onSearch(term, nextPage)
      .then((page) => {
        if (requestIdRef.current !== reqId) return;
        pageRef.current = nextPage;
        // Lọc trùng: server xếp hạng lại theo độ khớp nên trang sau có thể lặp dòng cũ
        setRemoteHits((prev) => {
          const seen = new Set(prev.map((o) => o.value));
          return [...prev, ...page.items.filter((o) => !seen.has(o.value))];
        });
        setHasMore(page.hasMore);
      })
      .finally(() => {
        if (requestIdRef.current === reqId) setLoadingMore(false);
      });
  }, [onSearch, hasMore, searching, loadingMore, search, minSearchChars]);

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
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      maxHeightPercent={75}
      fillHeight={virtualized}>
      <View className={`px-4 pb-4 pt-4 ${virtualized ? 'flex-1' : ''}`}>
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-[#002855]">{title}</Text>
          <TouchableOpacity onPress={onClose} className="p-1">
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {searchable ? (
          <TextInput
            className="mb-3 rounded-lg border border-gray-200 bg-[#F9FAFB] px-3 py-2.5 text-sm"
            placeholder={searchPlaceholder || t('crm_issue.picker_search_placeholder')}
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        ) : null}

        {onClear && selected.length > 0 ? (
          <TouchableOpacity onPress={onClear} className="mb-2 self-start">
            <Text className="text-sm font-medium text-[#F05023]">
              {clearLabel || t('crm_issue.picker_clear')}
            </Text>
          </TouchableOpacity>
        ) : null}

        <FlatList
          className={virtualized ? 'flex-1' : ''}
          data={shown}
          keyExtractor={(opt) => opt.value}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            searching ? <ActivityIndicator className="py-3" color="#002855" /> : null
          }
          ListEmptyComponent={
            searching ? null : (
              <Text className="py-4 text-center text-sm text-gray-400">{hintText}</Text>
            )
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator className="py-4" color="#002855" /> : null
          }
          renderItem={({ item: opt }) => {
            const isPicked = selected.includes(opt.value);
            return (
              <TouchableOpacity
                onPress={() => {
                  onToggle(opt.value, opt);
                  if (mode === 'single') onClose();
                }}
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
          }}
        />

        <TouchableOpacity
          onPress={onClose}
          className="mt-3 items-center rounded-xl bg-[#002855] py-3">
          <Text className="font-semibold text-white">
            {mode === 'single'
              ? t('common.close')
              : t('crm_issue.picker_done', { count: selected.length })}
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};
