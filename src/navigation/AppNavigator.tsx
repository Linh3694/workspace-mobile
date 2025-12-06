import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import SplashScreen from '../screens/Login/SplashScreen';
import WelcomeScreen from '../screens/Login/WelcomeScreen';
import LoginScreen from '../screens/Login/SignInScreen';
import { ROUTES } from '../constants/routes';
import TicketGuestScreen from '../screens/Ticket/TicketGuestScreen';
import TicketAdminScreen from '../screens/Ticket/TicketAdminScreen';
import TicketCreate from '../screens/Ticket/TicketCreate';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TicketAdminDetail from '../screens/Ticket/TicketAdminDetail';
import TicketGuestDetail from '../screens/Ticket/TicketGuestDetail';
import DevicesScreen from '../screens/Devices/DevicesScreen';
import DevicesDetailScreen from '../screens/Devices/DevicesDetailScreen';
import DeviceAssignmentHistoryScreen from '../screens/Devices/DeviceAssignmentHistoryScreen';
import { useAuth } from '../context/AuthContext';
import AttendanceHome from '../screens/Attendance/AttendanceHome';
import AttendanceDetail from '../screens/Attendance/AttendanceDetail';
import LeaveRequestsScreen from '../screens/LeaveRequests/LeaveRequestsScreen';
import CreateLeaveRequestScreen from '../screens/LeaveRequests/CreateLeaveRequestScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';
import {
  BusHomeScreen,
  BusTripDetailScreen,
  BusAttendanceScreen,
  FaceCameraScreen,
} from '../screens/Bus';
import { FeedbackScreen, FeedbackDetailScreen } from '../screens/Feedback';
import { MenuScreen } from '../screens/Menu';
import { TimetableScreen } from '../screens/Timetable';

const Stack = createNativeStackNavigator<RootStackParamList>();

export type User = {
  _id: string;
  email: string;
  fullname: string;
  avatarUrl?: string;
  role?: string;
  lastSeen?: number;
  isOnline?: boolean;
  employeeCode?: string;
  department?: string;
  phone?: string;
};

export type RootStackParamList = {
  [ROUTES.SCREENS.SPLASH]: undefined;
  [ROUTES.SCREENS.WELCOME]: undefined;
  [ROUTES.SCREENS.LOGIN]: undefined;
  [ROUTES.SCREENS.MAIN]: {
    screen?: string;
    params?: {
      forwardMode?: boolean;
      ticketId?: string;
      notificationId?: string;
      refreshAttendance?: boolean;
    };
  };
  [ROUTES.SCREENS.TICKET_DETAIL]: { ticketId: string };
  [ROUTES.SCREENS.TICKET_CREATE]: undefined;
  [ROUTES.SCREENS.TICKET_ADMIN_DETAIL]: { ticketId: string };
  [ROUTES.SCREENS.TICKET_GUEST_DETAIL]: { ticketId: string };
  [ROUTES.SCREENS.TICKET]: undefined;
  [ROUTES.SCREENS.TICKET_ADMIN]: undefined;
  [ROUTES.SCREENS.TICKET_GUEST]: undefined;
  [ROUTES.SCREENS.DEVICES]: { refresh?: boolean } | undefined;
  [ROUTES.SCREENS.DEVICE_DETAIL]: {
    deviceId: string;
    deviceType: 'laptop' | 'monitor' | 'printer' | 'projector' | 'tool';
  };
  [ROUTES.SCREENS.DEVICE_ASSIGNMENT_HISTORY]: {
    deviceId: string;
    deviceType: 'laptop' | 'monitor' | 'printer' | 'projector' | 'tool';
    deviceName: string;
  };
  [ROUTES.SCREENS.ATTENDANCE_HOME]: undefined;
  [ROUTES.SCREENS.ATTENDANCE_DETAIL]: { classId: string; date: string };
  [ROUTES.SCREENS.LEAVE_REQUESTS]: {
    classId?: string;
    studentId?: string;
    leaveRequestId?: string;
    fromNotification?: boolean;
  };
  [ROUTES.SCREENS.CREATE_LEAVE_REQUEST]: { classId: string; classTitle?: string };
  Notification: { notificationId?: string } | undefined;
  // Bus Module Routes
  BusHome: undefined;
  BusTripDetail: { tripId: string };
  BusAttendance: { tripId: string; tripType: string };
  FaceCamera: { tripId: string; onSuccess?: () => void };
  // Feedback Module Routes
  [ROUTES.SCREENS.FEEDBACK]: undefined;
  [ROUTES.SCREENS.FEEDBACK_DETAIL]: { feedbackId: string };
  // Menu Module Routes
  [ROUTES.SCREENS.MENU]: undefined;
  // Timetable Module Routes
  [ROUTES.SCREENS.TIMETABLE]: undefined;
};

const MainTabWrapper = ({ route }: { route: any }) => <BottomTabNavigator route={route} />;

// Track if splash has been shown this session (persists across fast refresh)
let splashShownThisSession = false;

const AppNavigator = () => {
  const [ticketComponent, setTicketComponent] = useState(() => TicketGuestScreen);
  const [showSplash, setShowSplash] = useState(() => {
    // Only show splash if not shown this session
    if (!splashShownThisSession) {
      return true;
    }
    return false;
  });
  const { isAuthenticated, loading } = useAuth();

  // DEV: Reset để test lại splash
  // @ts-ignore
  global.resetSplash = () => {
    splashShownThisSession = false;
    setShowSplash(true);
  };

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const storedRole = (await AsyncStorage.getItem('userRole'))?.toLowerCase().trim();
        const storedRolesStr = await AsyncStorage.getItem('userRoles');
        const storedRoles: string[] = storedRolesStr ? JSON.parse(storedRolesStr) : [];
        console.log('AppNavigator - userRole:', storedRole, 'userRoles:', storedRoles);

        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          const role = (user.role || storedRole || '').toLowerCase().trim();
          const roles = Array.isArray(user.roles) ? user.roles : storedRoles;

          // Logic phân quyền theo Mobile roles:
          // Mobile IT -> Ticket Admin, còn lại -> Ticket Guest
          const hasMobileIT = roles.includes('Mobile IT');

          if (hasMobileIT) {
            setTicketComponent(() => TicketAdminScreen);
          } else {
            setTicketComponent(() => TicketGuestScreen);
          }
        } else {
          setTicketComponent(() => TicketGuestScreen);
        }
      } catch (error) {
        console.error('Lỗi khi kiểm tra role:', error);
        setTicketComponent(() => TicketGuestScreen);
      }
    };

    if (isAuthenticated) {
      checkUserRole();
    }
  }, [isAuthenticated]);

  // Show splash screen first
  console.log(
    '🚀 AppNavigator - showSplash:',
    showSplash,
    'splashShownThisSession:',
    splashShownThisSession
  );
  if (showSplash) {
    console.log('🎬 Showing SplashScreen...');
    return (
      <SplashScreen
        onFinish={() => {
          console.log('✅ SplashScreen finished!');
          splashShownThisSession = true;
          setShowSplash(false);
        }}
      />
    );
  }

  if (loading) {
    // Có thể thêm màn hình loading ở đây
    return null;
  }

  return (
    <Stack.Navigator
      key="AppStackNavigator"
      id={undefined}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      {!isAuthenticated ? (
        // Auth Stack
        <>
          <Stack.Screen name={ROUTES.SCREENS.WELCOME} component={WelcomeScreen} />
          <Stack.Screen name={ROUTES.SCREENS.LOGIN} component={LoginScreen} />
        </>
      ) : (
        // App Stack
        <>
          <Stack.Screen
            name={ROUTES.SCREENS.MAIN}
            component={MainTabWrapper}
            initialParams={{ screen: 'Home' }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.TICKET}
            component={ticketComponent}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.TICKET_CREATE}
            component={TicketCreate}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.TICKET_ADMIN_DETAIL}
            component={TicketAdminDetail}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.TICKET_GUEST_DETAIL}
            component={TicketGuestDetail}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.TICKET_ADMIN}
            component={TicketAdminScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.TICKET_GUEST}
            component={TicketGuestScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.DEVICES}
            component={DevicesScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.DEVICE_DETAIL}
            component={DevicesDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.DEVICE_ASSIGNMENT_HISTORY}
            component={DeviceAssignmentHistoryScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.ATTENDANCE_HOME}
            component={AttendanceHome}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.ATTENDANCE_DETAIL}
            component={AttendanceDetail}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.LEAVE_REQUESTS}
            component={LeaveRequestsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.CREATE_LEAVE_REQUEST}
            component={CreateLeaveRequestScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.MAIN.NOTIFICATIONS}
            component={NotificationsScreen}
            options={{ headerShown: false }}
          />
          {/* Bus Module Screens */}
          <Stack.Screen name="BusHome" component={BusHomeScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="BusTripDetail"
            component={BusTripDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BusAttendance"
            component={BusAttendanceScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="FaceCamera"
            component={FaceCameraScreen}
            options={{ headerShown: false, animation: 'slide_from_bottom' }}
          />
          {/* Feedback Module Screens */}
          <Stack.Screen
            name={ROUTES.SCREENS.FEEDBACK}
            component={FeedbackScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.FEEDBACK_DETAIL}
            component={FeedbackDetailScreen}
            options={{ headerShown: false }}
          />
          {/* Menu Module Screen */}
          <Stack.Screen
            name={ROUTES.SCREENS.MENU}
            component={MenuScreen}
            options={{ headerShown: false }}
          />
          {/* Timetable Module Screen */}
          <Stack.Screen
            name={ROUTES.SCREENS.TIMETABLE}
            component={TimetableScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
