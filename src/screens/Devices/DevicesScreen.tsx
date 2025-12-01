import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import deviceService, { PaginationState } from '../../services/deviceService';
import { Device, DeviceType, DeviceFilter, DeviceFilterOptions } from '../../types/devices';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import CreateDeviceModal, { CreateDeviceData } from './components/CreateDeviceModal';

type DevicesScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.DEVICES
>;
type DevicesScreenRouteProp = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.DEVICES>;

const DevicesScreen = () => {
  const navigation = useNavigation<DevicesScreenNavigationProp>();
  const route = useRoute<DevicesScreenRouteProp>();
  const insets = useSafeAreaInsets();

  // Refs for cleanup and preventing race conditions
  const isMountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const fetchDevicesRef = useRef<((resetPagination?: boolean, targetPage?: number) => Promise<void>) | null>(null);
  const loadingRef = useRef(false);
  const refreshingRef = useRef(false);

  // Main state
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DeviceType>('laptop');
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    hasNext: false,
    hasPrev: false,
    totalPages: 0,
    itemsPerPage: 20,
  });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<DeviceFilter>({
    status: [],
    type: [],
    manufacturer: [],
    departments: [],
    yearRange: [2015, 2024],
  });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter options from API
  const [filterOptions, setFilterOptions] = useState<DeviceFilterOptions>({
    statuses: [],
    types: [],
    manufacturers: [],
    departments: [],
    yearRange: [2015, 2024],
  });

  // Device types configuration (updated with phone)
  const deviceTypes = [
    { type: 'laptop' as DeviceType, icon: 'laptop', label: 'Laptop' },
    { type: 'monitor' as DeviceType, icon: 'monitor', label: 'Monitor' },
    { type: 'printer' as DeviceType, icon: 'printer', label: 'Printer' },
    { type: 'projector' as DeviceType, icon: 'projector', label: 'Projector' },
    { type: 'phone' as DeviceType, icon: 'cellphone', label: 'Phone' },
    { type: 'tool' as DeviceType, icon: 'toolbox', label: 'Tools' },
  ];

  // Device subcategories with specific icons
  const deviceSubcategories = {
    laptop: [
      { subtype: 'laptop', icon: 'laptop', label: 'Laptop' },
      { subtype: 'desktop', icon: 'desktop-tower', label: 'Desktop' },
      { subtype: 'macbook', icon: 'apple', label: 'MacBook' },
    ],
    monitor: [
      { subtype: 'lcd', icon: 'monitor', label: 'LCD Monitor' },
      { subtype: 'led', icon: 'monitor-dashboard', label: 'LED Monitor' },
      { subtype: 'ultrawide', icon: 'monitor-multiple', label: 'Ultrawide' },
    ],
    printer: [
      { subtype: 'laser', icon: 'printer', label: 'Laser Printer' },
      { subtype: 'inkjet', icon: 'printer-outline', label: 'Inkjet' },
      { subtype: 'multifunction', icon: 'printer-3d-nozzle', label: 'Multifunction' },
    ],
    projector: [
      { subtype: 'dlp', icon: 'projector', label: 'DLP Projector' },
      { subtype: 'lcd_projector', icon: 'projector-screen', label: 'LCD Projector' },
      { subtype: 'portable', icon: 'projector-screen-outline', label: 'Portable' },
    ],
    tool: [
      { subtype: 'hardware', icon: 'tools', label: 'Hardware Tools' },
      { subtype: 'network', icon: 'router-wireless', label: 'Network Tools' },
      { subtype: 'maintenance', icon: 'wrench', label: 'Maintenance' },
    ],
  };

  // Memoized filters for API calls
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

  // fetchDevices function - defined BEFORE useEffects that use it
  const fetchDevices = useCallback(async (resetPagination: boolean = false, targetPage?: number) => {
    // Increment request ID to track this specific request
    const requestId = ++fetchRequestIdRef.current;
    
    // Use targetPage if provided, otherwise use pagination.page or 1 if reset
    const currentPage = targetPage ?? (resetPagination ? 1 : pagination.page);
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
        return; // Discard stale response
      }

      const newDevices = response.populatedLaptops;

      if (currentPage === 1) {
        setDevices(newDevices);
      } else {
        // Merge with existing devices, avoid duplicates
        setDevices((prev) => {
          const existingIds = new Set(prev.map((device) => device._id));
          const uniqueNewDevices = newDevices.filter((device) => !existingIds.has(device._id));
          return [...prev, ...uniqueNewDevices];
        });
      }

      setPagination(response.pagination);
    } catch (error) {
      // Check if component is still mounted
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
        return;
      }
      
      console.error('Error fetching devices:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Không thể tải danh sách thiết bị';
      setError(errorMessage);

      // Show alert for manual refresh or first page errors
      if (isRefresh || currentPage === 1) {
        Alert.alert('Lỗi kết nối', `${errorMessage}\n\nVui lòng kiểm tra kết nối mạng và thử lại.`);
      }

      // Set empty state on error
      if (currentPage === 1) {
        setDevices([]);
        setPagination({ ...pagination, total: 0, hasNext: false });
      }
    } finally {
      // Always reset loading states if component is mounted
      // Don't check requestId here - loading states should always be reset
      if (isMountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [selectedType, apiFilters, pagination]);

  // Update ref whenever fetchDevices changes
  useEffect(() => {
    fetchDevicesRef.current = fetchDevices;
  }, [fetchDevices]);

  // Sync loading/refreshing refs with state to avoid stale closures
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  // Navigation focus listener - disabled to prevent race conditions
  // User can pull-to-refresh to update data when returning from detail screen
  // useEffect(() => {
  //   const unsubscribe = navigation.addListener('focus', () => {
  //     if (initialLoadDone && !loadingRef.current && !refreshingRef.current && isMountedRef.current) {
  //       fetchDevicesRef.current?.(true);
  //     }
  //   });
  //   return unsubscribe;
  // }, [navigation, initialLoadDone]);

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

  // Initial load effect - only runs once on mount
  useEffect(() => {
    if (!initialLoadDone) {
      fetchDevices(true);
      fetchFilterOptions();
      setInitialLoadDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect for device type changes
  useEffect(() => {
    if (initialLoadDone) {
      fetchDevices(true);
      fetchFilterOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  // Debounced effect for search/filter updates
  useEffect(() => {
    // Skip if initial load not done or no active filters
    if (!initialLoadDone || !hasActiveFilters()) {
      return;
    }

    // Clear previous debounce
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
  }, [apiFilters, initialLoadDone]);

  const fetchFilterOptions = async () => {
    try {
      const options = await deviceService.getFilterOptions(selectedType);
      setFilterOptions(options);
    } catch (error) {
      console.error('Error fetching filter options:', error);
      // Provide fallback filter options
      setFilterOptions({
        statuses: ['Active', 'Standby', 'Broken', 'PendingDocumentation'],
        types: [],
        manufacturers: [],
        departments: [],
        yearRange: [2015, 2024],
      });
    }
  };

  // Note: Filtering is now handled at API level

  const handleGoBack = () => {
    try {
      navigation.goBack();
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const handleTypeSelect = (type: DeviceType) => {
    setSelectedType(type);
    setSearchQuery('');
    setAppliedFilters({
      status: [],
      type: [],
      manufacturer: [],
      departments: [],
      yearRange: [2015, 2024], // Default year range
    });
    setError(null);
    // Reset pagination state
    setPagination({
      page: 1,
      limit: 20,
      total: 0,
      hasNext: false,
      hasPrev: false,
      totalPages: 0,
      itemsPerPage: 20,
    });
  };

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && !loading && pagination.hasNext) {
      const nextPage = pagination.page + 1;
      setPagination((prev) => ({ ...prev, page: nextPage }));
      fetchDevices(false, nextPage);
    }
  }, [loadingMore, loading, pagination.hasNext, pagination.page, fetchDevices]);

  const handleRefresh = useCallback(() => {
    fetchDevices(true);
  }, [selectedType, apiFilters]);

  // Handle create device
  const handleCreateDevice = useCallback(async (deviceData: CreateDeviceData) => {
    await deviceService.createDevice(selectedType, deviceData);
  }, [selectedType]);

  const handleCreateSuccess = useCallback(() => {
    Alert.alert('Thành công', 'Tạo thiết bị mới thành công!');
    fetchDevices(true); // Refresh list
  }, []);

  // Helper functions for filter options - now using API data
  const getUniqueStatuses = () => {
    return filterOptions.statuses;
  };

  const getUniqueTypes = () => {
    return filterOptions.types;
  };

  const getUniqueManufacturers = () => {
    return filterOptions.manufacturers;
  };

  const getUniqueDepartments = () => {
    return filterOptions.departments;
  };

  const getYearRange = () => {
    return filterOptions.yearRange;
  };

  const toggleFilter = (category: keyof typeof appliedFilters, value: string) => {
    setAppliedFilters((prev) => {
      const currentValues = prev[category];
      if (category === 'yearRange') return prev; // Handle yearRange separately

      const stringArray = currentValues as string[];
      return {
        ...prev,
        [category]: stringArray.includes(value)
          ? stringArray.filter((item: string) => item !== value)
          : [...stringArray, value],
      };
    });
  };

  const resetFilters = () => {
    setAppliedFilters({
      status: [],
      type: [],
      manufacturer: [],
      yearRange: [2015, 2024], // Default year range
      departments: [],
    });
  };

  const hasActiveFilters = () => {
    const defaultYearRange = [2015, 2024]; // Default year range from initial state
    return (
      appliedFilters.status.length > 0 ||
      appliedFilters.type.length > 0 ||
      appliedFilters.manufacturer.length > 0 ||
      appliedFilters.departments.length > 0 ||
      appliedFilters.yearRange[0] !== defaultYearRange[0] ||
      appliedFilters.yearRange[1] !== defaultYearRange[1] ||
      searchQuery.trim().length > 0
    );
  };

  const clearAllFilters = () => {
    resetFilters();
    setSearchQuery('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return '#3DB838';
      case 'Standby':
        return '#F59E0B';
      case 'Broken':
        return '#EF4444';
      case 'PendingDocumentation':
        return '#EAA300';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Active':
        return 'Đang sử dụng';
      case 'Standby':
        return 'Sẵn sàng';
      case 'Broken':
        return 'Hỏng';
      case 'PendingDocumentation':
        return 'Chờ xử lý';
      default:
        return 'Không xác định';
    }
  };

  const getDeviceIcon = (device: Device, deviceType: DeviceType) => {
    // Get subcategories for the current device type
    const subcategories = deviceSubcategories[deviceType] || [];

    // Try to match device type, manufacturer or name to get specific icon
    if (device.manufacturer || device.name) {
      const manufacturerLower = (device.manufacturer || '').toLowerCase();
      const nameLower = device.name.toLowerCase();

      // Special logic for laptop type
      if (deviceType === 'laptop') {
        if (
          manufacturerLower.includes('apple') ||
          nameLower.includes('macbook') ||
          nameLower.includes('mac')
        ) {
          return 'apple';
        } else if (nameLower.includes('desktop') || (device as any).type === 'Desktop') {
          return 'desktop-tower';
        } else {
          return 'laptop';
        }
      }

      // Find matching subcategory based on manufacturer or name
      const matchedSubcategory = subcategories.find(
        (sub) =>
          manufacturerLower.includes(sub.subtype) ||
          nameLower.includes(sub.subtype) ||
          nameLower.includes(sub.label.toLowerCase())
      );

      if (matchedSubcategory) {
        return matchedSubcategory.icon;
      }
    }

    // Default to first subcategory icon or main device type icon
    return (
      subcategories[0]?.icon || deviceTypes.find((t) => t.type === deviceType)?.icon || 'desktop'
    );
  };

  const handleDevicePress = (device: Device) => {
    navigation.navigate(ROUTES.SCREENS.DEVICE_DETAIL, {
      deviceId: device._id,
      deviceType: selectedType,
    });
  };

  const renderDeviceCard = (device: Device) => (
    <TouchableOpacity
      onPress={() => handleDevicePress(device)}
      className="mb-3 rounded-xl bg-[#f8f8f8] p-4">
      {/* Row 1: Device Name and Status */}
      <View className="flex-row items-center justify-between">
        <Text
          className="mr-2 flex-1 font-bold text-lg text-[#F05023]"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ maxWidth: '50%' }}>
          {device.name}
        </Text>
        <View className="flex-row items-center">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: getStatusColor(device.status) }}
          />
          <View className="rounded-lg p-2">
            <MaterialCommunityIcons
              name={getDeviceIcon(device, selectedType) as any}
              size={20}
              color="#002855"
            />
          </View>
        </View>
      </View>

      {/* Row 2: Manufacturer/Year and Room */}
      <View className="mb-2 flex-row items-center justify-between">
        <Text
          className="mr-2 flex-1 text-sm text-[#757575]"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ maxWidth: '50%' }}>
          {device.manufacturer && `${device.manufacturer} - `}
          {device.releaseYear || 'N/A'}
        </Text>
        <Text
          className="flex-1 text-right font-medium text-sm text-[#757575]"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ maxWidth: '50%' }}>
          {device.room ? `${device.room.name}` : 'Không xác định'}
        </Text>
      </View>

      {/* Row 3: Assigned User and Department */}
      <View className="flex-row items-center justify-between">
        <Text
          className="mr-2 flex-1 font-semibold text-sm text-primary"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ maxWidth: '50%' }}>
          {device.assigned.length > 0
            ? normalizeVietnameseName(device.assigned[0].fullname)
            : 'Không xác định'}
        </Text>
        <View className="rounded-3xl bg-[#F5AA1E] px-3 py-1" style={{ maxWidth: '50%' }}>
          <Text
            className="text-center font-medium text-xs text-white"
            numberOfLines={1}
            ellipsizeMode="tail">
            {device.assigned.length > 0 ? device.assigned[0].department : 'Không xác định'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1">
      <SafeAreaView
        className="flex-1"
        style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
        {/* Header */}
        <View className="mb-5 mt-6 flex-row items-center justify-between px-5">
          <TouchableOpacity onPress={handleGoBack} className="p-2">
            <Ionicons name="chevron-back" size={24} color="#0A2240" />
          </TouchableOpacity>
          <Text className="flex-1 text-center font-bold text-2xl text-[#0A2240]">
            Quản lý thiết bị
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View className="flex-1">
          {/* Error Banner */}
          {error && (
            <View className="mx-5 mb-3 rounded border-l-4 border-red-500 bg-red-100 p-3">
              <View className="flex-row items-center">
                <Ionicons name="warning" size={20} color="#DC2626" />
                <Text className="ml-2 flex-1 text-sm text-red-700">{error}</Text>
                <TouchableOpacity onPress={() => setError(null)} className="ml-2">
                  <Ionicons name="close" size={20} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Device Type Icons */}
          <View className="flex-row justify-around px-10 py-4 ">
            {deviceTypes.map((deviceType) => (
              <TouchableOpacity
                key={deviceType.type}
                className={`h-12 w-12 items-center justify-center rounded-full ${
                  selectedType === deviceType.type ? 'bg-primary' : 'bg-[#f8f8f8]'
                }`}
                onPress={() => handleTypeSelect(deviceType.type)}>
                <MaterialCommunityIcons
                  name={deviceType.icon as any}
                  size={24}
                  color={selectedType === deviceType.type ? '#fff' : '#002855'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Bar */}
          <View className="px-5">
            <View className="flex-row items-center rounded-xl border-none bg-[#f8f8f8] px-4 py-3">
              <Ionicons name="search" size={20} color="#666" />
              <TextInput
                className="ml-2.5 flex-1 border-none text-base text-gray-800"
                placeholder={`Tìm kiếm ${deviceTypes.find((t) => t.type === selectedType)?.label.toLowerCase()}`}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {hasActiveFilters() && (
                <TouchableOpacity onPress={clearAllFilters} className="ml-2 p-1">
                  <Ionicons name="close-circle" size={20} color="#F05023" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowFilterModal(true)} className="ml-2 p-1">
                <Ionicons
                  name={hasActiveFilters() ? 'options' : 'options-outline'}
                  size={20}
                  color={hasActiveFilters() ? '#F05023' : '#666'}
                />
              </TouchableOpacity>
            </View>
            {hasActiveFilters() && (
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-sm text-[#F05023]">
                  Có{' '}
                  {[
                    appliedFilters.status.length,
                    appliedFilters.type.length,
                    appliedFilters.manufacturer.length,
                    appliedFilters.departments.length,
                    appliedFilters.yearRange[0] !== 2015 || appliedFilters.yearRange[1] !== 2024
                      ? 1
                      : 0,
                    searchQuery.trim().length > 0 ? 1 : 0,
                  ].reduce((a, b) => a + b, 0)}{' '}
                  bộ lọc đang áp dụng
                </Text>
                <TouchableOpacity onPress={clearAllFilters}>
                  <Text className="font-medium text-sm text-[#F05023]">Xóa tất cả</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Device List */}
          <FlatList
            data={devices}
            renderItem={({ item }) => renderDeviceCard(item)}
            keyExtractor={(item, index) => item._id || `device-${index}`}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#002855']}
                tintColor="#002855"
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.1}
            ListFooterComponent={() => {
              if (loadingMore) {
                return (
                  <View className="items-center justify-center py-4">
                    <ActivityIndicator size="small" color="#002855" />
                    <Text className="mt-2 text-sm text-[#002855]">Đang tải thêm...</Text>
                  </View>
                );
              }
              return null;
            }}
            ListEmptyComponent={() => {
              if (loading) {
                return (
                  <View className="items-center justify-center py-10">
                    <ActivityIndicator size="large" color="#002855" />
                    <Text className="mt-3 text-base text-[#002855]">Đang tải thiết bị...</Text>
                  </View>
                );
              }
              return (
                <View className="py-15 items-center justify-center">
                  <MaterialCommunityIcons
                    name={deviceTypes.find((t) => t.type === selectedType)?.icon as any}
                    size={60}
                    color="#ccc"
                  />
                  <Text className="mb-4 mt-3 text-center text-base text-gray-600">
                    Không có {deviceTypes.find((t) => t.type === selectedType)?.label.toLowerCase()}{' '}
                    nào
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      fetchDevices(true);
                    }}
                    className="rounded-lg bg-primary px-6 py-3">
                    <Text className="font-semibold text-white">Thử lại</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </View>

        {/* Add Device Button */}
        {/* <TouchableOpacity className="absolute bottom-[10%] right-[5%] w-14 h-14 rounded-full bg-orange-500 items-center justify-center shadow-lg">
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity> */}

        {/* Filter Modal */}
        <Modal
          visible={showFilterModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowFilterModal(false)}>
          <View className="flex-1 justify-end bg-black/50">
            <View
              className="flex-1 rounded-t-3xl bg-white"
              style={{
                maxHeight: '85%',
                minHeight: '50%',
                marginTop: 100,
              }}>
              {/* Header */}
              <View className="flex-row items-center justify-between border-b border-gray-200 p-5">
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
                <View className="flex-row items-center">
                  <Text className="font-semibold text-lg text-primary">Bộ lọc</Text>
                  {hasActiveFilters() && (
                    <View className="ml-2 h-5 w-5 items-center justify-center rounded-full bg-[#F05023]">
                      <Text className="font-bold text-xs text-white">
                        {[
                          appliedFilters.status.length,
                          appliedFilters.type.length,
                          appliedFilters.manufacturer.length,
                          appliedFilters.departments.length,
                          appliedFilters.yearRange[0] !== 2015 ||
                          appliedFilters.yearRange[1] !== 2024
                            ? 1
                            : 0,
                        ].reduce((a, b) => a + b, 0)}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={clearAllFilters}>
                  <Ionicons name="refresh" size={24} color="#F05023" />
                </TouchableOpacity>
              </View>

              <ScrollView
                className="p-5"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                style={{ flex: 1 }}>
                {/* Status Filter */}
                <View className="mb-6">
                  <Text className="mb-3 font-semibold text-base text-gray-800">Trạng thái</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {getUniqueStatuses().map((status) => (
                      <TouchableOpacity
                        key={status}
                        onPress={() => toggleFilter('status', status)}
                        className={`rounded-full border px-4 py-2 ${
                          appliedFilters.status.includes(status)
                            ? 'border-primary bg-primary'
                            : 'border-gray-300 bg-gray-100'
                        }`}>
                        <Text
                          className={`text-sm ${
                            appliedFilters.status.includes(status) ? 'text-white' : 'text-gray-700'
                          }`}>
                          {getStatusLabel(status)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Type Filter (only for laptops) */}
                {selectedType === 'laptop' && getUniqueTypes().length > 0 && (
                  <View className="mb-6">
                    <Text className="mb-3 font-semibold text-base text-gray-800">Loại</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {getUniqueTypes().map((type) => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => toggleFilter('type', type)}
                          className={`rounded-full border px-4 py-2 ${
                            appliedFilters.type.includes(type)
                              ? 'border-primary bg-primary'
                              : 'border-gray-300 bg-gray-100'
                          }`}>
                          <Text
                            className={`text-sm ${
                              appliedFilters.type.includes(type) ? 'text-white' : 'text-gray-700'
                            }`}>
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Manufacturer Filter */}
                {getUniqueManufacturers().length > 0 && (
                  <View className="mb-6">
                    <Text className="mb-3 font-semibold text-base text-gray-800">Nhà sản xuất</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {getUniqueManufacturers().map((manufacturer) => (
                        <TouchableOpacity
                          key={manufacturer}
                          onPress={() => toggleFilter('manufacturer', manufacturer!)}
                          className={`rounded-full border px-4 py-2 ${
                            appliedFilters.manufacturer.includes(manufacturer!)
                              ? 'border-primary bg-primary'
                              : 'border-gray-300 bg-gray-100'
                          }`}>
                          <Text
                            className={`text-sm ${
                              appliedFilters.manufacturer.includes(manufacturer!)
                                ? 'text-white'
                                : 'text-gray-700'
                            }`}>
                            {manufacturer}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Year Range Filter */}
                <View className="mb-6">
                  <Text className="mb-3 font-semibold text-base text-gray-800">Năm sản xuất</Text>
                  <View className="px-4">
                    {/* <View className="flex-row justify-between mb-2">
                                            <Text className="text-sm text-gray-600">{filters.yearRange[0]}</Text>
                                            <Text className="text-sm text-gray-600">{filters.yearRange[1]}</Text>
                                        </View> */}
                    <View className="px-4">
                      <View className="flex-row items-center space-x-4">
                        <View className="flex-1">
                          <Text className="mb-1 text-xs text-gray-500">Từ năm:</Text>
                          <TextInput
                            className="rounded-lg border border-gray-300 px-3 py-2 text-center"
                            value={appliedFilters.yearRange[0].toString()}
                            onChangeText={(text) => {
                              const value = parseInt(text);
                              if (!isNaN(value)) {
                                setAppliedFilters((prev) => ({
                                  ...prev,
                                  yearRange: [value, prev.yearRange[1]],
                                }));
                              } else if (text === '') {
                                setAppliedFilters((prev) => ({
                                  ...prev,
                                  yearRange: [getYearRange()[0], prev.yearRange[1]],
                                }));
                              }
                            }}
                            keyboardType="numeric"
                            maxLength={4}
                          />
                        </View>
                        <Text className="mt-4 text-gray-500">-</Text>
                        <View className="flex-1">
                          <Text className="mb-1 text-xs text-gray-500">Đến năm:</Text>
                          <TextInput
                            className="rounded-lg border border-gray-300 px-3 py-2 text-center"
                            value={appliedFilters.yearRange[1].toString()}
                            onChangeText={(text) => {
                              const value = parseInt(text);
                              if (!isNaN(value)) {
                                setAppliedFilters((prev) => ({
                                  ...prev,
                                  yearRange: [prev.yearRange[0], value],
                                }));
                              } else if (text === '') {
                                setAppliedFilters((prev) => ({
                                  ...prev,
                                  yearRange: [prev.yearRange[0], getYearRange()[1]],
                                }));
                              }
                            }}
                            keyboardType="numeric"
                            maxLength={4}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Department Filter */}
                {getUniqueDepartments().length > 0 && (
                  <View className="mb-6">
                    <Text className="mb-3 font-semibold text-base text-gray-800">Phòng ban</Text>
                    <View>
                      {getUniqueDepartments().map((department) => (
                        <TouchableOpacity
                          key={department}
                          onPress={() => toggleFilter('departments', department!)}
                          className="mb-4 flex-row items-center">
                          <View
                            className={`mr-3 h-5 w-5 items-center justify-center rounded border-2 ${
                              appliedFilters.departments.includes(department!)
                                ? 'border-primary bg-primary'
                                : 'border-gray-300 bg-white'
                            }`}>
                            {appliedFilters.departments.includes(department!) && (
                              <Ionicons name="checkmark" size={12} color="white" />
                            )}
                          </View>
                          <Text className="flex-1 text-gray-700">{department}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Bottom Actions */}
              <View className="border-t border-gray-200 p-5">
                <TouchableOpacity
                  onPress={() => setShowFilterModal(false)}
                  className="mb-3 w-full items-center rounded-full bg-[#F05023] py-4">
                  <Text className="font-semibold text-base text-white">Lưu</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    resetFilters();
                    setShowFilterModal(false);
                  }}
                  className="w-full items-center rounded-full bg-[#E5E5E5] py-4">
                  <Text className="font-semibold text-base text-[#757575]">Hủy bỏ</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Floating Action Button - Tạo mới thiết bị */}
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          className="absolute bottom-[10%] right-5 h-14 w-14 items-center justify-center rounded-full bg-[#F05023] shadow-lg"
          style={{ elevation: 5 }}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Create Device Modal */}
        <CreateDeviceModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
          deviceType={selectedType}
          onCreateDevice={handleCreateDevice}
        />
      </SafeAreaView>
    </View>
  );
};

export default DevicesScreen;
