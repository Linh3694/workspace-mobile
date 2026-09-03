import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText, Badge } from '@atoms';
import { FilterChipRow, InlineAlert, ListRow, SearchBar, resolveStatus } from '@molecules';
import { FAB_CLEARANCE, Fab, RefreshableList, useSheetQueue } from '@organisms';
import { ListScreen, SCREEN_PADDING } from '@templates';

import type { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import deviceService, { type PaginationState } from '../../services/deviceService';
import type { Device, DeviceFilter, DeviceFilterOptions, DeviceType } from '../../types/devices';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import { space } from '../../theme/tokens';

import DeviceFilterSheet from './components/DeviceFilterSheet';
import {
  DEVICE_STATUS,
  DEVICE_TYPES,
  deviceIcon,
  deviceTypeIcon,
  deviceTypeLabel,
} from './deviceStatus';

/**
 * Quản lý thiết bị — bản V2 dựng trên ui-v2.
 *
 * LOGIC NGHIỆP VỤ GIỮ NGUYÊN so với `DevicesScreen.tsx`: cùng service, cùng cách
 * phân trang, cùng chống race bằng requestId, cùng debounce 300ms. Đợt này chỉ đổi
 * tầng trình bày — để khi so hai bản mà thấy khác nhau thì chắc chắn do giao diện.
 *
 * So với V1: 998 dòng → còn ~1/3, 34 màu hex → 0, và toàn bộ giao diện đi qua token.
 */

type NavProp = NativeStackNavigationProp<RootStackParamList, typeof ROUTES.SCREENS.DEVICES>;
type ScreenRoute = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.DEVICES_V2>;

const DEFAULT_YEAR_RANGE: [number, number] = [2015, 2024];
const PAGE_SIZE = 20;

const emptyFilter = (): DeviceFilter => ({
  status: [],
  type: [],
  manufacturer: [],
  departments: [],
  yearRange: [...DEFAULT_YEAR_RANGE] as [number, number],
});

const emptyPagination = (): PaginationState => ({
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  hasNext: false,
  hasPrev: false,
  totalPages: 0,
  itemsPerPage: PAGE_SIZE,
});

/** Đếm số nhóm lọc đang bật — dùng cho badge và cho dòng tóm tắt dưới ô tìm kiếm. */
const countActiveFilters = (filter: DeviceFilter): number =>
  filter.status.length +
  filter.type.length +
  filter.manufacturer.length +
  filter.departments.length +
  (filter.yearRange[0] !== DEFAULT_YEAR_RANGE[0] || filter.yearRange[1] !== DEFAULT_YEAR_RANGE[1]
    ? 1
    : 0);

const DevicesScreenV2 = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<ScreenRoute>();
  const sheet = useSheetQueue<'filter'>();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DeviceType>('laptop');
  const [pagination, setPagination] = useState<PaginationState>(emptyPagination);

  const [searchQuery, setSearchQuery] = useState('');
  /** Bộ lọc ĐÃ áp dụng — thứ thật sự đi vào lời gọi API. */
  const [appliedFilters, setAppliedFilters] = useState<DeviceFilter>(emptyFilter);
  /**
   * Bộ lọc đang chỉnh trong sheet. Tách khỏi `appliedFilters` để nút "Huỷ bỏ" thật
   * sự huỷ được — V1 sửa thẳng vào bộ đã áp dụng nên mỗi lần chạm chip là gọi API,
   * và "Huỷ bỏ" không trả lại được trạng thái cũ.
   */
  const [draftFilters, setDraftFilters] = useState<DeviceFilter>(emptyFilter);

  const [filterOptions, setFilterOptions] = useState<DeviceFilterOptions>({
    statuses: [],
    types: [],
    manufacturers: [],
    departments: [],
    yearRange: DEFAULT_YEAR_RANGE,
  });

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(false);
  /**
   * Đổi nhóm thiết bị vừa gọi fetch ngay, vừa reset bộ lọc → `apiFilters` đổi
   * theo và effect debounce sẽ bắn thêm một lần nữa. Cờ này bỏ qua lần đó, để
   * một thao tác của người dùng chỉ sinh một lời gọi API.
   */
  const skipNextDebounceRef = useRef(false);
  /** Đọc trong `fetchDevices` để không phải đưa `pagination` vào deps (tránh vòng lặp). */
  const paginationRef = useRef(pagination);

  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  const activeFilterCount = countActiveFilters(appliedFilters);
  const hasAnyFilter = activeFilterCount > 0 || searchQuery.trim().length > 0;

  const apiFilters = useMemo(
    () => ({
      search: searchQuery.trim() || undefined,
      ...(appliedFilters.status.length > 0 && { status: appliedFilters.status }),
      ...(appliedFilters.manufacturer.length > 0 && { manufacturer: appliedFilters.manufacturer }),
      ...(appliedFilters.type.length > 0 && { type: appliedFilters.type }),
      ...(appliedFilters.releaseYear && { releaseYear: appliedFilters.releaseYear }),
    }),
    [searchQuery, appliedFilters]
  );

  const fetchDevices = useCallback(
    async (resetPagination = false, targetPage?: number) => {
      // Mỗi lời gọi mang một số thứ tự; phản hồi đến sau mà số cũ hơn thì bỏ đi.
      const requestId = ++requestIdRef.current;
      const currentPage = targetPage ?? (resetPagination ? 1 : paginationRef.current.page);

      if (currentPage === 1) {
        if (resetPagination) setRefreshing(true);
        else setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        setError(null);
        const response = await deviceService.getDevicesByType(selectedType, apiFilters, {
          ...paginationRef.current,
          page: currentPage,
        });

        if (requestId !== requestIdRef.current || !isMountedRef.current) return;

        const incoming = response.populatedLaptops;
        setDevices((prev) => {
          if (currentPage === 1) return incoming;
          const seen = new Set(prev.map((device) => device._id));
          return [...prev, ...incoming.filter((device) => !seen.has(device._id))];
        });
        setPagination(response.pagination);
      } catch (err) {
        if (requestId !== requestIdRef.current || !isMountedRef.current) return;

        const message = err instanceof Error ? err.message : 'Không thể tải danh sách thiết bị';
        setError(message);

        if (currentPage === 1) {
          setDevices([]);
          setPagination((prev) => ({ ...prev, total: 0, hasNext: false }));
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [selectedType, apiFilters]
  );

  const fetchFilterOptions = useCallback(async () => {
    try {
      const options = await deviceService.getFilterOptions(selectedType);
      if (isMountedRef.current) setFilterOptions(options);
    } catch {
      if (!isMountedRef.current) return;
      setFilterOptions({
        statuses: ['Active', 'Standby', 'Broken', 'PendingDocumentation'],
        types: [],
        manufacturers: [],
        departments: [],
        yearRange: DEFAULT_YEAR_RANGE,
      });
    }
  }, [selectedType]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Tải lần đầu, và tải lại mỗi khi đổi nhóm thiết bị.
  useEffect(() => {
    skipNextDebounceRef.current = true;
    fetchDevices(true);
    fetchFilterOptions();
    initialLoadRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  // Gõ tìm kiếm / đổi bộ lọc → chờ 300ms rồi mới gọi API.
  useEffect(() => {
    if (!initialLoadRef.current) return;
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (isMountedRef.current) fetchDevices(true);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFilters]);

  // Trang "Tạo mới" quay về kèm `refresh` -> tải lại, rồi xoá cờ để không lặp.
  useEffect(() => {
    if (!route.params?.refresh) return;
    fetchDevices(true);
    navigation.setParams({ refresh: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.refresh]);

  const handleTypeSelect = useCallback((type: DeviceType) => {
    setSelectedType(type);
    setSearchQuery('');
    setAppliedFilters(emptyFilter());
    setDraftFilters(emptyFilter());
    setPagination(emptyPagination());
    setError(null);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || !pagination.hasNext) return;
    const nextPage = pagination.page + 1;
    setPagination((prev) => ({ ...prev, page: nextPage }));
    fetchDevices(false, nextPage);
  }, [loading, loadingMore, pagination.hasNext, pagination.page, fetchDevices]);

  const handleClearAll = useCallback(() => {
    setSearchQuery('');
    setAppliedFilters(emptyFilter());
    setDraftFilters(emptyFilter());
  }, []);

  const handleOpenFilter = useCallback(() => {
    // Nạp bộ đã áp dụng vào bản nháp mỗi lần mở, để lần chỉnh trước bị huỷ không còn sót.
    setDraftFilters(appliedFilters);
    sheet.open('filter');
  }, [appliedFilters, sheet]);

  const handleApplyFilter = useCallback(() => {
    setAppliedFilters(draftFilters);
    sheet.close();
  }, [draftFilters, sheet]);

  const typeLabel = deviceTypeLabel(selectedType).toLowerCase();

  const renderDevice = useCallback(
    ({ item }: { item: Device }) => {
      const assignee = item.assigned?.[0];
      return (
        <ListRow
          icon={deviceIcon(item, selectedType)}
          title={item.name}
          subtitle={[item.manufacturer, item.releaseYear].filter(Boolean).join(' · ') || undefined}
          status={resolveStatus(item.status, DEVICE_STATUS)}
          onPress={() =>
            navigation.navigate(ROUTES.SCREENS.DEVICE_DETAIL, {
              deviceId: item._id,
              deviceType: selectedType,
            })
          }
          footer={
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: space[8],
              }}>
              <AppText variant="footnote" style={{ flex: 1 }} numberOfLines={1}>
                {assignee ? normalizeVietnameseName(assignee.fullname) : 'Chưa bàn giao'}
              </AppText>
              {assignee?.department ? (
                <Badge label={assignee.department} tone="accent" />
              ) : item.room?.name ? (
                <Badge label={item.room.name} tone="neutral" />
              ) : null}
            </View>
          }
        />
      );
    },
    [navigation, selectedType]
  );

  return (
    <ListScreen
      header={{
        title: 'Quản lý thiết bị',
        subtitle: pagination.total > 0 ? `${pagination.total} thiết bị` : undefined,
        onBack: () => navigation.goBack(),
      }}
      toolbar={
        <>
          {error ? (
            <View style={{ paddingHorizontal: SCREEN_PADDING }}>
              <InlineAlert message={error} onDismiss={() => setError(null)} />
            </View>
          ) : null}

          <FilterChipRow
            items={DEVICE_TYPES.map((item) => ({
              value: item.type,
              label: item.label,
              icon: item.icon,
            }))}
            value={selectedType}
            onChange={handleTypeSelect}
          />

          <View style={{ paddingHorizontal: SCREEN_PADDING }}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Tìm ${typeLabel}…`}
              filterCount={activeFilterCount}
              onOpenFilter={handleOpenFilter}
              onClearAll={hasAnyFilter ? handleClearAll : undefined}
            />
          </View>
        </>
      }
      floating={
        <Fab
          accessibilityLabel="Thêm thiết bị mới"
          onPress={() => navigation.navigate(ROUTES.SCREENS.DEVICE_CREATE, { deviceType: selectedType })}
        />
      }
      overlays={
        <DeviceFilterSheet
          visible={sheet.isOpen('filter')}
          onClose={sheet.close}
          onClosed={sheet.handleClosed}
          value={draftFilters}
          onChange={setDraftFilters}
          options={filterOptions}
          showTypeFilter={selectedType === 'laptop'}
          onReset={() => setDraftFilters(emptyFilter())}
          onApply={handleApplyFilter}
          activeCount={countActiveFilters(draftFilters)}
        />
      }>
      <RefreshableList
        data={devices}
        renderItem={renderDevice}
        keyExtractor={(item, index) => item._id || `device-${index}`}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={() => fetchDevices(true)}
        onEndReached={handleLoadMore}
        bottomInset={FAB_CLEARANCE}
        empty={{
          icon: deviceTypeIcon(selectedType),
          title: `Chưa có ${typeLabel} nào`,
          description: hasAnyFilter
            ? 'Không có kết quả khớp với bộ lọc hiện tại.'
            : 'Danh sách sẽ hiện ở đây khi có thiết bị được thêm vào.',
          actionLabel: hasAnyFilter ? 'Xoá bộ lọc' : 'Tải lại',
          onAction: hasAnyFilter ? handleClearAll : () => fetchDevices(true),
        }}
      />
    </ListScreen>
  );
};

export default DevicesScreenV2;
