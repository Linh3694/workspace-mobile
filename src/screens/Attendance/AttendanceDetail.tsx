// @ts-nocheck
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StudentAvatar } from '../../utils/studentAvatar';
import { attendanceApiService } from '../../services/attendanceApiService';
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
  const { classData, period: routePeriod, periodName: routePeriodName, selectedDate: routeSelectedDate } = route.params as { classData: any; period?: string; periodName?: string; selectedDate?: string };

  const [students, setStudents] = useState<any[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [eventStatuses, setEventStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [leaveStatuses, setLeaveStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [checkInOutTimes, setCheckInOutTimes] = useState<
    Record<string, { checkInTime?: string; checkOutTime?: string }>
  >({});
  const [events, setEvents] = useState<
    { eventId: string; eventTitle: string; studentIds: string[] }[]
  >([]);
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
  // Use route period if provided (from timetable entries), otherwise use default logic
  const period = routePeriod || (mode === 'GVCN' ? 'homeroom' : undefined);

  const fetchStudents = useCallback(async () => {
    if (!classId) {
      console.error('❌ [Mobile] No classId provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('🔄 [Mobile] AttendanceDetail: Loading data for class', classId, 'mode:', mode);

      // Set class title from classData (include period/subject info for timetable entries)
      let title =
        classData.title ||
        classData.class_title ||
        classData.short_title ||
        classData.class_name ||
        String(classId);

      // Add period and subject info for timetable entries
      if (routePeriodName && classData.subject_title) {
        title += ` - ${routePeriodName} (${classData.subject_title})`;
      } else if (routePeriod && classData.subject_title) {
        title += ` - ${classData.subject_title}`;
      }

      setClassTitle(title);
      console.log('✅ [Mobile] Using class title from classData:', title, 'period:', routePeriod);

      // 1) Load class info to get education_stage_id (only if needed for events)
      try {
        const classResult = await attendanceApiService.getClassInfo(String(classId));
        if (classResult.success && classResult.data) {
          const cls = classResult.data;

          // Get education_stage_id from education_grade
          if (cls.education_grade) {
            const gradeResult = await attendanceApiService.getEducationStage(cls.education_grade);
            if (gradeResult.success && gradeResult.data?.education_stage_id) {
              setEducationStageId(gradeResult.data.education_stage_id);
            }
          }
        }
      } catch (err) {
        console.error('❌ [Mobile] Failed to fetch class info:', err);
      }

      // 2) Get student IDs from class
      const studentsResult = await attendanceApiService.getClassStudents(String(classId), 1, 1000);
      if (!studentsResult.success || !studentsResult.data) {
        console.log('⚠️ [Mobile] No students in class');
        setStudents([]);
        setStatusMap({});
        setEventStatuses({});
        setLeaveStatuses({});
        setCheckInOutTimes({});
        return;
      }
      const studentIds = studentsResult.data;

      if (studentIds.length === 0) {
        console.log('⚠️ [Mobile] No students in class');
        setStudents([]);
        setStatusMap({});
        setEventStatuses({});
        setLeaveStatuses({});
        setCheckInOutTimes({});
        return;
      }

      console.log('🔍 [Mobile] Using batch_get_students for', studentIds.length, 'students');

      // 3) Batch fetch all students at once (aligned with web)
      const batchStudentsResult = await attendanceApiService.getBatchStudents(studentIds);
      if (!batchStudentsResult.success || !batchStudentsResult.data) {
        console.error('❌ [Mobile] Failed to fetch student details');
        setStudents([]);
        setStatusMap({});
        setEventStatuses({});
        setLeaveStatuses({});
        setCheckInOutTimes({});
        return;
      }
      const students = batchStudentsResult.data;

      console.log('✅ [Mobile] Got', students.length, 'students from batch API');
      setStudents(students);

      // 4) Load saved attendance statuses - using class attendance API
      const p = period || '1';
      const attendanceResult = await attendanceApiService.getClassAttendance(
        String(classId),
        today,
        p
      );
      console.log('🔍 [Mobile] getClassAttendance result:', {
        success: attendanceResult.success,
        dataLength: attendanceResult.data ? attendanceResult.data.length : 'no data',
        error: attendanceResult.error,
        sampleData: attendanceResult.data ? attendanceResult.data[0] : 'no sample',
      });

      if (attendanceResult.success && attendanceResult.data) {
        const statusMapData: Record<string, AttendanceStatus> = {};

        attendanceResult.data.forEach((attendanceRecord: any) => {
          const studentId = attendanceRecord.student_id;
          const status = attendanceRecord.status;
          console.log(`🔍 [Mobile] Student ${studentId} status:`, status);

          if (studentId && status) {
            statusMapData[studentId] = (status as AttendanceStatus) || 'present';
          }
        });

        console.log('✅ [Mobile] Final statusMap:', statusMapData);
        setStatusMap(statusMapData);
      } else {
        console.log('❌ [Mobile] getClassAttendance failed:', attendanceResult.error);
        setStatusMap({});
      }

      // 5) Load check-in/check-out times using students day map API
      if (students.length > 0) {
        const studentCodes = students.map((s) => s.student_code).filter(Boolean);
        console.log('🔍 [Mobile] Getting check-in/out times for student codes:', studentCodes);

        const dayMapResult = await attendanceApiService.getStudentsDayMap(studentCodes, today);
        console.log('🔍 [Mobile] getStudentsDayMap result:', {
          success: dayMapResult.success,
          dataKeys: dayMapResult.data ? Object.keys(dayMapResult.data) : 'no data',
          error: dayMapResult.error,
          sampleData: dayMapResult.data ? Object.values(dayMapResult.data)[0] : 'no sample',
        });

        if (dayMapResult.success && dayMapResult.data) {
          const checkInOutData: Record<string, { checkInTime?: string; checkOutTime?: string }> =
            {};

          Object.entries(dayMapResult.data).forEach(
            ([studentCode, attendanceData]: [string, any]) => {
              console.log(`🔍 [Mobile] Student ${studentCode} check-in/out data:`, attendanceData);

              // Find student by code to get student ID
              const student = students.find((s) => s.student_code === studentCode);
              if (!student) {
                console.log(`⚠️ [Mobile] No student found for code: ${studentCode}`);
                return;
              }

              // Extract check-in/check-out times
              const checkInTime = attendanceData?.checkInTime;
              const checkOutTime = attendanceData?.checkOutTime;

              console.log(`🔍 [Mobile] Student ${studentCode} (${student.name}) times:`, {
                checkInTime,
                checkOutTime,
              });

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

          console.log('✅ [Mobile] Final checkInOutTimes:', checkInOutData);
          setCheckInOutTimes(checkInOutData);
        } else {
          console.log('❌ [Mobile] getStudentsDayMap failed:', dayMapResult.error);
          setCheckInOutTimes({});
        }
      } else {
        setCheckInOutTimes({});
      }

      // 5) Load event attendance statuses (aligned with web)
      if (educationStageId) {
        try {
          const eventStatusesResult = await attendanceApiService.getEventAttendanceStatuses(
            String(classId),
            today,
            p,
            educationStageId
          );
          if (eventStatusesResult.success && eventStatusesResult.data) {
            setEventStatuses(eventStatusesResult.data);
          } else {
            setEventStatuses({});
          }

          // Also load event list for remarks
          const eventsResult = await attendanceApiService.getEventsByClassPeriod(
            String(classId),
            today,
            p,
            educationStageId
          );
          if (eventsResult.success && eventsResult.data) {
            setEvents(eventsResult.data);
          } else {
            setEvents([]);
          }
        } catch (e) {
          console.warn('⚠️ [Mobile] Failed to load event statuses:', e);
          setEventStatuses({});
          setEvents([]);
        }
      }

      // 6) Load active leaves
      try {
        const leavesResult = await attendanceApiService.getActiveLeaves(String(classId), today);
        if (leavesResult.success && leavesResult.data) {
          // Convert leaves to attendance statuses (excused)
          const leaveMap: Record<string, AttendanceStatus> = {};
          Object.keys(leavesResult.data).forEach((studentId) => {
            leaveMap[studentId] = 'excused';
          });
          setLeaveStatuses(leaveMap);
        } else {
          setLeaveStatuses({});
        }
      } catch (e) {
        console.warn('⚠️ [Mobile] Failed to load leaves:', e);
        setLeaveStatuses({});
      }

      console.log('✅ [Mobile] AttendanceDetail: All data loaded');
    } catch (e) {
      console.error('❌ [Mobile] AttendanceDetail error:', e);
      setStudents([]);
      setStatusMap({});
      setEventStatuses({});
      setLeaveStatuses({});
      setCheckInOutTimes({});
    } finally {
      setLoading(false);
    }
  }, [classId, mode, classData, today, period]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (classData) {
      fetchStudents();
    }
  }, [classData, fetchStudents]);

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

  // Compute final status: Priority = Event > Leave > Manual > Default
  const getFinalStatus = (studentId: string): AttendanceStatus => {
    return (
      eventStatuses[studentId] || leaveStatuses[studentId] || statusMap[studentId] || 'present'
    );
  };

  const hasOverrideStatus = (studentId: string): boolean => {
    return !!(eventStatuses[studentId] || leaveStatuses[studentId]);
  };

  const getOverrideBadge = (studentId: string): string | null => {
    if (eventStatuses[studentId]) return 'Sự kiện';
    if (leaveStatuses[studentId]) return 'Nghỉ phép';
    return null;
  };

  const setStatus = (id: string, status: AttendanceStatus) => {
    // Don't allow manual override if event/leave status exists
    if (hasOverrideStatus(id)) return;
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  };

  const handleSave = async () => {
    console.log('🔄 [Mobile] handleSave: Starting save process');
    setSaving(true);
    try {
      // Always save ALL students, not just filtered ones
      const items = sortedStudents.map((s) => {
        const studentId = s.name;
        const finalStatus = getFinalStatus(studentId);

        // Generate remarks based on status source (aligned with web)
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
        } else if (leaveStatus) {
          remarks = `Nghỉ phép`;
        }

        return {
          student_id: studentId,
          student_code: s.student_code,
          student_name: s.student_name,
          class_id: String(classId),
          date: today,
          period: period || '1',
          status: finalStatus,
          remarks,
        };
      });

      console.log('📤 [Mobile] handleSave: Prepared', items.length, 'items to save');
      console.log('📤 [Mobile] handleSave: Sample item:', items[0]);

      const saveResult = await attendanceApiService.saveClassAttendance(items, true);
      console.log('📥 [Mobile] handleSave: Save result:', saveResult);

      if (saveResult.success) {
        console.log('✅ [Mobile] handleSave: Save successful');
        Alert.alert('Thành công', 'Đã lưu điểm danh');
        nav.goBack();
      } else {
        console.log('❌ [Mobile] handleSave: Save failed:', saveResult.error);
        Alert.alert('Lỗi', saveResult.error || 'Không thể lưu điểm danh');
      }
    } catch (error) {
      console.error('❌ [Mobile] handleSave: Exception:', error);
      Alert.alert('Lỗi', 'Không thể lưu điểm danh');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 py-3">
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#0A2240" />
        </TouchableOpacity>
        <Text className="font-bold text-2xl text-[#0A2240]">Điểm danh</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#009483" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-bold text-xl text-[#0A2240]">
              {classTitle || String(classId)}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className={`rounded-2xl ${saving ? 'bg-[#D1D5DB]' : 'bg-[#3F4246]'} px-4 py-2`}>
              <Text className="font-semibold text-white">
                {saving ? 'Đang lưu...' : 'Cập nhật'}
              </Text>
            </TouchableOpacity>
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
          {searchQuery && (
            <Text className="mb-3 text-sm text-gray-600">
              Hiển thị {filteredStudents.length}/{sortedStudents.length} học sinh
            </Text>
          )}

          <View className="flex justify-between">
            {filteredStudents.map((s, index) => {
              const studentId = s.name;
              const finalStatus = getFinalStatus(studentId);
              const hasOverride = hasOverrideStatus(studentId);
              const badge = getOverrideBadge(studentId);
              const dimmed = finalStatus === 'excused' ? 0.6 : 1;

              return (
                <View
                  key={`${studentId}-${s.student_code || 'no-code'}-${index}`}
                  className="mx-auto mb-3 w-full rounded-2xl"
                  style={{ backgroundColor: cardBgByStatus[finalStatus], opacity: dimmed }}>
                  <View className="mb-2 flex-row items-start gap-4 p-4">
                    <View className="shrink-0">
                      <StudentAvatar
                        name={s.student_name}
                        avatarUrl={
                          (s as any).user_image || (s as any).avatar_url || (s as any).photo
                        }
                        size={100}
                      />
                    </View>
                    <View className="flex-1">
                      <View className="mb-2">
                        <Text className="font-semibold text-xl text-[#000]">{s.student_name}</Text>
                      </View>
                      <View className="mb-6 flex-row items-center gap-2">
                        <Text className="text-base text-[#757575]">{statusLabel[finalStatus]}</Text>
                        {badge && (
                          <View className="rounded bg-white/60 px-2 py-0.5">
                            <Text className="text-xs text-[#757575]">{badge}</Text>
                          </View>
                        )}
                      </View>
                      {/* Check-in/Check-out times */}
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="log-in-outline" size={24} color="#757575" />
                          <Text className="font-medium text-base text-[#757575]">
                            {checkInOutTimes[studentId]?.checkInTime || '--:--'}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="log-in-outline" size={24} color="#757575" />
                          <Text className="font-medium text-base text-[#757575]">
                            {checkInOutTimes[studentId]?.checkOutTime || '--:--'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  {/* Attendance buttons at the bottom */}
                  <View className="flex-row justify-center">
                    <TouchableOpacity
                      onPress={() => setStatus(studentId, 'present')}
                      disabled={hasOverride && eventStatuses[studentId] !== 'present'}
                      style={{
                        flex: 1,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: finalStatus === 'present' ? '#3DB838' : '#EBEBEB',
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        borderBottomLeftRadius: 12,
                        borderBottomRightRadius: 0,
                        opacity: hasOverride && eventStatuses[studentId] !== 'present' ? 0.5 : 1,
                      }}>
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={finalStatus === 'present' ? '#fff' : '#3F4246'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setStatus(studentId, 'absent')}
                      disabled={hasOverride && eventStatuses[studentId] !== 'absent'}
                      style={{
                        flex: 1,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: finalStatus === 'absent' ? '#DC0909' : '#EBEBEB',
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                        opacity: hasOverride && eventStatuses[studentId] !== 'absent' ? 0.5 : 1,
                      }}>
                      <Ionicons
                        name="close"
                        size={20}
                        color={finalStatus === 'absent' ? '#fff' : '#3F4246'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setStatus(studentId, 'late')}
                      disabled={hasOverride && eventStatuses[studentId] !== 'late'}
                      style={{
                        flex: 1,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: finalStatus === 'late' ? '#F5AA1E' : '#EBEBEB',
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                        opacity: hasOverride && eventStatuses[studentId] !== 'late' ? 0.5 : 1,
                      }}>
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={finalStatus === 'late' ? '#fff' : '#3F4246'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setStatus(studentId, 'excused')}
                      disabled={hasOverride && eventStatuses[studentId] !== 'excused'}
                      style={{
                        flex: 1,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: finalStatus === 'excused' ? '#3F4246' : '#EBEBEB',
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 12,
                        opacity: hasOverride && eventStatuses[studentId] !== 'excused' ? 0.5 : 1,
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
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default AttendanceDetail;
