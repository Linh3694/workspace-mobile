// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useLanguage } from '../../hooks/useLanguage';
import timetableService, {
  TeacherClass,
  TimetableEntry,
  TeacherInfo,
  getWeekRange,
  getMondayOfWeek,
} from '../../services/timetableService';
import { getFullImageUrl } from '../../utils/imageUtils';

// Subject colors mapping (from parent-portal)
const CURRICULUM_COLORS: Record<string, { color: string; bg: string }> = {
  'SIS_CURRICULUM-00219': { color: '#002855', bg: '#E5EAF0' }, // Vietnam
  'SIS_CURRICULUM-00011': { color: '#F05023', bg: '#FDEAE5' }, // International
  'SIS_CURRICULUM-01333': { color: '#009483', bg: '#E5F5F3' }, // Holistic
};

const getCurriculumColor = (curriculumId: string) => {
  return CURRICULUM_COLORS[curriculumId] || { color: '#757575', bg: '#F5F5F5' };
};

// Day names in Vietnamese
const DAY_NAMES_VI: Record<number, string> = {
  0: 'Chủ Nhật',
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
};

// Format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get teacher initials (last word of name)
const getTeacherInitials = (name?: string): string => {
  if (!name) return 'T';
  const parts = name.trim().split(' ');
  return parts[parts.length - 1]?.charAt(0)?.toUpperCase() || 'T';
};

// Format teacher name with gender prefix (Vietnamese style)
const formatTeacherDisplayName = (name?: string, gender?: string): string => {
  if (!name) return 'Giáo viên';

  // Rearrange Vietnamese name: move first word (family name) to end
  const parts = name.trim().split(' ');
  let rearranged = name;
  if (parts.length > 1) {
    const firstName = parts[0];
    const rest = parts.slice(1).join(' ');
    rearranged = `${rest} ${firstName}`;
  }

  // Add prefix based on gender
  const genderLower = (gender || '').toLowerCase();
  if (genderLower === 'female' || genderLower === 'nữ') {
    return `Cô ${rearranged}`;
  } else if (genderLower === 'male' || genderLower === 'nam') {
    return `Thầy ${rearranged}`;
  }
  return rearranged;
};

const TimetableScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useLanguage();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [teachersInfo, setTeachersInfo] = useState<Record<string, TeacherInfo>>({});
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMondayOfWeek());
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Track if initial load done
  const initialLoadDone = useRef(false);

  // Load teacher classes on mount
  useEffect(() => {
    loadTeacherClasses();
  }, []);

  // Load timetable when class or week changes
  useEffect(() => {
    if (selectedClassId) {
      loadTimetable();
    }
  }, [selectedClassId, currentWeekStart]);

  // Load teacher classes
  const loadTeacherClasses = async () => {
    try {
      setLoading(true);
      console.log('🏫 Loading teacher classes...');
      const data = await timetableService.getTeacherClasses();

      console.log('🏫 Data received:', data);

      if (data) {
        // Combine homeroom and vice-homeroom classes (remove duplicates)
        const allClasses = [...(data.homeroom_classes || [])];
        console.log('🏫 Homeroom classes found:', allClasses.length);

        // Also add teaching classes (unique only)
        const existingIds = new Set(allClasses.map((c) => c.name));
        (data.teaching_classes || []).forEach((cls) => {
          if (!existingIds.has(cls.name)) {
            allClasses.push(cls);
            existingIds.add(cls.name);
          }
        });

        console.log('🏫 Total classes after combining:', allClasses.length);
        setTeacherClasses(allClasses);

        // Auto-select first class
        if (allClasses.length > 0 && !selectedClassId) {
          setSelectedClassId(allClasses[0].name);
        }
      } else {
        console.log('🏫 No data returned from API');
      }
    } catch (error) {
      console.error('🏫 Error loading teacher classes:', error);
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  };

  // Load timetable for selected class
  const loadTimetable = async () => {
    if (!selectedClassId) return;

    try {
      const { startDate, endDate } = getWeekRange(currentWeekStart);
      console.log('📅 Loading timetable for', selectedClassId, startDate, '-', endDate);
      const entries = await timetableService.getClassTimetable(selectedClassId, startDate, endDate);

      console.log('📅 Got', entries.length, 'entries');
      setTimetableEntries(entries);

      // Get unique teacher IDs and fetch their info
      const teacherIds = new Set<string>();
      entries.forEach((entry) => {
        if (entry.teacher_1_id) teacherIds.add(entry.teacher_1_id);
        if (entry.teacher_2_id) teacherIds.add(entry.teacher_2_id);
        entry.teacher_ids?.forEach((id) => teacherIds.add(id));
      });

      console.log('👨‍🏫 Found', teacherIds.size, 'unique teachers');
      if (teacherIds.size > 0) {
        const info = await timetableService.getTeacherInfo(Array.from(teacherIds));
        console.log('👨‍🏫 Teacher info:', Object.keys(info).length, 'records');
        setTeachersInfo(info);
      }
    } catch (error) {
      console.error('Error loading timetable:', error);
    }
  };

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTimetable();
    setRefreshing(false);
  };

  // Navigate to previous/next date
  const goToPreviousDate = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);

    // Check if need to load previous week
    const weekStart = currentWeekStart;
    if (newDate < weekStart) {
      const newWeekStart = new Date(weekStart);
      newWeekStart.setDate(newWeekStart.getDate() - 7);
      setCurrentWeekStart(newWeekStart);
    }
    setCurrentDate(newDate);
  };

  const goToNextDate = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);

    // Check if need to load next week
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (newDate > weekEnd) {
      const newWeekStart = new Date(currentWeekStart);
      newWeekStart.setDate(newWeekStart.getDate() + 7);
      setCurrentWeekStart(newWeekStart);
    }
    setCurrentDate(newDate);
  };

  // Filter entries for current date
  const currentDateStr = formatDate(currentDate);
  const dayEntries = useMemo(() => {
    return timetableEntries
      .filter((entry) => entry.date === currentDateStr)
      .sort((a, b) => {
        // Sort by period_priority first, then by start_time
        const aPriority = a.period_priority ?? 999;
        const bPriority = b.period_priority ?? 999;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });
  }, [timetableEntries, currentDateStr]);

  // Count curriculum periods
  const curriculumCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'SIS_CURRICULUM-00219': 0,
      'SIS_CURRICULUM-00011': 0,
      'SIS_CURRICULUM-01333': 0,
    };
    dayEntries.forEach((entry) => {
      if (entry.period_type !== 'non-study' && entry.curriculum_id) {
        if (counts[entry.curriculum_id] !== undefined) {
          counts[entry.curriculum_id]++;
        }
      }
    });
    return counts;
  }, [dayEntries]);

  // Get current class title
  const currentClass = teacherClasses.find((c) => c.name === selectedClassId);
  const currentClassTitle = currentClass?.title || 'Chọn lớp';

  // Check if today
  const isToday = formatDate(new Date()) === currentDateStr;

  // Render loading state
  if (loading && !initialLoadDone.current) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: insets.top,
          }}
        >
          <ActivityIndicator size="large" color="#002855" />
          <Text style={{ marginTop: 16, color: '#666' }}>Đang tải...</Text>
        </View>
      </View>
    );
  }

  // Render empty state if no classes
  if (teacherClasses.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 rounded-full">
            <Ionicons name="arrow-back" size={24} color="#002855" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-xl font-bold text-[#002855] mr-10">
            Thời khoá biểu
          </Text>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <MaterialIcons name="event-note" size={64} color="#ccc" />
          <Text className="mt-4 text-lg font-medium text-gray-500 text-center">
            Bạn không phải là chủ nhiệm/phó chủ nhiệm của lớp nào
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 rounded-full">
          <Ionicons name="arrow-back" size={24} color="#002855" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-xl font-bold text-[#002855] mr-10">
          Thời khoá biểu
        </Text>
      </View>

      {/* Class Selector - Only show if more than 1 class */}
      {/* {teacherClasses.length > 1 ? (
        <View className="mx-4 mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <Picker
            selectedValue={selectedClassId}
            onValueChange={(value) => setSelectedClassId(value)}
            style={{ height: 50 }}
          >
            {teacherClasses.map((cls) => (
              <Picker.Item key={cls.name} label={cls.title} value={cls.name} />
            ))}
          </Picker>
        </View>
      ) : teacherClasses.length === 1 ? (
        <View className="mx-4 mb-2 px-4 py-2">
          <Text className="text-center text-base font-semibold text-[#002855]">
            {currentClassTitle}
          </Text>
        </View>
      ) : null} */}

      {/* Date Navigation */}
      <View className="flex-row items-center justify-center mb-4 bg-white">
        <TouchableOpacity onPress={goToPreviousDate} className="p-3 rounded-full">
          <Ionicons name="chevron-back" size={32} color="#666" />
        </TouchableOpacity>

        <View className="mx-4 items-center">
          <Text className={`text-2xl font-bold ${isToday ? 'text-[#F05023]' : 'text-[#002855]'}`}>
            {DAY_NAMES_VI[currentDate.getDay()]}
          </Text>
          <Text className="text-sm text-gray-600">
            {currentDate.getDate().toString().padStart(2, '0')} tháng {currentDate.getMonth() + 1}
          </Text>
        </View>

        <TouchableOpacity onPress={goToNextDate} className="p-3 rounded-full">
          <Ionicons name="chevron-forward" size={32} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Timetable List */}
      <ScrollView
        className="flex-1 px-4"
        style={{ backgroundColor: '#FFFFFF' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        onScrollBeginDrag={() => setActiveTooltip(null)}
      >
        {dayEntries.length > 0 ? (
          <Pressable onPress={() => setActiveTooltip(null)}>
            {dayEntries.map((entry, index) => {
              const isNonStudy = entry.period_type === 'non-study';
              const curriculumColor = getCurriculumColor(entry.curriculum_id || '');

              // Get teacher IDs - use teacher_ids array or fallback to teacher_1_id/teacher_2_id
              const teacherIdList = (
                entry.teacher_ids ||
                [entry.teacher_1_id, entry.teacher_2_id].filter(Boolean)
              ) as string[];

              // Debug log for first entry
              if (index === 0) {
                console.log('📋 First entry data:', JSON.stringify(entry, null, 2));
                console.log('👨‍🏫 Teacher IDs:', teacherIdList);
                console.log('👨‍🏫 Teachers Info keys:', Object.keys(teachersInfo));
              }

              // Get time display
              const timeDisplay =
                entry.start_time && entry.end_time
                  ? `${entry.start_time} - ${entry.end_time}`
                  : '';

              return (
                <View key={`${entry.timetable_column_id || entry.name || index}`} className="mb-6">
                  {/* Period Name and Time - Above the card */}
                  <View className="flex-row items-center justify-between mb-2 px-1">
                    {!isNonStudy ? (
                      <Text className="text-lg font-bold text-[#002855]">
                        {entry.period_name || `Tiết ${index + 1}`}
                      </Text>
                    ) : (
                      <View />
                    )}
                    {timeDisplay ? (
                      <Text className="text-sm text-gray-400">{timeDisplay}</Text>
                    ) : null}
                  </View>

                  {/* Subject Card */}
                  {isNonStudy ? (
                    // Non-study period (break, lunch, etc.)
                    <View
                      className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-4"
                     
                    >
                      <Text className="text-sm font-medium text-gray-600 text-center">
                        {entry.period_name || 'Nghỉ'}
                      </Text>
                    </View>
                  ) : (
                    // Study period
                    <View
                      className="rounded-xl bg-white border border-gray-200"
                      style={{
                        minHeight: 120,
                        borderTopWidth: 6,
                        borderTopColor: curriculumColor.color,
                        borderTopLeftRadius: 12,
                        borderTopRightRadius: 12,
                      }}
                    >
                      <View className="p-4 flex-1">
                        {/* Subject Title */}
                        <Text className="text-lg font-bold text-[#002855] mb-3">
                          {entry.subject_title || 'Chưa có môn'}
                        </Text>

                        {/* Room and Teachers */}
                        <View className="flex-row items-center justify-between mt-auto pt-2">
                          {/* Room - Left side */}
                          <Text className="text-[#757575] font-medium">
                            {entry.room_name || entry.room_title || 'Chưa có phòng'}
                          </Text>

                          {/* Teachers - Right side */}
                          {teacherIdList.length > 0 ? (
                            <View className="flex-row items-center">
                              {teacherIdList.slice(0, 2).map((teacherId, idx) => {
                                const teacher = teachersInfo[teacherId as string];
                                const avatarUrl = getFullImageUrl(teacher?.avatar_url);
                                const teacherFullName = teacher?.full_name || entry.teacher_names || '';
                                const initials = getTeacherInitials(teacherFullName);
                                const tooltipKey = `${entry.timetable_column_id}-${teacherId}`;
                                const displayName = formatTeacherDisplayName(teacherFullName, teacher?.gender);

                                return (
                                  <View
                                    key={teacherId}
                                    style={{ marginLeft: idx > 0 ? -10 : 0, zIndex: 10 }}
                                  >
                                    {/* Tooltip */}
                                    {activeTooltip === tooltipKey && (
                                      <View
                                        style={{
                                          position: 'absolute',
                                          bottom: 60,
                                          right: -8,
                                          zIndex: 100,
                                          elevation: 10,
                                          backgroundColor: '#002855',
                                          paddingHorizontal: 10,
                                          paddingVertical: 6,
                                          borderRadius: 8,
                                          shadowColor: '#000',
                                          shadowOffset: { width: 0, height: 2 },
                                          shadowOpacity: 0.25,
                                          shadowRadius: 4,
                                          minWidth: 200,
                                          maxWidth: 450,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            color: '#fff',
                                            fontSize: 12,
                                            fontWeight: '500',
                                            textAlign: 'center',
                                          }}
                                          numberOfLines={1}
                                        >
                                          {displayName}
                                        </Text>
                                        {/* Arrow */}
                                        <View
                                          style={{
                                            position: 'absolute',
                                            bottom: -6,
                                            right: 30,
                                            width: 0,
                                            height: 0,
                                            borderLeftWidth: 6,
                                            borderRightWidth: 6,
                                            borderTopWidth: 6,
                                            borderLeftColor: 'transparent',
                                            borderRightColor: 'transparent',
                                            borderTopColor: '#002855',
                                          }}
                                        />
                                      </View>
                                    )}
                                    <TouchableOpacity
                                      onPress={() =>
                                        setActiveTooltip(activeTooltip === tooltipKey ? null : tooltipKey)
                                      }
                                      activeOpacity={0.8}
                                      className="w-16 h-16 rounded-full items-center justify-center border-2 border-white overflow-hidden"
                                      style={{
                                        backgroundColor: avatarUrl ? '#E5E7EB' : '#10B981',
                                      }}
                                    >
                                      {avatarUrl ? (
                                        <Image
                                          source={{ uri: avatarUrl }}
                                          className="w-full h-full"
                                          resizeMode="cover"
                                        />
                                      ) : (
                                        <Text className="text-white text-xs font-bold">{initials}</Text>
                                      )}
                                    </TouchableOpacity>
                                  </View>
                                );
                              })}
                            </View>
                          ) : (
                            <View style={{ width: 36, height: 36 }} />
                          )}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Curriculum Legend */}
            <View className="mt-4 pb-4">
              <View>
                {Object.entries({
                  'SIS_CURRICULUM-00219': { name: 'Chương trình Việt Nam', color: '#002855' },
                  'SIS_CURRICULUM-00011': { name: 'Chương trình Quốc tế', color: '#F05023' },
                  'SIS_CURRICULUM-01333': { name: 'Chương trình phát triển toàn diện', color: '#009483' },
                })
                  .filter(([key]) => (curriculumCounts[key] || 0) > 0)
                  .map(([key, info]) => (
                    <View key={key} className="flex-row items-center mb-2">
                      <Text className="text-lg font-bold mr-2" style={{ color: info.color }}>
                        {curriculumCounts[key] || 0} Tiết
                      </Text>
                      <Text className="text-[#757575]">{info.name}</Text>
                    </View>
                  ))}
              </View>
            </View>
          </Pressable>
        ) : (
          <View className="items-center justify-center py-16">
            <MaterialIcons name="event-busy" size={64} color="#ccc" />
            <Text className="mt-4 text-base text-gray-500">Không có lịch học cho ngày này</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default TimetableScreen;
