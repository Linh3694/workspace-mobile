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
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { busService, type BusDailyTrip, type TripsByDate } from '../../services/busService';
import BusIcon from '../../assets/bus.svg';
import { useAuth } from '../../context/AuthContext';

type RootStackParamList = {
  BusAttendance: { tripId: string; tripType: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const BusHomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [tripsByDate, setTripsByDate] = useState<TripsByDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [isCompletingTrip, setIsCompletingTrip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedTripIndex, setSelectedTripIndex] = useState(0);

  // Check if user has Monitor role (only Monitor can access Bus features)
  const roles: string[] = Array.isArray(user?.roles) ? user?.roles : [];
  const hasMobileMonitor = roles.includes('Mobile Monitor');

  const loadTrips = useCallback(
    async (showRefresh = false) => {
      // Don't load if user is not a Monitor
      if (!hasMobileMonitor) {
        setIsLoading(false);
        return;
      }

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
    },
    [hasMobileMonitor]
  );

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  // Reset selected trip when date changes
  useEffect(() => {
    setSelectedTripIndex(0);
  }, [selectedDateIndex]);

  const onRefresh = useCallback(() => {
    loadTrips(true);
  }, [loadTrips]);

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

  const handleStartTrip = async () => {
    if (!selectedTrip) return;

    // Nếu trip chưa bắt đầu, gọi API để bắt đầu trước
    if (selectedTrip.trip_status === 'Not Started') {
      setIsStartingTrip(true);
      try {
        const response = await busService.startTrip(selectedTrip.name);
        if (response.success) {
          // Refresh data để cập nhật trạng thái
          loadTrips(true);
        } else {
          // Nếu lỗi, vẫn cho phép navigate (có thể đã bắt đầu từ trước)
          console.warn('Start trip warning:', response.message);
        }
      } catch (error) {
        console.error('Error starting trip:', error);
      } finally {
        setIsStartingTrip(false);
      }
    }

    // Navigate đến màn hình điểm danh
    navigation.navigate('BusAttendance', {
      tripId: selectedTrip.name,
      tripType: selectedTrip.trip_type,
    });
  };

  // Kiểm tra xem có thể kết thúc chuyến không (tất cả học sinh đã có trạng thái)
  const canCompleteTrip = useCallback(() => {
    if (!selectedTrip) return false;
    if (selectedTrip.trip_status !== 'In Progress') return false;
    // Nếu không còn học sinh chưa lên xe/xuống xe thì có thể kết thúc
    return selectedTrip.not_boarded_count === 0;
  }, [selectedTrip]);

  const handleCompleteTrip = () => {
    if (!selectedTrip) return;

    Alert.alert('Kết thúc chuyến xe', 'Bạn có chắc chắn muốn kết thúc chuyến xe này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Kết thúc',
        style: 'destructive',
        onPress: async () => {
          setIsCompletingTrip(true);
          try {
            const response = await busService.completeTrip(selectedTrip.name);
            if (response.success) {
              Alert.alert('Thành công', 'Chuyến xe đã được kết thúc');
              loadTrips(true);
            } else {
              Alert.alert('Lỗi', response.message || 'Không thể kết thúc chuyến xe');
            }
          } catch (error) {
            console.error('Error completing trip:', error);
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi kết thúc chuyến xe');
          } finally {
            setIsCompletingTrip(false);
          }
        },
      },
    ]);
  };

  // Show access denied message for non-Monitor users
  if (!hasMobileMonitor) {
    return (
      <LinearGradient
        colors={['#F1F2E9', '#F5F1CD']}
        style={styles.errorContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}>
        <Ionicons name="information-circle" size={48} color="#F59E0B" />
        <Text style={styles.accessDeniedTitle}>Tính năng đang phát triển</Text>
        <Text style={styles.accessDeniedText}>
          Tính năng đang chỉ phát triển cho Monitor.{'\n'}
          Tính năng dành cho quản lý sẽ ra mắt sau.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Quay lại</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

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
                    style={[styles.actionButton, isStartingTrip && { opacity: 0.7 }]}
                    onPress={handleStartTrip}
                    disabled={isStartingTrip}>
                    {isStartingTrip ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionButtonText}>Bắt đầu</Text>
                    )}
                  </TouchableOpacity>
                )}

                {selectedTrip.trip_status === 'In Progress' && (
                  <>
                    {/* Thông báo số học sinh còn lại */}
                    {selectedTrip.not_boarded_count > 0 && (
                      <View style={styles.remainingStudentsContainer}>
                        <Ionicons name="alert-circle" size={18} color="#FCD34D" />
                        <Text style={styles.remainingStudentsText}>
                          Còn {selectedTrip.not_boarded_count} học sinh chưa{' '}
                          {selectedTrip.trip_type === 'Đón' ? 'lên xe' : 'xuống xe'}
                        </Text>
                      </View>
                    )}

                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.continueButton]}
                        onPress={handleStartTrip}>
                        <Ionicons
                          name="camera"
                          size={18}
                          color="#FFFFFF"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.actionButtonText}>Điểm danh</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.completeButton,
                          (!canCompleteTrip() || isCompletingTrip) && { opacity: 0.5 },
                        ]}
                        onPress={handleCompleteTrip}
                        disabled={!canCompleteTrip() || isCompletingTrip}>
                        {isCompletingTrip ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color="#FFFFFF"
                              style={{ marginRight: 6 }}
                            />
                            <Text style={styles.actionButtonText}>Kết thúc</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {selectedTrip.trip_status === 'Completed' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.viewDetailButton]}
                    onPress={handleStartTrip}>
                    <Ionicons name="eye" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.actionButtonText}>Xem chi tiết</Text>
                  </TouchableOpacity>
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
  accessDeniedTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    fontFamily: 'Mulish',
  },
  accessDeniedText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
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
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 25,
    marginHorizontal: 25,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 25,
    marginHorizontal: 15,
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#7C3AED',
    marginTop: 0,
    marginBottom: 0,
    marginHorizontal: 0,
    paddingVertical: 12,
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#10B981',
    marginTop: 0,
    marginBottom: 0,
    marginHorizontal: 0,
    paddingVertical: 12,
  },
  viewDetailButton: {
    backgroundColor: '#6B7280',
  },
  remainingStudentsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 15,
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  remainingStudentsText: {
    fontSize: 14,
    color: '#FCD34D',
    fontWeight: '700',
    fontFamily: 'Mulish',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
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
});

export default BusHomeScreen;
