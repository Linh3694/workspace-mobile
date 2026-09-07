import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Platform,
  Pressable,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Device,
  DeviceType,
  DeviceActivity,
  DeviceInspection,
  HandoverSigningStatus,
} from '../../types/devices';
import deviceService from '../../services/deviceService';
import InputModal from '../../components/InputModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/constants';
import { getAvatar } from '../../utils/avatar';
import RevokeModal from './components/RevokeModal';
import AssignModal from './components/AssignModal';
import ReportBrokenModal from './components/ReportBrokenModal';
import FilePreviewModal from './components/FilePreviewModal';
import AddActivityModal from './components/AddActivityModal';
import RevokeIcon from '../../assets/revoke-devices.svg';
import AssignIcon from '../../assets/assign-devices.svg';
import BrokenIcon from '../../assets/broken-devices.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeVietnameseName } from '../../utils/nameFormatter';

type DeviceDetailScreenRouteProp = RouteProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.DEVICE_DETAIL
>;
type DeviceDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.DEVICE_DETAIL
>;

/** Nhãn + màu pill theo trạng thái ký — trùng bảng ở MyHandoversScreen */
const SIGNING_META: Record<string, { text: string; bg: string }> = {
  pending_manager: { text: 'Chờ Trưởng phòng duyệt', bg: 'bg-blue-500' },
  pending_receiver: { text: 'Chờ người nhận xác nhận', bg: 'bg-amber-500' },
  completed: { text: 'Đã hoàn tất', bg: 'bg-green-600' },
  rejected: { text: 'Bị từ chối', bg: 'bg-red-500' },
  manual: { text: 'Biên bản giấy', bg: 'bg-gray-500' },
  '': { text: 'Chưa xác nhận điện tử', bg: 'bg-gray-500' },
};

const STEP_DOT_CLASS = {
  done: 'bg-green-400',
  current: 'bg-amber-400',
  todo: 'bg-white/30',
  failed: 'bg-red-400',
} as const;

const formatSigningTime = (value?: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

interface DeviceLog {
  _id: string;
  type: 'maintenance' | 'software' | 'assignment' | 'general';
  title: string;
  description: string;
  date: string;
  user: {
    fullname: string;
    department: string;
  };
  status?: 'completed' | 'pending' | 'in_progress';
}

const DevicesDetailScreen = () => {
  const navigation = useNavigation<DeviceDetailScreenNavigationProp>();
  const route = useRoute<DeviceDetailScreenRouteProp>();
  const { deviceId, deviceType } = route.params;
  const insets = useSafeAreaInsets();

  // Abort controller ref for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Main device data
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Activities and inspections data
  const [activities, setActivities] = useState<DeviceActivity[]>([]);
  const [inspections, setInspections] = useState<DeviceInspection[]>([]);

  // Legacy logs for backward compatibility (converted from activities)
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [selectedLogTab, setSelectedLogTab] = useState<'all' | 'maintenance' | 'software'>('all');

  // Modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [reportBrokenModalVisible, setReportBrokenModalVisible] = useState(false);
  const [addActivityModalVisible, setAddActivityModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  // Edit states
  const [editSpecValue, setEditSpecValue] = useState('');
  const [editSpecKey, setEditSpecKey] = useState('');
  const [editSpecLabel, setEditSpecLabel] = useState('');
  const [isSubmittingSpec, setIsSubmittingSpec] = useState(false);
  const [isSavingSpec, setIsSavingSpec] = useState(false);

  // Activity form states
  const [newActivityType, setNewActivityType] = useState<'repair' | 'software'>('repair');
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityDescription, setNewActivityDescription] = useState('');

  // Xác nhận điện tử
  const [isStartingDigital, setIsStartingDigital] = useState(false);
  const [previewFileUrl, setPreviewFileUrl] = useState<string>('');
  const [authToken, setAuthToken] = useState<string>('');

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      // Cancel any pending API calls
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
      // Cancel pending requests when deviceId changes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

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
          setActivities(activitiesData.value || []);
          // Convert activities to legacy logs format for backward compatibility
          const mappedLogs = (activitiesData.value || []).map((activity: DeviceActivity) => ({
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
          setLogs(mappedLogs);
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
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        
        // Check if component is still mounted before updating state
        if (!isMountedRef.current) return;
        
        console.error('Error loading device data:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Không thể tải dữ liệu thiết bị';
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
    [deviceId, deviceType]
  );

  // Legacy function for backward compatibility
  const fetchDeviceDetail = useCallback(async () => {
    try {
      const response = await deviceService.getDeviceById(deviceType, deviceId);
      if (response) {
        setDevice(response);
      } else {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin thiết bị');
      }
    } catch (error) {
      console.error('Error fetching device detail:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin thiết bị');
    }
  }, [deviceId, deviceType]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDeviceData(false); // Don't show loading indicator, use refreshing state instead
  }, [loadDeviceData]);

  // Activity management functions
  const handleAddActivity = useCallback(async () => {
    if (!newActivityTitle.trim() || !newActivityDescription.trim()) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      await deviceService.addDeviceActivity(deviceType, deviceId, {
        activityType: newActivityType === 'repair' ? 'repair' : 'update',
        description: newActivityTitle,
        notes: newActivityDescription,
      });

      Alert.alert('Thành công', 'Đã thêm hoạt động mới');
      setAddActivityModalVisible(false);
      setNewActivityTitle('');
      setNewActivityDescription('');
      // Refresh data
      await loadDeviceData();
    } catch (error) {
      console.error('Error adding activity:', error);
      Alert.alert('Lỗi', 'Không thể thêm hoạt động');
    }
  }, [
    deviceType,
    deviceId,
    newActivityTitle,
    newActivityDescription,
    newActivityType,
    loadDeviceData,
  ]);

  // Assignment history navigation
  const handleViewAssignmentHistory = useCallback(() => {
    navigation.navigate(ROUTES.SCREENS.DEVICE_ASSIGNMENT_HISTORY as any, {
      deviceId,
      deviceType,
    });
  }, [deviceId, deviceType, navigation]);

  const handleGoBack = () => {
    navigation.goBack();
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
        return 'Thiếu biên bản';
      default:
        return 'Không xác định';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    const dateStr = formatDate(dateString);
    return `${time} ${dateStr}`;
  };

  const getFilteredLogs = () => {
    if (selectedLogTab === 'all') return logs;
    return logs.filter((log) => log.type === selectedLogTab);
  };

  const getAssignedByUser = () => {
    if (!device?.assignmentHistory || device.assignmentHistory.length === 0) {
      return 'Không xác định';
    }

    // Tìm record đang mở (chưa có endDate) trong assignmentHistory
    const openRecord = device.assignmentHistory.find((hist: any) => !hist.endDate);

    if (openRecord) {
      // Ưu tiên: assignedByName (string) > assignedBy.fullname (populated object)
      if (openRecord.assignedByName) {
        return normalizeVietnameseName(openRecord.assignedByName);
      }
      if (openRecord.assignedBy?.fullname) {
        return normalizeVietnameseName(openRecord.assignedBy.fullname);
      }
      // Nếu assignedBy là string (chưa populate)
      if (typeof openRecord.assignedBy === 'string') {
        return 'Đang cập nhật...';
      }
    }

    // Fallback: lấy record mới nhất có assignedBy
    const latestRecordWithAssignedBy = device.assignmentHistory
      .filter((hist: any) => hist.assignedBy || hist.assignedByName)
      .sort(
        (a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      )[0];

    if (latestRecordWithAssignedBy) {
      if (latestRecordWithAssignedBy.assignedByName) {
        return normalizeVietnameseName(latestRecordWithAssignedBy.assignedByName);
      }
      if (latestRecordWithAssignedBy.assignedBy?.fullname) {
        return normalizeVietnameseName(latestRecordWithAssignedBy.assignedBy.fullname);
      }
    }

    return 'Không xác định';
  };

  const getCurrentUser = () => {
    if (!device?.assignmentHistory || device.assignmentHistory.length === 0) {
      // Fallback: người dùng từ assigned array (nếu có)
      if (device?.assigned && device.assigned.length > 0) {
        const latestAssigned = device.assigned[device.assigned.length - 1];
        return {
          _id: latestAssigned._id || '',
          fullname: normalizeVietnameseName(latestAssigned.fullname) || 'Không xác định',
          department: latestAssigned.department || 'Không xác định',
          jobTitle: latestAssigned.jobTitle || 'Không xác định',
          avatarUrl: latestAssigned.avatarUrl,
        };
      }
      return null;
    }

    // Tìm record đang mở (chưa có endDate) trong assignmentHistory
    const openRecord = device.assignmentHistory.find((hist: any) => !hist.endDate);

    if (openRecord) {
      // Ưu tiên: userName (string) > user.fullname (populated object)
      const fullname = openRecord.userName || 
        (openRecord.user?.fullname ? normalizeVietnameseName(openRecord.user.fullname) : null) ||
        'Đang cập nhật...';
      
      // user có thể là object (populated) hoặc string (userId chưa populate)
      const userObj = typeof openRecord.user === 'object' ? openRecord.user : null;
      
      return {
        _id: userObj?._id || openRecord.userId || openRecord.user || '',
        fullname,
        department: userObj?.department || openRecord.department || 'Không xác định',
        jobTitle: openRecord.jobTitle || userObj?.jobTitle || 'Không xác định',
        avatarUrl: userObj?.avatarUrl,
      };
    }

    // Fallback: người dùng từ assigned array (nếu có)
    if (device.assigned && device.assigned.length > 0) {
      const latestAssigned = device.assigned[device.assigned.length - 1];
      return {
        _id: latestAssigned._id || '',
        fullname: normalizeVietnameseName(latestAssigned.fullname) || 'Không xác định',
        department: latestAssigned.department || 'Không xác định',
        jobTitle: latestAssigned.jobTitle || 'Không xác định',
        avatarUrl: latestAssigned.avatarUrl,
      };
    }

    return null;
  };

  const getAssignmentStartDate = () => {
    if (!device?.assignmentHistory || device.assignmentHistory.length === 0) {
      return null;
    }

    // Tìm record đang mở (chưa có endDate) trong assignmentHistory
    const openRecord = device.assignmentHistory.find((hist: any) => !hist.endDate);

    if (openRecord && openRecord.startDate) {
      return openRecord.startDate;
    }

    return null;
  };

  const formatAssignmentDuration = () => {
    const startDate = getAssignmentStartDate();
    if (!startDate) {
      return 'Chưa có thông tin';
    }

    const start = new Date(startDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const startDateFormatted = `${start.getDate().toString().padStart(2, '0')}/${(start.getMonth() + 1).toString().padStart(2, '0')}/${start.getFullYear()}`;

    if (diffDays === 1) {
      return `${startDateFormatted} đến nay (1 ngày)`;
    } else if (diffDays < 30) {
      return `${startDateFormatted} - nay (${diffDays} ngày)`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${startDateFormatted} → nay (${months} tháng)`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${startDateFormatted} → nay (${years} năm)`;
    }
  };

  const handleRevokeDevice = async (reasons: string[]) => {
    try {
      if (!device) return;

      await deviceService.revokeDevice(deviceType, device._id, reasons, 'Standby');

      // Refresh device data
      await fetchDeviceDetail();

      Alert.alert('Thành công', 'Thu hồi thiết bị thành công!');
    } catch (error) {
      console.error('Error revoking device:', error);
      throw error; // Re-throw để RevokeModal xử lý
    }
  };

  const handleAssignDevice = async (userId: string, userName: string, notes?: string) => {
    try {
      if (!device) return;

      await deviceService.assignDevice(deviceType, device._id, userId, userName, notes);
      await loadDeviceData(false);
      Alert.alert('Thành công', 'Cấp phát thiết bị thành công!');
    } catch (error) {
      console.error('Error assigning device:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể cấp phát thiết bị';
      Alert.alert('Lỗi', errorMessage);
      throw error;
    }
  };

  const handleReportBroken = async (reason: string) => {
    try {
      if (!device) return;

      await deviceService.updateDeviceStatus(deviceType, device._id, 'Broken', reason);
      await loadDeviceData(false);
      Alert.alert('Thành công', 'Báo hỏng thiết bị thành công!');
    } catch (error) {
      console.error('Error reporting broken device:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể báo hỏng thiết bị';
      Alert.alert('Lỗi', errorMessage);
      throw error;
    }
  };

  const getDeviceEndpoint = (deviceType: DeviceType) => {
    // Map device types to their correct API endpoints
    const endpointMap = {
      laptop: 'laptops',
      monitor: 'monitors',
      printer: 'printers',
      projector: 'projectors',
      tool: 'tools',
    };
    return endpointMap[deviceType] || `${deviceType}s`;
  };

  const getHandoverDocument = () => {
    if (!device?.assignmentHistory || device.assignmentHistory.length === 0) {
      return null;
    }

    // Tìm record đang mở (chưa có endDate) trong assignmentHistory
    const openRecord = device.assignmentHistory.find((hist: any) => !hist.endDate);

    // Ưu tiên documentFileUrl (`/files/inventory/handovers/...` trên Frappe — cũng là nơi luồng
    // ký số ghi PDF). `document` chỉ là tên file trần backend cắt từ URL đó, giữ làm fallback.
    if (openRecord?.documentFileUrl) {
      return openRecord.documentFileUrl;
    }
    if (openRecord?.document) {
      return openRecord.document;
    }

    return null;
  };

  const getFileType = (fileName: string): 'pdf' | 'image' => {
    const extension = fileName.toLowerCase().split('.').pop();
    if (extension === 'pdf') {
      return 'pdf';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '')) {
      return 'image';
    }
    return 'pdf'; // default to pdf
  };

  const handleViewHandoverDocument = async () => {
    try {
      const documentPath = getHandoverDocument();
      if (!documentPath) {
        Alert.alert('Thông báo', 'Chưa có biên bản bàn giao nào được tải lên');
        return;
      }

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Lỗi', 'Không tìm thấy token xác thực');
        return;
      }

      const endpoint = getDeviceEndpoint(deviceType);

      // Đường dẫn Frappe (`/files/...`) hoặc URL tuyệt đối: mở thẳng, file public không cần token.
      // Đây là đường đi chuẩn từ 2026-09-03 — biên bản (scan lẫn PDF ký số) đều nằm ở
      // public/files/inventory/handovers/ trên Frappe; /uploads/Handovers/ chỉ còn là alias tương thích.
      if (documentPath.startsWith('http') || documentPath.startsWith('/files/')) {
        const directUrl = documentPath.startsWith('http')
          ? documentPath
          : `${API_BASE_URL}${documentPath}`;
        setPreviewFileUrl(directUrl);
        setAuthToken('');
        setPreviewModalVisible(true);
        return;
      }

      // Payload cũ chỉ có tên file trần: giữ chuỗi dò như trước.
      let fileName = documentPath;
      if (documentPath.includes('/')) {
        // Nếu là đường dẫn đầy đủ, lấy tên file
        fileName = documentPath.split('/').pop() || documentPath;
      }

      // Tạo URL để xem file
      let fileUrl = `${API_BASE_URL}/api/${endpoint}/handover/${fileName}`;

      // Kiểm tra file có tồn tại không trước khi mở modal
      let fileFound = false;
      const urlsToCheck = [
        `${API_BASE_URL}/files/inventory/handovers/${fileName}`, // Frappe public files (nguồn sự thật)
        `${API_BASE_URL}/uploads/Handovers/${fileName}`, // alias tương thích trên nginx be-02
        `${API_BASE_URL}/api/${endpoint}/handover/${fileName}`, // Microservice files (legacy)
      ];

      for (const url of urlsToCheck) {
        try {
          // Chỉ gửi Authorization header cho microservice endpoints, không gửi cho frappe uploads
          const headers: Record<string, string> = {};
          if (url.includes('/api/')) {
            headers.Authorization = `Bearer ${token}`;
          }

          const response = await fetch(url, {
            method: 'HEAD',
            headers,
          });

          if (response.ok) {
            fileUrl = url;
            fileFound = true;
            break;
          }
        } catch (error) {
          // Continue to next URL
        }
      }

      // Mở preview trong app
      setPreviewFileUrl(fileUrl);
      // Chỉ gửi auth token cho microservice endpoints
      setAuthToken(fileUrl.includes('/api/') ? token : '');
      setPreviewModalVisible(true);
    } catch (error) {
      console.error('Error viewing handover document:', error);
      Alert.alert(
        'Lỗi',
        'Có lỗi xảy ra khi mở file biên bản: ' +
          (error instanceof Error ? error.message : 'Lỗi không xác định')
      );
    }
  };

  /** Hồ sơ bàn giao đang mở (backend gửi `currentHandover`; fallback dò trong lịch sử). */
  const getOpenHandover = () =>
    device?.currentHandover ?? device?.assignmentHistory?.find((hist) => !hist.endDate) ?? null;

  const handleStartDigitalHandover = () => {
    if (!device || isStartingDigital) return;
    Alert.alert(
      'Bàn giao theo quy trình mới',
      'Gửi hồ sơ xác nhận điện tử cho người đang giữ máy? Biên bản giấy cũ sẽ chuyển vào lịch sử.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Gửi',
          onPress: async () => {
            try {
              setIsStartingDigital(true);
              await deviceService.startDigitalHandover(deviceType, device._id);
              await loadDeviceData(false);
              Alert.alert('Thành công', 'Đã gửi hồ sơ để Trưởng phòng phê duyệt');
            } catch (error) {
              Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể gửi hồ sơ');
            } finally {
              setIsStartingDigital(false);
            }
          },
        },
      ]
    );
  };

  const handleResendHandover = async () => {
    const openHandover = getOpenHandover();
    if (!openHandover?._id || isStartingDigital) return;
    try {
      setIsStartingDigital(true);
      await deviceService.resendHandover(openHandover._id);
      await loadDeviceData(false);
      Alert.alert('Thành công', 'Đã gửi lại hồ sơ để phê duyệt');
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể gửi lại hồ sơ');
    } finally {
      setIsStartingDigital(false);
    }
  };

  /**
   * Khối tiến độ xác nhận điện tử trong card "Thông tin bàn giao":
   * IT bàn giao → Trưởng phòng duyệt → Người nhận xác nhận. Máy giao theo biên bản
   * giấy (không có signingStatus / `manual`) thì mời chuyển sang quy trình mới.
   */
  const renderSigningBlock = () => {
    const openHandover = getOpenHandover();
    const status = (openHandover?.signingStatus || '') as HandoverSigningStatus;
    const isDigital = ['pending_manager', 'pending_receiver', 'completed', 'rejected'].includes(
      status
    );
    const meta = SIGNING_META[status] || SIGNING_META[''];
    const rejected = status === 'rejected';
    const approvedDone = status === 'pending_receiver' || status === 'completed';
    const confirmedDone = status === 'completed';
    const holderName = normalizeVietnameseName(getCurrentUser()?.fullname) || '';

    const steps: Array<{ label: string; state: 'done' | 'current' | 'todo' | 'failed'; detail: string }> = [
      {
        label: 'IT bàn giao',
        state: 'done',
        detail: [getAssignedByUser(), formatSigningTime(openHandover?.startDate)]
          .filter((v) => v && v !== 'Không xác định')
          .join(' · '),
      },
      {
        label: 'Trưởng phòng duyệt',
        state: approvedDone ? 'done' : rejected ? 'failed' : status === 'pending_manager' ? 'current' : 'todo',
        detail: approvedDone
          ? [
              normalizeVietnameseName(openHandover?.managerApprovedBy?.fullname),
              formatSigningTime(openHandover?.managerApprovedOn),
            ]
              .filter(Boolean)
              .join(' · ')
          : '',
      },
      {
        label: 'Người nhận xác nhận',
        state: confirmedDone
          ? 'done'
          : rejected && approvedDone
            ? 'failed'
            : status === 'pending_receiver'
              ? 'current'
              : 'todo',
        detail: confirmedDone
          ? [holderName, formatSigningTime(openHandover?.receiverConfirmedOn)].filter(Boolean).join(' · ')
          : '',
      },
    ];
    const rejectReason = openHandover?.receiverRejectReason || openHandover?.managerRejectReason;

    return (
      <View className="mt-3 rounded-lg bg-white/10 p-3">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="font-bold text-sm text-white">Biên bản bàn giao</Text>
          <View className={`rounded-full px-2 py-0.5 ${meta.bg}`}>
            <Text className="text-xs font-bold text-white">{meta.text}</Text>
          </View>
        </View>
        {isDigital ? (
          <>
            {steps.map((step, index) => (
              <View key={step.label} className="flex-row">
                <View className="w-4 items-center">
                  <View
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${STEP_DOT_CLASS[step.state]}`}
                  />
                  {index < steps.length - 1 ? (
                    <View className="my-0.5 w-px flex-1 bg-white/30" />
                  ) : null}
                </View>
                <View
                  className={`ml-2 flex-1 flex-row items-start justify-between ${
                    index < steps.length - 1 ? 'pb-2' : ''
                  }`}>
                  <Text
                    className={`text-sm ${
                      step.state === 'todo' ? 'text-[#BEBEBE]' : 'font-bold text-white'
                    }`}>
                    {step.label}
                  </Text>
                  <Text
                    className={`ml-2 shrink text-right text-xs ${
                      step.state === 'failed' ? 'text-red-300' : 'text-[#BEBEBE]'
                    }`}>
                    {step.detail ||
                      (step.state === 'current' ? 'Đang chờ' : step.state === 'failed' ? 'Từ chối' : '')}
                  </Text>
                </View>
              </View>
            ))}
            {rejectReason ? (
              <Text className="mt-2 text-xs text-red-300">Lý do từ chối: {rejectReason}</Text>
            ) : null}
            {rejected ? (
              <TouchableOpacity
                onPress={handleResendHandover}
                disabled={isStartingDigital}
                className="mt-3 items-center rounded-lg bg-[#F05023] py-2"
                style={{ opacity: isStartingDigital ? 0.6 : 1 }}>
                <Text className="font-bold text-sm text-white">
                  {isStartingDigital ? 'Đang gửi…' : 'Gửi lại yêu cầu xác nhận'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <>
            <Text className="text-xs text-[#BEBEBE]">
              {getHandoverDocument()
                ? 'Máy được giao theo biên bản giấy, chưa xác nhận điện tử. Biên bản cũ vẫn xem được trong lịch sử sau khi chuyển.'
                : 'Máy được giao trước khi có xác nhận điện tử và chưa có biên bản.'}
            </Text>
            <TouchableOpacity
              onPress={handleStartDigitalHandover}
              disabled={isStartingDigital}
              className="mt-3 items-center rounded-lg bg-[#F05023] py-2"
              style={{ opacity: isStartingDigital ? 0.6 : 1 }}>
              <Text className="font-bold text-sm text-white">
                {isStartingDigital ? 'Đang gửi…' : 'Bàn giao theo quy trình mới'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const handleDisposeDevice = async () => {
    if (!device) return;

    Alert.alert(
      'Xác nhận thanh lý',
      `Bạn có chắc chắn muốn thanh lý thiết bị "${device.name}"? Thao tác này không thể hoàn tác.`,
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Thanh lý',
          style: 'destructive',
          onPress: async () => {
            try {
              await deviceService.deleteDevice(deviceType, device._id);
              Alert.alert('Thành công', 'Thiết bị đã được thanh lý thành công!', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              console.error('Error disposing device:', error);
              const errorMessage = error instanceof Error ? error.message : 'Không thể thanh lý thiết bị';
              Alert.alert('Lỗi', errorMessage);
            }
          },
        },
      ]
    );
  };

  const handleRestoreDevice = async () => {
    if (!device) return;

    Alert.alert(
      'Xác nhận phục hồi',
      `Bạn có muốn phục hồi thiết bị "${device.name}" về trạng thái chờ cấp phát?`,
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Phục hồi',
          onPress: async () => {
            try {
              await deviceService.updateDeviceStatus(deviceType, device._id, 'Standby');
              await loadDeviceData(false);
              Alert.alert('Thành công', 'Thiết bị đã được phục hồi thành công!');
            } catch (error) {
              console.error('Error restoring device:', error);
              const errorMessage = error instanceof Error ? error.message : 'Không thể phục hồi thiết bị';
              Alert.alert('Lỗi', errorMessage);
            }
          },
        },
      ]
    );
  };

  const handleEditSpec = (specKey: string, currentValue: string, label: string) => {
    setEditSpecKey(specKey);
    setEditSpecValue(currentValue);
    setEditSpecLabel(label);
    setEditModalVisible(true);
  };

  const handleSaveSpec = async () => {
    // Ngăn multiple submissions
    if (!device || isSubmittingSpec || isSavingSpec) return;

    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let loadingTimeoutId: NodeJS.Timeout | null = null;

    try {
      // Hiển thị loading state và set submitting flag ngay lập tức
      setIsSavingSpec(true);
      setIsSubmittingSpec(true);

      // Đóng modal ngay để tránh confusion
      setEditModalVisible(false);

      let payload: any = {};

      if (['processor', 'ram', 'storage', 'display'].includes(editSpecKey)) {
        // Đảm bảo device.specs tồn tại trước khi cập nhật
        payload.specs = {
          ...device.specs,
          [editSpecKey]: editSpecValue,
        };
      } else {
        payload[editSpecKey] =
          editSpecKey === 'releaseYear' ? parseInt(editSpecValue) : editSpecValue;
      }

      // Xác định endpoint đúng cho từng loại thiết bị
      const endpoint = getDeviceEndpoint(deviceType);

      // Get auth token
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('Không tìm thấy token xác thực');
      }

      // Create AbortController for timeout
      controller = new AbortController();
      timeoutId = setTimeout(() => {
        if (controller) {
          controller.abort();
        }
      }, 30000); // 30s timeout

      const response = await fetch(`${API_BASE_URL}/api/${endpoint}/${device._id}/specs`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // Clear timeout after response
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (response.ok) {
        // Reload device data sau khi cập nhật specs (không show loading)
        await loadDeviceData(false);

        // Reset state trước khi hiển thị alert
        setIsSavingSpec(false);
        setIsSubmittingSpec(false);
        setEditSpecValue('');
        setEditSpecKey('');
        setEditSpecLabel('');

        // Hiển thị thông báo thành công
        Alert.alert('Thành công', 'Cập nhật thông số thành công!');
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Không thể cập nhật thông số!' }));

        // Reset state trước khi hiển thị alert
        setIsSavingSpec(false);
        setIsSubmittingSpec(false);

        Alert.alert('Lỗi', errorData.message || 'Không thể cập nhật thông số!');
      }
    } catch (error: any) {
      console.error('Error updating spec:', error);

      // Clear timeouts nếu còn tồn tại
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
        loadingTimeoutId = null;
      }

      // Reset state trước khi hiển thị alert
      setIsSavingSpec(false);
      setIsSubmittingSpec(false);

      // Handle timeout
      if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
        Alert.alert('Lỗi', 'Yêu cầu quá thời gian chờ. Vui lòng thử lại!');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Có lỗi xảy ra khi cập nhật!';
        Alert.alert('Lỗi', errorMessage);
      }
    } finally {
      // Đảm bảo cleanup tất cả timeouts
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
      }

      // Đảm bảo modal đã đóng và state được reset
      setEditModalVisible(false);
    }
  };

  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditSpecValue('');
    setEditSpecKey('');
    setEditSpecLabel('');
  };

  const renderSpecCard = (
    icon: string,
    label: string,
    value: string,
    specKey: string,
    color: string = '#F05023'
  ) => (
    <TouchableOpacity
      className="ml-2 items-center rounded-2xl bg-gray-100 p-3"
      style={{ width: 100, minWidth: 100 }}
      delayPressIn={50}
      onPress={() => handleEditSpec(specKey, value, label)}>
      <View
        className="mb-2 h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: color }}>
        <MaterialCommunityIcons name={icon as any} size={16} color="white" />
      </View>
      <Text className="mb-1 text-center text-sm text-gray-500" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-center font-semibold text-base text-gray-800" numberOfLines={2}>
        {value}
      </Text>
    </TouchableOpacity>
  );

  const renderLogItem = (log: DeviceLog) => (
    <View key={log._id} className="mb-3 rounded-xl bg-[#E4E9EF] p-4">
      <View className="flex-row items-start justify-between">
        <Text className="mr-2 flex-1 font-semibold text-base text-gray-800">{log.title}</Text>
        <Text className="font-semibold text-sm text-primary">
          {normalizeVietnameseName(log.user.fullname)}
        </Text>
      </View>

      <View className="my-1 flex-row items-center justify-between">
        <Text className="font-medium text-xs text-[#A5A5A5]">{formatDateTime(log.date)}</Text>
        <View
          className={`rounded-lg px-3 py-1 ${log.type === 'maintenance' ? 'bg-secondary' : 'bg-primary'}`}>
          <Text className="font-semibold text-xs text-white">
            {log.type === 'maintenance' ? 'Sửa chữa' : 'Phần mềm'}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-[#757575]">{log.description}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#002855" />
          <Text className="mt-3 text-base text-[#002855]">Đang tải thông tin thiết bị...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <MaterialCommunityIcons name="alert-circle" size={60} color="#EF4444" />
          <Text className="mt-3 text-center text-base text-gray-600">
            Không tìm thấy thông tin thiết bị
          </Text>
          <TouchableOpacity onPress={handleGoBack} className="mt-4 rounded-lg bg-primary px-6 py-3">
            <Text className="font-semibold text-white">Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pb-1 pt-4">
        <View className="flex-1">
          <Text className="font-bold text-2xl text-primary" numberOfLines={1}>
            {device.name}
          </Text>
        </View>

        <TouchableOpacity onPress={handleGoBack} className="p-1">
          <Text className="font-bold text-2xl text-primary">x</Text>
        </TouchableOpacity>
      </View>
      <View className="px-5 pb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View
              className="mr-2 h-3 w-3 rounded-full"
              style={{ backgroundColor: getStatusColor(device.status) }}
            />
            <Text className="font-medium text-lg" style={{ color: getStatusColor(device.status) }}>
              {getStatusLabel(device.status)}
            </Text>
          </View>
        </View>
      </View>
      {/* Action Buttons Based on Device Status */}
      <View className="mb-4 flex-row items-start gap-4 bg-white px-5 py-2">
        {/* Standby Status: Cấp phát và Báo hỏng */}
        {device.status === 'Standby' && (
          <>
            <TouchableOpacity
              onPress={() => setAssignModalVisible(true)}
              className="h-12 w-12 items-center justify-center rounded-full bg-[#3FA83B]">
              <AssignIcon width={40} height={40} fill="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setReportBrokenModalVisible(true)}
              className="h-12 w-12 items-center justify-center rounded-full bg-[#DC0909]">
              <BrokenIcon width={24} height={24} fill="white" />
            </TouchableOpacity>
          </>
        )}

        {/* PendingDocumentation: đang chờ duyệt/xác nhận điện tử — chỉ còn Thu hồi / Báo hỏng */}
        {device.status === 'PendingDocumentation' && (
          <>
            <TouchableOpacity
              onPress={() => setRevokeModalVisible(true)}
              className="h-12 w-12 items-center justify-center rounded-full bg-[#EAA300]">
              <RevokeIcon width={24} height={24} fill="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setReportBrokenModalVisible(true)}
              className="h-12 w-12 items-center justify-center rounded-full bg-[#EF4444]">
              <BrokenIcon width={24} height={24} fill="white" />
            </TouchableOpacity>
          </>
        )}

        {/* Active Status: Thu hồi và Báo hỏng */}
        {device.status === 'Active' && (
          <>
            <TouchableOpacity
              onPress={() => setRevokeModalVisible(true)}
              className="h-12 w-12 items-center justify-center rounded-full bg-[#EAA300]">
              <RevokeIcon width={24} height={24} fill="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setReportBrokenModalVisible(true)}
              className="h-12 w-12 items-center justify-center rounded-full bg-[#EF4444]">
              <BrokenIcon width={24} height={24} fill="white" />
            </TouchableOpacity>
          </>
        )}

        {/* Broken Status: Thanh lý và Phục hồi */}
        {device.status === 'Broken' && (
          <>
            <TouchableOpacity
              onPress={handleDisposeDevice}
              className="h-12 w-12 items-center justify-center rounded-full bg-red-600">
              <MaterialCommunityIcons name="delete-forever" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRestoreDevice}
              className="h-12 w-12 items-center justify-center rounded-full bg-green-600">
              <MaterialCommunityIcons name="restore" size={24} color="white" />
            </TouchableOpacity>
          </>
        )}
      </View>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#002855']}
            tintColor="#002855"
          />
        }>
        {/* Specs - chỉ hiển thị khi có ít nhất một thông số */}
        {((device.specs?.processor && device.specs.processor.trim() !== '') ||
          (device.specs?.ram && device.specs.ram.trim() !== '') ||
          (device.specs?.storage && device.specs.storage.trim() !== '') ||
          (device.specs?.display && device.specs.display.trim() !== '') ||
          (device.releaseYear && device.releaseYear > 0) ||
          (device.manufacturer && device.manufacturer.trim() !== '')) && (
          <View className="mb-6 px-2">
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              className="flex-1"
              contentContainerStyle={{ paddingHorizontal: 5 }}>
              <View className="flex-row space-x-3">
                {device.specs?.processor &&
                  device.specs.processor.trim() !== '' &&
                  renderSpecCard('cpu-64-bit', 'CPU', device.specs.processor, 'processor')}
                {device.specs?.ram &&
                  device.specs.ram.trim() !== '' &&
                  renderSpecCard('memory', 'Bộ nhớ', device.specs.ram, 'ram')}
                {device.specs?.storage &&
                  device.specs.storage.trim() !== '' &&
                  renderSpecCard('harddisk', 'Ổ cứng', device.specs.storage, 'storage')}
                {device.specs?.display &&
                  device.specs.display.trim() !== '' &&
                  renderSpecCard('monitor', 'Màn hình', device.specs.display, 'display')}
                {device.releaseYear &&
                  device.releaseYear > 0 &&
                  renderSpecCard(
                    'calendar',
                    'Năm sản xuất',
                    device.releaseYear.toString(),
                    'releaseYear'
                  )}
                {device.manufacturer &&
                  device.manufacturer.trim() !== '' &&
                  renderSpecCard('wrench', 'Hãng sản xuất', device.manufacturer, 'manufacturer')}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Assignment Info */}
        <View className="mb-6 px-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-bold text-lg text-gray-800">Thông tin bàn giao</Text>
            <TouchableOpacity onPress={handleViewAssignmentHistory}>
              <Text className="font-bold text-[#F05023]">Xem tất cả</Text>
            </TouchableOpacity>
          </View>
          {getCurrentUser() ? (
            <View className="rounded-xl bg-[#002855] p-4">
              <View className="mb-3 flex-row items-center">
                <Image
                  source={{ uri: getAvatar(getCurrentUser()) }}
                  className="mr-3 h-16 w-16 rounded-full"
                />
                <View className="flex-1 gap-2">
                  <Text className="font-bold text-base text-white">
                    {normalizeVietnameseName(getCurrentUser()?.fullname) || 'Chưa phân công'}
                  </Text>
                  <Text className="text-sm text-[#BEBEBE]">
                    {getCurrentUser()?.jobTitle || 'Không xác định'}
                  </Text>
                  <Text className="font-bold text-sm text-white">{formatAssignmentDuration()}</Text>
                </View>
                <TouchableOpacity
                  className="items-center p-2"
                  onPress={handleViewHandoverDocument}
                  disabled={!getHandoverDocument()}
                  style={{ opacity: getHandoverDocument() ? 1 : 0.5 }}>
                  <MaterialCommunityIcons
                    name={getHandoverDocument() ? 'file-document' : 'file-document-outline'}
                    size={24}
                    color="white"
                  />
                  <Text className="mt-1 text-xs text-white">
                    {getHandoverDocument() ? 'Biên bản' : 'N/A'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="space-y-2 border-t border-gray-300 pb-1 pt-3">
                <Text className="font-bold text-sm text-white">
                  Người bàn giao: {getAssignedByUser()}
                </Text>
              </View>
              {renderSigningBlock()}
            </View>
          ) : (
            <View className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-100 p-4">
              <View className="items-center py-4">
                <MaterialCommunityIcons name="account-off-outline" size={48} color="#9CA3AF" />
                <Text className="mt-3 text-center font-bold text-base text-gray-500">
                  Thiết bị chưa được bàn giao
                </Text>
                <Text className="mt-1 text-center text-sm text-gray-400">
                  Thiết bị này hiện chưa được cấp phát cho ai
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Device Logs */}
        <View className="mb-6 px-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-bold text-xl text-primary">Nhật ký</Text>
            <TouchableOpacity onPress={() => setAddActivityModalVisible(true)}>
              <Text className="font-bold text-[#F05023]">Cập nhật</Text>
            </TouchableOpacity>
          </View>

          {/* Log Tabs */}
          <View className="mb-4 flex-row gap-1 rounded-2xl bg-gray-100 p-1">
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'maintenance', label: 'Sửa chữa' },
              { key: 'software', label: 'Phần mềm' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setSelectedLogTab(tab.key as any)}
                className={`flex-1 rounded-full px-3 py-2 ${
                  selectedLogTab === tab.key ? 'bg-[#002855]' : 'bg-transparent'
                }`}>
                <Text
                  className={`text-center font-bold text-sm ${
                    selectedLogTab === tab.key ? 'text-white' : 'text-[#757575]'
                  }`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Log List */}
          {getFilteredLogs().length > 0 ? (
            getFilteredLogs().map(renderLogItem)
          ) : (
            <View className="items-center py-8">
              <MaterialCommunityIcons name="clipboard-text-outline" size={40} color="#ccc" />
              <Text className="mt-2 text-gray-500">Chưa có nhật ký nào</Text>
            </View>
          )}
        </View>
      </ScrollView>
      {/* Edit Spec Modal */}
      <InputModal
        visible={editModalVisible}
        title={`Chỉnh sửa ${editSpecLabel}`}
        placeholder={`Nhập ${editSpecLabel.toLowerCase()}...`}
        value={editSpecValue}
        onChangeText={setEditSpecValue}
        onCancel={handleCancelEdit}
        onConfirm={handleSaveSpec}
        isLoading={isSavingSpec}
      />
      {/* Modals */}
      <RevokeModal
        visible={revokeModalVisible}
        onClose={() => setRevokeModalVisible(false)}
        onConfirm={handleRevokeDevice}
        deviceName={device?.name || ''}
        currentUserName={normalizeVietnameseName(getCurrentUser()?.fullname) || 'Không xác định'}
      />
      <AssignModal
        visible={assignModalVisible}
        onClose={() => setAssignModalVisible(false)}
        onConfirm={handleAssignDevice}
        deviceName={device?.name || ''}
      />
      <ReportBrokenModal
        visible={reportBrokenModalVisible}
        onClose={() => setReportBrokenModalVisible(false)}
        onConfirm={handleReportBroken}
        deviceName={device?.name || ''}
      />
      {/* File Preview Modal */}
      <FilePreviewModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        fileUrl={previewFileUrl}
        authToken={authToken}
        title="Biên bản bàn giao"
      />
      {/* Add Activity Modal */}
      <AddActivityModal
        visible={addActivityModalVisible}
        onClose={() => setAddActivityModalVisible(false)}
        onAdd={handleAddActivity}
        activityType={newActivityType}
        onActivityTypeChange={setNewActivityType}
        title={newActivityTitle}
        onTitleChange={setNewActivityTitle}
        description={newActivityDescription}
        onDescriptionChange={setNewActivityDescription}
      />
    </SafeAreaView>
  );
};

export default DevicesDetailScreen;
