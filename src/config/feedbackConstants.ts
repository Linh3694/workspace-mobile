/**
 * Feedback Constants and Mappings
 * File tập trung tất cả constants liên quan đến Feedback
 * Đồng bộ style với Ticket
 */

/**
 * Feedback Status Mappings
 */
export const FEEDBACK_STATUS_MAP: Record<string, string> = {
  Mới: 'Mới',
  'Đang xử lý': 'Đang xử lý',
  'Chờ phản hồi phụ huynh': 'Chờ phản hồi',
  'Đã phản hồi': 'Đã phản hồi',
  Đóng: 'Đã đóng',
  'Tự động đóng': 'Tự động đóng',
  'Hoàn thành': 'Hoàn thành',
};

/**
 * Feedback status values
 */
export const FEEDBACK_STATUSES = {
  NEW: 'Mới',
  PROCESSING: 'Đang xử lý',
  WAITING_FOR_PARENT: 'Chờ phản hồi phụ huynh',
  REPLIED: 'Đã phản hồi',
  CLOSED: 'Đóng',
  AUTO_CLOSED: 'Tự động đóng',
  COMPLETED: 'Hoàn thành',
};

/**
 * Feedback Type
 */
export const FEEDBACK_TYPES = {
  SUGGESTION: 'Góp ý',
  RATING: 'Đánh giá',
};

/**
 * Get status label for display
 */
export const getStatusLabel = (status: string): string => {
  return FEEDBACK_STATUS_MAP[status] || status;
};

/**
 * Get status color for UI display - Đồng bộ với Ticket (solid background, white text)
 *
 * Mapping với Ticket:
 * - Mới = Assigned (blue)
 * - Đang xử lý = Processing (yellow/amber)
 * - Chờ phản hồi phụ huynh = Waiting for Customer (gray)
 * - Đã phản hồi = Done (light green) - chờ PH confirm hoặc đóng
 * - Đóng = Closed (teal)
 * - Hoàn thành = Closed (teal)
 * - Tự động đóng = Cancelled (gray)
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Mới':
      return 'bg-[#002855]'; // Dark blue - giống Assigned của Ticket
    case 'Đang xử lý':
      return 'bg-[#F59E0B]'; // Yellow/Amber - giống Processing của Ticket
    case 'Chờ phản hồi phụ huynh':
      return 'bg-[#6B7280]'; // Gray - giống Waiting for Customer của Ticket
    case 'Đã phản hồi':
      return 'bg-[#BED232]'; // Light green - giống Done của Ticket
    case 'Đóng':
    case 'Hoàn thành':
      return 'bg-[#009483]'; // Teal - giống Closed của Ticket
    case 'Tự động đóng':
      return 'bg-[#9CA3AF]'; // Light gray
    default:
      return 'bg-[#6B7280]'; // Default gray
  }
};

/**
 * Get status text color (for cases where we need colored text instead of white)
 * Used in semi-transparent badge style
 */
export const getStatusTextColor = (status: string): string => {
  switch (status) {
    case 'Mới':
      return 'text-[#002855]';
    case 'Đang xử lý':
      return 'text-[#F59E0B]';
    case 'Chờ phản hồi phụ huynh':
      return 'text-[#6B7280]';
    case 'Đã phản hồi':
      return 'text-[#84A12B]'; // Darker green for readability
    case 'Đóng':
    case 'Hoàn thành':
      return 'text-[#009483]';
    case 'Tự động đóng':
      return 'text-[#9CA3AF]';
    default:
      return 'text-[#6B7280]';
  }
};

/**
 * Priority colors
 */
export const getPriorityColor = (priority?: string): string => {
  switch (priority) {
    case 'Khẩn cấp':
      return 'bg-[#F05023]'; // Red
    case 'Cao':
      return 'bg-[#F59E0B]'; // Orange/Amber
    case 'Trung bình':
      return 'bg-[#EAB308]'; // Yellow
    case 'Thấp':
      return 'bg-[#22C55E]'; // Green
    default:
      return 'bg-[#6B7280]'; // Gray
  }
};

/**
 * SLA Status colors
 */
export const getSLAColor = (
  slaStatus?: string
): { bg: string; text: string; label: string } | null => {
  switch (slaStatus) {
    case 'Overdue':
      return { bg: 'bg-red-500', text: 'text-white', label: 'Quá hạn' };
    case 'Warning':
      return { bg: 'bg-yellow-500', text: 'text-white', label: 'Sắp hết hạn' };
    case 'On time':
      return { bg: 'bg-green-500', text: 'text-white', label: 'Đúng hạn' };
    default:
      return null;
  }
};

/**
 * Filter options for feedback list
 */
export const FEEDBACK_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'Mới', label: 'Mới' },
  { value: 'Đang xử lý', label: 'Đang xử lý' },
  { value: 'Chờ phản hồi phụ huynh', label: 'Chờ PH phản hồi' },
  { value: 'Đã phản hồi', label: 'Đã phản hồi' },
  { value: 'Đóng', label: 'Đã đóng' },
  { value: 'Hoàn thành', label: 'Hoàn thành' },
];
