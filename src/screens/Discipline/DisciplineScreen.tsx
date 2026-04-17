/**
 * Màn hình Kỷ luật - Ghi nhận lỗi
 * Chức năng giống RecordList web: tabs Tất cả lỗi | Lỗi của tôi, search, danh sách card
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import DatePickerModal from '../../components/DatePickerModal';
import disciplineRecordService, {
  type DisciplineRecordItem,
} from '../../services/disciplineRecordService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import { StudentAvatar } from '../../utils/studentAvatar';
import { useAuth } from '../../context/AuthContext';
import {
  hasMobileDisciplineAccess,
  hasDisciplineSupervisoryUiRole,
} from '../../utils/disciplinePermissions';

type TabType = 'all' | 'mine';

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

/** Chuẩn hóa text để search (bỏ dấu) */
const normalizeText = (text: string): string => {
  try {
    const n = text ? text.normalize('NFD').replace(/\p{Diacritic}/gu, '') : '';
    return n.replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D')).toLowerCase();
  } catch {
    return (text || '').toLowerCase();
  }
};

const DisciplineScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
  const canAccessModule = hasMobileDisciplineAccess(roles);
  const canShowAddFab = hasDisciplineSupervisoryUiRole(roles);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tab, setTab] = useState<TabType>('mine');
  const [searchTerm, setSearchTerm] = useState('');
  const [campusId, setCampusId] = useState<string | null>(null);

  const dateStr = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const isToday =
    dateStr ===
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

  // Raw data từ API (chưa lọc ngày/search)
  const [rawItems, setRawItems] = useState<DisciplineRecordItem[]>([]);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const campus = campusId || (await AsyncStorage.getItem('currentCampusId'));
      const response = await disciplineRecordService.getRecords(
        tab === 'mine',
        campus || undefined
      );

      if (response.success && response.data) {
        setRawItems(response.data.data || []);
      } else {
        setRawItems([]);
        setError(response.message || 'Có lỗi xảy ra khi tải dữ liệu');
      }
    } catch (err) {
      console.error('Error loading discipline records:', err);
      setRawItems([]);
      setError('Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, campusId]);

  // Lọc theo ngày và search (client-side)
  const items = useMemo(() => {
    let data = rawItems;
    // Lọc theo ngày
    data = data.filter((item) => {
      if (!item.date) return false;
      const itemDate = item.date.split('T')[0] || item.date.split(' ')[0];
      return itemDate === dateStr;
    });
    // Áp dụng search
    if (searchTerm.trim()) {
      const tokens = normalizeText(searchTerm).split(/\s+/).filter(Boolean);
      data = data.filter((item) => {
        const studentName = normalizeText(item.student_name || '');
        const studentCode = normalizeText(item.student_code || '');
        const classTitles = normalizeText((item.target_class_titles || []).join(' '));
        const violation = normalizeText(item.violation_title || '');
        return tokens.some(
          (t) =>
            studentName.includes(t) ||
            studentCode.includes(t) ||
            classTitles.includes(t) ||
            violation.includes(t)
        );
      });
    }
    return data;
  }, [rawItems, dateStr, searchTerm]);

  useEffect(() => {
    if (!canAccessModule) return;
    setLoading(true);
    loadData();
  }, [loadData, canAccessModule]);

  useFocusEffect(
    useCallback(() => {
      if (!canAccessModule) return;
      AsyncStorage.getItem('currentCampusId').then(setCampusId);
      // Refresh khi quay lại từ Add/Edit
      loadData();
    }, [loadData, canAccessModule])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAddNew = () => {
    if (!canShowAddFab) return;
    navigation.navigate(ROUTES.SCREENS.DISCIPLINE_ADD as any);
  };

  const handleCardPress = (item: DisciplineRecordItem) => {
    navigation.navigate(ROUTES.SCREENS.DISCIPLINE_DETAIL as any, {
      recordId: item.name,
      record: item,
    });
  };

  const renderCard = ({ item }: { item: DisciplineRecordItem }) => {
    return (
      <TouchableOpacity
        onPress={() => handleCardPress(item)}
        activeOpacity={0.7}
        className="mb-3 rounded-xl bg-[#F8F8F8] p-4">
        {/* 1. Đối tượng - Lớp | Học sinh | Mixed - hàng dọc, avatar + tên + lớp từng học sinh */}
        <View className="mb-3">
          {item.target_type === 'mixed' ? (
            <View>
              {(item.target_class_titles || []).length > 0 && (
                <>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Lớp</Text>
                  {(item.target_class_titles || []).map((t, i) => (
                    <Text
                      key={i}
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: '#002855',
                        marginTop: i > 0 ? 4 : 0,
                      }}>
                      • {t}
                    </Text>
                  ))}
                </>
              )}
              {(item.target_students?.length ?? 0) > 0 ? (
                <>
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#666',
                      marginBottom: 4,
                      marginTop: (item.target_class_titles || []).length > 0 ? 8 : 0,
                    }}>
                    Học sinh
                  </Text>
                  {item.target_students!.map((st, i) => (
                    <View
                      key={st.student_id}
                      className="flex-row items-center"
                      style={{ marginTop: i > 0 ? 8 : 0 }}>
                      <StudentAvatar
                        name={st.student_name}
                        avatarUrl={st.student_photo_url || undefined}
                        size={36}
                      />
                      <View className="ml-2 flex-1">
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#002855' }}>
                          {st.student_name || st.student_code || '-'}
                        </Text>
                        {st.student_class_title ? (
                          <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                            {st.student_class_title}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </>
              ) : item.student_name ? (
                <>
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#666',
                      marginBottom: 4,
                      marginTop: (item.target_class_titles || []).length > 0 ? 8 : 0,
                    }}>
                    Học sinh
                  </Text>
                  {item.student_name
                    .split(', ')
                    .filter(Boolean)
                    .map((name, i) => (
                      <Text
                        key={i}
                        style={{
                          fontSize: 15,
                          fontWeight: '600',
                          color: '#002855',
                          marginTop: i > 0 ? 4 : 0,
                        }}>
                        • {name.trim()}
                      </Text>
                    ))}
                </>
              ) : null}
              {!item.student_name &&
                !item.target_students?.length &&
                (item.target_class_titles || []).length === 0 && (
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#002855' }}>-</Text>
                )}
            </View>
          ) : item.target_type === 'student' ? (
            (item.target_students?.length ?? 0) > 0 ? (
              <View>
                {item.target_students!.map((st, i) => (
                  <View
                    key={st.student_id}
                    className="flex-row items-center"
                    style={{ marginTop: i > 0 ? 8 : 0 }}>
                    <StudentAvatar
                      name={st.student_name}
                      avatarUrl={st.student_photo_url || undefined}
                      size={44}
                    />
                    <View className="ml-2 flex-1">
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#002855' }}>
                        {st.student_name || st.student_code || '-'}
                      </Text>
                      {st.student_class_title ? (
                        <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                          {st.student_class_title}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="flex-row items-center">
                <StudentAvatar
                  name={item.student_name}
                  avatarUrl={item.student_photo_url || undefined}
                  size={40}
                />
                <View className="ml-3 flex-1">
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#002855' }}>
                    {item.student_name || item.student_code || '-'}
                  </Text>
                  {item.student_class_title ? (
                    <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                      {item.student_class_title}
                    </Text>
                  ) : null}
                </View>
              </View>
            )
          ) : (
            <View>
              {(item.target_class_titles || []).map((t, i) => (
                <Text
                  key={i}
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: '#002855',
                    marginTop: i > 0 ? 6 : 0,
                  }}>
                  • {t}
                </Text>
              ))}
              {(item.target_class_titles || []).length === 0 && (
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#002855' }}>-</Text>
              )}
            </View>
          )}
        </View>

        {/* 2. Vi phạm */}
        <View className="mb-3">
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#002855' }}>
            {item.violation_title || '-'}
          </Text>
        </View>

        {/* 3. Ghi nhận vào <tiết> lúc <thời gian> - dùng time_slot_title như DetailScreen */}
        {(item.time_slot_title || item.time_slot || item.record_time) && (
          <Text style={{ fontSize: 13, color: '#666' }}>
            Ghi nhận vào {item.time_slot_title || item.time_slot || '-'} lúc{' '}
            {item.record_time || '-'}
          </Text>
        )}

        <Text style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
          Cập nhật bởi: {normalizeVietnameseName(item.owner_name || '') || '-'}
        </Text>
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

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
      edges={['top']}>
      <View className="flex-1">
        {/* Header - giống Ticket */}
        <View className="flex-row items-center px-4 py-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="-ml-2 mr-1 items-center justify-center p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#002855" />
          </TouchableOpacity>
          <View className="flex-1 items-center justify-center">
            <Text className="text-xl font-bold text-[#002855]">Ghi nhận lỗi</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Date Selector - giống Sức khoẻ */}
        <View className="mb-3 px-4">
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
            className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
            <View className="flex-row items-center">
              <Ionicons name="calendar-outline" size={20} color="#002855" />
              <Text
                className={`ml-2 text-base font-semibold ${isToday ? 'text-[#F05023]' : 'text-[#002855]'}`}>
                {isToday
                  ? 'Hôm nay'
                  : `${selectedDate.getDate()}/${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Tabs - giống Sức khoẻ (border-bottom style) */}
        <View className="mb-2 flex-row border-b border-gray-200 px-4">
          <TouchableOpacity
            onPress={() => setTab('all')}
            className={`flex-1 items-center border-b-2 py-3 ${
              tab === 'all' ? 'border-[#002855]' : 'border-transparent'
            }`}>
            <Text
              className={`text-base font-semibold ${tab === 'all' ? 'text-[#002855]' : 'text-gray-500'}`}>
              Tất cả lỗi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('mine')}
            className={`flex-1 items-center border-b-2 py-3 ${
              tab === 'mine' ? 'border-[#002855]' : 'border-transparent'
            }`}>
            <Text
              className={`text-base font-semibold ${tab === 'mine' ? 'text-[#002855]' : 'text-gray-500'}`}>
              Lỗi của tôi
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search - giống Ticket */}
        <View className="px-4 py-2">
          <View className="flex-row items-center rounded-2xl bg-gray-100 px-3 py-2">
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              placeholder="Nhập để tìm kiếm thông tin"
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

        {/* Nội dung: error / loading / empty / list */}
        {error ? (
          <View className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="text-red-700">{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#002855" />
            <Text className="mt-4 text-gray-500">Đang tải dữ liệu...</Text>
          </View>
        ) : items.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <MaterialIcons name="shield" size={64} color="#D1D5DB" />
            <Text className="mt-4 text-center text-base font-medium text-gray-500">
              {searchTerm ? 'Không tìm thấy dữ liệu phù hợp' : 'Chưa có dữ liệu ghi nhận lỗi'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.name}
            renderItem={renderCard}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#002855']}
              />
            }
          />
        )}

        {/* FAB: chỉ SIS Supervisory / SIS Supervisory Admin (giống web) */}
        {canShowAddFab ? (
          <TouchableOpacity
            onPress={handleAddNew}
            className="absolute bottom-[10%] right-[5%] h-14 w-14 items-center justify-center rounded-full bg-[#F05023] shadow-lg">
            <Ionicons name="add" size={30} color="white" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        value={selectedDate}
        onSelect={(date) => setSelectedDate(date)}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
};

export default DisciplineScreen;
