/**
 * Kiểm tra phiên bản mới đã phát hành trên App Store / Google Play.
 *
 * Thứ tự ưu tiên nguồn dữ liệu:
 * 1) Remote config JSON (EXPO_PUBLIC_APP_UPDATE_CONFIG_URL) — nguồn tin cậy nhất,
 *    cho phép nhà trường ép buộc cập nhật (minimumVersion) và tự viết nội dung thay đổi.
 * 2) iTunes Lookup API (iOS) — Apple cung cấp chính thức, trả về version + link store.
 * 3) HTML trang Google Play (Android) — Google không có API công khai nên phải dò chuỗi;
 *    khi Google đổi layout thì bước này trả về null và app im lặng bỏ qua (không popup sai).
 */
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

/** Ngôn ngữ app đang dùng — khớp với i18n (src/config/i18n.ts). */
export type AppLanguage = 'vi' | 'en';

/** Phiên bản đang cài — ưu tiên app.json, fallback sang native version. */
export const APP_VERSION: string =
  Constants.expoConfig?.version || Application.nativeApplicationVersion || '0.0.0';

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
/* Nguồn 1 — remote config                                             */
/* ------------------------------------------------------------------ */

interface RemoteUpdateEntry {
  latestVersion?: string;
  /** Alias của latestVersion */
  version?: string;
  minimumVersion?: string;
  /** Alias của minimumVersion */
  minVersion?: string;
  storeUrl?: string;
  releaseNotes?: string | { vi?: string; en?: string };
  /** false → tắt popup từ xa mà không cần build lại app. */
  enabled?: boolean;
}

type RemoteUpdateConfig = RemoteUpdateEntry & {
  ios?: RemoteUpdateEntry;
  android?: RemoteUpdateEntry;
};

function pickReleaseNotes(
  notes: RemoteUpdateEntry['releaseNotes'],
  language: AppLanguage
): string | undefined {
  if (!notes) return undefined;
  if (typeof notes === 'string') return notes.trim() || undefined;
  return (notes[language] ?? notes.vi ?? notes.en)?.trim() || undefined;
}

async function fetchRemoteConfigVersion(language: AppLanguage): Promise<StoreVersionInfo | null> {
  const url = process.env.EXPO_PUBLIC_APP_UPDATE_CONFIG_URL?.trim();
  if (!url) return null;

  const response = await fetchWithTimeout(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;

  const raw = (await response.json()) as RemoteUpdateConfig;
  const platformEntry = Platform.OS === 'ios' ? raw.ios : raw.android;
  const entry: RemoteUpdateEntry = { ...raw, ...(platformEntry ?? {}) };

  if (entry.enabled === false) return null;

  const latestVersion = (entry.latestVersion ?? entry.version)?.trim();
  if (!latestVersion) return null;

  const storeUrl = entry.storeUrl?.trim() || getFallbackStoreUrl();
  if (!storeUrl) return null;

  return {
    latestVersion,
    storeUrl,
    minimumVersion: (entry.minimumVersion ?? entry.minVersion)?.trim() || undefined,
    releaseNotes: pickReleaseNotes(entry.releaseNotes, language),
  };
}

/* ------------------------------------------------------------------ */
/* Nguồn 2 — App Store (iTunes Lookup API)                             */
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
/* Nguồn 3 — Google Play (dò HTML)                                     */
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

  const info = await resolveStoreVersion(language);
  if (!info) return NO_UPDATE;

  const updateAvailable = isVersionNewer(info.latestVersion, APP_VERSION);
  const mandatory =
    updateAvailable && !!info.minimumVersion && isVersionNewer(info.minimumVersion, APP_VERSION);

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

/** Lần lượt thử remote config → store; nguồn nào lỗi thì bỏ qua, không chặn nguồn sau. */
async function resolveStoreVersion(language: AppLanguage): Promise<StoreVersionInfo | null> {
  try {
    const remote = await fetchRemoteConfigVersion(language);
    if (remote) return remote;
  } catch (error) {
    console.warn('[appUpdate] Không đọc được remote config:', error);
  }

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
  getFallbackStoreUrl,
};

export default appUpdateService;
