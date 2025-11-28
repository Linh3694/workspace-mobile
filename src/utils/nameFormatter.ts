/**
 * Name Formatter Utilities
 * Xử lý format tên người Việt Nam: Họ + Tên đệm + Tên
 */

/**
 * Đảo ngược tên từ format "First Last" sang "Last First" (Vietnamese format)
 * @param fullName - Tên đầy đủ từ backend
 * @param firstName - Tên (given name)
 * @param lastName - Họ (surname)
 * @returns Tên đã được format đúng theo kiểu Việt Nam
 *
 * @example
 * normalizeVietnameseName("Linh Nguyễn Hải", "Linh", "Nguyễn Hải")
 * // Returns: "Nguyễn Hải Linh"
 *
 * @example
 * normalizeVietnameseName("Linh Nguyễn Hải")
 * // Returns: "Nguyễn Hải Linh" (tự động parse và format)
 */
export const normalizeVietnameseName = (
  fullName?: string | null,
  firstName?: string | null,
  lastName?: string | null
): string => {
  // Nếu không có fullName, trả về empty string
  if (!fullName || fullName.trim() === '') {
    return '';
  }

  const trimmedFullName = fullName.trim();

  // Nếu có đủ thông tin firstName và lastName, sử dụng logic cũ
  if (firstName && lastName) {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    // Kiểm tra xem fullName có đang ở format sai (First + Last) không
    // Nếu fullName bắt đầu bằng firstName, có nghĩa là sai format
    if (trimmedFullName.startsWith(trimmedFirstName)) {
      // Đảo lại thành: Last + First
      return `${trimmedLastName} ${trimmedFirstName}`.trim();
    }

    // Nếu đã đúng format (Last + First), giữ nguyên
    return trimmedFullName;
  }

  // Nếu chỉ có fullName, tự động parse và format theo logic Việt Nam
  const parsed = parseVietnameseName(trimmedFullName);
  return buildVietnameseName(parsed.lastName, parsed.middleName, parsed.firstName);
};

/**
 * Normalize user data từ backend API
 * @param userData - User data object từ backend
 * @returns User data với fullname đã được normalize
 */
export const normalizeUserData = (userData: any): any => {
  if (!userData) return userData;

  const fullName = userData.full_name || userData.fullname || userData.fullName;
  const firstName = userData.first_name || userData.firstName;
  const lastName = userData.last_name || userData.lastName;

  return {
    ...userData,
    fullname: normalizeVietnameseName(fullName, firstName, lastName),
    full_name: normalizeVietnameseName(fullName, firstName, lastName),
  };
};

/**
 * Build tên từ các phần riêng lẻ theo format Việt Nam
 * @param lastName - Họ
 * @param middleName - Tên đệm (optional)
 * @param firstName - Tên
 * @returns Tên đầy đủ theo format Việt Nam
 *
 * @example
 * buildVietnameseName("Nguyễn", "Hải", "Linh")
 * // Returns: "Nguyễn Hải Linh"
 */
export const buildVietnameseName = (
  lastName?: string | null,
  middleName?: string | null,
  firstName?: string | null
): string => {
  return [lastName, middleName, firstName]
    .filter(Boolean)
    .map((part) => part?.trim())
    .filter((part) => part)
    .join(' ');
};

/**
 * Parse tên thành các phần (best effort)
 * Giả định backend trả về format "Tên Họ Tên đệm", chuyển thành "Họ Tên đệm Tên"
 * @param fullName - Tên đầy đủ
 * @returns Object chứa lastName, middleName, firstName
 */
export const parseVietnameseName = (
  fullName: string
): {
  lastName: string;
  middleName: string;
  firstName: string;
} => {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return { lastName: '', middleName: '', firstName: parts[0] };
  } else if (parts.length === 2) {
    // "Tên Họ" -> "Họ Tên"
    return { lastName: parts[1], middleName: '', firstName: parts[0] };
  } else if (parts.length === 3) {
    // "Tên Họ Tên đệm" -> "Họ Tên đệm Tên"
    return { lastName: parts[1], middleName: parts[2], firstName: parts[0] };
  } else {
    // 4 parts hoặc hơn: giả định "Tên Họ Tên đệm ..." -> "Họ Tên đệm ... Tên"
    const firstName = parts[0];
    const lastName = parts[1];
    const middleName = parts.slice(2).join(' ');
    return { lastName, middleName, firstName };
  }
};
