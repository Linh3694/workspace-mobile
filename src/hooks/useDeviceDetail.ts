import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import deviceService from '../services/deviceService';
import { Device, DeviceType, DeviceActivity, DeviceInspection } from '../types/devices';

interface DeviceLog {
  _id: string;
  type: 'maintenance' | 'software' | 'general';
  title: string;
  description: string;
  date: string;
  user: {
    fullname: string;
    department: string;
  };
  status?: 'completed' | 'pending' | 'in_progress';
}

interface UseDeviceDetailState {
  device: Device | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  activities: DeviceActivity[];
  inspections: DeviceInspection[];
  logs: DeviceLog[];
}

interface UseDeviceDetailReturn extends UseDeviceDetailState {
  loadDeviceData: (showLoading?: boolean) => Promise<void>;
  handleRefresh: () => Promise<void>;
  setDevice: React.Dispatch<React.SetStateAction<Device | null>>;
}

export const useDeviceDetail = (
  deviceId: string,
  deviceType: DeviceType
): UseDeviceDetailReturn => {
  // Refs for cleanup and preventing race conditions
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // State
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<DeviceActivity[]>([]);
  const [inspections, setInspections] = useState<DeviceInspection[]>([]);
  const [logs, setLogs] = useState<DeviceLog[]>([]);

  // Convert activities to legacy logs format
  const convertActivitiesToLogs = useCallback((activityList: DeviceActivity[]): DeviceLog[] => {
    return activityList.map((activity) => ({
      _id: activity._id,
      type:
        activity.type === 'repair'
          ? ('maintenance' as const)
          : activity.type === 'update'
            ? ('software' as const)
            : ('general' as const),
      title: activity.description,
      description: activity.details || activity.description,
      date: activity.date,
      user: {
        fullname: activity.updatedBy || 'Hệ thống',
        department: 'Không xác định',
      },
      status: 'completed' as const,
    }));
  }, []);

  // Main data loading function
  const loadDeviceData = useCallback(
    async (showLoading = true) => {
      // Cancel previous request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        // Load device detail, activities, and inspections in parallel
        const [deviceData, activitiesData, inspectionsData] = await Promise.allSettled([
          deviceService.getDeviceById(deviceType, deviceId),
          deviceService.getDeviceActivities(deviceType, deviceId),
          deviceService.getDeviceInspections(deviceType, deviceId),
        ]);

        // Check if component is still mounted before updating state
        if (!isMountedRef.current) return;

        // Handle device data
        if (deviceData.status === 'fulfilled' && deviceData.value) {
          setDevice(deviceData.value);
        } else {
          setError('Không thể tải thông tin thiết bị');
          Alert.alert('Lỗi', 'Không tìm thấy thông tin thiết bị');
        }

        // Handle activities data
        if (activitiesData.status === 'fulfilled') {
          const activityList = activitiesData.value || [];
          setActivities(activityList);
          setLogs(convertActivitiesToLogs(activityList));
        } else {
          console.warn('Failed to load activities:', activitiesData.reason);
          setActivities([]);
          setLogs([]);
        }

        // Handle inspections data
        if (inspectionsData.status === 'fulfilled') {
          setInspections(inspectionsData.value || []);
        } else {
          console.warn('Failed to load inspections:', inspectionsData.reason);
          setInspections([]);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        // Check if component is still mounted before updating state
        if (!isMountedRef.current) return;

        console.error('Error loading device data:', err);
        const errorMessage =
          err instanceof Error ? err.message : 'Không thể tải dữ liệu thiết bị';
        setError(errorMessage);
        Alert.alert('Lỗi', errorMessage);
      } finally {
        // Always set loading to false if component is still mounted
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [deviceId, deviceType, convertActivitiesToLogs]
  );

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDeviceData(false);
  }, [loadDeviceData]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load data when deviceId changes
  useEffect(() => {
    if (deviceId) {
      loadDeviceData();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  return {
    device,
    loading,
    refreshing,
    error,
    activities,
    inspections,
    logs,
    loadDeviceData,
    handleRefresh,
    setDevice,
  };
};

export default useDeviceDetail;

