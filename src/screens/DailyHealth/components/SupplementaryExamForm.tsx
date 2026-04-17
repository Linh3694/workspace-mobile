/**
 * Form Thêm/Chỉnh sửa Thăm khám bổ sung
 * Dùng trong màn stack (HealthExamSupplementary); sheet chỉ còn cho chọn Nhân viên y tế / hướng xử lý / thuốc
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dailyHealthService, {
  HealthExamination,
  MedicalStaffUser,
} from '../../../services/dailyHealthService';
import healthConfigService, {
  MedicineItem,
  FirstAidItem,
} from '../../../services/healthConfigService';
import { BottomSheetModal } from '../../../components/Common';
import TimePickerModal from '../../../components/TimePickerModal';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';

const sectionLabel = {
  fontSize: 14,
  fontWeight: '500' as const,
  color: '#374151',
  marginBottom: 8,
};
const inputStyle = {
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderRadius: 12,
  backgroundColor: '#F9FAFB',
  fontSize: 15,
  color: '#1F2937',
};

// Parse followup_treatment_details thành items
const parseFollowupTreatment = (
  details: string | undefined
): { id: string; type: string; name: string; quantity: string; notes: string }[] => {
  if (!details) return [{ id: '1', type: '', name: '', quantity: '', notes: '' }];
  const lines = details.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [{ id: '1', type: '', name: '', quantity: '', notes: '' }];
  const baseId = Date.now();
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    const m = trimmed.match(/^\[(\w+)\]\s*(.*)$/);
    const type = m ? m[1] : '';
    const content = m ? m[2].trim() : trimmed;
    if (type === 'other' || type === 'rest') {
      return { id: `${baseId}_${idx}`, type, name: content, quantity: '', notes: '' };
    }
    const withNotes = content.match(/^(.+?)\s+x\s+(.+?)\s+\((.+)\)$/);
    if (withNotes) {
      return {
        id: `${baseId}_${idx}`,
        type,
        name: withNotes[1].trim(),
        quantity: withNotes[2].trim(),
        notes: withNotes[3].trim(),
      };
    }
    const noNotes = content.match(/^(.+?)\s+x\s+(.+)$/);
    if (noNotes) {
      return {
        id: `${baseId}_${idx}`,
        type,
        name: noNotes[1].trim(),
        quantity: noNotes[2].trim(),
        notes: '',
      };
    }
    return { id: `${baseId}_${idx}`, type, name: content, quantity: '', notes: '' };
  });
};

// Format items thành followup_treatment_details
const formatFollowupTreatment = (
  items: { type: string; name: string; quantity: string; notes: string }[]
): string => {
  const valid = items.filter((i) => i.type);
  return valid
    .map((i) => {
      if (i.type === 'other' || i.type === 'rest') return `[${i.type}] ${i.name}`;
      return `[${i.type}] ${i.name}${i.quantity ? ` x ${i.quantity}` : ''}${i.notes ? ` (${i.notes})` : ''}`;
    })
    .join('\n');
};

/** Format thời gian từ API (HH:mm:ss) thành HH:mm để hiển thị - tránh substring(0,5) ra "8:58:" */
const formatTimeForDisplay = (timeStr: string | undefined): string => {
  if (!timeStr || !timeStr.trim()) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    const m = parts[1].padStart(2, '0');
    return `${parts[0]}:${m}`;
  }
  return timeStr;
};

/** Chuẩn hóa thời gian HH:mm hoặc HH:mm:ss thành HH:mm:ss (Frappe Time field) */
const normalizeTimeForApi = (timeStr: string | undefined): string | undefined => {
  if (!timeStr || !timeStr.trim()) return undefined;
  const trimmed = timeStr.trim();
  // Bỏ dấu : thừa ở cuối (vd: "8:44:" -> "8:44")
  const cleaned = trimmed.replace(/:+$/, '');
  const m = cleaned.match(/^(\d{1,2}):(\d{2})(?::(\d{1,2}))?$/);
  if (!m) return undefined;
  const h = m[1].padStart(2, '0');
  const min = m[2];
  const sec = (m[3] || '00').padStart(2, '0');
  return `${h}:${min}:${sec}`;
};

interface SupplementaryExamFormProps {
  exam: HealthExamination;
  onClose: () => void;
  onSaved: () => void;
}

const SupplementaryExamForm: React.FC<SupplementaryExamFormProps> = ({
  exam,
  onClose,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [medicalStaffList, setMedicalStaffList] = useState<MedicalStaffUser[]>([]);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [firstAidItems, setFirstAidItems] = useState<FirstAidItem[]>([]);
  /** Mở BottomSheetModal chọn thuốc / vật tư sơ cứu */
  const [treatmentSelectModal, setTreatmentSelectModal] = useState<{
    itemId: string;
    type: 'first_aid' | 'medication';
  } | null>(null);
  const [treatmentSelectSearch, setTreatmentSelectSearch] = useState('');

  const [followupClinicCheckinTime, setFollowupClinicCheckinTime] = useState('');
  const [followupClinicCheckoutTime, setFollowupClinicCheckoutTime] = useState('');
  const [followupIsScheduledRecheck, setFollowupIsScheduledRecheck] = useState(false);
  const [followupExamination, setFollowupExamination] = useState('');
  const [followupTreatmentItems, setFollowupTreatmentItems] = useState<
    { id: string; type: string; name: string; quantity: string; notes: string }[]
  >([{ id: '1', type: '', name: '', quantity: '', notes: '' }]);
  const [followupOutcome, setFollowupOutcome] = useState('');
  const [followupTransferHospital, setFollowupTransferHospital] = useState('');
  const [followupAccompanyingTeacher, setFollowupAccompanyingTeacher] = useState('');
  const [followupAccompanyingHealthStaff, setFollowupAccompanyingHealthStaff] = useState('');
  const [followupMedicalSuggestion, setFollowupMedicalSuggestion] = useState('');
  const [followupMedicalStaff, setFollowupMedicalStaff] = useState('');

  const [showOutcomeSelect, setShowOutcomeSelect] = useState(false);
  const [showMedicalStaffSelect, setShowMedicalStaffSelect] = useState(false);
  const [showTimePickerFor, setShowTimePickerFor] = useState<'checkin' | 'checkout' | null>(null);

  useEffect(() => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setFollowupClinicCheckinTime(
      formatTimeForDisplay(exam.followup_clinic_checkin_time) ||
        formatTimeForDisplay(exam.followup_checkin_time) ||
        timeStr
    );
    setFollowupClinicCheckoutTime(
      formatTimeForDisplay(exam.followup_clinic_checkout_time) ||
        formatTimeForDisplay(exam.followup_checkout_time) ||
        ''
    );
    setFollowupIsScheduledRecheck(!!exam.followup_is_scheduled_recheck);
    setFollowupExamination(exam.followup_examination || '');
    setFollowupTreatmentItems(parseFollowupTreatment(exam.followup_treatment_details));
    setFollowupOutcome(
      exam.followup_outcome === 'return_class' ? 'return_class' : exam.followup_outcome || ''
    );
    setFollowupTransferHospital(exam.followup_transfer_hospital || '');
    setFollowupAccompanyingTeacher(exam.followup_accompanying_teacher || '');
    setFollowupAccompanyingHealthStaff(exam.followup_accompanying_health_staff || '');
    setFollowupMedicalSuggestion(exam.followup_medical_suggestion || '');
    setFollowupMedicalStaff(exam.followup_medical_staff || '');
  }, [exam]);

  useEffect(() => {
    Promise.all([
      dailyHealthService.getMedicalStaffList(),
      healthConfigService.getMedicines(),
      healthConfigService.getFirstAidItems(),
    ]).then(([staff, meds, aids]) => {
      setMedicalStaffList(staff || []);
      setMedicines(meds || []);
      setFirstAidItems(aids || []);
    });
  }, [exam.name]);

  // Options cho modal chọn thuốc/vật tư
  const medicineOptions = medicines.map((m) => ({
    value: m.title,
    label: m.unit ? `${m.title} (${m.unit})` : m.title,
  }));
  const firstAidOptions = firstAidItems.map((a) => ({
    value: a.title,
    label: a.unit ? `${a.title} (${a.unit})` : a.title,
  }));

  const handleAddTreatmentItem = () => {
    setFollowupTreatmentItems((prev) => [
      ...prev,
      { id: Date.now().toString(), type: '', name: '', quantity: '', notes: '' },
    ]);
  };

  const handleRemoveTreatmentItem = (id: string) => {
    if (followupTreatmentItems.length > 1) {
      setFollowupTreatmentItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const handleTreatmentChange = (id: string, field: string, value: string) => {
    setFollowupTreatmentItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const handleSave = async () => {
    if (!followupExamination.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập nhận định ban đầu');
      return;
    }
    if (!followupMedicalSuggestion.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đề xuất của nhân viên y tế');
      return;
    }
    const invalidOther = followupTreatmentItems.find((i) => i.type === 'other' && !i.name?.trim());
    if (invalidOther) {
      Alert.alert('Lỗi', 'Vui lòng nhập mô tả cho loại chăm sóc "Khác"');
      return;
    }
    if (!exam?.name) {
      Alert.alert('Lỗi', 'Không tìm thấy hồ sơ khám để cập nhật');
      return;
    }
    try {
      setLoading(true);
      const treatmentDetails = formatFollowupTreatment(followupTreatmentItems);
      const result = await dailyHealthService.updateHealthExamination({
        exam_id: exam.name,
        followup_clinic_checkin_time: normalizeTimeForApi(followupClinicCheckinTime) || undefined,
        followup_clinic_checkout_time: normalizeTimeForApi(followupClinicCheckoutTime) || undefined,
        followup_is_scheduled_recheck: followupIsScheduledRecheck,
        followup_examination: followupExamination,
        followup_treatment_details: treatmentDetails || undefined,
        followup_outcome:
          (followupOutcome as 'return_class' | 'picked_up' | 'transferred') || undefined,
        followup_transfer_hospital:
          followupOutcome === 'transferred' ? followupTransferHospital || undefined : undefined,
        followup_accompanying_teacher:
          followupOutcome === 'transferred' ? followupAccompanyingTeacher || undefined : undefined,
        followup_accompanying_health_staff:
          followupOutcome === 'transferred'
            ? followupAccompanyingHealthStaff || undefined
            : undefined,
        followup_medical_suggestion: followupMedicalSuggestion || undefined,
        followup_medical_staff: followupMedicalStaff || undefined,
      });
      if (result.success) {
        Alert.alert('Thành công', 'Đã lưu thăm khám bổ sung');
        onSaved();
        onClose();
      } else {
        Alert.alert('Lỗi', result.message || 'Không thể lưu');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const outcomeOptions = [
    { value: 'return_class', label: 'Học sinh về lớp' },
    { value: 'picked_up', label: 'Phụ huynh đón' },
    { value: 'transferred', label: 'Chuyển viện' },
  ];

  const closeTreatmentSelectSheet = () => {
    setTreatmentSelectModal(null);
    setTreatmentSelectSearch('');
  };

  const treatmentSelectFiltered = useMemo(() => {
    if (!treatmentSelectModal) return [];
    const q = treatmentSelectSearch.toLowerCase();
    if (treatmentSelectModal.type === 'first_aid') {
      return firstAidItems
        .map((a) => ({ value: a.title, label: a.unit ? `${a.title} (${a.unit})` : a.title }))
        .filter((o) => o.label.toLowerCase().includes(q));
    }
    return medicines
      .map((m) => ({ value: m.title, label: m.unit ? `${m.title} (${m.unit})` : m.title }))
      .filter((o) => o.label.toLowerCase().includes(q));
  }, [treatmentSelectModal, treatmentSelectSearch, medicines, firstAidItems]);

  return (
    <>
      <View style={{ flex: 1, padding: 16 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          // iOS: chỉnh inset theo bàn phím; nút Lưu nằm trong scroll để không tách block với KeyboardAvoidingView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Thời gian vào */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Thời gian vào</Text>
            <TouchableOpacity
              onPress={() => setShowTimePickerFor('checkin')}
              style={[
                inputStyle,
                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
              ]}>
              <Text style={{ color: followupClinicCheckinTime ? '#1F2937' : '#9CA3AF', flex: 1 }}>
                {followupClinicCheckinTime || 'Chọn thời gian'}
              </Text>
              <Ionicons name="time-outline" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Khám lại theo hẹn */}
          <TouchableOpacity
            onPress={() => setFollowupIsScheduledRecheck(!followupIsScheduledRecheck)}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: followupIsScheduledRecheck ? '#002855' : '#D1D5DB',
                backgroundColor: followupIsScheduledRecheck ? '#002855' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {followupIsScheduledRecheck && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={{ marginLeft: 8, fontSize: 15, color: '#374151', fontFamily: 'Mulish' }}>
              Khám lại theo hẹn
            </Text>
          </TouchableOpacity>

          {/* Nhận định ban đầu (*) */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
              Nhận định ban đầu <Text style={{ color: '#EF4444' }}>*</Text>
            </Text>
            <TextInput
              style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
              value={followupExamination}
              onChangeText={setFollowupExamination}
              placeholder="Nhận định ban đầu..."
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          {/* Chăm sóc y tế */}
          <View style={{ marginBottom: 20 }}>
            <Text
              style={[
                sectionLabel,
                { fontSize: 15, fontWeight: '600', color: '#002855', marginBottom: 12 },
              ]}>
              <Text style={{ fontFamily: 'Mulish' }}>Chăm sóc y tế</Text>
            </Text>
            {followupTreatmentItems.map((item, index) => (
              <View
                key={item.id}
                style={{
                  marginBottom: 16,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}>
                {/* Header dòng: số thứ tự + nút xóa */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                    paddingBottom: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: '#6B7280',
                        fontFamily: 'Mulish',
                      }}>
                      Bước {index + 1}
                    </Text>
                  </View>
                  {followupTreatmentItems.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveTreatmentItem(item.id)}
                      style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Loại điều trị */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={[sectionLabel, { marginBottom: 8, fontFamily: 'Mulish' }]}>
                    Loại
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                    {[
                      { value: 'first_aid', label: 'Sơ cứu' },
                      { value: 'medication', label: 'Thuốc' },
                      { value: 'rest', label: 'Nghỉ ngơi' },
                      { value: 'other', label: 'Khác' },
                    ].map(({ value, label }) => (
                      <TouchableOpacity
                        key={value}
                        onPress={() => handleTreatmentChange(item.id, 'type', value)}
                        style={{
                          margin: 4,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 8,
                          backgroundColor: item.type === value ? '#002855' : '#F3F4F6',
                        }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '500',
                            color: item.type === value ? '#FFFFFF' : '#6B7280',
                          }}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Tên / Mô tả - Sơ cứu/Thuốc dùng modal chọn (giống thăm khám ban đầu) */}
                <View
                  style={{
                    marginBottom: item.type === 'first_aid' || item.type === 'medication' ? 12 : 0,
                  }}>
                  <Text style={[sectionLabel, { marginBottom: 6, fontFamily: 'Mulish' }]}>
                    {item.type === 'rest' ? (
                      'Ghi chú'
                    ) : item.type === 'other' ? (
                      <>
                        Mô tả <Text style={{ color: '#EF4444' }}>*</Text>
                      </>
                    ) : item.type === 'first_aid' ? (
                      'Tên vật tư sơ cứu'
                    ) : item.type === 'medication' ? (
                      'Tên thuốc'
                    ) : (
                      'Tên thuốc / vật tư'
                    )}
                  </Text>
                  {item.type === 'first_aid' || item.type === 'medication' ? (
                    <TouchableOpacity
                      onPress={() =>
                        setTreatmentSelectModal({
                          itemId: item.id,
                          type: item.type as 'first_aid' | 'medication',
                        })
                      }
                      style={[
                        inputStyle,
                        {
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        },
                      ]}>
                      <Text
                        style={{
                          color: item.name ? '#1F2937' : '#9CA3AF',
                          flex: 1,
                        }}
                        numberOfLines={1}>
                        {item.type === 'first_aid'
                          ? firstAidOptions.find((o) => o.value === item.name)?.label ||
                            item.name ||
                            'Chọn vật tư sơ cứu...'
                          : medicineOptions.find((o) => o.value === item.name)?.label ||
                            item.name ||
                            'Chọn thuốc...'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  ) : (
                    <TextInput
                      style={inputStyle}
                      value={item.name}
                      onChangeText={(v) => handleTreatmentChange(item.id, 'name', v)}
                      placeholder={
                        item.type === 'rest'
                          ? 'Nhập ghi chú nghỉ ngơi...'
                          : 'Nhập mô tả điều trị...'
                      }
                      placeholderTextColor="#9CA3AF"
                    />
                  )}
                </View>

                {/* Số lượng + Ghi chú - chỉ khi Sơ cứu hoặc Thuốc */}
                {(item.type === 'first_aid' || item.type === 'medication') && (
                  <View style={{ flexDirection: 'row', marginTop: 12, marginHorizontal: -6 }}>
                    <View style={{ flex: 1, marginHorizontal: 6 }}>
                      <Text style={[sectionLabel, { marginBottom: 6, fontFamily: 'Mulish' }]}>
                        Số lượng
                      </Text>
                      <TextInput
                        style={inputStyle}
                        value={item.quantity}
                        onChangeText={(v) => handleTreatmentChange(item.id, 'quantity', v)}
                        placeholder="VD: 1, 2..."
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 2, marginHorizontal: 6 }}>
                      <Text style={[sectionLabel, { marginBottom: 6, fontFamily: 'Mulish' }]}>
                        Ghi chú
                      </Text>
                      <TextInput
                        style={inputStyle}
                        value={item.notes}
                        onChangeText={(v) => handleTreatmentChange(item.id, 'notes', v)}
                        placeholder="Ghi chú thêm (nếu có)"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}
            <TouchableOpacity
              onPress={handleAddTreatmentItem}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#002855',
                borderStyle: 'dashed',
                backgroundColor: '#F8FAFC',
              }}>
              <Ionicons name="add-circle-outline" size={22} color="#002855" />
              <Text style={{ marginLeft: 8, fontSize: 15, color: '#002855', fontWeight: '600' }}>
                Thêm dòng chăm sóc
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hướng xử lý */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Hướng xử lý sau chăm sóc</Text>
            <TouchableOpacity
              onPress={() => setShowOutcomeSelect(true)}
              style={[
                inputStyle,
                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
              ]}>
              <Text style={{ color: followupOutcome ? '#1F2937' : '#9CA3AF', flex: 1 }}>
                {followupOutcome === 'return_class'
                  ? 'Học sinh về lớp'
                  : followupOutcome === 'picked_up'
                    ? 'Phụ huynh đón'
                    : followupOutcome === 'transferred'
                      ? 'Chuyển viện'
                      : 'Chọn hướng xử lý...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {followupOutcome === 'transferred' && (
            <>
              <View style={{ marginBottom: 16 }}>
                <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Bệnh viện chuyển tới</Text>
                <TextInput
                  style={inputStyle}
                  value={followupTransferHospital}
                  onChangeText={setFollowupTransferHospital}
                  placeholder="Nhập tên bệnh viện..."
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Thầy/ cô đi cùng</Text>
                <TextInput
                  style={inputStyle}
                  value={followupAccompanyingTeacher}
                  onChangeText={setFollowupAccompanyingTeacher}
                  placeholder="Nhập tên giáo viên..."
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Nhân viên Y tế đi cùng</Text>
                <TextInput
                  style={inputStyle}
                  value={followupAccompanyingHealthStaff}
                  onChangeText={setFollowupAccompanyingHealthStaff}
                  placeholder="Nhập tên Nhân viên y tế..."
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </>
          )}

          {/* Đề xuất Nhân viên y tế (*) */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
              Đề xuất của nhân viên y tế <Text style={{ color: '#EF4444' }}>*</Text>
            </Text>
            <TextInput
              style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
              value={followupMedicalSuggestion}
              onChangeText={setFollowupMedicalSuggestion}
              placeholder="Nhập đề xuất..."
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          {/* Thời gian về */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Thời gian về</Text>
            <TouchableOpacity
              onPress={() => setShowTimePickerFor('checkout')}
              style={[
                inputStyle,
                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
              ]}>
              <Text style={{ color: followupClinicCheckoutTime ? '#1F2937' : '#9CA3AF', flex: 1 }}>
                {followupClinicCheckoutTime || 'Chọn thời gian'}
              </Text>
              <Ionicons name="time-outline" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Nhân viên y tế thăm khám */}
          <View style={{ marginBottom: 24 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Nhân viên Y tế thăm khám</Text>
            <TouchableOpacity
              onPress={() => setShowMedicalStaffSelect(true)}
              style={[
                inputStyle,
                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
              ]}>
              <Text style={{ color: followupMedicalStaff ? '#1F2937' : '#9CA3AF', flex: 1 }}>
                {followupMedicalStaff
                  ? normalizeVietnameseName(
                      medicalStaffList.find((u) => u.name === followupMedicalStaff)?.full_name || ''
                    )
                  : 'Chọn Nhân viên y tế...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Nút Lưu nằm trong ScrollView để không bị tách khỏi nội dung khi bàn phím mở */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#002855',
              paddingVertical: 14,
              borderRadius: 12,
              marginTop: 8,
              marginBottom: 8,
            }}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text
                  style={{
                    marginLeft: 8,
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#FFFFFF',
                    fontFamily: 'Mulish',
                  }}>
                  Lưu thăm khám bổ sung
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Bottom sheet chọn thuốc / vật tư sơ cứu (Chăm sóc y tế) */}
      <BottomSheetModal
        visible={!!treatmentSelectModal}
        onClose={closeTreatmentSelectSheet}
        maxHeightPercent={88}
        fillHeight
        keyboardAvoiding>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
            }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#002855',
                fontFamily: 'Mulish',
                flex: 1,
              }}>
              {treatmentSelectModal?.type === 'first_aid' ? 'Chọn vật tư sơ cứu' : 'Chọn thuốc'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (treatmentSelectModal) {
                  handleTreatmentChange(treatmentSelectModal.itemId, 'name', '');
                }
                closeTreatmentSelectSheet();
              }}
              style={{ paddingVertical: 4, paddingHorizontal: 8, marginRight: 4 }}>
              <Text style={{ fontSize: 15, color: '#EF4444', fontFamily: 'Mulish' }}>Xoá</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeTreatmentSelectSheet} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F3F4F6',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 12,
            }}>
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              value={treatmentSelectSearch}
              onChangeText={setTreatmentSelectSearch}
              placeholder="Tìm kiếm..."
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 15,
                color: '#1F2937',
                fontFamily: 'Mulish',
              }}
            />
            {treatmentSelectSearch.length > 0 && (
              <TouchableOpacity onPress={() => setTreatmentSelectSearch('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={treatmentSelectFiltered}
            keyExtractor={(o) => o.value}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                <Text style={{ marginTop: 8, color: '#6B7280', fontFamily: 'Mulish' }}>
                  Không tìm thấy kết quả
                </Text>
              </View>
            }
            renderItem={({ item: opt }) => {
              const currentItem = followupTreatmentItems.find(
                (i) => i.id === treatmentSelectModal?.itemId
              );
              const isSelected = currentItem?.name === opt.value;
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (treatmentSelectModal) {
                      handleTreatmentChange(treatmentSelectModal.itemId, 'name', opt.value);
                    }
                    closeTreatmentSelectSheet();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    marginBottom: 8,
                    borderRadius: 12,
                    backgroundColor: isSelected ? '#FFEDD5' : '#F9FAFB',
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: isSelected ? '#EA580C' : 'transparent',
                  }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: isSelected ? '600' : '400',
                      color: isSelected ? '#EA580C' : '#374151',
                      flex: 1,
                      fontFamily: 'Mulish',
                    }}>
                    {opt.label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color="#EA580C" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </BottomSheetModal>

      {/* Modal chọn hướng xử lý */}
      <BottomSheetModal
        visible={showOutcomeSelect}
        onClose={() => setShowOutcomeSelect(false)}
        maxHeightPercent={40}>
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16, fontFamily: 'Mulish' }}>
            Hướng xử lý
          </Text>
          {outcomeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => {
                setFollowupOutcome(opt.value);
                setShowOutcomeSelect(false);
              }}
              style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 15, color: '#1F2937', fontFamily: 'Mulish' }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheetModal>

      {/* Modal chọn Nhân viên y tế */}
      <BottomSheetModal
        visible={showMedicalStaffSelect}
        onClose={() => setShowMedicalStaffSelect(false)}
        maxHeightPercent={60}>
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16, fontFamily: 'Mulish' }}>
            Chọn Nhân viên y tế thăm khám
          </Text>
          {medicalStaffList.map((u) => (
            <TouchableOpacity
              key={u.name}
              onPress={() => {
                setFollowupMedicalStaff(u.name);
                setShowMedicalStaffSelect(false);
              }}
              style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 15, color: '#1F2937', fontFamily: 'Mulish' }}>
                {normalizeVietnameseName(u.full_name || u.email)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheetModal>

      {/* TimePicker cho Thời gian vào / Thời gian về */}
      <TimePickerModal
        visible={showTimePickerFor !== null}
        value={
          showTimePickerFor === 'checkin' ? followupClinicCheckinTime : followupClinicCheckoutTime
        }
        onSelect={(timeStr) => {
          if (showTimePickerFor === 'checkin') setFollowupClinicCheckinTime(timeStr);
          else setFollowupClinicCheckoutTime(timeStr);
          setShowTimePickerFor(null);
        }}
        onClose={() => setShowTimePickerFor(null)}
      />
    </>
  );
};

export default SupplementaryExamForm;
