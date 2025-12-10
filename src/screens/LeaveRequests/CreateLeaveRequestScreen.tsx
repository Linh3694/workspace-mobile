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
  KeyboardAvoidingView,
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
import { format, differenceInHours } from 'date-fns';
import { vi } from 'date-fns/locale';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FilePreviewModal from './components/FilePreviewModal';
import CustomDatePicker from '../../components/CustomDatePicker';

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
    className={`flex-1 border-b border-gray-200 py-4 ${disabled ? 'opacity-50' : ''}`}>
    <Text className="text-xs uppercase tracking-wide text-gray-400">{label}</Text>
    <Text className="mt-1 text-base font-medium text-black">
      {format(date, 'dd/MM/yyyy', { locale: vi })}
    </Text>
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
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date>(new Date());
  const [tempEndDate, setTempEndDate] = useState<Date>(new Date());

  // File states
  const [selectedFiles, setSelectedFiles] = useState<
    { uri: string; name: string; type: string; size: number }[]
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

  // File picker modal state
  const [showFilePickerModal, setShowFilePickerModal] = useState(false);

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
        type: [
          'image/*',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
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
            const uploadResponse = await leaveService.uploadLeaveAttachments(
              leaveId,
              selectedFiles
            );
            if (!uploadResponse.success) {
              Alert.alert(
                'Cảnh báo',
                `Đơn đã cập nhật nhưng upload file thất bại: ${uploadResponse.message}`
              );
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
              Alert.alert(
                'Cảnh báo',
                `Đơn đã tạo nhưng upload file thất bại: ${uploadResponse.message}`
              );
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

  const handleOpenDateModal = () => {
    if (!canEdit) return;
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setShowDateModal(true);
  };

  const handleConfirmDates = () => {
    // Validate: end date must be >= start date
    if (tempEndDate < tempStartDate) {
      Alert.alert('Lỗi', 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
      return;
    }

    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setShowDateModal(false);
  };

  const handleCancelDates = () => {
    setShowDateModal(false);
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
          <ActivityIndicator size="small" color="#000" />
          <Text className="mt-3 text-sm text-gray-400">Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="border-b border-gray-100 px-4 pb-4 pt-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="-ml-2 p-2">
            <Ionicons name="arrow-back" size={22} color="#000" />
          </TouchableOpacity>
          <Text className="ml-2 text-xl font-bold text-black">
            {isEditMode ? 'Chỉnh sửa đơn nghỉ phép' : 'Tạo đơn nghỉ phép'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          className="flex-1 px-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* 24h Edit Rule Hint */}
          <View className="mb-6 mt-4 border-l-2 border-gray-300 py-1 pl-3">
            <Text className="text-sm text-gray-500">
              Có thể chỉnh sửa trong 24 giờ sau khi tạo
              {isEditMode && remainingHours && (
                <Text className="font-medium text-black"> • Còn {remainingHours}h</Text>
              )}
            </Text>
          </View>

          {/* Cannot Edit Alert */}
          {isEditMode && !canEdit && (
            <View className="mb-6 border-l-2 border-black bg-gray-50 py-3 pl-3">
              <Text className="text-sm text-gray-700">Đã quá 24 giờ, không thể chỉnh sửa</Text>
            </View>
          )}

          {/* Parent Created Alert */}
          {isEditMode && isCreatedByParent && (
            <View className="mb-6 border-l-2 border-gray-400 bg-gray-50 py-3 pl-3">
              <Text className="text-sm text-gray-600">Đơn được tạo bởi Phụ huynh</Text>
            </View>
          )}

          {/* Class Info */}
          {classTitle && (
            <View className="mb-6 border-b border-gray-100 pb-4">
              <Text className="text-xs uppercase tracking-wide text-gray-400">Lớp</Text>
              <Text className="mt-1 text-lg font-semibold text-black">{classTitle}</Text>
            </View>
          )}

          {/* Student Selection */}
          <View className="mb-6">
            <Text className="mb-3 text-base font-medium text-black">
              Học sinh <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => !isEditMode && setShowStudentPicker(!showStudentPicker)}
              disabled={isEditMode || submitting}
              activeOpacity={0.7}
              className={`flex-row items-center justify-between border-b border-gray-200 pb-3 ${
                isEditMode ? 'opacity-50' : ''
              }`}>
              <Text
                className={selectedStudent ? 'text-base text-black' : 'text-base text-gray-400'}>
                {selectedStudent
                  ? `${selectedStudent.student_name} (${selectedStudent.student_code})`
                  : 'Chọn học sinh'}
              </Text>
              {!isEditMode && (
                <Ionicons
                  name={showStudentPicker ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#000"
                />
              )}
            </TouchableOpacity>

            {/* Student Picker Dropdown */}
            {showStudentPicker && !isEditMode && (
              <View className="mt-3 max-h-60 border border-gray-200 bg-white">
                <ScrollView nestedScrollEnabled>
                  {students.map((student, index) => (
                    <TouchableOpacity
                      key={student.student_id}
                      onPress={() => {
                        setSelectedStudent(student);
                        setShowStudentPicker(false);
                      }}
                      activeOpacity={0.7}
                      className={`px-4 py-3 ${
                        index < students.length - 1 ? 'border-b border-gray-100' : ''
                      } ${selectedStudent?.student_id === student.student_id ? 'bg-gray-50' : ''}`}>
                      <Text
                        className={`text-base ${
                          selectedStudent?.student_id === student.student_id
                            ? 'font-medium text-black'
                            : 'text-gray-700'
                        }`}>
                        {student.student_name}
                      </Text>
                      <Text className="mt-0.5 text-xs text-gray-400">{student.student_code}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Reason Selection */}
          <View className="mb-6">
            <Text className="mb-3 text-base font-medium text-black">
              Lý do nghỉ <Text className="text-red-500">*</Text>
            </Text>
            <View>
              {REASONS.map((r, index) => (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => canEdit && setReason(r.value)}
                  disabled={!canEdit || submitting}
                  activeOpacity={0.7}
                  className={`flex-row items-center py-3.5 ${
                    index < REASONS.length - 1 ? 'border-b border-gray-100' : ''
                  } ${!canEdit ? 'opacity-50' : ''}`}>
                  <View
                    className={`mr-3 h-5 w-5 items-center justify-center rounded-sm ${
                      reason === r.value ? 'bg-black' : 'border border-gray-300 bg-white'
                    }`}>
                    {reason === r.value && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text
                    className={`text-base ${reason === r.value ? 'font-medium text-black' : 'text-gray-600'}`}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Other Reason Input */}
          {reason === 'other' && (
            <View className="mb-6">
              <Text className="mb-3 text-base font-medium text-black">
                Lý do cụ thể <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={otherReason}
                onChangeText={setOtherReason}
                placeholder="Nhập lý do..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                className="border-b border-gray-200 bg-transparent pb-3 text-base text-black"
                style={{ textAlignVertical: 'top', minHeight: 60 }}
                editable={canEdit && !submitting}
              />
            </View>
          )}

          {/* Date Selection */}
          <View className="mb-6">
            <Text className="mb-3 text-base font-medium text-black">
              Thời gian nghỉ <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              onPress={handleOpenDateModal}
              disabled={!canEdit || submitting}
              activeOpacity={0.7}
              className={`${!canEdit || submitting ? 'opacity-50' : ''}`}>
              <View className="flex-row items-center">
                {/* Start Date */}
                <View className="flex-1 border-b border-gray-200 py-3">
                  <Text className="text-xs uppercase tracking-wide text-gray-400">Từ ngày</Text>
                  <Text className="mt-1 text-lg font-semibold text-black">
                    {format(startDate, 'dd/MM/yyyy', { locale: vi })}
                  </Text>
                </View>

                {/* Arrow */}
                <View className="px-4">
                  <Ionicons name="arrow-forward" size={18} color="#9CA3AF" />
                </View>

                {/* End Date */}
                <View className="flex-1 border-b border-gray-200 py-3">
                  <Text className="text-xs uppercase tracking-wide text-gray-400">Đến ngày</Text>
                  <Text className="mt-1 text-lg font-semibold text-black">
                    {format(endDate, 'dd/MM/yyyy', { locale: vi })}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="mb-3 text-base font-medium text-black">Ghi chú</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Thêm ghi chú..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              className="border-b border-gray-200 bg-transparent pb-3 text-base text-black"
              style={{ textAlignVertical: 'top', minHeight: 60 }}
              editable={canEdit && !submitting}
            />
          </View>

          {/* File Attachments */}
          <View className="mb-6">
            <Text className="mb-4 text-base font-medium text-black">Tài liệu đính kèm</Text>

            {/* Upload Area */}
            {!submitting && (
              <TouchableOpacity
                onPress={() => setShowFilePickerModal(true)}
                activeOpacity={0.7}
                className="mb-4 items-center border border-dashed border-gray-300 bg-gray-50 py-8">
                <Ionicons name="add" size={28} color="#9CA3AF" />
                <Text className="mt-2 text-sm font-medium text-gray-500">Thêm tài liệu</Text>
                <Text className="mt-1 text-xs text-gray-400">PDF, Word, Ảnh • Tối đa 10MB</Text>
              </TouchableOpacity>
            )}

            {/* Existing Attachments */}
            {existingAttachments.length > 0 && (
              <View className="mb-2">
                <Text className="mb-2 text-xs uppercase tracking-wide text-gray-400">
                  Đã tải lên
                </Text>
                {existingAttachments.map((file, index) => (
                  <View
                    key={file.name}
                    className={`flex-row items-center py-3 ${
                      index < existingAttachments.length - 1 ? 'border-b border-gray-100' : ''
                    }`}>
                    <View className="h-9 w-9 items-center justify-center bg-gray-100">
                      <Ionicons
                        name={
                          file.file_name?.toLowerCase().endsWith('.pdf')
                            ? 'document-text-outline'
                            : file.file_name?.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/)
                              ? 'image-outline'
                              : 'document-outline'
                        }
                        size={18}
                        color="#000"
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-medium text-black" numberOfLines={1}>
                        {file.file_name}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {formatFileSize(file.file_size)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleViewFile(file.file_url, file.file_name)}
                      className="px-3 py-2">
                      <Ionicons name="eye-outline" size={18} color="#000" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteExistingFile(file.name)}
                      disabled={deletingFile === file.name}
                      className="py-2 pl-2">
                      {deletingFile === file.name ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color="#000" />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* New Files */}
            {selectedFiles.length > 0 && (
              <View>
                <Text className="mb-2 text-xs uppercase tracking-wide text-gray-400">
                  Chờ tải lên
                </Text>
                {selectedFiles.map((file, index) => (
                  <View
                    key={index}
                    className={`flex-row items-center py-3 ${
                      index < selectedFiles.length - 1 ? 'border-b border-gray-100' : ''
                    }`}>
                    <View className="h-9 w-9 items-center justify-center bg-black">
                      <Ionicons
                        name={
                          file.type?.includes('pdf')
                            ? 'document-text-outline'
                            : file.type?.includes('image')
                              ? 'image-outline'
                              : 'document-outline'
                        }
                        size={18}
                        color="#fff"
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-medium text-black" numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text className="text-xs text-gray-400">{formatFileSize(file.size)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveFile(index)} className="py-2 pl-3">
                      <Ionicons name="close" size={18} color="#000" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Date Picker Modal */}
          <Modal
            transparent
            animationType="slide"
            visible={showDateModal}
            onRequestClose={handleCancelDates}>
            <TouchableWithoutFeedback onPress={handleCancelDates}>
              <View className="flex-1 justify-end bg-black/40">
                <TouchableWithoutFeedback onPress={() => {}}>
                  <View className="pb-safe rounded-t-2xl bg-white">
                    {/* Handle bar */}
                    <View className="items-center py-3">
                      <View className="h-1 w-10 rounded-full bg-gray-300" />
                    </View>

                    {/* Header */}
                    <View className="px-6 pb-4">
                      <Text className="text-xl font-bold text-black">Chọn ngày</Text>
                    </View>

                    {/* Content */}
                    <View className="px-6">
                      {/* Start Date */}
                      <View className="mb-6">
                        <Text className="mb-3 text-sm font-medium text-gray-600">Từ ngày</Text>
                        <CustomDatePicker
                          value={tempStartDate}
                          onChange={(date) => setTempStartDate(date)}
                        />
                      </View>

                      {/* End Date */}
                      <View className="mb-4">
                        <Text className="mb-3 text-sm font-medium text-gray-600">Đến ngày</Text>
                        <CustomDatePicker
                          value={tempEndDate}
                          onChange={(date) => setTempEndDate(date)}
                          minimumDate={tempStartDate}
                        />
                      </View>

                      {/* Error */}
                      {tempEndDate < tempStartDate && (
                        <View className="mb-4 border-l-2 border-black bg-gray-50 py-2 pl-3">
                          <Text className="text-sm text-gray-700">
                            Ngày kết thúc phải sau hoặc bằng ngày bắt đầu
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Actions */}
                    <View className="flex-row border-t border-gray-100 px-6 py-5">
                      <TouchableOpacity
                        onPress={handleCancelDates}
                        className="flex-1 items-center py-3">
                        <Text className="text-base font-medium text-gray-500">Hủy</Text>
                      </TouchableOpacity>
                      <View className="w-px bg-gray-200" />
                      <TouchableOpacity
                        onPress={handleConfirmDates}
                        className="flex-1 items-center py-3">
                        <Text className="text-base font-semibold text-black">Xác nhận</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {/* Action Buttons */}
          <View className="border-t border-gray-100 pb-8 pt-6">
            {canEdit && (
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || deleting}
                activeOpacity={0.8}
                className={`items-center py-4 ${
                  submitting || deleting ? 'bg-gray-200' : 'bg-black'
                }`}>
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    {isEditMode ? 'Cập nhật' : 'Tạo đơn'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={submitting || deleting}
              activeOpacity={0.7}
              className="mt-3 items-center py-3">
              <Text className="text-base text-gray-500">{canEdit ? 'Hủy' : 'Quay lại'}</Text>
            </TouchableOpacity>

            {/* Delete Button */}
            {isEditMode && canEdit && !isCreatedByParent && (
              <TouchableOpacity
                onPress={handleDelete}
                disabled={submitting || deleting}
                activeOpacity={0.7}
                className="mt-4 flex-row items-center justify-center border-t border-gray-100 pt-4">
                {deleting ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={16} color="#000" />
                    <Text className="ml-1.5 text-sm text-black">Xóa đơn</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* File Picker Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showFilePickerModal}
        onRequestClose={() => setShowFilePickerModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowFilePickerModal(false)}>
          <View className="flex-1 justify-end bg-black/40">
            <TouchableWithoutFeedback onPress={() => {}}>
              <View className="bg-white pb-8">
                {/* Handle bar */}
                <View className="items-center py-3">
                  <View className="h-1 w-10 rounded-full bg-gray-300" />
                </View>

                {/* Title */}
                <View className="px-6 pb-4">
                  <Text className="text-lg font-bold text-black">Chọn loại tài liệu</Text>
                </View>

                {/* Options */}
                <View className="px-6">
                  <TouchableOpacity
                    onPress={() => {
                      setShowFilePickerModal(false);
                      setTimeout(() => handlePickDocument(), 400);
                    }}
                    activeOpacity={0.7}
                    className="flex-row items-center border-b border-gray-100 py-4">
                    <View className="h-10 w-10 items-center justify-center bg-gray-100">
                      <Ionicons name="document-text-outline" size={20} color="#000" />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-base font-medium text-black">Tài liệu</Text>
                      <Text className="mt-0.5 text-xs text-gray-400">PDF, Word, Excel...</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setShowFilePickerModal(false);
                      setTimeout(() => handlePickImage(), 400);
                    }}
                    activeOpacity={0.7}
                    className="flex-row items-center py-4">
                    <View className="h-10 w-10 items-center justify-center bg-gray-100">
                      <Ionicons name="image-outline" size={20} color="#000" />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-base font-medium text-black">Hình ảnh</Text>
                      <Text className="mt-0.5 text-xs text-gray-400">JPG, PNG, GIF...</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Cancel */}
                <View className="mt-4 px-6">
                  <TouchableOpacity
                    onPress={() => setShowFilePickerModal(false)}
                    activeOpacity={0.7}
                    className="items-center py-3">
                    <Text className="text-base text-gray-500">Hủy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
