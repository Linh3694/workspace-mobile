/**
 * Global App Constants
 * API endpoints và các config chung cho toàn app
 *
 * ⚠️ Lưu ý: Các constants liên quan đến Ticket (status, priority, category...)
 * đã được chuyển sang: src/config/ticketConstants.ts
 */

// Thay đổi IP này thành IP của máy chủ của bạn
// Sử dụng Frappe backend với microservices
export const API_BASE_URL = 'https://admin.sis.wellspring.edu.vn'; // Frappe framework

// Tất cả services (Frappe + Microservices) dùng chung base domain
export const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || 'https://admin.sis.wellspring.edu.vn';

// Helper function để lấy API base URL
export const getApiBaseUrl = () => {
  return process.env.EXPO_PUBLIC_API_BASE_URL || API_BASE_URL;
};

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
