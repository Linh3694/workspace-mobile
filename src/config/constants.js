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

// Base URL cho tất cả services (Frappe + Microservices)
export const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || PROD_API_URL;

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
