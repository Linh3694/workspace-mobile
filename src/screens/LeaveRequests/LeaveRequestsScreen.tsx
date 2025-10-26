// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
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

type LeaveRequestsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.MAIN
>;

const TabHeader = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
  <View className="flex-1 items-center">
    <TouchableOpacity onPress={onPress}>
      <Text className={`text-center ${active ? 'font-bold text-[#002855]' : 'text-gray-500'}`}>{label}</Text>
      {active && <View className="mt-2 h-0.5 bg-[#002855]" />}
    </TouchableOpacity>
  </View>
);

const Card = ({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress: () => void }) => (
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
      const homeroomStr = await AsyncStorage.getItem('teacherHomeroomClassIds');
      const viceStr = await AsyncStorage.getItem('teacherViceHomeroomClassIds');

      const homeroom = homeroomStr ? JSON.parse(homeroomStr) : [];
      const vice = viceStr ? JSON.parse(viceStr) : [];

      setHomeroomClasses(homeroom);
      setViceClasses(vice);
    } catch (error) {
      console.error('Error loading teacher classes:', error);
      setHomeroomClasses([]);
      setViceClasses([]);
    }
  }, []);

  useEffect(() => {
    loadTeacherClasses();
  }, [loadTeacherClasses]);

  // Combine homeroom and vice classes (classes where teacher is homeroom or vice homeroom)
  const teacherClasses = useMemo(() => {
    return Array.from(new Set([...homeroomClasses, ...viceClasses]));
  }, [homeroomClasses, viceClasses]);

  const loadLeaveRequests = useCallback(async (showLoading = true) => {
    if (!selectedClassId && teacherClasses.length === 0) {
      // Still loading classes, don't show error yet
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
        response = await leaveService.getClassLeaveRequests(selectedClassId, {
          page: currentPage,
          limit,
          search: searchQuery.trim() || undefined
        });
      } else {
        // Load leave requests for all teacher classes
        response = await leaveService.getAllTeacherLeaveRequests(teacherClasses, {
          page: currentPage,
          limit,
          search: searchQuery.trim() || undefined
        });
      }

      if (response.success && response.data) {
        setLeaveRequests(response.data.leave_requests || []);
        setTotal(response.data.total || 0);
        setTotalPages(response.data.total_pages || 1);
      } else {
        setError(response.message || 'Không thể tải danh sách đơn nghỉ phép');
      }
    } catch (err) {
      console.error('Load leave requests error:', err);
      setError('Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [selectedClassId, teacherClasses, currentPage, searchQuery]);

  const loadStudentPhotos = useCallback(async (requests: LeaveRequest[]) => {
    try {
      const photoPromises = requests.map(async (request) => {
        try {
          const response = await leaveService.getStudentPhoto(request.student_id);
          return {
            studentId: request.student_id,
            photoUrl: response.success && response.data ? response.data.photo_url : null
          };
        } catch (error) {
          console.error(`Error loading photo for student ${request.student_id}:`, error);
          return {
            studentId: request.student_id,
            photoUrl: null
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
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
              const title = cls.short_title || cls.title || cls.class_name || classId.replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
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

        console.log('[LeaveRequests] Fetch complete:', successCount, 'success,', failCount, 'failed');
        setClassTitles(map);
      } catch (e) {
        console.error('[LeaveRequests] Failed to fetch class titles:', e);
      }
    })();
  }, [teacherClasses]);

  useEffect(() => {
    if (selectedClassId || teacherClasses.length > 0) {
      loadLeaveRequests();
    }
  }, [selectedClassId, teacherClasses.length, loadLeaveRequests]);

  // Get display title for a class
  const getClassTitle = (classId: string): string => {
    if (classTitles[classId]) return classTitles[classId];
    return String(classId).replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
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
      if (selectedClassId || teacherClasses.length > 0) {
        loadLeaveRequests(false);
      }
    }, [selectedClassId, teacherClasses.length, loadLeaveRequests])
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
          <Text className="mt-4 text-center text-red-500 font-medium">{error}</Text>
          <TouchableOpacity
            className="mt-6 bg-blue-500 px-6 py-3 rounded-lg"
            onPress={() => navigation.goBack()}>
            <Text className="text-white font-medium">Quay lại</Text>
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
            className="p-2 pr-4 -ml-2">
            <Ionicons name="chevron-back" size={24} color="#0A2240" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-[#0A2240] text-center flex-1 -ml-8">
            {selectedClassId ? `Lớp ${getClassTitle(selectedClassId)}` : 'Đơn từ'}
          </Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      {selectedClassId ? (
        // View for specific class - show leave requests
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>

          {/* Search Bar */}
          <View className="mx-4 mt-4 p-4">
            <View className="flex-row items-center bg-gray-100 px-3 py-2 rounded-lg">
              <Feather name="search" size={18} color="#6B7280" />
              <TextInput
                className="flex-1 ml-2 text-gray-700"
                placeholder="Tìm kiếm học sinh, lý do..."
                value={searchQuery}
                onChangeText={handleSearch}
              />
            </View>
          </View>

        {/* Leave Requests List */}
        <View className="mx-4 mt-4">
          {leaveRequests.length === 0 ? (
            <View className="p-8 items-center">
              <MaterialIcons name="description" size={64} color="#D1D5DB" />
              <Text className="mt-4 text-lg font-medium text-gray-900">
                {searchQuery ? 'Không tìm thấy đơn nghỉ phép nào' : 'Chưa có đơn nghỉ phép nào'}
              </Text>
              <Text className="mt-2 text-center text-gray-500">
                {searchQuery
                  ? 'Không có đơn nghỉ phép nào phù hợp với từ khóa tìm kiếm.'
                  : 'Học sinh trong lớp này chưa gửi đơn nghỉ phép nào.'
                }
              </Text>
            </View>
          ) : (
            <View className="space-y-3">
              {leaveRequests.map((request) => (
                <View key={request.name} className="bg-white p-4 rounded-lg shadow-sm">
                  {/* Student Info */}
                  <View className="flex-row items-center mb-3">
                    <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-3">
                      {studentPhotos[request.student_id] ? (
                        <Image
                          source={{ uri: studentPhotos[request.student_id]! }}
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <Text className="text-blue-600 font-bold text-sm">
                          {getAvatarInitials(request.student_name)}
                        </Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-900">{request.student_name}</Text>
                      <Text className="text-sm text-gray-500">{request.student_code}</Text>
                    </View>
                  </View>

                  {/* Parent Info */}
                  <View className="flex-row items-center mb-3">
                    <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-3">
                      <MaterialIcons name="person" size={16} color="#6B7280" />
                    </View>
                    <View>
                      <Text className="font-medium text-gray-700">{request.parent_name}</Text>
                      <Text className="text-xs text-gray-500">Phụ huynh</Text>
                    </View>
                  </View>

                  {/* Reason */}
                  <View className="mb-3">
                    <Text className="font-medium text-gray-700 mb-1">Lý do:</Text>
                    <Text className="text-gray-900">{request.reason_display}</Text>
                    {request.other_reason && (
                      <Text className="text-sm text-gray-600 mt-1">
                        {request.other_reason}
                      </Text>
                    )}
                  </View>

                  {/* Dates */}
                  <View className="flex-row items-center mb-3">
                    <MaterialIcons name="calendar-today" size={16} color="#6B7280" />
                    <View className="ml-2 flex-1">
                      <Text className="font-medium text-gray-700">
                        {formatShortDate(request.start_date)}
                        {' - '}
                        {formatShortDate(request.end_date)}
                      </Text>
                      <Text className="text-sm text-gray-500">
                        {request.total_days} ngày
                      </Text>
                    </View>
                  </View>

                  {/* Submitted Date */}
                  {request.submitted_at && (
                    <View className="flex-row items-center">
                      <MaterialIcons name="access-time" size={16} color="#6B7280" />
                      <Text className="ml-2 text-sm text-gray-500">
                        Gửi ngày {formatFullDate(request.submitted_at)}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Pagination */}
        {totalPages > 1 && (
          <View className="flex-row items-center justify-center py-6">
            <TouchableOpacity
              className={`px-4 py-2 rounded-lg mr-2 ${currentPage <= 1 ? 'bg-gray-200' : 'bg-blue-500'}`}
              onPress={() => currentPage > 1 && handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}>
              <Text className={currentPage <= 1 ? 'text-gray-400' : 'text-white'}>Trước</Text>
            </TouchableOpacity>

            <Text className="text-gray-700 mx-4">
              Trang {currentPage} / {totalPages}
            </Text>

            <TouchableOpacity
              className={`px-4 py-2 rounded-lg ml-2 ${currentPage >= totalPages ? 'bg-gray-200' : 'bg-blue-500'}`}
              onPress={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}>
              <Text className={currentPage >= totalPages ? 'text-gray-400' : 'text-white'}>Sau</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom padding */}
        <View className="h-6" />
      </ScrollView>
      ) : (
        // Class selection view - show grid of classes
        <ScrollView className="flex-1">
          {teacherClasses.length === 0 ? (
            <Text className="mt-10 text-center text-gray-500">Không có lớp chủ nhiệm</Text>
          ) : (
            <View className="flex-row flex-wrap justify-between gap-y-3 mt-[5%] px-5">
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
