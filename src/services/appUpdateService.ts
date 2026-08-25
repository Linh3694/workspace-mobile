/**
 * Kiểm tra phiên bản mới đã phát hành trên App Store / Google Play.
 *
 * Hai lớp dữ liệu, tách bạch nhau:
 *
 * A) CHÍNH SÁCH (remote config JSON) — quyết định "có nhắc không, có ép không".
 *    Đọc từ máy chủ MỖI LẦN kiểm tra nên đổi lúc nào áp lúc đó, KHÔNG cần build lại
 *    app. Xem `getRemoteConfigUrls()`.
 *
 * B) PHIÊN BẢN MỚI NHẤT — nếu chính sách không ghi `latestVersion` thì hỏi lần lượt:
 *    1) Backend Frappe `erp.api.erp_sis.app_version.get_latest_version` — nguồn chuẩn
 *       cho app này vì bản iOS là Unlisted, iTunes Lookup có thể không thấy.
 *    2) iTunes Lookup API (iOS) — Apple cung cấp chính thức.
 *    3) HTML trang Google Play (Android) — Google không có API công khai nên phải dò
 *       chuỗi; Google đổi layout thì trả null và app im lặng bỏ qua (không popup sai).
 *
 * Nhờ tách hai lớp, phát hành bản mới KHÔNG cần sửa chính sách, còn đổi mức độ ép
 * buộc thì KHÔNG cần phát hành bản mới.
 */
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { API_BASE_URL } from '../config/constants';

/** Ngôn ngữ app đang dùng — khớp với i18n (src/config/i18n.ts). */
export type AppLanguage = 'vi' | 'en';

/** Phiên bản đang cài — ưu tiên app.json, fallback sang native version. */
export const APP_VERSION: string =
  Constants.expoConfig?.version || Application.nativeApplicationVersion || '0.0.0';

/** Build number (iOS CFBundleVersion / Android versionCode). */
export const APP_BUILD_NUMBER: string = (() => {
  const native = Application.nativeBuildVersion;
  if (native) return String(native);
  const ios = Constants.expoConfig?.ios?.buildNumber;
  if (ios != null && String(ios).length > 0) return String(ios);
  const android = Constants.expoConfig?.android?.versionCode;
  if (android != null) return String(android);
  return '1';
})();

/** Nhãn đầy đủ cho màn hình Cài đặt — ví dụ v1.0.3 (4). */
export function getAppVersionFullLabel(): string {
  return `v${APP_VERSION} (${APP_BUILD_NUMBER})`;
}

/** Thông tin phiên bản lấy được từ một nguồn (store hoặc remote config). */
export interface StoreVersionInfo {
  latestVersion: string;
  /** Link mở cửa hàng — https (mở được cả trên web lẫn app store). */
  storeUrl: string;
  /** Link scheme gốc (itms-apps:// hoặc market://) — mở thẳng app cửa hàng nếu có. */
  storeDeepLink?: string;
  releaseNotes?: string;
  /** Dưới phiên bản này thì bắt buộc cập nhật (popup không cho bỏ qua). */
  minimumVersion?: string;
  /**
   * Remote config nói rõ ép hay không ép MỌI bản mới.
   * `undefined` → chưa có ý kiến, dùng mặc định build-time (`isForcedUpdateEnabled`).
   */
  force?: boolean;
}

/** Kết quả so sánh phiên bản hiện tại với store. */
export interface AppUpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  storeUrl: string | null;
  storeDeepLink?: string;
  releaseNotes?: string;
  /** Store có bản mới hơn bản đang cài. */
  updateAvailable: boolean;
  /** Bản đang cài thấp hơn minimumVersion — không cho bỏ qua popup. */
  mandatory: boolean;
}

const REQUEST_TIMEOUT_MS = 8000;

/** Storefront tra cứu App Store — app phát hành cho thị trường Việt Nam. */
const ITUNES_COUNTRY = 'vn';

/** App Store id của Wis (staff) — dùng khi iTunes lookup lỗi. */
const IOS_FALLBACK_STORE_URL = 'https://apps.apple.com/app/id6746143732';

/**
 * Trình duyệt giả lập — Google Play trả HTML rút gọn (không có version) cho user-agent lạ.
 */
const PLAY_STORE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** `app_id` của app này trong bảng `APP_VERSIONS` phía backend. */
const BACKEND_APP_ID = 'wis_staff';

/**
 * MẶC ĐỊNH lúc build khi remote config chưa nói gì: CHỈ NHẮC — popup vẫn có nút
 * "Để sau" (chốt 17/08/2026). Đặt EXPO_PUBLIC_APP_UPDATE_FORCE=true để build ra bản
 * mặc định ép buộc.
 *
 * Mặc định hiền vì đây là đường dự phòng: nó chỉ được dùng khi máy chủ không trả
 * được chính sách (mất mạng, chưa dựng file). Lúc đó ép cả trường vào màn hình không
 * đóng được là rủi ro lớn hơn nhiều so với việc nhắc hụt một bản.
 *
 * Chỉ là mặc định: remote config (`force: true|false`) ghi đè giá trị này lúc chạy,
 * nên KHÔNG cần build lại app để đổi mức độ ép buộc.
 */
export function isForcedUpdateEnabled(): boolean {
  return (
    String(process.env.EXPO_PUBLIC_APP_UPDATE_FORCE ?? '')
      .toLowerCase()
      .trim() === 'true'
  );
}

/** Bật kiểm tra khi chạy dev/Expo Go (mặc định tắt để không làm phiền lúc phát triển). */
export function isUpdateCheckEnabled(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  if (
    String(process.env.EXPO_PUBLIC_APP_UPDATE_CHECK || '')
      .toLowerCase()
      .trim() === 'false'
  ) {
    return false;
  }
  if (__DEV__) {
    return (
      String(process.env.EXPO_PUBLIC_APP_UPDATE_CHECK_IN_DEV || '')
        .toLowerCase()
        .trim() === 'true'
    );
  }
  return true;
}

/** Bundle id iOS / package name Android — đọc từ app.json đã nhúng vào binary. */
export function getAppIdentifier(): string | null {
  if (Platform.OS === 'ios') {
    return Constants.expoConfig?.ios?.bundleIdentifier ?? null;
  }
  if (Platform.OS === 'android') {
    return Constants.expoConfig?.android?.package ?? null;
  }
  return null;
}

/** Link cửa hàng mặc định khi không lấy được link từ API (Android luôn dùng link này). */
export function getFallbackStoreUrl(): string | null {
  if (Platform.OS === 'ios') return IOS_FALLBACK_STORE_URL;
  const appId = getAppIdentifier();
  if (!appId) return null;
  return `https://play.google.com/store/apps/details?id=${appId}`;
}

/**
 * So sánh 2 chuỗi phiên bản dạng "1.5.37".
 * @returns 1 nếu a > b, -1 nếu a < b, 0 nếu bằng.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** candidate mới hơn base? */
export function isVersionNewer(candidate: string, base: string): boolean {
  return compareVersions(candidate, base) > 0;
}

/**
 * Lấy dãy số đầu tiên dạng x.y.z trong chuỗi.
 * "1.5.37-beta" → [1,5,37]; "Varies with device" → [0] (không bao giờ được coi là mới hơn).
 */
function parseVersion(value: string): number[] {
  const matched = String(value ?? '')
    .trim()
    .match(/\d+(?:\.\d+)*/);
  if (!matched) return [0];
  return matched[0].split('.').map((part) => Number.parseInt(part, 10) || 0);
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Lớp A — chính sách đọc từ remote config                             */
/* ------------------------------------------------------------------ */

interface RemoteUpdateEntry {
  /** Ghi đè phiên bản mới nhất — bỏ trống thì hỏi backend/store (khuyên bỏ trống). */
  latestVersion?: string;
  /** Alias của latestVersion */
  version?: string;
  minimumVersion?: string;
  /** Alias của minimumVersion */
  minVersion?: string;
  storeUrl?: string;
  storeDeepLink?: string;
  releaseNotes?: string | { vi?: string; en?: string };
  /** false → tắt hẳn popup từ xa, kể cả khi store đã có bản mới. */
  enabled?: boolean;
  /** true → ép mọi bản mới; false → chỉ nhắc. Bỏ trống = theo mặc định build-time. */
  force?: boolean;
  /** Alias của force */
  forceUpdate?: boolean;
}

type RemoteUpdateConfig = RemoteUpdateEntry & {
  ios?: RemoteUpdateEntry;
  android?: RemoteUpdateEntry;
};

/** Chính sách đã gộp phần chung với phần riêng của nền tảng đang chạy. */
interface RemoteUpdatePolicy {
  enabled: boolean;
  latestVersion?: string;
  minimumVersion?: string;
  storeUrl?: string;
  storeDeepLink?: string;
  releaseNotes?: string;
  force?: boolean;
}

/**
 * Các URL chứa chính sách, thử lần lượt tới khi đọc được JSON hợp lệ.
 *
 * Không set EXPO_PUBLIC_APP_UPDATE_CONFIG_URL thì app tự dựng URL từ base API đã
 * nhúng sẵn trong binary — nhờ vậy MỌI bản build đều tự nghe máy chủ, không phải nhớ
 * thêm biến môi trường lúc build (đúng chỗ đã làm cơ chế này chết cứng trước đây).
 *
 * Tên file khác app phụ huynh (`app-update.json`) vì hai app dùng chung một host
 * nhưng phiên bản hoàn toàn khác nhau — dùng chung file là ép nhầm nhau.
 */
export function getRemoteConfigUrls(): string[] {
  const explicit = process.env.EXPO_PUBLIC_APP_UPDATE_CONFIG_URL?.trim();
  if (explicit) return [explicit];

  return [`${API_BASE_URL}/files/app-update-wis.json`];
}

function pickReleaseNotes(
  notes: RemoteUpdateEntry['releaseNotes'],
  language: AppLanguage
): string | undefined {
  if (!notes) return undefined;
  if (typeof notes === 'string') return notes.trim() || undefined;
  return (notes[language] ?? notes.vi ?? notes.en)?.trim() || undefined;
}

/** Bóc vỏ `{ message: ... }` của whitelisted method Frappe; JSON tĩnh thì giữ nguyên. */
function unwrapFrappeMessage(payload: unknown): unknown {
  return payload && typeof payload === 'object' && 'message' in payload
    ? (payload as { message?: unknown }).message
    : payload;
}

async function fetchJsonNoCache(url: string): Promise<unknown | null> {
  // `t` phá cache CDN/proxy — đổi chính sách phải ăn ngay chứ không chờ hết TTL.
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetchWithTimeout(`${url}${separator}t=${Date.now()}`, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) return null;
  return unwrapFrappeMessage(await response.json());
}

function normalizePolicy(raw: RemoteUpdateConfig, language: AppLanguage): RemoteUpdatePolicy {
  // Khối riêng của nền tảng ghi đè khối chung — cho phép iOS và Android khác nhau.
  const platformEntry = Platform.OS === 'ios' ? raw.ios : raw.android;
  const entry: RemoteUpdateEntry = { ...raw, ...(platformEntry ?? {}) };

  return {
    enabled: entry.enabled !== false,
    latestVersion: (entry.latestVersion ?? entry.version)?.trim() || undefined,
    minimumVersion: (entry.minimumVersion ?? entry.minVersion)?.trim() || undefined,
    storeUrl: entry.storeUrl?.trim() || undefined,
    storeDeepLink: entry.storeDeepLink?.trim() || undefined,
    releaseNotes: pickReleaseNotes(entry.releaseNotes, language),
    force: entry.force ?? entry.forceUpdate,
  };
}

/** Đọc chính sách từ URL đầu tiên trả về JSON hợp lệ; không có thì null. */
async function fetchRemotePolicy(language: AppLanguage): Promise<RemoteUpdatePolicy | null> {
  for (const url of getRemoteConfigUrls()) {
    try {
      const raw = await fetchJsonNoCache(url);
      if (!raw || typeof raw !== 'object') continue;
      return normalizePolicy(raw as RemoteUpdateConfig, language);
    } catch (error) {
      console.warn('[appUpdate] Không đọc được remote config:', url, error);
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Lớp B, nguồn 1 — backend Frappe (bảng APP_VERSIONS)                  */
/* ------------------------------------------------------------------ */

interface BackendVersionResponse {
  success?: boolean;
  version?: string;
  min_version?: string;
  store_url?: string;
}

/**
 * `erp.api.erp_sis.app_version.get_latest_version` — đã có sẵn phía backend, cho
 * phép gọi không đăng nhập. Đây là nguồn chuẩn cho app này vì bản iOS phát hành
 * dạng Unlisted, iTunes Lookup không phải lúc nào cũng thấy.
 *
 * Sửa version/min_version = sửa `APP_VERSIONS` trong `erp/api/erp_sis/app_version.py`
 * rồi deploy backend — nhanh hơn phát hành app, nhưng vẫn chậm hơn sửa file tĩnh.
 */
async function fetchBackendVersion(): Promise<StoreVersionInfo | null> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const url =
    `${API_BASE_URL}/api/method/erp.api.erp_sis.app_version.get_latest_version` +
    `?app_id=${BACKEND_APP_ID}&platform=${platform}`;

  const raw = (await fetchJsonNoCache(url)) as BackendVersionResponse | null;
  if (!raw || raw.success === false) return null;

  const latestVersion = raw.version?.trim();
  if (!latestVersion) return null;

  const storeUrl = raw.store_url?.trim() || getFallbackStoreUrl();
  if (!storeUrl) return null;

  return {
    latestVersion,
    storeUrl,
    minimumVersion: raw.min_version?.trim() || undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Lớp B, nguồn 2 — App Store (iTunes Lookup API)                       */
/* ------------------------------------------------------------------ */

interface ITunesLookupResult {
  version?: string;
  trackViewUrl?: string;
  trackId?: number;
  releaseNotes?: string;
}

async function fetchAppStoreVersion(): Promise<StoreVersionInfo | null> {
  const bundleId = getAppIdentifier();
  if (!bundleId) return null;

  // `t` phá cache CDN của Apple (kết quả lookup được cache khá lâu sau khi release).
  const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(
    bundleId
  )}&country=${ITUNES_COUNTRY}&t=${Date.now()}`;

  const response = await fetchWithTimeout(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    resultCount?: number;
    results?: ITunesLookupResult[];
  };
  const result = payload.results?.[0];
  const latestVersion = result?.version?.trim();
  if (!latestVersion) return null;

  const storeUrl = result?.trackViewUrl?.trim() || getFallbackStoreUrl();
  if (!storeUrl) return null;

  return {
    latestVersion,
    storeUrl,
    storeDeepLink: result?.trackId
      ? `itms-apps://itunes.apple.com/app/id${result.trackId}`
      : undefined,
    releaseNotes: result?.releaseNotes?.trim() || undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Lớp B, nguồn 3 — Google Play (dò HTML)                               */
/* ------------------------------------------------------------------ */

/**
 * Google Play không có API công khai. Các mẫu dưới đây bám vào JSON nhúng trong HTML;
 * đủ dùng hiện tại nhưng có thể hỏng khi Google đổi layout → khi đó trả null.
 */
const PLAY_VERSION_PATTERNS: RegExp[] = [
  /\[\[\["(\d+(?:\.\d+)+)"\]\]/,
  /Current Version[^<]*<\/div><span[^>]*><div[^>]*><span[^>]*>([\d.]+)</,
  /"softwareVersion"\s*>\s*([\d.]+)\s*</,
];

async function fetchPlayStoreVersion(): Promise<StoreVersionInfo | null> {
  const packageName = getAppIdentifier();
  if (!packageName) return null;

  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(
    packageName
  )}&hl=en&gl=US`;

  const response = await fetchWithTimeout(url, {
    headers: { 'User-Agent': PLAY_STORE_USER_AGENT, Accept: 'text/html' },
  });
  if (!response.ok) return null;

  const html = await response.text();
  for (const pattern of PLAY_VERSION_PATTERNS) {
    const matched = html.match(pattern);
    const version = matched?.[1]?.trim();
    if (version && /^\d+(\.\d+)+$/.test(version)) {
      return {
        latestVersion: version,
        storeUrl: `https://play.google.com/store/apps/details?id=${packageName}`,
        storeDeepLink: `market://details?id=${packageName}`,
      };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* API chính                                                           */
/* ------------------------------------------------------------------ */

const NO_UPDATE: AppUpdateStatus = {
  currentVersion: APP_VERSION,
  latestVersion: null,
  storeUrl: null,
  updateAvailable: false,
  mandatory: false,
};

/**
 * Trả về trạng thái cập nhật của app. Không bao giờ throw — mọi lỗi mạng đều
 * quy về "không có bản mới" để popup không bật nhầm khi rớt mạng.
 */
export async function checkAppUpdate(language: AppLanguage = 'vi'): Promise<AppUpdateStatus> {
  if (!isUpdateCheckEnabled()) return NO_UPDATE;

  const info = await resolveVersionInfo(language);
  if (!info) return NO_UPDATE;

  const updateAvailable = isVersionNewer(info.latestVersion, APP_VERSION);
  // Remote config có ý kiến thì nghe remote; im lặng thì theo mặc định build-time.
  const forceAll = info.force ?? isForcedUpdateEnabled();
  const mandatory =
    updateAvailable &&
    (forceAll || (!!info.minimumVersion && isVersionNewer(info.minimumVersion, APP_VERSION)));

  return {
    currentVersion: APP_VERSION,
    latestVersion: info.latestVersion,
    storeUrl: info.storeUrl,
    storeDeepLink: info.storeDeepLink,
    releaseNotes: info.releaseNotes,
    updateAvailable,
    mandatory,
  };
}

/**
 * Gộp chính sách (remote config) với phiên bản mới nhất (chính sách → backend → store).
 *
 * Chính sách luôn được đọc trước và luôn thắng: tắt popup, đổi mức ép buộc, đổi link
 * store — tất cả áp dụng ngay ở lần kiểm tra kế tiếp, không cần phát hành bản mới.
 */
async function resolveVersionInfo(language: AppLanguage): Promise<StoreVersionInfo | null> {
  const policy = await fetchRemotePolicy(language);

  // Tắt từ xa: không hỏi backend/store nữa, popup im hoàn toàn.
  if (policy && !policy.enabled) return null;

  let base = buildInfoFromPolicy(policy);
  if (!base) {
    const [backend, store] = await Promise.all([
      fetchBackendVersionSafe(),
      fetchStoreVersionSafe(),
    ]);
    base = mergeVersionSources(backend, store);
  }
  base = base ?? buildInfoFromMinimum(policy);
  if (!base) return null;

  return {
    ...base,
    storeUrl: policy?.storeUrl ?? base.storeUrl,
    storeDeepLink: policy?.storeDeepLink ?? base.storeDeepLink,
    releaseNotes: policy?.releaseNotes ?? base.releaseNotes,
    minimumVersion: policy?.minimumVersion ?? base.minimumVersion,
    force: policy?.force,
  };
}

/**
 * Gộp hai nguồn phiên bản: lấy bản CAO HƠN.
 *
 * Bảng `APP_VERSIONS` phía backend là dữ liệu chép tay nên hay bị quên (17/08/2026:
 * backend ghi 1.5.28 trong khi App Store đã 1.5.41) — tin backend một mình là bỏ sót
 * bản mới. Ngược lại chỉ tin store thì mất `min_version`, và Play Store dò bằng HTML
 * có thể hỏng bất cứ lúc nào. Lấy cái cao hơn, giữ `minimumVersion` của backend.
 */
function mergeVersionSources(
  backend: StoreVersionInfo | null,
  store: StoreVersionInfo | null
): StoreVersionInfo | null {
  if (!backend) return store;
  if (!store) return backend;

  const newest = isVersionNewer(store.latestVersion, backend.latestVersion) ? store : backend;
  return { ...newest, minimumVersion: backend.minimumVersion ?? newest.minimumVersion };
}

/** Chính sách ghi hẳn `latestVersion` → khỏi hỏi backend/store. */
function buildInfoFromPolicy(policy: RemoteUpdatePolicy | null): StoreVersionInfo | null {
  if (!policy?.latestVersion) return null;
  const storeUrl = policy.storeUrl ?? getFallbackStoreUrl();
  if (!storeUrl) return null;
  return { latestVersion: policy.latestVersion, storeUrl };
}

/**
 * Không nguồn nào tra được phiên bản nhưng chính sách có `minimumVersion` → vẫn ép
 * được: coi minimumVersion là bản cần lên.
 */
function buildInfoFromMinimum(policy: RemoteUpdatePolicy | null): StoreVersionInfo | null {
  if (!policy?.minimumVersion) return null;
  const storeUrl = policy.storeUrl ?? getFallbackStoreUrl();
  if (!storeUrl) return null;
  return { latestVersion: policy.minimumVersion, storeUrl };
}

async function fetchBackendVersionSafe(): Promise<StoreVersionInfo | null> {
  try {
    return await fetchBackendVersion();
  } catch (error) {
    console.warn('[appUpdate] Không hỏi được phiên bản từ backend:', error);
    return null;
  }
}

async function fetchStoreVersionSafe(): Promise<StoreVersionInfo | null> {
  try {
    return Platform.OS === 'ios' ? await fetchAppStoreVersion() : await fetchPlayStoreVersion();
  } catch (error) {
    console.warn('[appUpdate] Không tra được phiên bản trên store:', error);
    return null;
  }
}

export const appUpdateService = {
  checkAppUpdate,
  compareVersions,
  isVersionNewer,
  isUpdateCheckEnabled,
  isForcedUpdateEnabled,
  getFallbackStoreUrl,
  getRemoteConfigUrls,
};

export default appUpdateService;
