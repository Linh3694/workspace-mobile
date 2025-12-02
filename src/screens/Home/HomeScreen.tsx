// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
// @ts-ignore
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  StatusBar,
  Keyboard,
  Platform,
  PanResponder,
  Animated,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';

import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { Ionicons, MaterialIcons, FontAwesome, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../hooks/useLanguage';
import TicketIcon from '../../assets/ticket-icon.svg';
import DevicesIcon from '../../assets/devices-icon.svg';
import DocumentIcon from '../../assets/document-icon.svg';
import LibraryIcon from '../../assets/library-icon.svg';
import PolygonIcon from '../../assets/polygon.svg';
import LeaveIcon from '../../assets/leave.svg';
import AttendanceIcon from '../../assets/attendance.svg';
import attendanceService from '../../services/attendanceService';
import pushNotificationService from '../../services/pushNotificationService';
import notificationCenterService from '../../services/notificationCenterService';
// Define type cho navigation
type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.MAIN
>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [checkInTime, setCheckInTime] = useState('--:--');
  const [checkOutTime, setCheckOutTime] = useState('--:--');
  const [isRefreshingAttendance, setIsRefreshingAttendance] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isMountedRef = useRef(true);
  useEffect(() => {
    if (unreadNotificationCount > 0) {
      pulseAnim.setValue(1);
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [unreadNotificationCount]);

  // Function để fetch attendance data
  const fetchTodayAttendance = React.useCallback(
    async (showLoading = false, forceRefresh = false) => {
      const employeeCode = user?.employeeCode;

      if (!employeeCode) {
        setCheckInTime(t('home.not_checked_in'));
        setCheckOutTime(t('home.not_checked_out'));
        return;
      }

      try {
        if (showLoading && isMountedRef.current) {
          setIsRefreshingAttendance(true);
        }

        // TEMPORARY: Force clear ALL attendance cache to fix timezone display issue
        if (forceRefresh) {
          attendanceService.forceCleanAllAttendanceCache();
        }

        const attendanceData = await attendanceService.getTodayAttendance(
          employeeCode,
          forceRefresh
        );

        if (attendanceData) {
          const formattedCheckIn = attendanceService.formatTime(attendanceData.checkInTime);
          const formattedCheckOut = attendanceService.formatTime(attendanceData.checkOutTime);

          if (isMountedRef.current) {
            setCheckInTime(formattedCheckIn);
            setCheckOutTime(formattedCheckOut);
          }
        } else {
          if (isMountedRef.current) {
            setCheckInTime('--:--');
            setCheckOutTime('--:--');
          }
        }
      } catch (error) {
        if (isMountedRef.current) {
          setCheckInTime('--:--');
          setCheckOutTime('--:--');
        }
      } finally {
        if (showLoading && isMountedRef.current) {
          setIsRefreshingAttendance(false);
        }
      }
    },
    [t, user]
  );

  // Function để fetch unread notification count
  const fetchUnreadNotificationCount = React.useCallback(async () => {
    try {
      const result = await notificationCenterService.getUnreadCount();
      if (result.success && isMountedRef.current) {
        setUnreadNotificationCount(result.data.unread_count);
      }
    } catch (error) {}
  }, []);

  useEffect(() => {
    fetchTodayAttendance();
  }, [fetchTodayAttendance]);

  useEffect(() => {
    // Initial fetch
    const intervalId = setInterval(
      () => {
        if (user?.employeeCode) {
          fetchTodayAttendance(false, true); // Silent refresh with force
        }
      },
      30 * 60 * 1000
    ); // 30 minutes

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [user?.employeeCode, fetchTodayAttendance]);

  // Setup push notification listener for attendance updates
  useEffect(() => {
    const setupPushNotificationListener = () => {
      pushNotificationService.setOnAttendanceNotification((notificationData) => {
        // Check if this notification is for current user
        const currentEmployeeCode = user?.employeeCode;
        if (notificationData.employeeCode === currentEmployeeCode) {
          // Auto-refresh attendance data with force refresh to bypass cache
          fetchTodayAttendance(true, true);

          // Skip local notification since we already have push notification from server
          // pushNotificationService.scheduleLocalNotification(
          //   t('home.check_in'),
          //   `${t('home.attendance')} ${
          //     notificationData.timestamp
          //       ? new Date(notificationData.timestamp).toLocaleTimeString('vi-VN', {
          //           hour: '2-digit',
          //           minute: '2-digit',
          //         })
          //       : 'vừa xong'
          //   } tại ${notificationData.deviceName || 'Unknown Device'}`,
          //   { type: 'attendance', source: 'auto_refresh' }
          // );
        } else {
        }
      });
    };

    // Only setup if user is authenticated
    if (user?.employeeCode) {
      setupPushNotificationListener();
    }

    // Cleanup function
    return () => {
      // Clear attendance notification callback when component unmounts
      pushNotificationService.setOnAttendanceNotification(() => {});
    };
  }, [user?.employeeCode, fetchTodayAttendance]);

  // Fetch unread notification count when component mounts and when screen is focused
  useEffect(() => {
    fetchUnreadNotificationCount();
  }, [fetchUnreadNotificationCount]);

  // Refresh unread count khi quay lại từ màn hình khác (ví dụ: sau khi đọc thông báo)
  useFocusEffect(
    React.useCallback(() => {
      fetchUnreadNotificationCount();
    }, [fetchUnreadNotificationCount])
  );

  // Refresh attendance data khi screen focus (từ notification)
  useFocusEffect(
    React.useCallback(() => {
      const params = route.params as any;
      if (params?.refreshAttendance) {
        fetchTodayAttendance(true);
        // Clear the param để không refresh liên tục
        navigation.setParams({ refreshAttendance: undefined } as any);
      }
    }, [route.params, fetchTodayAttendance, navigation])
  );

  const navigateToTicket = () => {
    try {
      if (user) {
        const roles: string[] = Array.isArray(user?.roles) ? user?.roles : [];

        // Mobile IT -> Ticket Admin, còn lại -> Ticket Guest
        if (roles.includes('Mobile IT')) {
          navigation.navigate(ROUTES.SCREENS.TICKET_ADMIN);
        } else {
          navigation.navigate(ROUTES.SCREENS.TICKET_GUEST);
        }
      } else {
        navigation.navigate(ROUTES.SCREENS.TICKET_GUEST);
      }
    } catch (error) {
      // Mặc định điều hướng đến TicketGuest nếu có lỗi
      navigation.navigate(ROUTES.SCREENS.TICKET_GUEST);
    }
  };

  const navigateToDevices = () => {
    navigation.navigate(ROUTES.SCREENS.DEVICES);
  };

  const navigateToAttendance = () => {
    navigation.navigate(ROUTES.SCREENS.ATTENDANCE_HOME);
  };

  const navigateToLeaveRequests = () => {
    navigation.navigate(ROUTES.SCREENS.LEAVE_REQUESTS);
  };

  const navigateToBus = () => {
    navigation.navigate('BusHome' as any);
  };

  // Role-based menu configuration
  const roles: string[] = Array.isArray(user?.roles) ? user?.roles : [];
  const hasMobileTeacher = roles.includes('Mobile Teacher');
  const hasMobileIT = roles.includes('Mobile IT');
  const hasMobileBOD = roles.includes('Mobile BOD');
  const hasMobileUser = roles.includes('Mobile User');
  const hasMobileMonitor = roles.includes('Mobile Monitor');

  // Bus Icon component using Ionicons
  const BusIconComponent = ({ width, height }: { width: number; height: number }) => (
    <View
      style={{
        width,
        height,
        backgroundColor: '#E8F5E9',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <Ionicons name="bus" size={width * 0.5} color="#2E7D32" />
    </View>
  );

  const allItems = [
    {
      id: 1,
      title: t('home.tickets'),
      component: TicketIcon,
      description: 'Ứng dụng Ticket',
      onPress: navigateToTicket,
      key: 'tickets',
    },
    {
      id: 2,
      title: t('home.devices'),
      component: DevicesIcon,
      description: 'Quản lý thiết bị',
      onPress: navigateToDevices,
      key: 'devices',
    },
    {
      id: 3,
      title: 'Điểm danh',
      component: AttendanceIcon,
      description: 'Điểm danh nhân viên/giáo viên',
      onPress: navigateToAttendance,
      key: 'attendance',
    },
    {
      id: 4,
      title: 'Đơn từ',
      component: LeaveIcon,
      description: 'Đơn từ',
      onPress: navigateToLeaveRequests,
      key: 'documents',
    },
    {
      id: 5,
      title: 'Xe buýt',
      component: BusIconComponent,
      description: 'Quản lý xe buýt học sinh',
      onPress: navigateToBus,
      key: 'bus',
    },
  ];

  let menuItems = allItems.filter(() => false);
  if (hasMobileBOD) {
    // Mobile BOD: tất cả (bao gồm Bus)
    menuItems = allItems;
  } else if (hasMobileMonitor) {
    // Mobile Monitor: chỉ Bus
    menuItems = allItems.filter((i) => ['bus'].includes(i.key));
  } else if (hasMobileIT) {
    // Mobile IT: Ticket Admin + Devices
    menuItems = allItems.filter((i) => ['tickets', 'devices'].includes(i.key));
  } else if (hasMobileTeacher) {
    // Mobile Teacher: Ticket Guest + Attendance + Leaves
    menuItems = allItems.filter((i) => ['tickets', 'attendance', 'documents'].includes(i.key));
  } else if (hasMobileUser) {
    // Mobile User: chỉ Ticket Guest
    menuItems = allItems.filter((i) => ['tickets'].includes(i.key));
  } else {
    // Default minimal access (Mobile User)
    menuItems = allItems.filter((i) => i.key === 'tickets');
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState(menuItems);

  // iOS-style search states
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset modal state when screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // This runs when screen loses focus
        if (!isFocused) {
          setShowSearchModal(false);
          setIsSearchFocused(false);
          setSearchQuery('');
          setSearchResults(menuItems);
          setKeyboardHeight(0);
        }
      };
    }, [isFocused, menuItems])
  );

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    const results = menuItems.filter((item) =>
      item.title.toLowerCase().includes(text.toLowerCase())
    );
    setSearchResults(results);
  };

  const handleSelectItem = (title: string) => {
    const item = menuItems.find((i) => i.title === title);
    if (item) {
      item.onPress();
      setSearchHistory((prev) => [title, ...prev.filter((t) => t !== title)]);
      setSearchQuery('');
      setSearchResults(menuItems);
    }
  };

  // iOS-style search handlers
  const openIOSSearch = () => {
    setShowSearchModal(true);
    setIsSearchFocused(true);
  };

  const closeIOSSearch = () => {
    setShowSearchModal(false);
    setIsSearchFocused(false);
    setSearchQuery('');
    setSearchResults(menuItems);
    setKeyboardHeight(0);

    // Dismiss keyboard asynchronously
    Keyboard.dismiss();
  };

  const handleModalPress = () => {
    // Always close modal immediately, regardless of keyboard state
    closeIOSSearch();
  };

  // PanResponder for swipe gestures
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Respond to horizontal swipes with at least 20px movement
      return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 100;
    },
    onPanResponderMove: (evt, gestureState) => {
      // Optional: Add visual feedback during swipe
    },
    onPanResponderRelease: (evt, gestureState) => {
      // If swipe left with sufficient velocity or distance
      if (gestureState.dx < -100 || gestureState.vx < -0.5) {
        closeIOSSearch();
      }
    },
  });

  const handleIOSSearch = (text: string) => {
    setSearchQuery(text);
    const results = menuItems.filter(
      (item) =>
        item.title.toLowerCase().includes(text.toLowerCase()) ||
        item.description.toLowerCase().includes(text.toLowerCase())
    );
    setSearchResults(results);
  };

  const handleIOSSelectItem = (title: string) => {
    const item = menuItems.find((i) => i.title === title);
    if (item) {
      setSearchHistory((prev) => [title, ...prev.filter((t) => t !== title)]);
      closeIOSSearch();

      // Small delay to ensure modal is closed before navigation
      setTimeout(() => {
        item.onPress();
      }, 50);
    }
  };

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardHeight(0)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Gradient border container
  const GradientBorderContainer = React.forwardRef<any, { children: React.ReactNode }>(
    ({ children }, ref) => {
      return (
        <View ref={ref} style={styles.gradientBorderContainer}>
          <LinearGradient
            colors={['#FFCE02', '#BED232']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBorder}
          />
          <View style={styles.innerContainer}>{children}</View>
        </View>
      );
    }
  );

  return (
    <LinearGradient
      colors={[
        'rgba(240, 80, 35, 0.03)', // #F05023 at 5% opacity
        'rgba(255, 206, 2, 0.06)', // #FFCE02 at 5% opacity
        'rgba(190, 210, 50, 0.04)', // #BED232 at 4% opacity
        'rgba(0, 148, 131, 0.07)', // #009483 at 7% opacity
      ]}
      locations={[0, 0.22, 0.85, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        <View className="relative mt-[20%] w-full items-center">
          <Text className="mb-2 text-center text-2xl font-medium text-primary">
            {t('home.welcome')} WISer
          </Text>
          <TouchableOpacity
            className="absolute right-8 top-1"
            onPress={() => navigation.navigate(ROUTES.MAIN.NOTIFICATIONS)}>
            <Ionicons name="notifications-outline" size={20} color="#0A2240" />
            {unreadNotificationCount > 0 && (
              <Animated.View
                style={{
                  position: 'absolute',
                  right: -4,
                  top: -4,
                  transform: [{ scale: pulseAnim }],
                }}
                className="h-[14px] min-w-[12px] items-center justify-center rounded-full bg-red-500 px-1">
                <Text className="text-[7px] font-bold text-white">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </Text>
              </Animated.View>
            )}
          </TouchableOpacity>
          <MaskedView
            maskElement={
              <Text
                className="text-center text-3xl"
                style={{ backgroundColor: 'transparent', fontFamily: 'Mulish-ExtraBold' }}>
                {user?.fullname || 'User'}
              </Text>
            }>
            <LinearGradient
              colors={['#F05023', '#F5AA1E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}>
              <Text
                className="text-center text-4xl opacity-0"
                style={{ fontFamily: 'Mulish-Bold' }}>
                {user?.fullname || 'User'}
              </Text>
            </LinearGradient>
          </MaskedView>

          {/* Attendance Timeline */}
          <View className="mt-6 w-full px-5">
            {/* Time labels with detail button */}
            <View className="flex-row items-center justify-between">
              <View className="left-[5%] flex-row items-center">
                <Text className="text-base font-medium text-teal-700">{checkInTime}</Text>
                {isRefreshingAttendance && (
                  <View className="ml-2">
                    <Ionicons name="sync" size={14} color="#0d9488" />
                  </View>
                )}
              </View>

              <View className="right-[3%] flex-row items-center">
                <Text className="text-base font-medium text-teal-700">{checkOutTime}</Text>
                {isRefreshingAttendance && (
                  <View className="ml-2">
                    <Ionicons name="sync" size={14} color="#0d9488" />
                  </View>
                )}
              </View>
            </View>
            {/* Timeline bar with markers */}
            <View className="relative my-2 h-1 rounded-full bg-gray-200">
              {/* Highlighted segment */}
              <LinearGradient
                colors={['#F3F6DE', '#FFCE02']}
                locations={[0, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  position: 'absolute',
                  left: '5%',
                  right: '5%',
                  height: 4,
                  borderRadius: 2,
                }}
              />
              {/* Entry arrow */}
              <View style={{ position: 'absolute', left: '3%', top: -7, alignItems: 'center' }}>
                <PolygonIcon width={18} height={18} />
                <Text className="text-start text-base text-teal-700">
                  {t('home.check_in_time')}
                </Text>
              </View>
              {/* Exit arrow */}
              <View style={{ position: 'absolute', right: '3%', top: -7, alignItems: 'center' }}>
                <PolygonIcon width={18} height={18} />
                <Text className="text-start text-base text-teal-700">
                  {t('home.check_out_time')}
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-[10%] w-full px-5">
            <GradientBorderContainer>
              <LinearGradient
                colors={[
                  'rgba(255, 206, 2, 0.05)', // #FFCE02 at 5% opacity
                  'rgba(190, 210, 50, 0.05)', // #BED232 at 4% opacity
                ]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 1 }}>
                <View className="flex-row flex-wrap justify-start p-4">
                  {menuItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      className="mt-2 w-[25%] items-center"
                      onPress={item.onPress}>
                      <item.component width={80} height={80} />
                      <Text className="mt-2 text-center text-sm font-medium">{item.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </LinearGradient>
            </GradientBorderContainer>
          </View>
        </View>
        <View className="mt-[10%] w-full px-5">
          <Text className="mb-5 text-center text-xl font-medium text-primary">
            {t('common.search')}?
          </Text>
          {/* iOS-style Search Bar */}
          <TouchableOpacity
            className="mb-3 flex-row items-center rounded-2xl border border-gray-300 bg-white px-4 py-3"
            onPress={openIOSSearch}>
            <FontAwesome name="search" size={18} color="#A1A1AA" />
            <Text className="ml-3 flex-1 font-medium text-gray-400">{t('common.search')} Wis</Text>
          </TouchableOpacity>

          {/* Search History */}
          {searchHistory.length > 0 && (
            <View className="mt-2">
              <Text className="mb-2 text-lg font-semibold text-gray-700">
                {t('common.search')} gần đây
              </Text>
              {searchHistory.slice(0, 3).map((title) => {
                const item = menuItems.find((i) => i.title === title);
                if (!item) return null;
                return (
                  <TouchableOpacity
                    key={title}
                    className="ml-2 flex-row items-center border-b border-gray-200 py-2 pb-4"
                    onPress={() => handleSelectItem(title)}>
                    <item.component width={40} height={40} />
                    <Text className="ml-2 font-medium text-gray-700">{title}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* iOS-style Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="none"
        transparent={false}
        statusBarTranslucent={true}>
        <LinearGradient
          colors={[
            'rgba(240, 80, 35, 0.03)', // #F05023 at 5% opacity
            'rgba(255, 206, 2, 0.06)', // #FFCE02 at 5% opacity
            'rgba(190, 210, 50, 0.04)', // #BED232 at 4% opacity
            'rgba(0, 148, 131, 0.07)', // #009483 at 7% opacity
          ]}
          locations={[0, 0.22, 0.85, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              // paddingTop: Platform.OS === 'android' ? insets.top : 0
            }}>
            <StatusBar barStyle="dark-content" />

            {/* Content Layer */}
            <View style={{ flex: 1 }}>
              {/* Header with Cancel button */}
              <View className="flex-row items-center justify-between px-4 py-4">
                <View style={{ width: 36 }} />
                {/* <Text className="font-semibold text-lg text-gray-900">{t('common.search')}</Text> */}
                <TouchableOpacity
                  onPress={closeIOSSearch}
                  className="rounded-full bg-gray-100 p-2"
                  style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Search Content */}
              <View
                className="flex-1"
                style={{ marginBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 80 }}>
                <ScrollView
                  className="flex-1"
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  scrollEnabled={true}>
                  {searchQuery !== '' ? (
                    /* Search Results in Suggestion Box + Recent Searches Below */
                    <View className="px-1">
                      {/* Results in Suggestion Box */}
                      <View className="mx-2 rounded-xl px-4 py-4">
                        <Text className="mb-3 text-lg font-semibold text-gray-900">
                          Kết quả phù hợp
                        </Text>
                        <GradientBorderContainer>
                          <LinearGradient
                            colors={[
                              'rgba(255, 206, 2, 0.05)', // #FFCE02 at 5% opacity
                              'rgba(190, 210, 50, 0.05)', // #BED232 at 4% opacity
                            ]}
                            start={{ x: 1, y: 0 }}
                            end={{ x: 0, y: 1 }}>
                            <View className="p-4">
                              {searchResults.length > 0 ? (
                                <View className="flex-row flex-wrap justify-between">
                                  {searchResults.map((item) => (
                                    <TouchableOpacity
                                      key={item.id}
                                      className="mt-2 w-[25%] items-center"
                                      onPress={() => handleIOSSelectItem(item.title)}>
                                      <item.component width={80} height={80} />
                                      <Text className="mt-2 text-center text-sm font-medium">
                                        {item.title}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              ) : (
                                <View className="items-center py-8">
                                  <FontAwesome name="search" size={48} color="#ccc" />
                                  <Text className="mt-4 text-base font-medium text-gray-500">
                                    Không tìm thấy kết quả
                                  </Text>
                                  <Text className="mt-1 text-sm font-normal text-gray-400">
                                    Thử {t('common.search')} với từ khóa khác
                                  </Text>
                                </View>
                              )}
                            </View>
                          </LinearGradient>
                        </GradientBorderContainer>
                      </View>

                      {/* Recent Searches Below */}
                      {searchHistory.length > 0 && (
                        <View className="mx-2 mb-4 rounded-xl px-4 py-4">
                          <Text className="mb-3 text-lg font-semibold text-gray-900">
                            Tìm kiếm gần đây
                          </Text>
                          {searchHistory.map((title) => {
                            const item = menuItems.find((i) => i.title === title);
                            if (!item) return null;
                            return (
                              <TouchableOpacity
                                key={title}
                                className="flex-row items-center border-b border-gray-100 py-3 last:border-b-0"
                                onPress={() => handleIOSSelectItem(title)}>
                                <FontAwesome name="clock-o" size={16} color="#666" />
                                <Text className="ml-3 flex-1 text-gray-700">{title}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  ) : (
                    /* Suggestions + Recent Searches */
                    <View className="px-1">
                      {/* Suggestions */}
                      <View className="mx-2 rounded-xl px-4 py-4">
                        <Text className="mb-3 text-lg font-semibold text-gray-900">Gợi ý</Text>
                        <GradientBorderContainer>
                          <LinearGradient
                            colors={[
                              'rgba(255, 206, 2, 0.05)', // #FFCE02 at 5% opacity
                              'rgba(190, 210, 50, 0.05)', // #BED232 at 4% opacity
                            ]}
                            start={{ x: 1, y: 0 }}
                            end={{ x: 0, y: 1 }}>
                            <View className="flex-row flex-wrap justify-start p-4">
                              {menuItems.map((item) => (
                                <TouchableOpacity
                                  key={item.id}
                                  className="mt-2 w-[25%] items-center"
                                  onPress={() => handleIOSSelectItem(item.title)}>
                                  <item.component width={80} height={80} />
                                  <Text className="mt-2 text-center text-sm font-medium">
                                    {item.title}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </LinearGradient>
                        </GradientBorderContainer>
                      </View>

                      {/* Recent Searches Below */}
                      {searchHistory.length > 0 && (
                        <View className="mx-2 mb-4 rounded-xl px-4 py-4">
                          <Text className="mb-3 text-lg font-semibold text-gray-900">
                            Tìm kiếm gần đây
                          </Text>
                          {searchHistory.map((title) => {
                            const item = menuItems.find((i) => i.title === title);
                            if (!item) return null;
                            return (
                              <TouchableOpacity
                                key={title}
                                className="flex-row items-center border-b border-gray-100 py-3 last:border-b-0"
                                onPress={() => handleIOSSelectItem(title)}>
                                <FontAwesome name="clock-o" size={16} color="#666" />
                                <Text className="ml-3 flex-1 text-gray-700">{title}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Spacer for tap to close - fills remaining space */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={closeIOSSearch}
                    style={{ minHeight: 300, flex: 1 }}>
                    <View className="flex-1 items-center justify-center pt-8">
                      <Text className="text-center text-sm text-gray-400">
                        Nhấn vào đây để quay lại
                      </Text>
                    </View>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Search Bar at Bottom */}
              <View
                className="bg-transparent px-4 py-3"
                style={{
                  position: 'absolute',
                  bottom: keyboardHeight > 0 ? keyboardHeight : 0,
                  left: 0,
                  right: 0,
                  paddingBottom: Platform.OS === 'ios' && keyboardHeight === 0 ? insets.bottom : 16,
                  zIndex: 10,
                }}>
                <View className="flex-1 flex-row items-center rounded-full border border-gray-300 bg-white px-3 py-4">
                  <FontAwesome name="search" size={16} color="#666" />
                  <TextInput
                    value={searchQuery}
                    onChangeText={handleIOSSearch}
                    placeholder="Tìm kiếm"
                    className="ml-3 flex-1"
                    autoFocus={true}
                    returnKeyType="search"
                  />
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBorderContainer: {
    width: '100%',
    borderRadius: 16,
    position: 'relative',
    padding: 2, // This is the border width
  },
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  innerContainer: {
    backgroundColor: 'white',
    borderRadius: 15, // Slightly smaller to show gradient border
    width: '100%',
    overflow: 'hidden',
  },
});

export default HomeScreen;
