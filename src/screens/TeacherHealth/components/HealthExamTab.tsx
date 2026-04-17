import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../../../hooks/useLanguage';
import dailyHealthService, {
  ClassHealthExamStudent,
  HealthExamination,
} from '../../../services/dailyHealthService';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import ReportToClinicModal from './ReportToClinicModal';
import { API_BASE_URL } from '../../../config/constants';
import { ROUTES } from '../../../constants/routes';
import { RootStackParamList } from '../../../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  classId: string;
  date: string;
  refreshing: boolean;
  onRefresh: () => void;
}

// Helper để sắp xếp tên tiếng Việt
const sortVietnameseName = (nameA: string, nameB: string): number => {
  const partsA = nameA
    .trim()
    .split(' ')
    .filter((part) => part.length > 0);
  const partsB = nameB
    .trim()
    .split(' ')
    .filter((part) => part.length > 0);

  if (partsA.length === 0 && partsB.length === 0) return 0;
  if (partsA.length === 0) return 1;
  if (partsB.length === 0) return -1;

  const firstNameA = partsA[partsA.length - 1]?.toLowerCase() || '';
  const firstNameB = partsB[partsB.length - 1]?.toLowerCase() || '';
  const firstNameCompare = firstNameA.localeCompare(firstNameB, 'vi');
  if (firstNameCompare !== 0) return firstNameCompare;

  const lastNameA = partsA[0]?.toLowerCase() || '';
  const lastNameB = partsB[0]?.toLowerCase() || '';
  return lastNameA.localeCompare(lastNameB, 'vi');
};

// Format time from creation datetime
const formatTime = (datetime: string | undefined) => {
  if (!datetime) return '';
  try {
    const d = new Date(datetime);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// Treatment type display
const getTreatmentLabel = (type: string | undefined): string => {
  if (!type) return '';
  const labels: Record<string, string> = {
    first_aid: 'Sơ cứu',
    medication: 'Uống thuốc',
    rest: 'Nghỉ ngơi',
    other: 'Khác',
  };
  return labels[type] || type;
};

// Get initials from name
const getInitials = (name: string): string => {
  const parts = name
    .trim()
    .split(' ')
    .filter((p) => p.length > 0);
  if (parts.length === 0) return 'HS';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Get full image URL
const getFullImageUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

const isValidTime = (timeStr?: string | null): boolean => {
  if (!timeStr) return false;
  const trimmed = timeStr.trim();
  return trimmed !== '' && trimmed !== '00:00:00' && trimmed !== '00:00';
};

/** Kiểm tra hồ sơ có thăm khám bổ sung - đồng bộ parent-portal */
const hasFollowup = (exam: HealthExamination): boolean => {
  return !!(
    exam.followup_examination ||
    exam.followup_treatment_details ||
    exam.followup_outcome ||
    exam.followup_notes ||
    isValidTime(exam.followup_clinic_checkin_time) ||
    isValidTime(exam.followup_clinic_checkout_time) ||
    !!exam.followup_is_scheduled_recheck ||
    exam.followup_medical_suggestion
  );
};

/** Tính số lượt thăm khám: mỗi hồ sơ = 1 lượt, nếu có thăm khám bổ sung = 2 lượt */
const countExaminationVisits = (exams: HealthExamination[]): number =>
  exams.reduce((sum, exam) => sum + (hasFollowup(exam) ? 2 : 1), 0);

// Đồng bộ format HH:mm với SIS utils.formatTime / phòng Y tế
const formatTimeStr = (timeStr?: string | null): string => {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  const m = trimmed.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}`;
  return trimmed;
};

const HealthExamTab: React.FC<Props> = ({ classId, date, refreshing, onRefresh }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const navigation = useNavigation<NavigationProp>();

  // State
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ClassHealthExamStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});

  // Modal báo Y tế
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dailyHealthService.getClassHealthExaminations({
        class_id: classId,
        date: date,
      });
      setData(result || []);
    } catch (error) {
      console.error('Error fetching class health examinations:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  // Load data when classId or date changes
  useEffect(() => {
    if (classId && date) {
      fetchData();
    }
  }, [classId, date, fetchData]);

  // Refresh when parent triggers
  useEffect(() => {
    if (refreshing) {
      fetchData();
    }
  }, [refreshing, fetchData]);

  // Filter và sort
  const filteredData = useMemo(() => {
    // Đảm bảo data luôn là array
    const safeData = Array.isArray(data) ? data : [];

    let filtered = safeData;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = safeData.filter(
        (s) =>
          s.student_name?.toLowerCase().includes(term) ||
          s.student_code?.toLowerCase().includes(term)
      );
    }
    // Sử dụng slice() thay vì spread để tránh lỗi Hermes
    return filtered
      .slice()
      .sort((a, b) => sortVietnameseName(a.student_name || '', b.student_name || ''));
  }, [data, searchTerm]);

  // Stats - dùng countExaminationVisits đồng bộ parent-portal
  const totalExaminations = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    return safeData.reduce(
      (sum, s) => sum + countExaminationVisits(s.examinations || []),
      0
    );
  }, [data]);

  // Toggle expand
  const toggleExpand = (studentId: string) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  // Render examination item - giao diện chuyên nghiệp
  const renderExaminationItem = (exam: HealthExamination, index: number) => {
    return (
      <View
        key={exam.name}
        style={{
          marginTop: index > 0 ? 12 : 0,
          padding: 14,
          backgroundColor: '#F8FAFC',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#E2E8F0',
        }}>
        {/* Dòng 1: STT + Phân loại + Thời gian + Trạng thái */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, color: '#94A3B8', marginRight: 6, fontFamily: 'Mulish' }}>
              {index + 1}.
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#002855',
                flex: 1,
                fontFamily: 'Mulish',
              }}
              numberOfLines={1}>
              {exam.disease_classification || 'Chưa phân loại'}
            </Text>
          </View>
          {exam.sent_to_parent ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: '#D1FAE5',
                marginLeft: 8,
              }}>
              <Text
                style={{ fontSize: 12, fontWeight: '600', color: '#059669', fontFamily: 'Mulish' }}>
                Đã gửi
              </Text>
            </View>
          ) : (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: '#F1F5F9',
                marginLeft: 8,
              }}>
              <Text
                style={{ fontSize: 12, fontWeight: '500', color: '#64748B', fontFamily: 'Mulish' }}>
                Chưa gửi
              </Text>
            </View>
          )}
        </View>

        {/* Thời gian vào/về */}
        {(isValidTime(exam.clinic_checkin_time) || isValidTime(exam.clinic_checkout_time)) && (
          <Text style={{ marginTop: 10, fontSize: 13, color: '#64748B', fontFamily: 'Mulish' }}>
            Vào Y tế:{' '}
            <Text style={{ fontWeight: '600', color: '#334155', fontFamily: 'Mulish' }}>
              {formatTimeStr(exam.clinic_checkin_time) || '--'}
            </Text>
            {'  '}Về lớp:{' '}
            <Text style={{ fontWeight: '600', color: '#334155', fontFamily: 'Mulish' }}>
              {formatTimeStr(exam.clinic_checkout_time) || '--'}
            </Text>
          </Text>
        )}

        {/* NVYT */}
        {(exam.medical_staff_name || exam.examined_by_name) && (
          <Text style={{ marginTop: 8, fontSize: 13, color: '#64748B', fontFamily: 'Mulish' }}>
            Nhân viên thăm khám:{' '}
            <Text style={{ fontWeight: '500', color: '#475569', fontFamily: 'Mulish' }}>
              {normalizeVietnameseName(exam.medical_staff_name || exam.examined_by_name || '')}
            </Text>
          </Text>
        )}
      </View>
    );
  };

  // Render student item - thẻ chuyên nghiệp
  const renderStudentItem = ({ item }: { item: ClassHealthExamStudent }) => {
    const isExpanded = !!expandedStudents[item.student_id];
    const examCount = countExaminationVisits(item.examinations || []);
    const hasExams = examCount > 0;
    const imageUrl = getFullImageUrl(item.student_photo);

    return (
      <View
        style={{
          marginBottom: 14,
          borderRadius: 16,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E2E8F0',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        }}>
        {/* Header thẻ */}
        <TouchableOpacity
          onPress={() => hasExams && toggleExpand(item.student_id)}
          activeOpacity={hasExams ? 0.7 : 1}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
          }}>
          {/* Chevron */}
          <View style={{ width: 24, marginRight: 12, alignItems: 'center' }}>
            {hasExams && (
              <Ionicons
                name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                size={20}
                color="#94A3B8"
              />
            )}
          </View>

          {/* Avatar */}
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                marginRight: 14,
                borderWidth: 2,
                borderColor: '#E2E8F0',
              }}
            />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                marginRight: 14,
                backgroundColor: '#002855',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#E2E8F0',
              }}>
              <Text
                style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Mulish' }}>
                {getInitials(item.student_name || '')}
              </Text>
            </View>
          )}

          {/* Tên + Mã HS */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 16, fontWeight: '600', color: '#0F172A', fontFamily: 'Mulish' }}
              numberOfLines={1}>
              {item.student_name}
            </Text>
            <Text
              style={{ fontSize: 13, color: '#64748B', marginTop: 2, fontFamily: 'Mulish' }}
              numberOfLines={1}>
              {item.student_code}
            </Text>
          </View>

          {/* Badge lượt khám + Nút xem chi tiết */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: hasExams ? '#DBEAFE' : '#F1F5F9',
              }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: hasExams ? '#1D4ED8' : '#64748B',
                  fontFamily: 'Mulish',
                }}>
                {examCount} lượt khám
              </Text>
            </View>
            {hasExams && (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate(ROUTES.SCREENS.STUDENT_HEALTH_DETAIL, {
                    classId,
                    studentId: item.student_id,
                    date,
                  })
                }
                activeOpacity={0.7}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="eye-outline" size={18} color="#002855" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {/* Danh sách hồ sơ (khi mở rộng) */}
        {isExpanded && hasExams && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: '#E2E8F0',
              paddingHorizontal: 16,
              paddingBottom: 16,
              paddingTop: 12,
              backgroundColor: '#FAFBFC',
            }}>
            {item.examinations?.map((exam, idx) => renderExaminationItem(exam, idx))}
          </View>
        )}
      </View>
    );
  };

  // Render loading
  if (loading && data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#002855" />
        <Text className="mt-4 text-gray-500">Đang tải...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Search bar và Stats */}
      <View className="border-b border-gray-100 bg-white px-4 pb-3">
        {/* Search bar */}
        <View className="mb-3 flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            placeholder={t('teacher_health.search_placeholder') || 'Tìm học sinh...'}
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="ml-2 flex-1 text-base text-[#002855]"
            placeholderTextColor="#9CA3AF"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        {data.length > 0 && (
          <View className="flex-row items-center">
            <View className="mr-4 flex-row items-center">
              <Text className="text-sm text-gray-600">Học sinh: </Text>
              <Text className="text-sm font-bold text-[#002855]">{data.length}</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-600">Lượt khám: </Text>
              <Text className="text-sm font-bold text-[#002855]">{totalExaminations}</Text>
            </View>
          </View>
        )}
      </View>

      {/* List */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.student_id}
        renderItem={renderStudentItem}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 100 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={onRefresh}
            colors={['#002855']}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <MaterialCommunityIcons name="stethoscope" size={64} color="#ccc" />
            <Text className="mt-4 text-base text-gray-500">
              {searchTerm
                ? t('teacher_health.no_search_results') || 'Không tìm thấy kết quả'
                : t('teacher_health.no_exams_today') || 'Chưa có học sinh thăm khám hôm nay'}
            </Text>
          </View>
        }
      />

      {/* FAB - Báo Y tế */}
      <TouchableOpacity
        onPress={() => setReportModalOpen(true)}
        activeOpacity={0.8}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 20 + insets.bottom,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 28,
          backgroundColor: '#002855',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 8,
        }}>
        <Text className="text-sm font-semibold text-white">Báo Y tế</Text>
      </TouchableOpacity>

      {/* Report to Clinic Modal */}
      <ReportToClinicModal
        visible={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        classId={classId}
        onSuccess={() => {
          setReportModalOpen(false);
          fetchData();
        }}
      />
    </View>
  );
};

export default HealthExamTab;
