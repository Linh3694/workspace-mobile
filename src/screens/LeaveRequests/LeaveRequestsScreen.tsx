// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/constants';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import attendanceService from '../../services/attendanceService';

type LeaveRequestsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.SCREENS.LEAVE_REQUESTS
>;

const Card = ({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
}) => (
  <TouchableOpacity onPress={onPress} className="mb-3 w-full">
    <View className="rounded-2xl bg-[#F6F6F6] p-4">
      <Text className="mb-1 text-lg font-semibold text-[#3F4246]">{title}</Text>
      {!!subtitle && <Text className="text-sm text-[#757575]">{subtitle}</Text>}
    </View>
  </TouchableOpacity>
);

const LeaveRequestsScreen = () => {
  const navigation = useNavigation<LeaveRequestsNavigationProp>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [classTitles, setClassTitles] = useState<Record<string, string>>({});

  // Get class IDs where teacher is homeroom or vice homeroom teacher
  const [homeroomClasses, setHomeroomClasses] = useState<string[]>([]);
  const [viceClasses, setViceClasses] = useState<string[]>([]);

  const loadTeacherClasses = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[LeaveRequests] Loading teacher classes...');

      // First, try to sync fresh data from backend
      if (user?.email) {
        try {
          console.log('[LeaveRequests] Syncing teacher assignments from backend...');

          let assigns = await attendanceService.fetchTeacherClassAssignments(user.email);

          if (!assigns) {
            console.log('[LeaveRequests] Trying syncTeacherAssignmentsLikeWeb...');
            assigns = await attendanceService.syncTeacherAssignmentsLikeWeb(user.email || user._id);
          }

          if (assigns) {
            const homeroom = assigns.homeroom_class_ids || [];
            const vice = assigns.vice_homeroom_class_ids || [];

            console.log('[LeaveRequests] Synced assignments:', { homeroom, vice });

            await AsyncStorage.setItem('teacherHomeroomClassIds', JSON.stringify(homeroom));
            await AsyncStorage.setItem('teacherViceHomeroomClassIds', JSON.stringify(vice));

            setHomeroomClasses(homeroom);
            setViceClasses(vice);
            setLoading(false);
            return;
          }
        } catch (syncError) {
          console.error('[LeaveRequests] Failed to sync teacher assignments:', syncError);
        }
      }

      // Fallback: Load from AsyncStorage
      console.log('[LeaveRequests] Falling back to AsyncStorage...');
      const homeroomStr = await AsyncStorage.getItem('teacherHomeroomClassIds');
      const viceStr = await AsyncStorage.getItem('teacherViceHomeroomClassIds');

      const homeroom = homeroomStr ? JSON.parse(homeroomStr) : [];
      const vice = viceStr ? JSON.parse(viceStr) : [];

      console.log('[LeaveRequests] Loaded from AsyncStorage:', { homeroom, vice });

      setHomeroomClasses(homeroom);
      setViceClasses(vice);
    } catch (error) {
      console.error('[LeaveRequests] Error loading teacher classes:', error);
      setHomeroomClasses([]);
      setViceClasses([]);
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?._id]);

  // Load teacher classes when component mounts
  useEffect(() => {
    loadTeacherClasses();
  }, [loadTeacherClasses]);

  // Combine homeroom and vice classes
  const teacherClasses = useMemo(() => {
    return Array.from(new Set([...homeroomClasses, ...viceClasses]));
  }, [homeroomClasses, viceClasses]);

  // Load class titles for display
  useEffect(() => {
    (async () => {
      try {
        if (teacherClasses.length === 0) return;

        console.log('[LeaveRequests] Fetching titles for', teacherClasses.length, 'classes');

        const token = await AsyncStorage.getItem('authToken');
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        const map: Record<string, string> = {};

        for (const classId of teacherClasses) {
          try {
            const res = await fetch(
              `${API_BASE_URL}/api/method/erp.api.erp_sis.sis_class.get_class?name=${encodeURIComponent(classId)}`,
              { headers }
            );

            if (!res.ok) {
              map[classId] = classId.replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
              continue;
            }

            const json = await res.json();
            const cls = json?.message?.data || json?.data;

            if (cls) {
              const title =
                cls.short_title ||
                cls.title ||
                cls.class_name ||
                classId.replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
              map[classId] = title;
            } else {
              map[classId] = classId.replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
            }
          } catch (err) {
            map[classId] = classId.replace(/^SIS-CLASS-/, '').replace(/^CLASS-/, '');
          }
        }

        setClassTitles(map);
      } catch (e) {
        console.error('[LeaveRequests] Failed to fetch class titles:', e);
      }
    })();
  }, [teacherClasses]);

  // Get display title for a class
  const getClassTitle = (classId: string): string => {
    if (classTitles[classId]) return classTitles[classId];
    return String(classId)
      .replace(/^SIS-CLASS-/, '')
      .replace(/^CLASS-/, '');
  };

  // Handle opening a specific class - navigate to detail screen
  const handleOpenClass = (classId: string) => {
    navigation.navigate(ROUTES.SCREENS.LEAVE_REQUESTS_DETAIL, {
      classId,
      classTitle: `Lớp ${getClassTitle(classId)}`,
    });
  };

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadTeacherClasses();
    }, [loadTeacherClasses])
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#000" />
          <Text className="mt-3 text-sm text-gray-400">Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-4">
        <View className="mb-4 flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: -8,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color="#0A2240" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-2xl font-bold text-[#0A2240]">Đơn từ</Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      {/* Class selection view - show grid of classes */}
      <ScrollView className="flex-1">
        {teacherClasses.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <MaterialIcons name="class" size={64} color="#D1D5DB" />
            <Text className="mt-4 text-lg font-medium text-gray-900">Không có lớp chủ nhiệm</Text>
            <Text className="mt-2 text-center text-gray-500">
              Bạn chưa được phân công làm giáo viên chủ nhiệm lớp nào.
            </Text>
          </View>
        ) : (
          <View className="mt-[5%] flex-row flex-wrap justify-between gap-y-3 px-5">
            {teacherClasses.map((cls) => (
              <View key={cls} style={{ width: '48%' }}>
                <Card
                  title={`Lớp ${getClassTitle(cls)}`}
                  subtitle="Chủ nhiệm"
                  onPress={() => handleOpenClass(cls)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default LeaveRequestsScreen;
