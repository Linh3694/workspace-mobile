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
import AdministrativeTicketGuestScreen from '../screens/AdministrativeTicket/TicketGuestScreen';
import AdministrativeTicketAdminScreen from '../screens/AdministrativeTicket/TicketAdminScreen';
import AdministrativeTicketCreate from '../screens/AdministrativeTicket/TicketCreate';
import AdministrativeTicketAdminDetail from '../screens/AdministrativeTicket/TicketAdminDetail';
import AdministrativeTicketGuestDetail from '../screens/AdministrativeTicket/TicketGuestDetail';
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
import { CalendarScreen } from '../screens/Calendar';
import PostDetailScreen from '../screens/Wislife/PostDetailScreen';
import { Post } from '../types/post';
import { ClassLogScreen, ClassLogDetailScreen } from '../screens/ClassLog';
import StudentClassLogDetailScreen from '../screens/ClassLog/StudentClassLogDetailScreen';
import { ClassLogStudent } from '../services/classLogService';
import {
  DailyHealthScreen,
  HealthExamScreen,
  CreateHealthVisitScreen,
  HospitalDiagnosisScreen,
  SupplementaryExamScreen,
} from '../screens/DailyHealth';
import { TeacherHealthScreen } from '../screens/TeacherHealth';
import StudentHealthDetailScreen from '../screens/TeacherHealth/StudentHealthDetailScreen';
import { DailyHealthVisit } from '../services/dailyHealthService';
import { TimetableEntry } from '../services/timetableService';
import DisciplineScreen from '../screens/Discipline/DisciplineScreen';
import DisciplineDetailScreen from '../screens/Discipline/DisciplineDetailScreen';
import DisciplineAddEditScreen from '../screens/Discipline/DisciplineAddEditScreen';
import { AIAssistantScreen } from '../screens/AIAssistant';
import {
  CRMIssueListScreen,
  CRMIssueDetailScreen,
  CRMIssueAddEditScreen,
} from '../screens/CRMIssue';

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
  [ROUTES.SCREENS.ADMINISTRATIVE_TICKET_CREATE]: undefined;
  [ROUTES.SCREENS.ADMINISTRATIVE_TICKET_ADMIN_DETAIL]: { ticketId: string };
  [ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST_DETAIL]: { ticketId: string };
  [ROUTES.SCREENS.ADMINISTRATIVE_TICKET_ADMIN]: undefined;
  [ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST]: undefined;
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
  [ROUTES.SCREENS.LEAVE_REQUESTS]:
    | {
        classId?: string;
        leaveRequestId?: string;
        fromNotification?: boolean;
      }
    | undefined;
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
  // Calendar Module Routes
  [ROUTES.SCREENS.CALENDAR]: undefined;
  // Class Log Module Routes (Sổ đầu bài)
  [ROUTES.SCREENS.CLASS_LOG]: undefined;
  [ROUTES.SCREENS.CLASS_LOG_DETAIL]: {
    classId: string;
    date: string;
    period: string;
    periodName: string;
    subjectTitle?: string;
    timetableEntry?: TimetableEntry;
  };
  [ROUTES.SCREENS.STUDENT_CLASS_LOG_DETAIL]: {
    student: {
      name: string;
      student_id?: string;
      student_name: string;
      student_code?: string;
      user_image?: string;
      avatar_url?: string;
      photo?: string;
    };
    attendanceStatus: 'present' | 'absent' | 'late' | 'excused';
    isAtClinic?: boolean;
    healthVisitInfo?: {
      visit_id: string;
      status: string;
      leave_class_time: string | null;
      leave_clinic_time: string | null;
    };
    classId: string;
    date: string;
    period: string;
    initialData?: ClassLogStudent;
  };
  // Daily Health Module Routes (Y tế)
  [ROUTES.SCREENS.DAILY_HEALTH]: { visitId?: string } | undefined;
  [ROUTES.SCREENS.HEALTH_EXAM]: { visitId: string; visitData?: DailyHealthVisit };
  [ROUTES.SCREENS.CREATE_HEALTH_VISIT]: undefined;
  [ROUTES.SCREENS.HEALTH_EXAM_HOSPITAL]: { visitId: string; examId: string };
  [ROUTES.SCREENS.HEALTH_EXAM_SUPPLEMENTARY]: { visitId: string; examId: string };
  // Teacher Health Module Routes (Sức khoẻ - Mobile Teacher)
  [ROUTES.SCREENS.TEACHER_HEALTH]: undefined;
  [ROUTES.SCREENS.STUDENT_HEALTH_DETAIL]: {
    classId: string;
    studentId: string;
    date: string;
  };
  // Discipline Module Routes (Kỷ luật)
  [ROUTES.SCREENS.DISCIPLINE]: undefined;
  [ROUTES.SCREENS.DISCIPLINE_ADD]: undefined;
  [ROUTES.SCREENS.DISCIPLINE_DETAIL]: { recordId: string; record?: any };
  [ROUTES.SCREENS.DISCIPLINE_EDIT]: { recordId: string; record?: any };
  // Wislife Module Routes
  PostDetail: { post: Post; onUpdate?: (post: Post) => void };
  // AI Assistant
  [ROUTES.SCREENS.AI_ASSISTANT]: undefined;
  // CRM Issue (Vấn đề)
  [ROUTES.SCREENS.CRM_ISSUE_LIST]: undefined;
  [ROUTES.SCREENS.CRM_ISSUE_DETAIL]: { issueId: string };
  [ROUTES.SCREENS.CRM_ISSUE_ADD]: undefined;
  [ROUTES.SCREENS.CRM_ISSUE_EDIT]: { issueId: string };
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
            name={ROUTES.SCREENS.ADMINISTRATIVE_TICKET_CREATE}
            component={AdministrativeTicketCreate}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.ADMINISTRATIVE_TICKET_ADMIN_DETAIL}
            component={AdministrativeTicketAdminDetail}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST_DETAIL}
            component={AdministrativeTicketGuestDetail}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.ADMINISTRATIVE_TICKET_ADMIN}
            component={AdministrativeTicketAdminScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.ADMINISTRATIVE_TICKET_GUEST}
            component={AdministrativeTicketGuestScreen}
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
          {/* Calendar Module Screen */}
          <Stack.Screen
            name={ROUTES.SCREENS.CALENDAR}
            component={CalendarScreen}
            options={{ headerShown: false }}
          />
          {/* Class Log Module Screens (Sổ đầu bài) */}
          <Stack.Screen
            name={ROUTES.SCREENS.CLASS_LOG}
            component={ClassLogScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.CLASS_LOG_DETAIL}
            component={ClassLogDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.STUDENT_CLASS_LOG_DETAIL}
            component={StudentClassLogDetailScreen}
            options={{ headerShown: false }}
          />
          {/* Daily Health Module Screens (Y tế) */}
          <Stack.Screen
            name={ROUTES.SCREENS.DAILY_HEALTH}
            component={DailyHealthScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.HEALTH_EXAM}
            component={HealthExamScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.CREATE_HEALTH_VISIT}
            component={CreateHealthVisitScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.HEALTH_EXAM_HOSPITAL}
            component={HospitalDiagnosisScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.HEALTH_EXAM_SUPPLEMENTARY}
            component={SupplementaryExamScreen}
            options={{ headerShown: false }}
          />
          {/* Teacher Health Module Screens (Sức khoẻ - Mobile Teacher) */}
          <Stack.Screen
            name={ROUTES.SCREENS.TEACHER_HEALTH}
            component={TeacherHealthScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.STUDENT_HEALTH_DETAIL}
            component={StudentHealthDetailScreen}
            options={{ headerShown: false }}
          />
          {/* Discipline Module Screens (Kỷ luật) */}
          <Stack.Screen
            name={ROUTES.SCREENS.DISCIPLINE}
            component={DisciplineScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.DISCIPLINE_ADD}
            component={DisciplineAddEditScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.DISCIPLINE_DETAIL}
            component={DisciplineDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.DISCIPLINE_EDIT}
            component={DisciplineAddEditScreen}
            options={{ headerShown: false }}
          />
          {/* Wislife Module Screen */}
          <Stack.Screen
            name="PostDetail"
            component={PostDetailScreen}
            options={{ headerShown: false }}
          />
          {/* AI Assistant Screen */}
          <Stack.Screen
            name={ROUTES.SCREENS.AI_ASSISTANT}
            component={AIAssistantScreen}
            options={{ headerShown: false }}
          />
          {/* CRM Issue (Vấn đề) */}
          <Stack.Screen
            name={ROUTES.SCREENS.CRM_ISSUE_LIST}
            component={CRMIssueListScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.CRM_ISSUE_DETAIL}
            component={CRMIssueDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.CRM_ISSUE_ADD}
            component={CRMIssueAddEditScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name={ROUTES.SCREENS.CRM_ISSUE_EDIT}
            component={CRMIssueAddEditScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
