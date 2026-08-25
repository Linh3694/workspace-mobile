/**
 * Màn hình Sự vụ kỷ luật — danh sách sự vụ sinh tự động khi học sinh chạm ngưỡng
 * điểm trừ trong tháng. Chức năng giống DisciplineCaseListV2 của web: search, lọc
 * trạng thái + tháng, mở chi tiết để xử lý.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { StudentAvatar } from '../../utils/studentAvatar';
import { useAuth } from '../../context/AuthContext';
import { hasMobileDisciplineAccess } from '../../utils/disciplinePermissions';
import disciplineCaseService, {
  DISCIPLINE_CASE_STATUSES,
  type DisciplineCaseItem,
} from '../../services/disciplineCaseService';
import { fmtMonthKey, resolveCaseStatusTone } from './caseFormat';

/** Chuẩn hóa text để search (bỏ dấu) */
const normalizeText = (text: string): string => {
  try {
    const n = text ? text.normalize('NFD').replace(/\p{Diacritic}/gu, '') : '';
    return n.replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D')).toLowerCase();
  } catch {
    return (text || '').toLowerCase();
  }
};

const DisciplineCaseListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
  const canAccessModule = hasMobileDisciplineAccess(roles);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<DisciplineCaseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [campusId, setCampusId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const campus = campusId || (await AsyncStorage.getItem('currentCampusId'));
      const res = await disciplineCaseService.list({ campus: campus || undefined });
      if (res.success && res.data) {
        setItems(res.data.data || []);
      } else {
        setItems([]);
        setError(res.message || 'Không tải được danh sách sự vụ');
      }
    } catch (err) {
      console.error('Error loading discipline cases:', err);
      setItems([]);
      setError('Không tải được danh sách sự vụ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campusId]);

  useEffect(() => {
    if (!canAccessModule) return;
    setLoading(true);
    loadData();
  }, [loadData, canAccessModule]);

  useFocusEffect(
    useCallback(() => {
      if (!canAccessModule) return;
      AsyncStorage.getItem('currentCampusId').then(setCampusId);
      // Refresh khi quay lại từ màn chi tiết (trạng thái có thể vừa đổi)
      loadData();
    }, [loadData, canAccessModule])
  );

  /** Tháng suy từ chính dữ liệu — chỉ hiện tháng thật sự có sự vụ, mới nhất lên đầu */
  const monthOptions = useMemo(() => {
    const keys = [...new Set(items.map((r) => r.month_key).filter(Boolean))].sort().reverse();
    return [{ value: 'all', label: 'Tất cả tháng' }, ...keys.map((k) => ({ value: k, label: fmtMonthKey(k) }))];
  }, [items]);

  const filtered = useMemo(() => {
    let rows = items;
    if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter);
    if (monthFilter !== 'all') rows = rows.filter((r) => r.month_key === monthFilter);
    const q = searchTerm.trim();
    if (!q) return rows;
    const tokens = normalizeText(q).split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      const hay = normalizeText(
        [r.student_name, r.student_code, r.case_code, r.handler_role_label, r.month_key]
          .filter(Boolean)
          .join(' ')
      );
      return tokens.every((tk) => hay.includes(tk));
    });
  }, [items, statusFilter, monthFilter, searchTerm]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openDetail = (item: DisciplineCaseItem) => {
    navigation.navigate(ROUTES.SCREENS.DISCIPLINE_CASE_DETAIL as any, { caseId: item.name });
  };

  const renderCard = ({ item }: { item: DisciplineCaseItem }) => {
    const tone = resolveCaseStatusTone(item.status);
    return (
      <TouchableOpacity
        onPress={() => openDetail(item)}
        activeOpacity={0.7}
        className="mb-3 rounded-xl bg-[#F8F8F8] p-4">
        <View className="flex-row items-center">
          <StudentAvatar
            name={item.student_name}
            avatarUrl={item.student_photo_url || undefined}
            size={44}
          />
          <View className="ml-3 flex-1">
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#002855' }} numberOfLines={1}>
              {item.student_name || item.student_id}
            </Text>
            <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }} numberOfLines={1}>
              {[item.student_code, item.case_code].filter(Boolean).join(' · ') || '-'}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: tone.bg,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: tone.text }}>{item.status}</Text>
          </View>
        </View>

        <View className="mt-3 flex-row flex-wrap items-center">
          <Text style={{ fontSize: 13, color: '#374151' }}>
            Tháng {fmtMonthKey(item.month_key)}
          </Text>
          <Text style={{ fontSize: 13, color: '#9CA3AF' }}> · </Text>
          <Text style={{ fontSize: 13, color: '#374151' }} numberOfLines={1}>
            {item.handler_role_label || '-'}
          </Text>
        </View>

        <View className="mt-2 flex-row items-center justify-between">
          <Text style={{ fontSize: 13, color: '#374151' }}>
            Điểm trừ trong tháng:{' '}
            <Text style={{ fontWeight: '700', color: '#DC2626' }}>{item.trigger_points ?? 0}</Text>
          </Text>
          {item.recovery_granted ? (
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={16} color="#15803D" />
              <Text style={{ fontSize: 12, color: '#15803D', marginLeft: 4, fontWeight: '600' }}>
                Đã duyệt phục hồi
              </Text>
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Chưa duyệt phục hồi</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!canAccessModule) {
    return (
      <SafeAreaView
        className="flex-1 bg-white"
        style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
        edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <MaterialIcons name="lock-outline" size={56} color="#D1D5DB" />
          <Text className="mt-4 text-center text-base font-medium text-gray-600">
            Bạn cần quyền Mobile Supervisory để truy cập Kỷ luật trên ứng dụng.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-6 rounded-xl bg-[#002855] px-6 py-3">
            <Text className="text-base font-semibold text-white">Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusChips = [{ value: 'all', label: 'Tất cả trạng thái' }, ...DISCIPLINE_CASE_STATUSES.map((s) => ({ value: s, label: s }))];

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
      edges={['top']}>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="-ml-2 mr-1 items-center justify-center p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#002855" />
          </TouchableOpacity>
          <View className="flex-1 items-center justify-center">
            <Text className="text-xl font-bold text-[#002855]">Sự vụ kỷ luật</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Lọc trạng thái */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          style={{ maxHeight: 44 }}>
          {statusChips.map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setStatusFilter(opt.value)}
                className={`rounded-full border px-3 py-2 ${
                  active ? 'border-[#002855] bg-[#E8EDF3]' : 'border-gray-200 bg-white'
                }`}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: active ? '#002855' : '#6B7280',
                  }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Lọc tháng — chỉ hiện khi có nhiều hơn một tháng */}
        {monthOptions.length > 2 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            style={{ maxHeight: 44, marginTop: 6 }}>
            {monthOptions.map((opt) => {
              const active = monthFilter === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setMonthFilter(opt.value)}
                  className={`rounded-full border px-3 py-2 ${
                    active ? 'border-[#002855] bg-[#E8EDF3]' : 'border-gray-200 bg-white'
                  }`}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: active ? '#002855' : '#6B7280',
                    }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Search */}
        <View className="px-4 py-2">
          <View className="flex-row items-center rounded-2xl bg-gray-100 px-3 py-2">
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              placeholder="Tìm học sinh, mã sự vụ"
              className="ml-2 flex-1 text-base text-gray-800"
              value={searchTerm}
              onChangeText={setSearchTerm}
              returnKeyType="search"
            />
            {searchTerm ? (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {error ? (
          <View className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="text-red-700">{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#002855" />
            <Text className="mt-4 text-gray-500">Đang tải sự vụ...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <MaterialIcons name="gavel" size={64} color="#D1D5DB" />
            <Text className="mt-4 text-center text-base font-medium text-gray-500">
              {searchTerm || statusFilter !== 'all' || monthFilter !== 'all'
                ? 'Không tìm thấy sự vụ phù hợp'
                : 'Chưa có sự vụ nào'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.name}
            renderItem={renderCard}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#002855']}
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default DisciplineCaseListScreen;
