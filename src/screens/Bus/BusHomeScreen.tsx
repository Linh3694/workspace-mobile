/**
 * Bus Home Screen
 * Shows daily trips for monitor grouped by date
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { busService, type BusDailyTrip, type TripsByDate } from '../../services/busService';
import BusIcon from '../../assets/bus.svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type RootStackParamList = {
  BusTripDetail: { tripId: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const BusHomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [tripsByDate, setTripsByDate] = useState<TripsByDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);

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
        // Reset to first date (today) when data loads
        setSelectedDateIndex(0);
      } else {
        setError(response.message || 'Không thể tải danh sách chuyến xe');
      }
    } catch (err) {
      setError('Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

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
  
  // Find the first trip that is not completed to show as main card
  const getMainTrip = (): BusDailyTrip | null => {
    if (!selectedDateGroup?.trips?.length) return null;
    
    // First, try to find a trip that's In Progress
    const inProgressTrip = selectedDateGroup.trips.find(t => t.trip_status === 'In Progress');
    if (inProgressTrip) return inProgressTrip;
    
    // Then, try to find a trip that's Not Started
    const notStartedTrip = selectedDateGroup.trips.find(t => t.trip_status === 'Not Started');
    if (notStartedTrip) return notStartedTrip;
    
    // Otherwise, return the first trip
    return selectedDateGroup.trips[0];
  };

  const mainTrip = getMainTrip();

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
            {mainTrip && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate('BusTripDetail', { tripId: mainTrip.name })}>
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
                      <Text style={styles.cardDate}>
                        {formatDateShort(selectedDateGroup.date)}
                      </Text>
                      <Text style={styles.cardTripType}>
                        {getTripTypeLabel(mainTrip.trip_type)}
                      </Text>
                    </View>
                    <View style={styles.busNumberBadge}>
                      <Text style={styles.busNumberText}>
                        {mainTrip.bus_number || '--'}
                      </Text>
                    </View>
                  </View>

                  {/* Bus Image */}
                  <View style={styles.busImageContainer}>
                    <BusIcon width={280} height={160} />
                  </View>

                  {/* Bus Info */}
                  <View style={styles.busInfoContainer}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>BKS</Text>
                      <Text style={styles.infoValue}>{mainTrip.license_plate || 'Chưa có'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Tài xế</Text>
                      <Text style={styles.infoValue}>{mainTrip.driver_name || 'Chưa có'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>SĐT</Text>
                      <Text style={styles.infoValue}>{mainTrip.driver_phone || 'Chưa có'}</Text>
                    </View>
                  </View>

                  {/* Action Button */}
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('BusTripDetail', { tripId: mainTrip.name })}>
                    <Text style={styles.actionButtonText}>
                      {mainTrip.trip_status === 'Not Started' ? 'Bắt đầu' : 
                       mainTrip.trip_status === 'In Progress' ? 'Tiếp tục' : 'Xem chi tiết'}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </TouchableOpacity>
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

            {/* Trip List for Selected Date */}
            <View style={styles.tripListContainer}>
              {selectedDateGroup?.trips.map((trip, index) => (
                <TouchableOpacity
                  key={trip.name}
                  style={[
                    styles.tripListItem,
                    index === 0 && styles.tripListItemFirst,
                    trip.trip_status === 'Completed' && styles.tripListItemCompleted,
                  ]}
                  onPress={() => navigation.navigate('BusTripDetail', { tripId: trip.name })}
                  activeOpacity={0.7}>
                  <View style={styles.tripListItemContent}>
                    <Text style={[
                      styles.tripListItemText,
                      trip.trip_status === 'Completed' && styles.tripListItemTextCompleted,
                    ]}>
                      {getTripTypeLabel(trip.trip_type)}
                    </Text>
                    {trip.trip_status === 'Completed' && (
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedBadgeText}>Hoàn thành</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[
                    styles.tripListBusNumber,
                    trip.trip_status === 'Completed' && styles.tripListBusNumberCompleted,
                  ]}>
                    {trip.bus_number || '--'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dateTabsScroll}
              contentContainerStyle={styles.dateTabsContent}>
              {tripsByDate.map((dateGroup, index) => (
                <TouchableOpacity
                  key={dateGroup.date}
                  style={[
                    styles.dateTab,
                    selectedDateIndex === index && styles.dateTabActive,
                  ]}
                  onPress={() => setSelectedDateIndex(index)}>
                  <Text style={[
                    styles.dateTabText,
                    selectedDateIndex === index && styles.dateTabTextActive,
                  ]}>
                    {formatDateShort(dateGroup.date)}
                  </Text>
                  <Text style={[
                    styles.dateTabCount,
                    selectedDateIndex === index && styles.dateTabCountActive,
                  ]}>
                    {dateGroup.trips.length} chuyến
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
    fontFamily: 'System',
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
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
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  mainCard: {
    borderRadius: 20,
    padding: 20,
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
    marginBottom: 16,
  },
  cardDate: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardTripType: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  busNumberBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  busNumberText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    color: 'rgba(255, 255, 255, 0.7)',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButton: {
    backgroundColor: '#F05023',
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#F05023',
  },
  tripListContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tripListItemFirst: {
    borderTopWidth: 0,
  },
  tripListItemCompleted: {
    opacity: 0.6,
  },
  tripListItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tripListItemText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1F2937',
  },
  tripListItemTextCompleted: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
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
  },
  tripListBusNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10B981',
  },
  tripListBusNumberCompleted: {
    color: '#9CA3AF',
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
  },
  dateTabTextActive: {
    color: '#FFFFFF',
  },
  dateTabCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  dateTabCountActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default BusHomeScreen;
