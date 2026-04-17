// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TouchableOpacity, BottomSheetModal } from '../../components/Common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import DatePickerModal from '../../components/DatePickerModal';
import { useLanguage } from '../../hooks/useLanguage';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import dailyHealthService, { DailyHealthVisit, VisitOutcome } from '../../services/dailyHealthService';
import api from '../../utils/api';
import HealthVisitCard from './components/HealthVisitCard';
import CheckoutModal from './components/CheckoutModal';

// Interface cấp học - giống Sổ đầu bài
interface EducationStage {
  name: string;
  title_vn?: string;
  title_en?: string;
  short_title?: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.DAILY_HEALTH>;

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (date: Date): string => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
  return `${weekday}, ${day}/${month}`;
};

const DailyHealthScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { t } = useLanguage();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visits, setVisits] = useState<DailyHealthVisit[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Cấp học - giống Sổ đầu bài
  const [availableStages, setAvailableStages] = useState<EducationStage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [showStagePicker, setShowStagePicker] = useState(false);

  // Modal từ chối tiếp nhận - có lý do (đồng bộ web)
  const [rejectModal, setRejectModal] = useState<{
    visible: boolean;
    visit: DailyHealthVisit | null;
  }>({ visible: false, visit: null });
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  /** Đồng bộ web DailyHealthList: visit đã có hồ sơ thăm khám trong ngày → cho Check out dù status at_clinic */
  const [visitHasExamMap, setVisitHasExamMap] = useState<Record<string, boolean>>({});
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkoutVisit, setCheckoutVisit] = useState<DailyHealthVisit | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // Load cấp học từ API - giống Sổ đầu bài
  useEffect(() => {
    (async () => {
      try {
        const stagesRes = await api.get(
          '/method/erp.api.erp_sis.education_stage.get_all_education_stages'
        );
        const stages = stagesRes.data?.message?.data || stagesRes.data?.data || [];
        setAvailableStages(stages);
        const cachedId = await AsyncStorage.getItem('dailyHealthSelectedStage');
        if (cachedId && stages.some((s: EducationStage) => s.name === cachedId)) {
          setSelectedStage(cachedId);
        } else if (stages.length > 0) {
          const first = stages[0];
          setSelectedStage(first.name);
          await AsyncStorage.setItem('dailyHealthSelectedStage', first.name);
        }
      } catch (e) {
        console.error('Error loading education stages:', e);
      }
    })();
  }, []);

  const normalizeExamDateStr = (value: string | undefined) => {
    if (!value) return '';
    const s = String(value).trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  };

  const loadVisitExamFlags = useCallback(async (visitList: DailyHealthVisit[], dateStr: string) => {
    const atClinicVisits = visitList.filter((v) => v.status === 'at_clinic');
    if (atClinicVisits.length === 0) {
      setVisitHasExamMap({});
      return;
    }
    const studentIds = [...new Set(atClinicVisits.map((v) => v.student_id))];
    const map: Record<string, boolean> = {};
    const visitDay = (v: DailyHealthVisit) => normalizeExamDateStr(v.visit_date || dateStr);
    try {
      await Promise.all(
        studentIds.map(async (studentId) => {
          const exams = await dailyHealthService.getStudentExaminationHistory(studentId, 200);
          for (const exam of exams) {
            if (normalizeExamDateStr(exam.examination_date) !== dateStr) continue;
            const vid = exam.visit_id?.trim();
            if (vid) {
              map[vid] = true;
              continue;
            }
            const sameDay = atClinicVisits.filter(
              (v) => v.student_id === studentId && visitDay(v) === dateStr
            );
            if (sameDay.length === 1) {
              map[sameDay[0].name] = true;
            }
          }
        })
      );
      setVisitHasExamMap(map);
    } catch {
      setVisitHasExamMap({});
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const dateStr = formatDate(selectedDate);
      const data = await dailyHealthService.getDailyHealthVisits({
        date: dateStr,
        education_stage: selectedStage || undefined,
      });
      setVisits(data);
      await loadVisitExamFlags(data, dateStr);
    } catch (error) {
      console.error('Error loading daily health visits:', error);
      setVisitHasExamMap({});
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedStage, loadVisitExamFlags]);

  // Load data when screen focuses, date or campus changes
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Handle navigation from notification
  useEffect(() => {
    if (route.params?.visitId) {
      navigation.navigate(ROUTES.SCREENS.HEALTH_EXAM, { visitId: route.params.visitId });
    }
  }, [route.params?.visitId, navigation]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  // Filter visits theo search
  const filteredVisits = useMemo(() => {
    let result = visits;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (v) =>
          v.student_name?.toLowerCase().includes(query) ||
          v.student_code?.toLowerCase().includes(query) ||
          v.class_name?.toLowerCase().includes(query)
      );
    }

    // Sort: active visits first, then by time
    return result.sort((a, b) => {
      const activeStatuses = ['left_class', 'at_clinic', 'examining'];
      const aActive = activeStatuses.includes(a.status) ? 0 : 1;
      const bActive = activeStatuses.includes(b.status) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (b.leave_class_time || '').localeCompare(a.leave_class_time || '');
    });
  }, [visits, searchQuery]);

  // Phát hiện lượt khám lại: HS ở trạng thái at_clinic nhưng đã có lượt hoàn thành trong ngày → hiển thị "đang khám" và cho checkout
  const returnVisitIds = useMemo(() => {
    const ids = new Set<string>();
    visits.forEach((visit) => {
      if (visit.status !== 'at_clinic') return;
      const hasCompletedVisit = visits.some(
        (v) => v.student_id === visit.student_id &&
               v.name !== visit.name &&
               ['returned', 'picked_up', 'transferred'].includes(v.status)
      );
      if (hasCompletedVisit) {
        ids.add(visit.name);
      }
    });
    return ids;
  }, [visits]);

  // Tên cấp học hiện tại để hiển thị - giống Sổ đầu bài
  const currentStage = availableStages.find((s) => s.name === selectedStage);
  const currentStageTitle =
    currentStage?.title_vn || currentStage?.title_en || currentStage?.short_title || 'Chọn cấp học';
  const hasMultipleStages = availableStages.length > 1;

  const handleStageSelect = async (stageId: string) => {
    setSelectedStage(stageId);
    await AsyncStorage.setItem('dailyHealthSelectedStage', stageId);
    setShowStagePicker(false);
  };

  // Handlers
  const handleReceive = async (visit: DailyHealthVisit) => {
    try {
      const result = await dailyHealthService.receiveStudentAtClinic(visit.name);
      if (result.success) {
        Alert.alert('Thành công', 'Đã tiếp nhận học sinh');
        loadData();
      } else {
        Alert.alert('Lỗi', result.message || 'Không thể tiếp nhận');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể tiếp nhận');
    }
  };

  // Mở modal từ chối (có lý do - đồng bộ web)
  const handleOpenRejectModal = (visit: DailyHealthVisit) => {
    setRejectModal({ visible: true, visit });
    setRejectReason('');
  };

  const handleCloseRejectModal = () => {
    if (!isRejecting) {
      setRejectModal({ visible: false, visit: null });
      setRejectReason('');
    }
  };

  const handleRejectConfirm = async () => {
    const { visit } = rejectModal;
    if (!visit) return;

    setIsRejecting(true);
    try {
      const result = await dailyHealthService.rejectHealthVisit(visit.name, rejectReason.trim() || undefined);
      if (result.success) {
        Alert.alert('Thành công', 'Đã từ chối tiếp nhận - học sinh đang về lớp');
        handleCloseRejectModal();
        loadData();
      } else {
        Alert.alert('Lỗi', result.message || 'Không thể từ chối');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể từ chối');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleStartExam = async (visit: DailyHealthVisit) => {
    try {
      const result = await dailyHealthService.startExamination(visit.name);
      if (result.success) {
        navigation.navigate(ROUTES.SCREENS.HEALTH_EXAM, { visitId: visit.name, visitData: visit });
      } else {
        Alert.alert('Lỗi', result.message || 'Không thể bắt đầu khám');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể bắt đầu khám');
    }
  };

  const handleVisitPress = (visit: DailyHealthVisit) => {
    navigation.navigate(ROUTES.SCREENS.HEALTH_EXAM, { visitId: visit.name, visitData: visit });
  };

  const handleCreateVisit = () => {
    navigation.navigate(ROUTES.SCREENS.CREATE_HEALTH_VISIT);
  };

  const handleOpenCheckout = (visit: DailyHealthVisit) => {
    setCheckoutVisit(visit);
    setCheckoutModalVisible(true);
  };

  const handleCheckoutConfirm = async (params: {
    outcome: VisitOutcome;
    checkoutNotes?: string;
    transferHospital?: string;
    accompanyingTeacher?: string;
    accompanyingHealthStaff?: string;
  }) => {
    if (!checkoutVisit) return;
    setCheckingOut(true);
    try {
      const result = await dailyHealthService.completeHealthVisit({
        visit_id: checkoutVisit.name,
        outcome: params.outcome,
        checkout_notes: params.checkoutNotes,
        transfer_hospital: params.transferHospital,
        accompanying_teacher: params.accompanyingTeacher,
        accompanying_health_staff: params.accompanyingHealthStaff,
      });
      if (result.success) {
        Alert.alert('Thành công', 'Đã checkout học sinh');
        loadData();
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

  // Check if today
  const isToday = formatDate(selectedDate) === formatDate(new Date());

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      {/* Header - Title căn giữa, khoảng cách đều */}
      <View className="px-4" style={{ paddingTop: 12, paddingBottom: 0 }}>
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-full p-2">
            <Ionicons name="arrow-back" size={24} />
          </TouchableOpacity>
          <Text
            className="mr-10 flex-1 text-center text-xl font-bold text-gray-900"
            style={{ fontFamily: 'Mulish' }}>
            {t('daily_health.title') || 'Y tế học sinh'}
          </Text>
        </View>
      </View>

      {/* Badge chọn cấp học - giống Sổ đầu bài */}
      <View className="mb-2 px-4 py-4">
        <TouchableOpacity
          onPress={() => hasMultipleStages && setShowStagePicker(true)}
          activeOpacity={hasMultipleStages ? 0.7 : 1}
          className="self-center">
          <View
            className="flex-row items-center rounded-full px-4 py-2"
            style={{ backgroundColor: '#E5EAF0' }}>
            <Text className="text-base font-semibold text-[#002855]" numberOfLines={1}>
              {currentStageTitle}
            </Text>
            {hasMultipleStages && (
              <Ionicons name="chevron-down" size={16} color="#002855" style={{ marginLeft: 6 }} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Chọn ngày */}
      <View className="px-4 pb-4">
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            backgroundColor: '#FFFFFF',
          }}>
          <View className="flex-row items-center">
            <Ionicons name="calendar-outline" size={20} color="#C2410C" />
            <Text
              className={`ml-2 text-base font-semibold ${isToday ? 'text-[#F05023]' : 'text-gray-900'}`}
              style={{ fontFamily: 'Mulish' }}>
              {isToday ? 'Hôm nay' : formatDateDisplay(selectedDate)}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View className="border-b border-gray-100 px-4 pb-3">
        <View className="flex-row items-center rounded-xl bg-gray-100 px-3 py-2">
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm học sinh..."
            placeholderTextColor="#9CA3AF"
            className="ml-2 flex-1 text-gray-900"
            style={{ fontFamily: 'Mulish' }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C2410C" />
          <Text className="mt-4 text-gray-500" style={{ fontFamily: 'Mulish' }}>
            Đang tải...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredVisits}
          keyExtractor={(item) => item.name}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#C2410C']}
            />
          }
          renderItem={({ item }) => (
            <HealthVisitCard
              visit={item}
              onPress={() => handleVisitPress(item)}
              onReceive={() => handleReceive(item)}
              onReject={() => handleOpenRejectModal(item)}
              onStartExam={() => handleStartExam(item)}
              isReturnVisit={returnVisitIds.has(item.name)}
              canCheckout={
                item.status === 'examining' ||
                (item.status === 'at_clinic' && !!visitHasExamMap[item.name]) ||
                returnVisitIds.has(item.name)
              }
              onCheckout={() => handleOpenCheckout(item)}
            />
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="medkit-outline" size={64} color="#D1D5DB" />
              <Text
                className="mt-4 text-center text-lg text-gray-500"
                style={{ fontFamily: 'Mulish' }}>
                {searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có lượt xuống Y tế'}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB - Create new visit (pastel) */}
      <TouchableOpacity
        onPress={handleCreateVisit}
        className="absolute right-4 h-14 w-14 items-center justify-center rounded-full shadow-lg"
        style={{
          bottom: insets.bottom + 16,
          backgroundColor: '#F0F9FF',
          borderWidth: 2,
          borderColor: '#BAE6FD',
        }}>
        <Ionicons name="add" size={28} color="#0369A1" />
      </TouchableOpacity>

      {/* Modal chọn cấp học - giống Sổ đầu bài */}
      <BottomSheetModal visible={showStagePicker} onClose={() => setShowStagePicker(false)}>
        <View className="border-b border-gray-100 px-5 py-4">
          <Text className="text-lg font-bold text-[#002855]" style={{ fontFamily: 'Mulish' }}>
            Chọn cấp học
          </Text>
        </View>
        <ScrollView className="max-h-80">
          {availableStages.map((stage) => {
            const isSelected = stage.name === selectedStage;
            const title = stage.title_vn || stage.title_en || stage.short_title || stage.name;
            return (
              <TouchableOpacity
                key={stage.name}
                onPress={() => handleStageSelect(stage.name)}
                activeOpacity={0.7}
                className={`flex-row items-center border-b border-gray-50 px-5 py-4 ${
                  isSelected ? 'bg-blue-50' : ''
                }`}>
                <View className="flex-1">
                  <Text
                    className={`text-base ${isSelected ? 'font-bold text-[#002855]' : 'text-gray-800'}`}
                    style={{ fontFamily: 'Mulish' }}>
                    {title}
                  </Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={24} color="#002855" />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      {/* Date Picker */}
      <DatePickerModal
        visible={showDatePicker}
        value={selectedDate}
        onSelect={handleDateSelect}
        onClose={() => setShowDatePicker(false)}
        maximumDate={new Date()}
      />

      {/* Modal từ chối tiếp nhận - có lý do (đồng bộ web) */}
      <Modal
        visible={rejectModal.visible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseRejectModal}>
        <Pressable
          className="flex-1 justify-center bg-black/50 px-4"
          onPress={handleCloseRejectModal}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="rounded-2xl bg-white p-5">
              <Text className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Mulish' }}>
                Từ chối tiếp nhận học sinh
              </Text>
              <Text className="mt-2 text-sm text-gray-600" style={{ fontFamily: 'Mulish' }}>
                Bạn đang từ chối tiếp nhận học sinh{' '}
                <Text className="font-semibold">{rejectModal.visit?.student_name}</Text> (Mã HS:{' '}
                {rejectModal.visit?.student_code}, Lớp: {rejectModal.visit?.class_name}). Điểm danh
                sẽ được cập nhật về có mặt.
              </Text>

              <Text className="mt-4 text-sm font-medium text-gray-700" style={{ fontFamily: 'Mulish' }}>
                Lý do từ chối (tùy chọn)
              </Text>
              <TextInput
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="VD: Học sinh không xuống Y tế, không có vấn đề gì..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-900"
                style={{ textAlignVertical: 'top', fontFamily: 'Mulish', minHeight: 80 }}
                editable={!isRejecting}
              />

              <View className="mt-5 flex-row gap-3">
                <TouchableOpacity
                  onPress={handleCloseRejectModal}
                  disabled={isRejecting}
                  className="flex-1 items-center rounded-xl border border-gray-200 py-3">
                  <Text className="font-medium text-gray-600" style={{ fontFamily: 'Mulish' }}>
                    Đóng
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRejectConfirm}
                  disabled={isRejecting}
                  className="flex-1 items-center rounded-xl py-3"
                  style={{
                    backgroundColor: '#FFF1F2',
                    borderWidth: 1,
                    borderColor: '#FECDD3',
                  }}>
                  {isRejecting ? (
                    <ActivityIndicator size="small" color="#BE123C" />
                  ) : (
                    <Text
                      className="font-semibold"
                      style={{ fontFamily: 'Mulish', color: '#BE123C' }}>
                      Xác nhận từ chối
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <CheckoutModal
        visible={checkoutModalVisible}
        onClose={() => {
          if (!checkingOut) {
            setCheckoutModalVisible(false);
            setCheckoutVisit(null);
          }
        }}
        onConfirm={handleCheckoutConfirm}
        loading={checkingOut}
      />
    </View>
  );
};

export default DailyHealthScreen;
