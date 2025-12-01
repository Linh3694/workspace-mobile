import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';
import deviceService, { PaginationState } from '../services/deviceService';
import { Device, DeviceType, DeviceFilter, DeviceFilterOptions } from '../types/devices';

const INITIAL_PAGINATION: PaginationState = {
  page: 1,
  limit: 20,
  total: 0,
  hasNext: false,
  hasPrev: false,
  totalPages: 0,
  itemsPerPage: 20,
};

const INITIAL_FILTERS: DeviceFilter = {
  status: [],
  type: [],
  manufacturer: [],
  departments: [],
  yearRange: [2015, 2024],
};

interface UseDeviceListReturn {
  // State
  devices: Device[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  selectedType: DeviceType;
  pagination: PaginationState;
  searchQuery: string;
  appliedFilters: DeviceFilter;
  filterOptions: DeviceFilterOptions;
  showFilterModal: boolean;

  // Actions
  setSelectedType: (type: DeviceType) => void;
  setSearchQuery: (query: string) => void;
  setAppliedFilters: React.Dispatch<React.SetStateAction<DeviceFilter>>;
  setShowFilterModal: (show: boolean) => void;
  fetchDevices: (resetPagination?: boolean) => Promise<void>;
  handleLoadMore: () => void;
  handleRefresh: () => void;
  toggleFilter: (category: keyof DeviceFilter, value: string) => void;
  resetFilters: () => void;
  clearAllFilters: () => void;
  hasActiveFilters: () => boolean;
  setError: (error: string | null) => void;
}

export const useDeviceList = (): UseDeviceListReturn => {
  const navigation = useNavigation();

  // Refs for cleanup and preventing race conditions
  const isMountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Main state
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedTypeState] = useState<DeviceType>('laptop');

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<DeviceFilter>(INITIAL_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Filter options from API
  const [filterOptions, setFilterOptions] = useState<DeviceFilterOptions>({
    statuses: [],
    types: [],
    manufacturers: [],
    departments: [],
    yearRange: [2015, 2024],
  });

  // Memoized filters for API calls
  const apiFilters = useMemo(
    () => ({
      search: searchQuery.trim() || undefined,
      ...(appliedFilters.status && appliedFilters.status.length > 0 && { status: appliedFilters.status }),
      ...(appliedFilters.manufacturer && appliedFilters.manufacturer.length > 0 && { manufacturer: appliedFilters.manufacturer }),
      ...(appliedFilters.type && appliedFilters.type.length > 0 && { type: appliedFilters.type }),
      ...(appliedFilters.releaseYear && { releaseYear: appliedFilters.releaseYear }),
    }),
    [searchQuery, appliedFilters]
  );

  // Check if there are active filters
  const hasActiveFilters = useCallback(() => {
    const defaultYearRange = [2015, 2024];
    return (
      (appliedFilters.status?.length || 0) > 0 ||
      (appliedFilters.type?.length || 0) > 0 ||
      (appliedFilters.manufacturer?.length || 0) > 0 ||
      (appliedFilters.departments?.length || 0) > 0 ||
      (appliedFilters.yearRange?.[0] !== defaultYearRange[0]) ||
      (appliedFilters.yearRange?.[1] !== defaultYearRange[1]) ||
      searchQuery.trim().length > 0
    );
  }, [appliedFilters, searchQuery]);

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const options = await deviceService.getFilterOptions(selectedType);
      if (isMountedRef.current) {
        setFilterOptions(options);
      }
    } catch (err) {
      console.error('Error fetching filter options:', err);
      if (isMountedRef.current) {
        setFilterOptions({
          statuses: ['Active', 'Standby', 'Broken', 'PendingDocumentation'],
          types: [],
          manufacturers: [],
          departments: [],
          yearRange: [2015, 2024],
        });
      }
    }
  }, [selectedType]);

  // Main fetch function
  const fetchDevices = useCallback(async (resetPagination = false) => {
    const requestId = ++fetchRequestIdRef.current;
    const currentPage = resetPagination ? 1 : pagination.page;
    const isRefresh = resetPagination;

    if (currentPage === 1) {
      isRefresh ? setRefreshing(true) : setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      setError(null);

      const response = await deviceService.getDevicesByType(selectedType, apiFilters, {
        ...pagination,
        page: currentPage,
      });

      // Check if this is still the latest request and component is mounted
      if (requestId !== fetchRequestIdRef.current || !isMountedRef.current) {
        return;
      }

      const newDevices = response.populatedLaptops;

      if (currentPage === 1) {
        setDevices(newDevices);
      } else {
        setDevices((prev) => {
          const existingIds = new Set(prev.map((device) => device._id));
          const uniqueNewDevices = newDevices.filter((device) => !existingIds.has(device._id));
          return [...prev, ...uniqueNewDevices];
        });
      }

      setPagination(response.pagination);
    } catch (err) {
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
        return;
      }

      console.error('Error fetching devices:', err);
      const errorMessage = err instanceof Error ? err.message : 'Không thể tải danh sách thiết bị';
      setError(errorMessage);

      if (isRefresh || currentPage === 1) {
        Alert.alert('Lỗi kết nối', `${errorMessage}\n\nVui lòng kiểm tra kết nối mạng và thử lại.`);
      }

      if (currentPage === 1) {
        setDevices([]);
        setPagination({ ...pagination, total: 0, hasNext: false });
      }
    } finally {
      if (isMountedRef.current && requestId === fetchRequestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [selectedType, apiFilters, pagination]);

  // Handle type selection
  const setSelectedType = useCallback((type: DeviceType) => {
    setSelectedTypeState(type);
    setSearchQuery('');
    setAppliedFilters(INITIAL_FILTERS);
    setError(null);
    setPagination(INITIAL_PAGINATION);
  }, []);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && pagination.hasNext) {
      setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
      fetchDevices(false);
    }
  }, [loadingMore, pagination.hasNext, fetchDevices]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchDevices(true);
  }, [fetchDevices]);

  // Toggle filter
  const toggleFilter = useCallback((category: keyof DeviceFilter, value: string) => {
    setAppliedFilters((prev) => {
      const currentValues = prev[category];
      if (category === 'yearRange') return prev;

      const stringArray = currentValues as string[];
      return {
        ...prev,
        [category]: stringArray?.includes(value)
          ? stringArray.filter((item: string) => item !== value)
          : [...(stringArray || []), value],
      };
    });
  }, []);

  // Reset filters
  const resetFilters = useCallback(() => {
    setAppliedFilters(INITIAL_FILTERS);
  }, []);

  // Clear all filters and search
  const clearAllFilters = useCallback(() => {
    resetFilters();
    setSearchQuery('');
  }, [resetFilters]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Initial load
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      fetchDevices(true);
      fetchFilterOptions();
      initialLoadDoneRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect for device type changes
  useEffect(() => {
    if (initialLoadDoneRef.current) {
      fetchDevices(true);
      fetchFilterOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  // Debounced effect for search/filter updates
  useEffect(() => {
    if (!initialLoadDoneRef.current || !hasActiveFilters()) {
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        fetchDevices(true);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFilters]);

  // Navigation focus listener
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (initialLoadDoneRef.current && !loading && !refreshing && isMountedRef.current) {
        fetchDevices(true);
      }
    });

    return unsubscribe;
  }, [navigation, loading, refreshing, fetchDevices]);

  return {
    devices,
    loading,
    loadingMore,
    refreshing,
    error,
    selectedType,
    pagination,
    searchQuery,
    appliedFilters,
    filterOptions,
    showFilterModal,
    setSelectedType,
    setSearchQuery,
    setAppliedFilters,
    setShowFilterModal,
    fetchDevices,
    handleLoadMore,
    handleRefresh,
    toggleFilter,
    resetFilters,
    clearAllFilters,
    hasActiveFilters,
    setError,
  };
};

export default useDeviceList;

