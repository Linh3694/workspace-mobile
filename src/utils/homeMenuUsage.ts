import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_V2 = '@home_menu_usage_v2:';
const STORAGE_V1 = '@home_menu_usage_v1:';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Mỗi tuần trôi qua (kể từ lần decay trước) nhân weight với hệ số này — thói quen cũ nhạt dần */
export const HOME_MENU_DECAY_PER_WEEK = 0.85;

export type HomeMenuEntry = {
  /** Lần mở tile gần nhất (ms) — sort ưu tiên gần đây */
  lastUsedAt: number;
  /** Trọng số (tăng mỗi lần mở; bị decay theo tuần) */
  weight: number;
};

export type HomeMenuUsageState = {
  meta: { lastDecayAt: number };
  entries: Record<string, HomeMenuEntry>;
};

export function createEmptyHomeMenuUsage(): HomeMenuUsageState {
  return { meta: { lastDecayAt: 0 }, entries: {} };
}

/** Áp decay theo số tuần đã trôi kể từ meta.lastDecayAt — trả true nếu cần persist */
function applyWeeklyDecay(state: HomeMenuUsageState, now: number): boolean {
  const last = state.meta.lastDecayAt;
  if (!last) {
    state.meta.lastDecayAt = now;
    return true;
  }
  const weeks = Math.floor((now - last) / WEEK_MS);
  if (weeks < 1) return false;
  const factor = Math.pow(HOME_MENU_DECAY_PER_WEEK, weeks);
  for (const k of Object.keys(state.entries)) {
    const e = state.entries[k];
    if (!e) continue;
    e.weight *= factor;
    if (e.weight < 1e-6) e.weight = 0;
  }
  state.meta.lastDecayAt = last + weeks * WEEK_MS;
  return true;
}

function migrateV1FlatCounts(raw: Record<string, unknown>, now: number): HomeMenuUsageState {
  const entries: Record<string, HomeMenuEntry> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n) && n > 0) {
      // Dữ liệu cũ không có timestamp — gán mốc để không vỡ sort; weight giữ tương đối
      entries[k] = { lastUsedAt: now, weight: Math.max(1, Math.floor(n)) };
    }
  }
  return { meta: { lastDecayAt: now }, entries };
}

function parseV2(raw: unknown): HomeMenuUsageState | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const entriesRaw = o.entries;
  if (typeof entriesRaw !== 'object' || entriesRaw === null) return null;
  const entries: Record<string, HomeMenuEntry> = {};
  for (const [k, v] of Object.entries(entriesRaw as Record<string, unknown>)) {
    if (typeof v !== 'object' || v === null) continue;
    const e = v as Record<string, unknown>;
    const lastUsedAt = typeof e.lastUsedAt === 'number' ? e.lastUsedAt : Number(e.lastUsedAt);
    const weight = typeof e.weight === 'number' ? e.weight : Number(e.weight);
    if (!Number.isFinite(lastUsedAt) || !Number.isFinite(weight)) continue;
    entries[k] = {
      lastUsedAt: Math.max(0, lastUsedAt),
      weight: Math.max(0, weight),
    };
  }
  const metaRaw = o.meta;
  let lastDecayAt = 0;
  if (typeof metaRaw === 'object' && metaRaw !== null) {
    const m = (metaRaw as Record<string, unknown>).lastDecayAt;
    lastDecayAt = typeof m === 'number' ? m : Number(m);
    if (!Number.isFinite(lastDecayAt)) lastDecayAt = 0;
  }
  return { meta: { lastDecayAt: Math.max(0, lastDecayAt) }, entries };
}

/**
 * Đọc state menu Home — có migrate từ v1 (chỉ số đếm) và áp decay theo tuần khi mở app.
 */
export async function loadHomeMenuUsage(userId: string): Promise<HomeMenuUsageState> {
  if (!userId) return createEmptyHomeMenuUsage();
  const now = Date.now();
  try {
    const rawV2 = await AsyncStorage.getItem(STORAGE_V2 + userId);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as unknown;
      const v2 = parseV2(parsed);
      if (v2) {
        const dirty = applyWeeklyDecay(v2, now);
        if (dirty) await saveHomeMenuUsage(userId, v2);
        return v2;
      }
    }
    const rawV1 = await AsyncStorage.getItem(STORAGE_V1 + userId);
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const migrated = migrateV1FlatCounts(parsed as Record<string, unknown>, now);
        applyWeeklyDecay(migrated, now);
        await saveHomeMenuUsage(userId, migrated);
        try {
          await AsyncStorage.removeItem(STORAGE_V1 + userId);
        } catch {
          // ignore
        }
        return migrated;
      }
    }
  } catch {
    return createEmptyHomeMenuUsage();
  }
  return createEmptyHomeMenuUsage();
}

export async function saveHomeMenuUsage(userId: string, state: HomeMenuUsageState): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(STORAGE_V2 + userId, JSON.stringify(state));
  } catch {
    // bỏ qua lỗi lưu trữ
  }
}

/**
 * Ghi nhận mở tile: cập nhật lastUsedAt = now, weight += 1 (sau khi đã decay ở load).
 */
export function applyMenuTap(state: HomeMenuUsageState, key: string): HomeMenuUsageState {
  const now = Date.now();
  const prev = state.entries[key];
  const next: HomeMenuUsageState = {
    meta: {
      lastDecayAt: state.meta.lastDecayAt || now,
    },
    entries: { ...state.entries },
  };
  next.entries[key] = {
    lastUsedAt: now,
    weight: (prev?.weight ?? 0) + 1,
  };
  return next;
}

/**
 * Sort: ưu tiên lastUsedAt (mới nhất trước), tie-break weight, rồi thứ tự gốc.
 * Tile chưa từng mở (không có entry) nằm cuối theo thứ tự gốc.
 */
export function sortMenuItemsByUsage<T extends { key: string }>(
  items: T[],
  state: HomeMenuUsageState
): T[] {
  const baseOrder = new Map(items.map((it, i) => [it.key, i]));
  const entries = state.entries;
  return [...items].sort((a, b) => {
    const ea = entries[a.key];
    const eb = entries[b.key];
    const la = ea?.lastUsedAt ?? 0;
    const lb = eb?.lastUsedAt ?? 0;
    if (la !== lb) return lb - la;
    const wa = ea?.weight ?? 0;
    const wb = eb?.weight ?? 0;
    if (wa !== wb) return wb - wa;
    return (baseOrder.get(a.key) ?? 0) - (baseOrder.get(b.key) ?? 0);
  });
}
