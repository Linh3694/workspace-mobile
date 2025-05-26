import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert, RefreshControl, Modal, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import deviceService from '../../services/deviceService';
import { Device, DeviceType, DeviceFilter } from '../../types/devices';

type DevicesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, typeof ROUTES.SCREENS.DEVICES>;

const DevicesScreen = () => {
    const navigation = useNavigation<DevicesScreenNavigationProp>();
    const [devices, setDevices] = useState<Device[]>([]);
    const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedType, setSelectedType] = useState<DeviceType>('laptop');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [pagination, setPagination] = useState<any>({});
    const [error, setError] = useState<string | null>(null);
    
    // Filter states
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filters, setFilters] = useState({
        status: [] as string[],
        type: [] as string[],
        manufacturer: [] as string[],
        yearRange: [2015, 2024] as [number, number],
        departments: [] as string[]
    });
    
    // Filter options from API
    const [filterOptions, setFilterOptions] = useState({
        statuses: [] as string[],
        types: [] as string[],
        manufacturers: [] as string[],
        departments: [] as string[],
        yearRange: [2015, 2024] as [number, number]
    });

    const deviceTypes = [
        { type: 'laptop' as DeviceType, icon: 'laptop', label: 'Laptop' },
        { type: 'monitor' as DeviceType, icon: 'monitor', label: 'Monitor' },
        { type: 'printer' as DeviceType, icon: 'printer', label: 'Printer' },
        { type: 'projector' as DeviceType, icon: 'projector', label: 'Projector' },
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

    useEffect(() => {
        console.log('DevicesScreen mounted');
        setCurrentPage(1);
        setHasNextPage(true);
        fetchDevices(1);
        fetchFilterOptions();
    }, [selectedType]);

    useEffect(() => {
        filterDevices();
    }, [devices, searchQuery, filters]);

    const fetchDevices = async (page: number = 1, isRefresh: boolean = false) => {
        console.log('Fetching devices for type:', selectedType, 'page:', page);
        
        if (page === 1) {
            isRefresh ? setRefreshing(true) : setLoading(true);
        } else {
            setLoadingMore(true);
        }
        
        try {
            setError(null); // Clear previous errors
            const response = await deviceService.getDevicesByType(selectedType, page, 20);
            
            if (page === 1) {
                setDevices(response.devices || []);
            } else {
                // Filter out duplicates when adding new pages
                const newDevices = response.devices || [];
                setDevices(prev => {
                    const existingIds = new Set(prev.map(device => device._id));
                    const uniqueNewDevices = newDevices.filter(device => !existingIds.has(device._id));
                    return [...prev, ...uniqueNewDevices];
                });
            }
            
            setPagination(response.pagination || {});
            setHasNextPage(response.pagination?.hasNext || false);
            setCurrentPage(page);
        } catch (error) {
            console.error('Error fetching devices:', error);
            
            // Provide fallback empty data on first page load
            if (page === 1) {
                setDevices([]);
                setPagination({});
                setHasNextPage(false);
            }
            
            // Show user-friendly error message
            const errorMessage = error instanceof Error ? error.message : 'Không thể tải danh sách thiết bị';
            setError(errorMessage);
            
            // Only show alert for manual refresh, not automatic load
            if (isRefresh || page === 1) {
                Alert.alert('Lỗi kết nối', `${errorMessage}\n\nVui lòng kiểm tra kết nối mạng và thử lại.`);
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    };

    const fetchFilterOptions = async () => {
        try {
            const options = await deviceService.getFilterOptions(selectedType);
            setFilterOptions(options);
            setFilters(prev => ({
                ...prev,
                yearRange: options.yearRange || [2015, 2024]
            }));
        } catch (error) {
            console.error('Error fetching filter options:', error);
            // Provide fallback filter options
            const fallbackOptions = {
                statuses: ['Active', 'Standby', 'Broken', 'PendingDocumentation'],
                types: [],
                manufacturers: [],
                departments: [],
                yearRange: [2015, 2024] as [number, number]
            };
            setFilterOptions(fallbackOptions);
            setFilters(prev => ({
                ...prev,
                yearRange: [2015, 2024]
            }));
        }
    };

    const filterDevices = () => {
        let filtered = [...devices];

        // Apply search query - search across multiple fields
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(device => {
                const searchFields = [
                    device.name.toLowerCase(),
                    (device.manufacturer || '').toLowerCase(),
                    device.releaseYear?.toString() || '',
                    (device.room?.name || '').toLowerCase(),
                    (device.assigned[0]?.fullname || '').toLowerCase(),
                    (device.assigned[0]?.department || '').toLowerCase()
                ];
                
                return searchFields.some(field => field.includes(query));
            });
        }

        // Apply status filter
        if (filters.status.length > 0) {
            filtered = filtered.filter(device => filters.status.includes(device.status));
        }

        // Apply type filter (for laptops/desktops)
        if (filters.type.length > 0 && selectedType === 'laptop') {
            filtered = filtered.filter(device => {
                const deviceType = (device as any).type;
                return filters.type.includes(deviceType);
            });
        }

        // Apply manufacturer filter
        if (filters.manufacturer.length > 0) {
            filtered = filtered.filter(device => 
                device.manufacturer && filters.manufacturer.includes(device.manufacturer)
            );
        }

        // Apply year range filter
        const defaultYearRange = filterOptions.yearRange || [2015, 2024];
        if (filters.yearRange[0] !== defaultYearRange[0] || filters.yearRange[1] !== defaultYearRange[1]) {
            filtered = filtered.filter(device => {
                const year = device.releaseYear;
                return year && year >= filters.yearRange[0] && year <= filters.yearRange[1];
            });
        }

        // Apply department filter
        if (filters.departments.length > 0) {
            filtered = filtered.filter(device => 
                device.assigned[0]?.department && filters.departments.includes(device.assigned[0].department)
            );
        }

        setFilteredDevices(filtered);
    };

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
        setError(null); // Clear error when changing device type
        // Reset all device-related state to prevent stale data
        setDevices([]);
        setFilteredDevices([]);
        setCurrentPage(1);
        setHasNextPage(true);
        setPagination({});
    };

    const handleLoadMore = useCallback(() => {
        if (!loadingMore && hasNextPage && !searchQuery.trim()) {
            fetchDevices(currentPage + 1);
        }
    }, [loadingMore, hasNextPage, currentPage, searchQuery]);

    const handleRefresh = useCallback(() => {
        setCurrentPage(1);
        setHasNextPage(true);
        setDevices([]); // Clear existing data before refresh
        fetchDevices(1, true);
    }, [selectedType]);

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

    const toggleFilter = (category: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const currentValues = prev[category];
            if (category === 'yearRange') return prev; // Handle yearRange separately
            
            const stringArray = currentValues as string[];
            return {
                ...prev,
                [category]: stringArray.includes(value)
                    ? stringArray.filter((item: string) => item !== value)
                    : [...stringArray, value]
            };
        });
    };

    const resetFilters = () => {
        const defaultYearRange = filterOptions.yearRange || [2015, 2024];
        setFilters({
            status: [],
            type: [],
            manufacturer: [],
            yearRange: defaultYearRange,
            departments: []
        });
    };

    const hasActiveFilters = () => {
        const defaultYearRange = filterOptions.yearRange || [2015, 2024];
        return (
            filters.status.length > 0 ||
            filters.type.length > 0 ||
            filters.manufacturer.length > 0 ||
            filters.departments.length > 0 ||
            filters.yearRange[0] !== defaultYearRange[0] ||
            filters.yearRange[1] !== defaultYearRange[1] ||
            searchQuery.trim().length > 0
        );
    };

    const clearAllFilters = () => {
        resetFilters();
        setSearchQuery('');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return '#3DB838';
            case 'Standby': return '#F59E0B';
            case 'Broken': return '#EF4444';
            case 'PendingDocumentation': return '#EAA300';
            default: return '#6B7280';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'Active': return 'Đang sử dụng';
            case 'Standby': return 'Sẵn sàng';
            case 'Broken': return 'Hỏng';
            case 'PendingDocumentation': return 'Chờ xử lý';
            default: return 'Không xác định';
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
                if (manufacturerLower.includes('apple') || nameLower.includes('macbook') || nameLower.includes('mac')) {
                    return 'apple';
                } else if (nameLower.includes('desktop') || (device as any).type === 'Desktop') {
                    return 'desktop-tower';
                } else {
                    return 'laptop';
                }
            }
            
            // Find matching subcategory based on manufacturer or name
            const matchedSubcategory = subcategories.find(sub => 
                manufacturerLower.includes(sub.subtype) || 
                nameLower.includes(sub.subtype) ||
                nameLower.includes(sub.label.toLowerCase())
            );
            
            if (matchedSubcategory) {
                return matchedSubcategory.icon;
            }
        }
        
        // Default to first subcategory icon or main device type icon
        return subcategories[0]?.icon || deviceTypes.find(t => t.type === deviceType)?.icon || 'desktop';
    };

    const handleDevicePress = (device: Device) => {
        navigation.navigate(ROUTES.SCREENS.DEVICE_DETAIL, {
            deviceId: device._id,
            deviceType: selectedType
        });
    };

    const renderDeviceCard = (device: Device) => (
        <TouchableOpacity 
            onPress={() => handleDevicePress(device)}
            className="bg-[#f8f8f8] rounded-xl mb-3 p-4"
        >
            {/* Row 1: Device Name and Status */}
            <View className="flex-row justify-between items-center">
                <Text 
                    className="text-lg font-bold text-[#F05023] flex-1 mr-2" 
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ maxWidth: '50%' }}
                >
                    {device.name}
                </Text>
                <View className="flex-row items-center">
                    <View 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getStatusColor(device.status) }}
                    />
                    <View className="p-2 rounded-lg">
                        <MaterialCommunityIcons 
                            name={getDeviceIcon(device, selectedType) as any} 
                            size={20} 
                            color="#002855" 
                        />
                    </View>
                </View>
            </View>

            {/* Row 2: Manufacturer/Year and Room */}
            <View className="flex-row justify-between items-center mb-2">
                <Text 
                    className="text-sm text-[#757575] flex-1 mr-2" 
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ maxWidth: '50%' }}
                >
                    {device.manufacturer && `${device.manufacturer} - `}{device.releaseYear || 'N/A'}
                </Text>
                <Text 
                    className="text-sm text-[#757575] font-medium text-right flex-1" 
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ maxWidth: '50%' }}
                >
                    {device.room 
                        ? `${device.room.name}`
                        : 'Không xác định'
                    }
                </Text>
            </View>

            {/* Row 3: Assigned User and Department */}
            <View className="flex-row justify-between items-center">
                <Text 
                    className="text-sm font-semibold text-primary flex-1 mr-2" 
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ maxWidth: '50%' }}
                >
                    {device.assigned.length > 0 
                        ? device.assigned[0].fullname 
                        : 'Không xác định'
                    }
                </Text>
                <View className="bg-[#F5AA1E] px-3 py-1 rounded-3xl" style={{ maxWidth: '50%' }}>
                    <Text 
                        className="text-xs font-medium text-white text-center" 
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {device.assigned.length > 0 
                            ? device.assigned[0].department 
                            : 'Không xác định'
                        }
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    console.log('Rendering DevicesScreen, loading:', loading, 'devices:', devices.length, 'filtered:', filteredDevices.length);

    return (
        <View className="flex-1">
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4 ">
                    <TouchableOpacity onPress={handleGoBack} className="p-1">
                        <Ionicons name="arrow-back" size={24} color="#002855" />
                    </TouchableOpacity>
                    <Text className="text-lg font-semibold text-primary">Quản lý thiết bị</Text>
                    <View className="w-9" />
                </View>

                <View className="flex-1">
                    {/* Error Banner */}
                    {error && (
                        <View className="bg-red-100 border-l-4 border-red-500 p-3 mx-5 mb-3 rounded">
                            <View className="flex-row items-center">
                                <Ionicons name="warning" size={20} color="#DC2626" />
                                <Text className="text-red-700 ml-2 flex-1 text-sm">
                                    {error}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setError(null)}
                                    className="ml-2"
                                >
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
                                className={`w-12 h-12 items-center justify-center rounded-full ${
                                    selectedType === deviceType.type 
                                        ? 'bg-primary' 
                                        : 'bg-[#f8f8f8]'
                                }`}
                                onPress={() => handleTypeSelect(deviceType.type)}
                            >
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
                        <View className="flex-row items-center rounded-xl px-4 py-3 border-none bg-[#f8f8f8]">
                            <Ionicons name="search" size={20} color="#666" />
                            <TextInput
                                className="flex-1 ml-2.5 border-none text-base text-gray-800"
                                placeholder={`Tìm kiếm ${deviceTypes.find(t => t.type === selectedType)?.label.toLowerCase()}`}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {hasActiveFilters() && (
                                <TouchableOpacity 
                                    onPress={clearAllFilters}
                                    className="ml-2 p-1"
                                >
                                    <Ionicons name="close-circle" size={20} color="#F05023" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity 
                                onPress={() => setShowFilterModal(true)}
                                className="ml-2 p-1"
                            >
                                <Ionicons 
                                    name={hasActiveFilters() ? "options" : "options-outline"} 
                                    size={20} 
                                    color={hasActiveFilters() ? "#F05023" : "#666"} 
                                />
                            </TouchableOpacity>
                        </View>
                        {hasActiveFilters() && (
                            <View className="mt-2 flex-row items-center justify-between">
                                <Text className="text-sm text-[#F05023]">
                                    Có {[
                                        filters.status.length,
                                        filters.type.length,
                                        filters.manufacturer.length,
                                        filters.departments.length,
                                        (filters.yearRange[0] !== 2015 || filters.yearRange[1] !== 2024) ? 1 : 0,
                                        searchQuery.trim().length > 0 ? 1 : 0
                                    ].reduce((a, b) => a + b, 0)} bộ lọc đang áp dụng
                                </Text>
                                <TouchableOpacity onPress={clearAllFilters}>
                                    <Text className="text-sm text-[#F05023] font-medium">Xóa tất cả</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Device List */}
                    <FlatList
                        data={filteredDevices}
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
                                        <Text className="text-sm text-[#002855] mt-2">Đang tải thêm...</Text>
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
                                        <Text className="text-base text-[#002855] mt-3">Đang tải thiết bị...</Text>
                                    </View>
                                );
                            }
                            return (
                                <View className="items-center justify-center py-15">
                                    <MaterialCommunityIcons 
                                        name={deviceTypes.find(t => t.type === selectedType)?.icon as any} 
                                        size={60} 
                                        color="#ccc" 
                                    />
                                    <Text className="text-base text-gray-600 mt-3 text-center mb-4">
                                        Không có {deviceTypes.find(t => t.type === selectedType)?.label.toLowerCase()} nào
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setCurrentPage(1);
                                            setHasNextPage(true);
                                            fetchDevices(1, false);
                                        }}
                                        className="bg-primary px-6 py-3 rounded-lg"
                                    >
                                        <Text className="text-white font-semibold">Thử lại</Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        }}
                    />
                </View>

                {/* Add Device Button */}
                <TouchableOpacity className="absolute bottom-8 right-5 w-14 h-14 rounded-full bg-orange-500 items-center justify-center shadow-lg">
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>

                {/* Filter Modal */}
                <Modal
                    visible={showFilterModal}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setShowFilterModal(false)}
                >
                    <View className="flex-1 justify-end bg-black/50">
                        <View 
                            className="bg-white rounded-t-3xl flex-1" 
                            style={{ 
                                maxHeight: '85%', 
                                minHeight: '50%',
                                marginTop: 100 
                            }}
                        >
                            {/* Header */}
                            <View className="flex-row items-center justify-between p-5 border-b border-gray-200">
                                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                                    <Ionicons name="close" size={24} color="#666" />
                                </TouchableOpacity>
                                <View className="flex-row items-center">
                                    <Text className="text-lg font-semibold text-primary">Bộ lọc</Text>
                                    {hasActiveFilters() && (
                                        <View className="ml-2 bg-[#F05023] rounded-full w-5 h-5 items-center justify-center">
                                            <Text className="text-white text-xs font-bold">
                                                {[
                                                    filters.status.length,
                                                    filters.type.length,
                                                    filters.manufacturer.length,
                                                    filters.departments.length,
                                                    (filters.yearRange[0] !== 2015 || filters.yearRange[1] !== 2024) ? 1 : 0
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
                                style={{ flex: 1 }}
                            >
                                {/* Status Filter */}
                                <View className="mb-6">
                                    <Text className="text-base font-semibold mb-3 text-gray-800">Trạng thái</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {getUniqueStatuses().map((status) => (
                                            <TouchableOpacity
                                                key={status}
                                                onPress={() => toggleFilter('status', status)}
                                                className={`px-4 py-2 rounded-full border ${
                                                    filters.status.includes(status)
                                                        ? 'bg-primary border-primary'
                                                        : 'bg-gray-100 border-gray-300'
                                                }`}
                                            >
                                                <Text className={`text-sm ${
                                                    filters.status.includes(status) ? 'text-white' : 'text-gray-700'
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
                                        <Text className="text-base font-semibold mb-3 text-gray-800">Loại</Text>
                                        <View className="flex-row flex-wrap gap-2">
                                            {getUniqueTypes().map((type) => (
                                                <TouchableOpacity
                                                    key={type}
                                                    onPress={() => toggleFilter('type', type)}
                                                    className={`px-4 py-2 rounded-full border ${
                                                        filters.type.includes(type)
                                                            ? 'bg-primary border-primary'
                                                            : 'bg-gray-100 border-gray-300'
                                                    }`}
                                                >
                                                    <Text className={`text-sm ${
                                                        filters.type.includes(type) ? 'text-white' : 'text-gray-700'
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
                                        <Text className="text-base font-semibold mb-3 text-gray-800">Nhà sản xuất</Text>
                                        <View className="flex-row flex-wrap gap-2">
                                            {getUniqueManufacturers().map((manufacturer) => (
                                                <TouchableOpacity
                                                    key={manufacturer}
                                                    onPress={() => toggleFilter('manufacturer', manufacturer!)}
                                                    className={`px-4 py-2 rounded-full border ${
                                                        filters.manufacturer.includes(manufacturer!)
                                                            ? 'bg-primary border-primary'
                                                            : 'bg-gray-100 border-gray-300'
                                                    }`}
                                                >
                                                    <Text className={`text-sm ${
                                                        filters.manufacturer.includes(manufacturer!) ? 'text-white' : 'text-gray-700'
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
                                    <Text className="text-base font-semibold mb-3 text-gray-800">Năm sản xuất</Text>
                                    <View className="px-4">
                                        {/* <View className="flex-row justify-between mb-2">
                                            <Text className="text-sm text-gray-600">{filters.yearRange[0]}</Text>
                                            <Text className="text-sm text-gray-600">{filters.yearRange[1]}</Text>
                                        </View> */}
                                        <View className="px-4">
                                            <View className="flex-row items-center space-x-4">
                                                <View className="flex-1">
                                                    <Text className="text-xs text-gray-500 mb-1">Từ năm:</Text>
                                                    <TextInput
                                                        className="border border-gray-300 rounded-lg px-3 py-2 text-center"
                                                        value={filters.yearRange[0].toString()}
                                                        onChangeText={(text) => {
                                                            const value = parseInt(text);
                                                            if (!isNaN(value)) {
                                                                setFilters(prev => ({
                                                                    ...prev,
                                                                    yearRange: [value, prev.yearRange[1]]
                                                                }));
                                                            } else if (text === '') {
                                                                setFilters(prev => ({
                                                                    ...prev,
                                                                    yearRange: [getYearRange()[0], prev.yearRange[1]]
                                                                }));
                                                            }
                                                        }}
                                                        keyboardType="numeric"
                                                        maxLength={4}
                                                    />
                                                </View>
                                                <Text className="text-gray-500 mt-4">-</Text>
                                                <View className="flex-1">
                                                    <Text className="text-xs text-gray-500 mb-1">Đến năm:</Text>
                                                    <TextInput
                                                        className="border border-gray-300 rounded-lg px-3 py-2 text-center"
                                                        value={filters.yearRange[1].toString()}
                                                        onChangeText={(text) => {
                                                            const value = parseInt(text);
                                                            if (!isNaN(value)) {
                                                                setFilters(prev => ({
                                                                    ...prev,
                                                                    yearRange: [prev.yearRange[0], value]
                                                                }));
                                                            } else if (text === '') {
                                                                setFilters(prev => ({
                                                                    ...prev,
                                                                    yearRange: [prev.yearRange[0], getYearRange()[1]]
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
                                        <Text className="text-base font-semibold mb-3 text-gray-800">Phòng ban</Text>
                                        <View>
                                            {getUniqueDepartments().map((department) => (
                                                <TouchableOpacity
                                                    key={department}
                                                    onPress={() => toggleFilter('departments', department!)}
                                                    className="flex-row items-center mb-4"
                                                >
                                                    <View className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                                                        filters.departments.includes(department!)
                                                            ? 'bg-primary border-primary'
                                                            : 'bg-white border-gray-300'
                                                    }`}>
                                                        {filters.departments.includes(department!) && (
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
                            <View className="p-5 border-t border-gray-200">
                                <TouchableOpacity
                                    onPress={() => setShowFilterModal(false)}
                                    className="w-full py-4 bg-[#F05023] rounded-full items-center mb-3"
                                >
                                    <Text className="text-white font-semibold text-base">Lưu</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        resetFilters();
                                        setShowFilterModal(false);
                                    }}
                                    className="w-full py-4 bg-[#E5E5E5] rounded-full items-center"
                                >
                                    <Text className="text-[#757575] font-semibold text-base">Hủy bỏ</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </View>
    );
};

export default DevicesScreen; 