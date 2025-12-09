// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { leaveService, type LeaveRequest } from '../../services/leaveService';
import { Ionicons, MaterialIcons, Feather, AntDesign } from '@expo/vector-icons';
import { formatShortDate } from '../../utils/dateUtils';
import { normalizeVietnameseName } from '../../utils/nameFormatter';

type LeaveRequestsDetailNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.LEAVE_REQUESTS_DETAIL
>;

const LeaveRequestsDetailScreen = () => {
  const navigation = useNavigation<LeaveRequestsDetailNavigationProp>();
  const route = useRoute();

  // Get params from route
  const classId = route.params?.classId;
  const classTitle = route.params?.classTitle || '';
  const notificationLeaveRequestId = route.params?.leaveRequestId;
  const fromNotification = route.params?.fromNotification;

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedRequestId, setHighlightedRequestId] = useState<string | null>(
    notificationLeaveRequestId || null
  );
  const limit = 20;

  const getCreatorName = useCallback((request: LeaveRequest) => {
    const isParent = request.is_created_by_parent || request.creator_role === 'Parent';
    const rawName = request.creator_name || request.parent_name || '';
    if (!rawName) return '—';
    return isParent ? rawName : normalizeVietnameseName(rawName);
  }, []);

  const loadLeaveRequests = useCallback(
    async (showLoading = true) => {
      if (!classId) {
        setLoading(false);
        return;
      }

      try {
        if (showLoading) {
          setLoading(true);
        }
        setError(null);

        console.log('[LeaveRequestsDetail] Fetching leave requests for class:', classId);
        const response = await leaveService.getClassLeaveRequests(classId, {
          page: currentPage,
          limit,
          search: searchQuery.trim() || undefined,
        });

        // Parse response - Frappe API returns data in message field
        const actualResponse = response.message || response;

        console.log('[LeaveRequestsDetail] API Response:', {
          success: actualResponse.success,
          total: actualResponse.data?.total,
          count: actualResponse.data?.leave_requests?.length,
        });

        if (actualResponse.success === true && actualResponse.data) {
          setLeaveRequests(actualResponse.data.leave_requests || []);
          console.log(
            '[LeaveRequestsDetail] ✅ Successfully loaded',
            actualResponse.data.leave_requests?.length,
            'leave requests'
          );
        } else {
          console.error('[LeaveRequestsDetail] ❌ Failed to load');
          setError(actualResponse.message || 'Không thể tải danh sách đơn nghỉ phép');
        }
      } catch (err) {
        console.error('[LeaveRequestsDetail] Load leave requests error:', err);
        setError('Có lỗi xảy ra khi tải dữ liệu');
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [classId, currentPage, searchQuery]
  );

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

  // Group leave requests by submission date
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

  // Load leave requests on mount
  useEffect(() => {
    if (classId) {
      loadLeaveRequests();
    }
  }, [classId, loadLeaveRequests]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (classId) {
        loadLeaveRequests(false);
      }
    }, [classId, loadLeaveRequests])
  );

  // Handle creating new leave request
  const handleCreateLeaveRequest = () => {
    if (classId) {
      navigation.navigate(ROUTES.SCREENS.CREATE_LEAVE_REQUEST, {
        classId,
        classTitle: classTitle || `Lớp ${classId}`,
      });
    }
  };

  // Handle editing leave request
  const handleEditLeaveRequest = (request: LeaveRequest) => {
    navigation.navigate(ROUTES.SCREENS.CREATE_LEAVE_REQUEST, {
      classId,
      classTitle: classTitle || undefined,
      leaveId: request.name,
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#000" />
          <Text className="mt-3 text-sm text-gray-400">Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
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
          <Text className="flex-1 text-center text-2xl font-bold text-[#0A2240]">
            {classTitle || 'Chi tiết lớp'}
          </Text>
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
            <View className="space-y-6">
              {getGroupedRequestsByDate().map((group) => (
                <View key={group.date} className="space-y-3">
                  {/* Date Header */}
                  <View className="flex-row items-center">
                    <Text className="text-lg font-bold text-[#002855]">{group.date}</Text>
                  </View>

                  {/* Cards for this date */}
                  <View className="space-y-4">
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
                          {/* Student & Parent Info - Two Columns */}
                          <View className="mb-3">
                            <View className="flex-row">
                              {/* Student Column */}
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

                              {/* Separator */}
                              <View className="items-center justify-center px-2">
                                <View className="h-12 w-px bg-gray-300"></View>
                              </View>

                              {/* Creator Column */}
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

                          {/* Date Range */}
                          <View className="mb-3">
                            <View className="flex-row">
                              {/* Start Date */}
                              <View className="flex-1 items-center text-center">
                                <Text className="text-sm text-gray-600">Ngày bắt đầu</Text>
                                <Text className="text-base font-bold text-[#009483]">
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
                                <Text className="text-base font-bold text-[#F05023]">
                                  {formatShortDate(request.end_date)}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Reason */}
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

                          {/* Edit Indicator */}
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

export default LeaveRequestsDetailScreen;
