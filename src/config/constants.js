// Thay đổi IP này thành IP của máy chủ của bạn
export const API_BASE_URL = 'https://api-dev.wellspring.edu.vn';

// Các địa chỉ API khác để kiểm tra thử
export const API_URLS = {
    LOCAL: 'http://localhost:5001',
    LOCAL_NETWORK: 'http://10.1.33.214:5001',
    DEV: 'https://api-dev.wellspring.edu.vn',
    PROD: 'https://360wisers.wellspring.edu.vn'
};

// Ticket constants
export const TICKET_PRIORITIES = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent'
};

export const TICKET_STATUSES = {
    ASSIGNED: 'Assigned',
    PROCESSING: 'Processing',
    WAITING: 'Waiting for Customer',
    DONE: 'Done',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled'
};

// Other constants
export const MAX_IMAGES_UPLOAD = 5;
export const MAX_IMAGE_SIZE_MB = 10; 