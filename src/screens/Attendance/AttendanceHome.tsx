import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { attendanceApiService } from '../../services/attendanceApiService';

const AttendanceHome = () => {
  const nav = useNavigation<any>();
  const { user } = useAuth();

  // Date state
  const [currentDate, setCurrentDate] = useState(new Date());
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ tư', 'Thứ 5', 'Thứ sáu', 'Thứ bảy'];

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

  // Tabs
  const [tab, setTab] = useState<'GVCN' | 'GVBM'>('GVCN');

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
    console.log('🔍 [GVBM] API result:', result);
    if (result.success && result.data) {
      const entries = result.data.entries || [];
      console.log('🔍 [GVBM] Found', entries.length, 'timetable entries');

      if (entries.length > 0) {
        const sample = entries[0];
        console.log('🔍 [GVBM] Sample entry:', {
          timetable_column_id: sample.timetable_column_id,
          subject_title: sample.subject_title,
          class_title: sample.class_title,
          room_name: sample.room_name,
          education_stage_id: sample.education_stage_id,
          education_stage_title: sample.education_stage_title,
          date: sample.date,
          day_of_week: sample.day_of_week,
          allKeys: Object.keys(sample),
        });
      }

      setTimetableData(entries);
    } else {
      console.error('Failed to fetch GVBM timetable classes:', result.error);
      setTimetableData([]);
    }
  }, [user?.email, currentDate]);

  const fetchClassStats = useCallback(
    async (classes: any[]) => {
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
        const classId = classData.name || classData.class_id;
        if (!classId) {
          console.log('📊 [Stats] No classId found for classData:', classData);
          return;
        }

        console.log(
          `📊 [Stats] Processing class ${classId} (${classData.class_title || classData.title})`
        );

        try {
          // 1. Get students in class
          const studentsResult = await attendanceApiService.getClassStudents(classId, 1, 1000);

          const studentIds =
            studentsResult.success && studentsResult.data ? studentsResult.data : [];

          console.log(`📊 [Stats] Class ${classId}: ${studentIds.length} student IDs`);
          console.log(`📊 [Stats] Sample student IDs:`, studentIds.slice(0, 3));

          // 2. Get detailed student info to get student_codes
          let studentCodes: string[] = [];
          if (studentIds.length > 0) {
            const batchStudentsResult = await attendanceApiService.getBatchStudents(studentIds);
            if (batchStudentsResult.success && batchStudentsResult.data) {
              studentCodes = batchStudentsResult.data
                .map((student: any) => student.student_code)
                .filter(Boolean);

              console.log(
                `📊 [Stats] Batch students result: ${batchStudentsResult.data.length} students`
              );
              console.log(
                `📊 [Stats] Student codes: ${studentCodes.length}, sample:`,
                studentCodes.slice(0, 3)
              );
            } else {
              console.log(`📊 [Stats] Batch students failed:`, batchStudentsResult.error);
            }
          }

          // 2. Get attendance data (homeroom attendance)
          const attendanceResult = await attendanceApiService.getClassAttendance(
            classId,
            currentDateStr,
            'homeroom'
          );
          const attendanceRecords =
            attendanceResult.success && attendanceResult.data ? attendanceResult.data : [];

          // 3. Get check-in/check-out data
          let checkInOutData: Record<string, any> = {};
          if (studentCodes.length > 0) {
            console.log(
              `📊 [DayMap] Calling getStudentsDayMap for ${classId} with ${studentCodes.length} codes`
            );
            const dayMapResult = await attendanceApiService.getStudentsDayMap(
              studentCodes,
              currentDateStr
            );
            console.log(`📊 [DayMap] Result for ${classId}:`, {
              success: dayMapResult.success,
              error: dayMapResult.error,
              dataKeys: dayMapResult.data ? Object.keys(dayMapResult.data) : 'no data',
              sampleEntry: dayMapResult.data ? Object.values(dayMapResult.data)[0] : 'no sample',
            });

            if (dayMapResult.success && dayMapResult.data) {
              checkInOutData = dayMapResult.data;
              console.log(
                `📊 [DayMap] Got ${Object.keys(checkInOutData).length} check-in/out records for ${classId}`
              );
            } else {
              console.log(
                `📊 [DayMap] Failed to get check-in/out data for ${classId}:`,
                dayMapResult.error
              );
            }
          } else {
            console.log(`📊 [DayMap] Skipping getStudentsDayMap for ${classId} - no student codes`);
          }

          // 4. Calculate stats
          const totalStudents = studentIds.length;
          const attendanceCount = attendanceRecords.length; // Students who have attendance records
          const hasAttendance = attendanceCount > 0;

          let checkInCount = 0;
          let checkOutCount = 0;

          // Count check-ins and check-outs from physical attendance data
          console.log(
            `📊 [Stats] Counting ${Object.keys(checkInOutData).length} check-in/out records for ${classId}`
          );
          Object.entries(checkInOutData).forEach(([studentCode, data]: [string, any]) => {
            console.log(
              `📊 [Stats] Student ${studentCode}: checkIn=${!!data.checkInTime}, checkOut=${!!data.checkOutTime}`
            );
            if (data.checkInTime) checkInCount++;
            if (data.checkOutTime) checkOutCount++;
          });
          console.log(
            `📊 [Stats] Final counts for ${classId}: checkIn=${checkInCount}, checkOut=${checkOutCount}, attendance=${attendanceCount}, total=${totalStudents}`
          );

          newStats[classId] = {
            checkInCount,
            attendanceCount,
            checkOutCount,
            totalStudents,
            hasAttendance,
          };
        } catch (error) {
          console.error(`Failed to fetch stats for class ${classId}:`, error);
          // Set default stats
          newStats[classId] = {
            checkInCount: 0,
            attendanceCount: 0,
            checkOutCount: 0,
            totalStudents: 0,
            hasAttendance: false,
          };
        }
      });

      await Promise.all(promises);
      console.log('📊 [Home] Final classStats to set:', newStats);
      console.log('📊 [Home] Setting classStats with keys:', Object.keys(newStats));
      setClassStats(newStats);
      console.log('📊 [Home] classStats set successfully');
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
    if (classesData && !loading) {
      const allClasses = [
        ...(classesData.homeroom_classes || []),
        ...(classesData.teaching_classes || []),
      ];
      if (allClasses.length > 0) {
        fetchClassStats(allClasses);
      }
    }
  }, [classesData, loading, fetchClassStats]);

  // Refresh stats when screen comes back into focus (after editing attendance)
  useFocusEffect(
    useCallback(() => {
      if (classesData && !loading) {
        const allClasses = [
          ...(classesData.homeroom_classes || []),
          ...(classesData.teaching_classes || []),
        ];
        if (allClasses.length > 0) {
          fetchClassStats(allClasses);
        }
      }
    }, [classesData, loading, fetchClassStats])
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
        ? `${classData.start_time} - ${classData.end_time}`
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
          marginBottom: 16,
        }}>
        {isTimetableEntry && periodName && (
          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#002855' }}>{periodName}</Text>
            {periodTime && (
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{periodTime}</Text>
            )}
          </View>
        )}

        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 4 }}>{title}</Text>

        {isTimetableEntry && (subject || room) && (
          <View style={{ marginBottom: 8 }}>
            {subject && (
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 2 }}>📚 {subject}</Text>
            )}
            {room && <Text style={{ fontSize: 12, color: '#999' }}>🏫 Phòng: {room}</Text>}
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 16,
            marginTop: 10,
          }}>
          <View style={{ alignItems: 'left' }}>
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
          <View style={{ alignItems: 'end' }}>
            <Ionicons name="log-out-outline" size={22} color="#444" />
            <Text style={{ marginTop: 8, fontSize: 13 }}>
              {stats?.checkOutCount || 0}/{stats?.totalStudents || 0} học sinh
            </Text>
          </View>
        </View>

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
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700' }}>
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
            const stats = classStats[classId];
            console.log(
              `🎨 [UI] Rendering ClassCard for ${classId} (isTimetable=${isTimetableEntry}): displayText=`,
              {
                checkIn: stats ? `${stats.checkInCount}/${stats.totalStudents}` : '0/0',
                attendance: stats ? `${stats.attendanceCount}/${stats.totalStudents}` : '0/0',
                checkOut: stats ? `${stats.checkOutCount}/${stats.totalStudents}` : '0/0',
                statsFound: !!stats,
              }
            );
            return <ClassCard key={classId || index} classData={classData} stats={stats} />;
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
