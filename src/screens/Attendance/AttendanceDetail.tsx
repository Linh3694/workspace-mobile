// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StudentAvatar } from '../../utils/studentAvatar';
import { getApiBaseUrl, API_BASE_URL } from '../../config/constants';
import attendanceService from '../../services/attendanceService';

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
  const { classId, mode } = route.params as { classId: string; mode: 'GVCN' | 'GVBM' };

  const [students, setStudents] = useState<any[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [eventStatuses, setEventStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [leaveStatuses, setLeaveStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [events, setEvents] = useState<
    { eventId: string; eventTitle: string; studentIds: string[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classTitle, setClassTitle] = useState<string>('');
  const [educationStageId, setEducationStageId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const apiBase = getApiBaseUrl();

  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const period = mode === 'GVCN' ? 'GVCN' : undefined; // GVBM: sẽ chọn theo tiết sau (roadmap)

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      console.log('🔄 [Mobile] AttendanceDetail: Loading data for class', classId);

      // 1) Load class info to get title and education_stage_id
      let schoolYearId: string | undefined;
      try {
        const classRes = await fetch(
          `${apiBase}/api/method/erp.api.erp_sis.sis_class.get_class?name=${encodeURIComponent(String(classId))}`,
          { headers }
        );
        const classData = await classRes.json();
        console.log('📋 [Mobile] Class data:', JSON.stringify(classData).substring(0, 500));

        if (classData?.message?.data || classData?.data) {
          const cls = classData.message?.data || classData.data;
          console.log('📋 [Mobile] Class fields:', {
            name: cls.name,
            title: cls.title,
            short_title: cls.short_title,
            class_name: cls.class_name,
            education_grade: cls.education_grade,
          });

          // Priority: short_title > title > class_name > formatted ID
          const title =
            cls.short_title ||
            cls.title ||
            cls.class_name ||
            String(classId)
              .replace(/^SIS-CLASS-/, '')
              .replace(/^CLASS-/, '');
          console.log('✅ [Mobile] Using class title:', title);
          setClassTitle(title);
          schoolYearId = String(cls.school_year_id || '');

          // Get education_stage_id from education_grade
          if (cls.education_grade) {
            try {
              const gradeRes = await fetch(
                `${apiBase}/api/method/erp.api.erp_sis.event_class_attendance.get_education_stage?name=${encodeURIComponent(cls.education_grade)}`,
                { headers }
              );
              const gradeData = await gradeRes.json();
              if (
                gradeData?.message?.data?.education_stage_id ||
                gradeData?.data?.education_stage_id
              ) {
                setEducationStageId(
                  gradeData.message?.data?.education_stage_id || gradeData.data?.education_stage_id
                );
              }
            } catch {
              // Silent fail
            }
          }
        }
      } catch (err) {
        console.error('❌ [Mobile] Failed to fetch class info:', err);
        // Fallback: try to get from cached class list
        try {
          const classes = await attendanceService.getAllClassesForCurrentCampus();
          const hit = Array.isArray(classes)
            ? classes.find((c: any) => String(c?.name) === String(classId))
            : null;
          if (hit) {
            const title =
              hit.short_title ||
              hit.title ||
              hit.class_name ||
              String(classId)
                .replace(/^SIS-CLASS-/, '')
                .replace(/^CLASS-/, '');
            setClassTitle(title);
            schoolYearId = String(hit.school_year_id || '');
          }
        } catch {}
      }

      // 2) Get student IDs from class
      const qs = new URLSearchParams({ page: '1', limit: '1000', class_id: String(classId) });
      const csRes = await fetch(
        `${apiBase}/api/method/erp.api.erp_sis.class_student.get_all_class_students?${qs.toString()}`,
        { headers }
      );
      const csData = await csRes.json();
      const studentIds = (csData?.data?.data || csData?.message?.data || [])
        .map((r: any) => r.student_id)
        .filter(Boolean);

      if (studentIds.length === 0) {
        console.log('⚠️ [Mobile] No students in class');
        setStudents([]);
        setStatusMap({});
        setEventStatuses({});
        setLeaveStatuses({});
        return;
      }

      console.log('🔍 [Mobile] Using batch_get_students for', studentIds.length, 'students');

      // 3) Batch fetch all students at once (aligned with web)
      const stuRes = await fetch(
        `${apiBase}/api/method/erp.api.erp_sis.student.batch_get_students`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ student_ids: studentIds }),
        }
      );
      const stuData = await stuRes.json();
      const students = (stuData?.message?.data || stuData?.data || []) as any[];

      console.log('✅ [Mobile] Got', students.length, 'students from batch API');
      setStudents(students);

      // 4) Load saved attendance statuses - using batch API
      const p = period || '1';
      const attRes = await fetch(
        `${apiBase}/api/method/erp.api.erp_sis.attendance.batch_get_class_attendance`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            class_id: String(classId),
            date: today,
            periods: [p],
          }),
        }
      );
      const attData = await attRes.json();
      const batchData = attData?.message?.data || attData?.data || {};
      const list = batchData[p] || [];

      const map: Record<string, AttendanceStatus> = {};
      (list || []).forEach((i: any) => {
        if (i.student_id && i.status)
          map[i.student_id] = (i.status as AttendanceStatus) || 'present';
      });
      setStatusMap(map);

      // 5) Load event attendance statuses (aligned with web)
      if (educationStageId) {
        try {
          const eventRes = await fetch(
            `${apiBase}/api/method/erp.api.erp_sis.event_class_attendance.get_event_attendance_statuses?` +
              new URLSearchParams({
                class_id: String(classId),
                date: today,
                period: p,
                education_stage_id: educationStageId,
              }),
            { headers }
          );
          const eventData = await eventRes.json();
          const evStatuses = (eventData?.message?.data || eventData?.data || {}) as Record<
            string,
            AttendanceStatus
          >;
          setEventStatuses(evStatuses);

          // Also load event list for remarks
          const eventsListRes = await fetch(
            `${apiBase}/api/method/erp.api.erp_sis.event_class_attendance.get_events_by_class_period?` +
              new URLSearchParams({
                class_id: String(classId),
                date: today,
                period: p,
                education_stage_id: educationStageId,
              }),
            { headers }
          );
          const eventsListData = await eventsListRes.json();
          const eventsList = (eventsListData?.message?.data || eventsListData?.data || []) as {
            eventId: string;
            eventTitle: string;
            studentIds: string[];
          }[];
          setEvents(eventsList);
        } catch (e) {
          console.warn('⚠️ [Mobile] Failed to load event statuses:', e);
          setEventStatuses({});
          setEvents([]);
        }
      }

      // 6) Load active leaves
      try {
        const leaveRes = await fetch(
          `${apiBase}/api/method/erp.api.erp_sis.leave.batch_get_active_leaves`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              class_id: String(classId),
              date: today,
            }),
          }
        );
        const leaveData = await leaveRes.json();
        const leaves = (leaveData?.message?.data || leaveData?.data || {}) as Record<string, any>;

        // Convert leaves to attendance statuses (excused)
        const leaveMap: Record<string, AttendanceStatus> = {};
        Object.keys(leaves).forEach((studentId) => {
          leaveMap[studentId] = 'excused';
        });
        setLeaveStatuses(leaveMap);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [classId, period, today, educationStageId]);

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
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

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

      const res = await fetch(
        `${apiBase}/api/method/erp.api.erp_sis.attendance.save_class_attendance`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ items, overwrite: true }),
        }
      );
      const result = await res.json();
      if (res.ok && (result?.success || result?.message)) {
        Alert.alert('Thành công', 'Đã lưu điểm danh');
        nav.goBack();
      } else {
        Alert.alert('Lỗi', result?.message || 'Không thể lưu điểm danh');
      }
    } catch (e) {
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
              Lớp {classTitle || String(classId)}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className={`rounded-md ${saving ? 'bg-[#D1D5DB]' : 'bg-[#3F4246]'} px-4 py-2`}>
              <Text className="font-semibold text-white">
                {saving ? 'Đang lưu...' : 'Cập nhật'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="mb-4 flex-row items-center rounded-lg bg-gray-100 px-3 py-2">
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
            {filteredStudents.map((s) => {
              const studentId = s.name;
              const finalStatus = getFinalStatus(studentId);
              const hasOverride = hasOverrideStatus(studentId);
              const badge = getOverrideBadge(studentId);
              const dimmed = finalStatus === 'excused' ? 0.6 : 1;

              return (
                <View
                  key={studentId}
                  className="mx-auto mb-3 w-[95%] rounded-2xl p-4"
                  style={{ backgroundColor: cardBgByStatus[finalStatus], opacity: dimmed }}>
                  <View className="flex-row items-start gap-4">
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
                      <View className="mb-1">
                        <Text className="font-semibold text-lg text-[#000]">{s.student_name}</Text>
                      </View>
                      <View className="mb-4 flex-row items-center gap-2">
                        <Text className="text-sm text-[#7A7A7A]">{statusLabel[finalStatus]}</Text>
                        {badge && (
                          <View className="rounded bg-white/60 px-2 py-0.5">
                            <Text className="text-xs text-[#3F4246]">{badge}</Text>
                          </View>
                        )}
                      </View>
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => setStatus(studentId, 'present')}
                          disabled={hasOverride && eventStatuses[studentId] !== 'present'}
                          style={{
                            width: 44,
                            height: 36,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: finalStatus === 'present' ? '#3DB838' : '#EBEBEB',
                            borderRadius: 6,
                            opacity:
                              hasOverride && eventStatuses[studentId] !== 'present' ? 0.5 : 1,
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
                            width: 44,
                            height: 36,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: finalStatus === 'absent' ? '#DC0909' : '#EBEBEB',
                            borderRadius: 6,
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
                            width: 44,
                            height: 36,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: finalStatus === 'late' ? '#F5AA1E' : '#EBEBEB',
                            borderRadius: 6,
                            opacity: hasOverride && eventStatuses[studentId] !== 'late' ? 0.5 : 1,
                          }}>
                          <Ionicons
                            name="time"
                            size={16}
                            color={finalStatus === 'late' ? '#fff' : '#3F4246'}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setStatus(studentId, 'excused')}
                          disabled={hasOverride && eventStatuses[studentId] !== 'excused'}
                          style={{
                            width: 44,
                            height: 36,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: finalStatus === 'excused' ? '#3F4246' : '#EBEBEB',
                            borderRadius: 6,
                            opacity:
                              hasOverride && eventStatuses[studentId] !== 'excused' ? 0.5 : 1,
                          }}>
                          <Ionicons
                            name="close-circle"
                            size={16}
                            color={finalStatus === 'excused' ? '#fff' : '#3F4246'}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
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
