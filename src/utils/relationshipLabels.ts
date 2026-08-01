/**
 * Nhãn quan hệ gia đình cho snapshot chat (PH ↔ HS).
 *
 * Bản rút gọn của `frappe-sis-frontend` → `familyRelationshipUtils.ts`: snapshot lưu mã EN
 * lowercase ('mother'), in thẳng sẽ ra "mother" ở cả hai ngôn ngữ nên phải dịch qua đây.
 * Dữ liệu cũ ('Mother', 'Mẹ', 'mom'…) được gom về mã chuẩn để hiển thị đúng kể cả khi
 * backend chưa migrate. Giá trị ngoài danh mục giữ nguyên văn, không nuốt mất dữ liệu.
 */

/** Nhãn tiếng Việt — cũng là fallback khi thiếu key i18n. */
const LABELS_VI: Record<string, string> = {
  father: 'Bố',
  mother: 'Mẹ',
  grandfather: 'Ông',
  grandmother: 'Bà',
  uncle: 'Chú/Bác',
  aunt: 'Cô/Dì',
  brother: 'Anh/Em trai',
  sister: 'Chị/Em gái',
  guardian: 'Người giám hộ',
  foster_parent: 'Bố/Mẹ nuôi',
  relative: 'Người thân',
  other: 'Khác',
  // legacy — chỉ đọc, không suy đoán giới tính
  grandparent: 'Ông/Bà',
  sibling: 'Anh/Chị/Em',
  uncle_aunt: 'Cô/Chú/Bác/Dì',
};

/** Alias -> mã chuẩn. Key đã bỏ dấu + lowercase, xem {@link normalizeForLookup}. */
const ALIASES: Record<string, string> = {
  father: 'father',
  dad: 'father',
  bo: 'father',
  cha: 'father',
  'bo ruot': 'father',
  'bo de': 'father',
  mother: 'mother',
  mom: 'mother',
  mum: 'mother',
  me: 'mother',
  'me ruot': 'mother',
  'me de': 'mother',
  grandfather: 'grandfather',
  grandpa: 'grandfather',
  ong: 'grandfather',
  'ong noi': 'grandfather',
  'ong ngoai': 'grandfather',
  grandmother: 'grandmother',
  grandma: 'grandmother',
  // 'Bà' và 'Ba' (bố, miền Nam) trùng key sau khi bỏ dấu — chọn grandmother cho khớp web.
  ba: 'grandmother',
  'ba noi': 'grandmother',
  'ba ngoai': 'grandmother',
  uncle: 'uncle',
  chu: 'uncle',
  bac: 'uncle',
  cau: 'uncle',
  duong: 'uncle',
  'chu/bac': 'uncle',
  aunt: 'aunt',
  co: 'aunt',
  di: 'aunt',
  thim: 'aunt',
  mo: 'aunt',
  'co/di': 'aunt',
  brother: 'brother',
  anh: 'brother',
  'anh trai': 'brother',
  'em trai': 'brother',
  'anh/em trai': 'brother',
  sister: 'sister',
  chi: 'sister',
  'chi gai': 'sister',
  'em gai': 'sister',
  'chi/em gai': 'sister',
  guardian: 'guardian',
  'nguoi giam ho': 'guardian',
  'giam ho': 'guardian',
  'legal guardian': 'guardian',
  foster_parent: 'foster_parent',
  'foster parent': 'foster_parent',
  foster: 'foster_parent',
  nuoi: 'foster_parent',
  'cha nuoi': 'foster_parent',
  'bo nuoi': 'foster_parent',
  'me nuoi': 'foster_parent',
  'bo/me nuoi': 'foster_parent',
  relative: 'relative',
  'nguoi than': 'relative',
  'ho hang': 'relative',
  other: 'other',
  others: 'other',
  khac: 'other',
  // legacy
  grandparent: 'grandparent',
  grandparents: 'grandparent',
  'ong/ba': 'grandparent',
  'ong ba': 'grandparent',
  sibling: 'sibling',
  siblings: 'sibling',
  em: 'sibling',
  'anh/chi/em': 'sibling',
  'anh chi em': 'sibling',
  uncle_aunt: 'uncle_aunt',
  'uncle/aunt': 'uncle_aunt',
  'co/chu/bac/di': 'uncle_aunt',
};

function normalizeForLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .join(' ');
}

/**
 * Chuẩn hoá giá trị quan hệ tự do về mã chuẩn.
 * Không nhận diện được → trả giá trị gốc đã trim (không ép về 'other').
 */
export function normalizeRelationshipType(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  return ALIASES[normalizeForLookup(value)] ?? value;
}

/** Hàm dịch của i18next — nhận key + giá trị mặc định. */
type Translate = (key: string, defaultValue?: string) => string;

/**
 * Bọc `t` của react-i18next thành hàm 1 tham số để truyền xuống các hàm dựng model
 * (`buildConversationMembers`) — nơi không gọi hook được.
 */
/* Tham số `any`: TFunction của i18next có nhiều overload, kiểu hẹp hơn sẽ không nhận. */
export function makeRelationshipTranslator(
  t: (key: any, defaultValue?: any) => unknown
): (raw: string) => string {
  return (raw: string) =>
    translateRelationshipType(raw, (key, defaultValue) => String(t(key, defaultValue ?? '')));
}

/**
 * Nhãn hiển thị của một giá trị quan hệ (nhận cả mã chuẩn lẫn dữ liệu cũ).
 * Giá trị ngoài danh mục → hiển thị nguyên văn.
 */
export function translateRelationshipType(raw: string | null | undefined, t: Translate): string {
  const code = normalizeRelationshipType(raw);
  if (!code) return '';
  const fallback = LABELS_VI[code];
  if (!fallback) return code;
  return t(`family_relationship.${code}`, fallback);
}
