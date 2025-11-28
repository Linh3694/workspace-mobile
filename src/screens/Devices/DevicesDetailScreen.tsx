import UploadDocumentModal from '../../components/UploadDocumentModal';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Device, DeviceType, DeviceActivity, DeviceInspection } from '../../types/devices';
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
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
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
  const [uploadDocumentModalVisible, setUploadDocumentModalVisible] = useState(false);
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

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [previewFileUrl, setPreviewFileUrl] = useState<string>('');
  const [authToken, setAuthToken] = useState<string>('');

  useEffect(() => {
    loadDeviceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const loadDeviceData = useCallback(
    async (showLoading = true) => {
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
        console.error('Error loading device data:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Không thể tải dữ liệu thiết bị';
        setError(errorMessage);
        Alert.alert('Lỗi', errorMessage);
      } finally {
        if (showLoading) {
          setLoading(false);
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
    await loadDeviceData();
    setRefreshing(false);
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

    if (openRecord && openRecord.assignedBy) {
      return normalizeVietnameseName(openRecord.assignedBy.fullname) || 'Không xác định';
    }

    // Fallback: lấy record mới nhất có assignedBy
    const latestRecordWithAssignedBy = device.assignmentHistory
      .filter((hist: any) => hist.assignedBy)
      .sort(
        (a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      )[0];

    if (latestRecordWithAssignedBy && latestRecordWithAssignedBy.assignedBy) {
      return (
        normalizeVietnameseName(latestRecordWithAssignedBy.assignedBy.fullname) || 'Không xác định'
      );
    }

    return 'Không xác định';
  };

  const getCurrentUser = () => {
    if (!device?.assignmentHistory || device.assignmentHistory.length === 0) {
      return null;
    }

    // Tìm record đang mở (chưa có endDate) trong assignmentHistory
    const openRecord = device.assignmentHistory.find((hist: any) => !hist.endDate);

    if (openRecord && openRecord.user) {
      return {
        _id: openRecord.user._id || '',
        fullname:
          openRecord.userName ||
          normalizeVietnameseName(openRecord.user.fullname) ||
          'Không xác định',
        department: openRecord.user.department || 'Không xác định',
        jobTitle: openRecord.jobTitle || openRecord.user.jobTitle || 'Không xác định',
        avatarUrl: openRecord.user.avatarUrl,
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

  const handleAssignDevice = async (userId: string, notes?: string) => {
    try {
      if (!device) return;

      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/${deviceType}s/${device._id}/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newUserId: userId,
          notes: notes,
        }),
      });

      if (response.ok) {
        await fetchDeviceDetail();
        Alert.alert('Thành công', 'Cấp phát thiết bị thành công!');
      } else {
        const error = await response.json();
        Alert.alert('Lỗi', error.message || 'Không thể cấp phát thiết bị');
      }
    } catch (error) {
      console.error('Error assigning device:', error);
      throw error;
    }
  };

  const handleReportBroken = async (reason: string) => {
    try {
      if (!device) return;

      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/${deviceType}s/${device._id}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'Broken',
          brokenReason: reason,
        }),
      });

      if (response.ok) {
        await fetchDeviceDetail();
        Alert.alert('Thành công', 'Báo hỏng thiết bị thành công!');
      } else {
        const error = await response.json();
        Alert.alert('Lỗi', error.message || 'Không thể báo hỏng thiết bị');
      }
    } catch (error) {
      console.error('Error reporting broken device:', error);
      throw error;
    }
  };

  const handleCameraUpload = async () => {
    try {
      if (!device || isUploading) return;
      setIsUploading(true);

      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraPermission.status !== 'granted') {
        Alert.alert('Lỗi', 'Cần cấp quyền truy cập camera để chụp ảnh');
        setIsUploading(false);
        return;
      }

      const cameraResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!cameraResult.canceled && cameraResult.assets && cameraResult.assets[0]) {
        await uploadFile(cameraResult.assets[0].uri, `camera_${Date.now()}.jpg`, 'image/jpeg');
      }
    } catch (error) {
      console.error('Error with camera upload:', error);
      Alert.alert(
        'Lỗi',
        'Có lỗi xảy ra khi chụp ảnh: ' +
          (error instanceof Error ? error.message : 'Lỗi không xác định')
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleGalleryUpload = async () => {
    try {
      if (!device || isUploading) return;
      setIsUploading(true);

      // Request media library permissions
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (mediaPermission.status !== 'granted') {
        Alert.alert('Lỗi', 'Cần cấp quyền truy cập thư viện ảnh');
        return;
      }

      const galleryResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!galleryResult.canceled && galleryResult.assets && galleryResult.assets[0]) {
        await uploadFile(
          galleryResult.assets[0].uri,
          galleryResult.assets[0].fileName || `gallery_${Date.now()}.jpg`,
          galleryResult.assets[0].mimeType || 'image/jpeg'
        );
      }
    } catch (error) {
      console.error('Error with gallery upload:', error);
      Alert.alert(
        'Lỗi',
        'Có lỗi xảy ra khi chọn ảnh từ thư viện: ' +
          (error instanceof Error ? error.message : 'Lỗi không xác định')
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDocumentUpload = async () => {
    try {
      if (!device || isUploading) return;
      setIsUploading(true);

      const documentResult = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/*',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (!documentResult.canceled && documentResult.assets && documentResult.assets[0]) {
        await uploadFile(
          documentResult.assets[0].uri,
          documentResult.assets[0].name,
          documentResult.assets[0].mimeType || 'application/octet-stream'
        );
      } else {
      }
    } catch (error) {
      console.error('Error with document upload:', error);
      Alert.alert(
        'Lỗi',
        'Có lỗi xảy ra khi chọn tài liệu: ' +
          (error instanceof Error ? error.message : 'Lỗi không xác định')
      );
    } finally {
      setIsUploading(false);
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

    if (openRecord && openRecord.document) {
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

      // Xử lý đường dẫn file
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
        `${API_BASE_URL}/uploads/Handovers/${fileName}`, // Frappe uploads (như frappe frontend sử dụng)
        `${API_BASE_URL}/api/${endpoint}/handover/${fileName}`, // Microservice files
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

  const uploadFile = async (fileUri: string, fileName: string, fileType: string) => {
    try {
      if (!device) {
        return;
      }

      const token = await AsyncStorage.getItem('authToken');
      const endpoint = getDeviceEndpoint(deviceType);
      const uploadUrl = `${API_BASE_URL}/api/${endpoint}/upload`;

      // Bỏ qua test endpoint vì function đã được xóa

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: fileType,
        name: fileName,
      } as any);

      const deviceIdParam = `${deviceType}Id`;
      formData.append(deviceIdParam, device._id);

      const currentUser = getCurrentUser();
      if (currentUser) {
        formData.append('userId', currentUser._id);
        formData.append('username', normalizeVietnameseName(currentUser.fullname));
      } else {
        throw new Error('Không tìm thấy thông tin người dùng');
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Không thể tải lên biên bản';

        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          try {
            const errorText = await response.text();
            errorMessage = `Lỗi server ${response.status}: ${errorText.substring(0, 100)}`;
          } catch {
            errorMessage = `Lỗi server ${response.status}: Không thể đọc response`;
          }
        }
        throw new Error(errorMessage);
      }

      await fetchDeviceDetail();
      Alert.alert('Thành công', 'Tải lên biên bản thành công!');
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert(
        'Lỗi',
        'Có lỗi xảy ra khi tải lên biên bản: ' +
          (error instanceof Error ? error.message : 'Lỗi không xác định')
      );
    }
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
              const token = await AsyncStorage.getItem('authToken');
              const response = await fetch(`${API_BASE_URL}/api/${deviceType}s/${device._id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                Alert.alert('Thành công', 'Thiết bị đã được thanh lý thành công!', [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ]);
              } else {
                const error = await response.json();
                Alert.alert('Lỗi', error.message || 'Không thể thanh lý thiết bị');
              }
            } catch (error) {
              console.error('Error disposing device:', error);
              Alert.alert('Lỗi', 'Có lỗi xảy ra khi thanh lý thiết bị');
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
              const token = await AsyncStorage.getItem('authToken');
              const response = await fetch(
                `${API_BASE_URL}/api/${deviceType}s/${device._id}/status`,
                {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    status: 'Standby',
                  }),
                }
              );

              if (response.ok) {
                await fetchDeviceDetail();
                Alert.alert('Thành công', 'Thiết bị đã được phục hồi thành công!');
              } else {
                const error = await response.json();
                Alert.alert('Lỗi', error.message || 'Không thể phục hồi thiết bị');
              }
            } catch (error) {
              console.error('Error restoring device:', error);
              Alert.alert('Lỗi', 'Có lỗi xảy ra khi phục hồi thiết bị');
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

        {/* PendingDocumentation Status: Cập nhật biên bản */}
        {device.status === 'PendingDocumentation' && (
          <>
            <TouchableOpacity
              onPress={() => setUploadDocumentModalVisible(true)}
              className="h-12 w-12 items-center justify-center rounded-full bg-[#002855]">
              <MaterialCommunityIcons name="file-document" size={24} color="white" />
            </TouchableOpacity>
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
      {/* Floating Action Button */}
      <TouchableOpacity className="absolute bottom-8 right-5 h-14 w-14 items-center justify-center rounded-full bg-[#F05023] shadow-lg">
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
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
      <UploadDocumentModal
        visible={uploadDocumentModalVisible}
        onClose={() => setUploadDocumentModalVisible(false)}
        onCamera={handleCameraUpload}
        onGallery={handleGalleryUpload}
        onDocument={handleDocumentUpload}
        isUploading={isUploading}
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
