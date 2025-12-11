import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  isSameMonth,
  isToday,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { type CalendarEvent } from '../../services/calendarService';
import calendarServiceInstance from '../../services/calendarService';

// Vietnamese day labels
const VI_DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Function to get color based on event type
const getEventColor = (eventType: string | undefined) => {
  if (!eventType) return '#009483';

  const trimmedType = eventType.trim().toLowerCase();
  switch (trimmedType) {
    case 'holiday':
      return '#F05023'; // Ngày nghỉ - Đỏ
    case 'school_event':
      return '#009483'; // Sự kiện - Teal
    case 'exam':
      return '#002855'; // Kiểm tra - Navy
    default:
      return '#009483';
  }
};

// Map education stage ID to display name
const getEducationStageName = (stageId: string): string => {
  if (
    stageId.includes('00004') ||
    stageId.toLowerCase().includes('primary') ||
    stageId.toLowerCase().includes('tieu')
  ) {
    return 'Tiểu học';
  }
  if (
    stageId.includes('00005') ||
    stageId.toLowerCase().includes('secondary') ||
    stageId.toLowerCase().includes('thcs')
  ) {
    return 'THCS';
  }
  if (
    stageId.includes('00006') ||
    stageId.toLowerCase().includes('high') ||
    stageId.toLowerCase().includes('thpt')
  ) {
    return 'THPT';
  }
  return stageId;
};

// Format education stages for display
const formatEducationStages = (stages: string[] | undefined): string => {
  if (!stages || stages.length === 0) return '';
  if (stages.length >= 3) return 'Toàn trường';

  return stages.map(getEducationStageName).join(', ');
};

// Parse date string to Date in local timezone
const parseDateLocal = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Format date to YYYY-MM-DD in local timezone
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CalendarScreen = () => {
  const navigation = useNavigation();
  const scrollViewRef = useRef<ScrollView>(null);
  const detailSectionRef = useRef<View>(null);
  const groupRefs = useRef<Record<string, View | null>>({});
  const groupPositions = useRef<Record<string, number>>({});

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const currentYear = currentMonth.getFullYear();

  // Generate month selector data (5 months: -2, -1, 0, +1, +2)
  const monthSelectorData = useMemo(() => {
    const months = [];
    for (let i = -2; i <= 2; i++) {
      const monthDate = addMonths(currentMonth, i);
      const monthName = format(monthDate, 'MMMM', { locale: vi });
      const formattedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      months.push({
        date: monthDate,
        formatted: formattedMonthName,
        isCurrent: i === 0,
        offset: i,
      });
    }
    return months;
  }, [currentMonth]);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const calendarGrid: (Date | null)[][] = [];
    let week: (Date | null)[] = [];

    const firstDayOfMonth = monthStart;
    const firstDayOfWeek = getDay(firstDayOfMonth);
    const mondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    for (let i = 0; i < mondayOffset; i++) {
      week.push(null);
    }

    days.forEach((day) => {
      if (week.length === 7) {
        calendarGrid.push(week);
        week = [];
      }
      week.push(day);
    });

    while (week.length < 7) {
      week.push(null);
    }
    calendarGrid.push(week);

    return calendarGrid;
  }, [currentMonth]);

  // Create event dates map
  const eventDates = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      const sd = parseDateLocal(e.start_date);
      const ed = parseDateLocal(e.end_date);
      const d = new Date(sd);
      while (d <= ed) {
        const dateKey = formatDateLocal(d);
        const existingEvents = map.get(dateKey) || [];
        existingEvents.push(e);
        map.set(dateKey, existingEvents);
        d.setDate(d.getDate() + 1);
      }
    });
    return map;
  }, [events]);

  // Get unique events for current month grouped by date range
  const groupedEvents = useMemo(() => {
    const monthStart = new Date(currentYear, currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentYear, currentMonth.getMonth() + 1, 0);

    const filteredEvents = events.filter((event) => {
      const startDate = parseDateLocal(event.start_date);
      const endDate = parseDateLocal(event.end_date);
      return startDate <= monthEnd && endDate >= monthStart;
    });

    const sortedEvents = filteredEvents.sort((a, b) => {
      return parseDateLocal(a.start_date).getTime() - parseDateLocal(b.start_date).getTime();
    });

    const groups: Map<string, CalendarEvent[]> = new Map();
    sortedEvents.forEach((event) => {
      const key = `${event.start_date}_${event.end_date}`;
      const existing = groups.get(key) || [];
      existing.push(event);
      groups.set(key, existing);
    });

    return Array.from(groups.entries()).map(([key, evts]) => ({
      dateKey: key,
      startDate: evts[0].start_date,
      endDate: evts[0].end_date,
      events: evts,
    }));
  }, [events, currentYear, currentMonth]);

  // Format date range for display
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = parseDateLocal(startDate);
    const end = parseDateLocal(endDate);

    const formatDate = (d: Date) => {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      return `${day}/${month}`;
    };

    if (startDate === endDate) {
      return formatDate(start);
    }
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  // Fetch calendar events
  const fetchCalendarEvents = useCallback(async () => {
    try {
      setLoading(true);
      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;
      const response = await calendarServiceInstance.getCalendarEvents(startOfYear, endOfYear);
      if (response.success && response.data) {
        setEvents(response.data);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    fetchCalendarEvents();
  }, [fetchCalendarEvents]);

  // Handler for month selection
  const handleMonthSelect = (monthDate: Date) => {
    setCurrentMonth(monthDate);
  };

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCalendarEvents();
    setRefreshing(false);
  }, [fetchCalendarEvents]);

  // Find group that contains the clicked date
  const findGroupForDate = useCallback(
    (dateStr: string) => {
      const clickedDate = parseDateLocal(dateStr);
      return groupedEvents.find((group) => {
        const startDate = parseDateLocal(group.startDate);
        const endDate = parseDateLocal(group.endDate);
        return clickedDate >= startDate && clickedDate <= endDate;
      });
    },
    [groupedEvents]
  );

  // Handle day press - scroll to detail section
  const handleDayPress = useCallback(
    (dateStr: string) => {
      const group = findGroupForDate(dateStr);
      if (group && scrollViewRef.current) {
        setSelectedDateKey(group.dateKey);
        const yPosition = groupPositions.current[group.dateKey];
        if (yPosition !== undefined) {
          scrollViewRef.current.scrollTo({ y: yPosition - 20, animated: true });
        }
      }
    },
    [findGroupForDate]
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-white px-4 py-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Ionicons name="arrow-back" size={28} color="#002855" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-primary">Lịch năm học</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ backgroundColor: '#FFFFFF' }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Month Selector */}
        <View className="flex-row items-center justify-center bg-white py-4">
          {monthSelectorData.map((month, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleMonthSelect(month.date)}
              className="px-3 py-2">
              <Text
                className={`${
                  month.isCurrent
                    ? 'text-xl font-bold text-[#F05023]'
                    : Math.abs(month.offset) === 1
                      ? 'text-base font-semibold text-primary'
                      : 'text-sm text-gray-300'
                }`}>
                {month.formatted}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Legend */}
        <View className="my-4 flex-row items-center justify-center gap-4 pb-3">
          <View className="flex-row items-center">
            <View className="mr-2 h-3 w-3 rounded-full bg-[#F05023]" />
            <Text className="font-mulish-semibold text-base text-gray-700">Ngày nghỉ</Text>
          </View>
          <View className="flex-row items-center">
            <View className="mr-2 h-3 w-3 rounded-full bg-[#002855]" />
            <Text className="font-mulish-semibold text-base text-gray-700">Kiểm tra</Text>
          </View>
          <View className="flex-row items-center">
            <View className="mr-2 h-3 w-3 rounded-full bg-[#009483]" />
            <Text className="font-mulish-semibold text-base text-gray-700">Sự kiện</Text>
          </View>
        </View>

        {loading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#F05023" />
            <Text className="mt-4 text-gray-500">Đang tải...</Text>
          </View>
        ) : (
          <>
            {/* Calendar Grid */}
            <View className="mx-4 mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {/* Days of week header */}
              <View className="flex-row border-b border-gray-200 bg-[#f6f6f6]">
                {VI_DAY_LABELS.map((day, index) => (
                  <View key={index} className="flex-1 items-center py-3">
                    <Text className="text-sm font-medium text-gray-600">{day}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar days */}
              {calendarDays.map((week, weekIndex) => (
                <View key={weekIndex} className="flex-row border border-gray-50 last:border-b-0">
                  {week.map((day, dayIndex) => {
                    if (!day) {
                      return (
                        <View
                          key={`${weekIndex}-${dayIndex}`}
                          className="min-h-[100px] flex-1 border-r border-gray-200 bg-gray-50 last:border-r-0"
                        />
                      );
                    }

                    const dateStr = formatDateLocal(day);
                    const dayEvents = eventDates.get(dateStr) || [];
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isTodayDate = isToday(day);

                    const hasEvents = isCurrentMonth && dayEvents.length > 0;

                    const DayContent = (
                      <>
                        {/* Day number */}
                        <View className="items-center pt-2">
                          {isTodayDate ? (
                            <View className="h-7 w-7 items-center justify-center rounded-full bg-[#F05023]">
                              <Text className="text-sm font-medium text-white">
                                {format(day, 'd')}
                              </Text>
                            </View>
                          ) : (
                            <Text
                              className={`text-sm font-medium ${
                                isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                              }`}>
                              {format(day, 'd')}
                            </Text>
                          )}
                        </View>

                        {/* Events */}
                        {hasEvents && (
                          <View className="mt-1 px-0.5 pb-1">
                            {dayEvents.slice(0, 3).map((event, eventIdx) => (
                              <View
                                key={eventIdx}
                                className="mb-0.5 rounded px-1 py-0.5"
                                style={{ backgroundColor: getEventColor(event.type) }}>
                                <Text className="text-[10px] text-white" numberOfLines={1}>
                                  {event.title}
                                </Text>
                              </View>
                            ))}
                            {dayEvents.length > 3 && (
                              <Text className="text-center text-[9px] text-gray-500">
                                +{dayEvents.length - 3}
                              </Text>
                            )}
                          </View>
                        )}
                      </>
                    );

                    if (hasEvents) {
                      return (
                        <TouchableOpacity
                          key={`${weekIndex}-${dayIndex}`}
                          activeOpacity={0.7}
                          onPress={() => handleDayPress(dateStr)}
                          className={`min-h-[100px] flex-1 border-r border-gray-100 last:border-r-0 ${
                            isCurrentMonth ? 'bg-white' : 'bg-gray-50 opacity-40'
                          }`}>
                          {DayContent}
                        </TouchableOpacity>
                      );
                    }

                    return (
                      <View
                        key={`${weekIndex}-${dayIndex}`}
                        className={`min-h-[100px] flex-1 border-r border-gray-100 last:border-r-0 ${
                          isCurrentMonth ? 'bg-white' : 'bg-gray-50 opacity-40'
                        }`}>
                        {DayContent}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Detailed Events Section */}
            {groupedEvents.length > 0 && (
              <View ref={detailSectionRef} className="mx-4 mt-4">
                <Text className="mb-4 text-xl font-bold text-[#002855]">Lịch chi tiết</Text>

                {groupedEvents.map((group, groupIndex) => {
                  const isSelected = selectedDateKey === group.dateKey;
                  return (
                    <View
                      key={groupIndex}
                      ref={(ref) => {
                        groupRefs.current[group.dateKey] = ref;
                      }}
                      onLayout={(event) => {
                        const { y } = event.nativeEvent.layout;
                        // Store absolute position (relative to ScrollView content)
                        groupPositions.current[group.dateKey] = y + 400; // Approximate offset for header + calendar
                      }}
                      className={`mb-4 rounded-xl p-3 ${isSelected ? 'bg-blue-50' : ''}`}>
                      {/* Date header */}
                      <Text
                        className={`mb-2 text-sm font-medium ${isSelected ? 'text-[#002855]' : 'text-gray-500'}`}>
                        {formatDateRange(group.startDate, group.endDate)}
                      </Text>

                      {/* Event cards */}
                      {group.events.map((event, eventIndex) => {
                        const stagesText = formatEducationStages(event.education_stages);
                        return (
                          <View
                            key={eventIndex}
                            className="mb-2 rounded-lg bg-white p-4 shadow-sm"
                            style={{
                              borderLeftWidth: 4,
                              borderLeftColor: getEventColor(event.type),
                            }}>
                            <Text className="text-sm font-semibold text-[#002855]">
                              {event.title}
                            </Text>
                            {stagesText && (
                              <Text className="mt-1 text-xs text-gray-500">{stagesText}</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CalendarScreen;
