/**
 * Bus Home Screen
 * Shows daily trips for monitor grouped by date
 */
// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { busService, type BusDailyTrip, type TripsByDate } from '../../services/busService';
import BusIcon from '../../assets/bus.svg';
import { toast } from '../../utils/toast';

type RootStackParamList = {
  BusAttendance: { tripId: string; tripType: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const BusHomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [tripsByDate, setTripsByDate] = useState<TripsByDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedTripIndex, setSelectedTripIndex] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingStudentsList, setPendingStudentsList] = useState<string[]>([]);

  const loadTrips = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Get trips for next 7 days
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 7);

      const startDateStr = today.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const response = await busService.getDailyTripsByDateRange(startDateStr, endDateStr);

      if (response.success && response.data) {
        setTripsByDate(response.data);
        // Reset to first date (today) and first trip when data loads
        setSelectedDateIndex(0);
        setSelectedTripIndex(0);
      } else {
        setError(response.message || 'Không thể tải danh sách chuyến xe');
      }
    } catch {
      setError('Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  // Reload trips when screen comes into focus (e.g., returning from attendance)
  useFocusEffect(
    useCallback(() => {
      loadTrips(true);
    }, [loadTrips])
  );

  // Reset selected trip when date changes
  useEffect(() => {
    setSelectedTripIndex(0);
  }, [selectedDateIndex]);

  const onRefresh = useCallback(() => {
    loadTrips(true);
  }, [loadTrips]);

  // Start trip
  const handleStartTrip = async () => {
    if (!selectedTrip) return;

    setIsStarting(true);
    try {
      const response = await busService.startTrip(selectedTrip.name);
      if (response.success) {
        toast.success('Đã bắt đầu chuyến xe');
        loadTrips(true);
      } else {
        toast.error(response.message || 'Không thể bắt đầu chuyến xe');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setIsStarting(false);
    }
  };

  // Complete trip - check pending students first
  const handleCompleteTrip = async () => {
    if (!selectedTrip) return;

    setIsCompleting(true);
    try {
      // Get trip detail to check pending students
      const detailResponse = await busService.getDailyTripDetail(selectedTrip.name);

      if (!detailResponse.success || !detailResponse.data) {
        toast.error('Không thể kiểm tra thông tin chuyến xe');
        setIsCompleting(false);
        return;
      }

      const tripDetail = detailResponse.data;

      // Find pending students based on trip type
      const pendingStudents = tripDetail.students.filter((s) => {
        if (selectedTrip.trip_type === 'Đón') {
          return s.student_status === 'Not Boarded';
        } else {
          return s.student_status !== 'Dropped Off' && s.student_status !== 'Absent';
        }
      });

      if (pendingStudents.length > 0) {
        // Show modal with pending students
        setPendingStudentsList(pendingStudents.map((s) => s.student_name));
        setShowPendingModal(true);
        setIsCompleting(false);
        return;
      }

      // All students are processed, complete the trip
      const response = await busService.completeTrip(selectedTrip.name);
      if (response.success) {
        toast.success('Đã hoàn thành chuyến xe');
        loadTrips(true);
      } else {
        toast.error(response.message || 'Không thể hoàn thành chuyến xe');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setIsCompleting(false);
    }
  };

  // Navigate to attendance screen
  const handleGoToAttendance = () => {
    if (selectedTrip) {
      navigation.navigate('BusAttendance', {
        tripId: selectedTrip.name,
        tripType: selectedTrip.trip_type,
      });
    }
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const getTripTypeLabel = (tripType: string) => {
    return tripType === 'Đón' ? 'Sáng đón' : 'Chiều trả';
  };

  const selectedDateGroup = tripsByDate[selectedDateIndex];
  const selectedTrip = selectedDateGroup?.trips?.[selectedTripIndex] || null;

  // Get trips by type for separate buttons
  const morningTrip = selectedDateGroup?.trips?.find((t) => t.trip_type === 'Đón') || null;
  const afternoonTrip = selectedDateGroup?.trips?.find((t) => t.trip_type === 'Trả') || null;

  const handleTripSelect = (trip: BusDailyTrip) => {
    const index = selectedDateGroup?.trips?.findIndex((t) => t.name === trip.name);
    if (index !== undefined && index >= 0) {
      setSelectedTripIndex(index);
    }
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

  if (error) {
    return (
      <LinearGradient
        colors={['#F1F2E9', '#F5F1CD']}
        style={styles.errorContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadTrips()}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#F1F2E9', '#F5F1CD']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.headerTitle}>Chuyến xe tiếp theo</Text>

        {tripsByDate.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Không có chuyến xe nào</Text>
            <Text style={styles.emptySubtext}>
              Bạn chưa được phân công chuyến xe trong 7 ngày tới
            </Text>
          </View>
        ) : (
          <>
            {/* Main Trip Card */}
            {selectedTrip && (
              <LinearGradient
                colors={['#00687F', '#002855']}
                style={styles.mainCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}>
                {/* Glow border effect */}
                <View style={styles.glowBorder} />

                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardDate}>{formatDateShort(selectedDateGroup.date)}</Text>
                    <Text style={styles.cardTripType}>
                      {getTripTypeLabel(selectedTrip.trip_type)}
                    </Text>
                  </View>
                  <View style={styles.busNumberBadge}>
                    <Text style={styles.busNumberText}>{selectedTrip.bus_number || '--'}</Text>
                  </View>
                </View>

                {/* Bus Image */}
                <View style={styles.busImageContainer}>
                  <BusIcon width={280} height={200} />
                </View>

                {/* Bus Info */}
                <View style={styles.busInfoContainer}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>BKS</Text>
                    <Text style={styles.infoValue}>{selectedTrip.license_plate || 'Chưa có'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tài xế</Text>
                    <Text style={styles.infoValue}>{selectedTrip.driver_name || 'Chưa có'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>SĐT</Text>
                    <Text style={styles.infoValue}>{selectedTrip.driver_phone || 'Chưa có'}</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                {selectedTrip.trip_status === 'Not Started' && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleStartTrip}
                    disabled={isStarting}>
                    {isStarting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionButtonText}>Bắt đầu</Text>
                    )}
                  </TouchableOpacity>
                )}

                {selectedTrip.trip_status === 'In Progress' && (
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.actionButtonHalf, styles.actionButtonAttendance]}
                      onPress={handleGoToAttendance}>
                      <Ionicons name="people" size={20} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Điểm danh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButtonHalf, styles.actionButtonComplete]}
                      onPress={handleCompleteTrip}
                      disabled={isCompleting}>
                      {isCompleting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>Kết thúc</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {selectedTrip.trip_status === 'Completed' && (
                  <View style={styles.completedBanner}>
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    <Text style={styles.completedBannerText}>Đã hoàn thành</Text>
                  </View>
                )}
              </LinearGradient>
            )}

            {/* Date Selector */}
            <View style={styles.dateSelectorContainer}>
              <View style={styles.dateIndicator}>
                <Ionicons name="play" size={16} color="#F05023" />
                <Text style={styles.dateIndicatorText}>
                  {selectedDateGroup ? formatDateShort(selectedDateGroup.date) : ''}
                </Text>
              </View>
            </View>

            {/* Trip Type Buttons - Separated */}
            <View style={styles.tripButtonsContainer}>
              {/* Afternoon Trip Button (Chiều trả) */}
              {afternoonTrip && (
                <TouchableOpacity
                  style={[
                    styles.tripButton,
                    selectedTrip?.name === afternoonTrip.name && styles.tripButtonActive,
                    afternoonTrip.trip_status === 'Completed' && styles.tripButtonCompleted,
                  ]}
                  onPress={() => handleTripSelect(afternoonTrip)}
                  activeOpacity={0.7}>
                  <View style={styles.tripButtonContent}>
                    <Text
                      style={[
                        styles.tripButtonText,
                        selectedTrip?.name === afternoonTrip.name && styles.tripButtonTextActive,
                        afternoonTrip.trip_status === 'Completed' && styles.tripButtonTextCompleted,
                      ]}>
                      Chiều trả
                    </Text>
                    {afternoonTrip.trip_status === 'Completed' && (
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedBadgeText}>Hoàn thành</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tripButtonBusNumber,
                      selectedTrip?.name === afternoonTrip.name && styles.tripButtonBusNumberActive,
                      afternoonTrip.trip_status === 'Completed' &&
                        styles.tripButtonBusNumberCompleted,
                    ]}>
                    {afternoonTrip.bus_number || '--'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Morning Trip Button (Sáng đón) */}
              {morningTrip && (
                <TouchableOpacity
                  style={[
                    styles.tripButton,
                    selectedTrip?.name === morningTrip.name && styles.tripButtonActive,
                    morningTrip.trip_status === 'Completed' && styles.tripButtonCompleted,
                  ]}
                  onPress={() => handleTripSelect(morningTrip)}
                  activeOpacity={0.7}>
                  <View style={styles.tripButtonContent}>
                    <Text
                      style={[
                        styles.tripButtonText,
                        selectedTrip?.name === morningTrip.name && styles.tripButtonTextActive,
                        morningTrip.trip_status === 'Completed' && styles.tripButtonTextCompleted,
                      ]}>
                      Sáng đón
                    </Text>
                    {morningTrip.trip_status === 'Completed' && (
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedBadgeText}>Hoàn thành</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tripButtonBusNumber,
                      selectedTrip?.name === morningTrip.name && styles.tripButtonBusNumberActive,
                      morningTrip.trip_status === 'Completed' &&
                        styles.tripButtonBusNumberCompleted,
                    ]}>
                    {morningTrip.bus_number || '--'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Date Tabs */}
            {/* <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dateTabsScroll}
              contentContainerStyle={styles.dateTabsContent}>
              {tripsByDate.map((dateGroup, index) => (
                <TouchableOpacity
                  key={dateGroup.date}
                  style={[styles.dateTab, selectedDateIndex === index && styles.dateTabActive]}
                  onPress={() => setSelectedDateIndex(index)}>
                  <Text
                    style={[
                      styles.dateTabText,
                      selectedDateIndex === index && styles.dateTabTextActive,
                    ]}>
                    {formatDateShort(dateGroup.date)}
                  </Text>
                  <Text
                    style={[
                      styles.dateTabCount,
                      selectedDateIndex === index && styles.dateTabCountActive,
                    ]}>
                    {dateGroup.trips.length} chuyến
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView> */}
          </>
        )}
      </ScrollView>

      {/* Pending Students Modal */}
      <Modal
        visible={showPendingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPendingModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={48} color="#F59E0B" />
              <Text style={styles.modalTitle}>Chưa thể kết thúc</Text>
              <Text style={styles.modalSubtitle}>
                Còn {pendingStudentsList.length} học sinh chưa{' '}
                {selectedTrip?.trip_type === 'Đón' ? 'lên xe' : 'xuống xe'}
              </Text>
            </View>

            <ScrollView style={styles.pendingList} showsVerticalScrollIndicator={false}>
              {pendingStudentsList.map((name, index) => (
                <View key={index} style={styles.pendingItem}>
                  <Ionicons name="person-circle" size={24} color="#6B7280" />
                  <Text style={styles.pendingItemText}>{name}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={() => {
                  setShowPendingModal(false);
                  handleGoToAttendance();
                }}>
                <Text style={styles.modalButtonPrimaryText}>Điểm danh ngay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowPendingModal(false)}>
                <Text style={styles.modalButtonSecondaryText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 32,
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
    fontFamily: 'Mulish',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Mulish',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'Mulish',
  },
  mainCard: {
    borderRadius: 32,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  glowBorder: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'rgba(59, 130, 246, 0.5)',
    zIndex: -1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  cardDate: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Mulish',
  },
  cardTripType: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    fontWeight: '800',
    fontFamily: 'Mulish',
  },
  busNumberBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#009483',
    justifyContent: 'center',
    alignItems: 'center',
  },
  busNumberText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Mulish',
  },
  busImageContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  busInfoContainer: {
    marginTop: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255,1)',
    fontFamily: 'Mulish',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Mulish',
  },
  actionButton: {
    backgroundColor: '#F05023',
    borderRadius: 30,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 25,
    marginHorizontal: 25,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 25,
    marginHorizontal: 20,
    gap: 12,
  },
  actionButtonHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
  },
  actionButtonAttendance: {
    backgroundColor: '#F05023',
  },
  actionButtonComplete: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Mulish',
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 25,
    marginHorizontal: 25,
    paddingVertical: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 30,
    gap: 8,
  },
  completedBannerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
    fontFamily: 'Mulish',
  },
  dateSelectorContainer: {
    marginBottom: 12,
  },
  dateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateIndicatorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F05023',
    fontFamily: 'Mulish',
  },
  tripButtonsContainer: {
    gap: 10,
    marginBottom: 20,
  },
  tripButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    elevation: 3,
  },
  tripButtonActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D9D9D9',
  },
  tripButtonCompleted: {
    opacity: 0.6,
  },
  tripButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tripButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Mulish',
  },
  tripButtonTextActive: {
    color: '#F05023',
    fontWeight: '700',
    fontFamily: 'Mulish',
  },
  tripButtonTextCompleted: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    fontFamily: 'Mulish',
  },
  completedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Mulish',
  },
  tripButtonBusNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
    fontFamily: 'Mulish',
  },
  tripButtonBusNumberActive: {
    color: '#F05023',
    fontFamily: 'Mulish',
  },
  tripButtonBusNumberCompleted: {
    color: '#9CA3AF',
    fontFamily: 'Mulish',
  },
  dateTabsScroll: {
    marginTop: 8,
  },
  dateTabsContent: {
    paddingRight: 20,
    gap: 12,
  },
  dateTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  dateTabActive: {
    backgroundColor: '#002855',
  },
  dateTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Mulish',
  },
  dateTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Mulish',
  },
  dateTabCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    fontFamily: 'Mulish',
  },
  dateTabCountActive: {
    color: 'rgba(255, 255, 255, 0.8)',
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
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    fontFamily: 'Mulish',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Mulish',
  },
  pendingList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  pendingItemText: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Mulish',
  },
  modalActions: {
    gap: 12,
  },
  modalButtonPrimary: {
    backgroundColor: '#F05023',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Mulish',
  },
  modalButtonSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Mulish',
  },
});

export default BusHomeScreen;
