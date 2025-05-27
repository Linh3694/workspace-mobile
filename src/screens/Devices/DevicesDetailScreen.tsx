import UploadDocumentModal from '../../components/UploadDocumentModal';
import React, { useEffect, useState } from 'react';
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
    Linking,
    Dimensions
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Device, DeviceType } from '../../types/devices';
import deviceService from '../../services/deviceService';
import InputModal from '../../components/InputModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/constants';
import { getAvatar } from '../../utils/avatar';
import RevokeModal from '../../components/RevokeModal';
import AssignModal from '../../components/AssignModal';
import ReportBrokenModal from '../../components/ReportBrokenModal';
import FilePreviewModal from '../../components/FilePreviewModal';
import AddActivityModal from '../../components/AddActivityModal';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import RevokeIcon from '../../assets/revoke-devices.svg'
import AssignIcon from '../../assets/assign-devices.svg'
import BrokenIcon from '../../assets/broken-devices.svg'



type DeviceDetailScreenRouteProp = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.DEVICE_DETAIL>;
type DeviceDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, typeof ROUTES.SCREENS.DEVICE_DETAIL>;

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



    const [device, setDevice] = useState<Device | null>(null);
    const [logs, setLogs] = useState<DeviceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedLogTab, setSelectedLogTab] = useState<'all' | 'maintenance' | 'software'>('all');
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editSpecValue, setEditSpecValue] = useState('');
    const [editSpecKey, setEditSpecKey] = useState('');
    const [editSpecLabel, setEditSpecLabel] = useState('');
    const [revokeModalVisible, setRevokeModalVisible] = useState(false);
    const [assignModalVisible, setAssignModalVisible] = useState(false);
    const [reportBrokenModalVisible, setReportBrokenModalVisible] = useState(false);
    const [uploadDocumentModalVisible, setUploadDocumentModalVisible] = useState(false);
    const [selectedDocumentType, setSelectedDocumentType] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [previewFileUrl, setPreviewFileUrl] = useState<string>('');
    const [previewFileType, setPreviewFileType] = useState<'pdf' | 'image'>('pdf');
    const [authToken, setAuthToken] = useState<string>('');
    const [addActivityModalVisible, setAddActivityModalVisible] = useState(false);
    const [newActivityType, setNewActivityType] = useState<'repair' | 'software'>('repair');
    const [newActivityTitle, setNewActivityTitle] = useState('');
    const [newActivityDescription, setNewActivityDescription] = useState('');

    useEffect(() => {
        fetchDeviceDetail();
        fetchDeviceLogs();
    }, [deviceId]);

    const fetchDeviceDetail = async () => {
        try {
            setLoading(true);
            const response = await deviceService.getDeviceById(deviceType, deviceId);
            if (response) {
                setDevice(response);
            } else {
                Alert.alert('Lỗi', 'Không tìm thấy thông tin thiết bị');
            }
        } catch (error) {
            console.error('Error fetching device detail:', error);
            Alert.alert('Lỗi', 'Không thể tải thông tin thiết bị');
        } finally {
            setLoading(false);
        }
    };

    const fetchDeviceLogs = async () => {
        try {
            // Sử dụng Activity API thay vì deviceService.getDeviceLogs
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}/api/activities/${deviceType}/${deviceId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const activities = await response.json();
                // Map activities to logs format
                const mappedLogs = activities.map((activity: any) => ({
                    _id: activity._id,
                    type: activity.type === 'repair' ? 'maintenance' : 'software',
                    title: activity.description,
                    description: activity.details || activity.description,
                    date: activity.date,
                    user: {
                        fullname: activity.updatedBy || 'Hệ thống',
                        department: 'Không xác định'
                    },
                    status: 'completed'
                }));
                setLogs(mappedLogs);
            } else {
                setLogs([]);
            }
        } catch (error) {
            console.error('Error fetching device logs:', error);
            setLogs([]);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchDeviceDetail(), fetchDeviceLogs()]);
        setRefreshing(false);
    };

    const handleGoBack = () => {
        navigation.goBack();
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
            case 'PendingDocumentation': return 'Thiếu biên bản';
            default: return 'Không xác định';
        }
    };

    const getDeviceIcon = (deviceType: DeviceType) => {
        switch (deviceType) {
            case 'laptop': return 'laptop';
            case 'monitor': return 'monitor';
            case 'printer': return 'printer';
            case 'projector': return 'projector';
            case 'tool': return 'tools';
            default: return 'laptop';
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
        return logs.filter(log => log.type === selectedLogTab);
    };

    const handleAddActivity = async () => {
        try {
            if (!newActivityTitle.trim()) {
                Alert.alert('Lỗi', 'Vui lòng nhập tiêu đề hoạt động');
                return;
            }

            const token = await AsyncStorage.getItem('authToken');
            const userData = await AsyncStorage.getItem('user');

            console.log('Debug user data:');
            console.log('userData:', userData);

            let user = null;
            let userName = 'Người dùng';

            // Lấy thông tin user từ key 'user'
            if (userData) {
                try {
                    user = JSON.parse(userData);
                    userName = user?.fullname || user?.name || user?.username || 'Người dùng';
                    console.log('From userData:', userName);
                } catch (e) {
                    console.error('Error parsing userData:', e);
                }
            }

            // Nếu vẫn không có tên, thử lấy từ userFullname riêng biệt
            if (!userName || userName === 'Người dùng') {
                const fullname = await AsyncStorage.getItem('userFullname');
                if (fullname) {
                    userName = fullname;
                    console.log('From userFullname:', userName);
                }
            }

            const activityData = {
                entityType: deviceType,
                entityId: deviceId,
                type: newActivityType === 'repair' ? 'repair' : 'update',
                description: newActivityTitle,
                details: newActivityDescription,
                updatedBy: userName
            };

            console.log('Sending activity data:', activityData);
            console.log('API URL:', `${API_BASE_URL}/api/activities`);

            const response = await fetch(`${API_BASE_URL}/api/activities`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(activityData)
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            if (response.ok) {
                setAddActivityModalVisible(false);
                setNewActivityTitle('');
                setNewActivityDescription('');
                setNewActivityType('repair');
                await fetchDeviceLogs();
                Alert.alert('Thành công', 'Thêm hoạt động thành công!');
            } else {
                let errorMessage = 'Không thể thêm hoạt động';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                    errorMessage = `Lỗi server ${response.status}`;
                }
                Alert.alert('Lỗi', errorMessage);
            }
        } catch (error) {
            console.error('Error adding activity:', error);
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi thêm hoạt động');
        }
    };

    const getAssignedByUser = () => {
        if (!device?.assignmentHistory || device.assignmentHistory.length === 0) {
            return 'Không xác định';
        }

        // Tìm record đang mở (chưa có endDate) trong assignmentHistory
        const openRecord = device.assignmentHistory.find((hist: any) => !hist.endDate);

        if (openRecord && openRecord.assignedBy) {
            return openRecord.assignedBy.fullname || 'Không xác định';
        }

        // Fallback: lấy record mới nhất có assignedBy
        const latestRecordWithAssignedBy = device.assignmentHistory
            .filter((hist: any) => hist.assignedBy)
            .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];

        if (latestRecordWithAssignedBy && latestRecordWithAssignedBy.assignedBy) {
            return latestRecordWithAssignedBy.assignedBy.fullname || 'Không xác định';
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
                fullname: openRecord.userName || openRecord.user.fullname || 'Không xác định',
                department: openRecord.user.department || 'Không xác định',
                jobTitle: openRecord.jobTitle || openRecord.user.jobTitle || 'Không xác định',
                avatarUrl: openRecord.user.avatarUrl
            };
        }

        // Fallback: người dùng từ assigned array (nếu có)
        if (device.assigned && device.assigned.length > 0) {
            const latestAssigned = device.assigned[device.assigned.length - 1];
            return {
                _id: latestAssigned._id || '',
                fullname: latestAssigned.fullname || 'Không xác định',
                department: latestAssigned.department || 'Không xác định',
                jobTitle: latestAssigned.jobTitle || 'Không xác định',
                avatarUrl: latestAssigned.avatarUrl
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

    const handleViewAssignmentHistory = () => {
        navigation.navigate(ROUTES.SCREENS.DEVICE_ASSIGNMENT_HISTORY, {
            deviceId: device!._id,
            deviceType: deviceType,
            deviceName: device!.name
        });
    };

    const handleRevokeDevice = async (reasons: string[]) => {
        try {
            if (!device) return;

            await deviceService.revokeDevice(deviceType, device._id, {
                reasons,
                status: 'Standby'
            });

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
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    newUserId: userId,
                    notes: notes
                })
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
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'Broken',
                    brokenReason: reason
                })
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
                await uploadFile(
                    cameraResult.assets[0].uri,
                    `camera_${Date.now()}.jpg`,
                    'image/jpeg'
                );
            }
        } catch (error) {
            console.error('Error with camera upload:', error);
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi chụp ảnh: ' + (error instanceof Error ? error.message : 'Lỗi không xác định'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleGalleryUpload = async () => {
        try {
            if (!device || isUploading) return;
            setIsUploading(true);

            console.log('Starting gallery upload...');

            // Request media library permissions
            const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            console.log('Media permission:', mediaPermission);
            
            if (mediaPermission.status !== 'granted') {
                Alert.alert('Lỗi', 'Cần cấp quyền truy cập thư viện ảnh');
                return;
            }

            console.log('Launching image library...');
            const galleryResult = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.7,
            });

            console.log('Gallery result:', galleryResult);

            if (!galleryResult.canceled && galleryResult.assets && galleryResult.assets[0]) {
                console.log('Selected image:', galleryResult.assets[0]);
                await uploadFile(
                    galleryResult.assets[0].uri,
                    galleryResult.assets[0].fileName || `gallery_${Date.now()}.jpg`,
                    galleryResult.assets[0].mimeType || 'image/jpeg'
                );
            } else {
                console.log('Gallery selection was canceled or no assets selected');
            }
        } catch (error) {
            console.error('Error with gallery upload:', error);
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi chọn ảnh từ thư viện: ' + (error instanceof Error ? error.message : 'Lỗi không xác định'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleDocumentUpload = async () => {
        try {
            if (!device || isUploading) return;
            setIsUploading(true);

            console.log('Starting document upload...');

            const documentResult = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                copyToCacheDirectory: true,
            });

            console.log('Document result:', documentResult);

            if (!documentResult.canceled && documentResult.assets && documentResult.assets[0]) {
                console.log('Selected document:', documentResult.assets[0]);
                await uploadFile(
                    documentResult.assets[0].uri,
                    documentResult.assets[0].name,
                    documentResult.assets[0].mimeType || 'application/octet-stream'
                );
            } else {
                console.log('Document selection was canceled or no assets selected');
            }
        } catch (error) {
            console.error('Error with document upload:', error);
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi chọn tài liệu: ' + (error instanceof Error ? error.message : 'Lỗi không xác định'));
        } finally {
            setIsUploading(false);
        }
    };

    const getDeviceEndpoint = (deviceType: DeviceType) => {
        // Map device types to their correct API endpoints
        const endpointMap = {
            'laptop': 'laptops',
            'monitor': 'monitors',
            'printer': 'printers',
            'projector': 'projectors',
            'tool': 'tools'
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
            const fileUrl = `${API_BASE_URL}/api/${endpoint}/handover/${fileName}`;

            console.log('Opening handover document:', {
                documentPath,
                fileName,
                fileUrl,
                endpoint,
                token: token.substring(0, 20) + '...'
            });

            // Xác định loại file
            const fileType = getFileType(fileName);

            // Mở preview trong app
            setPreviewFileUrl(fileUrl);
            setPreviewFileType(fileType);
            setAuthToken(token);
            setPreviewModalVisible(true);

        } catch (error) {
            console.error('Error viewing handover document:', error);
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi mở file biên bản: ' + (error instanceof Error ? error.message : 'Lỗi không xác định'));
        }
    };

    const uploadFile = async (fileUri: string, fileName: string, fileType: string) => {
        try {
            if (!device) {
                console.log('No device found for upload');
                return;
            }

            console.log('Starting file upload:', { fileUri, fileName, fileType });
            console.log('Device type:', deviceType);
            console.log('Device ID:', device._id);

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
                formData.append('username', currentUser.fullname);
            } else {
                throw new Error('Không tìm thấy thông tin người dùng');
            }

            console.log('Making upload request to:', uploadUrl);
            console.log('Endpoint mapping:', { deviceType, endpoint });
            console.log('Form data params:', {
                deviceIdParam,
                deviceId: device._id,
                userId: currentUser?._id,
                username: currentUser?.fullname
            });
            
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData
            });

            console.log('Upload response status:', response.status);
            console.log('Upload response headers:', response.headers);

            if (!response.ok) {
                let errorMessage = 'Không thể tải lên biên bản';
                console.log('Upload failed with status:', response.status);

                try {
                    const errorData = await response.json();
                    console.log('Error response data:', errorData);
                    errorMessage = errorData.message || errorMessage;
                } catch (parseError) {
                    console.log('Failed to parse error as JSON, trying text...');
                    try {
                        const errorText = await response.text();
                        console.log('Error response text:', errorText);
                        errorMessage = `Lỗi server ${response.status}: ${errorText.substring(0, 100)}`;
                    } catch (textError) {
                        console.log('Failed to parse error as text');
                        errorMessage = `Lỗi server ${response.status}: Không thể đọc response`;
                    }
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('Upload success:', result);

            await fetchDeviceDetail();
            Alert.alert('Thành công', 'Tải lên biên bản thành công!');
        } catch (error) {
            console.error('Error uploading file:', error);
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi tải lên biên bản: ' + (error instanceof Error ? error.message : 'Lỗi không xác định'));
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
                    style: 'cancel'
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
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                }
                            });

                            if (response.ok) {
                                Alert.alert('Thành công', 'Thiết bị đã được thanh lý thành công!', [
                                    {
                                        text: 'OK',
                                        onPress: () => navigation.goBack()
                                    }
                                ]);
                            } else {
                                const error = await response.json();
                                Alert.alert('Lỗi', error.message || 'Không thể thanh lý thiết bị');
                            }
                        } catch (error) {
                            console.error('Error disposing device:', error);
                            Alert.alert('Lỗi', 'Có lỗi xảy ra khi thanh lý thiết bị');
                        }
                    }
                }
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
                    style: 'cancel'
                },
                {
                    text: 'Phục hồi',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('authToken');
                            const response = await fetch(`${API_BASE_URL}/api/${deviceType}s/${device._id}/status`, {
                                method: 'PUT',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    status: 'Standby'
                                })
                            });

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
                    }
                }
            ]
        );
    };

    const canRevokeDevice = () => {
        return device &&
            device.assigned &&
            device.assigned.length > 0 &&
            device.status === 'Active';
    };

    const handleEditSpec = (specKey: string, currentValue: string, label: string) => {
        setEditSpecKey(specKey);
        setEditSpecValue(currentValue);
        setEditSpecLabel(label);
        setEditModalVisible(true);
    };

    const handleSaveSpec = async () => {
        if (!device) return;

        try {
            // Hiển thị loading state
            setLoading(true);

            let payload: any = {};

            if (['processor', 'ram', 'storage', 'display'].includes(editSpecKey)) {
                // Đảm bảo device.specs tồn tại trước khi cập nhật
                payload.specs = {
                    ...device.specs,
                    [editSpecKey]: editSpecValue
                };
            } else {
                payload[editSpecKey] = editSpecKey === 'releaseYear' ? parseInt(editSpecValue) : editSpecValue;
            }

            // Xác định endpoint đúng cho từng loại thiết bị
            const endpoint = getDeviceEndpoint(deviceType);
            const response = await fetch(`${API_BASE_URL}/api/${endpoint}/${device._id}/specs`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                // Gọi lại cả fetchDeviceDetail và fetchDeviceLogs để đảm bảo tất cả thông tin được cập nhật đầy đủ
                await Promise.all([fetchDeviceDetail(), fetchDeviceLogs()]);
                setEditModalVisible(false);
                Alert.alert('Thành công', 'Cập nhật thông số thành công!');
            } else {
                const errorData = await response.json();
                Alert.alert('Lỗi', errorData.message || 'Không thể cập nhật thông số!');
            }
        } catch (error) {
            console.error('Error updating spec:', error);
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi cập nhật!');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        // Không cho phép đóng modal khi đang loading
        if (loading) return;

        setEditModalVisible(false);
        setEditSpecValue('');
        setEditSpecKey('');
        setEditSpecLabel('');
    };

    const renderSpecCard = (icon: string, label: string, value: string, specKey: string, color: string = '#F05023') => (
        <TouchableOpacity
            className="bg-gray-100 rounded-2xl ml-2 p-3 items-center"
            style={{ width: 100, minWidth: 100 }}
            onPress={() => handleEditSpec(specKey, value, label)}
        >
            <View 
                className="w-8 h-8 rounded-lg items-center justify-center mb-2"
                style={{ backgroundColor: color }}
            >
                <MaterialCommunityIcons name={icon as any} size={16} color="white" />
            </View>
            <Text className="text-sm text-gray-500 text-center mb-1" numberOfLines={1}>{label}</Text>
            <Text className="text-base font-semibold text-gray-800 text-center" numberOfLines={2}>{value}</Text>
        </TouchableOpacity>
    );

    const renderLogItem = (log: DeviceLog) => (
        <View key={log._id} className="bg-[#E4E9EF] rounded-xl p-4 mb-3">
            <View className="flex-row justify-between items-start">
                <Text className="text-base font-semibold text-gray-800 flex-1 mr-2">
                    {log.title}
                </Text>
                <Text className="text-sm text-primary font-semibold">
                    {log.user.fullname}
                </Text>
            </View>

            <View className="flex-row justify-between items-center my-1">
                <Text className="text-xs text-[#A5A5A5] font-medium">
                    {formatDateTime(log.date)}
                </Text>
                <View className={`px-3 py-1 rounded-lg ${log.type === 'maintenance' ? 'bg-secondary' : 'bg-primary'}`}>
                    <Text className="text-xs text-white font-semibold">
                        {log.type === 'maintenance' ? 'Sửa chữa' : 'Phần mềm'}
                    </Text>
                </View>
            </View>

            <View className="flex-row justify-between items-center">
                <Text className="text-sm text-[#757575]">
                    {log.description}
                </Text>

            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white">
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#002855" />
                    <Text className="text-base text-[#002855] mt-3">Đang tải thông tin thiết bị...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!device) {
        return (
            <SafeAreaView className="flex-1 bg-white">
                <View className="flex-1 items-center justify-center">
                    <MaterialCommunityIcons name="alert-circle" size={60} color="#EF4444" />
                    <Text className="text-base text-gray-600 mt-3 text-center">
                        Không tìm thấy thông tin thiết bị
                    </Text>
                    <TouchableOpacity
                        onPress={handleGoBack}
                        className="bg-primary px-6 py-3 rounded-lg mt-4"
                    >
                        <Text className="text-white font-semibold">Quay lại</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-4 pb-1">
                <View className="flex-1">
                    <Text className="text-2xl font-bold text-primary" numberOfLines={1}>
                        {device.name}
                    </Text>
                </View>

                <TouchableOpacity onPress={handleGoBack} className="p-1">
                    <Text className="text-2xl font-bold text-primary">x</Text>
                </TouchableOpacity>
            </View>
            <View className="px-5 pb-4">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <View
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: getStatusColor(device.status) }}
                        />
                        <Text className="text-lg font-medium" style={{ color: getStatusColor(device.status) }}>
                            {getStatusLabel(device.status)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Action Buttons Based on Device Status */}
            <View className="flex-row items-start px-5 py-2 gap-4 bg-white mb-4">
                {/* Standby Status: Cấp phát và Báo hỏng */}
                {device.status === 'Standby' && (
                    <>
                        <TouchableOpacity
                            onPress={() => setAssignModalVisible(true)}
                            className="w-12 h-12 rounded-full bg-[#3FA83B] items-center justify-center"

                        >
                            <AssignIcon width={40} height={40} fill="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setReportBrokenModalVisible(true)}
                            className="w-12 h-12 rounded-full bg-[#DC0909] items-center justify-center"
                        >
                            <BrokenIcon width={24} height={24} fill="white" />
                        </TouchableOpacity>
                    </>
                )}

                {/* PendingDocumentation Status: Cập nhật biên bản */}
                {device.status === 'PendingDocumentation' && (
                    <>
                        <TouchableOpacity
                            onPress={() => setUploadDocumentModalVisible(true)}
                            className="w-12 h-12 rounded-full bg-[#002855] items-center justify-center"
                        >
                            <MaterialCommunityIcons name="file-document" size={24} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setRevokeModalVisible(true)}
                            className="w-12 h-12 rounded-full bg-[#EAA300] items-center justify-center"
                        >
                            <RevokeIcon width={24} height={24} fill="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setReportBrokenModalVisible(true)}
                            className="w-12 h-12 rounded-full bg-[#EF4444] items-center justify-center"
                        >
                            <BrokenIcon width={24} height={24} fill="white" />
                        </TouchableOpacity>
                    </>
                )}

                {/* Active Status: Thu hồi và Báo hỏng */}
                {device.status === 'Active' && (
                    <>
                        <TouchableOpacity
                            onPress={() => setRevokeModalVisible(true)}
                            className="w-12 h-12 rounded-full bg-[#EAA300] items-center justify-center"
                        >
                            <RevokeIcon width={24} height={24} fill="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setReportBrokenModalVisible(true)}
                            className="w-12 h-12 rounded-full bg-[#EF4444] items-center justify-center"
                        >
                            <BrokenIcon width={24} height={24} fill="white" />
                        </TouchableOpacity>
                    </>
                )}

                {/* Broken Status: Thanh lý và Phục hồi */}
                {device.status === 'Broken' && (
                    <>
                        <TouchableOpacity
                            onPress={handleDisposeDevice}
                            className="w-12 h-12 rounded-full bg-red-600 items-center justify-center"
                        >
                            <MaterialCommunityIcons name="delete-forever" size={24} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleRestoreDevice}
                            className="w-12 h-12 rounded-full bg-green-600 items-center justify-center"
                        >
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
                }
            >

                {/* Specs - chỉ hiển thị khi có ít nhất một thông số */}
                {((device.specs?.processor && device.specs.processor.trim() !== '') ||
                    (device.specs?.ram && device.specs.ram.trim() !== '') ||
                    (device.specs?.storage && device.specs.storage.trim() !== '') ||
                    (device.specs?.display && device.specs.display.trim() !== '') ||
                    (device.releaseYear && device.releaseYear > 0) ||
                    (device.manufacturer && device.manufacturer.trim() !== '')) && (
                        <View className="px-2 mb-6">
                            <ScrollView
                                horizontal={true}
                                showsHorizontalScrollIndicator={false}
                                className="flex-1"
                                contentContainerStyle={{ paddingHorizontal: 5 }}
                            >
                                <View className="flex-row space-x-3">
                                    {(device.specs?.processor && device.specs.processor.trim() !== '') && renderSpecCard('cpu-64-bit', 'CPU', device.specs.processor, 'processor')}
                                    {(device.specs?.ram && device.specs.ram.trim() !== '') && renderSpecCard('memory', 'Bộ nhớ', device.specs.ram, 'ram')}
                                    {(device.specs?.storage && device.specs.storage.trim() !== '') && renderSpecCard('harddisk', 'Ổ cứng', device.specs.storage, 'storage')}
                                    {(device.specs?.display && device.specs.display.trim() !== '') && renderSpecCard('monitor', 'Màn hình', device.specs.display, 'display')}
                                    {(device.releaseYear && device.releaseYear > 0) && renderSpecCard('calendar', 'Năm sản xuất', device.releaseYear.toString(), 'releaseYear')}
                                    {(device.manufacturer && device.manufacturer.trim() !== '') && renderSpecCard('wrench', 'Hãng sản xuất', device.manufacturer, 'manufacturer')}
                                </View>
                        </ScrollView>
                    </View>
                    )}

                {/* Assignment Info */}
                <View className="px-5 mb-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-lg font-bold text-gray-800">Thông tin bàn giao</Text>
                        <TouchableOpacity onPress={handleViewAssignmentHistory}>
                            <Text className="text-[#F05023] font-bold">Xem tất cả</Text>
                        </TouchableOpacity>
                    </View>
                    {getCurrentUser() ? (
                        <View className="bg-[#002855] rounded-xl p-4">
                            <View className="flex-row items-center mb-3">
                                <Image
                                    source={{ uri: getAvatar(getCurrentUser()) }}
                                    className="w-16 h-16 rounded-full mr-3"
                                />
                                <View className="flex-1 gap-2">
                                    <Text className="text-white font-bold text-base">
                                        {getCurrentUser()?.fullname || 'Chưa phân công'}
                                    </Text>
                                    <Text className="text-[#BEBEBE] text-sm">
                                        {getCurrentUser()?.jobTitle || 'Không xác định'}
                                    </Text>
                                    <Text className="text-white text-sm font-bold">
                                        {formatAssignmentDuration()}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    className="p-2 items-center"
                                    onPress={handleViewHandoverDocument}
                                    disabled={!getHandoverDocument()}
                                    style={{ opacity: getHandoverDocument() ? 1 : 0.5 }}
                                >
                                    <MaterialCommunityIcons
                                        name={getHandoverDocument() ? "file-document" : "file-document-outline"}
                                        size={24}
                                        color="white"
                                    />
                                    <Text className="text-white text-xs mt-1">
                                        {getHandoverDocument() ? 'Biên bản' : 'N/A'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View className="border-t border-gray-300 pt-3 pb-1 space-y-2">
                                <Text className="text-white text-sm font-bold">
                                    Người bàn giao: {getAssignedByUser()}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View className="bg-gray-100 rounded-xl p-4 border-2 border-dashed border-gray-300">
                            <View className="items-center py-4">
                                <MaterialCommunityIcons
                                    name="account-off-outline"
                                    size={48}
                                    color="#9CA3AF"
                                />
                                <Text className="text-gray-500 font-bold text-base mt-3 text-center">
                                    Thiết bị chưa được bàn giao
                                </Text>
                                <Text className="text-gray-400 text-sm mt-1 text-center">
                                    Thiết bị này hiện chưa được cấp phát cho ai
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Device Logs */}
                <View className="px-5 mb-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-xl font-bold text-primary">Nhật ký</Text>
                        <TouchableOpacity onPress={() => setAddActivityModalVisible(true)}>
                            <Text className="text-[#F05023] font-bold">Cập nhật</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Log Tabs */}
                    <View className="flex-row mb-4 bg-gray-100 rounded-2xl p-1 gap-1">
                        {[
                            { key: 'all', label: 'Tất cả' },
                            { key: 'maintenance', label: 'Sửa chữa' },
                            { key: 'software', label: 'Phần mềm' }
                        ].map((tab) => (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setSelectedLogTab(tab.key as any)}
                                className={`flex-1 py-2 px-3 rounded-full ${
                                    selectedLogTab === tab.key 
                                        ? 'bg-[#002855]' 
                                        : 'bg-transparent'
                                }`}
                            >
                                <Text className={`text-sm font-bold text-center ${
                                    selectedLogTab === tab.key 
                                        ? 'text-white' 
                                    : 'text-[#757575]'
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
                            <Text className="text-gray-500 mt-2">Chưa có nhật ký nào</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Floating Action Button */}
            <TouchableOpacity className="absolute bottom-8 right-5 w-14 h-14 rounded-full bg-[#F05023] items-center justify-center shadow-lg">
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
                isLoading={loading}
            />

            {/* Modals */}
            <RevokeModal
                visible={revokeModalVisible}
                onClose={() => setRevokeModalVisible(false)}
                onConfirm={handleRevokeDevice}
                deviceName={device?.name || ''}
                currentUserName={getCurrentUser()?.fullname || 'Không xác định'}
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