import React, { useMemo } from 'react';
// @ts-ignore
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { LinearGradient } from 'expo-linear-gradient';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import attendanceService from '../../services/attendanceService';
import { Ionicons } from '@expo/vector-icons';

const TabHeader = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
  <View className="flex-1 items-center">
    <TouchableOpacity onPress={onPress}>
      <Text className={`text-center ${active ? 'font-bold text-[#002855]' : 'text-gray-500'}`}>{label}</Text>
      {active && <View className="mt-2 h-0.5 bg-[#002855]" />}
    </TouchableOpacity>
  </View>
);

const Card = ({ title, onPress, subtitle }: { title: string; subtitle?: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} className="mb-3 w-full">
    <View className="rounded-2xl bg-[#F6F6F6] p-4">
      <Text className="mb-1 font-semibold text-lg text-[#3F4246]">{title}</Text>
      {!!subtitle && <Text className="text-sm text-[#757575]">{subtitle}</Text>}
    </View>
  </TouchableOpacity>
);

const useTeacherInfo = (reload?: any) => {
  const [homeroom, setHomeroom] = React.useState<string[]>([]);
  const [vice, setVice] = React.useState<string[]>([]);
  const [teaching, setTeaching] = React.useState<string[]>([]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const h = await AsyncStorage.getItem('teacherHomeroomClassIds');
        const v = await AsyncStorage.getItem('teacherViceHomeroomClassIds');
        const t = await AsyncStorage.getItem('teacherTeachingClassIds');
        setHomeroom(h ? JSON.parse(h) : []);
        setVice(v ? JSON.parse(v) : []);
        setTeaching(t ? JSON.parse(t) : []);
      } catch {}
    };
    load();
  }, [reload]);

  return { homeroom, vice, teaching };
};

const AttendanceHome = () => {
  const nav = useNavigation<any>();
  const { refreshUserData, user } = useAuth();
  const isFocused = useIsFocused();
  const [reloadKey, setReloadKey] = React.useState(0);
  const { homeroom, vice, teaching } = useTeacherInfo(`${isFocused}-${reloadKey}`);
  const [tab, setTab] = React.useState<'GVCN' | 'GVBM'>('GVCN');

  React.useEffect(() => {
    // Đồng bộ khi mở màn hoặc khi chưa có dữ liệu
    (async () => {
      try {
        if (!isFocused) return;
        if (!user?.email) {
          console.log('[AttendanceHome] Missing user.email → refreshing user data');
          await refreshUserData();
          return;
        }
        const campusId = await AsyncStorage.getItem('currentCampusId');
        const selectedCampus = await AsyncStorage.getItem('selectedCampus');
        console.log('[AttendanceHome] Before refresh, storage sets:', { homeroom, vice, teaching, campusId, selectedCampus, userEmail: user?.email });
        // Gọi API assignments trực tiếp để lấy realtime
        let assigns = await attendanceService.fetchTeacherClassAssignments(user.email);
        if (!assigns) {
          assigns = await attendanceService.syncTeacherAssignmentsLikeWeb(user.email || user._id);
        }
        if (assigns) {
          await AsyncStorage.setItem('teacherHomeroomClassIds', JSON.stringify(assigns.homeroom_class_ids || []));
          await AsyncStorage.setItem('teacherViceHomeroomClassIds', JSON.stringify(assigns.vice_homeroom_class_ids || []));
          await AsyncStorage.setItem('teacherTeachingClassIds', JSON.stringify(assigns.teaching_class_ids || []));
          console.log('[AttendanceHome] Assignments saved:', assigns);
        } else {
          // Fallback: refreshUserData để BE trả teacher_info qua get_current_user
          await refreshUserData();
        }
        // trigger reload AsyncStorage
        setReloadKey((k) => k + 1);
      } catch {}
    })();
  }, [isFocused, user?.email]);

  React.useEffect(() => {
    console.log('[AttendanceHome] After refresh, storage sets:', {
      homeroomCount: homeroom?.length || 0,
      viceCount: vice?.length || 0,
      teachingCount: teaching?.length || 0,
      homeroomPreview: homeroom?.slice(0, 5),
      vicePreview: vice?.slice(0, 5),
      teachingPreview: teaching?.slice(0, 5),
    });
  }, [homeroom, vice, teaching]);

  const gvcnClasses = useMemo(() => Array.from(new Set([...(homeroom || []), ...(vice || [])])), [homeroom, vice]);
  const gvbmClasses = useMemo(() => Array.from(new Set(teaching || [])), [teaching]);
  const [classTitles, setClassTitles] = React.useState<Record<string, string>>({});

  // Map class id -> title for display
  React.useEffect(() => {
    (async () => {
      try {
        const ids = Array.from(new Set([...(homeroom || []), ...(vice || []), ...(teaching || [])]));
        if (ids.length === 0) return;
        const rows = await attendanceService.getAllClassesForCurrentCampus();
        const map: Record<string, string> = {};
        rows.forEach((c: any) => {
          const name = String(c?.name || '');
          if (name) map[name] = c?.title || c?.short_title || name.replace('SIS-CLASS-', '');
        });
        setClassTitles(map);
      } catch {}
    })();
  }, [homeroom, vice, teaching]);

  const list = tab === 'GVCN' ? gvcnClasses : gvbmClasses;

  const handleOpen = (classId: string) => {
    nav.navigate(ROUTES.SCREENS.ATTENDANCE_DETAIL, {
      classId,
      mode: tab, // 'GVCN' or 'GVBM'
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1">
        <View className="px-5 pt-6">
          {/* Header with back button and centered title */}
          <View className="mb-5 flex-row items-center justify-between">
            <TouchableOpacity onPress={() => nav.goBack()} className="p-2 pr-4 -ml-2">
              <Ionicons name="chevron-back" size={24} color="#0A2240" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-[#0A2240] text-center flex-1 -ml-8">Điểm danh</Text>
            <View style={{ width: 24 }} />
          </View>
          {/* Tabs styled like Ticket */}
          <View className="flex-row pb-3 pt-1">
            <TabHeader active={tab === 'GVCN'} label="Chủ nhiệm" onPress={() => setTab('GVCN')} />
            <TabHeader active={tab === 'GVBM'} label="Giảng dạy" onPress={() => setTab('GVBM')} />
          </View>

          {list.length === 0 ? (
            <Text className="mt-10 text-center text-gray-500">Không có lớp phù hợp</Text>
          ) : (
            <View className="flex-row flex-wrap justify-between gap-y-3 mt-[5%]">
              {list.map((cls) => (
                <View key={cls} style={{ width: '48%' }}>
                  <Card
                    title={`Lớp ${classTitles[String(cls)] || String(cls).replace('SIS-CLASS-', '')}`}
                    subtitle={tab === 'GVCN' ? 'Chủ nhiệm' : 'Giảng dạy'}
                    onPress={() => handleOpen(cls)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AttendanceHome;
