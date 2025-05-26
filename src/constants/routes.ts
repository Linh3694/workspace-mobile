export const ROUTES = {
    // Screen names cho navigation
    SCREENS: {
        WELCOME: 'Welcome',
        LOGIN: 'Login',
        MAIN: 'Main',
        CHAT_DETAIL: 'ChatDetail',
        CHAT_INIT: 'ChatInit',
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
        WISLIFE: 'Wislife',
    },
    // Tab names trong bottom navigation
    TABS: {
        HOME: 'Home',
        CHAT: 'Chat',
        WISLIFE: 'Wislife',
        TICKET: 'Ticket',
        NOTIFICATION: 'Notification',
        PROFILE: 'Profile'
    },
    // Auth routes
    AUTH: {
        WELCOME: 'Welcome',
        LOGIN: 'Login'
    },
    // Main routes
    MAIN: {
        HOME: 'Home',
        CHAT: 'Chat',
        WISLIFE: 'Wislife',
        NOTIFICATIONS: 'Notification',
        PROFILE: 'Profile',
        TICKET: 'Ticket'
    }
} as const;

// Type helper cho screen names
export type RootStackScreens = typeof ROUTES.SCREENS[keyof typeof ROUTES.SCREENS];
export type TabScreens = typeof ROUTES.TABS[keyof typeof ROUTES.TABS];