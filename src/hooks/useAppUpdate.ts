/**
 * Trạng thái nhắc cập nhật phiên bản mới trên store.
 *
 * Quy tắc hiển thị popup:
 * - Chỉ hiện khi store có bản mới hơn bản đang cài.
 * - Bấm "Để sau" → tạm ẩn cho đúng phiên bản đó, nhắc lại sau REMIND_AFTER_MS
 *   hoặc ngay khi store ra bản mới hơn nữa.
 * - Bản bắt buộc (mandatory) bỏ qua mọi trạng thái tạm ẩn.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  checkAppUpdate,
  isUpdateCheckEnabled,
  type AppLanguage,
  type AppUpdateStatus,
} from '../services/appUpdateService';

/** Key AsyncStorage — nhớ phiên bản người dùng đã bấm "Để sau". */
const SNOOZE_STORAGE_KEY = '@wis_staff/app_update_snooze';

/** Nhắc lại sau 24h dù người dùng đã bấm "Để sau" cho cùng phiên bản. */
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;

/** Chờ splash + load font chạy xong rồi mới gọi store. */
const CHECK_START_DELAY_MS = 3500;

/** Kết quả tra store coi là còn "tươi" trong 6 tiếng. */
const UPDATE_STALE_TIME_MS = 6 * 60 * 60 * 1000;

interface SnoozeRecord {
  version: string;
  at: number;
}

/** Cache theo ngôn ngữ, sống theo vòng đời process — thay cho React Query. */
const statusCache = new Map<AppLanguage, { status: AppUpdateStatus; at: number }>();
const inFlight = new Map<AppLanguage, Promise<AppUpdateStatus>>();

function normalizeLanguage(language: string | undefined): AppLanguage {
  return String(language ?? '').startsWith('en') ? 'en' : 'vi';
}

/**
 * Tra store, dùng lại kết quả còn "tươi" và gộp các lời gọi song song.
 * Không bao giờ throw — lỗi mạng đã được checkAppUpdate quy về "không có bản mới".
 */
async function loadStatus(language: AppLanguage, force = false): Promise<AppUpdateStatus> {
  const cached = statusCache.get(language);
  if (!force && cached && Date.now() - cached.at < UPDATE_STALE_TIME_MS) {
    return cached.status;
  }

  const pending = inFlight.get(language);
  if (pending) return pending;

  const request = checkAppUpdate(language)
    .then((status) => {
      statusCache.set(language, { status, at: Date.now() });
      return status;
    })
    .finally(() => {
      inFlight.delete(language);
    });

  inFlight.set(language, request);
  return request;
}

async function readSnooze(): Promise<SnoozeRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SnoozeRecord>;
    if (typeof parsed?.version !== 'string' || typeof parsed?.at !== 'number') {
      return null;
    }
    return { version: parsed.version, at: parsed.at };
  } catch {
    // Storage hỏng/đọc lỗi → coi như chưa từng bấm "Để sau"
    return null;
  }
}

async function writeSnooze(record: SnoozeRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ghi hỏng thì lần mở app sau popup hiện lại — chấp nhận được
  }
}

/** Popup còn bị ẩn với phiên bản này không? */
function isSnoozed(record: SnoozeRecord | null, latestVersion: string): boolean {
  if (!record) return false;
  if (record.version !== latestVersion) return false;
  return Date.now() - record.at < REMIND_AFTER_MS;
}

/** Tra phiên bản store — dùng riêng khi cần (ví dụ màn Cài đặt). */
export function useAppUpdateStatus(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const { i18n } = useTranslation();
  const language = normalizeLanguage(i18n.language);

  const [status, setStatus] = useState<AppUpdateStatus | undefined>(
    () => statusCache.get(language)?.status
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled || !isUpdateCheckEnabled()) return;
      const next = await loadStatus(language, force);
      if (mountedRef.current) setStatus(next);
    },
    [enabled, language]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // App quay lại foreground: tra lại nếu kết quả cũ đã hết "tươi".
  useEffect(() => {
    if (!enabled || !isUpdateCheckEnabled()) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [enabled, refresh]);

  return { status, refresh };
}

/**
 * Mở App Store / Google Play cho phiên bản đang tra được.
 * Ưu tiên scheme cửa hàng (mở thẳng app store), fallback link https.
 */
export async function openAppStore(
  status: Pick<AppUpdateStatus, 'storeUrl' | 'storeDeepLink'> | undefined
): Promise<void> {
  const deepLink = status?.storeDeepLink;
  const webUrl = status?.storeUrl;

  if (deepLink) {
    try {
      if (await Linking.canOpenURL(deepLink)) {
        await Linking.openURL(deepLink);
        return;
      }
    } catch {
      // Không mở được scheme cửa hàng → thử link https bên dưới
    }
  }
  if (webUrl) {
    await Linking.openURL(webUrl);
  }
}

export interface AppUpdatePrompt {
  status: AppUpdateStatus | undefined;
  /** Có hiển thị popup lúc này không. */
  visible: boolean;
  /** Bắt buộc cập nhật — popup không cho đóng. */
  mandatory: boolean;
  /** Bấm "Để sau" — ghi nhớ và ẩn popup. */
  dismiss: () => void;
  /** Mở App Store / Google Play. */
  openStore: () => Promise<void>;
}

/**
 * Trạng thái đầy đủ cho popup cập nhật — dùng ở AppUpdateHost trong root layout.
 */
export function useAppUpdatePrompt(): AppUpdatePrompt {
  const [checkEnabled, setCheckEnabled] = useState(false);
  const [snooze, setSnooze] = useState<SnoozeRecord | null>(null);
  const [snoozeLoaded, setSnoozeLoaded] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Hoãn gọi store để popup không đè lên splash lúc mở app.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mountedRef.current) setCheckEnabled(true);
    }, CHECK_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    void readSnooze().then((record) => {
      if (!mountedRef.current) return;
      setSnooze(record);
      setSnoozeLoaded(true);
    });
  }, []);

  const { status } = useAppUpdateStatus({ enabled: checkEnabled });

  const latestVersion = status?.latestVersion ?? null;
  const mandatory = !!status?.mandatory;

  const visible =
    !!status?.updateAvailable &&
    !!latestVersion &&
    snoozeLoaded &&
    (mandatory || !isSnoozed(snooze, latestVersion));

  const dismiss = useCallback(() => {
    if (mandatory || !latestVersion) return;
    // Ghi ngay vào state để popup ẩn tức thì; AsyncStorage giữ cho lần mở app sau.
    const record: SnoozeRecord = { version: latestVersion, at: Date.now() };
    setSnooze(record);
    void writeSnooze(record);
  }, [latestVersion, mandatory]);

  const openStore = useCallback(
    () => openAppStore(status),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status?.storeDeepLink, status?.storeUrl]
  );

  return { status, visible, mandatory, dismiss, openStore };
}
