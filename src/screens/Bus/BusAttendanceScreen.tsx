/**
 * Bus Attendance Screen
 * Face recognition and manual attendance for bus students
 */
// @ts-nocheck

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  busService,
  type TripDetailResponse,
  type BusDailyTripStudent,
} from '../../services/busService';
import { getFullImageUrl } from '../../utils/imageUtils';
import { toast } from '../../utils/toast';

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
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAbsentReasonModal, setShowAbsentReasonModal] = useState(false);

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
      }
    },
    [tripId]
  );

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

  const openStatusModal = (student: BusDailyTripStudent) => {
    setSelectedStudent(student);
    setShowStatusModal(true);
  };

  const getStatusLabel = (status: 'Boarded' | 'Dropped Off' | 'Not Boarded') => {
    switch (status) {
      case 'Boarded':
        return 'đã lên xe';
      case 'Dropped Off':
        return 'đã xuống xe';
      case 'Not Boarded':
        return tripType === 'Đón' ? 'chưa lên xe' : 'chưa xuống xe';
      default:
        return '';
    }
  };

  const handleStatusChange = async (newStatus: 'Boarded' | 'Dropped Off' | 'Not Boarded') => {
    if (!selectedStudent) return;

    const studentName = selectedStudent.student_name;
    setIsUpdating(true);
    setShowStatusModal(false);

    try {
      const response = await busService.updateStudentStatus(selectedStudent.name, newStatus);

      if (response.success) {
        toast.success(`${studentName} ${getStatusLabel(newStatus)}`);
        loadTripDetail(false);
      } else {
        toast.error(response.message || 'Không thể cập nhật trạng thái');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setIsUpdating(false);
      setSelectedStudent(null);
    }
  };

  const handleMarkAbsent = async (reason: 'Nghỉ học' | 'Nghỉ ốm' | 'Nghỉ phép' | 'Lý do khác') => {
    if (!selectedStudent) return;

    const studentName = selectedStudent.student_name;
    setIsUpdating(true);
    setShowAbsentReasonModal(false);

    try {
      const response = await busService.updateStudentStatus(selectedStudent.name, 'Absent', reason);

      if (response.success) {
        toast.success(`${studentName} - ${reason}`);
        loadTripDetail(false);
      } else {
        toast.error(response.message || 'Không thể đánh dấu vắng');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setIsUpdating(true);
      setSelectedStudent(null);
    }
  };

  const openAbsentReasonModal = () => {
    setShowStatusModal(false);
    setShowAbsentReasonModal(true);
  };

  // const getStatusColor = (status: string) => {
  //   switch (status) {
  //     case 'Not Boarded':
  //       return '#F3F4F6';
  //     case 'Boarded':
  //       return '#E6F4F1';
  //     case 'Dropped Off':
  //       return '#E6F4F1';
  //     case 'Absent':
  //       return '#FEE2E2';
  //     default:
  //       return '#F3F4F6';
  //   }
  // };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'Not Boarded':
        return '#6B7280';
      case 'Boarded':
        return '#009483';
      case 'Dropped Off':
        return '#009483';
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

  const renderStudentCard = (student: BusDailyTripStudent) => {
    const getBorderColor = (status: string) => {
      switch (status) {
        case 'Not Boarded':
          return '#F59E0B';
        case 'Boarded':
        case 'Dropped Off':
          return '#10B981';
        case 'Absent':
          return '#D1D5DB';
        default:
          return '#E5E7EB';
      }
    };

    return (
      <View
        key={student.name}
        style={[styles.studentCard, { borderColor: getBorderColor(student.student_status) }]}>
        <View style={styles.studentHeader}>
          <View style={styles.studentMainInfo}>
            <TouchableOpacity
              onPress={() => openStatusModal(student)}
              activeOpacity={0.7}
              style={[
                styles.studentPhotoContainer,
                { borderColor: getBorderColor(student.student_status) },
              ]}>
              {student.photo_url ? (
                <Image
                  source={{ uri: getFullImageUrl(student.photo_url) }}
                  style={styles.studentPhoto}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.studentPhotoPlaceholder}>
                  <Ionicons name="person" size={24} color="#9CA3AF" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.student_name}</Text>
              <Text style={styles.studentClass}>
                {student.student_code} • {student.class_name || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {student.student_status === 'Absent' && student.absent_reason && (
          <Text style={styles.absentReason}>Lý do: {student.absent_reason}</Text>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <LinearGradient
        colors={['#F1F2E9', '#F5F1CD']}
        style={styles.loadingContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}>
        <ActivityIndicator size="large" color="#002855" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </LinearGradient>
    );
  }

  if (error || !tripDetail) {
    return (
      <LinearGradient
        colors={['#F1F2E9', '#F5F1CD']}
        style={styles.errorContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error || 'Không tìm thấy chuyến xe'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadTripDetail()}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </LinearGradient>
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
      return s.student_status === 'Boarded';
    } else {
      return s.student_status === 'Dropped Off';
    }
  });

  const absentStudents = tripDetail.students.filter((s) => s.student_status === 'Absent');

  return (
    <LinearGradient
      colors={['#F1F2E9', '#F5F1CD']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#002855" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Điểm danh</Text>
          <Text style={styles.headerSubtitle}>
            {tripDetail.route_name} • {tripType === 'Đón' ? 'Chiều đón' : 'Chiều trả'}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Stats Bar */}
      {/* <View style={styles.statsBarContainer}>
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pendingStudents.length}</Text>
            <Text style={styles.statLabel}>Chờ điểm danh</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#009483' }]}>{completedStudents.length}</Text>
            <Text style={styles.statLabel}>Đã hoàn thành</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>{absentStudents.length}</Text>
            <Text style={styles.statLabel}>Vắng</Text>
          </View>
        </View>
      </View> */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Absent Students (Nghỉ có phép) */}
        {absentStudents.length > 0 && (
          <>
            <View style={styles.sectionHeaderTag}>
              <View style={[styles.sectionDot, styles.sectionDotAbsent]} />
              <Text style={styles.sectionTagText}>Nghỉ có phép</Text>
            </View>
            {absentStudents.map((student) => renderStudentCard(student))}
          </>
        )}

        {/* Pending Students (Chưa đón) */}
        {pendingStudents.length > 0 && (
          <>
            <View style={[styles.sectionHeaderTag, absentStudents.length > 0 && { marginTop: 16 }]}>
              <View style={[styles.sectionDot, styles.sectionDotPending]} />
              <Text style={styles.sectionTagText}>
                {tripType === 'Đón' ? 'Chưa đón' : 'Chưa trả'}
              </Text>
            </View>
            {pendingStudents.map((student) => renderStudentCard(student))}
          </>
        )}

        {/* Completed Students (Đã lên xe / Đã xuống xe) */}
        {completedStudents.length > 0 && (
          <>
            <View style={[styles.sectionHeaderTag, { marginTop: 16 }]}>
              <View style={[styles.sectionDot, styles.sectionDotCompleted]} />
              <Text style={styles.sectionTagText}>
                {tripType === 'Đón' ? 'Đã lên xe' : 'Đã xuống xe'}
              </Text>
            </View>
            {completedStudents.map((student) => renderStudentCard(student))}
          </>
        )}
      </ScrollView>

      {/* Floating Face Recognition Button */}
      <TouchableOpacity
        style={styles.floatingFaceButton}
        onPress={() =>
          navigation.navigate('FaceCamera', { tripId, onSuccess: () => loadTripDetail(false) })
        }
        activeOpacity={0.8}>
        <View style={styles.floatingFaceButtonInner}>
          <Ionicons name="person" size={28} color="#FFFFFF" />
          <View style={styles.scanCorners}>
            <View style={[styles.scanCorner, styles.scanCornerTL]} />
            <View style={[styles.scanCorner, styles.scanCornerTR]} />
            <View style={[styles.scanCorner, styles.scanCornerBL]} />
            <View style={[styles.scanCorner, styles.scanCornerBR]} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Status Change Modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}>
          <View style={styles.statusModalContent}>
            {/* Student Info Header */}
            <View style={styles.statusModalHeader}>
              <View style={styles.statusModalAvatar}>
                {selectedStudent?.photo_url ? (
                  <Image
                    source={{ uri: getFullImageUrl(selectedStudent.photo_url) }}
                    style={styles.statusModalAvatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.statusModalAvatarPlaceholder}>
                    <Ionicons name="person" size={32} color="#9CA3AF" />
                  </View>
                )}
              </View>
              <Text style={styles.statusModalName}>{selectedStudent?.student_name}</Text>
              <Text style={styles.statusModalClass}>
                {selectedStudent?.student_code} • {selectedStudent?.class_name || 'N/A'}
              </Text>
            </View>

            {/* Status Options */}
            <View style={styles.statusOptionsContainer}>
              <TouchableOpacity
                style={[styles.statusOption, styles.statusOptionBoarded]}
                onPress={() => handleStatusChange(tripType === 'Đón' ? 'Boarded' : 'Dropped Off')}>
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.statusOptionText}>
                  {tripType === 'Đón' ? 'Đã lên xe' : 'Đã xuống xe'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusOption, styles.statusOptionPending]}
                onPress={() => handleStatusChange('Not Boarded')}>
                <Ionicons name="time" size={24} color="#FFFFFF" />
                <Text style={styles.statusOptionText}>
                  {tripType === 'Đón' ? 'Chưa lên xe' : 'Chưa xuống xe'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusOption, styles.statusOptionAbsent]}
                onPress={openAbsentReasonModal}>
                <Ionicons name="close-circle" size={24} color="#FFFFFF" />
                <Text style={styles.statusOptionText}>Vắng</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.statusModalCancel}
              onPress={() => setShowStatusModal(false)}>
              <Text style={styles.statusModalCancelText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Absent Reason Modal */}
      <Modal
        visible={showAbsentReasonModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAbsentReasonModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chọn lý do vắng</Text>
            <Text style={styles.modalSubtitle}>{selectedStudent?.student_name}</Text>

            {['Nghỉ học', 'Nghỉ ốm', 'Nghỉ phép', 'Lý do khác'].map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.reasonOption}
                onPress={() =>
                  handleMarkAbsent(reason as 'Nghỉ học' | 'Nghỉ ốm' | 'Nghỉ phép' | 'Lý do khác')
                }>
                <Text style={styles.reasonText}>{reason}</Text>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAbsentReasonModal(false);
                setSelectedStudent(null);
              }}>
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
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40, // Same width as backButton for symmetry
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#002855',
    fontFamily: 'Mulish',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Mulish',
  },
  statsBarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  statsBar: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
    fontFamily: 'Mulish',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Mulish',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  faceRecognitionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F05023',
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
    fontFamily: 'Mulish',
  },
  faceButtonSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    fontFamily: 'Mulish',
  },
  floatingFaceButton: {
    position: 'absolute',
    bottom: '5%',
    alignSelf: 'center',
    zIndex: 100,
  },
  floatingFaceButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 40,
    backgroundColor: '#F05023',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F05023',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  scanCorners: {
    position: 'absolute',
    width: 36,
    height: 36,
  },
  scanCorner: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderColor: '#FFFFFF',
  },
  scanCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  scanCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  scanCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  scanCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 150,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Mulish',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    fontFamily: 'Mulish',
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
    fontFamily: 'Mulish',
  },
  sectionHeaderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 24,
    elevation: 1,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    marginRight: 10,
  },
  sectionDotPending: {
    backgroundColor: '#F59E0B',
  },
  sectionDotCompleted: {
    backgroundColor: '#10B981',
  },
  sectionDotAbsent: {
    backgroundColor: '#D1D5DB',
  },
  sectionTagText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    fontFamily: 'Mulish',
  },
  studentCard: {
    borderRadius: 12,
    padding: 10,
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
  studentPhotoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: 'transparent',
  },
  studentPhoto: {
    width: '100%',
    height: '100%',
  },
  studentPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Mulish',
  },
  studentClass: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Mulish',
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
    fontFamily: 'Mulish',
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
    backgroundColor: '#009483',
    borderRadius: 8,
    paddingVertical: 10,
  },
  checkinButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Mulish',
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
    fontFamily: 'Mulish',
  },
  absentReason: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
    fontFamily: 'Mulish',
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
    fontFamily: 'Mulish',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
    fontFamily: 'Mulish',
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
    fontFamily: 'Mulish',
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
    fontFamily: 'Mulish',
  },
  statusModalContent: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  statusModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusModalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  statusModalAvatarImage: {
    width: '100%',
    height: '100%',
  },
  statusModalAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  statusModalName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Mulish',
    textAlign: 'center',
  },
  statusModalClass: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Mulish',
    marginTop: 4,
  },
  statusOptionsContainer: {
    width: '100%',
    gap: 12,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  statusOptionBoarded: {
    backgroundColor: '#10B981',
  },
  statusOptionPending: {
    backgroundColor: '#F59E0B',
  },
  statusOptionAbsent: {
    backgroundColor: '#EF4444',
  },
  statusOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Mulish',
  },
  statusModalCancel: {
    marginTop: 16,
    paddingVertical: 12,
  },
  statusModalCancelText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    fontFamily: 'Mulish',
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
    fontFamily: 'Mulish',
  },
});

export default BusAttendanceScreen;
