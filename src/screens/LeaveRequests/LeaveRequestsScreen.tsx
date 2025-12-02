// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../hooks/useLanguage';
import { leaveService, type LeaveRequest } from '../../services/leaveService';
import { API_BASE_URL } from '../../config/constants';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { formatShortDate, formatFullDate } from '../../utils/dateUtils';
import attendanceService from '../../services/attendanceService';

type LeaveRequestsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.MAIN
>;

const TabHeader = ({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) => (
  <View className="flex-1 items-center">
    <TouchableOpacity key={`tab-${label.toLowerCase()}`} onPress={onPress}>
      <Text
        className={`text-center font-medium ${active ? 'font-bold text-[#002855]' : 'text-gray-500'}`}>
        {label}
      </Text>
      {active && <View className="mt-2 h-0.5 bg-[#002855]" />}
    </TouchableOpacity>
  </View>
);

const Card = ({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
}) => (
  <TouchableOpacity onPress={onPress} className="mb-3 w-full">
    <View className="rounded-2xl bg-[#F6F6F6] p-4">
      <Text className="mb-1 font-semibold text-lg text-[#3F4246]">{title}</Text>
      {!!subtitle && <Text className="text-sm text-[#757575]">{subtitle}</Text>}
    </View>
  </TouchableOpacity>
);

const LeaveRequestsScreen = () => {
  const navigation = useNavigation<LeaveRequestsNavigationProp>();
  const route = useRoute();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Get classId from route params (if viewing specific class)
  const selectedClassId = route.params?.classId;

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentPhotos, setStudentPhotos] = useState<Record<string, string | null>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [classTitles, setClassTitles] = useState<Record<string, string>>({});
  const limit = 20;

  // Get class IDs where teacher is homeroom or vice homeroom teacher
  const [homeroomClasses, setHomeroomClasses] = useState<string[]>([]);
  const [viceClasses, setViceClasses] = useState<string[]>([]);

  const loadTeacherClasses = useCallback(async () => {
    try {
      console.log('[LeaveRequests] Loading teacher classes...');

      // First, try to sync fresh data from backend (same as AttendanceHome)
      if (user?.email) {
        try {
          console.log('[LeaveRequests] Syncing teacher assignments from backend...');

          // Try fetchTeacherClassAssignments first
          let assigns = await attendanceService.fetchTeacherClassAssignments(user.email);

          // If that fails, try syncTeacherAssignmentsLikeWeb
          if (!assigns) {
            console.log('[LeaveRequests] Trying syncTeacherAssignmentsLikeWeb...');
            assigns = await attendanceService.syncTeacherAssignmentsLikeWeb(user.email || user._id);
          }

          if (assigns) {
            const homeroom = assigns.homeroom_class_ids || [];
            const vice = assigns.vice_homeroom_class_ids || [];

            console.log('[LeaveRequests] Synced assignments:', { homeroom, vice });

            // Save to AsyncStorage
            await AsyncStorage.setItem('teacherHomeroomClassIds', JSON.stringify(homeroom));
            await AsyncStorage.setItem('teacherViceHomeroomClassIds', JSON.stringify(vice));

            setHomeroomClasses(homeroom);
            setViceClasses(vice);
            return;
          } else {
            console.log('[LeaveRequests] No assignments returned from both methods');
          }
        } catch (syncError) {
          console.error('[LeaveRequests] Failed to sync teacher assignments:', syncError);
        }
      }

      // Fallback: Load from AsyncStorage
      console.log('[LeaveRequests] Falling back to AsyncStorage...');
      const homeroomStr = await AsyncStorage.getItem('teacherHomeroomClassIds');
      const viceStr = await AsyncStorage.getItem('teacherViceHomeroomClassIds');

      const homeroom = homeroomStr ? JSON.parse(homeroomStr) : [];
      const vice = viceStr ? JSON.parse(viceStr) : [];

      console.log('[LeaveRequests] Loaded from AsyncStorage:', { homeroom, vice });

      setHomeroomClasses(homeroom);
      setViceClasses(vice);
    } catch (error) {
      console.error('[LeaveRequests] Error loading teacher classes:', error);
      setHomeroomClasses([]);
      setViceClasses([]);
    }
  }, [user?.email, user?._id]);

  // Load teacher classes when component mounts
  useEffect(() => {
    loadTeacherClasses();
  }, [loadTeacherClasses]);

  // Combine homeroom and vice classes (classes where teacher is homeroom or vice homeroom)
  const teacherClasses = useMemo(() => {
    return Array.from(new Set([...homeroomClasses, ...viceClasses]));
  }, [homeroomClasses, viceClasses]);

  const loadLeaveRequests = useCallback(
    async (showLoading = true) => {
      if (!selectedClassId && teacherClasses.length === 0) {
        // Still loading classes, don't show error yet
        console.log('[LeaveRequests] No classes loaded yet, skipping leave requests fetch');
        return;
      }

      try {
        if (showLoading) {
          setLoading(true);
        }
        setError(null);

        let response;
        if (selectedClassId) {
          // Load leave requests for specific class
          console.log('[LeaveRequests] Fetching leave requests for class:', selectedClassId);
          response = await leaveService.getClassLeaveRequests(selectedClassId, {
            page: currentPage,
            limit,
            search: searchQuery.trim() || undefined,
          });
        } else {
          // Load leave requests for all teacher classes
          console.log(
            '[LeaveRequests] Fetching leave requests for all teacher classes:',
            teacherClasses
          );
          response = await leaveService.getAllTeacherLeaveRequests(teacherClasses, {
            page: currentPage,
            limit,
            search: searchQuery.trim() || undefined,
          });
        }

        // Parse response - Frappe API returns data in message field
        const actualResponse = response.message || response;

        console.log('[LeaveRequests] API Response:', {
          success: actualResponse.success,
          total: actualResponse.data?.total,
          count: actualResponse.data?.leave_requests?.length,
        });

        if (actualResponse.success === true && actualResponse.data) {
          setLeaveRequests(actualResponse.data.leave_requests || []);
          setTotal(actualResponse.data.total || 0);
          setTotalPages(actualResponse.data.total_pages || 1);
          console.log(
            '[LeaveRequests] ✅ Successfully loaded',
            actualResponse.data.leave_requests?.length,
            'leave requests'
          );
        } else {
          console.error('[LeaveRequests] ❌ Failed to load');
          setError(actualResponse.message || 'Không thể tải danh sách đơn nghỉ phép');
        }
      } catch (err) {
        console.error('[LeaveRequests] Load leave requests error:', err);
        setError('Có lỗi xảy ra khi tải dữ liệu');
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [selectedClassId, teacherClasses, currentPage, searchQuery]
  );

  const loadStudentPhotos = useCallback(async (requests: LeaveRequest[]) => {
    try {
      const photoPromises = requests.map(async (request) => {
        try {
          const response = await leaveService.getStudentPhoto(request.student_id);
          return {
            studentId: request.student_id,
            photoUrl: response.success && response.data ? response.data.photo_url : null,
          };
        } catch (error) {
          console.error(`Error loading photo for student ${request.student_id}:`, error);
          return {
            studentId: request.student_id,
            photoUrl: null,
          };
        }
      });

      const photoResults = await Promise.all(photoPromises);
      const photoMap: Record<string, string | null> = {};

      photoResults.forEach(({ studentId, photoUrl }) => {
        photoMap[studentId] = photoUrl;
      });

      setStudentPhotos(photoMap);
    } catch (error) {
      console.error('Error loading student photos:', error);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await loadLeaveRequests(false);
    setRefreshing(false);
  }, [loadLeaveRequests]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getAvatarInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Group leave requests by submission date (like parent portal)
  const getGroupedRequestsByDate = () => {
    const grouped: Record<string, LeaveRequest[]> = {};

    leaveRequests.forEach((request) => {
      const date = new Date(request.submitted_at || request.creation);
      const dateKey = formatShortDate(date.toISOString());

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(request);
    });

    // Sort dates in descending order (newest first)
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      const dateA = new Date(a.split('/').reverse().join('-'));
      const dateB = new Date(b.split('/').reverse().join('-'));
      return dateB.getTime() - dateA.getTime();
    });

    return sortedDates.map((date) => ({
      date,
      requests: grouped[date].sort(
        (a, b) =>
          new Date(b.submitted_at || b.creation).getTime() -
          new Date(a.submitted_at || a.creation).getTime()
      ),
    }));
  };

  const getReasonDisplay = (reason: string) => {
    const reasonMap: { [key: string]: string } = {
      sick_child: 'Con ốm',
      family_matters: 'Gia đình có việc bận',
      other: 'Lý do khác',
    };
    return reasonMap[reason] || reason;
  };

  // Load class titles for display
  useEffect(() => {
    (async () => {
      try {
        if (teacherClasses.length === 0) return;

        console.log('[LeaveRequests] Fetching titles for', teacherClasses.length, 'classes');

        const token = await AsyncStorage.getItem('authToken');
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        const map: Record<string, string> = {};
        let successCount = 0;
        let failCount = 0;

        for (const classId of teacherClasses) {
          try {
            const res = await fetch(
              `${API_BASE_URL}/api/method/erp.api.erp_sis.sis_class.get_class?name=${encodeURIComponent(classId)}`,
              { headers }
            );

            if (!res.ok) {
              failCount++;
              map[classId] = classId.replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
              continue;
            }

            const json = await res.json();
            const cls = json?.message?.data || json?.data;

            if (cls) {
              const title =
                cls.short_title ||
                cls.title ||
                cls.class_name ||
                classId.replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
              map[classId] = title;
              successCount++;
            } else {
              failCount++;
              map[classId] = classId.replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
            }
          } catch (err) {
            console.error('[LeaveRequests] Exception fetching class:', classId, err);
            failCount++;
            map[classId] = classId.replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
          }
        }

        console.log(
          '[LeaveRequests] Fetch complete:',
          successCount,
          'success,',
          failCount,
          'failed'
        );
        setClassTitles(map);
      } catch (e) {
        console.error('[LeaveRequests] Failed to fetch class titles:', e);
      }
    })();
  }, [teacherClasses]);

  // Load leave requests when teacher classes are loaded or when selected class changes
  useEffect(() => {
    if (selectedClassId || teacherClasses.length > 0) {
      console.log(
        '[LeaveRequests] Teacher classes or selectedClassId changed, loading leave requests'
      );
      loadLeaveRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, teacherClasses.length]); // Remove loadLeaveRequests from dependencies to avoid loop

  // Get display title for a class
  const getClassTitle = (classId: string): string => {
    if (classTitles[classId]) return classTitles[classId];
    return String(classId)
      .replace(/^SIS-CLASS-/, '')
      .replace(/^CLASS-/, '');
  };

  // Handle opening a specific class
  const handleOpenClass = (classId: string) => {
    navigation.navigate(ROUTES.SCREENS.LEAVE_REQUESTS, { classId });
  };

  // Handle going back to class list
  const handleBackToList = () => {
    navigation.setParams({ classId: undefined });
  };

  useEffect(() => {
    if (leaveRequests.length > 0) {
      loadStudentPhotos(leaveRequests);
    }
  }, [leaveRequests, loadStudentPhotos]);

  // Handle focus effect to refresh data when coming back to screen
  useFocusEffect(
    useCallback(() => {
      console.log('[LeaveRequests] Screen focused, refreshing data...');

      // Just refresh teacher classes, the useEffect below will handle loading leave requests
      loadTeacherClasses();
    }, [loadTeacherClasses])
  );

  if (loading && !refreshing && selectedClassId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F05023" />
          <Text className="mt-4 text-gray-500">Đang tải dữ liệu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !selectedClassId && teacherClasses.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center p-6">
          <MaterialIcons name="error-outline" size={64} color="#EF4444" />
          <Text className="mt-4 text-center font-medium text-red-500">{error}</Text>
          <TouchableOpacity
            className="mt-6 rounded-lg bg-blue-500 px-6 py-3"
            onPress={() => navigation.goBack()}>
            <Text className="font-medium text-white">Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-5 pt-6">
        <View className="mb-5 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={selectedClassId ? handleBackToList : () => navigation.goBack()}
            className="-ml-2 p-2 pr-4">
            <Ionicons name="chevron-back" size={24} color="#0A2240" />
          </TouchableOpacity>
          <Text className="-ml-8 flex-1 text-center font-bold text-2xl text-[#0A2240]">
            {selectedClassId ? `Lớp ${getClassTitle(selectedClassId)}` : 'Đơn từ'}
          </Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      {selectedClassId ? (
        // View for specific class - show leave requests
        <ScrollView
          className="flex-1 bg-white"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {/* Search Bar */}
          <View className="mx-4 mt-4">
            <View className="flex-row items-center rounded-lg bg-gray-100 px-3 py-3">
              <Feather name="search" size={18} color="#6B7280" />
              <TextInput
                className="ml-2 flex-1 text-gray-700"
                placeholder="Tìm kiếm học sinh, lý do..."
                value={searchQuery}
                onChangeText={handleSearch}
              />
            </View>
          </View>

          {/* Leave Requests List - Grouped by Date */}
          <View className="mx-4 mb-6 mt-4">
            {leaveRequests.length === 0 ? (
              <View className="items-center p-8">
                <MaterialIcons name="description" size={64} color="#D1D5DB" />
                <Text className="mt-4 font-medium text-lg text-gray-900">
                  {searchQuery ? 'Không tìm thấy đơn nghỉ phép nào' : 'Chưa có đơn nghỉ phép nào'}
                </Text>
                <Text className="mt-2 text-center text-gray-500">
                  {searchQuery
                    ? 'Không có đơn nghỉ phép nào phù hợp với từ khóa tìm kiếm.'
                    : 'Học sinh trong lớp này chưa gửi đơn nghỉ phép nào.'}
                </Text>
              </View>
            ) : (
              <View className="space-y-6">
                {getGroupedRequestsByDate().map((group) => (
                  <View key={group.date} className="space-y-3">
                    {/* Date Header */}
                    <View className="flex-row items-center">
                      <Text className="font-bold text-lg text-[#002855]">{group.date}</Text>
                    </View>

                    {/* Cards for this date */}
                    <View className="space-y-4">
                      {group.requests.map((request) => (
                        <View
                          key={request.name}
                          className="rounded-lg bg-[#FAFAFA] p-4"
                          style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                          }}>
                          {/* Student & Parent Info - Two Columns */}
                          <View className="mb-3">
                            <View className="flex-row">
                              {/* Student Column */}
                              <View className="flex-1 px-2">
                                <Text className="text-center text-sm text-gray-600">Học sinh:</Text>
                                <Text
                                  style={{ width: '100%' }}
                                  className="text-center font-semibold text-base text-gray-900"
                                  numberOfLines={1}
                                  ellipsizeMode="tail">
                                  {request.student_name}
                                </Text>
                                <Text className="text-center text-xs text-gray-500">
                                  {request.student_code}
                                </Text>
                              </View>

                              {/* Separator */}
                              <View className="items-center justify-center px-2">
                                <View className="h-12 w-px bg-gray-300"></View>
                              </View>

                              {/* Parent Column */}
                              <View className="flex-1 px-2">
                                <Text className="text-center text-sm text-gray-600">
                                  Người tạo:
                                </Text>
                                <Text
                                  style={{ width: '100%' }}
                                  className="text-center font-semibold text-base text-gray-900"
                                  numberOfLines={1}
                                  ellipsizeMode="tail">
                                  {request.parent_name}
                                </Text>
                                <Text className="text-center text-xs text-gray-500">Phụ huynh</Text>
                              </View>
                            </View>
                          </View>

                          {/* Date Range - Similar to Parent Portal */}
                          <View className="mb-3">
                            <View className="flex-row">
                              {/* Start Date */}
                              <View className="flex-1 items-center text-center">
                                <Text className="text-sm text-gray-600">Ngày bắt đầu</Text>
                                <Text className="font-bold text-base text-[#009483]">
                                  {formatShortDate(request.start_date)}
                                </Text>
                              </View>

                              {/* Separator */}
                              <View className="items-center justify-center px-2">
                                <View className="h-8 w-px bg-gray-300"></View>
                              </View>

                              {/* End Date */}
                              <View className="flex-1 items-center text-center">
                                <Text className="text-sm text-gray-600">Ngày kết thúc</Text>
                                <Text className="font-bold text-base text-[#F05023]">
                                  {formatShortDate(request.end_date)}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Reason - In a box like parent portal */}
                          <View className="space-y-1">
                            <Text className="font-medium text-sm text-gray-900">Lý do:</Text>
                            <View className="rounded-md bg-[#F6F6F6] p-3">
                              <Text className="font-semibold text-sm text-[#002855]">
                                {getReasonDisplay(request.reason)}
                              </Text>
                              {request.other_reason && (
                                <Text className="mt-1 text-xs text-gray-600">
                                  {request.other_reason}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        // Class selection view - show grid of classes
        <ScrollView className="flex-1">
          {teacherClasses.length === 0 ? (
            <Text className="mt-10 text-center text-gray-500">Không có lớp chủ nhiệm</Text>
          ) : (
            <View className="mt-[5%] flex-row flex-wrap justify-between gap-y-3 px-5">
              {teacherClasses.map((cls) => (
                <View key={cls} style={{ width: '48%' }}>
                  <Card
                    title={`Lớp ${getClassTitle(cls)}`}
                    subtitle="Chủ nhiệm"
                    onPress={() => handleOpenClass(cls)}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default LeaveRequestsScreen;
