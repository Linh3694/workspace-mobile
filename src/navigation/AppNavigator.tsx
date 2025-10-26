import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
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
  [ROUTES.SCREENS.WELCOME]: undefined;
  [ROUTES.SCREENS.LOGIN]: undefined;
  [ROUTES.SCREENS.MAIN]: {
    screen?: string;
    params?: {
      forwardMode?: boolean;
      ticketId?: string;
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
  [ROUTES.SCREENS.LEAVE_REQUESTS]: { classId?: string };
};

const MainTabWrapper = ({ route }: { route: any }) => <BottomTabNavigator route={route} />;

const AppNavigator = () => {
  const [ticketComponent, setTicketComponent] = useState(() => TicketGuestScreen);
  const { isAuthenticated, loading } = useAuth();

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

          // Nếu user có bất kỳ role admin nào trong frappe -> admin ticket
          const adminRoles = [
            'System Manager',
            'Administrator',
            'IT Support',
            'Helpdesk',
            'Admin',
            'Technical',
          ];
          const hasAdminRole =
            roles.some((r: string) => adminRoles.includes(r)) ||
            ['superadmin', 'admin', 'technical'].includes(role);

          if (hasAdminRole) {
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
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
