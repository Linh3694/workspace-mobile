/**
 * Lưu ảnh / video đang xem xuống máy — dùng chung cho chat Trao đổi và Wislife.
 *
 * `expo-media-library` chỉ chạy khi native module đã được link (pod install /
 * prebuild). Nếu thiếu module, hoặc người dùng từ chối quyền ghi album, vẫn phải
 * tải được: rơi về bảng chia sẻ của hệ điều hành ("Lưu ảnh" / "Save to Photos").
 * Vì vậy hàm dưới đây KHÔNG coi lỗi MediaLibrary là lỗi tải.
 */
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

export type SaveMediaResult = 'saved-to-library' | 'shared' | 'opened-in-browser';

export type SaveMediaInput = {
  /** URL tuyệt đối của ảnh/video (đã resolve qua service tương ứng). */
  url: string;
  /** Tên gợi ý khi lưu; thiếu thì lấy từ URL. */
  name?: string;
  mimeType?: string;
  kind?: 'image' | 'video';
};

/** Tên file an toàn cho mọi hệ điều hành, giữ nguyên dấu tiếng Việt. */
export function safeMediaFileName(name?: string): string {
  const cleaned = String(name || '')
    .trim()
    .replace(/\p{Cc}/gu, '')
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  return cleaned.slice(0, 160);
}

/** Tên suy ra từ URL (bỏ query) — CDN thường chỉ có hash nhưng vẫn giữ đuôi file. */
function fileNameFromUrl(url: string, kind?: 'image' | 'video'): string {
  const fromUrl = safeMediaFileName(url.split('?')[0].split('/').pop());
  if (fromUrl && /\.[a-z0-9]{2,5}$/i.test(fromUrl)) return fromUrl;
  const ext = kind === 'video' ? 'mp4' : 'jpg';
  return `${fromUrl || 'wis-media'}.${ext}`;
}

/** Tải về thư mục tạm riêng mỗi lượt để không đụng tên nhau. */
async function downloadToCache(url: string, name: string, seq: number): Promise<FileSystem.File> {
  const dir = new FileSystem.Directory(FileSystem.Paths.cache, `wis-media-${seq}`);
  let target: FileSystem.File;
  try {
    dir.create({ intermediates: true, idempotent: true });
    target = new FileSystem.File(dir, name);
  } catch {
    target = new FileSystem.File(FileSystem.Paths.cache, `${seq}-${name}`);
  }
  return FileSystem.File.downloadFileAsync(url, target, { idempotent: true });
}

/** Lưu vào album; trả về false nếu không dùng được (thiếu module / bị từ chối). */
async function trySaveToLibrary(uri: string): Promise<boolean> {
  try {
    if (!(await MediaLibrary.isAvailableAsync())) return false;
    // writeOnly: chỉ xin quyền GHI, không cần quyền đọc toàn bộ thư viện.
    let permission = await MediaLibrary.getPermissionsAsync(true);
    if (!permission.granted && permission.canAskAgain) {
      permission = await MediaLibrary.requestPermissionsAsync(true);
    }
    if (!permission.granted) return false;
    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch (error) {
    console.warn('[mediaDownload] saveToLibrary fallback', error);
    return false;
  }
}

/**
 * Tải ảnh/video về máy. Ưu tiên lưu thẳng vào album; không được thì mở bảng
 * chia sẻ. Ném lỗi khi cả hai đường đều thất bại (mạng hỏng, URL sai...).
 */
export async function saveMediaToDevice({
  url,
  name,
  mimeType,
  kind,
}: SaveMediaInput): Promise<SaveMediaResult> {
  if (!url) throw new Error('saveMediaToDevice: empty url');

  if (Platform.OS === 'web') {
    await Linking.openURL(url);
    return 'opened-in-browser';
  }

  const fileName = safeMediaFileName(name) || fileNameFromUrl(url, kind);
  const file = await downloadToCache(url, fileName, Date.now());

  if (await trySaveToLibrary(file.uri)) return 'saved-to-library';

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: mimeType || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      dialogTitle: fileName,
      UTI: kind === 'video' ? 'public.movie' : 'public.image',
    });
    return 'shared';
  }

  await Linking.openURL(file.uri);
  return 'opened-in-browser';
}

export default saveMediaToDevice;
