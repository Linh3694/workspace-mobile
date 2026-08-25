/**
 * Chi tiết sự vụ kỷ luật — cùng nội dung với DisciplineCaseDetailPageV2 của web:
 * tab Tiến trình (trao đổi / lịch sử + thêm nhật ký) và tab Thông tin (meta + quỹ
 * điểm phục hồi), hành động Cập nhật xử lý và Duyệt điểm phục hồi ở thanh dưới.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { StudentAvatar } from '../../utils/studentAvatar';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import { useAuth } from '../../context/AuthContext';
import { hasMobileDisciplineAccess } from '../../utils/disciplinePermissions';
import disciplineCaseService, {
  type DisciplineCaseDetail,
} from '../../services/disciplineCaseService';
import {
  CASE_ACTION_LABEL,
  CASE_COMMENT_ACTIONS,
  fmtDateOnly,
  fmtMonthKey,
  fmtPoints,
  fmtTime,
  resolveCaseStatusTone,
} from './caseFormat';
import { CaseStatusSheet } from './components/CaseStatusSheet';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.DISCIPLINE_CASE_DETAIL>;

type DetailTab = 'progress' | 'info';
type ActivityTab = 'comments' | 'history';

const DisciplineCaseDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { user } = useAuth();
  const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
  const canAccessModule = hasMobileDisciplineAccess(roles);
  const { caseId } = route.params;

  const [detail, setDetail] = useState<DisciplineCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<DetailTab>('progress');
  const [activity, setActivity] = useState<ActivityTab>('comments');
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const res = await disciplineCaseService.get(caseId);
      if (res.success && res.data) {
        setDetail(res.data);
      } else {
        setError(res.message || 'Không tải được sự vụ');
      }
    } catch (err) {
      console.error('Error loading discipline case:', err);
      setError('Không tải được sự vụ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [caseId]);

  useFocusEffect(
    useCallback(() => {
      if (!canAccessModule) return;
      loadData();
    }, [loadData, canAccessModule])
  );

  const logs = useMemo(() => {
    const all = detail?.logs || [];
    const inTab = all.filter((log) =>
      activity === 'comments'
        ? CASE_COMMENT_ACTIONS.has(log.action)
        : !CASE_COMMENT_ACTIONS.has(log.action)
    );
    // Mới nhất lên đầu — trên mobile đọc từ trên xuống, không có nút đổi thứ tự
    return [...inTab].sort((a, b) => {
      const av = new Date(String(a.creation || '').replace(' ', 'T')).getTime() || 0;
      const bv = new Date(String(b.creation || '').replace(' ', 'T')).getTime() || 0;
      return bv - av;
    });
  }, [detail, activity]);

  const pendingPoints = useMemo(
    () =>
      (detail?.recovery_entries || [])
        .filter((e) => e.status === 'Chờ')
        .reduce((sum, e) => sum + Number(e.recovery_points || 0), 0),
    [detail]
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAddNote = async () => {
    const content = note.trim();
    if (!content || !detail) return;
    setAddingNote(true);
    try {
      const res = await disciplineCaseService.addNote(detail.name, content);
      if (!res.success) {
        Alert.alert('Lỗi', res.message || 'Lưu thất bại');
        return;
      }
      setNote('');
      await loadData();
    } finally {
      setAddingNote(false);
    }
  };

  const handleGrantRecovery = () => {
    if (!detail) return;
    Alert.alert(
      'Duyệt điểm phục hồi',
      `Hoàn ${fmtPoints(pendingPoints)} điểm cho học sinh này. Điểm đã cộng vào quỹ thì không rút lại được.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Duyệt',
          onPress: async () => {
            const res = await disciplineCaseService.grantRecovery(detail.name);
            if (res.success) {
              Alert.alert('Thành công', `Đã duyệt ${fmtPoints(res.data?.recovery_points)} điểm phục hồi`);
              await loadData();
            } else {
              Alert.alert('Lỗi', res.message || 'Duyệt thất bại');
            }
          },
        },
      ]
    );
  };

  const handleResendNotification = () => {
    if (!detail) return;
    Alert.alert(
      'Gửi lại thông báo',
      `Gửi lại email và thông báo cho người xử lý của sự vụ "${detail.student_name || detail.student_id}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gửi',
          onPress: async () => {
            const res = await disciplineCaseService.resendNotification(detail.name);
            if (res.success) {
              Alert.alert('Thành công', 'Đã gửi lại thông báo');
              await loadData();
            } else {
              Alert.alert('Lỗi', res.message || 'Gửi lại thất bại');
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

  if (loading && !detail) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#002855" />
          <Text className="mt-4 text-gray-500">Đang tải sự vụ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-red-600">{error || 'Không tải được sự vụ'}</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-4 rounded-lg bg-[#002855] px-6 py-2">
            <Text className="font-semibold text-white">Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tone = resolveCaseStatusTone(detail.status);
  const picName = detail.pic_display_name
    ? normalizeVietnameseName(detail.pic_display_name)
    : detail.pic || 'Chưa ai tiếp nhận';

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
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
          <Text className="text-lg font-bold text-[#002855]" numberOfLines={1}>
            {detail.student_name || detail.student_id}
          </Text>
          <Text className="text-xs text-gray-500" numberOfLines={1}>
            {[detail.handler_role_label, fmtMonthKey(detail.month_key)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <TouchableOpacity onPress={handleResendNotification} className="p-2">
          <Ionicons name="mail-outline" size={22} color="#002855" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200 px-4">
        {(
          [
            { key: 'progress' as const, label: 'Tiến trình' },
            { key: 'info' as const, label: 'Thông tin' },
          ]
        ).map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => setTab(item.key)}
            className={`flex-1 items-center border-b-2 py-3 ${
              tab === item.key ? 'border-[#002855]' : 'border-transparent'
            }`}>
            <Text
              className={`text-base font-semibold ${
                tab === item.key ? 'text-[#002855]' : 'text-gray-500'
              }`}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#002855']} />
        }>
        {tab === 'progress' ? (
          <View>
            {/* Trao đổi | Lịch sử */}
            <View className="mb-3 flex-row self-start rounded-full bg-gray-100 p-1">
              {(
                [
                  { key: 'comments' as const, label: 'Trao đổi' },
                  { key: 'history' as const, label: 'Lịch sử' },
                ]
              ).map((item) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setActivity(item.key)}
                  className={`rounded-full px-4 py-1.5 ${
                    activity === item.key ? 'bg-white' : 'bg-transparent'
                  }`}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: activity === item.key ? '#002855' : '#6B7280',
                    }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {activity === 'comments' ? (
              <View className="mb-4">
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Thêm nhật ký xử lý..."
                  multiline
                  textAlignVertical="top"
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-base text-gray-800"
                  style={{ minHeight: 72 }}
                />
                <TouchableOpacity
                  onPress={handleAddNote}
                  disabled={addingNote || !note.trim()}
                  className="mt-2 items-center self-end rounded-xl bg-[#002855] px-5 py-2"
                  style={{ opacity: addingNote || !note.trim() ? 0.5 : 1 }}>
                  {addingNote ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-sm font-semibold text-white">Gửi</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {logs.length === 0 ? (
              <View className="items-center py-10">
                <MaterialIcons name="history" size={48} color="#D1D5DB" />
                <Text className="mt-3 text-center text-gray-500">
                  {activity === 'comments' ? 'Chưa có nhật ký nào' : 'Chưa có thao tác nào'}
                </Text>
              </View>
            ) : (
              logs.map((log) => (
                <View key={log.name} className="mb-3 rounded-xl bg-[#F8F8F8] p-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-[#002855]">
                      {CASE_ACTION_LABEL[log.action] || log.action}
                    </Text>
                    <Text className="text-xs text-gray-500">{fmtTime(log.creation)}</Text>
                  </View>
                  {log.note ? (
                    <Text className="mt-1.5 text-sm text-gray-800">{log.note}</Text>
                  ) : null}
                  {log.old_value || log.new_value ? (
                    <Text className="mt-1.5 text-xs text-gray-500">
                      {log.old_value || '—'} → {log.new_value || '—'}
                    </Text>
                  ) : null}
                  {log.actor ? (
                    <Text className="mt-1.5 text-xs text-gray-500">
                      {normalizeVietnameseName(log.actor) || log.actor}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : (
          <View>
            {/* Học sinh */}
            <View className="mb-4 flex-row items-center">
              <StudentAvatar
                name={detail.student_name}
                avatarUrl={detail.student_photo_url || undefined}
                size={48}
              />
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-[#002855]">
                  {detail.student_name || detail.student_id}
                </Text>
                {detail.student_code ? (
                  <Text className="mt-0.5 text-xs text-gray-500">Mã HS: {detail.student_code}</Text>
                ) : null}
              </View>
            </View>

            <View className="mb-4 rounded-xl bg-gray-50 p-4">
              <Text className="mb-3 text-xs font-semibold text-gray-500">THÔNG TIN SỰ VỤ</Text>
              <InfoRow label="Mã sự vụ" value={detail.case_code || detail.name} />
              <InfoRow label="Tháng" value={fmtMonthKey(detail.month_key)} />
              <InfoRow label="Cấp xử lý" value={detail.handler_role_label || '-'} />
              <InfoRow label="Điểm trừ trong tháng" value={String(detail.trigger_points ?? 0)} />
              <View style={{ flexDirection: 'row', paddingVertical: 6, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#6B7280', width: 150, flexShrink: 0 }}>
                  Trạng thái
                </Text>
                <View
                  style={{
                    backgroundColor: tone.bg,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    marginLeft: 8,
                  }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: tone.text }}>
                    {detail.status}
                  </Text>
                </View>
              </View>
              <InfoRow
                label="Phục hồi"
                value={detail.recovery_granted ? 'Đã duyệt' : 'Chưa duyệt'}
              />
              <InfoRow label="Người thực hiện" value={picName} />
              {detail.pic_job_title ? (
                <InfoRow label="Chức danh" value={detail.pic_job_title} />
              ) : null}
              {detail.resolution_note ? (
                <InfoRow label="Ghi nhận xử lý" value={detail.resolution_note} />
              ) : null}
            </View>

            <View className="mb-4 rounded-xl bg-gray-50 p-4">
              <Text className="mb-3 text-xs font-semibold text-gray-500">QUỸ ĐIỂM PHỤC HỒI</Text>
              <InfoRow label="Điểm đã hoàn" value={fmtPoints(detail.recovery_total_restored)} />
              <InfoRow label="Điểm đang chờ" value={fmtPoints(pendingPoints)} />
              <Text className="mt-2 text-xs text-gray-500">
                Số điểm hệ thống tự tính 30% điểm đã trừ. Duyệt sẽ hoàn ngay các lỗi trong tháng
                này mà không cần chờ hết chu kỳ.
              </Text>
            </View>

            {(detail.recovery_entries || []).length === 0 ? (
              <Text className="text-sm text-gray-500">Chưa có dòng điểm phục hồi nào</Text>
            ) : (
              detail.recovery_entries.map((e) => (
                <View key={e.name} className="mb-3 rounded-xl border border-gray-200 p-3">
                  <Text className="text-sm font-semibold text-[#002855]">
                    {e.violation_title || e.violation_title_en || 'Vi phạm đã bị xoá'}
                  </Text>
                  {e.violation_code ? (
                    <Text className="mt-0.5 text-xs text-gray-500">{e.violation_code}</Text>
                  ) : null}
                  <View className="mt-2 flex-row flex-wrap" style={{ gap: 12 }}>
                    <Text className="text-xs text-gray-600">
                      Mức: {e.applied_level ? `Mức ${e.applied_level}` : '—'}
                    </Text>
                    <Text className="text-xs text-gray-600">Đã trừ: {e.deducted_points ?? 0}</Text>
                    <Text className="text-xs text-gray-600">
                      Phục hồi: {fmtPoints(e.recovery_points)}
                    </Text>
                  </View>
                  <View className="mt-1 flex-row flex-wrap" style={{ gap: 12 }}>
                    <Text className="text-xs text-gray-600">Trạng thái: {e.status}</Text>
                    <Text className="text-xs text-gray-600">
                      Đủ điều kiện từ: {fmtDateOnly(e.eligible_from)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Thanh hành động */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <TouchableOpacity
          onPress={() => setStatusSheetVisible(true)}
          className="items-center rounded-xl bg-[#002855] py-3">
          <Text className="text-base font-semibold text-white">Cập nhật xử lý</Text>
        </TouchableOpacity>
        {!detail.recovery_granted ? (
          <TouchableOpacity
            onPress={handleGrantRecovery}
            className="mt-2 items-center rounded-xl border border-[#002855] py-3">
            <Text className="text-base font-semibold text-[#002855]">Duyệt điểm phục hồi</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <CaseStatusSheet
        visible={statusSheetVisible}
        onClose={() => setStatusSheetVisible(false)}
        caseName={detail.name}
        currentStatus={detail.status}
        currentNote={detail.resolution_note || ''}
        onSaved={() => loadData()}
      />
    </SafeAreaView>
  );
};

/** Label cố định bên trái, value wrap xuống dòng khi dài */
const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ flexDirection: 'row', paddingVertical: 6, alignItems: 'flex-start' }}>
    <Text style={{ fontSize: 14, color: '#6B7280', width: 150, flexShrink: 0 }}>{label}</Text>
    <View style={{ flex: 1, marginLeft: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }}>{value}</Text>
    </View>
  </View>
);

export default DisciplineCaseDetailScreen;
