// @ts-nocheck
import React, { useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StudentAvatar } from '../../utils/studentAvatar';
import { attendanceApiService } from '../../services/attendanceApiService';
import dailyHealthService, {
  type HealthStatusForPeriodResponse,
} from '../../services/dailyHealthService';
import { TouchableOpacity } from '../../components/Common';

// Attendance status type aligned with web
type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

const statusLabel: Record<AttendanceStatus, string> = {
  present: 'Có mặt',
  absent: 'Vắng không phép',
  late: 'Muộn',
  excused: 'Vắng có phép',
};

const cardBgByStatus: Record<AttendanceStatus, string> = {
  present: '#F6FCE5',
  absent: '#FEF6F4',
  late: '#FFFCF2',
  excused: '#f6f6f6',
};

/** Giống ClassLog/LessonLog: rows API → map student_id → status */
function attendanceRowsToMap(rows: any[] | undefined): Record<string, AttendanceStatus> {
  const m: Record<string, AttendanceStatus> = {};
  (rows || []).forEach((item: any) => {
    const id = item.student_id || item.name;
    if (id) m[id] = (item.status as AttendanceStatus) || 'present';
  });
  return m;
}

// Props type cho StudentCard
interface StudentCardProps {
  student: any;
  finalStatus: AttendanceStatus;
  hasOverride: boolean;
  hasEventOverride: boolean;
  badge: string | null;
  checkInTime?: string;
  checkOutTime?: string;
  onSetStatus: (studentId: string, status: AttendanceStatus) => void;
}

// Extract StudentCard ra ngoài và wrap React.memo để tối ưu render
const StudentCard = React.memo(
  ({
    student,
    finalStatus,
    hasOverride,
    hasEventOverride,
    badge,
    checkInTime,
    checkOutTime,
    onSetStatus,
  }: StudentCardProps) => {
    const studentId = student.name;
    const dimmed = finalStatus === 'excused' ? 0.6 : 1;

    return (
      <View
        className="mx-auto mb-3 w-full rounded-2xl"
        style={{ backgroundColor: cardBgByStatus[finalStatus], opacity: dimmed }}>
        <View className="mb-2 flex-row items-start gap-4 p-4">
          <View className="shrink-0">
            <StudentAvatar
              name={student.student_name}
              avatarUrl={student.user_image || student.avatar_url || student.photo}
              size={100}
            />
          </View>
          <View className="flex-1">
            <View className="mb-2">
              <Text className="text-xl font-semibold text-[#000]">{student.student_name}</Text>
            </View>
            <View className="mb-6 flex-row items-center gap-2">
              <Text className="text-base text-[#757575]">{statusLabel[finalStatus]}</Text>
              {badge && (
                <View className="rounded bg-white/60 px-2 py-0.5">
                  <Text className="text-xs text-[#757575]">{badge}</Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="log-in-outline" size={24} color="#757575" />
                <Text className="text-base font-medium text-[#757575]">
                  {checkInTime || '--:--'}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="log-out-outline" size={24} color="#757575" />
                <Text className="text-base font-medium text-[#757575]">
                  {checkOutTime || '--:--'}
                </Text>
              </View>
            </View>
          </View>
        </View>
        {/* Attendance buttons */}
        <View className="flex-row justify-center">
          <TouchableOpacity
            onPress={() => onSetStatus(studentId, 'present')}
            disabled={hasEventOverride}
            style={{
              flex: 1,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: finalStatus === 'present' ? '#3DB838' : '#EBEBEB',
              borderBottomLeftRadius: 12,
              opacity: hasEventOverride ? 0.5 : 1,
            }}>
            <Ionicons
              name="checkmark"
              size={20}
              color={finalStatus === 'present' ? '#fff' : '#3F4246'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onSetStatus(studentId, 'absent')}
            disabled={hasEventOverride}
            style={{
              flex: 1,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: finalStatus === 'absent' ? '#DC0909' : '#EBEBEB',
              opacity: hasEventOverride ? 0.5 : 1,
            }}>
            <Ionicons
              name="close"
              size={20}
              color={finalStatus === 'absent' ? '#fff' : '#3F4246'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onSetStatus(studentId, 'late')}
            disabled={hasEventOverride}
            style={{
              flex: 1,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: finalStatus === 'late' ? '#F5AA1E' : '#EBEBEB',
              opacity: hasEventOverride ? 0.5 : 1,
            }}>
            <Ionicons
              name="time-outline"
              size={16}
              color={finalStatus === 'late' ? '#fff' : '#3F4246'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onSetStatus(studentId, 'excused')}
            disabled={hasEventOverride}
            style={{
              flex: 1,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: finalStatus === 'excused' ? '#3F4246' : '#EBEBEB',
              borderBottomRightRadius: 12,
              opacity: hasEventOverride ? 0.5 : 1,
            }}>
            <Ionicons
              name="close-circle-outline"
              size={16}
              color={finalStatus === 'excused' ? '#fff' : '#3F4246'}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

// Sort Vietnamese names: first name, then last name, then middle name (aligned with web)
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

  // Compare first name (last part) first
  const firstNameCompare = (charsA[charsA.length - 1] || '').localeCompare(
    charsB[charsB.length - 1] || '',
    'vi'
  );
  if (firstNameCompare !== 0) return firstNameCompare;

  // Then last name (first part)
  const lastNameCompare = (charsA[0] || '').localeCompare(charsB[0] || '', 'vi');
  if (lastNameCompare !== 0) return lastNameCompare;

  // Then middle name
  if (charsA.length >= 3 && charsB.length >= 3) {
    return (charsA[1] || '').localeCompare(charsB[1] || '', 'vi');
  }

  if (charsA.length >= 3 && charsB.length < 3) return -1;
  if (charsA.length < 3 && charsB.length >= 3) return 1;

  return 0;
};

const AttendanceDetail = () => {
  const nav = useNavigation<any>();
  const route = useRoute();

  // Safe destructure route.params with fallback to empty object
  const params = (route.params || {}) as {
    classData?: any;
    period?: string;
    periodName?: string;
    selectedDate?: string;
  };
  const {
    classData,
    period: routePeriod,
    periodName: routePeriodName,
    selectedDate: routeSelectedDate,
  } = params;

  const [students, setStudents] = useState<any[]>([]);
  /** Điểm danh nền từ server: tiết học nếu đã có bản ghi, không thì homeroom (đồng bộ LessonLog) */
  const [serverAttendanceMap, setServerAttendanceMap] = useState<
    Record<string, AttendanceStatus>
  >({});
  /** Chỉnh tay của GV trên màn hình (tách khỏi nền để overlay Y tế không bị chặn bởi present) */
  const [userAttendanceOverrides, setUserAttendanceOverrides] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [eventStatuses, setEventStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [leaveStatuses, setLeaveStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [checkInOutTimes, setCheckInOutTimes] = useState<
    Record<string, { checkInTime?: string; checkOutTime?: string }>
  >({});
  const [events, setEvents] = useState<
    { eventId: string; eventTitle: string; studentIds: string[] }[]
  >([]);
  const [healthStatus, setHealthStatus] = useState<
    HealthStatusForPeriodResponse['students']
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classTitle, setClassTitle] = useState<string>('');
  const [educationStageId, setEducationStageId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract classId from classData (support both GVCN and GVBM)
  // GVBM (timetable entry) has class_id field, GVCN (homeroom) uses name field
  // Prioritize class_id for GVBM since classData.name is timetable entry ID, not class ID
  const classId = classData?.class_id || classData?.name;

  // Use selected date from route params, fallback to today
  const today = useMemo(() => {
    if (routeSelectedDate) {
      return routeSelectedDate;
    }
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [routeSelectedDate]);

  // Determine mode based on classData structure (GVBM if has subject_title, GVCN otherwise)
  const mode = classData?.subject_title ? 'GVBM' : 'GVCN';

  /** Period gửi API điểm danh / Y tế / lưu — khớp web LessonLog (period_name trong URL, không phải timetable_column_id) */
  const savePeriod = useMemo(() => {
    if (mode === 'GVCN') return 'homeroom';
    const p = String(routePeriodName || routePeriod || '').trim();
    return p || 'homeroom';
  }, [mode, routePeriod, routePeriodName]);

  const fetchStudents = useCallback(async () => {
    if (!classId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Set class title
      let title =
        classData.title ||
        classData.class_title ||
        classData.short_title ||
        classData.class_name ||
        String(classId);

      if (routePeriodName && classData.subject_title) {
        title += ` - ${routePeriodName} (${classData.subject_title})`;
      } else if (routePeriod && classData.subject_title) {
        title += ` - ${classData.subject_title}`;
      }

      setClassTitle(title);

      const isHomeroomOnly = mode === 'GVCN';
      const lessonPeriod = isHomeroomOnly ? 'homeroom' : savePeriod;

      // === PHASE 1+2: Song song lấy education info và student list ===
      // Phase 1: getClassInfo → getEducationStage (chained)
      const fetchEducationInfo = async (): Promise<string | undefined> => {
        try {
          const classResult = await attendanceApiService.getClassInfo(String(classId));
          if (classResult.success && classResult.data?.education_grade) {
            const gradeResult = await attendanceApiService.getEducationStage(
              classResult.data.education_grade
            );
            if (gradeResult.success && gradeResult.data?.education_stage_id) {
              return gradeResult.data.education_stage_id;
            }
          }
        } catch (err) {
          console.error('Failed to fetch education info:', err);
        }
        return undefined;
      };

      // Phase 2: getClassStudents → getBatchStudents (chained)
      const fetchStudentsList = async (): Promise<any[]> => {
        const studentsResult = await attendanceApiService.getClassStudents(
          String(classId),
          1,
          1000
        );
        if (!studentsResult.success || !studentsResult.data || studentsResult.data.length === 0) {
          return [];
        }
        const studentIds = studentsResult.data;

        const batchStudentsResult = await attendanceApiService.getBatchStudents(studentIds);
        if (!batchStudentsResult.success || !batchStudentsResult.data) {
          return [];
        }
        return batchStudentsResult.data;
      };

      // Chạy Phase 1 và Phase 2 song song
      const [localEducationStageId, studentsData] = await Promise.all([
        fetchEducationInfo(),
        fetchStudentsList(),
      ]);

      if (localEducationStageId) {
        setEducationStageId(localEducationStageId);
      }

      if (studentsData.length === 0) {
        setStudents([]);
        setServerAttendanceMap({});
        setUserAttendanceOverrides({});
        setEventStatuses({});
        setLeaveStatuses({});
        setHealthStatus({});
        setCheckInOutTimes({});
        return;
      }

      setStudents(studentsData);
      setUserAttendanceOverrides({});
      const studentCodes = studentsData.map((s) => s.student_code).filter(Boolean);

      // === PHASE 3: Song song tất cả các API còn lại ===
      const periodAttPromise = lessonPeriod
        ? attendanceApiService.getClassAttendance(String(classId), today, lessonPeriod, true)
        : Promise.resolve({ success: true, data: [] as any[] });
      const homeroomAttPromise =
        !isHomeroomOnly && lessonPeriod && lessonPeriod !== 'homeroom'
          ? attendanceApiService.getClassAttendance(String(classId), today, 'homeroom', true)
          : Promise.resolve({ success: true, data: [] as any[] });

      const [periodAttResult, homeroomAttResult, dayMapResult, eventData, leavesResult, healthResult] =
        await Promise.all([
          periodAttPromise,

          homeroomAttPromise,

          // Lấy check-in/out times
          studentCodes.length > 0
            ? attendanceApiService.getStudentsDayMap(studentCodes, today)
            : Promise.resolve({ success: true, data: {} }),

          // Lấy event statuses và events list
          localEducationStageId
            ? Promise.all([
                attendanceApiService.getEventAttendanceStatuses(
                  String(classId),
                  today,
                  lessonPeriod,
                  localEducationStageId
                ),
                attendanceApiService.getEventsByClassPeriod(
                  String(classId),
                  today,
                  lessonPeriod,
                  localEducationStageId
                ),
              ])
            : Promise.resolve([
                { success: true, data: {} },
                { success: true, data: [] },
              ]),

          // Lấy active leaves
          attendanceApiService.getActiveLeaves(String(classId), today),

          // Lấy trạng thái Y tế theo tiết học (học sinh báo xuống y tế)
          dailyHealthService.getHealthStatusForPeriod({
            class_id: String(classId),
            date: today,
            period: lessonPeriod,
          }),
        ]);

      // Điểm danh nền: giống LessonLog — có bản ghi tiết thì dùng tiết, không thì homeroom
      const periodRows =
        periodAttResult.success && Array.isArray(periodAttResult.data) ? periodAttResult.data : [];
      const homeroomRows =
        homeroomAttResult.success && Array.isArray(homeroomAttResult.data)
          ? homeroomAttResult.data
          : [];
      const hasPeriodAttendance = !isHomeroomOnly && periodRows.length > 0;
      const periodMap = attendanceRowsToMap(periodRows);
      const homeroomMap = attendanceRowsToMap(homeroomRows);

      const serverBase: Record<string, AttendanceStatus> = {};
      if (isHomeroomOnly) {
        Object.assign(serverBase, periodMap);
      } else {
        for (const s of studentsData) {
          const sid = s.name;
          const st = hasPeriodAttendance ? periodMap[sid] : homeroomMap[sid];
          if (st) serverBase[sid] = st;
        }
      }
      setServerAttendanceMap(serverBase);

      // Xử lý check-in/out times
      if (dayMapResult.success && dayMapResult.data) {
        const checkInOutData: Record<string, { checkInTime?: string; checkOutTime?: string }> = {};

        Object.entries(dayMapResult.data).forEach(
          ([studentCode, attendanceData]: [string, any]) => {
            const student = studentsData.find((s) => s.student_code === studentCode);
            if (!student) return;

            const checkInTime = attendanceData?.checkInTime;
            const checkOutTime = attendanceData?.checkOutTime;

            if (checkInTime || checkOutTime) {
              checkInOutData[student.name] = {
                checkInTime: checkInTime
                  ? new Date(checkInTime).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : undefined,
                checkOutTime: checkOutTime
                  ? new Date(checkOutTime).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : undefined,
              };
            }
          }
        );
        setCheckInOutTimes(checkInOutData);
      } else {
        setCheckInOutTimes({});
      }

      // Xử lý event statuses
      const [eventStatusesResult, eventsResult] = eventData;
      if (eventStatusesResult.success && eventStatusesResult.data) {
        setEventStatuses(eventStatusesResult.data);
      } else {
        setEventStatuses({});
      }
      if (eventsResult.success && eventsResult.data) {
        setEvents(eventsResult.data);
      } else {
        setEvents([]);
      }

      // Xử lý leaves
      if (leavesResult.success && leavesResult.data) {
        const leaveMap: Record<string, AttendanceStatus> = {};
        Object.keys(leavesResult.data).forEach((studentId) => {
          leaveMap[studentId] = 'excused';
        });
        setLeaveStatuses(leaveMap);
      } else {
        setLeaveStatuses({});
      }

      // Xử lý trạng thái Y tế (học sinh báo xuống y tế)
      if (healthResult && healthResult.students) {
        setHealthStatus(healthResult.students);
      } else {
        setHealthStatus({});
      }
    } catch (e) {
      console.error('AttendanceDetail error:', e);
      setStudents([]);
      setServerAttendanceMap({});
      setUserAttendanceOverrides({});
      setEventStatuses({});
      setLeaveStatuses({});
      setHealthStatus({});
      setCheckInOutTimes({});
    } finally {
      setLoading(false);
    }
  }, [classId, mode, classData, today, savePeriod, routePeriod, routePeriodName]);

  useFocusEffect(
    useCallback(() => {
      if (classData) {
        fetchStudents();
      }
    }, [classData, fetchStudents])
  );

  // Sort students by Vietnamese name (aligned with web)
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const nameA = a.student_name || a.name || '';
      const nameB = b.student_name || b.name || '';
      return sortVietnameseName(nameA, nameB);
    });
  }, [students]);

  // Filter students by search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return sortedStudents;

    const query = searchQuery.toLowerCase().trim();
    return sortedStudents.filter((s) => {
      const name = (s.student_name || '').toLowerCase();
      const code = (s.student_code || '').toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  }, [sortedStudents, searchQuery]);

  // Coi "ở Y tế / vắng vì Y tế" khi: left_class, at_clinic, examining, picked_up, transferred
  // returned = đã về lớp → dùng attendance record (GV có thể đã điểm danh lại)
  const isAtHealthForStudent = (studentId: string) => {
    const h = healthStatus[studentId];
    return !!h && ['left_class', 'at_clinic', 'examining', 'picked_up', 'transferred'].includes(h.status || '');
  };

  // Đồng bộ LessonLog/ClassLog: Event > chỉnh tay GV > nghỉ phép > overlay Y tế > nền server (tiết/homeroom)
  const getFinalStatus = (studentId: string): AttendanceStatus => {
    if (eventStatuses[studentId]) return eventStatuses[studentId];
    if (Object.prototype.hasOwnProperty.call(userAttendanceOverrides, studentId)) {
      return userAttendanceOverrides[studentId];
    }
    if (leaveStatuses[studentId]) return leaveStatuses[studentId];
    // Y tế còn trong luồng → ép excused kể cả khi nền server là present (DB chưa kịp excused)
    if (isAtHealthForStudent(studentId)) return 'excused';
    return serverAttendanceMap[studentId] || 'present';
  };

  // Chỉ block khi có event status (không block leave)
  const hasEventOverrideStatus = (studentId: string): boolean => {
    return !!eventStatuses[studentId];
  };

  // Vẫn giữ hàm này để check có override nào không (dùng cho UI badge)
  const hasOverrideStatus = (studentId: string): boolean => {
    return !!(
      eventStatuses[studentId] ||
      Object.prototype.hasOwnProperty.call(userAttendanceOverrides, studentId) ||
      leaveStatuses[studentId] ||
      isAtHealthForStudent(studentId)
    );
  };

  const getOverrideBadge = (studentId: string): string | null => {
    if (eventStatuses[studentId]) return 'Sự kiện';
    // Nếu có leave nhưng đã manual override thì hiện badge đặc biệt
    if (leaveStatuses[studentId]) {
      if (Object.prototype.hasOwnProperty.call(userAttendanceOverrides, studentId)) {
        return 'Nghỉ phép (đã thay đổi)';
      }
      return 'Nghỉ phép';
    }
    // Học sinh đang ở Y tế (chưa về lớp)
    if (isAtHealthForStudent(studentId)) return 'Y tế';
    return null;
  };

  const setStatus = (id: string, status: AttendanceStatus) => {
    if (hasEventOverrideStatus(id)) return;
    setUserAttendanceOverrides((prev) => ({ ...prev, [id]: status }));
  };

  const savingRef = useRef(false);

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const items = sortedStudents.map((s) => {
        const studentId = s.name;
        const finalStatus = getFinalStatus(studentId);

        let remarks = undefined;
        const eventStatus = eventStatuses[studentId];
        const leaveStatus = leaveStatuses[studentId];

        if (eventStatus && eventStatus !== 'present') {
          const eventInfo = events.find((e) => e.studentIds.includes(studentId));
          if (eventInfo) {
            if (eventStatus === 'excused') {
              remarks = `Tham gia sự kiện: ${eventInfo.eventTitle}`;
            } else if (eventStatus === 'absent') {
              remarks = `Vắng sự kiện: ${eventInfo.eventTitle}`;
            } else {
              remarks = `Sự kiện: ${eventInfo.eventTitle}`;
            }
          }
        } else if (
          leaveStatus &&
          !Object.prototype.hasOwnProperty.call(userAttendanceOverrides, studentId)
        ) {
          remarks = `Nghỉ phép`;
        } else if (
          isAtHealthForStudent(studentId) &&
          !Object.prototype.hasOwnProperty.call(userAttendanceOverrides, studentId)
        ) {
          remarks = `Xuống Y tế`;
        }

        return {
          student_id: studentId,
          student_code: s.student_code,
          student_name: s.student_name,
          class_id: String(classId),
          date: today,
          period: savePeriod,
          status: finalStatus,
          remarks,
        };
      });

      const saveResult = await attendanceApiService.saveClassAttendance(items, true);

      if (saveResult.success) {
        Alert.alert('Thành công', 'Đã lưu điểm danh');
        nav.goBack();
      } else {
        Alert.alert('Lỗi', saveResult.error || 'Không thể lưu điểm danh');
      }
    } catch (error) {
      console.error('handleSave error:', error);
      Alert.alert('Lỗi', 'Không thể lưu điểm danh');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  // Phải đặt sau hooks (Rules of Hooks)
  if (!classData) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-3">
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#0A2240" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-[#0A2240]">Điểm danh</Text>
          <View style={{ width: 24 }} />
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Không tìm thấy thông tin lớp học</Text>
          <TouchableOpacity
            onPress={() => nav.goBack()}
            className="mt-4 rounded-xl bg-[#3F4246] px-6 py-3">
            <Text className="font-medium text-white">Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="relative flex-row items-center justify-between px-4 py-3">
        <TouchableOpacity onPress={() => nav.goBack()} className="z-10">
          <Ionicons name="chevron-back" size={24} color="#0A2240" />
        </TouchableOpacity>
        <Text className="absolute left-0 right-0 text-center text-2xl font-bold text-[#0A2240]">
          Điểm danh
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || loading}
          className={`z-10 rounded-xl ${saving || loading ? 'bg-[#D1D5DB]' : 'bg-[#3F4246]'} px-3 py-1.5`}>
          <Text className="text-sm font-semibold text-white">
            {saving ? 'Đang lưu...' : 'Cập nhật'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#009483" />
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item, index) => `${item.name}-${item.student_code || 'no-code'}-${index}`}
          contentContainerStyle={{ padding: 16 }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          ListHeaderComponent={
            <>
              <View className="mb-4">
                <Text className="text-xl font-bold text-[#0A2240]">
                  {classTitle || String(classId)}
                </Text>
              </View>

              {/* Search Bar */}
              <View className="mb-4 flex-row items-center rounded-2xl border border-[#E5E7EB] px-5 py-2">
                <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
                <TextInput
                  className="flex-1 text-base text-[#0A2240]"
                  placeholder="Tìm học sinh theo tên hoặc mã..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Student count */}
              {searchQuery ? (
                <Text className="mb-3 text-sm text-gray-600">
                  Hiển thị {filteredStudents.length}/{sortedStudents.length} học sinh
                </Text>
              ) : null}
            </>
          }
          renderItem={({ item: s }) => {
            const studentId = s.name;
            const finalStatus = getFinalStatus(studentId);
            const hasOverride = hasOverrideStatus(studentId);
            const hasEventOverride = !!eventStatuses[studentId];
            const badge = getOverrideBadge(studentId);
            const checkInOut = checkInOutTimes[studentId];

            return (
              <StudentCard
                student={s}
                finalStatus={finalStatus}
                hasOverride={hasOverride}
                hasEventOverride={hasEventOverride}
                badge={badge}
                checkInTime={checkInOut?.checkInTime}
                checkOutTime={checkInOut?.checkOutTime}
                onSetStatus={setStatus}
              />
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-10">
              <Text className="text-gray-500">Không có học sinh</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default AttendanceDetail;
