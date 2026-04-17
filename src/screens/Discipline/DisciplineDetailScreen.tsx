/**
 * Màn hình Chi tiết ghi nhận lỗi
 * Hiển thị đầy đủ thông tin, có nút Cập nhật để chuyển sang trang chỉnh sửa
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import disciplineRecordService, {
  type DisciplineRecordItem,
} from '../../services/disciplineRecordService';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import { getFullImageUrl } from '../../utils/imageUtils';
import { StudentAvatar } from '../../utils/studentAvatar';
import { useAuth } from '../../context/AuthContext';
import {
  hasMobileDisciplineAccess,
  canModifyDisciplineRecordInSupervisoryUi,
  disciplineRecordCreatorId,
  getDisciplineSessionOwnerId,
} from '../../utils/disciplinePermissions';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.DISCIPLINE_DETAIL>;

interface RecordWithProofImages extends DisciplineRecordItem {
  proof_images?: { image?: string }[];
}

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

/** Điểm trừ legacy import Excel */
const formatHistoricalDeduction = (v: number | null | undefined): string => {
  if (v == null || Number.isNaN(Number(v))) return '-';
  return Number(v).toLocaleString('vi-VN');
};

const DisciplineDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { user } = useAuth();
  const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
  /** Khớp Frappe owner (thường là email) — ưu tiên email vì API mobile không luôn có name */
  const sessionOwnerId = useMemo(() => getDisciplineSessionOwnerId(user), [user]);
  const canAccessModule = hasMobileDisciplineAccess(roles);
  const { recordId, record: initialRecord } = route.params;

  const [loading, setLoading] = useState(!initialRecord);
  const [refreshing, setRefreshing] = useState(false);
  const [record, setRecord] = useState<RecordWithProofImages | null>(
    initialRecord as RecordWithProofImages | null
  );
  const [error, setError] = useState<string>('');

  const loadData = useCallback(async () => {
    setError('');
    try {
      const res = await disciplineRecordService.getRecord(recordId);
      if (res.success && res.data) {
        setRecord(res.data as RecordWithProofImages);
      } else {
        setError(res.message || 'Không thể tải chi tiết');
      }
    } catch (err) {
      console.error('Error loading discipline record:', err);
      setError('Không thể tải chi tiết');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [recordId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const canShowEditDelete = useMemo(() => {
    if (!record) return false;
    return canModifyDisciplineRecordInSupervisoryUi(
      roles,
      disciplineRecordCreatorId(record),
      sessionOwnerId
    );
  }, [record, roles, sessionOwnerId]);

  const handleUpdate = () => {
    if (!canShowEditDelete) return;
    navigation.navigate(ROUTES.SCREENS.DISCIPLINE_EDIT as any, {
      recordId: record?.name,
      record,
    });
  };

  const handleDelete = () => {
    if (!canShowEditDelete) return;
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc muốn xóa bản ghi "${record?.violation_title || record?.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            if (!record?.name) return;
            const res = await disciplineRecordService.delete(record.name);
            if (res.success) {
              navigation.goBack();
            } else {
              Alert.alert('Lỗi', res.message || 'Không thể xóa');
            }
          },
        },
      ]
    );
  };


  if (!canAccessModule) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="lock-closed-outline" size={56} color="#D1D5DB" />
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

  if (loading && !record) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#002855" />
          <Text className="mt-4 text-gray-500">Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !record) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-red-600">{error}</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-4 rounded-lg bg-[#002855] px-6 py-2">
            <Text className="text-white font-semibold">Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!record) return null;

  const proofImages = (record as RecordWithProofImages).proof_images || [];

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? 0 : undefined }}
      edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-200 px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="-ml-2 mr-1 p-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#002855" />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-lg font-bold text-[#002855]">Chi tiết ghi nhận lỗi</Text>
        </View>
        {canShowEditDelete ? (
          <TouchableOpacity onPress={handleDelete} className="p-2">
            <Ionicons name="trash-outline" size={22} color="#F05023" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#002855']}
          />
        }>
        {/* Đối tượng - Lớp | Học sinh | Mixed - hàng dọc, avatar + tên + lớp cho từng học sinh */}
        <View className="mb-4">
          <Text className="mb-2 text-xs font-semibold text-gray-500">ĐỐI TƯỢNG</Text>
          {record.target_type === 'mixed' ? (
            <View>
              {(record.target_class_entries?.length ?? 0) > 0 ? (
                <View style={{ marginBottom: (record.student_name || record.target_students?.length) ? 8 : 0 }}>
                  <Text className="text-xs font-medium text-gray-500 mb-1">Lớp</Text>
                  {record.target_class_entries!.map((ce, i) => {
                    const idx = (record.target_class_ids || []).indexOf(ce.class_id);
                    const t =
                      (record.target_class_titles || [])[idx >= 0 ? idx : i] || ce.class_id;
                    return (
                      <Text
                        key={ce.class_id || i}
                        className="text-base font-semibold text-[#002855]"
                        style={{ marginTop: i > 0 ? 4 : 0 }}>
                        • {t}{' '}
                        <Text className="text-sm font-normal text-gray-600">
                          (Điểm trừ: {ce.deduction_points ?? '10'})
                        </Text>
                      </Text>
                    );
                  })}
                </View>
              ) : (record.target_class_titles || []).length > 0 ? (
                <View style={{ marginBottom: (record.student_name || record.target_students?.length) ? 8 : 0 }}>
                  <Text className="text-xs font-medium text-gray-500 mb-1">Lớp</Text>
                  {(record.target_class_titles || []).map((t, i) => (
                    <Text key={i} className="text-base font-semibold text-[#002855]" style={{ marginTop: i > 0 ? 4 : 0 }}>
                      • {t}
                    </Text>
                  ))}
                </View>
              ) : null}
              {(record.target_students?.length ?? 0) > 0 ? (
                <View>
                  <Text className="text-xs font-medium text-gray-500 mb-1" style={{ marginTop: (record.target_class_titles || []).length > 0 || (record.target_class_entries?.length ?? 0) > 0 ? 4 : 0 }}>
                    Học sinh
                  </Text>
                  {record.target_students!.map((st, i) => (
                    <View key={st.student_id} className="flex-row items-center" style={{ marginTop: i > 0 ? 8 : 0 }}>
                      <StudentAvatar
                        name={st.student_name}
                        avatarUrl={st.student_photo_url || undefined}
                        size={40}
                      />
                      <View className="ml-3 flex-1">
                        <Text className="text-base font-semibold text-[#002855]">
                          {st.student_name || st.student_code || '-'}
                        </Text>
                        {st.student_class_title ? (
                          <Text className="mt-0.5 text-sm text-gray-600">{st.student_class_title}</Text>
                        ) : null}
                        {st.student_code ? (
                          <Text className="mt-0.5 text-xs text-gray-500">Mã HS: {st.student_code}</Text>
                        ) : null}
                        <Text className="mt-1 text-xs font-semibold text-[#002855]">
                          Điểm trừ: {st.deduction_points ?? '10'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : record.student_name ? (
                <View>
                  <Text className="text-xs font-medium text-gray-500 mb-1" style={{ marginTop: (record.target_class_titles || []).length > 0 ? 4 : 0 }}>
                    Học sinh
                  </Text>
                  {record.student_name.split(', ').filter(Boolean).map((name, i) => (
                    <Text key={i} className="text-base font-semibold text-[#002855]" style={{ marginTop: i > 0 ? 4 : 0 }}>
                      • {name.trim()}
                    </Text>
                  ))}
                </View>
              ) : null}
              {!record.student_name &&
                !record.target_students?.length &&
                !(record.target_class_entries?.length || (record.target_class_titles || []).length) && (
                <Text className="text-base font-semibold text-[#002855]">-</Text>
              )}
            </View>
          ) : record.target_type === 'student' ? (
            (record.target_students?.length ?? 0) > 0 ? (
              <View>
                {record.target_students!.map((st, i) => (
                  <View key={st.student_id} className="flex-row items-center" style={{ marginTop: i > 0 ? 8 : 0 }}>
                    <StudentAvatar
                      name={st.student_name}
                      avatarUrl={st.student_photo_url || undefined}
                      size={40}
                    />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-semibold text-[#002855]">
                        {st.student_name || st.student_code || '-'}
                      </Text>
                      {st.student_class_title ? (
                        <Text className="mt-0.5 text-sm text-gray-600">{st.student_class_title}</Text>
                      ) : null}
                      {st.student_code ? (
                        <Text className="mt-0.5 text-xs text-gray-500">Mã HS: {st.student_code}</Text>
                      ) : null}
                      <Text className="mt-1 text-xs font-semibold text-[#002855]">
                        Điểm trừ: {st.deduction_points ?? '10'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="flex-row items-center">
                <StudentAvatar
                  name={record.student_name}
                  avatarUrl={record.student_photo_url || undefined}
                  size={48}
                />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-[#002855]">
                    {record.student_name || record.student_code || '-'}
                  </Text>
                  {record.student_class_title ? (
                    <Text className="mt-1 text-sm text-gray-600">{record.student_class_title}</Text>
                  ) : null}
                  {record.student_code ? (
                    <Text className="mt-0.5 text-xs text-gray-500">Mã HS: {record.student_code}</Text>
                  ) : null}
                </View>
              </View>
            )
          ) : (
            <View>
              {(record.target_class_entries?.length ?? 0) > 0
                ? record.target_class_entries!.map((ce, i) => {
                    const idx = (record.target_class_ids || []).indexOf(ce.class_id);
                    const t =
                      (record.target_class_titles || [])[idx >= 0 ? idx : i] || ce.class_id;
                    return (
                      <Text
                        key={ce.class_id || i}
                        className="text-base font-semibold text-[#002855]"
                        style={{ marginTop: i > 0 ? 6 : 0 }}>
                        • {t}{' '}
                        <Text className="text-sm font-normal text-gray-600">
                          (Điểm trừ: {ce.deduction_points ?? '10'})
                        </Text>
                      </Text>
                    );
                  })
                : (record.target_class_titles || []).map((t, i) => (
                    <Text key={i} className="text-base font-semibold text-[#002855]" style={{ marginTop: i > 0 ? 6 : 0 }}>
                      • {t}
                    </Text>
                  ))}
              {(record.target_class_entries?.length ?? 0) === 0 &&
                (record.target_class_titles || []).length === 0 && (
                <Text className="text-base font-semibold text-[#002855]">-</Text>
              )}
            </View>
          )}
        </View>

        {/* Vi phạm */}
        <View className="mb-4">
          <Text className="mb-1 text-xs font-semibold text-gray-500">VI PHẠM</Text>
          <Text className="text-base font-semibold text-[#002855]">
            {record.violation_title || '-'}
          </Text>
        </View>

        {/* Các thông tin khác */}
        <View className="mb-4 rounded-xl bg-gray-50 p-4">
          <Text className="mb-3 text-xs font-semibold text-gray-500">THÔNG TIN CHI TIẾT</Text>
          <View className="space-y-2">
            <InfoRow label="Ngày" value={formatDate(record.date)} />
            <InfoRow label="Phân loại" value={record.classification_title || '-'} />
            <InfoRow label="Hình thức" value={record.form_title || '-'} />
            {record.historical_deduction_points != null &&
              !Number.isNaN(Number(record.historical_deduction_points)) &&
              Number(record.historical_deduction_points) !== 0 && (
              <InfoRow
                label="Điểm trừ (legacy import)"
                value={formatHistoricalDeduction(record.historical_deduction_points)}
              />
            )}
            <InfoRow label="Tiết" value={record.time_slot_title || '-'} />
            {record.description ? (
              <InfoRow label="Mô tả" value={record.description} />
            ) : null}
            <InfoRow
              label="Cập nhật bởi"
              value={normalizeVietnameseName(record.owner_name || '') || '-'}
            />
          </View>
        </View>

        {/* Ảnh minh chứng */}
        {proofImages.length > 0 && (
          <View className="mb-4">
            <Text className="mb-2 text-xs font-semibold text-gray-500">ẢNH MINH CHỨNG</Text>
            <View className="flex-row flex-wrap gap-2">
              {proofImages.map((img, i) => {
                const url = getFullImageUrl(img?.image);
                if (!url) return null;
                return (
                  <Image
                    key={i}
                    source={{ uri: url }}
                    className="h-24 w-24 rounded-lg bg-gray-200"
                    resizeMode="cover"
                  />
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {canShowEditDelete ? (
        <View
          className="absolute left-0 right-0 border-t border-gray-200 bg-white px-4 py-3"
          style={{ bottom: 24 }}>
          <TouchableOpacity
            onPress={handleUpdate}
            className="rounded-xl bg-[#002855] py-3"
            style={{ alignItems: 'center' }}>
            <Text className="text-base font-semibold text-white">Cập nhật</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

/** Label cố định bên trái, value wrap xuống dòng khi dài - không lấn sang phần label */
const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ flexDirection: 'row', paddingVertical: 6, alignItems: 'flex-start' }}>
    <Text style={{ fontSize: 14, color: '#6B7280', width: 120, flexShrink: 0 }}>{label}</Text>
    <View style={{ flex: 1, marginLeft: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }}>{value}</Text>
    </View>
  </View>
);

export default DisciplineDetailScreen;
