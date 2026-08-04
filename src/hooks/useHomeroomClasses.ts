import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import timetableService from '../services/timetableService';
import type { TeacherClassesResponse } from '../services/timetableService';
import {
  allClassesToOptions,
  homeroomClassesToOptions,
  type HomeroomClassOption,
} from '../utils/homeroomClassUtils';

export const STORAGE_SELECTED_CLASS_ACTIVITY_ID = 'class_activity_selected_class_v1';

type State = {
  loading: boolean;
  error: string | null;
  raw: TeacherClassesResponse | null;
  options: HomeroomClassOption[];
  selected: HomeroomClassOption | null;
};

/**
 * Lớp GVCN/phó + lưu lớp đã chọn (AsyncStorage)
 */
export function useHomeroomClasses() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    raw: null,
    options: [],
    selected: null,
  });

  const roles: string[] = Array.isArray(user?.roles) ? (user?.roles as string[]) : [];
  const isBOD = roles.includes('Mobile BOD');

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const email = user?.email;
      const data = await timetableService.getTeacherClasses();

      let options: HomeroomClassOption[] = [];
      if (isBOD) {
        // Mobile BOD: xem tất cả lớp regular của năm học đang enable
        const schoolYearId =
          data?.school_year_id || (await timetableService.getEnabledSchoolYear());
        if (schoolYearId) {
          const allClasses = await timetableService.getAllClasses(schoolYearId);
          options = allClassesToOptions(allClasses, data?.teacher_user_id, email);
        }
      } else {
        if (!data?.teacher_user_id) {
          setState({
            loading: false,
            error: null,
            raw: data,
            options: [],
            selected: null,
          });
          return;
        }
        options = homeroomClassesToOptions(
          data.homeroom_classes || [],
          data.teacher_user_id,
          email
        );
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
        raw: data,
        options,
        selected,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'load_failed';
      setState({
        loading: false,
        error: msg,
        raw: null,
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
    teacherUserId: state.raw?.teacher_user_id,
    /** Mobile BOD — xem tất cả lớp (read-only feed) */
    isBOD,
  };
}
