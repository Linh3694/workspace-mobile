export const ROUTES = {
  // Screen names cho navigation
  SCREENS: {
    SPLASH: 'Splash',
    WELCOME: 'Welcome',
    LOGIN: 'Login',
    MAIN: 'Main',
    TICKET_DETAIL: 'TicketDetail',
    TICKET_CREATE: 'TicketCreate',
    TICKET_ADMIN_DETAIL: 'TicketAdminDetail',
    TICKET_GUEST_DETAIL: 'TicketGuestDetail',
    TICKET: 'Ticket',
    TICKET_ADMIN: 'TicketAdmin',
    TICKET_GUEST: 'TicketGuest',
    DEVICES: 'Devices',
    DEVICE_DETAIL: 'DeviceDetail',
    DEVICE_ASSIGNMENT_HISTORY: 'DeviceAssignmentHistory',
    WISLIFE: 'Social',
    ATTENDANCE_HOME: 'AttendanceHome',
    ATTENDANCE_DETAIL: 'AttendanceDetail',
    LEAVE_REQUESTS: 'LeaveRequests',
    // Feedback screens
    FEEDBACK: 'Feedback',
    FEEDBACK_DETAIL: 'FeedbackDetail',
  },
  // Tab names trong bottom navigation
  TABS: {
    HOME: 'Home',
    WISLIFE: 'Social',
    TICKET: 'Ticket',
    NOTIFICATION: 'Notification',
    PROFILE: 'Profile',
  },
  // Auth routes
  AUTH: {
    WELCOME: 'Welcome',
    LOGIN: 'Login',
  },
  // Main routes
  MAIN: {
    HOME: 'Home',
    WISLIFE: 'Social',
    NOTIFICATIONS: 'Notification',
    PROFILE: 'Profile',
    TICKET: 'Ticket',
  },
} as const;

// Type helper cho screen names
export type RootStackScreens = (typeof ROUTES.SCREENS)[keyof typeof ROUTES.SCREENS];
export type TabScreens = (typeof ROUTES.TABS)[keyof typeof ROUTES.TABS];
