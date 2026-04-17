// @ts-nocheck
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { attendanceApiService } from '../../services/attendanceApiService';
import { TouchableOpacity } from '../../components/Common';

// Khóa period gửi batch/get attendance: DB lưu theo tên tiết như web, không phải timetable_column_id
const getGvbmAttendancePeriodKey = (entry: { period_name?: string; timetable_column_id?: string }) => {
  const fromName = String(entry?.period_name || '').trim();
  const fromCol = String(entry?.timetable_column_id || '').trim();
  return fromName || fromCol;
};

// Helper function to format time from HH:MM:SS to HH:MM
const formatTime = (time: string | undefined): string => {
  if (!time) return '';
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return time;
};

// Props type cho ClassCard
interface ClassCardProps {
  classData: any;
  stats?: {
    checkInCount: number;
    attendanceCount: number;
    checkOutCount: number;
    totalStudents: number;
    hasAttendance: boolean;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
  };
  tab: 'GVCN' | 'GVBM';
  currentDate: Date;
  onNavigate: (classData: any, periodId: string | null, periodName: string | null) => void;
}

// Extract ClassCard ra ngoài và wrap React.memo để tránh re-render không cần thiết
const ClassCard = React.memo(
  ({ classData, stats, tab, currentDate, onNavigate }: ClassCardProps) => {
    const isTimetableEntry = classData.timetable_column_id !== undefined;
    const title =
      classData.title ||
      classData.class_title ||
      classData.short_title ||
      classData.name ||
      'Unknown Class';
    const periodId = isTimetableEntry ? classData.timetable_column_id : null;
    const periodName = isTimetableEntry ? classData.period_name : null;
    const subject = isTimetableEntry ? classData.subject_title : null;
    const room = isTimetableEntry ? classData.room_name : null;
    const hasAttendance = stats?.hasAttendance || false;

    const presentCount = stats?.presentCount || 0;
    const absentCount = stats?.absentCount || 0;
    const lateCount = stats?.lateCount || 0;
    const excusedCount = stats?.excusedCount || 0;

    return (
      <View
        style={{
          backgroundColor: '#F6F6F6',
          padding: 16,
          borderRadius: 16,
        }}>
        {/* Header với title và badge */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}>
          <Text style={{ fontSize: 18, fontWeight: '600', flex: 1, fontFamily: 'Mulish-Bold' }}>
            {title}
          </Text>
          <View
            style={{
              backgroundColor: hasAttendance ? '#3DB838' : '#FFFFFF',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              borderWidth: hasAttendance ? 0 : 1,
              borderColor: '#E5E7EB',
            }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: hasAttendance ? '#FFFFFF' : '#6B7280',
                fontFamily: 'Mulish-Bold',
              }}>
              {hasAttendance ? 'Đã điểm danh' : 'Chưa điểm danh'}
            </Text>
          </View>
        </View>

        {/* Môn học và phòng - chỉ cho tab GVBM */}
        {isTimetableEntry && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="globe-outline" size={24} color="#666" />
              <Text
                style={{
                  fontSize: 14,
                  color: '#666',
                  marginLeft: 10,
                  fontFamily: 'Mulish-Medium',
                }}>
                {subject || 'Chưa có môn'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location-outline" size={24} color="#666" />
              <Text
                style={{
                  fontSize: 14,
                  color: '#666',
                  marginLeft: 10,
                  fontFamily: 'Mulish-Medium',
                }}>
                {room || title}
              </Text>
            </View>
          </View>
        )}

        {/* Check-in/Check-out stats - chỉ cho tab GVCN */}
        {tab === 'GVCN' && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginVertical: 12,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="log-in-outline" size={20} color="#444" />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 13,
                  color: '#444',
                  fontFamily: 'Mulish-Medium',
                }}>
                {stats?.checkInCount || 0}/{stats?.totalStudents || 0} học sinh
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="log-out-outline" size={20} color="#444" />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 13,
                  color: '#444',
                  fontFamily: 'Mulish-Medium',
                }}>
                {stats?.checkOutCount || 0}/{stats?.totalStudents || 0} học sinh
              </Text>
            </View>
          </View>
        )}

        {/* Attendance status icons */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            marginHorizontal: 4,
            marginTop: 12,
            marginBottom: 24,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={24} color="#22C55E" />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 16,
                color: '#22C55E',
                fontWeight: '500',
                fontFamily: 'Mulish-Medium',
              }}>
              {presentCount}
            </Text>
          </View>

          <Text
            style={{
              color: '#757575',
              fontSize: 16,
              fontWeight: 'semibold',
              fontFamily: 'Mulish-SemiBold',
            }}>
            |
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color="#EF4444" />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 16,
                color: '#EF4444',
                fontWeight: '500',
                fontFamily: 'Mulish-Medium',
              }}>
              {absentCount}
            </Text>
          </View>

          <Text
            style={{
              color: '#757575',
              fontSize: 16,
              fontWeight: 'semibold',
              fontFamily: 'Mulish-SemiBold',
            }}>
            |
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="time-outline" size={24} color="#F5AA1E" />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 16,
                color: '#F5AA1E',
                fontWeight: '500',
                fontFamily: 'Mulish-Medium',
              }}>
              {lateCount}
            </Text>
          </View>

          <Text
            style={{
              color: '#757575',
              fontSize: 16,
              fontWeight: 'semibold',
              fontFamily: 'Mulish-SemiBold',
            }}>
            |
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="ban-outline" size={24} color="#6B7280" />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 16,
                color: '#6B7280',
                fontWeight: '500',
                fontFamily: 'Mulish-Medium',
              }}>
              {excusedCount}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: hasAttendance ? '#FFFFFF' : '#333333',
            borderWidth: hasAttendance ? 1 : 0,
            borderColor: hasAttendance ? '#E5E7EB' : 'transparent',
            paddingVertical: 10,
            borderRadius: 30,
          }}
          onPress={() => onNavigate(classData, periodId, periodName)}>
          <Text
            style={{
              color: hasAttendance ? '#333333' : 'white',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: '600',
              fontFamily: 'Mulish-Bold',
            }}>
            {hasAttendance ? 'Chỉnh sửa' : 'Điểm danh'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
);

const AttendanceHome = () => {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  // Get initial tab from route params (for deep link from notification)
  const initialTab = route.params?.initialTab as 'GVCN' | 'GVBM' | undefined;

  // Ref để tránh double-fetch khi mount (useEffect + useFocusEffect đều chạy)
  const isInitialMount = useRef(true);

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
        // Status counts
        presentCount: number;
        absentCount: number;
        lateCount: number;
        excusedCount: number;
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

  /**
   * Fetch stats cho tất cả classes trong 1 API call duy nhất (OPTIMIZED)
   * Giảm từ N*4 calls xuống 1 call
   */
  const fetchClassStats = useCallback(
    async (classes: any[], isTimetable: boolean = false) => {
      if (!classes || classes.length === 0) return;

      const currentDateStr = currentDate.toISOString().split('T')[0];

      // Build items array cho batch API
      const items: { class_id: string; date: string; period: string }[] = [];
      const statsKeyMap: Record<string, string> = {}; // resultKey -> statsKey

      classes.forEach((classData) => {
        const isTimetableEntry = classData.timetable_column_id !== undefined;
        const actualClassId = isTimetableEntry
          ? classData.class_id
          : classData.class_id || classData.name;

        if (!actualClassId) return;

        const period = isTimetableEntry ? getGvbmAttendancePeriodKey(classData) : 'homeroom';
        if (isTimetableEntry && !period) return;

        const statsKey = isTimetableEntry ? `${actualClassId}_${period}` : actualClassId;

        // resultKey từ API sẽ là: class_id cho homeroom, class_id_period cho timetable
        const resultKey = period === 'homeroom' ? actualClassId : `${actualClassId}_${period}`;
        statsKeyMap[resultKey] = statsKey;

        items.push({
          class_id: actualClassId,
          date: currentDateStr,
          period: period,
        });
      });

      if (items.length === 0) return;

      console.log('📊 [Home] Fetching batch stats for', items.length, 'classes');
      const startTime = Date.now();

      // Gọi 1 API duy nhất để lấy tất cả stats
      const result = await attendanceApiService.batchGetClassesAttendanceSummary(
        items,
        !isTimetable // include check-in/out chỉ cho GVCN (homeroom)
      );

      const elapsed = Date.now() - startTime;
      console.log(`✅ [Home] Batch stats fetched in ${elapsed}ms`);

      if (result.success && result.data) {
        const newStats: Record<
          string,
          {
            checkInCount: number;
            attendanceCount: number;
            checkOutCount: number;
            totalStudents: number;
            hasAttendance: boolean;
            presentCount: number;
            absentCount: number;
            lateCount: number;
            excusedCount: number;
          }
        > = {};

        // Map result từ API về statsKey
        Object.entries(result.data).forEach(([resultKey, data]) => {
          const statsKey = statsKeyMap[resultKey] || resultKey;
          const attendanceCount =
            (data.present_count || 0) +
            (data.absent_count || 0) +
            (data.late_count || 0) +
            (data.excused_count || 0);

          newStats[statsKey] = {
            checkInCount: data.check_in_count || 0,
            attendanceCount: attendanceCount,
            checkOutCount: data.check_out_count || 0,
            totalStudents: data.total_students || 0,
            hasAttendance: data.has_attendance || false,
            presentCount: data.present_count || 0,
            absentCount: data.absent_count || 0,
            lateCount: data.late_count || 0,
            excusedCount: data.excused_count || 0,
          };
        });

        setClassStats((prev) => ({ ...prev, ...newStats }));
      } else {
        console.error('❌ [Home] Batch stats failed:', result.error);
      }
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
      const todayTimetable = attendanceApiService.getTimetableEntriesForDate(
        timetableData,
        currentDateStr
      );
      if (todayTimetable.length > 0) {
        fetchClassStats(todayTimetable, true);
      }
    }
  }, [classesData, timetableData, loading, fetchClassStats, currentDate]);

  // Quick refresh stats khi quay lại màn hình - dùng batch API mới
  const refreshHasAttendanceFlags = useCallback(async () => {
    const currentDateStr = currentDate.toISOString().split('T')[0];
    const items: { class_id: string; date: string; period: string }[] = [];
    const statsKeyMap: Record<string, string> = {};

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
          statsKeyMap[classId] = classId;
        }
      });
    }

    // Add timetable entries
    const todayTimetable = attendanceApiService.getTimetableEntriesForDate(
      timetableData,
      currentDateStr
    );
    todayTimetable.forEach((entry) => {
      const periodKey = getGvbmAttendancePeriodKey(entry);
      if (entry.class_id && periodKey) {
        items.push({
          class_id: entry.class_id,
          date: currentDateStr,
          period: periodKey,
        });
        const resultKey = `${entry.class_id}_${periodKey}`;
        statsKeyMap[resultKey] = resultKey;
      }
    });

    if (items.length === 0) return;

    console.log('🔄 [Home] Refreshing stats for', items.length, 'items');
    const result = await attendanceApiService.batchGetClassesAttendanceSummary(items, true);

    if (result.success && result.data) {
      console.log('✅ [Home] Stats refreshed');
      setClassStats((prev) => {
        const updated = { ...prev };
        Object.entries(result.data).forEach(([resultKey, data]) => {
          const statsKey = statsKeyMap[resultKey] || resultKey;
          const attendanceCount =
            (data.present_count || 0) +
            (data.absent_count || 0) +
            (data.late_count || 0) +
            (data.excused_count || 0);

          updated[statsKey] = {
            checkInCount: data.check_in_count || 0,
            attendanceCount: attendanceCount,
            checkOutCount: data.check_out_count || 0,
            totalStudents: data.total_students || 0,
            hasAttendance: data.has_attendance || false,
            presentCount: data.present_count || 0,
            absentCount: data.absent_count || 0,
            lateCount: data.late_count || 0,
            excusedCount: data.excused_count || 0,
          };
        });
        return updated;
      });
    }
  }, [currentDate, classesData, timetableData]);

  // Refresh stats when screen comes back into focus (after editing attendance)
  useFocusEffect(
    useCallback(() => {
      // Skip lần focus đầu tiên vì useEffect đã fetch rồi
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      // Chỉ gọi 1 API để refresh tất cả stats
      refreshHasAttendanceFlags();
    }, [refreshHasAttendanceFlags])
  );

  // Filter classes based on selected tab
  const displayedClasses = useMemo(() => {
    if (tab === 'GVCN') {
      return classesData?.homeroom_classes || [];
    } else {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      return attendanceApiService.getTimetableEntriesForDate(timetableData, currentDateStr);
    }
  }, [tab, classesData, timetableData, currentDate]);

  // Handler để navigate đến màn hình detail
  const handleNavigateToDetail = useCallback(
    (classData: any, periodId: string | null, periodName: string | null) => {
      const isTimetableEntry = classData.timetable_column_id !== undefined;
      nav.navigate(ROUTES.SCREENS.ATTENDANCE_DETAIL, {
        classData,
        period: isTimetableEntry ? periodId : undefined,
        periodName: isTimetableEntry ? periodName : undefined,
        selectedDate: currentDate.toISOString().split('T')[0],
      });
    },
    [nav, currentDate]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity onPress={() => nav.goBack()} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={26} color="#222" />
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 20,
              fontWeight: '600',
              color: '#002855',
              fontFamily: 'Mulish-Bold',
            }}>
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
            <Text
              style={{
                fontSize: 24,
                fontWeight: '800',
                color: '#F05023',
                fontFamily: 'Mulish-Bold',
              }}>
              {dayName}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 14, color: '#666', fontFamily: 'Mulish-Bold' }}>
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
            const statsKey = isTimetableEntry
              ? `${classId}_${getGvbmAttendancePeriodKey(classData)}`
              : classId;
            const stats = classStats[statsKey];

            // Calculate period info for display
            const periodName = isTimetableEntry ? classData.period_name : null;
            const periodTime =
              isTimetableEntry && classData.start_time && classData.end_time
                ? `${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`
                : null;

            // Generate unique key using index to prevent duplicate key errors
            const uniqueKey = isTimetableEntry
              ? `GVBM-${index}-${classData.timetable_column_id}-${classId}`
              : `GVCN-${index}-${classId}`;

            return (
              <View key={uniqueKey} style={{ marginBottom: 16 }}>
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
                  classData={classData}
                  stats={stats}
                  tab={tab}
                  currentDate={currentDate}
                  onNavigate={handleNavigateToDetail}
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
