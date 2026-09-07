/**
 * Context campus — trạng thái "đang ở campus nào" cho toàn app.
 *
 * Nguyên tắc:
 * - Server (SIS User Campus Preference) là nguồn sự thật khi khởi động: web và mobile
 *   dùng chung một preference, nên mở app sẽ thấy đúng campus đã chọn lần cuối ở bất kỳ đâu.
 * - Đổi campus = gọi set_current_campus trên server → cập nhật campusStore (interceptor
 *   đọc) → reset navigator về Trang chủ để mọi màn nạp lại theo campus mới.
 * - Khi user/roles đổi (refreshUserData), danh sách campus được tải lại; campus đang chọn
 *   không còn quyền thì tự rơi về campus hợp lệ đầu tiên — không cần đăng xuất.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { campusService } from '../services/campusService';
import {
  CampusRow,
  campusDisplayTitle,
  clearCampusStore,
  getCurrentCampusIdSync,
  hydrateCampusStore,
  setCurrentCampusId,
} from '../utils/campusStore';
import { normalizeCampusIdForBackend } from '../utils/campusIdUtils';
import { resetToHome } from '../navigation/navigationRef';

export type SwitchCampusResult = { ok: boolean; message?: string; campus?: CampusRow };

type CampusContextType = {
  /** Campus user được vào (đã chuẩn hoá id về dạng CAMPUS-00001). */
  campuses: CampusRow[];
  currentCampusId: string | null;
  currentCampus: CampusRow | null;
  /** Đang tải danh sách / đồng bộ với server lần đầu. */
  loading: boolean;
  /** Đang gọi set_current_campus. */
  switching: boolean;
  /** Tăng mỗi lần campus đổi — màn nào không muốn remount có thể theo dõi để refetch. */
  campusVersion: number;
  /** Đổi campus: lưu server + store, rồi reset app về Trang chủ. */
  switchCampus: (campusId: string) => Promise<SwitchCampusResult>;
  /** Tải lại danh sách campus + campus đang chọn trên server (sau khi role đổi, pull-to-refresh…). */
  refreshCampuses: () => Promise<void>;
};

const CampusContext = createContext<CampusContextType | null>(null);

const normalizeRow = (row: CampusRow): CampusRow => ({
  ...row,
  name: normalizeCampusIdForBackend(row.name) || row.name,
});

export const CampusProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [campuses, setCampuses] = useState<CampusRow[]>([]);
  const [currentCampusId, setCurrentId] = useState<string | null>(getCurrentCampusIdSync());
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [campusVersion, setCampusVersion] = useState(0);
  // Chống race: hai lần bootstrap chồng nhau (đăng nhập + refreshUserData ngay sau) thì
  // chỉ lần sau cùng được ghi state.
  const bootstrapSeq = useRef(0);

  const userEmail: string | null = user?.email || null;
  // Chỉ campus role mới ảnh hưởng danh sách campus; đổi role khác không cần tải lại.
  const campusRolesKey = useMemo(() => {
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    return roles
      .filter((r) => typeof r === 'string' && r.startsWith('Campus '))
      .sort()
      .join('|');
  }, [user?.roles]);

  /**
   * Đồng bộ với server. Thứ tự ưu tiên campus đang chọn:
   *   server preference (nếu còn trong danh sách) > storage máy (nếu còn quyền) > campus đầu.
   * Nếu server chưa có preference mà máy có → đẩy lên server để web/mobile khớp nhau.
   */
  const bootstrap = useCallback(async () => {
    const seq = ++bootstrapSeq.current;
    setLoading(true);
    try {
      const stored = await hydrateCampusStore();
      const [rowsRaw, serverCurrent] = await Promise.all([
        campusService.getCampuses().catch((e) => {
          console.warn('[CampusContext] getCampuses lỗi:', e);
          return [] as CampusRow[];
        }),
        campusService.getCurrentCampus(),
      ]);
      if (seq !== bootstrapSeq.current) return;

      const rows = rowsRaw.map(normalizeRow);
      const has = (id: string | null | undefined) => !!id && rows.some((r) => r.name === id);
      const serverId = serverCurrent ? normalizeCampusIdForBackend(serverCurrent.name) : null;

      let chosen: string | null = null;
      if (has(serverId)) chosen = serverId;
      else if (has(stored)) chosen = stored;
      else if (rows.length > 0) chosen = rows[0].name;
      else chosen = serverId || stored || null;

      setCampuses(rows);
      const chosenRow = rows.find((r) => r.name === chosen) || null;
      await setCurrentCampusId(chosen, campusDisplayTitle(chosenRow) || undefined);
      setCurrentId(chosen);

      // Server chưa có / lệch với lựa chọn hợp lệ → ghi lên server (không chặn UI).
      if (chosen && chosen !== serverId) {
        campusService.setCurrentCampus(chosen).then((r) => {
          if (!r.ok)
            console.warn('[CampusContext] không đồng bộ được campus lên server:', r.message);
        });
      }
    } finally {
      if (seq === bootstrapSeq.current) setLoading(false);
    }
  }, []);

  // Đăng nhập / đổi user / đổi campus role → đồng bộ lại. Đăng xuất → dọn sạch.
  useEffect(() => {
    if (!userEmail) {
      bootstrapSeq.current++;
      setCampuses([]);
      setCurrentId(null);
      setLoading(false);
      clearCampusStore();
      return;
    }
    bootstrap();
  }, [userEmail, campusRolesKey, bootstrap]);

  const switchCampus = useCallback(
    async (campusId: string): Promise<SwitchCampusResult> => {
      const target = normalizeCampusIdForBackend(campusId);
      if (!target) return { ok: false, message: 'Campus ID không hợp lệ' };
      const row = campuses.find((r) => r.name === target) || null;
      if (target === currentCampusId) return { ok: true, campus: row || undefined };

      setSwitching(true);
      try {
        const res = await campusService.setCurrentCampus(target);
        if (!res.ok) return { ok: false, message: res.message };
        const finalRow = res.campus ? normalizeRow(res.campus) : row;
        await setCurrentCampusId(target, campusDisplayTitle(finalRow) || undefined);
        setCurrentId(target);
        setCampusVersion((v) => v + 1);
        // Giống web reload cả trang: gỡ mọi màn đang mở, về Trang chủ nạp lại theo campus mới.
        resetToHome();
        return { ok: true, campus: finalRow || undefined, message: res.message };
      } finally {
        setSwitching(false);
      }
    },
    [campuses, currentCampusId]
  );

  const refreshCampuses = useCallback(async () => {
    if (!userEmail) return;
    await bootstrap();
  }, [userEmail, bootstrap]);

  const currentCampus = useMemo(
    () => campuses.find((r) => r.name === currentCampusId) || null,
    [campuses, currentCampusId]
  );

  const value = useMemo<CampusContextType>(
    () => ({
      campuses,
      currentCampusId,
      currentCampus,
      loading,
      switching,
      campusVersion,
      switchCampus,
      refreshCampuses,
    }),
    [
      campuses,
      currentCampusId,
      currentCampus,
      loading,
      switching,
      campusVersion,
      switchCampus,
      refreshCampuses,
    ]
  );

  return <CampusContext.Provider value={value}>{children}</CampusContext.Provider>;
};

export const useCampus = (): CampusContextType => {
  const ctx = useContext(CampusContext);
  if (!ctx) throw new Error('useCampus phải được dùng trong CampusProvider');
  return ctx;
};
