/**
 * Bus Trip Detail Screen
 * Shows trip details and student list with status
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  busService,
  type TripDetailResponse,
  type BusDailyTripStudent,
} from '../../services/busService';

// Status options for the dropdown
const STATUS_OPTIONS = [
  { value: 'Not Boarded', label: 'Chưa lên xe', color: '#FFCE02', textColor: '#000000' },
  { value: 'Boarded', label: 'Đã lên xe', color: '#82D232', textColor: '#FFFFFF' },
  { value: 'Dropped Off', label: 'Đã xuống xe', color: '#82D232', textColor: '#FFFFFF' },
  { value: 'Absent', label: 'Vắng không phép', color: '#FA4D09', textColor: '#FFFFFF' },
  { value: 'Absent_Permitted', label: 'Vắng có phép', color: '#9CA3AF', textColor: '#FFFFFF' },
];

type RootStackParamList = {
  BusTripDetail: { tripId: string };
  BusAttendance: { tripId: string; tripType: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'BusTripDetail'>;

const POLLING_INTERVAL = 5000; // 5 seconds

const BusTripDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { tripId } = route.params;

  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<BusDailyTripStudent | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const loadTripDetail = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await busService.getDailyTripDetail(tripId);

        if (response.success && response.data) {
          setTripDetail(response.data);
        } else {
          setError(response.message || 'Không thể tải chi tiết chuyến xe');
        }
      } catch {
        setError('Có lỗi xảy ra khi tải dữ liệu');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [tripId]
  );

  // Initial load
  useEffect(() => {
    loadTripDetail();
  }, [loadTripDetail]);

  // Polling when trip is In Progress
  useEffect(() => {
    if (tripDetail?.trip_status === 'In Progress') {
      pollingRef.current = setInterval(() => {
        loadTripDetail(false);
      }, POLLING_INTERVAL);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [tripDetail?.trip_status, loadTripDetail]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadTripDetail(false);
  }, [loadTripDetail]);

  const handleStartTrip = async () => {
    Alert.alert('Bắt đầu chuyến xe', 'Bạn có chắc chắn muốn bắt đầu chuyến xe này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Bắt đầu',
        onPress: async () => {
          setIsStarting(true);
          try {
            const response = await busService.startTrip(tripId);
            if (response.success) {
              loadTripDetail(false);
            } else {
              Alert.alert('Lỗi', response.message || 'Không thể bắt đầu chuyến xe');
            }
          } catch {
            Alert.alert('Lỗi', 'Có lỗi xảy ra');
          } finally {
            setIsStarting(false);
          }
        },
      },
    ]);
  };

  const handleCompleteTrip = async () => {
    setIsCompleting(true);
    try {
      const response = await busService.completeTrip(tripId, false);

      if (response.success) {
        loadTripDetail(false);
        Alert.alert('Thành công', 'Đã hoàn thành chuyến xe');
      } else if (response.warnings && response.can_force) {
        Alert.alert(
          'Cảnh báo',
          response.warnings.join('\n') + '\n\nBạn có muốn tiếp tục hoàn thành?',
          [
            { text: 'Hủy', style: 'cancel' },
            {
              text: 'Hoàn thành',
              style: 'destructive',
              onPress: async () => {
                const forceResponse = await busService.completeTrip(tripId, true);
                if (forceResponse.success) {
                  loadTripDetail(false);
                  Alert.alert('Thành công', 'Đã hoàn thành chuyến xe');
                } else {
                  Alert.alert('Lỗi', forceResponse.message || 'Không thể hoàn thành');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Lỗi', response.message || 'Không thể hoàn thành chuyến xe');
      }
    } catch {
      Alert.alert('Lỗi', 'Có lỗi xảy ra');
    } finally {
      setIsCompleting(false);
    }
  };

  const getStatusColor = (status: string, absentReason?: string) => {
    switch (status) {
      case 'Not Boarded':
        return '#FFCE02'; // Yellow
      case 'Boarded':
        return '#82D232'; // Green
      case 'Dropped Off':
        return '#82D232'; // Green
      case 'Absent':
        // Check if permitted or not
        if (absentReason === 'Nghỉ phép' || absentReason === 'School Leave') {
          return '#9CA3AF'; // Gray for permitted
        }
        return '#FA4D09'; // Orange-red for not permitted
      default:
        return '#FFCE02';
    }
  };

  const getStatusTextColor = (status: string, absentReason?: string) => {
    switch (status) {
      case 'Not Boarded':
        return '#000000'; // Black text on yellow
      case 'Boarded':
      case 'Dropped Off':
      case 'Absent':
        return '#FFFFFF'; // White text
      default:
        return '#000000';
    }
  };

  const getStatusText = (status: string, tripType?: string, absentReason?: string) => {
    switch (status) {
      case 'Not Boarded':
        return tripType === 'Trả' ? 'Chưa xuống' : 'Chưa lên';
      case 'Boarded':
        return 'Đã lên xe';
      case 'Dropped Off':
        return 'Đã xuống xe';
      case 'Absent':
        if (absentReason === 'Nghỉ phép' || absentReason === 'School Leave') {
          return 'Vắng có phép';
        }
        return 'Vắng không phép';
      default:
        return status;
    }
  };

  // Handle opening status modal
  const handleOpenStatusModal = (student: BusDailyTripStudent) => {
    setSelectedStudent(student);
    setStatusModalVisible(true);
  };

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedStudent) return;

    setIsUpdatingStatus(true);
    try {
      let absentReason: string | undefined;
      let actualStatus = newStatus;

      // Handle "Absent_Permitted" as Absent with reason
      if (newStatus === 'Absent_Permitted') {
        actualStatus = 'Absent';
        absentReason = 'Nghỉ phép';
      } else if (newStatus === 'Absent') {
        absentReason = 'Nghỉ học';
      }

      const response = await busService.updateStudentStatus(
        selectedStudent.name,
        actualStatus as any,
        absentReason
      );

      if (response.success) {
        loadTripDetail(false);
        setStatusModalVisible(false);
      } else {
        Alert.alert('Lỗi', response.message || 'Không thể cập nhật trạng thái');
      }
    } catch {
      Alert.alert('Lỗi', 'Có lỗi xảy ra');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getTripStatusColor = (status: string) => {
    switch (status) {
      case 'Not Started':
        return '#6B7280';
      case 'In Progress':
        return '#3B82F6';
      case 'Completed':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const getTripStatusText = (status: string) => {
    switch (status) {
      case 'Not Started':
        return 'Chưa bắt đầu';
      case 'In Progress':
        return 'Đang thực hiện';
      case 'Completed':
        return 'Hoàn thành';
      default:
        return status;
    }
  };

  const renderStudentCard = (student: BusDailyTripStudent) => {
    const statusColor = getStatusColor(student.student_status, student.absent_reason);
    const statusTextColor = getStatusTextColor(student.student_status, student.absent_reason);
    const statusText = getStatusText(
      student.student_status,
      tripDetail?.trip_type,
      student.absent_reason
    );

    // Get avatar URL or use placeholder
    const avatarUrl = student.photo_url;
    const initials = student.student_name
      ? student.student_name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase()
      : '?';

    return (
      <View key={student.name} style={styles.studentCard}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Student Info */}
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student.student_name}</Text>
          <Text style={styles.studentClass}>
            {student.student_code} • {student.class_name || 'N/A'}
          </Text>
          {student.pickup_location && tripDetail?.trip_type === 'Đón' && (
            <Text style={styles.locationText} numberOfLines={1}>
              📍 {student.pickup_location}
            </Text>
          )}
          {student.drop_off_location && tripDetail?.trip_type === 'Trả' && (
            <Text style={styles.locationText} numberOfLines={1}>
              📍 {student.drop_off_location}
            </Text>
          )}
        </View>

        {/* Status Badge - Clickable */}
        <TouchableOpacity
          style={[styles.statusBadge, { backgroundColor: statusColor }]}
          onPress={() => handleOpenStatusModal(student)}
          activeOpacity={0.7}>
          <Text style={[styles.statusBadgeText, { color: statusTextColor }]}>{statusText}</Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={statusTextColor}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#002855" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  if (error || !tripDetail) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error || 'Không tìm thấy chuyến xe'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadTripDetail()}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#002855" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{tripDetail.route_name}</Text>
          <Text style={styles.headerSubtitle}>
            {tripDetail.trip_type === 'Đón' ? 'Chiều đón' : 'Chiều trả'} • {tripDetail.weekday}
          </Text>
        </View>
        <View
          style={[
            styles.tripStatusBadge,
            { backgroundColor: getTripStatusColor(tripDetail.trip_status) },
          ]}>
          <Text style={styles.tripStatusText}>{getTripStatusText(tripDetail.trip_status)}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}>
        {/* Trip Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="bus" size={20} color="#6B7280" />
            <Text style={styles.infoLabel}>Xe:</Text>
            <Text style={styles.infoValue}>
              {tripDetail.bus_number || 'N/A'}{' '}
              {tripDetail.license_plate ? `• ${tripDetail.license_plate}` : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color="#6B7280" />
            <Text style={styles.infoLabel}>Tài xế:</Text>
            <Text style={styles.infoValue}>
              {tripDetail.driver_name || 'N/A'}{' '}
              {tripDetail.driver_phone ? `• ${tripDetail.driver_phone}` : ''}
            </Text>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{tripDetail.statistics.total_students}</Text>
            <Text style={styles.statLabel}>Tổng</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#DBEAFE' }]}>
            <Text style={[styles.statNumber, { color: '#3B82F6' }]}>
              {tripDetail.statistics.boarded}
            </Text>
            <Text style={styles.statLabel}>Lên xe</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>
              {tripDetail.statistics.dropped_off}
            </Text>
            <Text style={styles.statLabel}>Xuống xe</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>
              {tripDetail.statistics.absent}
            </Text>
            <Text style={styles.statLabel}>Vắng</Text>
          </View>
        </View>

        {/* Warnings */}
        {tripDetail.warnings && tripDetail.warnings.length > 0 && (
          <View style={styles.warningsContainer}>
            {tripDetail.warnings.map((warning, index) => (
              <View key={index} style={styles.warningItem}>
                <Ionicons name="warning" size={16} color="#F59E0B" />
                <Text style={styles.warningText}>{warning}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Student List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Danh sách học sinh</Text>
          <Text style={styles.sectionCount}>{tripDetail.statistics.total_students} học sinh</Text>
        </View>

        {/* Sort theo pickup_order để hiển thị đúng thứ tự đón/trả */}
        {[...tripDetail.students]
          .sort((a, b) => (a.pickup_order || 0) - (b.pickup_order || 0))
          .map((student) => renderStudentCard(student))}
      </ScrollView>

      {/* Status Selection Modal */}
      <Modal
        visible={statusModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setStatusModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cập nhật trạng thái</Text>
              {selectedStudent && (
                <Text style={styles.modalSubtitle}>{selectedStudent.student_name}</Text>
              )}
            </View>

            {isUpdatingStatus ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#002855" />
                <Text style={styles.modalLoadingText}>Đang cập nhật...</Text>
              </View>
            ) : (
              <View style={styles.modalOptions}>
                {STATUS_OPTIONS.map((option) => {
                  // Filter options based on trip type
                  if (tripDetail?.trip_type === 'Đón' && option.value === 'Dropped Off')
                    return null;
                  if (tripDetail?.trip_type === 'Trả' && option.value === 'Boarded') return null;

                  const isSelected =
                    selectedStudent?.student_status === option.value ||
                    (option.value === 'Absent_Permitted' &&
                      selectedStudent?.student_status === 'Absent' &&
                      (selectedStudent?.absent_reason === 'Nghỉ phép' ||
                        (selectedStudent?.absent_reason as string) === 'School Leave'));

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.modalOption,
                        { backgroundColor: option.color },
                        isSelected && styles.modalOptionSelected,
                      ]}
                      onPress={() => handleStatusChange(option.value)}>
                      <Text style={[styles.modalOptionText, { color: option.textColor }]}>
                        {option.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={20} color={option.textColor} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setStatusModalVisible(false)}>
              <Text style={styles.modalCancelText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {tripDetail.trip_status === 'Not Started' && (
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartTrip}
            disabled={isStarting}>
            {isStarting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="play" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Bắt đầu chuyến</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {tripDetail.trip_status === 'In Progress' && (
          <View style={styles.inProgressActions}>
            <TouchableOpacity
              style={styles.attendanceButton}
              onPress={() =>
                navigation.navigate('BusAttendance', { tripId, tripType: tripDetail.trip_type })
              }>
              <Ionicons name="camera" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Điểm danh</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleCompleteTrip}
              disabled={isCompleting}>
              {isCompleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Hoàn thành</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {tripDetail.trip_status === 'Completed' && (
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.completedText}>Chuyến xe đã hoàn thành</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#002855',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  tripStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tripStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F3F4F6',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#002855',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    width: 60,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  warningsContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sectionCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  studentClass: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 100,
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  modalOptions: {
    padding: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  modalOptionSelected: {
    borderWidth: 2,
    borderColor: '#002855',
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalCancelButton: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#002855',
    borderRadius: 12,
    padding: 16,
  },
  inProgressActions: {
    flexDirection: 'row',
    gap: 12,
  },
  attendanceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
  },
  completedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 8,
  },
});

export default BusTripDetailScreen;
