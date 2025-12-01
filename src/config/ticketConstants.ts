/**
 * Ticket Constants and Mappings
 * File tập trung tất cả constants liên quan đến Ticket
 */

/**
 * Ticket Category Mappings (EN -> VI)
 */
export const TICKET_CATEGORY_MAP: Record<string, string> = {
  Overall: 'Vấn đề chung',
  Camera: 'Hệ thống camera',
  Network: 'Hệ thống mạng',
  'Bell System': 'Hệ thống chuông báo',
  Software: 'Hệ thống phần mềm',
  Account: 'Tài khoản',
};

/**
 * Ticket Status Mappings (EN -> VI)
 */
export const TICKET_STATUS_MAP: Record<string, string> = {
  // Standard format
  Assigned: 'Đã tiếp nhận',
  Processing: 'Đang xử lý',
  'Waiting for Customer': 'Chờ khách hàng',
  Done: 'Đã xử lý',
  Closed: 'Đã đóng',
  Cancelled: 'Đã hủy',
  // Lowercase variants (in case API returns lowercase)
  assigned: 'Đã tiếp nhận',
  processing: 'Đang xử lý',
  'waiting for customer': 'Chờ khách hàng',
  done: 'Đã xử lý',
  closed: 'Đã đóng',
  cancelled: 'Đã hủy',
  // Alternative formats
  'Waiting for customer': 'Chờ khách hàng',
  'waiting for Customer': 'Chờ khách hàng',
};

/**
 * Ticket status values
 */
export const TICKET_STATUSES = {
  ASSIGNED: 'Assigned',
  PROCESSING: 'Processing',
  WAITING_FOR_CUSTOMER: 'Waiting for Customer',
  DONE: 'Done',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

/**
 * Get Vietnamese label for category
 */
export const getCategoryLabel = (categoryValue: string): string => {
  return TICKET_CATEGORY_MAP[categoryValue] || categoryValue;
};

/**
 * Get category value from Vietnamese label
 */
export const getCategoryValueByLabel = (label: string): string | undefined => {
  return Object.entries(TICKET_CATEGORY_MAP).find(([, v]) => v === label)?.[0];
};

/**
 * Get all categories with Vietnamese labels
 */
export const getAllCategoryMappings = (): { value: string; label: string }[] => {
  return Object.entries(TICKET_CATEGORY_MAP).map(([value, label]) => ({
    value,
    label,
  }));
};

/**
 * Get Vietnamese label for status
 */
export const getStatusLabel = (statusValue: string): string => {
  // Try exact match first
  if (TICKET_STATUS_MAP[statusValue]) {
    return TICKET_STATUS_MAP[statusValue];
  }

  // Try normalized lowercase match
  const normalizedStatus = statusValue.toLowerCase().trim();
  if (TICKET_STATUS_MAP[normalizedStatus]) {
    return TICKET_STATUS_MAP[normalizedStatus];
  }

  // Try some common variations
  if (normalizedStatus === 'in progress') {
    return TICKET_STATUS_MAP['processing'];
  }
  if (normalizedStatus === 'resolved') {
    return TICKET_STATUS_MAP['done'];
  }

  console.log('Unknown status for label:', statusValue, 'normalized:', normalizedStatus);
  return statusValue;
};

/**
 * Get status value from Vietnamese label
 */
export const getStatusValueByLabel = (label: string): string | undefined => {
  return Object.entries(TICKET_STATUS_MAP).find(([, v]) => v === label)?.[0];
};

/**
 * Get all statuses with Vietnamese labels
 */
export const getAllStatusMappings = (): { value: string; label: string }[] => {
  return Object.entries(TICKET_STATUS_MAP).map(([value, label]) => ({
    value,
    label,
  }));
};

/**
 * Get status color for UI display
 */
export const getStatusColor = (status: string): string => {
  const normalizedStatus = status.toLowerCase().trim();

  switch (normalizedStatus) {
    case 'assigned':
      return 'bg-[#002855]';
    case 'processing':
    case 'in progress':
      return 'bg-[#F59E0B]';
    case 'waiting for customer':
      return 'bg-[#6B7280]';
    case 'done':
    case 'resolved':
      return 'bg-[#BED232]';
    case 'closed':
      return 'bg-[#009483]';
    case 'cancelled':
      return 'bg-[#F05023]';
    default:
      console.log('Unknown status for color:', status, 'normalized:', normalizedStatus);
      return 'bg-gray-500';
  }
};

/**
 * Maximum images allowed for upload
 */
export const MAX_IMAGES_UPLOAD = 5;

/**
 * Maximum image size in MB
 */
export const MAX_IMAGE_SIZE_MB = 10;
