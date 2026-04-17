/**
 * Form nhập Chẩn đoán & điều trị tại bệnh viện (sau chuyển viện)
 * Dùng trong màn hình stack (HealthExamHospital), không còn bọc BottomSheet ngoài
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dailyHealthService, {
  HealthExamination,
  DailyHealthVisit,
  MedicalStaffUser,
} from '../../../services/dailyHealthService';
import { BottomSheetModal } from '../../../components/Common';
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

interface HospitalDiagnosisFormProps {
  exam: HealthExamination;
  visit: DailyHealthVisit;
  onClose: () => void;
  onSaved: () => void;
}

const HospitalDiagnosisForm: React.FC<HospitalDiagnosisFormProps> = ({
  exam,
  visit,
  onClose,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [medicalStaffList, setMedicalStaffList] = useState<MedicalStaffUser[]>([]);
  const [hospitalInsurance, setHospitalInsurance] = useState(exam.hospital_insurance || '');
  const [hospitalMedicalStaff, setHospitalMedicalStaff] = useState(
    exam.hospital_medical_staff || ''
  );
  const [hospitalDiagnosis, setHospitalDiagnosis] = useState(exam.hospital_diagnosis || '');
  const [hospitalDirection, setHospitalDirection] = useState(exam.hospital_direction || '');
  const [hospitalAdvanceCost, setHospitalAdvanceCost] = useState(
    exam.hospital_advance_cost?.toString() || ''
  );
  const [hospitalPayer, setHospitalPayer] = useState(exam.hospital_payer || '');
  const [hospitalPayerOther, setHospitalPayerOther] = useState(exam.hospital_payer_other || '');
  const [hospitalTransport, setHospitalTransport] = useState(exam.hospital_transport || '');
  const [hospitalTransportOther, setHospitalTransportOther] = useState(
    exam.hospital_transport_other || ''
  );
  const [hospitalNotes, setHospitalNotes] = useState(exam.hospital_notes || '');
  const [showPayerSelect, setShowPayerSelect] = useState(false);
  const [showTransportSelect, setShowTransportSelect] = useState(false);
  const [showMedicalStaffSelect, setShowMedicalStaffSelect] = useState(false);

  // Đồng bộ state khi đổi hồ sơ khám (tải lại từ API)
  useEffect(() => {
    setHospitalInsurance(exam.hospital_insurance || '');
    setHospitalMedicalStaff(exam.hospital_medical_staff || '');
    setHospitalDiagnosis(exam.hospital_diagnosis || '');
    setHospitalDirection(exam.hospital_direction || '');
    setHospitalAdvanceCost(exam.hospital_advance_cost?.toString() || '');
    setHospitalPayer(exam.hospital_payer || '');
    setHospitalPayerOther(exam.hospital_payer_other || '');
    setHospitalTransport(exam.hospital_transport || '');
    setHospitalTransportOther(exam.hospital_transport_other || '');
    setHospitalNotes(exam.hospital_notes || '');
  }, [exam]);

  useEffect(() => {
    dailyHealthService.getMedicalStaffList().then((list) => setMedicalStaffList(list || []));
  }, [exam.name]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const result = await dailyHealthService.updateHealthExamination({
        exam_id: exam.name,
        hospital_insurance: hospitalInsurance || undefined,
        hospital_medical_staff: hospitalMedicalStaff || undefined,
        hospital_diagnosis: hospitalDiagnosis || undefined,
        hospital_direction: hospitalDirection || undefined,
        hospital_advance_cost: hospitalAdvanceCost ? parseFloat(hospitalAdvanceCost) : undefined,
        hospital_payer: hospitalPayer || undefined,
        hospital_payer_other: hospitalPayerOther || undefined,
        hospital_transport: hospitalTransport || undefined,
        hospital_transport_other: hospitalTransportOther || undefined,
        hospital_notes: hospitalNotes || undefined,
      });
      if (result.success) {
        Alert.alert('Thành công', 'Đã lưu chẩn đoán & điều trị tại bệnh viện');
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

  return (
    <>
      <View style={{ flex: 1, padding: 16 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Bệnh viện chuyển tới (readonly) - tách khỏi Phối hợp */}
          {visit.transfer_hospital && (
            <View style={{ marginBottom: 16 }}>
              <Text style={sectionLabel}>Bệnh viện chuyển tới</Text>
              <View
                style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: 12,
                  padding: 12,
                }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: '#1F2937',
                    fontFamily: 'Mulish',
                  }}>
                  <Text style={{ fontWeight: '600' }}>{visit.transfer_hospital}</Text>
                </Text>
              </View>
            </View>
          )}

          {/* Phối hợp từ phía nhà trường (readonly) */}
          {(visit.accompanying_teacher || visit.accompanying_health_staff) && (
            <View style={{ marginBottom: 16 }}>
              <Text style={sectionLabel}>Phối hợp từ phía nhà trường</Text>
              <View
                style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: 12,
                  padding: 12,
                }}>
                {visit.accompanying_teacher && (
                  <Text
                    style={{
                      fontSize: 14,
                      color: '#1F2937',
                      marginBottom: 4,
                      fontFamily: 'Mulish',
                    }}>
                    Thầy/ cô đi cùng:{' '}
                    <Text style={{ fontWeight: '600' }}>{visit.accompanying_teacher}</Text>
                  </Text>
                )}
                {visit.accompanying_health_staff && (
                  <Text style={{ fontSize: 14, color: '#1F2937', fontFamily: 'Mulish' }}>
                    Nhân viên y tế đi cùng:{' '}
                    <Text style={{ fontWeight: '600' }}>{visit.accompanying_health_staff}</Text>
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Bảo hiểm */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
              Bảo hiểm sức khỏe tự nguyện
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setHospitalInsurance('student_insured')}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: hospitalInsurance === 'student_insured' ? '#DC2626' : '#E5E7EB',
                  backgroundColor: hospitalInsurance === 'student_insured' ? '#FEE2E2' : '#F9FAFB',
                }}>
                <Text
                  style={{
                    textAlign: 'center',
                    fontWeight: '500',
                    color: hospitalInsurance === 'student_insured' ? '#DC2626' : '#6B7280',
                  }}>
                  HS có mua
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setHospitalInsurance('student_not_insured')}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: hospitalInsurance === 'student_not_insured' ? '#DC2626' : '#E5E7EB',
                  backgroundColor:
                    hospitalInsurance === 'student_not_insured' ? '#FEE2E2' : '#F9FAFB',
                }}>
                <Text
                  style={{
                    textAlign: 'center',
                    fontWeight: '500',
                    color: hospitalInsurance === 'student_not_insured' ? '#DC2626' : '#6B7280',
                  }}>
                  HS không mua
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Nhân viên y tế phụ trách */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Nhân viên Y tế phụ trách</Text>
            <TouchableOpacity
              onPress={() => setShowMedicalStaffSelect(true)}
              style={[
                inputStyle,
                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
              ]}>
              <Text style={{ color: hospitalMedicalStaff ? '#1F2937' : '#9CA3AF', flex: 1 }}>
                {hospitalMedicalStaff
                  ? normalizeVietnameseName(
                      medicalStaffList.find((u) => u.name === hospitalMedicalStaff)?.full_name || ''
                    )
                  : 'Chọn Nhân viên y tế phụ trách...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Chẩn đoán */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Chẩn đoán tại bệnh viện</Text>
            <TextInput
              style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
              value={hospitalDiagnosis}
              onChangeText={setHospitalDiagnosis}
              placeholder="Chẩn đoán tại bệnh viện..."
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          {/* Hướng xử trí */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Hướng xử trí</Text>
            <TextInput
              style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
              value={hospitalDirection}
              onChangeText={setHospitalDirection}
              placeholder="Hướng xử trí trong bệnh án..."
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          {/* Chi phí tạm ứng */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Chi phí Y tế tạm ứng (VNĐ)</Text>
            <TextInput
              style={inputStyle}
              value={hospitalAdvanceCost}
              onChangeText={setHospitalAdvanceCost}
              placeholder="Nhập số tiền..."
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>

          {/* Bên chi trả */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Bên chi trả</Text>
            <TouchableOpacity
              onPress={() => setShowPayerSelect(true)}
              style={[
                inputStyle,
                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
              ]}>
              <Text style={{ color: hospitalPayer ? '#1F2937' : '#9CA3AF', flex: 1 }}>
                {hospitalPayer === 'company'
                  ? 'Công ty'
                  : hospitalPayer === 'parent'
                    ? 'PHHS'
                    : hospitalPayer === 'other'
                      ? hospitalPayerOther || 'Khác'
                      : 'Chọn bên chi trả...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {hospitalPayer === 'other' && (
              <TextInput
                style={[inputStyle, { marginTop: 8 }]}
                value={hospitalPayerOther}
                onChangeText={setHospitalPayerOther}
                placeholder="Nhập bên chi trả..."
                placeholderTextColor="#9CA3AF"
              />
            )}
          </View>

          {/* Phương tiện */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Phương tiện di chuyển</Text>
            <TouchableOpacity
              onPress={() => setShowTransportSelect(true)}
              style={[
                inputStyle,
                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
              ]}>
              <Text style={{ color: hospitalTransport ? '#1F2937' : '#9CA3AF', flex: 1 }}>
                {hospitalTransport === 'school_car'
                  ? 'Xe trường'
                  : hospitalTransport === 'taxi'
                    ? 'Xe taxi'
                    : hospitalTransport === 'parent_car'
                      ? 'Xe PHHS'
                      : hospitalTransport === 'other'
                        ? hospitalTransportOther || 'Khác'
                        : 'Chọn phương tiện...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {hospitalTransport === 'other' && (
              <TextInput
                style={[inputStyle, { marginTop: 8 }]}
                value={hospitalTransportOther}
                onChangeText={setHospitalTransportOther}
                placeholder="Nhập phương tiện khác..."
                placeholderTextColor="#9CA3AF"
              />
            )}
          </View>

          {/* Ghi chú */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Ghi chú</Text>
            <TextInput
              style={[inputStyle, { minHeight: 60, textAlignVertical: 'top' }]}
              value={hospitalNotes}
              onChangeText={setHospitalNotes}
              placeholder="Nhập ghi chú (nếu có)..."
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          {/* Nút lưu trong scroll — tránh tách khỏi ScrollView + KeyboardAvoidingView gây nút nhảy giữa màn khi gõ đa dòng */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#DC2626',
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
                <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                  Lưu chẩn đoán & điều trị
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Modal chọn Nhân viên y tế */}
      <BottomSheetModal
        visible={showMedicalStaffSelect}
        onClose={() => setShowMedicalStaffSelect(false)}
        maxHeightPercent={60}>
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16, fontFamily: 'Mulish' }}>
            Chọn Nhân viên y tế phụ trách
          </Text>
          {medicalStaffList.map((u) => (
            <TouchableOpacity
              key={u.name}
              onPress={() => {
                setHospitalMedicalStaff(u.name);
                setShowMedicalStaffSelect(false);
              }}
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6',
              }}>
              <Text style={{ fontSize: 15, color: '#1F2937', fontFamily: 'Mulish' }}>
                {normalizeVietnameseName(u.full_name || u.email)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheetModal>

      {/* Modal chọn bên chi trả */}
      <BottomSheetModal
        visible={showPayerSelect}
        onClose={() => setShowPayerSelect(false)}
        maxHeightPercent={50}>
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16, fontFamily: 'Mulish' }}>
            Bên chi trả
          </Text>
          {[
            { value: 'company', label: 'Công ty' },
            { value: 'parent', label: 'PHHS' },
            { value: 'other', label: 'Khác' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => {
                setHospitalPayer(opt.value);
                setShowPayerSelect(false);
              }}
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6',
              }}>
              <Text style={{ fontSize: 15, color: '#1F2937', fontFamily: 'Mulish' }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheetModal>

      {/* Modal chọn phương tiện */}
      <BottomSheetModal
        visible={showTransportSelect}
        onClose={() => setShowTransportSelect(false)}
        maxHeightPercent={50}>
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16, fontFamily: 'Mulish' }}>
            Phương tiện di chuyển
          </Text>
          {[
            { value: 'school_car', label: 'Xe trường' },
            { value: 'taxi', label: 'Xe taxi' },
            { value: 'parent_car', label: 'Xe PHHS' },
            { value: 'other', label: 'Khác' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => {
                setHospitalTransport(opt.value);
                setShowTransportSelect(false);
              }}
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6',
              }}>
              <Text style={{ fontSize: 15, color: '#1F2937', fontFamily: 'Mulish' }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheetModal>
    </>
  );
};

export default HospitalDiagnosisForm;
