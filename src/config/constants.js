// Thay đổi IP này thành IP của máy chủ của bạn
// Sử dụng Frappe backend với microservices
export const API_BASE_URL = 'https://admin.sis.wellspring.edu.vn'; // Frappe framework

// Tất cả services (Frappe + Microservices) dùng chung base domain
export const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || 'https://admin.sis.wellspring.edu.vn';

// Helper function để lấy API base URL
export const getApiBaseUrl = () => {
  return process.env.EXPO_PUBLIC_API_BASE_URL || API_BASE_URL;
};

// Chat service endpoint (proxied by nginx)
export const CHAT_SERVICE_URL = 'https://admin.sis.wellspring.edu.vn/api/chat';

// Socket.IO URL for Chat Service (sử dụng path riêng để tránh conflict với SIS)
export const CHAT_SOCKET_URL = 'https://admin.sis.wellspring.edu.vn';
export const CHAT_SOCKET_PATH = '/chat-socket.io/';

// User management endpoints (Frappe RPC API)
export const USER_API_BASE =
  'https://admin.sis.wellspring.edu.vn/api/method/erp.api.erp_common_user.user_management';

// Các địa chỉ API khác để kiểm tra thử
export const API_URLS = {
  FRAPPE_LOCAL: 'http://localhost:8000',
  MICROSERVICES_LOCAL: 'http://localhost:5001',
  LOCAL: 'http://localhost:5001',
  LOCAL_NETWORK: 'http://10.1.33.214:5001',
  DEV: 'https://api-dev.wellspring.edu.vn',
  PROD: 'https://360wisers.wellspring.edu.vn',
};

// Ticket constants
export const TICKET_PRIORITIES = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const TICKET_STATUSES = {
  ASSIGNED: 'Assigned',
  PROCESSING: 'Processing',
  WAITING: 'Waiting for Customer',
  DONE: 'Done',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

// Other constants
export const MAX_IMAGES_UPLOAD = 5;
export const MAX_IMAGE_SIZE_MB = 10;
