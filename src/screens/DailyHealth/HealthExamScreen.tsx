// @ts-nocheck
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import dailyHealthService, {
  DailyHealthVisit,
  HealthExamination,
  CreateExaminationParams,
  VisitOutcome,
} from '../../services/dailyHealthService';
import { StudentAvatar } from '../../utils/studentAvatar';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import { formatTimeHHMM } from '../../utils/dateUtils';
import ExaminationForm from './components/ExaminationForm';
import ExaminationHistoryList from './components/ExaminationHistoryList';
import TodayExamView from './components/TodayExamView';
import CheckoutModal from '../DailyHealth/components/CheckoutModal';

const { completeHealthVisit } = dailyHealthService;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.HEALTH_EXAM>;

// Trạng thái pastel đồng bộ web
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  left_class: { label: 'Rời lớp', color: '#B45309', bg: '#FFFBEB' },
  at_clinic: { label: 'Tại YT', color: '#0369A1', bg: '#F0F9FF' },
  examining: { label: 'Đang khám', color: '#C2410C', bg: '#FFF7ED' },
  returned: { label: 'Đã về lớp', color: '#047857', bg: '#ECFDF5' },
  picked_up: { label: 'Phụ huynh đón', color: '#6D28D9', bg: '#F5F3FF' },
  transferred: { label: 'Chuyển viện', color: '#BE123C', bg: '#FFF1F2' },
};

const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return `${weekdays[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

const formatTime = (timeStr?: string): string => {
  if (!timeStr) return '--:--';
  const formatted = formatTimeHHMM(timeStr);
  return formatted || '--:--';
};

const normalizeExamDateStr = (value: string | undefined): string => {
  if (!value) return '';
  const s = String(value).trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
};

const HealthExamScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { visitId, visitData: initialVisitData } = route.params;

  // State
  const [loading, setLoading] = useState(!initialVisitData);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visit, setVisit] = useState<DailyHealthVisit | null>(initialVisitData || null);
  const [allExams, setAllExams] = useState<HealthExamination[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [showForm, setShowForm] = useState(false);
  const [editingExam, setEditingExam] = useState<HealthExamination | null>(null);
  // Modal checkout — đồng bộ DailyHealthScreen
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  // Lấy ngày của visit (dùng để phân biệt "hôm nay" vs "lịch sử")
  const visitDate = visit?.visit_date || new Date().toISOString().split('T')[0];

  // Phân chia exams: hôm nay (ngày visit) vs lịch sử (các ngày khác)
  const { todayExams, historyExams } = useMemo(() => {
    const today: HealthExamination[] = [];
    const history: HealthExamination[] = [];

    allExams.forEach((exam) => {
      if (normalizeExamDateStr(exam.examination_date) === normalizeExamDateStr(visitDate)) {
        today.push(exam);
      } else {
        history.push(exam);
      }
    });

    // Sort today by modified time (newest first)
    today.sort((a, b) =>
      (b.modified || b.creation || '').localeCompare(a.modified || a.creation || '')
    );

    // Sort history by date (newest first)
    history.sort((a, b) => b.examination_date.localeCompare(a.examination_date));

    return { todayExams: today, historyExams: history };
  }, [allExams, visitDate]);

  // Load data
  const loadDataCallback = useCallback(async () => {
    try {
      let visitData = visit;

      if (!visitData) {
        setLoading(true);
        visitData = await dailyHealthService.getVisitDetail(visitId);
        setVisit(visitData);
      }

      if (visitData) {
        // Lấy lịch sử thăm khám của học sinh (lấy nhiều để có lịch sử)
        const history = await dailyHealthService.getStudentExaminationHistory(
          visitData.student_id,
          50
        );
        setAllExams(history);

        // Auto start examination nếu status là at_clinic
        if (visitData.status === 'at_clinic') {
          await dailyHealthService.startExamination(visitId);
          setVisit({ ...visitData, status: 'examining' });
        }
      }
    } catch (error) {
      console.error('Error loading health exam data:', error);
    } finally {
      setLoading(false);
    }
  }, [visitId, visit]);

  useFocusEffect(
    useCallback(() => {
      loadDataCallback();
    }, [loadDataCallback])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDataCallback();
    setRefreshing(false);
  };

  // Save examination (create or update)
  const handleSaveExam = async (data: CreateExaminationParams, visitReasonUpdated?: string) => {
    try {
      setSaving(true);

      // Cập nhật lý do báo cáo y tế nếu có thay đổi
      if (visitReasonUpdated && visit) {
        try {
          await dailyHealthService.updateVisitReason(visitId, visitReasonUpdated);
          setVisit({ ...visit, reason: visitReasonUpdated });
        } catch (reasonError) {
          console.error('Error updating visit reason:', reasonError);
        }
      }

      let result;
      if (editingExam) {
        // Update existing
        result = await dailyHealthService.updateHealthExamination({
          exam_id: editingExam.name,
          ...data,
        });
      } else {
        // Create new
        result = await dailyHealthService.createHealthExamination(data);
      }

      if (result.success) {
        Alert.alert('Thành công', editingExam ? 'Đã cập nhật hồ sơ khám' : 'Đã tạo hồ sơ khám');
        setShowForm(false);
        setEditingExam(null);
        loadDataCallback();
      } else {
        Alert.alert('Lỗi', result.message || 'Không thể lưu hồ sơ');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể lưu hồ sơ');
    } finally {
      setSaving(false);
    }
  };

  // Upload image
  const handleUploadImage = async (file: {
    uri: string;
    name: string;
    type: string;
  }): Promise<string | null> => {
    const result = await dailyHealthService.uploadFile(file);
    return result.success ? result.file_url || null : null;
  };

  // Edit exam
  const handleEditExam = (exam: HealthExamination) => {
    setEditingExam(exam);
    setShowForm(true);
  };

  // Cancel form
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingExam(null);
  };

  // Điều hướng sang màn full-screen (giống thăm khám ban đầu)
  const handleOpenHospitalForm = (exam: HealthExamination) => {
    navigation.navigate(ROUTES.SCREENS.HEALTH_EXAM_HOSPITAL, {
      visitId,
      examId: exam.name,
    });
  };

  const handleOpenFollowupForm = (exam: HealthExamination) => {
    navigation.navigate(ROUTES.SCREENS.HEALTH_EXAM_SUPPLEMENTARY, {
      visitId,
      examId: exam.name,
    });
  };

  // Mở modal checkout
  const handleOpenCheckout = () => {
    setCheckoutModalVisible(true);
  };

  // Xác nhận checkout — gọi completeHealthVisit, reload visit + lịch sử khám
  const handleCheckoutConfirm = async (params: {
    outcome: VisitOutcome;
    checkoutNotes?: string;
    transferHospital?: string;
    accompanyingTeacher?: string;
    accompanyingHealthStaff?: string;
  }) => {
    setCheckingOut(true);
    try {
      const result = await completeHealthVisit({
        visit_id: visitId,
        outcome: params.outcome,
        checkout_notes: params.checkoutNotes,
        transfer_hospital: params.transferHospital,
        accompanying_teacher: params.accompanyingTeacher,
        accompanying_health_staff: params.accompanyingHealthStaff,
      });
      if (result.success) {
        Alert.alert('Thành công', 'Đã checkout học sinh');
        const fresh = await dailyHealthService.getVisitDetail(visitId);
        setVisit(fresh);
        if (fresh) {
          const history = await dailyHealthService.getStudentExaminationHistory(fresh.student_id, 50);
          setAllExams(history);
        }
      } else {
        throw new Error(result.message || 'Không thể checkout');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error?.message || 'Không thể checkout');
      throw error;
    } finally {
      setCheckingOut(false);
    }
  };

  // Render exam card
  // Render loading
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#C2410C" />
          <Text style={{ marginTop: 16, color: '#6B7280', fontFamily: 'Mulish' }}>Đang tải...</Text>
        </View>
      </View>
    );
  }

  if (!visit) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: '#F3F4F6',
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text
            style={{ marginLeft: 8, flex: 1, fontSize: 20, fontWeight: '700', color: '#1F2937' }}>
            Hồ sơ khám
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="alert-circle-outline" size={64} color="#D1D5DB" />
          <Text style={{ marginTop: 16, fontSize: 18, color: '#6B7280', fontFamily: 'Mulish' }}>
            Không tìm thấy thông tin
          </Text>
        </View>
      </View>
    );
  }

  const statusInfo = statusConfig[visit.status] || statusConfig.at_clinic;
  const isActive = ['left_class', 'at_clinic', 'examining'].includes(visit.status);

  // Nếu đang hiển thị form
  if (showForm) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: '#F3F4F6',
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}>
          <TouchableOpacity onPress={handleCancelForm} style={{ padding: 8 }}>
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text
            style={{ marginLeft: 8, flex: 1, fontSize: 18, fontWeight: '600', color: '#1F2937' }}>
            {editingExam ? 'Cập nhật hồ sơ khám' : 'Tạo hồ sơ khám mới'}
          </Text>
        </View>

        <ExaminationForm
          visitId={visitId}
          visitReason={visit.reason || ''}
          visitLeaveClinicTime={visit.leave_clinic_time}
          visitStatus={visit.status}
          initialData={editingExam || undefined}
          onSave={handleSaveExam}
          onUploadImage={handleUploadImage}
          loading={saving}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text
              style={{ fontSize: 20, fontWeight: '700', color: '#1F2937', fontFamily: 'Mulish' }}>
              Hồ sơ khám
            </Text>
          </View>
        </View>

        {/* Student info */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <StudentAvatar
              name={visit.student_name}
              avatarUrl={visit.student_photo}
              size={76}
              style={{ resizeMode: 'cover', objectFit: 'cover', objectPosition: 'top' }}
            />
            <View style={{ marginLeft: 12, flex: 1, gap: 4 }}>
              <Text
                style={{ fontSize: 18, fontWeight: '600', color: '#1F2937', fontFamily: 'Mulish' }}>
                {visit.student_name}
              </Text>
              <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'Mulish' }}>
                {visit.student_code} • {visit.class_name}
              </Text>
              <View
                style={{
                  marginTop: 4,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: statusInfo.bg,
                }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: statusInfo.color,
                    fontFamily: 'Mulish',
                  }}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>
          </View>

          {/* Visit info */}
          <View
            style={{
              marginTop: 12,
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 12,
              gap: 4,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="document-text-outline" size={16} color="#6B7280" />
              <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'Mulish', marginLeft: 8 }}>
                Lý do xuống Y Tế:
              </Text>
              <Text
                style={{
                  marginLeft: 8,
                  flex: 1,
                  fontSize: 14,
                  color: '#374151',
                  fontFamily: 'Mulish',
                  fontWeight: '700',
                }}>
                {visit.reason || 'Không có lý do'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="time-outline" size={16} color="#6B7280" />
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 14,
                  color: '#6B7280',
                  fontFamily: 'Mulish',
                }}>
                Rời lớp:
              </Text>
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 14,
                  color: '#374151',
                  fontFamily: 'Mulish',
                  fontWeight: '700',
                }}>
                {formatTime(visit.leave_class_time)}
              </Text>
              {visit.arrive_clinic_time && (
                <>
                  <Text
                    style={{
                      marginLeft: 12,
                      fontSize: 14,
                      color: '#6B7280',
                      fontFamily: 'Mulish',
                    }}>
                    Đến Y Tế:
                  </Text>
                  <Text
                    style={{
                      marginLeft: 4,
                      fontSize: 14,
                      color: '#374151',
                      fontFamily: 'Mulish',
                      fontWeight: '700',
                    }}>
                    {formatTime(visit.arrive_clinic_time)}
                  </Text>
                </>
              )}
            </View>
            {visit.reported_by_name && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Ionicons name="person-outline" size={16} color="#6B7280" />
                <Text
                  style={{ marginLeft: 8, fontSize: 14, color: '#6B7280', fontFamily: 'Mulish' }}>
                  Người báo cáo:
                </Text>
                <Text
                  style={{
                    marginLeft: 4,
                    fontSize: 14,
                    color: '#374151',
                    fontFamily: 'Mulish',
                    fontWeight: '700',
                  }}>
                  {normalizeVietnameseName(visit.reported_by_name)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: '#F3F4F6',
            paddingHorizontal: 16,
          }}>
          <TouchableOpacity
            onPress={() => setActiveTab('today')}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: 2,
              borderBottomColor: activeTab === 'today' ? '#C2410C' : 'transparent',
            }}>
            <Text
              style={{
                fontWeight: '500',
                color: activeTab === 'today' ? '#C2410C' : '#6B7280',
                fontFamily: 'Mulish',
              }}>
              Thăm khám hôm nay ({todayExams.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('history')}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: 2,
              borderBottomColor: activeTab === 'history' ? '#C2410C' : 'transparent',
            }}>
            <Text
              style={{
                fontWeight: '500',
                color: activeTab === 'history' ? '#C2410C' : '#6B7280',
                fontFamily: 'Mulish',
              }}>
              Lịch sử ({historyExams.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#C2410C']} />
        }>
        {activeTab === 'today' ? (
          <>
            {/* Khu vực nút hành động: checkout (đang khám / tại YT) + tạo hồ sơ */}
            {(visit.status === 'examining' || visit.status === 'at_clinic') && (
              <TouchableOpacity
                onPress={handleOpenCheckout}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#ECFDF5',
                  borderWidth: 1,
                  borderColor: '#A7F3D0',
                  paddingVertical: 8,
                  borderRadius: 12,
                  marginBottom: isActive ? 12 : 16,
                }}>
                <Ionicons name="log-out-outline" size={20} color="#047857" />
                <Text
                  style={{
                    marginLeft: 8,
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#047857',
                    fontFamily: 'Mulish',
                  }}>
                  Check out
                </Text>
              </TouchableOpacity>
            )}
            {isActive && (
              <TouchableOpacity
                onPress={() => {
                  setEditingExam(null);
                  setShowForm(true);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFF7ED',
                  borderWidth: 1,
                  borderColor: '#FED7AA',
                  paddingVertical: 8,
                  borderRadius: 12,
                  marginBottom: 16,
                }}>
                <Ionicons name="add-circle-outline" size={20} color="#C2410C" />
                <Text
                  style={{
                    marginLeft: 8,
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#C2410C',
                    fontFamily: 'Mulish',
                  }}>
                  Tạo hồ sơ khám mới
                </Text>
              </TouchableOpacity>
            )}

            {/* Danh sách hồ sơ khám hôm nay */}
            {todayExams.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="medkit-outline" size={64} color="#D1D5DB" />
                <Text
                  style={{ marginTop: 12, fontSize: 16, color: '#6B7280', fontFamily: 'Mulish' }}>
                  Chưa có hồ sơ khám nào hôm nay
                </Text>
                {isActive && (
                  <Text
                    style={{ marginTop: 4, fontSize: 14, color: '#9CA3AF', fontFamily: 'Mulish' }}>
                    Nhấn nút trên để tạo hồ sơ khám mới
                  </Text>
                )}
              </View>
            ) : (
              todayExams.map((exam) => (
                <TodayExamView
                  key={exam.name}
                  exam={exam}
                  visit={visit!}
                  visitReason={visit?.reason || ''}
                  onEdit={() => handleEditExam(exam)}
                  onAddSupplementary={() => handleOpenFollowupForm(exam)}
                  onEditSupplementary={() => handleOpenFollowupForm(exam)}
                  onAddHospitalDiagnosis={
                    visit?.status === 'transferred' ? () => handleOpenHospitalForm(exam) : undefined
                  }
                  onEditHospitalDiagnosis={
                    visit?.status === 'transferred' ? () => handleOpenHospitalForm(exam) : undefined
                  }
                />
              ))
            )}
          </>
        ) : (
          <ExaminationHistoryList examinations={historyExams} visitReason={visit?.reason} />
        )}
      </ScrollView>

      <CheckoutModal
        visible={checkoutModalVisible}
        onClose={() => {
          if (!checkingOut) {
            setCheckoutModalVisible(false);
          }
        }}
        onConfirm={handleCheckoutConfirm}
        loading={checkingOut}
      />
    </View>
  );
};

export default HealthExamScreen;
