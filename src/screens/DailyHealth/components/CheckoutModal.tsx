/**
 * Modal Checkout học sinh - đồng bộ với web (HealthExaminationPage Dialog Checkout)
 * Trạng thái khi rời PYT, ghi chú, thông tin chuyển viện nếu có
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '../../../components/Common';
import { VisitOutcome } from '../../../services/dailyHealthService';

const OUTCOME_OPTIONS: { value: VisitOutcome; label: string }[] = [
  { value: 'returned', label: 'Học sinh về lớp' },
  { value: 'picked_up', label: 'Phụ huynh đón' },
  { value: 'transferred', label: 'Chuyển viện' },
];

interface CheckoutModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (params: {
    outcome: VisitOutcome;
    checkoutNotes?: string;
    transferHospital?: string;
    accompanyingTeacher?: string;
    accompanyingHealthStaff?: string;
  }) => Promise<void>;
  loading?: boolean;
}

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

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  visible,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [outcome, setOutcome] = useState<VisitOutcome | ''>('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [transferHospital, setTransferHospital] = useState('');
  const [accompanyingTeacher, setAccompanyingTeacher] = useState('');
  const [accompanyingHealthStaff, setAccompanyingHealthStaff] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset form khi mở modal
  useEffect(() => {
    if (visible) {
      setOutcome('');
      setCheckoutNotes('');
      setTransferHospital('');
      setAccompanyingTeacher('');
      setAccompanyingHealthStaff('');
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (!outcome) return;
    setSubmitting(true);
    try {
      await onConfirm({
        outcome,
        checkoutNotes: checkoutNotes.trim() || undefined,
        transferHospital: outcome === 'transferred' ? transferHospital.trim() || undefined : undefined,
        accompanyingTeacher: outcome === 'transferred' ? accompanyingTeacher.trim() || undefined : undefined,
        accompanyingHealthStaff: outcome === 'transferred' ? accompanyingHealthStaff.trim() || undefined : undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitting = loading || submitting;

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPercent={85} fillHeight>
      <View style={{ flex: 1, padding: 16 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
          }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#002855', fontFamily: 'Mulish' }}>
            Check out học sinh
          </Text>
          <TouchableOpacity onPress={onClose} disabled={isSubmitting} style={{ padding: 8 }}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 16, fontFamily: 'Mulish' }}>
          Xác nhận trạng thái khi học sinh rời phòng Y tế
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {/* Trạng thái khi rời PYT (*) */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
              Trạng thái khi rời Phòng y tế <Text style={{ color: '#BE123C' }}>*</Text>
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
              {OUTCOME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setOutcome(opt.value)}
                  style={{
                    margin: 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: outcome === opt.value ? '#ECFDF5' : '#F3F4F6',
                    borderWidth: outcome === opt.value ? 1 : 0,
                    borderColor: outcome === opt.value ? '#A7F3D0' : 'transparent',
                  }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: outcome === opt.value ? '#047857' : '#6B7280',
                      fontFamily: 'Mulish',
                    }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Nếu chuyển viện: Bệnh viện chuyển tới, Thầy/ cô đi cùng, NVYT đi cùng */}
          {outcome === 'transferred' && (
            <>
              <View style={{ marginBottom: 16 }}>
                <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Bệnh viện chuyển tới</Text>
                <TextInput
                  style={[inputStyle, { fontFamily: 'Mulish' }]}
                  value={transferHospital}
                  onChangeText={setTransferHospital}
                  placeholder="Nhập tên bệnh viện chuyển tới..."
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Thầy/ cô đi cùng</Text>
                <TextInput
                  style={[inputStyle, { fontFamily: 'Mulish' }]}
                  value={accompanyingTeacher}
                  onChangeText={setAccompanyingTeacher}
                  placeholder="Nhập tên giáo viên đi cùng..."
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Nhân viên Y tế đi cùng</Text>
                <TextInput
                  style={[inputStyle, { fontFamily: 'Mulish' }]}
                  value={accompanyingHealthStaff}
                  onChangeText={setAccompanyingHealthStaff}
                  placeholder="Nhập tên Nhân viên Y tế đi cùng..."
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </>
          )}

          {/* Đề xuất / Dặn dò */}
          <View style={{ marginBottom: 24 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Đề xuất / Dặn dò</Text>
            <TextInput
              style={[
                inputStyle,
                { minHeight: 100, textAlignVertical: 'top', fontFamily: 'Mulish' },
              ]}
              value={checkoutNotes}
              onChangeText={setCheckoutNotes}
              placeholder="Nhập đề xuất hoặc dặn dò cho học sinh/giáo viên..."
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
          }}>
          <TouchableOpacity
            onPress={onClose}
            disabled={isSubmitting}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              alignItems: 'center',
            }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280', fontFamily: 'Mulish' }}>
              Hủy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={isSubmitting || !outcome}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: isSubmitting || !outcome ? '#E5E7EB' : '#FFF7ED',
              borderWidth: isSubmitting || !outcome ? 0 : 1,
              borderColor: isSubmitting || !outcome ? 'transparent' : '#FED7AA',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}>
            {isSubmitting ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text
                  style={{
                    marginLeft: 8,
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#FFFFFF',
                    fontFamily: 'Mulish',
                  }}>
                  Đang xử lý...
                </Text>
              </>
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: outcome ? '#C2410C' : '#9CA3AF',
                  fontFamily: 'Mulish',
                }}>
                Xác nhận
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetModal>
  );
};

export default CheckoutModal;
