/**
 * Nguồn sự thật DUY NHẤT về campus đang chọn — dùng được cả trong React (qua CampusContext)
 * lẫn ngoài React (axios interceptor, fetch helper, service class).
 *
 * LÝ DO PHẢI CÓ FILE NÀY:
 * Trước đây màn Hồ sơ chỉ ghi `currentCampusId` vào AsyncStorage rồi thôi. Không có ai
 * lắng nghe, chỉ 3 màn Kỷ luật + chatService tự đọc lại storage; ~30 service còn lại không
 * gửi campus nên backend rơi về campus "ưa thích" (SIS User Campus Preference) do WEB đặt
 * lần cuối, hoặc campus role đầu tiên. Đổi campus trên mobile vì thế gần như vô hiệu.
 *
 * Cách chữa: giữ campus trong bộ nhớ (đọc ĐỒNG BỘ được trong interceptor), đồng bộ xuống
 * AsyncStorage để tương thích các chỗ cũ, và phát tín hiệu cho ai cần biết khi campus đổi.
 * Mọi request tới backend của mình đều được gắn `X-Campus-Id` (+ `campus_id`) ở một chỗ,
 * thay vì từng service tự nhớ — giống interceptor của frontend-admin-web.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, BASE_URL } from '../config/constants';
import { normalizeCampusIdForBackend } from './campusIdUtils';

/** Khoá storage cũ — GIỮ NGUYÊN tên để các màn chưa chuyển sang context vẫn đọc được. */
export const CAMPUS_ID_STORAGE_KEY = 'currentCampusId';
/** Tiêu đề campus (hiển thị) — attendanceService cũ còn đọc khoá này. */
export const CAMPUS_TITLE_STORAGE_KEY = 'selectedCampus';

export type CampusRow = {
  name: string;
  title_vn?: string;
  title_en?: string;
  short_title?: string;
};

type CampusListener = (campusId: string | null) => void;

let currentCampusId: string | null = null;
let hydrated = false;
const listeners = new Set<CampusListener>();

/** Campus đang chọn theo định dạng backend (CAMPUS-00001). Đọc đồng bộ, không chờ storage. */
export const getCurrentCampusIdSync = (): string | null => currentCampusId;

/** Tên hiển thị của campus (title) — chỉ để tương thích khoá `selectedCampus` cũ. */
export const campusDisplayTitle = (row: CampusRow | null | undefined): string =>
  (row && (row.title_vn || row.title_en || row.short_title || row.name)) || '';

/**
 * Nạp campus từ AsyncStorage vào bộ nhớ (gọi lúc khởi động / đăng nhập).
 * Idempotent: gọi nhiều lần vô hại; lần sau chỉ đọc lại nếu chưa có giá trị trong bộ nhớ.
 */
export const hydrateCampusStore = async (): Promise<string | null> => {
  if (hydrated && currentCampusId) return currentCampusId;
  try {
    const raw = await AsyncStorage.getItem(CAMPUS_ID_STORAGE_KEY);
    const normalized = raw ? normalizeCampusIdForBackend(raw) : '';
    currentCampusId = normalized || null;
  } catch {
    currentCampusId = null;
  }
  hydrated = true;
  return currentCampusId;
};

/**
 * Đặt campus đang chọn: cập nhật bộ nhớ, ghi storage, báo cho listener.
 * `title` chỉ để ghi khoá `selectedCampus` cũ; bỏ trống thì ghi lại chính id.
 */
export const setCurrentCampusId = async (
  campusId: string | null,
  title?: string
): Promise<void> => {
  const normalized = campusId ? normalizeCampusIdForBackend(campusId) : '';
  const next = normalized || null;
  const changed = next !== currentCampusId;
  currentCampusId = next;
  hydrated = true;
  try {
    if (next) {
      await AsyncStorage.setItem(CAMPUS_ID_STORAGE_KEY, next);
      await AsyncStorage.setItem(CAMPUS_TITLE_STORAGE_KEY, title || next);
    } else {
      await AsyncStorage.removeItem(CAMPUS_ID_STORAGE_KEY);
      await AsyncStorage.removeItem(CAMPUS_TITLE_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[campusStore] không ghi được campus vào storage:', e);
  }
  if (changed) {
    listeners.forEach((fn) => {
      try {
        fn(next);
      } catch (e) {
        console.warn('[campusStore] listener lỗi:', e);
      }
    });
  }
};

/** Dọn khi đăng xuất — người dùng khác đăng nhập cùng máy không được kế thừa campus cũ. */
export const clearCampusStore = async (): Promise<void> => {
  await setCurrentCampusId(null);
  hydrated = false;
};

/** Đăng ký nhận tin campus đổi; trả về hàm huỷ đăng ký. */
export const subscribeCampusChange = (fn: CampusListener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// ---------------------------------------------------------------------------
// Gắn campus vào request — dùng chung cho axios (global + instance) và fetch.
// ---------------------------------------------------------------------------

/**
 * Endpoint KHÔNG gắn campus. Bám sát `campusApiInterceptor.ts` của frontend-admin-web,
 * thêm nhóm auth của mobile (get_current_user, đăng nhập Microsoft).
 */
export const NO_CAMPUS_PATTERNS: RegExp[] = [
  /\/method\/login/,
  /\/method\/logout/,
  /\/method\/frappe\.auth\./,
  /\/method\/erp\.public\./,
  /\/method\/erp\.api\.erp_sis\.app_version/,
  /\/method\/erp\.api\.erp_sis\.campus\./,
  // Ngân sách dùng chung toàn trường — không lọc phòng ban theo campus
  /\/method\/erp\.api\.erp_sis\.budget\./,
  // IT Microsoft admin sync — không lọc campus
  /\/method\/erp\.api\.erp_common_user\.microsoft_auth\./,
  // Đăng nhập / lấy hồ sơ người dùng — chạy trước khi biết campus
  /\/method\/erp\.api\.erp_common_user\.auth\./,
  // Cấu hình hệ thống là Single DocType, không thuộc campus nào
  /\/method\/erp\.api\.erp_common_system\.config\./,
];

/** Ngoài danh sách trên, còn không chèn `campus_id` vào body/params của các URL này. */
export const NO_BODY_INJECT_PATTERNS: RegExp[] = [
  ...NO_CAMPUS_PATTERNS,
  /\/api\/method\/upload_file/,
];

export const shouldSkipCampusHeader = (url: string): boolean =>
  NO_CAMPUS_PATTERNS.some((re) => re.test(url));

export const shouldSkipCampusBodyInject = (url: string): boolean =>
  NO_BODY_INJECT_PATTERNS.some((re) => re.test(url));

/**
 * Chỉ gắn campus cho backend CỦA MÌNH. URL tuyệt đối tới host khác (CDN ký sẵn, Microsoft
 * Graph, AI backend…) tuyệt đối không đụng — thêm header lạ vào URL ký sẵn là hỏng chữ ký.
 */
export const isOwnBackendUrl = (fullUrl: string): boolean => {
  if (!fullUrl) return false;
  if (fullUrl.startsWith('/')) return true; // đường dẫn tương đối → baseURL của mình
  return fullUrl.startsWith(API_BASE_URL) || fullUrl.startsWith(BASE_URL);
};

/** Chỉ Frappe RPC (`/api/method/`) mới hiểu tham số `campus_id`; REST/resource khác thì không chèn. */
const isFrappeMethodUrl = (fullUrl: string): boolean => fullUrl.includes('/api/method/');

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

/** Header cho các service dùng `fetch` thô. Trả về `{}` khi chưa có campus / URL không thuộc backend mình. */
export const campusHeaders = (url?: string): Record<string, string> => {
  const id = currentCampusId;
  if (!id) return {};
  if (url && (!isOwnBackendUrl(url) || shouldSkipCampusHeader(url))) return {};
  return { 'X-Campus-Id': id };
};

/**
 * Gắn campus vào một axios config (dùng trong request interceptor).
 * - Header `X-Campus-Id` cho mọi request tới backend mình (trừ whitelist).
 * - `campus_id` vào params + body (chỉ Frappe RPC, chỉ khi caller chưa tự đặt) —
 *   backend đọc form_dict/args/body TRƯỚC header, và một số API đọc thẳng `campus_id`.
 *   Frappe lọc kwargs theo chữ ký hàm nên tham số thừa không gây lỗi; web đã chạy y hệt.
 */
export const applyCampusToAxiosConfig = <
  T extends {
    url?: string;
    baseURL?: string;
    headers?: any;
    params?: any;
    data?: any;
    skipCampus?: boolean;
  },
>(
  config: T
): T => {
  try {
    if (config.skipCampus) return config;
    const id = currentCampusId;
    if (!id) return config;
    const url = config.url || '';
    const fullUrl = /^https?:\/\//i.test(url) ? url : `${config.baseURL || ''}${url}`;
    if (!isOwnBackendUrl(fullUrl) || shouldSkipCampusHeader(fullUrl)) return config;

    if (!config.headers) config.headers = {};
    if (typeof config.headers.set === 'function') {
      config.headers.set('X-Campus-Id', id);
    } else {
      config.headers['X-Campus-Id'] = id;
    }

    if (isFrappeMethodUrl(fullUrl) && !shouldSkipCampusBodyInject(fullUrl)) {
      const params = isPlainObject(config.params) ? config.params : {};
      if (params.campus_id === undefined) {
        config.params = { campus_id: id, ...params };
      }
      if (isPlainObject(config.data) && config.data.campus_id === undefined) {
        config.data = { campus_id: id, ...config.data };
      }
    }
  } catch (e) {
    console.warn('[campusStore] applyCampusToAxiosConfig lỗi:', e);
  }
  return config;
};
