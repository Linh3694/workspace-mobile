// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Image, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StudentAvatar } from '../../utils/studentAvatar';
import { getApiBaseUrl, API_BASE_URL } from '../../config/constants';
import attendanceService from '../../services/attendanceService';

// Attendance status type aligned with web
type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

const statusLabel: Record<AttendanceStatus, string> = {
  present: 'Có mặt',
  absent: 'Vắng không phép',
  late: 'Muộn',
  excused: 'Vắng có phép',
};

const cardBgByStatus: Record<AttendanceStatus, string> = {
  present: '#F6FCE5',
  absent: '#FEF6F4',
  late: '#FFFCF2',
  excused: '#f6f6f6',
};

const AttendanceDetail = () => {
  const nav = useNavigation<any>();
  const route = useRoute();
  const { classId, mode } = route.params as { classId: string; mode: 'GVCN' | 'GVBM' };

  const [students, setStudents] = useState<any[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classTitle, setClassTitle] = useState<string>('');

  const apiBase = getApiBaseUrl();

  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const period = mode === 'GVCN' ? 'GVCN' : undefined; // GVBM: sẽ chọn theo tiết sau (roadmap)

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Resolve class title for header
      let schoolYearId: string | undefined;
      try {
        const cls = await attendanceService.getAllClassesForCurrentCampus();
        const hit = Array.isArray(cls) ? cls.find((c: any) => String(c?.name) === String(classId)) : null;
        if (hit) {
          setClassTitle(hit.title || hit.short_title || String(classId));
          schoolYearId = String(hit.school_year_id || '');
        }
      } catch {}

      // 1) Lấy danh sách học sinh của lớp qua get_all_class_students
      const qs = new URLSearchParams({ page: '1', limit: '1000', class_id: String(classId) });
      const res = await fetch(`${apiBase}/api/method/erp.api.erp_sis.class_student.get_all_class_students?${qs.toString()}`, { headers });
      const data = await res.json();
      const rows = (data?.data?.data || data?.message?.data || []).map((r: any) => r.student_id).filter(Boolean);

      // 2) Map thành student objects (chỉ thông tin cần thiết) và gắn ảnh từ SIS Photo nếu có
      const arr: any[] = [];
      const fetchPhotoUrl = async (studentId: string): Promise<string | null> => {
        try {
          const qs = new URLSearchParams({ photo_type: 'student', student_id: String(studentId), page: '1', limit: '10' });
          if (schoolYearId) qs.set('school_year_id', schoolYearId);
          const resp = await fetch(`${apiBase}/api/method/erp.sis.doctype.sis_photo.sis_photo.get_photos_list?${qs.toString()}`, { headers });
          const json = await resp.json();
          let list = (json?.message?.data || json?.data?.data || json?.data || []) as any[];
          if (!Array.isArray(list)) list = [];
          // Prefer Active and latest upload_date
          const normId = String(studentId).toLowerCase();
          list = list
            .filter((x) => (x?.type || '').toLowerCase() === 'student' && (!x?.status || String(x.status).toLowerCase() === 'active'))
            // Some BE versions ignore student_id filter → filter FE by exact CRM id
            .filter((x) => String(x?.student_id || '').toLowerCase() === normId)
            .sort((a, b) => String(b?.upload_date || '').localeCompare(String(a?.upload_date || '')));
          const top = list[0];
          const path = top?.photo || top?.file_url;
          if (path) {
            const url = String(path);
            return url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
          }
          return null;
        } catch {
          return null;
        }
      };

      for (const sid of rows) {
        try {
          const stuRes = await fetch(`${apiBase}/api/method/erp.api.erp_sis.student.get_student_data?student_id=${encodeURIComponent(String(sid))}`, { headers });
          const stu = await stuRes.json();
          const s = (stu?.message?.data || stu?.data || {}) as any;
          if (s && s.name) {
            // Attach CRM student id from class_student row (authoritative for SIS Photo)
            const crmId = String(sid);
            s.crm_student_id = crmId;
            if (!s.avatar_url && !s.user_image && !s.photo) {
              const p = await fetchPhotoUrl(crmId);
              if (p) s.avatar_url = p;
            }
            arr.push(s);
          }
        } catch {}
      }
      setStudents(arr);

      // 3) Lấy trạng thái điểm danh đã lưu
      const p = period || '1'; // tạm thời nếu GVBM chưa chọn, dùng '1' để không rỗng
      const attUrl = `${apiBase}/api/method/erp.api.erp_sis.attendance.get_class_attendance?class_id=${encodeURIComponent(String(classId))}&date=${encodeURIComponent(today)}&period=${encodeURIComponent(p)}`;
      const attRes = await fetch(attUrl, { headers });
      const attData = await attRes.json();
      const list = attData?.message?.data || attData?.data || [];
      const map: Record<string, AttendanceStatus> = {};
      (list || []).forEach((i: any) => {
        if (i.student_id && i.status) map[i.student_id] = (i.status as AttendanceStatus) || 'present';
      });
      setStatusMap(map);
    } catch (e) {
      setStudents([]);
      setStatusMap({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [classId, period, today]);

  const setStatus = (id: string, status: AttendanceStatus) => {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const items = students.map((s) => ({
        student_id: s.name,
        student_code: s.student_code,
        student_name: s.student_name,
        class_id: String(classId),
        date: today,
        period: period || '1',
        status: statusMap[s.name] || 'present',
      }));
      const res = await fetch(`${apiBase}/api/method/erp.api.erp_sis.attendance.save_class_attendance`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ items, overwrite: true }),
      });
      const result = await res.json();
      if (res.ok && (result?.success || result?.message)) {
        Alert.alert('Thành công', 'Đã lưu điểm danh');
      } else {
        Alert.alert('Lỗi', result?.message || 'Không thể lưu điểm danh');
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể lưu điểm danh');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 py-3">
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#0A2240" />
        </TouchableOpacity>
        <Text className="font-bold text-2xl text-[#0A2240]">Điểm danh</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#009483" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-[#0A2240]">Lớp {classTitle || String(classId)}</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className={`rounded-md ${saving ? 'bg-[#D1D5DB]' : 'bg-[#3F4246]'} px-4 py-2`}>
              <Text className="font-semibold text-white">{saving ? 'Đang lưu...' : 'Cập nhật'}</Text>
            </TouchableOpacity>
          </View>

          <View className="flex justify-between">
            {students.map((s) => {
              const st = statusMap[s.name] || 'present';
              return (
                <View
                  key={s.name}
                  className="mb-3 w-[95%] mx-auto rounded-2xl"
                  style={{ backgroundColor: cardBgByStatus[st] }}>
                  <View className="flex-row items-center justify-between pr-0">
                    <View className="flex-row items-center gap-4 pl-10">
                      <View className="mr-2 items-center">
                        <StudentAvatar
                          name={s.student_name}
                          avatarUrl={(s as any).avatar_url || (s as any).user_image || (s as any).photo}
                          size={100}
                        />
                        <View className="items-center mt-2">
                          <Text className="text-lg font-semibold text-[#000]">{s.student_name}</Text>
                          <Text className="text-md text-[#7A7A7A]">{statusLabel[st]}</Text>
                        </View>
                      </View>
                    </View>
                    <View className="flex-col">
                      <TouchableOpacity
                        onPress={() => setStatus(s.name, 'present')}
                        style={{
                          width: 52,
                          height: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: st === 'present' ? '#3DB838' : '#EBEBEB',
                          borderTopRightRadius: 8,
                        }}>
                        <Ionicons name="checkmark" size={22} color={st === 'present' ? '#fff' : '#3F4246'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setStatus(s.name, 'absent')}
                        style={{
                          width: 52,
                          height: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: st === 'absent' ? '#DC0909' : '#EBEBEB',
                        }}>
                        <Ionicons name="close" size={22} color={st === 'absent' ? '#fff' : '#3F4246'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setStatus(s.name, 'late')}
                        style={{
                          width: 52,
                          height: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: st === 'late' ? '#F5AA1E' : '#EBEBEB',
                        }}>
                        <Ionicons name="time" size={20} color={st === 'late' ? '#fff' : '#3F4246'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setStatus(s.name, 'excused')}
                        style={{
                          width: 52,
                          height: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: st === 'excused' ? '#3F4246' : '#EBEBEB',
                          borderBottomRightRadius: 8,
                        }}>
                        <Ionicons name="close-circle" size={20} color={st === 'excused' ? '#fff' : '#3F4246'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default AttendanceDetail;
