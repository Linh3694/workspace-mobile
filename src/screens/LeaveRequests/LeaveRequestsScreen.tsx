// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/constants';
import { Ionicons, MaterialIcons, Feather, AntDesign } from '@expo/vector-icons';
import attendanceService from '../../services/attendanceService';
import { leaveService, type LeaveRequest } from '../../services/leaveService';
import { formatShortDate } from '../../utils/dateUtils';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LeaveRequestsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.LEAVE_REQUESTS
>;

const LeaveRequestsScreen = () => {
  const navigation = useNavigation<LeaveRequestsNavigationProp>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Params từ route (nếu navigate từ notification)
  const initialClassId = route.params?.classId;
  const notificationLeaveRequestId = route.params?.leaveRequestId;
  const fromNotification = route.params?.fromNotification;

  const [loading, setLoading] = useState(true);
  const [classTitles, setClassTitles] = useState<Record<string, string>>({});
  const [homeroomClasses, setHomeroomClasses] = useState<string[]>([]);
  const [viceClasses, setViceClasses] = useState<string[]>([]);

  // Lớp đang chọn - có thể từ params hoặc state
  const [selectedClassId, setSelectedClassId] = useState<string | null>(initialClassId || null);
  const [showClassPicker, setShowClassPicker] = useState(false);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedRequestId, setHighlightedRequestId] = useState<string | null>(
    notificationLeaveRequestId || null
  );
  const limit = 20;

  // Load danh sách lớp của giáo viên
  const loadTeacherClasses = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[LeaveRequests] Loading teacher classes...');

      if (user?.email) {
        try {
          let assigns = await attendanceService.fetchTeacherClassAssignments(user.email);

          if (!assigns) {
            assigns = await attendanceService.syncTeacherAssignmentsLikeWeb(user.email || user._id);
          }

          if (assigns) {
            const homeroom = assigns.homeroom_class_ids || [];
            const vice = assigns.vice_homeroom_class_ids || [];

            await AsyncStorage.setItem('teacherHomeroomClassIds', JSON.stringify(homeroom));
            await AsyncStorage.setItem('teacherViceHomeroomClassIds', JSON.stringify(vice));

            setHomeroomClasses(homeroom);
            setViceClasses(vice);
            setLoading(false);
            return;
          }
        } catch (syncError) {
          console.error('[LeaveRequests] Failed to sync teacher assignments:', syncError);
        }
      }

      const homeroomStr = await AsyncStorage.getItem('teacherHomeroomClassIds');
      const viceStr = await AsyncStorage.getItem('teacherViceHomeroomClassIds');

      const homeroom = homeroomStr ? JSON.parse(homeroomStr) : [];
      const vice = viceStr ? JSON.parse(viceStr) : [];

      setHomeroomClasses(homeroom);
      setViceClasses(vice);
    } catch (error) {
      console.error('[LeaveRequests] Error loading teacher classes:', error);
      setHomeroomClasses([]);
      setViceClasses([]);
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?._id]);

  const teacherClasses = useMemo(() => {
    return Array.from(new Set([...homeroomClasses, ...viceClasses]));
  }, [homeroomClasses, viceClasses]);

  // Khi có leaveRequestId từ notification nhưng chưa có classId - fetch từ API
  useEffect(() => {
    if (
      fromNotification &&
      notificationLeaveRequestId &&
      !initialClassId &&
      teacherClasses.length > 0
    ) {
      leaveService
        .getLeaveRequestDetails(notificationLeaveRequestId)
        .then((res) => {
          const data = (res as any)?.data || (res as any)?.message?.data;
          const classId = data?.class_id;
          if (classId && teacherClasses.includes(classId)) {
            setSelectedClassId(classId);
          }
        })
        .catch(() => {});
    }
  }, [
    fromNotification,
    notificationLeaveRequestId,
    initialClassId,
    teacherClasses,
  ]);

  // Sync selectedClassId khi teacherClasses đã load (lần đầu hoặc từ params)
  useEffect(() => {
    if (teacherClasses.length === 0) return;
    setSelectedClassId((prev) => {
      if (initialClassId && teacherClasses.includes(initialClassId)) {
        return initialClassId;
      }
      if (!prev || !teacherClasses.includes(prev)) {
        return teacherClasses[0];
      }
      return prev;
    });
  }, [teacherClasses, initialClassId]);

  // Load class titles
  useEffect(() => {
    (async () => {
      try {
        if (teacherClasses.length === 0) return;

        const token = await AsyncStorage.getItem('authToken');
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        const map: Record<string, string> = {};

        for (const classId of teacherClasses) {
          try {
            const res = await fetch(
              `${API_BASE_URL}/api/method/erp.api.erp_sis.sis_class.get_class?name=${encodeURIComponent(classId)}`,
              { headers }
            );

            if (!res.ok) {
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
            } else {
              map[classId] = classId.replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
            }
          } catch (err) {
            map[classId] = classId.replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
          }
        }

        setClassTitles(map);
      } catch (e) {
        console.error('[LeaveRequests] Failed to fetch class titles:', e);
      }
    })();
  }, [teacherClasses]);

  const getClassTitle = (classId: string): string => {
    if (classTitles[classId]) return classTitles[classId];
    return String(classId)
      .replace(/^SIS-CLASS-/, '')
      .replace(/^CLASS-/, '');
  };

  const getCreatorName = useCallback((request: LeaveRequest) => {
    const isParent = request.is_created_by_parent || request.creator_role === 'Parent';
    const rawName = request.creator_name || request.parent_name || '';
    if (!rawName) return '—';
    return isParent ? rawName : normalizeVietnameseName(rawName);
  }, []);

  const loadLeaveRequests = useCallback(
    async (showLoading = true) => {
      if (!selectedClassId) {
        setLoading(false);
        return;
      }

      try {
        if (showLoading) {
          setLoading(true);
        }
        setError(null);

        const response = await leaveService.getClassLeaveRequests(selectedClassId, {
          page: currentPage,
          limit,
          search: searchQuery.trim() || undefined,
        });

        const actualResponse = response.message || response;

        if (actualResponse.success === true && actualResponse.data) {
          setLeaveRequests(actualResponse.data.leave_requests || []);
        } else {
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
    [selectedClassId, currentPage, searchQuery]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await loadTeacherClasses();
    await loadLeaveRequests(false);
    setRefreshing(false);
  }, [loadTeacherClasses, loadLeaveRequests]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setCurrentPage(1);
  };

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

  // Load leave requests khi chọn lớp
  useEffect(() => {
    if (selectedClassId) {
      loadLeaveRequests();
    } else {
      setLeaveRequests([]);
    }
  }, [selectedClassId, loadLeaveRequests]);

  useFocusEffect(
    useCallback(() => {
      loadTeacherClasses();
      if (selectedClassId) {
        loadLeaveRequests(false);
      }
    }, [loadTeacherClasses, selectedClassId, loadLeaveRequests])
  );

  const handleCreateLeaveRequest = () => {
    if (selectedClassId) {
      navigation.navigate(ROUTES.SCREENS.CREATE_LEAVE_REQUEST, {
        classId: selectedClassId,
        classTitle: `Lớp ${getClassTitle(selectedClassId)}`,
      });
    }
  };

  const handleEditLeaveRequest = (request: LeaveRequest) => {
    if (selectedClassId) {
      navigation.navigate(ROUTES.SCREENS.CREATE_LEAVE_REQUEST, {
        classId: selectedClassId,
        classTitle: `Lớp ${getClassTitle(selectedClassId)}`,
        leaveId: request.name,
      });
    }
  };

  const currentClassTitle = selectedClassId
    ? `Lớp ${getClassTitle(selectedClassId)}`
    : 'Chọn lớp';
  const hasMultipleClasses = teacherClasses.length > 1;

  // Loading ban đầu
  if (loading && teacherClasses.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#000" />
          <Text className="mt-3 text-sm text-gray-400">Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Không có lớp chủ nhiệm
  if (teacherClasses.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-4 pt-4">
          <View className="mb-4 flex-row items-center">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: -8 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={26} color="#0A2240" />
            </TouchableOpacity>
            <Text className="flex-1 text-center text-2xl font-bold text-[#0A2240]">Đơn từ</Text>
            <View style={{ width: 44 }} />
          </View>
        </View>

        <View className="flex-1 items-center justify-center p-8">
          <MaterialIcons name="class" size={64} color="#D1D5DB" />
          <Text className="mt-4 text-lg font-medium text-gray-900">Không có lớp chủ nhiệm</Text>
          <Text className="mt-2 text-center text-gray-500">
            Bạn chưa được phân công làm giáo viên chủ nhiệm lớp nào.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Chưa chọn lớp (edge case - có lớp nhưng chưa select)
  if (!selectedClassId) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-4 pt-4">
          <View className="mb-4 flex-row items-center">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: -8 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={26} color="#0A2240" />
            </TouchableOpacity>
            <Text className="flex-1 text-center text-2xl font-bold text-[#0A2240]">Đơn từ</Text>
            <View style={{ width: 44 }} />
          </View>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#000" />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-4 pt-4">
          <View className="mb-4 flex-row items-center">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: -8 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={26} color="#0A2240" />
            </TouchableOpacity>
            <Text className="flex-1 text-center text-2xl font-bold text-[#0A2240]">Đơn từ</Text>
            <View style={{ width: 44 }} />
          </View>
        </View>
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
      <View className="px-4 pt-4">
        <View className="mb-4 flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: -8,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color="#0A2240" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-2xl font-bold text-[#0A2240]">Đơn từ</Text>
          <TouchableOpacity
            onPress={handleCreateLeaveRequest}
            style={{
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <AntDesign name="plus" size={24} color="#0A2240" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Nút chọn lớp - badge giống sổ đầu bài / thời khoá biểu */}
      <View className="mb-2 px-4">
        <TouchableOpacity
          onPress={() => hasMultipleClasses && setShowClassPicker(true)}
          activeOpacity={hasMultipleClasses ? 0.7 : 1}
          className="self-center">
          <View
            className="flex-row items-center rounded-full px-4 py-2"
            style={{ backgroundColor: '#E5EAF0' }}>
            <Text className="text-base font-semibold text-[#002855]" numberOfLines={1}>
              {currentClassTitle}
            </Text>
            {hasMultipleClasses && (
              <Ionicons name="chevron-down" size={16} color="#002855" style={{ marginLeft: 6 }} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Modal chọn lớp */}
      <Modal
        visible={showClassPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClassPicker(false)}>
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setShowClassPicker(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              className="rounded-t-3xl bg-white"
              style={{ paddingBottom: insets.bottom + 16 }}>
              <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4">
                <Text className="text-lg font-bold text-[#002855]">Chọn lớp</Text>
                <TouchableOpacity onPress={() => setShowClassPicker(false)} className="p-1">
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView className="max-h-80">
                {teacherClasses.map((cls) => {
                  const isSelected = cls === selectedClassId;
                  return (
                    <TouchableOpacity
                      key={cls}
                      onPress={() => {
                        setSelectedClassId(cls);
                        setShowClassPicker(false);
                      }}
                      className={`flex-row items-center border-b border-gray-50 px-5 py-4 ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}>
                      <View className="flex-1">
                        <Text
                          className={`text-base ${
                            isSelected ? 'font-bold text-[#002855]' : 'text-gray-800'
                          }`}>
                          Lớp {getClassTitle(cls)}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={24} color="#002855" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Search Bar */}
      <View className="mx-4 mt-2">
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

      {/* Danh sách đơn nghỉ phép */}
      <ScrollView
        className="flex-1 bg-white"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View className="mx-4 mb-6 mt-4">
          {loading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="small" color="#000" />
              <Text className="mt-3 text-sm text-gray-400">Đang tải...</Text>
            </View>
          ) : leaveRequests.length === 0 ? (
            <View className="items-center p-8">
              <MaterialIcons name="description" size={64} color="#D1D5DB" />
              <Text className="mt-4 text-lg font-medium text-gray-900">
                {searchQuery ? 'Không tìm thấy đơn nghỉ phép nào' : 'Chưa có đơn nghỉ phép nào'}
              </Text>
              <Text className="mt-2 text-center text-gray-500">
                {searchQuery
                  ? 'Không có đơn nghỉ phép nào phù hợp với từ khóa tìm kiếm.'
                  : 'Học sinh trong lớp này chưa gửi đơn nghỉ phép nào.'}
              </Text>
            </View>
          ) : (
            <View className="gap-8">
              {getGroupedRequestsByDate().map((group) => (
                <View key={group.date} className="space-y-4">
                  <View className="mb-2 flex-row items-center">
                    <Text className="text-lg font-bold text-[#002855]">{group.date}</Text>
                  </View>

                  <View className="gap-4">
                    {group.requests.map((request) => (
                      <TouchableOpacity
                        key={request.name}
                        onPress={() => handleEditLeaveRequest(request)}
                        activeOpacity={0.7}>
                        <View
                          className={`rounded-lg p-4 ${
                            highlightedRequestId === request.name
                              ? 'border-2 border-[#F05023] bg-[#FFF5F2]'
                              : 'bg-[#FAFAFA]'
                          }`}
                          style={{
                            shadowColor: highlightedRequestId === request.name ? '#F05023' : '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: highlightedRequestId === request.name ? 0.15 : 0.05,
                            shadowRadius: highlightedRequestId === request.name ? 4 : 2,
                            elevation: highlightedRequestId === request.name ? 3 : 1,
                          }}>
                          <View className="mb-3">
                            <View className="flex-row">
                              <View className="flex-1 px-2">
                                <Text className="text-center text-sm text-gray-600">Học sinh:</Text>
                                <Text
                                  style={{ width: '100%' }}
                                  className="text-center text-base font-semibold text-gray-900"
                                  numberOfLines={1}
                                  ellipsizeMode="tail">
                                  {request.student_name}
                                </Text>
                                <Text className="text-center text-xs text-gray-500">
                                  {request.student_code}
                                </Text>
                              </View>

                              <View className="items-center justify-center px-2">
                                <View className="h-12 w-px bg-gray-300"></View>
                              </View>

                              <View className="flex-1 px-2">
                                <Text className="text-center text-sm text-gray-600">
                                  {request.is_created_by_parent || request.creator_role === 'Parent'
                                    ? 'Phụ huynh'
                                    : 'Giáo viên'}
                                  :
                                </Text>
                                <Text
                                  style={{ width: '100%' }}
                                  className="text-center text-base font-semibold text-gray-900"
                                  numberOfLines={1}
                                  ellipsizeMode="tail">
                                  {getCreatorName(request)}
                                </Text>
                                <Text className="text-center text-xs text-gray-500">
                                  {request.is_created_by_parent || request.creator_role === 'Parent'
                                    ? 'Phụ huynh'
                                    : 'Giáo viên'}
                                </Text>
                              </View>
                            </View>
                          </View>

                          <View className="mb-3">
                            <View className="flex-row">
                              <View className="flex-1 items-center text-center">
                                <Text className="text-sm text-gray-600">Ngày bắt đầu</Text>
                                <Text className="text-base font-bold text-[#009483]">
                                  {formatShortDate(request.start_date)}
                                </Text>
                              </View>

                              <View className="items-center justify-center px-2">
                                <View className="h-8 w-px bg-gray-300"></View>
                              </View>

                              <View className="flex-1 items-center text-center">
                                <Text className="text-sm text-gray-600">Ngày kết thúc</Text>
                                <Text className="text-base font-bold text-[#F05023]">
                                  {formatShortDate(request.end_date)}
                                </Text>
                              </View>
                            </View>
                          </View>

                          <View className="space-y-1">
                            <Text className="text-sm font-medium text-gray-900">Lý do:</Text>
                            <View className="rounded-md bg-[#F6F6F6] p-3">
                              <Text className="text-sm font-semibold text-[#002855]">
                                {getReasonDisplay(request.reason)}
                              </Text>
                              {request.other_reason && (
                                <Text className="mt-1 text-xs text-gray-600">
                                  {request.other_reason}
                                </Text>
                              )}
                            </View>
                          </View>

                          <View className="mt-3 flex-row items-center justify-end">
                            <Text className="text-xs text-gray-500">Nhấn để xem chi tiết</Text>
                            <Ionicons
                              name="chevron-forward"
                              size={16}
                              color="#6B7280"
                              style={{ marginLeft: 4 }}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LeaveRequestsScreen;
