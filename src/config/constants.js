/**
 * Global App Constants
 * API endpoints và các config chung cho toàn app
 *
 * ⚠️ Lưu ý: Các constants liên quan đến Ticket (status, priority, category...)
 * đã được chuyển sang: src/config/ticketConstants.ts
 */

// Production API Base URL
const PROD_API_URL = 'https://prod.sis.wellspring.edu.vn';

// Main API Base URL - có thể override bằng environment variable
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || PROD_API_URL;

/** Gateway chung — notification-service cùng host Nginx (override bằng EXPO_PUBLIC_NOTIFICATION_API_BASE_URL) */
export const NOTIFICATION_API_BASE_URL =
  process.env.EXPO_PUBLIC_NOTIFICATION_API_BASE_URL || API_BASE_URL;

/** Ghi song song DocType Mobile Device Token trên Frappe (rollback) */
export const DEVICE_TOKEN_DUAL_WRITE =
  process.env.EXPO_PUBLIC_DEVICE_TOKEN_DUAL_WRITE === 'true';

// Base URL cho tất cả services (Frappe + Microservices)
export const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || PROD_API_URL;

/** Tên site Frappe (thư mục sites/…) cho namespace Socket.IO — ưu tiên EXPO_PUBLIC_FRAPPE_SITE_NAME */
function resolveFrappeSiteName() {
  const fromEnv = (process.env.EXPO_PUBLIC_FRAPPE_SITE_NAME || '').trim();
  if (fromEnv) return fromEnv;
  const base = API_BASE_URL;
  try {
    if (base && String(base).startsWith('http')) {
      return new URL(base).hostname;
    }
  } catch {
    /* ignore */
  }
  return 'localhost';
}
export const FRAPPE_SITE_NAME = resolveFrappeSiteName();

// AI Backend URL - dùng cho AI Assistant chat streaming
// Giống web: dùng cùng base với main API + /api/ai (có thể override bằng EXPO_PUBLIC_AI_BACKEND_URL)
export const AI_BACKEND_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || `${API_BASE_URL}/api/ai`;

// Helper function để lấy API base URL
export const getApiBaseUrl = () => {
  return API_BASE_URL;
};

// User management endpoints (Frappe RPC API)
export const USER_API_BASE = `${API_BASE_URL}/api/method/erp.api.erp_common_user.user_management`;

// Environment URLs cho development và testing
export const API_URLS = {
  PROD: PROD_API_URL,
  LOCAL: 'http://localhost:8000',
  LOCAL_NETWORK: 'http://10.1.33.214:8000',
};
