// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Modal,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from '../../hooks/useLanguage';
import { formatTimeHHMM } from '../../utils/dateUtils';
import timetableService, {
  TeacherClass,
  TimetableEntry,
  getWeekRange,
  getMondayOfWeek,
} from '../../services/timetableService';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import api from '../../utils/api';

// Interfaces for education stage/grade
interface EducationStage {
  name: string;
  title_vn?: string;
  title_en?: string;
  short_title?: string;
}

interface EducationGrade {
  name: string;
  grade_name?: string;
  grade_code?: string;
  education_stage: string;
}

// Curriculum colors mapping
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ClassLogScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useLanguage();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMondayOfWeek());
  const [showStagePicker, setShowStagePicker] = useState(false);

  // Education stage filter
  const [educationStages, setEducationStages] = useState<EducationStage[]>([]);
  const [educationGrades, setEducationGrades] = useState<EducationGrade[]>([]);
  const [availableStages, setAvailableStages] = useState<EducationStage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // Track if initial load done
  const initialLoadDone = useRef(false);
  const teacherUserIdRef = useRef<string | null>(null);

  // Load education stages và grades lần đầu
  useEffect(() => {
    loadEducationData();
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Reload timetable when week changes
  useEffect(() => {
    if (teacherClasses.length > 0 && initialLoadDone.current) {
      loadTimetableForWeek();
    }
  }, [currentWeekStart]);

  // Load education stages và grades từ API
  const loadEducationData = async () => {
    try {
      const [stagesRes, gradesRes] = await Promise.all([
        api.get('/method/erp.api.erp_sis.education_stage.get_all_education_stages'),
        api.get('/method/erp.api.erp_sis.education_grade.get_all_education_grades'),
      ]);

      const stages = stagesRes.data?.message?.data || stagesRes.data?.data || [];
      const grades = gradesRes.data?.message?.data || gradesRes.data?.data || [];

      console.log('📚 ClassLog - Loaded stages:', stages.length);
      console.log('📚 ClassLog - Loaded grades:', grades.length);

      setEducationStages(stages);
      setEducationGrades(grades);
    } catch (error) {
      console.error('Error loading education data:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const data = await timetableService.getTeacherClasses();

      console.log('📚 ClassLog - Teacher data:', data?.teacher_user_id);

      if (data) {
        // Lấy tất cả lớp (homeroom + teaching) cho filter stage
        const allClasses = [...(data.homeroom_classes || [])];
        const existingIds = new Set(allClasses.map((c) => c.name));
        (data.teaching_classes || []).forEach((cls) => {
          if (!existingIds.has(cls.name)) {
            allClasses.push(cls);
            existingIds.add(cls.name);
          }
        });

        console.log('📚 ClassLog - Total classes:', allClasses.length);
        setTeacherClasses(allClasses);

        // Lấy TKB theo giáo viên (get_teacher_week) - chỉ các tiết giáo viên dạy
        const teacherUserId = data.teacher_user_id;
        if (!teacherUserId) {
          console.warn('📚 ClassLog - No teacher_user_id, cannot load timetable');
          setTimetableEntries([]);
          return;
        }

        const { startDate, endDate } = getWeekRange(currentWeekStart);
        const entries = await timetableService.getTeacherTimetable(
          teacherUserId,
          startDate,
          endDate
        );

        console.log('📚 ClassLog - Total teacher timetable entries:', entries.length);
        setTimetableEntries(entries);
        teacherUserIdRef.current = data.teacher_user_id;
      }
    } catch (error) {
      console.error('Error loading class log data:', error);
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  };

  // Load timetable when week changes - cần teacher_user_id từ getTeacherClasses
  const loadTimetableForWeek = async () => {
    try {
      const teacherId = teacherUserIdRef.current;
      if (!teacherId) {
        // Lấy lại teacher_user_id nếu chưa có (từ loadData)
        const data = await timetableService.getTeacherClasses();
        if (data?.teacher_user_id) {
          teacherUserIdRef.current = data.teacher_user_id;
        }
      }
      const teacherIdToUse = teacherUserIdRef.current;
      if (!teacherIdToUse) {
        console.warn('📚 ClassLog - No teacher_user_id for loadTimetableForWeek');
        return;
      }

      const { startDate, endDate } = getWeekRange(currentWeekStart);
      const entries = await timetableService.getTeacherTimetable(
        teacherIdToUse,
        startDate,
        endDate
      );
      setTimetableEntries(entries);
    } catch (error) {
      console.error('Error loading timetable for week:', error);
    }
  };

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadEducationData(), loadData()]);
    setRefreshing(false);
  };

  // Navigate to previous/next date
  const goToPreviousDate = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);

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

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (newDate > weekEnd) {
      const newWeekStart = new Date(currentWeekStart);
      newWeekStart.setDate(newWeekStart.getDate() + 7);
      setCurrentWeekStart(newWeekStart);
    }
    setCurrentDate(newDate);
  };

  // Tạo map từ education_grade -> education_stage
  const gradeToStageMap = useMemo(() => {
    const map = new Map<string, string>();
    educationGrades.forEach((g) => {
      if (g.name && g.education_stage) {
        map.set(g.name, g.education_stage);
      }
    });
    return map;
  }, [educationGrades]);

  // Tính toán available stages dựa trên classes của giáo viên
  useEffect(() => {
    if (
      teacherClasses.length === 0 ||
      educationStages.length === 0 ||
      educationGrades.length === 0
    ) {
      return;
    }

    const stageIds = new Set<string>();
    teacherClasses.forEach((cls) => {
      if (cls.education_grade) {
        const stageId = gradeToStageMap.get(cls.education_grade);
        if (stageId) {
          stageIds.add(stageId);
        }
      }
    });

    const filtered = educationStages.filter((s) => stageIds.has(s.name));
    console.log(
      '📚 ClassLog - Available stages:',
      filtered.map((s) => s.title_vn || s.title_en)
    );

    setAvailableStages(filtered);

    if (!selectedStage && filtered.length > 0) {
      setSelectedStage(filtered[0].name);
    }
  }, [teacherClasses, educationStages, educationGrades, gradeToStageMap, selectedStage]);

  // Lấy classIds theo education stage đã chọn
  const filteredClassIds = useMemo(() => {
    if (!selectedStage) return new Set(teacherClasses.map((c) => c.name));

    return new Set(
      teacherClasses
        .filter((c) => {
          if (!c.education_grade) return false;
          const stageId = gradeToStageMap.get(c.education_grade);
          return stageId === selectedStage;
        })
        .map((c) => c.name)
    );
  }, [teacherClasses, selectedStage, gradeToStageMap]);

  // Filter entries for current date
  const currentDateStr = formatDate(currentDate);
  const dayEntries = useMemo(() => {
    const filtered = timetableEntries
      .filter((entry) => {
        if (entry.date !== currentDateStr) return false;
        if (entry.period_type === 'non-study') return false;
        if (!filteredClassIds.has(entry.class_id)) return false;
        return true;
      })
      .sort((a, b) => {
        const aPriority = a.period_priority ?? 999;
        const bPriority = b.period_priority ?? 999;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });

    // Deduplicate by timetable_column_id
    const seen = new Set<string>();
    return filtered.filter((entry) => {
      const key =
        entry.timetable_column_id ||
        entry.name ||
        `${entry.date}-${entry.period_id}-${entry.subject_id}-${entry.class_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [timetableEntries, currentDateStr, filteredClassIds]);

  // Count curriculum periods
  const curriculumCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'SIS_CURRICULUM-00219': 0,
      'SIS_CURRICULUM-00011': 0,
      'SIS_CURRICULUM-01333': 0,
    };
    dayEntries.forEach((entry) => {
      if (entry.curriculum_id && counts[entry.curriculum_id] !== undefined) {
        counts[entry.curriculum_id]++;
      }
    });
    return counts;
  }, [dayEntries]);

  // Get current stage title
  const currentStage = availableStages.find((s) => s.name === selectedStage);
  const currentStageTitle = currentStage?.title_vn || currentStage?.title_en || 'Chọn cấp học';
  const hasMultipleStages = availableStages.length > 1;

  // Find class info
  const getClassInfo = (classId: string) => {
    return teacherClasses.find((c) => c.name === classId);
  };

  // Check if today
  const isToday = formatDate(new Date()) === currentDateStr;

  // Navigate to detail screen
  const handlePeriodPress = (entry: TimetableEntry) => {
    console.log('📚 ClassLog - Navigate to detail:', {
      classId: entry.class_id,
      date: currentDateStr,
      period: entry.period_name || entry.period_id || '',
      entry: JSON.stringify(entry).substring(0, 300),
    });
    navigation.navigate(ROUTES.SCREENS.CLASS_LOG_DETAIL, {
      classId: entry.class_id,
      date: currentDateStr,
      period: entry.period_name || entry.period_id || '',
      periodName: entry.period_name || '',
      subjectTitle: entry.subject_title,
      timetableEntry: entry,
    });
  };

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
          }}>
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
        <View className="flex-row items-center px-4 py-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-full p-2">
            <Ionicons name="arrow-back" size={24} color="#002855" />
          </TouchableOpacity>
          <Text className="mr-10 flex-1 text-center text-xl font-bold text-[#002855]">
            {t('class_log.title') || 'Sổ đầu bài'}
          </Text>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <MaterialIcons name="event-note" size={64} color="#ccc" />
          <Text className="mt-4 text-center text-lg font-medium text-gray-500">
            Bạn không có lớp giảng dạy nào
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-full p-2">
          <Ionicons name="arrow-back" size={24} color="#002855" />
        </TouchableOpacity>
        <Text className="mr-10 flex-1 text-center text-xl font-bold text-[#002855]">
          {t('class_log.title') || 'Sổ đầu bài'}
        </Text>
      </View>

      {/* Education Stage Selector Badge */}
      <View className="mb-2 px-4">
        <TouchableOpacity
          onPress={() => hasMultipleStages && setShowStagePicker(true)}
          activeOpacity={hasMultipleStages ? 0.7 : 1}
          className="self-center">
          <View
            className="flex-row items-center rounded-full px-4 py-2"
            style={{ backgroundColor: '#E5EAF0' }}>
            <Text className="text-base font-semibold text-[#002855]" numberOfLines={1}>
              {currentStageTitle}
            </Text>
            {hasMultipleStages && (
              <Ionicons name="chevron-down" size={16} color="#002855" style={{ marginLeft: 6 }} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Education Stage Picker Modal */}
      <Modal
        visible={showStagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStagePicker(false)}>
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setShowStagePicker(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="rounded-t-3xl bg-white" style={{ paddingBottom: insets.bottom + 16 }}>
              {/* Modal Header */}
              <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4">
                <Text className="text-lg font-bold text-[#002855]">Chọn cấp học</Text>
                <TouchableOpacity onPress={() => setShowStagePicker(false)} className="p-1">
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Stage List */}
              <ScrollView className="max-h-80">
                {availableStages.map((stage) => {
                  const isSelected = stage.name === selectedStage;

                  return (
                    <TouchableOpacity
                      key={stage.name}
                      onPress={() => {
                        setSelectedStage(stage.name);
                        setShowStagePicker(false);
                      }}
                      className={`flex-row items-center border-b border-gray-50 px-5 py-4 ${isSelected ? 'bg-blue-50' : ''}`}>
                      <View className="flex-1">
                        <Text
                          className={`text-base ${isSelected ? 'font-bold text-[#002855]' : 'text-gray-800'}`}>
                          {stage.title_vn || stage.title_en || stage.short_title || stage.name}
                        </Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={24} color="#002855" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Date Navigation */}
      <View className="mb-4 flex-row items-center justify-center bg-white">
        <TouchableOpacity onPress={goToPreviousDate} className="rounded-full p-3">
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

        <TouchableOpacity onPress={goToNextDate} className="rounded-full p-3">
          <Ionicons name="chevron-forward" size={32} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Timetable List */}
      <ScrollView
        className="flex-1 px-4"
        style={{ backgroundColor: '#FFFFFF' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {dayEntries.length > 0 ? (
          <View>
            {dayEntries.map((entry, index) => {
              const curriculumColor = getCurriculumColor(entry.curriculum_id || '');
              const classInfo = getClassInfo(entry.class_id);

              const timeDisplay =
                entry.start_time && entry.end_time
                  ? `${formatTimeHHMM(entry.start_time)} - ${formatTimeHHMM(entry.end_time)}`
                  : '';

              return (
                <TouchableOpacity
                  key={`${entry.date}-${entry.timetable_column_id || entry.name}-${index}`}
                  className="mb-6"
                  onPress={() => handlePeriodPress(entry)}
                  activeOpacity={0.7}>
                  {/* Period Name and Time - Above the card */}
                  <View className="mb-2 flex-row items-center justify-between px-1">
                    <Text className="text-lg font-bold text-[#002855]">
                      {entry.period_name || `Tiết ${entry.period_priority || index + 1}`}
                    </Text>
                    {timeDisplay ? (
                      <Text className="text-sm text-gray-400">{timeDisplay}</Text>
                    ) : null}
                  </View>

                  {/* Subject Card */}
                  <View
                    className="rounded-xl border border-gray-200 bg-white"
                    style={{
                      minHeight: 120,
                      borderTopWidth: 6,
                      borderTopColor: curriculumColor.color,
                      borderTopLeftRadius: 12,
                      borderTopRightRadius: 12,
                    }}>
                    <View className="flex-1 p-4">
                      {/* Subject Title */}
                      <Text className="mb-3 text-lg font-bold text-[#002855]">
                        {entry.subject_title || 'Chưa có môn'}
                      </Text>

                      {/* Class and Room */}
                      <View className="mt-auto flex-row items-center justify-between pt-2">
                        {/* Class - Left side */}
                        <View className="flex-row items-center">
                          <Ionicons name="school-outline" size={18} color="#757575" />
                          <Text className="ml-1 font-medium text-[#757575]">
                            {classInfo?.title || entry.class_title || entry.class_id}
                          </Text>
                        </View>

                        {/* Room - Right side */}
                        {(entry.room_name || entry.room_title) && (
                          <View className="flex-row items-center">
                            <Ionicons name="location-outline" size={18} color="#757575" />
                            <Text className="ml-1 font-medium text-[#757575]">
                              {entry.room_name || entry.room_title}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Chevron indicator */}
                    <View className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Curriculum Legend */}
            <View className="mt-4 pb-4">
              <View>
                {Object.entries({
                  'SIS_CURRICULUM-00219': { name: 'Chương trình Việt Nam', color: '#002855' },
                  'SIS_CURRICULUM-00011': { name: 'Chương trình Quốc tế', color: '#F05023' },
                  'SIS_CURRICULUM-01333': {
                    name: 'Chương trình phát triển toàn diện',
                    color: '#009483',
                  },
                })
                  .filter(([key]) => (curriculumCounts[key] || 0) > 0)
                  .map(([key, info]) => (
                    <View key={key} className="mb-2 flex-row items-center">
                      <Text className="mr-2 text-lg font-bold" style={{ color: info.color }}>
                        {curriculumCounts[key] || 0} Tiết
                      </Text>
                      <Text className="text-[#757575]">{info.name}</Text>
                    </View>
                  ))}
              </View>
            </View>
          </View>
        ) : (
          <View className="items-center justify-center py-16">
            <MaterialIcons name="event-busy" size={64} color="#ccc" />
            <Text className="mt-4 text-base text-gray-500">
              {t('class_log.no_periods_today') || 'Không có tiết dạy hôm nay'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default ClassLogScreen;
