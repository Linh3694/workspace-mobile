/**
 * Upload trực tiếp lên CDN cho app di động (Phase 3 — CDN-Design.md §10).
 *
 * Bản React Native của `frappe-sis-frontend/packages/core/src/services/cdnDirectUpload.ts`.
 * Giữ cùng giao thức và cùng tên hàm để hai nền tảng không lệch nhau.
 *
 * KHÁC BIỆT SO VỚI BẢN WEB — quan trọng:
 *
 *   • RN không có đối tượng `File`. Ảnh/video từ thư viện là `{ uri, type, name }`,
 *     byte nằm trong hệ thống tệp của máy. Muốn PUT lên phải đọc ra blob trước.
 *   • `fetch` của RN gửi blob được, nhưng phải để RN tự đặt `Content-Type` khớp
 *     với lúc ký, nếu không SigV4 hỏng.
 *
 * TỰ QUAY VỀ ĐƯỜNG CŨ khi server chưa bật cờ — nhờ vậy phát hành app trước, bật
 * cờ sau, và tắt cờ là mọi máy quay lại multipart ngay mà không cần cập nhật app.
 */

import { BASE_URL } from '../config/constants';

export type MediaKind = 'posts' | 'chat';

export type RNFile = {
  uri: string;
  type?: string;
  name?: string;
};

export type UploadedMedia = {
  stored: string;
  url: string;
  kind: 'image' | 'video' | 'file';
  contentType: string;
  width?: number;
  height?: number;
  size: number;
};

type PresignItem = {
  stagingKey: string;
  putUrl: string;
  requiredHeaders: Record<string, string>;
  expiresInSec: number;
  maxBytes: number;
};

type AuthHeaderFn = () => Promise<Record<string, string>>;

/**
 * Lấy header xác thực. Truyền vào từ ngoài thay vì tự đọc token: mỗi service
 * trong app này lấy token một kiểu (SecureStore, context…), gom vào đây sẽ tạo
 * thêm một nguồn sự thật nữa về token.
 */
let layAuthHeaders: AuthHeaderFn | null = null;

export function configureAuth(fn: AuthHeaderFn): void {
  layAuthHeaders = fn;
}

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const base = layAuthHeaders ? await layAuthHeaders() : {};
  return { Accept: 'application/json', ...base, ...extra };
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: await authHeaders(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return json.data as T;
}

let cachedCapability: { directUpload: boolean; maxFiles: number; maxBytes: number } | null = null;

export async function isAvailable(): Promise<boolean> {
  if (cachedCapability) return cachedCapability.directUpload;
  try {
    cachedCapability = await api<{ directUpload: boolean; maxFiles: number; maxBytes: number }>(
      '/api/social/media/capability',
    );
    return cachedCapability.directUpload;
  } catch {
    // Server cũ chưa có endpoint ⇒ coi như tắt, dùng multipart.
    cachedCapability = { directUpload: false, maxFiles: 10, maxBytes: 0 };
    return false;
  }
}

export function resetCapabilityCache(): void {
  cachedCapability = null;
}

/** Đọc file trong máy thành blob để PUT lên. */
async function docFileThanhBlob(file: RNFile): Promise<Blob> {
  const res = await fetch(file.uri);
  if (!res.ok) throw new Error(`Không đọc được tệp: ${file.name || file.uri}`);
  return res.blob();
}

export async function uploadFiles(
  files: RNFile[],
  kind: MediaKind,
  onProgress?: (done: number, total: number) => void,
): Promise<UploadedMedia[]> {
  if (!files.length) return [];

  const { uploads } = await api<{ uploads: PresignItem[] }>('/api/social/media/presign', {
    kind,
    files: files.map((f) => ({
      filename: f.name || 'upload',
      contentType: f.type || 'application/octet-stream',
    })),
  });

  if (uploads.length !== files.length) {
    throw new Error('Server trả về số đường tải lên không khớp số tệp');
  }

  let done = 0;
  // Tuần tự chứ không song song: mạng di động chập chờn, mở nhiều kết nối cùng
  // lúc trên 3G thường chậm hơn và dễ timeout hơn là gửi lần lượt.
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const item = uploads[i];
    const blob = await docFileThanhBlob(file);

    if (item.maxBytes && blob.size > item.maxBytes) {
      const mb = Math.round(item.maxBytes / 1024 / 1024);
      throw new Error(`"${file.name || 'tệp'}" vượt quá ${mb}MB`);
    }

    const res = await fetch(item.putUrl, {
      method: 'PUT',
      // KHÔNG kèm Authorization — chữ ký nằm trong URL, thêm header lạ là hỏng.
      headers: item.requiredHeaders,
      body: blob,
    });
    if (!res.ok) {
      throw new Error(`Tải "${file.name || 'tệp'}" lên CDN thất bại (HTTP ${res.status})`);
    }
    done += 1;
    onProgress?.(done, files.length);
  }

  const { media } = await api<{ media: UploadedMedia[] }>('/api/social/media/complete', {
    kind,
    stagingKeys: uploads.map((u) => u.stagingKey),
  });
  return media;
}

/**
 * Trả về khoá để gắn vào bài đăng, hoặc `null` khi đường trực tiếp chưa bật —
 * gọi phía trên tự dùng multipart.
 */
export async function uploadForPost(
  files: RNFile[],
  onProgress?: (done: number, total: number) => void,
): Promise<Array<{ stored: string; kind: 'image' | 'video' | 'file' }> | null> {
  if (!files.length) return [];
  if (!(await isAvailable())) return null;
  const media = await uploadFiles(files, 'posts', onProgress);
  return media.map((m) => ({ stored: m.stored, kind: m.kind }));
}
