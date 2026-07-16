/**
 * Ghim hội thoại lên đầu danh sách Trao đổi — lưu client (AsyncStorage), không backend.
 * Tương đương chatPinStore bên web (localStorage, scope inbox).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = 'exchangeChatPinnedIds';

export async function getPinnedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PIN_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function isConversationPinned(id: string): Promise<boolean> {
  const ids = await getPinnedIds();
  return ids.includes(String(id));
}

/** Bật/tắt ghim; trả về trạng thái ghim mới. */
export async function togglePinned(id: string): Promise<boolean> {
  const key = String(id || '').trim();
  if (!key) return false;
  const ids = await getPinnedIds();
  const set = new Set(ids);
  let pinned: boolean;
  if (set.has(key)) {
    set.delete(key);
    pinned = false;
  } else {
    set.add(key);
    pinned = true;
  }
  try {
    await AsyncStorage.setItem(PIN_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore write error
  }
  return pinned;
}
