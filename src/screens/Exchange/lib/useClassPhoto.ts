import { useEffect, useState } from 'react';

import { photoService } from '../../../services/photoService';

import { resolveParticipantAvatarUrl } from './chatMemberAvatar';

/**
 * Ảnh đại diện lớp (SIS Photo) theo từng năm học — dùng cho avatar nhóm chat lớp.
 * Cache theo (classId, schoolYearId) ở module-level: nhiều nơi cùng render 1 lớp
 * (danh sách + header thread + màn thông tin) chỉ gọi API một lần; null = đã tra, không có ảnh.
 */
const photoCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function cacheKey(classId?: string, schoolYearId?: string): string {
  return classId && schoolYearId ? `${classId}|${schoolYearId}` : '';
}

async function fetchClassPhoto(classId: string, schoolYearId: string): Promise<string | null> {
  try {
    const photos = await photoService.getClassPhotos(classId, schoolYearId, 10);
    const candidates = photos.filter((p) => !p.class_id || p.class_id === classId);
    const latest = candidates.find((p) => p.status === 'Active') || candidates[0];
    const raw = String(latest?.photo || '').trim();
    return raw ? resolveParticipantAvatarUrl(raw, '') : null;
  } catch {
    return null;
  }
}

/** URL ảnh lớp theo năm học, hoặc null nếu chưa có / đang tắt (`enabled=false`). */
export function useClassPhoto(
  classId?: string,
  schoolYearId?: string,
  enabled = true
): string | null {
  const key = enabled ? cacheKey(classId, schoolYearId) : '';
  const [url, setUrl] = useState<string | null>(() => (key ? photoCache.get(key) ?? null : null));

  useEffect(() => {
    if (!key || !classId || !schoolYearId) {
      setUrl(null);
      return;
    }
    if (photoCache.has(key)) {
      setUrl(photoCache.get(key) ?? null);
      return;
    }
    let cancelled = false;
    let promise = inflight.get(key);
    if (!promise) {
      promise = fetchClassPhoto(classId, schoolYearId).then((result) => {
        photoCache.set(key, result);
        inflight.delete(key);
        return result;
      });
      inflight.set(key, promise);
    }
    void promise.then((result) => {
      if (!cancelled) setUrl(result);
    });
    return () => {
      cancelled = true;
    };
  }, [key, classId, schoolYearId]);

  return url;
}
