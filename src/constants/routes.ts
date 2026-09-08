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
    ADMINISTRATIVE_TICKET_EDIT: 'AdministrativeTicketEdit',
    ADMINISTRATIVE_TICKET_ADMIN_DETAIL: 'AdministrativeTicketAdminDetail',
    ADMINISTRATIVE_TICKET_GUEST_DETAIL: 'AdministrativeTicketGuestDetail',
    ADMINISTRATIVE_TICKET_ADMIN: 'AdministrativeTicketAdmin',
    ADMINISTRATIVE_TICKET_GUEST: 'AdministrativeTicketGuest',
    DEVICES: 'Devices',
    /** Bản ui-v2 chạy song song với DEVICES để đối chiếu. Gỡ khi V2 thay hẳn V1. */
    DEVICES_V2: 'DevicesV2',
    DEVICE_CREATE: 'DeviceCreate',
    DEVICE_DETAIL: 'DeviceDetail',
    DEVICE_ASSIGNMENT_HISTORY: 'DeviceAssignmentHistory',
    /** "Tài sản của tôi" — xác nhận / phê duyệt biên bản bàn giao điện tử */
    MY_HANDOVERS: 'MyHandovers',
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
    /** Sự vụ kỷ luật — sinh tự động khi HS chạm ngưỡng điểm trừ trong tháng */
    DISCIPLINE_CASE_LIST: 'DisciplineCaseList',
    DISCIPLINE_CASE_DETAIL: 'DisciplineCaseDetail',
    // AI Assistant
    AI_ASSISTANT: 'AIAssistant',
    // CRM Issue (Vấn đề)
    CRM_ISSUE_LIST: 'CRMIssueList',
    CRM_ISSUE_DETAIL: 'CRMIssueDetail',
    CRM_ISSUE_ADD: 'CRMIssueAdd',
    CRM_ISSUE_EDIT: 'CRMIssueEdit',
    /** Hoạt động lớp (journal GVCN/phó CN) */
    CLASS_ACTIVITY: 'ClassActivity',
    /** Trao đổi realtime với PH */
    EXCHANGE_LIST: 'ExchangeList',
    EXCHANGE_CHAT: 'ExchangeChat',
    /** Thông tin hội thoại (thành viên / ảnh-video / tệp) — giống sidebar web */
    EXCHANGE_CHAT_INFO: 'ExchangeChatInfo',
    /** Danh sách đầy đủ thành viên + tìm kiếm */
    EXCHANGE_CHAT_MEMBERS: 'ExchangeChatMembers',
    /** Danh sách đầy đủ Ảnh & Video / Tệp — chia theo ngày gửi */
    EXCHANGE_CHAT_ATTACHMENTS: 'ExchangeChatAttachments',
    /** Đặt phòng (ERP Room Booking) */
    ROOM_BOOKING: 'RoomBooking',
    ROOM_BOOKING_CREATE: 'RoomBookingCreate',
    /** Họp phụ huynh 1:1 (SIS PT Meeting) — lịch ca của giáo viên */
    PARENT_MEETING: 'ParentMeeting',
    /** Ghi meeting note sau ca họp (chỉ BGH đọc được nội dung) */
    PARENT_MEETING_NOTE: 'ParentMeetingNote',
    /** Tổng hợp đợt họp + danh sách chờ (BGH + giáo vụ đọc) — nút xuất bản chỉ giáo vụ/SM */
    PARENT_MEETING_ADMIN: 'ParentMeetingAdmin',
    /** Quản lý dự án (PM) — cũng là màn đích của mọi thông báo `pm_*` */
    PM_PROJECTS: 'PMProjects',
    PM_PROJECT_DETAIL: 'PMProjectDetail',
    PM_INVITATIONS: 'PMInvitations',
    PM_TASK_DETAIL: 'PMTaskDetail',
    PM_MY_WORK: 'PMMyWork',
    PM_MEETING_DETAIL: 'PMMeetingDetail',
  },
  // Tab names trong bottom navigation
  TABS: {
    HOME: 'Home',
    WISLIFE: 'Social',
    /** Tab Nhắn tin (Exchange) — chỉ hiện với Giáo viên & BOD */
    CHAT: 'ChatTab',
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
    /** Tab Nhắn tin (Exchange) — chỉ hiện với Giáo viên & BOD */
    CHAT: 'ChatTab',
    NOTIFICATIONS: 'Notification',
    PROFILE: 'Profile',
    TICKET: 'Ticket',
  },
} as const;

// Type helper cho screen names
export type RootStackScreens = (typeof ROUTES.SCREENS)[keyof typeof ROUTES.SCREENS];
export type TabScreens = (typeof ROUTES.TABS)[keyof typeof ROUTES.TABS];
