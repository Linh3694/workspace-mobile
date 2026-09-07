/**
 * Global App Constants
 * API endpoints và các config chung cho toàn app
 *
 * ⚠️ Lưu ý: Các constants liên quan đến Ticket (status, priority, category...)
 * đã được chuyển sang: src/config/ticketConstants.ts
 */

/**
 * Base URL theo môi trường (không có dấu / cuối) — chọn bằng EXPO_PUBLIC_APP_ENV.
 *
 * Thứ tự ưu tiên:
 *   1) EXPO_PUBLIC_API_BASE_URL / EXPO_PUBLIC_BASE_URL — ghi đè tất cả (máy local, ngrok…)
 *   2) EXPO_PUBLIC_APP_ENV — chọn bảng dưới đây (script `npm run *:staging`, eas.json)
 *   3) Không set gì: production (kể cả bản dev). Muốn staging thì chạy `npm run start:staging`.
 */
export const ENVIRONMENT_URLS = {
  staging: 'https://admin.sis.wellspring.edu.vn',
  production: 'https://prod.sis.wellspring.edu.vn',
};

// Production API Base URL
const PROD_API_URL = ENVIRONMENT_URLS.production;

/** 'staging' | 'production' — xem thứ tự ưu tiên ở ENVIRONMENT_URLS */
function resolveAppEnvironment() {
  const raw = (process.env.EXPO_PUBLIC_APP_ENV || '').trim().toLowerCase();
  if (raw === 'staging' || raw === 'stage') return 'staging';
  if (raw === 'production' || raw === 'prod') return 'production';
  // Mặc định trỏ production ngay cả khi __DEV__ — staging (42.96.40.246) chạy bản erp khác,
  // test ở đó cho kết quả không khớp prod. Cần staging: EXPO_PUBLIC_APP_ENV=staging.
  return 'production';
}

/** Môi trường app đang trỏ tới */
export const APP_ENV = resolveAppEnvironment();

const DEFAULT_BASE_URL = ENVIRONMENT_URLS[APP_ENV];

/** Bỏ dấu / cuối để nối path không sinh ra `//` */
const normalizeBaseUrl = (url) =>
  String(url || '')
    .trim()
    .replace(/\/+$/, '');

// Main API Base URL - có thể override bằng environment variable
export const API_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL
);

/** Gateway chung — notification-service cùng host Nginx (override bằng EXPO_PUBLIC_NOTIFICATION_API_BASE_URL) */
export const NOTIFICATION_API_BASE_URL =
  process.env.EXPO_PUBLIC_NOTIFICATION_API_BASE_URL || API_BASE_URL;

/** Ghi song song DocType Mobile Device Token trên Frappe (rollback) */
export const DEVICE_TOKEN_DUAL_WRITE = process.env.EXPO_PUBLIC_DEVICE_TOKEN_DUAL_WRITE === 'true';

// Base URL cho tất cả services (Frappe + Microservices)
export const BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_BASE_URL || DEFAULT_BASE_URL);

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
  STAGING: ENVIRONMENT_URLS.staging,
  LOCAL: 'http://localhost:8000',
  LOCAL_NETWORK: 'http://10.1.33.214:8000',
};

// `EXPO_PUBLIC_*` được NHÚNG vào bundle lúc transform chứ không đọc lúc chạy: đổi cờ mà
// Metro còn giữ cache cũ thì app vẫn gọi môi trường trước đó — im lặng, biểu hiện ra ngoài
// chỉ là "không đăng nhập được". Dòng log này để nhìn phát biết ngay (các script npm đã
// kèm sẵn bước xoá metro-cache).
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log(`🌐 [constants] env=${APP_ENV} · api=${API_BASE_URL} · base=${BASE_URL}`);
}
