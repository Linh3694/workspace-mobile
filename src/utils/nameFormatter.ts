/**
 * 🇻🇳 Name Formatter Utilities
 * Chuẩn hóa tên theo format Việt Nam: Họ + Đệm + Tên
 * 
 * Logic: Phát hiện họ VN trong tên, ưu tiên họ phổ biến nhất
 */

// Danh sách họ VN - SẮP XẾP THEO ĐỘ PHỔ BIẾN (cao nhất trước)
const VIETNAMESE_SURNAMES_PRIORITY = [
  // Tier 1: Rất phổ biến (>5% dân số)
  'nguyễn', 'nguyen', 'trần', 'tran', 'lê', 'le', 'phạm', 'pham',
  // Tier 2: Phổ biến (2-5%)
  'huỳnh', 'huynh', 'hoàng', 'hoang', 'vũ', 'vu', 'võ', 'vo',
  'phan', 'trương', 'truong', 'bùi', 'bui', 'đặng', 'dang',
  'đỗ', 'do', 'ngô', 'ngo', 'hồ', 'ho', 'dương', 'duong',
  // Tier 3: Khá phổ biến
  'đinh', 'dinh', 'lý', 'ly', 'lương', 'luong', 'đào', 'dao',
  'trịnh', 'trinh', 'tô', 'to', 'tạ', 'ta', 'chu', 'châu', 'chau',
  'quách', 'quach', 'thái', 'thai', 'lưu', 'luu',
  'phùng', 'phung', 'vương', 'vuong', 'từ', 'tu',
  'kiều', 'kieu', 'đoàn', 'doan', 'tăng', 'tang', 'mã', 'ma',
  'tống', 'tong', 'triệu', 'trieu', 'nghiêm', 'nghiem', 'thạch', 'thach',
  'doãn', 'khương', 'khuong', 'ninh',
  // Tier 4: Ít phổ biến - cũng có thể là TÊN
  'hà', 'ha', 'cao', 'la', 'mai', 'lam', 'quang'
];

/**
 * Loại bỏ dấu tiếng Việt để so sánh
 */
const removeVietnameseTones = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

/**
 * Lấy độ ưu tiên của họ (số càng nhỏ = càng phổ biến)
 * @returns -1 nếu không phải họ VN
 */
const getSurnamePriority = (word: string): number => {
  if (!word) return -1;
  const normalized = removeVietnameseTones(word.toLowerCase());
  return VIETNAMESE_SURNAMES_PRIORITY.findIndex(surname => 
    normalized === removeVietnameseTones(surname)
  );
};

/**
 * Kiểm tra xem một từ có phải là họ Việt Nam không
 */
const isVietnameseSurname = (word: string): boolean => {
  return getSurnamePriority(word) >= 0;
};

/**
 * Phát hiện format của tên và trả về vị trí họ
 * Logic: Tìm TẤT CẢ các vị trí có họ VN, chọn họ PHỔ BIẾN NHẤT
 */
const detectNameFormat = (parts: string[]): { format: 'vietnamese' | 'western' | 'middle_surname' | 'unknown', surnameIndex: number } => {
  if (parts.length < 2) return { format: 'unknown', surnameIndex: -1 };
  
  // Tìm TẤT CẢ các vị trí có họ VN
  const surnamePositions: { index: number; priority: number; word: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const priority = getSurnamePriority(parts[i]);
    if (priority >= 0) {
      surnamePositions.push({ index: i, priority, word: parts[i] });
    }
  }
  
  if (surnamePositions.length === 0) {
    return { format: 'unknown', surnameIndex: -1 };
  }
  
  // Chỉ có 1 họ → dùng họ đó
  if (surnamePositions.length === 1) {
    const pos = surnamePositions[0];
    if (pos.index === 0) {
      return { format: 'vietnamese', surnameIndex: 0 };
    } else if (pos.index === parts.length - 1) {
      return { format: 'western', surnameIndex: pos.index };
    } else {
      return { format: 'middle_surname', surnameIndex: pos.index };
    }
  }
  
  // Có NHIỀU họ → chọn họ PHỔ BIẾN NHẤT
  surnamePositions.sort((a, b) => a.priority - b.priority);
  const bestSurname = surnamePositions[0];
  
  if (bestSurname.index === 0) {
    return { format: 'vietnamese', surnameIndex: 0 };
  }
  
  if (bestSurname.index === parts.length - 1) {
    return { format: 'western', surnameIndex: bestSurname.index };
  }
  
  return { format: 'middle_surname', surnameIndex: bestSurname.index };
};

/**
 * Chuẩn hóa tên sang format Việt Nam (Họ Đệm Tên)
 * 
 * @example
 * normalizeVietnameseName('Hải Linh Nguyễn') // → 'Nguyễn Hải Linh'
 * normalizeVietnameseName('Nguyễn Hải Linh') // → 'Nguyễn Hải Linh' (giữ nguyên)
 * normalizeVietnameseName('Cao Linh Nguyễn') // → 'Nguyễn Cao Linh' (Nguyễn phổ biến hơn Cao)
 */
export const normalizeVietnameseName = (
  fullName?: string | null,
  firstName?: string | null,
  lastName?: string | null
): string => {
  if (!fullName || fullName.trim() === '') {
    return '';
  }

  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  
  if (parts.length <= 1) {
    return trimmed;
  }
  
  const { format, surnameIndex } = detectNameFormat(parts);
  
  if (format === 'western') {
    // Họ ở cuối: First Middle Last → Last Middle First
    const lastName = parts.pop()!;
    return [lastName, ...parts].join(' ');
  }
  
  if (format === 'middle_surname') {
    // Họ ở giữa: First Surname Middle → Surname Middle First
    const surname = parts[surnameIndex];
    const beforeSurname = parts.slice(0, surnameIndex);
    const afterSurname = parts.slice(surnameIndex + 1);
    return [surname, ...afterSurname, ...beforeSurname].join(' ');
  }
  
  // Format VN hoặc unknown → giữ nguyên
  return trimmed;
};

/**
 * Tên người để hiển thị: chuẩn hoá Họ Đệm Tên (VN), fallback local-part email.
 *
 * Dùng khi BE trả tên theo thứ tự AD "Tên + Họ đệm" (VD: "An Nguyễn Hà") — tên nước
 * ngoài không khớp họ VN sẽ được giữ nguyên.
 *
 * @example
 * formatPersonDisplayName('An Nguyễn Hà')                       // → 'Nguyễn Hà An'
 * formatPersonDisplayName('Amyleigh Van Rooyen')                // → 'Amyleigh Van Rooyen'
 * formatPersonDisplayName('', 'an.nguyenha@wellspring.edu.vn')  // → 'An Nguyenha'
 */
export const formatPersonDisplayName = (
  fullName?: string | null,
  email?: string | null
): string => {
  const normalized = normalizeVietnameseName(fullName);
  if (normalized) return normalized;

  const local = (email || '').trim().split('@')[0];
  if (!local) return '';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Normalize user data từ backend API
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
 * @deprecated Sử dụng normalizeVietnameseName thay thế
 */
export const parseVietnameseName = (
  fullName: string
): {
  lastName: string;
  middleName: string;
  firstName: string;
} => {
  const normalized = normalizeVietnameseName(fullName);
  const parts = normalized.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return { lastName: '', middleName: '', firstName: parts[0] };
  } else if (parts.length === 2) {
    return { lastName: parts[0], middleName: '', firstName: parts[1] };
  } else {
    // Họ ở đầu, tên ở cuối, giữa là đệm
    const lastName = parts[0];
    const firstName = parts[parts.length - 1];
    const middleName = parts.slice(1, -1).join(' ');
    return { lastName, middleName, firstName };
  }
};
