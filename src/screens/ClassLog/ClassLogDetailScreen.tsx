// @ts-nocheck
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../hooks/useLanguage';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { attendanceApiService } from '../../services/attendanceApiService';
import classLogService, { ClassLogData, ClassLogStudent } from '../../services/classLogService';
import dailyHealthService, {
  HealthStatusForPeriodResponse,
} from '../../services/dailyHealthService';
import StudentClassLogCard from './components/StudentClassLogCard';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

// Đồng bộ LessonLog web: chỉ ép excused khi HS còn trong luồng Y tế (chưa rejected/cancelled/returned)
const STILL_AT_CLINIC_STATUSES = ['left_class', 'at_clinic', 'examining', 'picked_up', 'transferred'] as const;

/** Chuyển rows API get_class_attendance → map student_id → status */
function attendanceRowsToMap(rows: any[] | undefined): Record<string, AttendanceStatus> {
  const m: Record<string, AttendanceStatus> = {};
  (rows || []).forEach((item: any) => {
    const id = item.student_id || item.name;
    if (id) m[id] = (item.status as AttendanceStatus) || 'present';
  });
  return m;
}

type RouteParams = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.CLASS_LOG_DETAIL>;

// Sort Vietnamese names
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

  const getFirstChars = (parts: string[]) => parts.map((part) => part.charAt(0).toLowerCase());
  const charsA = getFirstChars(partsA);
  const charsB = getFirstChars(partsB);

  // So sánh tên (phần cuối)
  const firstNameCompare = (charsA[charsA.length - 1] || '').localeCompare(
    charsB[charsB.length - 1] || '',
    'vi'
  );
  if (firstNameCompare !== 0) return firstNameCompare;

  // Rồi đến họ (phần đầu)
  const lastNameCompare = (charsA[0] || '').localeCompare(charsB[0] || '', 'vi');
  if (lastNameCompare !== 0) return lastNameCompare;

  return nameA.localeCompare(nameB, 'vi');
};

const ClassLogDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const { t } = useLanguage();

  const { classId, date, period, periodName, subjectTitle, timetableEntry } = route.params;

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  /** Điểm danh hiệu dụng: tiết học nếu đã có bản ghi, không thì homeroom (giống web LessonLog) */
  const [baseAttendanceMap, setBaseAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [healthStatusMap, setHealthStatusMap] = useState<HealthStatusForPeriodResponse['students']>(
    {}
  );
  const [classLogData, setClassLogData] = useState<ClassLogData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load data khi màn hình được focus (bao gồm cả khi quay lại từ detail screen)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [classId, date, period])
  );

  const loadData = async () => {
    try {
      setLoading(true);

      console.log(
        '📚 ClassLogDetail - Loading data for class:',
        classId,
        'date:',
        date,
        'period:',
        period
      );

      // Bước 1: Lấy danh sách student IDs từ class
      const classStudentsRes = await attendanceApiService.getClassStudents(classId);

      let studentsList: any[] = [];

      if (classStudentsRes?.success && classStudentsRes?.data?.length > 0) {
        // Bước 2: Lấy chi tiết students
        const studentIds = classStudentsRes.data;

        const batchRes = await attendanceApiService.getBatchStudents(studentIds);

        if (batchRes?.success && batchRes?.data) {
          studentsList = batchRes.data;
        }
      }

      // Parallel fetch các data khác
      const [periodAttRes, homeroomAttRes, healthResponse, classLogResponse] = await Promise.all([
        attendanceApiService.getClassAttendance(classId, date, period),
        attendanceApiService.getClassAttendance(classId, date, 'homeroom'),
        dailyHealthService.getHealthStatusForPeriod({ class_id: classId, date, period }),
        classLogService.getClassLog({ class_id: classId, date, period }),
      ]);

      // Process students
      if (studentsList.length > 0) {
        const sortedStudents = [...studentsList].sort((a, b) =>
          sortVietnameseName(a.student_name || '', b.student_name || '')
        );
        setStudents(sortedStudents);
        console.log('📚 ClassLogDetail - Sorted students:', sortedStudents.length);
      } else {
        console.log('📚 ClassLogDetail - No students found');
        setStudents([]);
      }

      // Process attendance — API trả về { success, data } (giống AttendanceDetail), không có .attendance
      const periodRows =
        periodAttRes?.success && Array.isArray(periodAttRes.data) ? periodAttRes.data : [];
      const homeroomRows =
        homeroomAttRes?.success && Array.isArray(homeroomAttRes.data) ? homeroomAttRes.data : [];
      const hasPeriodAttendance = periodRows.length > 0;
      const baseMap = hasPeriodAttendance
        ? attendanceRowsToMap(periodRows)
        : attendanceRowsToMap(homeroomRows);
      setBaseAttendanceMap(baseMap);

      // Health status
      setHealthStatusMap(healthResponse?.students || {});

      // Class log data
      setClassLogData(classLogResponse);
    } catch (error) {
      console.error('Error loading class log detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.student_name?.toLowerCase().includes(query) ||
        s.student_code?.toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  // Get attendance status for a student
  const getAttendanceStatus = useCallback(
    (studentId: string): AttendanceStatus => {
      // Khi Y tế từ chối (rejected): visit không còn trong get_health_status_for_period,
      // điểm danh tiết vẫn excused trên server → cần đọc đúng baseAttendanceMap (trước đây bug .attendance → luôn present).
      const status = healthStatusMap[studentId]?.status;
      if (status && (STILL_AT_CLINIC_STATUSES as readonly string[]).includes(status)) {
        return 'excused';
      }
      return baseAttendanceMap[studentId] || 'present';
    },
    [baseAttendanceMap, healthStatusMap]
  );

  // Get class log data for a student
  const getStudentClassLogData = useCallback(
    (studentId: string): ClassLogStudent | undefined => {
      return classLogData?.students?.find((s) => s.student_id === studentId);
    },
    [classLogData]
  );

  // Handle student press - Navigate to detail screen
  const handleStudentPress = (student: any) => {
    const studentId = student.name || student.student_id;
    const healthInfo = healthStatusMap[studentId];
    // Hiển thị thông tin Y tế khi: đang ở Y tế hoặc đã checkout không về lớp (picked_up/transferred)
    const showHealthInfo =
      !!healthInfo && ['left_class', 'at_clinic', 'examining', 'picked_up', 'transferred'].includes(healthInfo.status || '');
    navigation.navigate(ROUTES.SCREENS.STUDENT_CLASS_LOG_DETAIL, {
      student,
      attendanceStatus: getAttendanceStatus(studentId),
      isAtClinic: showHealthInfo,
      healthVisitInfo: healthInfo || undefined,
      classId,
      date,
      period,
      initialData: getStudentClassLogData(studentId),
    });
  };

  // Count students by status
  const statusCounts = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0, atClinic: 0 };
    students.forEach((s) => {
      const status = getAttendanceStatus(s.name || s.student_id);
      counts[status]++;
      const h = healthStatusMap[s.name || s.student_id];
      // Đếm học sinh đang ở Y tế (chưa checkout)
      if (h && ['left_class', 'at_clinic', 'examining'].includes(h.status || '')) {
        counts.atClinic++;
      }
    });
    return counts;
  }, [students, getAttendanceStatus, healthStatusMap]);

  // Render loading
  if (loading) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="mt-4 text-gray-500">Đang tải...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      {/* Header */}
      <View className="border-b border-gray-100 bg-white">
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-full p-2">
            <Ionicons name="arrow-back" size={24} />
          </TouchableOpacity>
          <View className="ml-2 flex-1">
            <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
              {subjectTitle || 'Sổ đầu bài'}
            </Text>
            <Text className="text-sm text-gray-500">
              {periodName || period} • {date}
            </Text>
          </View>
        </View>

        {/* Status summary - giống AttendanceHome */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            marginHorizontal: 16,
            marginTop: 8,
            marginBottom: 16,
            paddingVertical: 12,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={24} color="#22C55E" />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 16,
                color: '#22C55E',
                fontWeight: '500',
              }}>
              {statusCounts.present}
            </Text>
          </View>

          <Text style={{ color: '#757575', fontSize: 16, fontWeight: '600' }}>|</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color="#EF4444" />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 16,
                color: '#EF4444',
                fontWeight: '500',
              }}>
              {statusCounts.absent}
            </Text>
          </View>

          <Text style={{ color: '#757575', fontSize: 16, fontWeight: '600' }}>|</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="time-outline" size={24} color="#F5AA1E" />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 16,
                color: '#F5AA1E',
                fontWeight: '500',
              }}>
              {statusCounts.late}
            </Text>
          </View>

          <Text style={{ color: '#757575', fontSize: 16, fontWeight: '600' }}>|</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="ban-outline" size={24} color="#6B7280" />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 16,
                color: '#6B7280',
                fontWeight: '500',
              }}>
              {statusCounts.atClinic}
            </Text>
          </View>
        </View>

        {/* Search bar */}
        <View className="px-4 pb-3">
          <View className="flex-row items-center rounded-xl bg-gray-100 px-3 py-2">
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm học sinh..."
              placeholderTextColor="#9CA3AF"
              className="ml-2 flex-1 text-gray-900"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Student list */}
      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.name || item.student_id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4F46E5']} />
        }
        renderItem={({ item }) => {
          const studentId = item.name || item.student_id;
          const status = getAttendanceStatus(studentId);
          const healthInfo = healthStatusMap[studentId];
          const showHealthBadge =
            !!healthInfo && ['left_class', 'at_clinic', 'examining', 'picked_up', 'transferred'].includes(healthInfo.status || '');
          const logData = getStudentClassLogData(studentId);

          return (
            <StudentClassLogCard
              student={item}
              attendanceStatus={status}
              isAtClinic={showHealthBadge}
              healthVisitInfo={healthInfo}
              classLogData={logData}
              onPress={() => handleStudentPress(item)}
            />
          );
        }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="people-outline" size={64} color="#D1D5DB" />
            <Text className="mt-4 text-center text-lg text-gray-500">
              {searchQuery ? 'Không tìm thấy học sinh' : 'Chưa có học sinh trong lớp'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

export default ClassLogDetailScreen;
