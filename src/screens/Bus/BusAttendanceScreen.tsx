/**
 * Bus Attendance Screen
 * Face recognition and manual attendance for bus students
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { busService, type TripDetailResponse, type BusDailyTripStudent } from '../../services/busService';

type RootStackParamList = {
  BusAttendance: { tripId: string; tripType: string };
  FaceCamera: { tripId: string; onSuccess: () => void };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'BusAttendance'>;

const POLLING_INTERVAL = 5000;

const BusAttendanceScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { tripId, tripType } = route.params;

  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<BusDailyTripStudent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAbsentModal, setShowAbsentModal] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const loadTripDetail = useCallback(async (showLoading = true) => {
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
    } catch (err) {
      setError('Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadTripDetail();
  }, [loadTripDetail]);

  // Polling
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      loadTripDetail(false);
    }, POLLING_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [loadTripDetail]);

  const handleManualCheckin = async (student: BusDailyTripStudent) => {
    const newStatus = tripType === 'Đón' ? 'Boarded' : 'Dropped Off';
    const actionText = tripType === 'Đón' ? 'lên xe' : 'xuống xe';

    Alert.alert(
      'Xác nhận điểm danh',
      `Xác nhận ${student.student_name} đã ${actionText}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            setIsUpdating(true);
            try {
              const response = await busService.updateStudentStatus(
                student.name,
                newStatus as 'Boarded' | 'Dropped Off'
              );

              if (response.success) {
                loadTripDetail(false);
              } else {
                Alert.alert('Lỗi', response.message || 'Không thể cập nhật trạng thái');
              }
            } catch {
              Alert.alert('Lỗi', 'Có lỗi xảy ra');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkAbsent = async (reason: 'Nghỉ học' | 'Nghỉ ốm' | 'Nghỉ phép' | 'Lý do khác') => {
    if (!selectedStudent) return;

    setIsUpdating(true);
    setShowAbsentModal(false);

    try {
      const response = await busService.updateStudentStatus(
        selectedStudent.name,
        'Absent',
        reason
      );

      if (response.success) {
        loadTripDetail(false);
      } else {
        Alert.alert('Lỗi', response.message || 'Không thể đánh dấu vắng');
      }
    } catch {
      Alert.alert('Lỗi', 'Có lỗi xảy ra');
    } finally {
      setIsUpdating(false);
      setSelectedStudent(null);
    }
  };

  const openAbsentModal = (student: BusDailyTripStudent) => {
    setSelectedStudent(student);
    setShowAbsentModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Not Boarded':
        return '#F3F4F6';
      case 'Boarded':
        return '#DBEAFE';
      case 'Dropped Off':
        return '#D1FAE5';
      case 'Absent':
        return '#FEE2E2';
      default:
        return '#F3F4F6';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'Not Boarded':
        return '#6B7280';
      case 'Boarded':
        return '#3B82F6';
      case 'Dropped Off':
        return '#10B981';
      case 'Absent':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Not Boarded':
        return 'Chưa lên';
      case 'Boarded':
        return 'Đã lên';
      case 'Dropped Off':
        return 'Đã xuống';
      case 'Absent':
        return 'Vắng';
      default:
        return status;
    }
  };

  const renderStudentCard = (student: BusDailyTripStudent, index: number) => {
    const isCompleted =
      (tripType === 'Đón' && (student.student_status === 'Boarded' || student.student_status === 'Absent')) ||
      (tripType === 'Trả' && (student.student_status === 'Dropped Off' || student.student_status === 'Absent'));

    return (
      <View
        key={student.name}
        style={[
          styles.studentCard,
          { backgroundColor: getStatusColor(student.student_status) },
        ]}
      >
        <View style={styles.studentHeader}>
          <View style={styles.studentMainInfo}>
            <View style={styles.studentOrder}>
              <Text style={styles.studentOrderText}>{index + 1}</Text>
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.student_name}</Text>
              <Text style={styles.studentClass}>
                {student.student_code} • {student.class_name || 'N/A'}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusTextColor(student.student_status) }]}>
            <Text style={styles.statusBadgeText}>{getStatusText(student.student_status)}</Text>
          </View>
        </View>

        {!isCompleted && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.checkinButton}
              onPress={() => handleManualCheckin(student)}
              disabled={isUpdating}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.checkinButtonText}>
                {tripType === 'Đón' ? 'Lên xe' : 'Xuống xe'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.absentButton}
              onPress={() => openAbsentModal(student)}
              disabled={isUpdating}
            >
              <Ionicons name="close-circle" size={18} color="#FFFFFF" />
              <Text style={styles.absentButtonText}>Vắng</Text>
            </TouchableOpacity>
          </View>
        )}

        {student.student_status === 'Absent' && student.absent_reason && (
          <Text style={styles.absentReason}>Lý do: {student.absent_reason}</Text>
        )}
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

  // Filter students based on trip type
  const pendingStudents = tripDetail.students.filter((s) => {
    if (tripType === 'Đón') {
      return s.student_status === 'Not Boarded';
    } else {
      return s.student_status !== 'Dropped Off' && s.student_status !== 'Absent';
    }
  });

  const completedStudents = tripDetail.students.filter((s) => {
    if (tripType === 'Đón') {
      return s.student_status === 'Boarded' || s.student_status === 'Absent';
    } else {
      return s.student_status === 'Dropped Off' || s.student_status === 'Absent';
    }
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#002855" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Điểm danh</Text>
          <Text style={styles.headerSubtitle}>
            {tripDetail.route_name} • {tripType === 'Đón' ? 'Chiều đón' : 'Chiều trả'}
          </Text>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{pendingStudents.length}</Text>
          <Text style={styles.statLabel}>Chờ điểm danh</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#10B981' }]}>{completedStudents.length}</Text>
          <Text style={styles.statLabel}>Đã hoàn thành</Text>
        </View>
      </View>

      {/* Face Recognition Button */}
      <TouchableOpacity
        style={styles.faceRecognitionButton}
        onPress={() => navigation.navigate('FaceCamera', { tripId, onSuccess: () => loadTripDetail(false) })}
      >
        <View style={styles.faceIconContainer}>
          <Ionicons name="scan" size={32} color="#FFFFFF" />
        </View>
        <View style={styles.faceButtonContent}>
          <Text style={styles.faceButtonTitle}>Điểm danh bằng khuôn mặt</Text>
          <Text style={styles.faceButtonSubtitle}>Quét khuôn mặt học sinh để điểm danh tự động</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Pending Students */}
        {pendingStudents.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Chờ điểm danh</Text>
              <Text style={styles.sectionCount}>{pendingStudents.length}</Text>
            </View>
            {pendingStudents.map((student, index) => renderStudentCard(student, index))}
          </>
        )}

        {/* Completed Students */}
        {completedStudents.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={styles.sectionTitle}>Đã hoàn thành</Text>
              <Text style={styles.sectionCount}>{completedStudents.length}</Text>
            </View>
            {completedStudents.map((student, index) => renderStudentCard(student, index))}
          </>
        )}
      </ScrollView>

      {/* Absent Reason Modal */}
      <Modal
        visible={showAbsentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAbsentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chọn lý do vắng</Text>
            <Text style={styles.modalSubtitle}>{selectedStudent?.student_name}</Text>

            {['Nghỉ học', 'Nghỉ ốm', 'Nghỉ phép', 'Lý do khác'].map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.reasonOption}
                onPress={() => handleMarkAbsent(reason as 'Nghỉ học' | 'Nghỉ ốm' | 'Nghỉ phép' | 'Lý do khác')}
              >
                <Text style={styles.reasonText}>{reason}</Text>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAbsentModal(false)}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isUpdating && (
        <View style={styles.updatingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.updatingText}>Đang cập nhật...</Text>
        </View>
      )}
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#002855',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  faceRecognitionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#002855',
    margin: 16,
    padding: 16,
    borderRadius: 16,
  },
  faceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  faceButtonContent: {
    flex: 1,
  },
  faceButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  faceButtonSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionCount: {
    fontSize: 14,
    color: '#6B7280',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  studentCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentOrder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentOrderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  checkinButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 10,
  },
  checkinButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  absentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 10,
  },
  absentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  absentReason: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reasonText: {
    fontSize: 16,
    color: '#111827',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
  },
  updatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updatingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
  },
});

export default BusAttendanceScreen;

