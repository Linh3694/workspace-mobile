import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import classNewsfeedService from '../services/classNewsfeedService';
import timetableService from '../services/timetableService';
import {
  allClassesToOptions,
  newsfeedClassesToOptions,
  type HomeroomClassOption,
} from '../utils/homeroomClassUtils';

export const STORAGE_SELECTED_CLASS_ACTIVITY_ID = 'class_activity_selected_class_v1';

type State = {
  loading: boolean;
  error: string | null;
  options: HomeroomClassOption[];
  selected: HomeroomClassOption | null;
};

/**
 * Lớp được đăng bài bảng tin + lưu lớp đã chọn (AsyncStorage).
 *
 * Gồm lớp GVCN/phó VÀ lớp mà GVCN đã cấp quyền đăng bài cho GV bộ môn — trước đây
 * hook này chỉ đọc lớp chủ nhiệm nên GV bộ môn được cấp quyền vẫn không đăng được.
 * Mobile BOD: xem tất cả lớp regular (read-only nếu không phải GVCN/phó).
 */
export function useNewsfeedClasses() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    options: [],
    selected: null,
  });

  const roles: string[] = Array.isArray(user?.roles) ? (user?.roles as string[]) : [];
  const isBOD = roles.includes('Mobile BOD');

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const email = user?.email;
      let options: HomeroomClassOption[] = [];

      if (isBOD) {
        // Mobile BOD: xem tất cả lớp regular của năm học đang enable
        const data = await timetableService.getTeacherClasses();
        const schoolYearId =
          data?.school_year_id || (await timetableService.getEnabledSchoolYear());
        if (schoolYearId) {
          const allClasses = await timetableService.getAllClasses(schoolYearId);
          options = allClassesToOptions(allClasses, data?.teacher_user_id, email);
        }
      } else {
        const classes = await classNewsfeedService.getMyNewsfeedClasses(email);
        options = newsfeedClassesToOptions(classes);
      }

      let selected: HomeroomClassOption | null = null;
      const savedId = await AsyncStorage.getItem(STORAGE_SELECTED_CLASS_ACTIVITY_ID);
      if (savedId) {
        selected = options.find((o) => o.id === savedId) || null;
      }
      if (!selected && options.length > 0) {
        selected = options[0];
      }
      if (selected) {
        await AsyncStorage.setItem(STORAGE_SELECTED_CLASS_ACTIVITY_ID, selected.id);
      }

      setState({
        loading: false,
        error: null,
        options,
        selected,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'load_failed';
      setState({
        loading: false,
        error: msg,
        options: [],
        selected: null,
      });
    }
  }, [user?.email, isBOD]);

  useEffect(() => {
    void load();
  }, [load]);

  const setSelected = useCallback(async (opt: HomeroomClassOption) => {
    await AsyncStorage.setItem(STORAGE_SELECTED_CLASS_ACTIVITY_ID, opt.id);
    setState((s) => ({ ...s, selected: opt }));
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    options: state.options,
    selected: state.selected,
    reload: load,
    setSelected,
    /** Mobile BOD — xem tất cả lớp (read-only feed nếu không phải GVCN/phó) */
    isBOD,
  };
}
