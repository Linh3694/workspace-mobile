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
    /** Ticket Hành chính (Frappe) — tách module IT */
    ADMINISTRATIVE_TICKET_CREATE: 'AdministrativeTicketCreate',
    ADMINISTRATIVE_TICKET_ADMIN_DETAIL: 'AdministrativeTicketAdminDetail',
    ADMINISTRATIVE_TICKET_GUEST_DETAIL: 'AdministrativeTicketGuestDetail',
    ADMINISTRATIVE_TICKET_ADMIN: 'AdministrativeTicketAdmin',
    ADMINISTRATIVE_TICKET_GUEST: 'AdministrativeTicketGuest',
    DEVICES: 'Devices',
    DEVICE_DETAIL: 'DeviceDetail',
    DEVICE_ASSIGNMENT_HISTORY: 'DeviceAssignmentHistory',
    WISLIFE: 'Social',
    ATTENDANCE_HOME: 'AttendanceHome',
    ATTENDANCE_DETAIL: 'AttendanceDetail',
    LEAVE_REQUESTS: 'LeaveRequests',
    CREATE_LEAVE_REQUEST: 'CreateLeaveRequest',
    // Feedback screens
    FEEDBACK: 'Feedback',
    FEEDBACK_DETAIL: 'FeedbackDetail',
    // Menu screens
    MENU: 'Menu',
    // Timetable screens
    TIMETABLE: 'Timetable',
    // Calendar screens
    CALENDAR: 'Calendar',
    // Class Log screens (Sổ đầu bài)
    CLASS_LOG: 'ClassLog',
    CLASS_LOG_DETAIL: 'ClassLogDetail',
    STUDENT_CLASS_LOG_DETAIL: 'StudentClassLogDetail',
    // Daily Health screens (Y tế)
    DAILY_HEALTH: 'DailyHealth',
    HEALTH_EXAM: 'HealthExam',
    CREATE_HEALTH_VISIT: 'CreateHealthVisit',
    /** Màn full-screen: chẩn đoán BV sau chuyển viện */
    HEALTH_EXAM_HOSPITAL: 'HealthExamHospital',
    /** Màn full-screen: thăm khám bổ sung */
    HEALTH_EXAM_SUPPLEMENTARY: 'HealthExamSupplementary',
    // Teacher Health screens (Sức khoẻ - Mobile Teacher)
    TEACHER_HEALTH: 'TeacherHealth',
    STUDENT_HEALTH_DETAIL: 'StudentHealthDetail',
    // Discipline screens (Kỷ luật)
    DISCIPLINE: 'Discipline',
    DISCIPLINE_ADD: 'DisciplineAdd',
    DISCIPLINE_DETAIL: 'DisciplineDetail',
    DISCIPLINE_EDIT: 'DisciplineEdit',
    // AI Assistant
    AI_ASSISTANT: 'AIAssistant',
    // CRM Issue (Vấn đề)
    CRM_ISSUE_LIST: 'CRMIssueList',
    CRM_ISSUE_DETAIL: 'CRMIssueDetail',
    CRM_ISSUE_ADD: 'CRMIssueAdd',
    CRM_ISSUE_EDIT: 'CRMIssueEdit',
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
