/**
 * Upload trực tiếp lên CDN cho app di động (Phase 3 — CDN-Design.md §10).
 *
 * Bản React Native của `frappe-sis-frontend/packages/core/src/services/cdnDirectUpload.ts`.
 * Giữ cùng giao thức và cùng tên hàm để hai nền tảng không lệch nhau.
 *
 * KHÁC BIỆT SO VỚI BẢN WEB — quan trọng:
 *
 *   • RN không có đối tượng `File`. Ảnh/video từ thư viện là `{ uri, type, name }`,
 *     byte nằm trong hệ thống tệp của máy.
 *   • Gửi bằng `FileSystem.uploadAsync` chứ KHÔNG bằng `fetch(uri).blob()`.
 *     Xem ghi chú ngay dưới — đây là khác biệt về độ an toàn, không phải khẩu vị.
 *
 * ⚠️ VÌ SAO KHÔNG DÙNG `fetch(uri).blob()`
 *
 * Cách đó nạp TRỌN tệp vào heap JavaScript trước khi gửi. Trần dung lượng là
 * 100 MB, nên một video dài trên máy Android tầm trung là đủ để app chết vì hết
 * bộ nhớ — mà video lại chính là thứ Phase 3 sinh ra để giải quyết. `uploadAsync`
 * với `BINARY_CONTENT` đọc từ đĩa và đẩy đi, byte không đi qua heap.
 *
 * Thêm một lợi ích: `fetch` với body là Blob có thể tự đặt lại `Content-Type`
 * theo `blob.type`. Chỉ cần lệch một ký tự so với lúc ký là MinIO trả 403
 * `SignatureDoesNotMatch` — và vì ta có đường quay về multipart, lỗi đó sẽ IM
 * LẶNG: người dùng không thấy gì, đường trực tiếp đơn giản không bao giờ chạy.
 * `uploadAsync` gửi đúng header ta truyền vào.
 *
 * ⚠️ Phải import từ `expo-file-system/legacy`. Trong SDK 54, `uploadAsync` của
 * entry mới đã deprecated và **throw lúc chạy**.
 *
 * ⚠️ `uploadAsync` KHÔNG throw khi server trả 4xx/5xx — nó trả về `{ status }`.
 * Quên kiểm `status` là coi mọi lần PUT thất bại như thành công, rồi `complete`
 * mới báo 404 ở tận bước sau và rất khó truy.
 *
 * TỰ QUAY VỀ ĐƯỜNG CŨ khi server chưa bật cờ — nhờ vậy phát hành app trước, bật
 * cờ sau, và tắt cờ là mọi máy quay lại multipart ngay mà không cần cập nhật app.
 */

import * as FileSystem from 'expo-file-system/legacy';

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

/**
 * Kích thước tệp, hoặc `null` khi không đọc được.
 *
 * Chỉ để kiểm trần SỚM cho người dùng đỡ chờ. Không đọc được cũng cứ gửi: server
 * hậu kiểm bằng `HeadObject` lúc promote rồi xoá nếu vượt, nên đây là tiện lợi
 * chứ không phải ranh giới bảo mật.
 */
async function kichThuoc(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && typeof info.size === 'number' ? info.size : null;
  } catch {
    return null;
  }
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

    const size = await kichThuoc(file.uri);
    if (item.maxBytes && size !== null && size > item.maxBytes) {
      const mb = Math.round(item.maxBytes / 1024 / 1024);
      throw new Error(`"${file.name || 'tệp'}" vượt quá ${mb}MB`);
    }

    const res = await FileSystem.uploadAsync(item.putUrl, file.uri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      // KHÔNG kèm Authorization — chữ ký nằm trong URL, thêm header lạ là hỏng.
      // Gửi ĐÚNG requiredHeaders server trả về, không thêm không bớt.
      headers: item.requiredHeaders,
    });
    // uploadAsync không throw khi HTTP lỗi — phải tự kiểm.
    if (res.status < 200 || res.status >= 300) {
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
