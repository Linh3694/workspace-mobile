// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import {
  leaveService,
  type ClassStudent,
  type CreateLeaveRequestData,
  type LeaveAttachment,
} from '../../services/leaveService';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, differenceInHours } from 'date-fns';
import { vi } from 'date-fns/locale';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FilePreviewModal from './components/FilePreviewModal';

type CreateLeaveRequestNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.CREATE_LEAVE_REQUEST
>;

const REASONS = [
  { value: 'sick_child' as const, label: 'Con ốm' },
  { value: 'family_matters' as const, label: 'Gia đình có việc bận' },
  { value: 'other' as const, label: 'Lý do khác' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const DateField = ({
  label,
  date,
  onPress,
  disabled,
}: {
  label: string;
  date: Date;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    className={`flex-1 rounded-lg border border-gray-200 bg-white px-3 py-3 ${
      disabled ? 'opacity-50' : ''
    }`}>
    <Text className="text-xs font-medium text-gray-500">
      {label} <Text className="text-red-500">*</Text>
    </Text>
    <View className="mt-1 flex-row items-center">
      <Ionicons name="calendar-outline" size={18} color="#6B7280" />
      <Text className="ml-2 text-sm font-semibold text-[#0A2240]">
        {format(date, 'dd/MM/yyyy', { locale: vi })}
      </Text>
    </View>
  </TouchableOpacity>
);

const CreateLeaveRequestScreen = () => {
  const navigation = useNavigation<CreateLeaveRequestNavigationProp>();
  const route = useRoute();
  const { user } = useAuth();

  // Get params from route
  const classId = (route.params as any)?.classId;
  const classTitle = (route.params as any)?.classTitle || '';
  const leaveId = (route.params as any)?.leaveId; // For edit mode
  const isEditMode = !!leaveId;

  // States
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [selectedStudent, setSelectedStudent] = useState<ClassStudent | null>(null);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [reason, setReason] = useState<'sick_child' | 'family_matters' | 'other'>('sick_child');
  const [otherReason, setOtherReason] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  // File states
  const [selectedFiles, setSelectedFiles] = useState<
    Array<{ uri: string; name: string; type: string; size: number }>
  >([]);
  const [existingAttachments, setExistingAttachments] = useState<LeaveAttachment[]>([]);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  // Edit mode states
  const [canEdit, setCanEdit] = useState(true);
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
  const [isCreatedByParent, setIsCreatedByParent] = useState(false);

  // File preview modal states
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewFileUrl, setPreviewFileUrl] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');
  const [authToken, setAuthToken] = useState('');

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!classId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Load students
        const studentsResponse = await leaveService.getClassStudents(classId);
        if (studentsResponse.success && studentsResponse.data) {
          setStudents(studentsResponse.data);
        }

        // If edit mode, load leave request details
        if (isEditMode && leaveId) {
          const leaveResponse = await leaveService.getLeaveRequestDetails(leaveId);
          if (leaveResponse.success && leaveResponse.data) {
            const leaveData = leaveResponse.data;

            // Find student
            const student = studentsResponse.data?.find(
              (s) => s.student_id === leaveData.student_id
            );
            if (student) {
              setSelectedStudent(student);
            }

            setReason(leaveData.reason as any);
            setOtherReason(leaveData.other_reason || '');
            setDescription(leaveData.description || '');
            setStartDate(leaveData.start_date ? new Date(leaveData.start_date) : new Date());
            setEndDate(leaveData.end_date ? new Date(leaveData.end_date) : new Date());

            // Check if can edit (within 24 hours)
            if (leaveData.submitted_at) {
              const submitted = new Date(leaveData.submitted_at);
              setSubmittedAt(submitted);
              const hoursDiff = differenceInHours(new Date(), submitted);

              const isParentCreated = leaveData.is_created_by_parent === true;
              setIsCreatedByParent(isParentCreated);

              if (!isParentCreated && hoursDiff > 24) {
                setCanEdit(false);
              }
            }
          }

          // Load attachments
          const attachmentsResponse = await leaveService.getLeaveRequestAttachments(leaveId);
          if (attachmentsResponse.success && attachmentsResponse.data) {
            setExistingAttachments(attachmentsResponse.data);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        Alert.alert('Lỗi', 'Không thể tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [classId, leaveId, isEditMode]);

  const formatDateForServer = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        multiple: true,
      });

      if (result.type === 'success' || (result as any).assets) {
        const files = (result as any).assets || [result];
        const validFiles: any[] = [];

        for (const file of files) {
          if (file.size && file.size > MAX_FILE_SIZE) {
            Alert.alert('Lỗi', `File "${file.name}" vượt quá 10MB`);
            continue;
          }
          validFiles.push({
            uri: file.uri,
            name: file.name,
            type: file.mimeType || 'application/octet-stream',
            size: file.size || 0,
          });
        }

        setSelectedFiles((prev) => [...prev, ...validFiles]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Lỗi', 'Không thể chọn file');
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        const validFiles = result.assets
          .filter((asset) => !asset.fileSize || asset.fileSize <= MAX_FILE_SIZE)
          .map((asset) => ({
            uri: asset.uri,
            name: asset.fileName || `image_${Date.now()}.jpg`,
            type: 'image/jpeg',
            size: asset.fileSize || 0,
          }));

        setSelectedFiles((prev) => [...prev, ...validFiles]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleViewFile = async (fileUrl: string, fileName: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Lỗi', 'Không tìm thấy token xác thực');
        return;
      }

      // Set preview data and open modal
      setPreviewFileUrl(fileUrl);
      setPreviewFileName(fileName);
      setAuthToken(token);
      setPreviewModalVisible(true);
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi mở file');
    }
  };

  const handleDeleteExistingFile = async (fileName: string) => {
    Alert.alert('Xác nhận', 'Bạn có chắc muốn xóa file này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingFile(fileName);
            const response = await leaveService.deleteLeaveAttachment(fileName);
            if (response.success) {
              setExistingAttachments((prev) => prev.filter((f) => f.name !== fileName));
              Alert.alert('Thành công', 'Đã xóa file');
            } else {
              Alert.alert('Lỗi', response.message || 'Không thể xóa file');
            }
          } catch (error) {
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi xóa file');
          } finally {
            setDeletingFile(null);
          }
        },
      },
    ]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedStudent) {
      Alert.alert('Lỗi', 'Vui lòng chọn học sinh');
      return;
    }

    if (startDate > endDate) {
      Alert.alert('Lỗi', 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
      return;
    }

    if (reason === 'other' && !otherReason.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập lý do khác');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode && leaveId) {
        // Update existing leave request
        const response = await leaveService.updateLeaveRequest({
          id: leaveId,
          reason,
          other_reason: reason === 'other' ? otherReason : '',
          start_date: formatDateForServer(startDate),
          end_date: formatDateForServer(endDate),
          description,
        });

        if (response.success) {
          // Upload new files if any
          if (selectedFiles.length > 0) {
            const uploadResponse = await leaveService.uploadLeaveAttachments(leaveId, selectedFiles);
            if (!uploadResponse.success) {
              Alert.alert('Cảnh báo', `Đơn đã cập nhật nhưng upload file thất bại: ${uploadResponse.message}`);
            }
          }

          Alert.alert('Thành công', 'Đã cập nhật đơn nghỉ phép thành công', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Lỗi', response.message || 'Không thể cập nhật đơn nghỉ phép');
        }
      } else {
        // Create new leave request
        const data: CreateLeaveRequestData = {
          student_id: selectedStudent.student_id,
          reason,
          other_reason: reason === 'other' ? otherReason : undefined,
          start_date: formatDateForServer(startDate),
          end_date: formatDateForServer(endDate),
          description,
          creator_name: user?.full_name || user?.name || user?.email,
          creator_role: 'Teacher',
          creator_user_id: user?.name || user?._id,
          is_created_by_parent: false,
        };

        const response = await leaveService.createLeaveRequest(data);

        if (response.success) {
          // Upload files if any
          if (selectedFiles.length > 0 && response.data?.id) {
            const uploadResponse = await leaveService.uploadLeaveAttachments(
              response.data.id,
              selectedFiles
            );
            if (!uploadResponse.success) {
              Alert.alert('Cảnh báo', `Đơn đã tạo nhưng upload file thất bại: ${uploadResponse.message}`);
            }
          }

          Alert.alert('Thành công', 'Đã tạo đơn nghỉ phép thành công', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Lỗi', response.message || 'Không thể tạo đơn nghỉ phép');
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!leaveId) return;

    Alert.alert(
      'Xác nhận xóa đơn nghỉ phép',
      'Bạn có chắc chắn muốn xóa đơn nghỉ phép này không? Hành động này không thể hoàn tác. Tất cả thông tin và file đính kèm sẽ bị xóa vĩnh viễn.',
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: 'Xóa đơn',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const response = await leaveService.deleteLeaveRequest(leaveId);
              if (response.success) {
                Alert.alert('Thành công', 'Đã xóa đơn nghỉ phép thành công', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert('Lỗi', response.message || 'Không thể xóa đơn nghỉ phép');
              }
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Lỗi', 'Có lỗi xảy ra khi xóa đơn nghỉ phép');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleDateChange = (_: any, date?: Date) => {
    if (!date) {
      if (Platform.OS === 'android') {
        setPickerTarget(null);
      }
      return;
    }

    if (pickerTarget === 'start') {
      setStartDate(date);
      if (endDate < date) {
        setEndDate(date);
      }
    } else if (pickerTarget === 'end') {
      setEndDate(date);
    }

    if (Platform.OS === 'android') {
      setPickerTarget(null);
    }
  };

  const getRemainingTime = () => {
    if (!submittedAt) return null;
    const hoursPassed = differenceInHours(new Date(), submittedAt);
    const hoursRemaining = 24 - hoursPassed;
    if (hoursRemaining <= 0) return null;
    return hoursRemaining;
  };

  const remainingHours = getRemainingTime();

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F05023" />
          <Text className="mt-4 text-gray-500">Đang tải dữ liệu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-4">
        <View className="mb-4 flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: -8,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color="#0A2240" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-2xl font-bold text-[#0A2240]">
            {isEditMode ? 'Chỉnh sửa đơn nghỉ phép' : 'Tạo đơn nghỉ phép'}
          </Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* 24h Edit Rule Hint */}
        <View className="mb-4 flex-row rounded-r bg-gray-50 border-l-4 border-gray-400 p-3">
          <Ionicons name="bulb" size={20} color="#EAB308" style={{ marginTop: 2, marginRight: 12 }} />
          <View className="flex-1">
            <Text className="text-sm text-gray-700">
              <Text className="font-semibold">Lưu ý:</Text> Đơn nghỉ phép chỉ có thể chỉnh sửa trong vòng{' '}
              <Text className="font-semibold">24 giờ</Text> sau khi tạo.
              {isEditMode && remainingHours && (
                <Text>
                  {' '}Còn lại: <Text className="font-semibold">{remainingHours} giờ</Text> để chỉnh sửa.
                </Text>
              )}
            </Text>
          </View>
        </View>

        {/* Cannot Edit Alert */}
        {isEditMode && !canEdit && (
          <View className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
            <View className="flex-row">
              <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
              <Text className="flex-1 text-sm text-red-800">
                Đơn nghỉ phép này đã quá 24 giờ, không thể chỉnh sửa. Bạn chỉ có thể xem thông tin.
              </Text>
            </View>
          </View>
        )}

        {/* Parent Created Alert */}
        {isEditMode && isCreatedByParent && (
          <View className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
            <View className="flex-row">
              <Ionicons name="information-circle" size={20} color="#D97706" style={{ marginRight: 8 }} />
              <Text className="flex-1 text-sm text-yellow-800">
                Đơn này được tạo bởi <Text className="font-semibold">Phụ huynh</Text>. Bạn có thể xem và thêm tài liệu đính kèm.
              </Text>
            </View>
          </View>
        )}

        {/* Class Info */}
        {classTitle && (
          <View className="mb-4 rounded-lg bg-gray-50 p-3">
            <Text className="text-sm text-gray-500">Lớp</Text>
            <Text className="text-base font-semibold text-[#0A2240]">{classTitle}</Text>
          </View>
        )}

        {/* Student Selection */}
        <View className="mb-4">
          <Text className="mb-2 text-base font-medium text-[#0A2240]">
            Học sinh <Text className="text-red-500">*</Text>
          </Text>
          <TouchableOpacity
            onPress={() => !isEditMode && setShowStudentPicker(!showStudentPicker)}
            disabled={isEditMode || submitting}
            className={`flex-row items-center justify-between rounded-lg border border-gray-300 bg-white p-4 ${
              isEditMode ? 'opacity-50' : ''
            }`}>
            <Text
              className={selectedStudent ? 'text-base text-[#0A2240]' : 'text-base text-gray-400'}>
              {selectedStudent
                ? `${selectedStudent.student_name} (${selectedStudent.student_code})`
                : 'Chọn học sinh'}
            </Text>
            {!isEditMode && (
              <Ionicons
                name={showStudentPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            )}
          </TouchableOpacity>

          {/* Student Picker Dropdown */}
          {showStudentPicker && !isEditMode && (
            <View className="mt-2 max-h-60 rounded-lg border border-gray-200 bg-white shadow-sm">
              <ScrollView nestedScrollEnabled>
                {students.map((student) => (
                  <TouchableOpacity
                    key={student.student_id}
                    onPress={() => {
                      setSelectedStudent(student);
                      setShowStudentPicker(false);
                    }}
                    className={`border-b border-gray-100 p-4 ${
                      selectedStudent?.student_id === student.student_id ? 'bg-blue-50' : ''
                    }`}>
                    <Text className="text-base font-medium text-[#0A2240]">
                      {student.student_name}
                    </Text>
                    <Text className="text-sm text-gray-500">{student.student_code}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Reason Selection */}
        <View className="mb-4">
          <Text className="mb-2 text-base font-medium text-[#0A2240]">
            Lý do nghỉ <Text className="text-red-500">*</Text>
          </Text>
          <View className="space-y-2">
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                onPress={() => canEdit && setReason(r.value)}
                disabled={!canEdit || submitting}
                className="flex-row items-center py-2">
                <View
                  className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                    reason === r.value ? 'border-[#F05023]' : 'border-gray-300'
                  } ${!canEdit ? 'opacity-50' : ''}`}>
                  {reason === r.value && <View className="h-2.5 w-2.5 rounded-full bg-[#F05023]" />}
                </View>
                <Text className="text-base text-[#0A2240]">{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Other Reason Input */}
        {reason === 'other' && (
          <View className="mb-4">
            <Text className="mb-2 text-base font-medium text-[#0A2240]">
              Lý do khác <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={otherReason}
              onChangeText={setOtherReason}
              placeholder="Nhập lý do nghỉ cụ thể"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              className="rounded-lg border border-gray-300 bg-white p-4 text-base text-[#0A2240]"
              style={{ textAlignVertical: 'top', minHeight: 80 }}
              editable={canEdit && !submitting}
            />
          </View>
        )}

        {/* Date Selection */}
        <View className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-[#0A2240]">Thời gian nghỉ</Text>
            <Text className="text-xs text-gray-500">Chọn khoảng ngày</Text>
          </View>
          <View className="flex-row gap-3">
            <DateField
              label="Ngày bắt đầu"
              date={startDate}
              onPress={() => canEdit && setPickerTarget((prev) => (prev === 'start' ? null : 'start'))}
              disabled={!canEdit || submitting}
            />
            <DateField
              label="Ngày kết thúc"
              date={endDate}
              onPress={() => canEdit && setPickerTarget((prev) => (prev === 'end' ? null : 'end'))}
              disabled={!canEdit || submitting}
            />
          </View>
        </View>

        {/* Description */}
        <View className="mb-4">
          <Text className="mb-2 text-base font-medium text-[#0A2240]">Ghi chú thêm</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Nhập ghi chú thêm (không bắt buộc)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            className="rounded-lg border border-gray-300 bg-white p-4 text-base text-[#0A2240]"
            style={{ textAlignVertical: 'top', minHeight: 80 }}
            editable={canEdit && !submitting}
          />
        </View>

        {/* File Attachments */}
        <View className="mb-4">
          <Text className="mb-2 text-base font-medium text-[#0A2240]">Tài liệu đính kèm</Text>

          {/* Existing Attachments */}
          {existingAttachments.length > 0 && (
            <View className="mb-3">
              <Text className="mb-2 text-sm text-gray-600">File hiện có:</Text>
              {existingAttachments.map((file) => (
                <View
                  key={file.name}
                  className="mb-2 flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <View className="flex-1 flex-row items-center">
                    <Ionicons name="document" size={20} color="#6B7280" />
                    <View className="ml-2 flex-1">
                      <Text className="text-sm font-medium text-[#0A2240]" numberOfLines={1}>
                        {file.file_name}
                      </Text>
                      <Text className="text-xs text-gray-500">{formatFileSize(file.file_size)}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    {/* View Button */}
                    <TouchableOpacity
                      onPress={() => handleViewFile(file.file_url, file.file_name)}
                      className="p-2">
                      <Ionicons name="eye-outline" size={20} color="#3B82F6" />
                    </TouchableOpacity>
                    {/* Delete Button */}
                    <TouchableOpacity
                      onPress={() => handleDeleteExistingFile(file.name)}
                      disabled={deletingFile === file.name}
                      className="p-2">
                      {deletingFile === file.name ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* New Files */}
          {selectedFiles.length > 0 && (
            <View className="mb-3">
              <Text className="mb-2 text-sm text-gray-600">File mới thêm:</Text>
              {selectedFiles.map((file, index) => (
                <View
                  key={index}
                  className="mb-2 flex-row items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <View className="flex-1 flex-row items-center">
                    <Ionicons name="document" size={20} color="#3B82F6" />
                    <View className="ml-2 flex-1">
                      <Text className="text-sm font-medium text-[#0A2240]" numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text className="text-xs text-gray-500">{formatFileSize(file.size)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveFile(index)}
                    className="ml-2 p-2">
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Upload Buttons */}
          {!submitting && (
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handlePickDocument}
                className="flex-1 flex-row items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-4">
                <Ionicons name="document-attach" size={20} color="#6B7280" />
                <Text className="ml-2 text-sm font-medium text-gray-600">Chọn file</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePickImage}
                className="flex-1 flex-row items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-4">
                <Ionicons name="image" size={20} color="#6B7280" />
                <Text className="ml-2 text-sm font-medium text-gray-600">Chọn ảnh</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text className="mt-2 text-xs text-gray-400 text-center">
            Hỗ trợ: Ảnh, PDF, Word (tối đa 10MB)
          </Text>
        </View>

        {/* Date Picker Modal */}
        <Modal
          transparent
          animationType="fade"
          visible={!!pickerTarget}
          onRequestClose={() => setPickerTarget(null)}>
          <TouchableWithoutFeedback onPress={() => setPickerTarget(null)}>
            <View className="flex-1 items-center justify-center bg-black/30 px-6">
              <TouchableWithoutFeedback onPress={() => {}}>
                <View className="w-full rounded-2xl bg-white p-4 shadow-lg">
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-[#0A2240]">
                      {pickerTarget === 'start' ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc'}
                    </Text>
                    <TouchableOpacity onPress={() => setPickerTarget(null)}>
                      <Ionicons name="close" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  {pickerTarget && (
                    <DateTimePicker
                      value={pickerTarget === 'start' ? startDate : endDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleDateChange}
                      minimumDate={pickerTarget === 'end' ? startDate : undefined}
                      locale="vi"
                    />
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Action Buttons */}
        <View className="mt-5 pb-6">
          <View className="flex-row gap-3">
            {canEdit && (
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || deleting}
                className={`flex-1 items-center rounded-lg py-3 ${
                  submitting || deleting ? 'bg-gray-300' : 'bg-[#3F4246]'
                }`}>
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-base font-semibold text-white">Lưu</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={submitting || deleting}
              className={`${
                canEdit ? 'flex-1' : 'flex-1'
              } items-center rounded-lg border border-gray-300 bg-white py-3`}>
              <Text className="text-base font-semibold text-[#0A2240]">
                {canEdit ? 'Hủy bỏ' : 'Quay lại'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Delete Button - only in edit mode, within 24h, and NOT created by parent */}
          {isEditMode && canEdit && !isCreatedByParent && (
            <TouchableOpacity
              onPress={handleDelete}
              disabled={submitting || deleting}
              className={`mt-3 items-center rounded-lg py-3 ${
                submitting || deleting ? 'bg-gray-300' : 'bg-red-600'
              }`}>
              {deleting ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="white" size="small" />
                  <Text className="ml-2 text-base font-semibold text-white">Đang xóa...</Text>
                </View>
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="trash" size={18} color="white" />
                  <Text className="ml-2 text-base font-semibold text-white">Xóa đơn nghỉ phép</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* File Preview Modal */}
      <FilePreviewModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        fileUrl={previewFileUrl}
        authToken={authToken}
        title="Tài liệu đính kèm"
        fileName={previewFileName}
      />
    </SafeAreaView>
  );
};

export default CreateLeaveRequestScreen;
