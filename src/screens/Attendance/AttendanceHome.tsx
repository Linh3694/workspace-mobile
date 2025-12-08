// @ts-nocheck
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { attendanceApiService } from '../../services/attendanceApiService';
import { TouchableOpacity } from '../../components/Common';

// Helper function to format time from HH:MM:SS to HH:MM
const formatTime = (time: string | undefined): string => {
  if (!time) return '';
  // If time has seconds (HH:MM:SS), remove them
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return time;
};

const AttendanceHome = () => {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  // Get initial tab from route params (for deep link from notification)
  const initialTab = route.params?.initialTab as 'GVCN' | 'GVBM' | undefined;

  // Date state
  const [currentDate, setCurrentDate] = useState(new Date());
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

  const dayName = days[currentDate.getDay()];
  const dayNum = currentDate.getDate();
  const monthNum = currentDate.getMonth() + 1;

  // API data state
  const [classesData, setClassesData] = useState<{
    homeroom_classes: any[];
    teaching_classes: any[];
  } | null>(null);
  const [timetableData, setTimetableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Attendance stats for each class
  const [classStats, setClassStats] = useState<
    Record<
      string,
      {
        checkInCount: number;
        attendanceCount: number;
        checkOutCount: number;
        totalStudents: number;
        hasAttendance: boolean;
      }
    >
  >({});

  const goPrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  // Tabs - use initialTab from route params if provided
  const [tab, setTab] = useState<'GVCN' | 'GVBM'>(initialTab || 'GVCN');

  // API Functions using service
  const fetchHomeroomClasses = useCallback(async () => {
    if (!user?.email) return;

    const result = await attendanceApiService.fetchTeacherClasses(user.email);
    if (result.success && result.data) {
      setClassesData(result.data);
    } else {
      console.error('Failed to fetch homeroom classes:', result.error);
    }
  }, [user?.email]);

  const fetchTimetableClasses = useCallback(async () => {
    if (!user?.email) return;

    // Calculate week range using service helper
    const { weekStart, weekEnd } = attendanceApiService.calculateWeekRange(currentDate);

    // Use GVBM-specific endpoint for "Theo tiết" tab
    const result = await attendanceApiService.fetchTeacherTimetableGvbm(
      user.email,
      weekStart,
      weekEnd
    );
    if (result.success && result.data) {
      const entries = result.data.entries || [];

      if (entries.length > 0) {
        const sample = entries[0];
      }

      setTimetableData(entries);
    } else {
      console.error('Failed to fetch GVBM timetable classes:', result.error);
      setTimetableData([]);
    }
  }, [user?.email, currentDate]);

  const fetchClassStats = useCallback(
    async (classes: any[], isTimetable: boolean = false) => {
      if (!classes || classes.length === 0) return;

      const currentDateStr = currentDate.toISOString().split('T')[0];
      const newStats: Record<
        string,
        {
          checkInCount: number;
          attendanceCount: number;
          checkOutCount: number;
          totalStudents: number;
          hasAttendance: boolean;
        }
      > = {};

      // Process each class/timetable entry concurrently for better performance
      const promises = classes.map(async (classData) => {
        // Handle both ClassData (homeroom) and TimetableEntry (teaching)
        // For timetable entries, use class_id; for homeroom, use name
        const isTimetableEntry = classData.timetable_column_id !== undefined;
        const actualClassId = isTimetableEntry ? classData.class_id : (classData.class_id || classData.name);
        
        if (!actualClassId) {
          return;
        }

        // Use unique key for stats: for timetable entries, combine class_id and timetable_column_id
        const statsKey = isTimetableEntry 
          ? `${actualClassId}_${classData.timetable_column_id}` 
          : actualClassId;

        // Determine period for attendance query
        const period = isTimetableEntry ? classData.timetable_column_id : 'homeroom';

        try {
          console.log(`🔍 [Home Stats] Fetching stats for class ${actualClassId}, period: ${period}, statsKey: ${statsKey}`);
          
          // 1. Get students in class
          const studentsResult = await attendanceApiService.getClassStudents(actualClassId, 1, 1000);

          const studentIds =
            studentsResult.success && studentsResult.data ? studentsResult.data : [];

          // 2. Get detailed student info to get student_codes
          let studentCodes: string[] = [];
          if (studentIds.length > 0) {
            const batchStudentsResult = await attendanceApiService.getBatchStudents(studentIds);
            if (batchStudentsResult.success && batchStudentsResult.data) {
              studentCodes = batchStudentsResult.data
                .map((student: any) => student.student_code)
                .filter(Boolean);
            }
          }

          // 3. Get attendance data with correct period
          const attendanceResult = await attendanceApiService.getClassAttendance(
            actualClassId,
            currentDateStr,
            period
          );
          const attendanceRecords =
            attendanceResult.success && attendanceResult.data ? attendanceResult.data : [];
          
          console.log(`🔍 [Home Stats] Attendance result for ${statsKey}: ${attendanceRecords.length} records, hasAttendance: ${attendanceRecords.length > 0}`);

          // 4. Get check-in/check-out data (only for homeroom)
          let checkInOutData: Record<string, any> = {};
          if (!isTimetableEntry && studentCodes.length > 0) {
            const dayMapResult = await attendanceApiService.getStudentsDayMap(
              studentCodes,
              currentDateStr
            );

            if (dayMapResult.success && dayMapResult.data) {
              checkInOutData = dayMapResult.data;
            }
          }

          // 5. Calculate stats
          const totalStudents = studentIds.length;
          // Only count attendance records for students currently in class
          // This prevents showing 21/17 when some students have left the class
          const validAttendanceRecords = attendanceRecords.filter(
            (record: any) => studentIds.includes(record.student_id)
          );
          const attendanceCount = validAttendanceRecords.length;
          const hasAttendance = attendanceCount > 0;

          let checkInCount = 0;
          let checkOutCount = 0;

          // Count check-ins and check-outs from physical attendance data
          Object.entries(checkInOutData).forEach(([studentCode, data]: [string, any]) => {
            if (data.checkInTime) checkInCount++;
            if (data.checkOutTime) checkOutCount++;
          });

          newStats[statsKey] = {
            checkInCount,
            attendanceCount,
            checkOutCount,
            totalStudents,
            hasAttendance,
          };
        } catch (error) {
          console.error(`Failed to fetch stats for class ${actualClassId}:`, error);
          // Set default stats
          newStats[statsKey] = {
            checkInCount: 0,
            attendanceCount: 0,
            checkOutCount: 0,
            totalStudents: 0,
            hasAttendance: false,
          };
        }
      });

      await Promise.all(promises);
      setClassStats((prev) => ({ ...prev, ...newStats }));
    },
    [currentDate]
  );

  // Fetch data on component mount and when currentDate changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchHomeroomClasses(), fetchTimetableClasses()]);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) {
      fetchData();
    }
  }, [user?.email, currentDate, fetchHomeroomClasses, fetchTimetableClasses]);

  // Fetch stats after classes data is loaded
  useEffect(() => {
    if (!loading) {
      // Fetch stats for homeroom classes
      if (classesData) {
        const homeroomClasses = [
          ...(classesData.homeroom_classes || []),
          ...(classesData.teaching_classes || []),
        ];
        if (homeroomClasses.length > 0) {
          fetchClassStats(homeroomClasses, false);
        }
      }
      // Fetch stats for timetable entries (GVBM)
      const currentDateStr = currentDate.toISOString().split('T')[0];
      const todayTimetable = attendanceApiService.getTimetableEntriesForDate(timetableData, currentDateStr);
      if (todayTimetable.length > 0) {
        fetchClassStats(todayTimetable, true);
      }
    }
  }, [classesData, timetableData, loading, fetchClassStats, currentDate]);

  // Quick check hasAttendance using new API (no cache)
  const refreshHasAttendanceFlags = useCallback(async () => {
    const currentDateStr = currentDate.toISOString().split('T')[0];
    const items: { class_id: string; date: string; period: string }[] = [];
    
    // Add homeroom classes
    if (classesData) {
      const homeroomClasses = [
        ...(classesData.homeroom_classes || []),
        ...(classesData.teaching_classes || []),
      ];
      homeroomClasses.forEach((cls) => {
        const classId = cls.class_id || cls.name;
        if (classId) {
          items.push({ class_id: classId, date: currentDateStr, period: 'homeroom' });
        }
      });
    }
    
    // Add timetable entries
    const todayTimetable = attendanceApiService.getTimetableEntriesForDate(timetableData, currentDateStr);
    todayTimetable.forEach((entry) => {
      if (entry.class_id && entry.timetable_column_id) {
        items.push({ 
          class_id: entry.class_id, 
          date: currentDateStr, 
          period: entry.timetable_column_id 
        });
      }
    });
    
    if (items.length === 0) return;
    
    console.log('🔄 [Home] Checking hasAttendance for', items.length, 'items');
    const result = await attendanceApiService.batchCheckHasAttendance(items);
    
    if (result.success && result.data) {
      console.log('✅ [Home] hasAttendance results:', result.data);
      // Update classStats with hasAttendance flags
      setClassStats((prev) => {
        const updated = { ...prev };
        Object.entries(result.data).forEach(([key, value]) => {
          if (updated[key]) {
            updated[key] = { ...updated[key], hasAttendance: value.has_attendance };
          } else {
            updated[key] = {
              checkInCount: 0,
              attendanceCount: value.count,
              checkOutCount: 0,
              totalStudents: 0,
              hasAttendance: value.has_attendance,
            };
          }
        });
        return updated;
      });
    }
  }, [currentDate, classesData, timetableData]);

  // Refresh stats when screen comes back into focus (after editing attendance)
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 [Home] useFocusEffect triggered, loading:', loading);
      
      // Always refresh hasAttendance flags (quick check, no cache)
      refreshHasAttendanceFlags();
      
      if (!loading) {
        // Refresh full stats for homeroom classes (for check-in/out counts)
        if (classesData) {
          const homeroomClasses = [
            ...(classesData.homeroom_classes || []),
            ...(classesData.teaching_classes || []),
          ];
          if (homeroomClasses.length > 0) {
            fetchClassStats(homeroomClasses, false);
          }
        }
        // Refresh full stats for timetable entries (GVBM)
        const currentDateStr = currentDate.toISOString().split('T')[0];
        const todayTimetable = attendanceApiService.getTimetableEntriesForDate(timetableData, currentDateStr);
        if (todayTimetable.length > 0) {
          fetchClassStats(todayTimetable, true);
        }
      }
    }, [classesData, timetableData, loading, fetchClassStats, currentDate, refreshHasAttendanceFlags])
  );

  // Filter classes based on selected tab
  const displayedClasses = useMemo(() => {
    if (tab === 'GVCN') {
      // Show homeroom classes
      return classesData?.homeroom_classes || [];
    } else {
      // Show timetable entries for current day (each entry represents a period)
      const currentDateStr = currentDate.toISOString().split('T')[0];
      return attendanceApiService.getTimetableEntriesForDate(timetableData, currentDateStr);
    }
  }, [tab, classesData, timetableData, currentDate]);

  const ClassCard = ({ classData, stats }: { classData: any; stats?: any }) => {
    // Handle both ClassData (homeroom) and TimetableEntry (teaching)
    const isTimetableEntry = classData.timetable_column_id !== undefined;
    const title =
      classData.title ||
      classData.class_title ||
      classData.short_title ||
      classData.name ||
      'Unknown Class';
    const periodId = isTimetableEntry ? classData.timetable_column_id : null;
    const periodName = isTimetableEntry ? classData.period_name : null;
    const periodTime =
      isTimetableEntry && classData.start_time && classData.end_time
        ? `${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`
        : null;
    const subject = isTimetableEntry ? classData.subject_title : null;
    const room = isTimetableEntry ? classData.room_name : null;
    const hasAttendance = stats?.hasAttendance || false;

    return (
      <View
        style={{
          backgroundColor: '#F6F6F6',
          padding: 16,
          borderRadius: 16,
        }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 10 }}>{title}</Text>

        {isTimetableEntry && (subject || true) && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 24,
              marginTop: 12,
            }}>
            {/* Môn học - Bên trái */}
            <View style={{ alignItems: 'flex-start', flex: 1 }}>
              <Ionicons name="book-outline" size={24} color="#666" />
              <Text style={{ fontSize: 12, color: '#666', marginTop: 4, textAlign: 'left' }}>
                {subject || 'Chưa có môn'}
              </Text>
            </View>

            {/* Phòng học - Bên phải */}
            <View style={{ alignItems: 'flex-start', flex: 1 }}>
              <Ionicons name="location-outline" size={24} color="#666" />
              <Text style={{ fontSize: 12, color: '#666', marginTop: 4, textAlign: 'left' }}>
                {room || 'Chưa có phòng'}
              </Text>
            </View>
          </View>
        )}

        {tab === 'GVCN' && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 24,
              marginTop: 12,
            }}>
            <View style={{ alignItems: 'flex-start' }}>
              <Ionicons name="log-in-outline" size={22} color="#444" />
              <Text style={{ marginTop: 8, fontSize: 13 }}>
                {stats?.checkInCount || 0}/{stats?.totalStudents || 0} học sinh
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#444" />
              <Text style={{ marginTop: 8, fontSize: 13 }}>
                {stats?.attendanceCount || 0}/{stats?.totalStudents || 0} học sinh
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Ionicons name="log-out-outline" size={22} color="#444" />
              <Text style={{ marginTop: 8, fontSize: 13 }}>
                {stats?.checkOutCount || 0}/{stats?.totalStudents || 0} học sinh
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: hasAttendance ? '#FFFFFF' : '#333333',
            borderWidth: hasAttendance ? 1 : 0,
            borderColor: hasAttendance ? '#E5E7EB' : 'transparent',
            paddingVertical: 12,
            borderRadius: 30,
          }}
          onPress={() =>
            nav.navigate(ROUTES.SCREENS.ATTENDANCE_DETAIL, {
              classData,
              // Pass period info for timetable entries
              period: isTimetableEntry ? periodId : undefined,
              periodName: isTimetableEntry ? periodName : undefined,
              // Pass selected date
              selectedDate: currentDate.toISOString().split('T')[0],
            })
          }>
          <Text
            style={{
              color: hasAttendance ? '#333333' : 'white',
              textAlign: 'center',
              fontSize: 15,
              fontWeight: '600',
            }}>
            {hasAttendance ? 'Chỉnh sửa' : 'Điểm danh'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity onPress={() => nav.goBack()} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={26} color="#222" />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '600', color: '#002855', fontFamily: 'Mulish-Bold' }}>
            Điểm danh
          </Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Date selector */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
          }}>
          <TouchableOpacity onPress={goPrev} style={{ padding: 10 }}>
            <Ionicons name="chevron-back" size={22} color="#444" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginHorizontal: 20 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#e14a1e' }}>{dayName}</Text>
            <Text style={{ marginTop: 2, fontSize: 14, color: '#666' }}>
              {dayNum} tháng {monthNum}
            </Text>
          </View>

          <TouchableOpacity onPress={goNext} style={{ padding: 10 }}>
            <Ionicons name="chevron-forward" size={22} color="#444" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', marginBottom: 20 }}>
          <TouchableOpacity
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}
            onPress={() => setTab('GVCN')}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: tab === 'GVCN' ? '700' : '500',
                color: tab === 'GVCN' ? '#002855' : '#7A7A7A',
              }}>
              Chủ nhiệm
            </Text>
            {tab === 'GVCN' && (
              <View style={{ height: 2, width: 40, backgroundColor: '#002855', marginTop: 6 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}
            onPress={() => setTab('GVBM')}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: tab === 'GVBM' ? '700' : '500',
                color: tab === 'GVBM' ? '#002855' : '#7A7A7A',
              }}>
              Theo tiết
            </Text>
            {tab === 'GVBM' && (
              <View style={{ height: 2, width: 40, backgroundColor: '#002855', marginTop: 6 }} />
            )}
          </TouchableOpacity>
        </View>

        {/* Class list */}
        {loading ? (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Text style={{ color: '#666' }}>Đang tải...</Text>
          </View>
        ) : displayedClasses.length > 0 ? (
          displayedClasses.map((classData, index) => {
            // For timetable entries, use class_id as key; for homeroom, use name
            const isTimetableEntry = classData.timetable_column_id !== undefined;
            const classId = isTimetableEntry ? classData.class_id : classData.name;
            // Use unique stats key: for timetable entries, combine class_id and timetable_column_id
            const statsKey = isTimetableEntry ? `${classId}_${classData.timetable_column_id}` : classId;
            const stats = classStats[statsKey];

            // Calculate period info for display
            const periodName = isTimetableEntry ? classData.period_name : null;
            const periodTime =
              isTimetableEntry && classData.start_time && classData.end_time
                ? `${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`
                : null;

            return (
              <View
                key={`container-${classData.timetable_column_id !== undefined ? `GVBM-${classData.timetable_column_id}-${classId}` : `GVCN-${classId}`}`}
                style={{ marginBottom: 16 }}>
                {isTimetableEntry && periodName && (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#002855' }}>
                      {periodName}
                    </Text>
                    {periodTime && (
                      <Text style={{ fontSize: 14, color: '#666' }}>{periodTime}</Text>
                    )}
                  </View>
                )}
                <ClassCard
                  key={
                    classData.timetable_column_id !== undefined
                      ? `GVBM-${classData.timetable_column_id}-${classId}`
                      : `GVCN-${classId}`
                  }
                  classData={classData}
                  stats={stats}
                />
              </View>
            );
          })
        ) : (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Text style={{ color: '#666' }}>
              {tab === 'GVCN' ? 'Không có lớp chủ nhiệm' : 'Không có tiết học nào trong ngày này'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AttendanceHome;
