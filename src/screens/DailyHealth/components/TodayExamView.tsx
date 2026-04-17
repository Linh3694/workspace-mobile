import React, { useState } from 'react';
import { View, Text, Image, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ImageViewer from 'react-native-image-zoom-viewer';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { HealthExamination, DailyHealthVisit } from '../../../services/dailyHealthService';
import { getFullImageUrl } from '../../../utils/imageUtils';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';

interface TodayExamViewProps {
  exam: HealthExamination;
  visit: DailyHealthVisit;
  visitReason: string;
  onEdit: () => void;
  onAddSupplementary: () => void;
  onEditSupplementary: () => void;
  onAddHospitalDiagnosis?: () => void;
  onEditHospitalDiagnosis?: () => void;
}

// Parse treatment_details thành mảng { type, name, quantity, notes } — đồng bộ SIS utils
const parseTreatmentItemsStructured = (
  details: string | undefined,
  fallbackType?: string
): { type: string; name: string; quantity: string; notes: string }[] => {
  if (!details) return [];
  return details
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const trimmed = line.trim();
      let lineType = fallbackType || '';
      let content = trimmed;
      const typeMatch = trimmed.match(/^\[(\w+)\]\s*(.*)$/);
      if (typeMatch) {
        lineType = typeMatch[1];
        content = typeMatch[2].trim();
      }
      if (lineType === 'other' || lineType === 'rest' || !lineType) {
        return { type: lineType, name: content, quantity: '', notes: '' };
      }
      const withNotes = content.match(/^(.+?)\s+x\s+(.+?)\s+\((.+)\)$/);
      if (withNotes) {
        return {
          type: lineType,
          name: withNotes[1].trim(),
          quantity: withNotes[2].trim(),
          notes: withNotes[3].trim(),
        };
      }
      const withoutNotes = content.match(/^(.+?)\s+x\s+(.+)$/);
      if (withoutNotes) {
        return {
          type: lineType,
          name: withoutNotes[1].trim(),
          quantity: withoutNotes[2].trim(),
          notes: '',
        };
      }
      const nameWithNotesOnly = content.match(/^(.+?)\s+\((.+)\)$/);
      if (nameWithNotesOnly) {
        return {
          type: lineType,
          name: nameWithNotesOnly[1].trim(),
          quantity: '',
          notes: nameWithNotesOnly[2].trim(),
        };
      }
      return { type: lineType, name: content, quantity: '', notes: '' };
    });
};

const formatTime = (timeStr?: string): string => {
  if (!timeStr || !timeStr.trim()) return '-';
  const trimmed = timeStr.trim();
  const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeOnlyMatch) {
    const h = timeOnlyMatch[1].padStart(2, '0');
    const m = timeOnlyMatch[2];
    return `${h}:${m}`;
  }
  const dt = new Date(trimmed);
  if (!isNaN(dt.getTime())) {
    const h = String(dt.getHours()).padStart(2, '0');
    const m = String(dt.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return '-';
};

const isValidTime = (timeStr?: string | null): boolean => {
  if (!timeStr) return false;
  const trimmed = timeStr.trim();
  return trimmed !== '' && trimmed !== '00:00:00' && trimmed !== '00:00';
};

const sectionLabel = {
  fontSize: 12,
  fontWeight: '600' as const,
  color: '#6B7280',
  marginBottom: 4,
};
const sectionValue = { fontSize: 14, color: '#1F2937' };
const blockBg = { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 };

/** View mode thăm khám hôm nay - giao diện giống web (HealthExaminationViewMode + InitialExamView + SupplementaryExamView + DiagnosisTreatmentView) */
const TodayExamView: React.FC<TodayExamViewProps> = ({
  exam,
  visit,
  visitReason,
  onEdit,
  onAddSupplementary,
  onEditSupplementary,
  onAddHospitalDiagnosis,
  onEditHospitalDiagnosis,
}) => {
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const insets = useSafeAreaInsets();

  const hasHospitalData =
    exam.hospital_diagnosis ||
    exam.hospital_treatment ||
    exam.hospital_insurance ||
    exam.hospital_direction ||
    exam.hospital_health_monitoring ||
    exam.hospital_notes ||
    (exam.hospital_advance_cost != null && exam.hospital_advance_cost > 0) ||
    exam.hospital_payer ||
    exam.hospital_transport;

  // Kiểm tra thăm khám bổ sung - đồng bộ parent-portal (mở rộng các trường)
  const hasFollowup = !!(
    exam.followup_examination ||
    exam.followup_treatment_details ||
    exam.followup_outcome ||
    exam.followup_notes ||
    isValidTime(exam.followup_clinic_checkin_time) ||
    isValidTime(exam.followup_clinic_checkout_time) ||
    exam.followup_is_scheduled_recheck ||
    exam.followup_medical_suggestion
  );

  // Thời gian về: ưu tiên visit.leave_clinic_time (checkout Daily Health)
  const leaveTime = visit.leave_clinic_time || exam.clinic_checkout_time;

  const showResult = ['returned', 'picked_up', 'transferred'].includes(visit.status);
  const followupThenHospital = exam.followup_outcome === 'transferred';

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
        padding: 16,
      }}>
      {/* Header: Phân loại bệnh + thời gian + Nhân viên Y tế + nút Cập nhật */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#0369A1',
              marginBottom: 4,
              fontFamily: 'Mulish',
            }}>
            {exam.disease_classification || 'Chưa phân loại'}
          </Text>
          <Text
            style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', fontFamily: 'Mulish' }}>
            Cập nhật lần cuối lúc{' '}
            {formatTime(exam.modified?.split(' ')[1] || exam.creation?.split(' ')[1])}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: '#6B7280',
              fontStyle: 'italic',
              marginTop: 2,
              fontFamily: 'Mulish',
            }}>
            Nhân viên Y tế:{' '}
            {normalizeVietnameseName(exam.medical_staff_name || exam.examined_by_name || 'N/A')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onEdit}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#BAE6FD',
            backgroundColor: '#F0F9FF',
          }}>
          <Text style={{ fontSize: 12, fontWeight: '500', color: '#0369A1', fontFamily: 'Mulish' }}>
            Cập nhật
          </Text>
        </TouchableOpacity>
      </View>

      {/* 1. Lý do vào y tế */}
      <View style={{ marginBottom: 16 }}>
        <Text
          style={[
            sectionLabel,
            { fontSize: 14, fontWeight: '600', color: '#0369A1', fontFamily: 'Mulish' },
          ]}>
          Lý do vào y tế
        </Text>
        <View style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, marginTop: 8 }}>
          <Text style={[sectionValue, { fontFamily: 'Mulish' }]}>{visitReason || '-'}</Text>
        </View>
      </View>

      {/* 2. Thông tin thăm khám */}
      <View style={{ marginBottom: 16 }}>
        <Text
          style={[
            sectionLabel,
            { fontSize: 14, fontWeight: '600', color: '#0369A1', fontFamily: 'Mulish' },
          ]}>
          Thông tin thăm khám
        </Text>
        <View style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, marginTop: 8 }}>
          {(isValidTime(exam.clinic_checkin_time) || isValidTime(leaveTime)) && (
            <View style={{ flexDirection: 'row', gap: 24, marginBottom: 12 }}>
              {isValidTime(exam.clinic_checkin_time) && (
                <View>
                  <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Thời gian vào</Text>
                  <Text style={[sectionValue, { fontWeight: '500' }]}>
                    {formatTime(exam.clinic_checkin_time)}
                  </Text>
                </View>
              )}
              {isValidTime(leaveTime) && (
                <View>
                  <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Thời gian về</Text>
                  <Text style={[sectionValue, { fontWeight: '500' }]}>
                    {formatTime(leaveTime)}
                  </Text>
                </View>
              )}
            </View>
          )}
          <View style={{ marginBottom: 12 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Triệu chứng</Text>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12 }}>
              <Text style={sectionValue}>{exam.symptoms || '-'}</Text>
            </View>
          </View>
          {exam.diet_history && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Lịch sử ăn uống</Text>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12 }}>
                <Text style={sectionValue}>{exam.diet_history}</Text>
              </View>
            </View>
          )}
          {exam.images && exam.images.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Hình ảnh</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {exam.images.map((img, idx) => {
                  const fullUrl = getFullImageUrl(img.image);
                  if (!fullUrl) return null;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => {
                        setImageViewerIndex(idx);
                        setImageViewerVisible(true);
                      }}
                      activeOpacity={0.8}>
                      <Image
                        source={{ uri: fullUrl }}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                        }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Modal visible={imageViewerVisible} transparent>
                <ImageViewer
                  imageUrls={exam.images
                    .map((img) => getFullImageUrl(img.image))
                    .filter(Boolean)
                    .map((url) => ({ url: url! }))}
                  index={imageViewerIndex}
                  onCancel={() => setImageViewerVisible(false)}
                  enableSwipeDown
                  swipeDownThreshold={80}
                  renderIndicator={(currentIndex, allSize) => (
                    <View
                      style={{
                        position: 'absolute',
                        top: insets.top + 12,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                        zIndex: 9999,
                      }}>
                      <View
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 10,
                        }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: 'Mulish' }}>
                          {currentIndex + 1} / {allSize}
                        </Text>
                      </View>
                    </View>
                  )}
                />
              </Modal>
            </View>
          )}
          <View style={{ marginBottom: 12 }}>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Nhận định ban đầu</Text>
            {exam.examination_notes ? (
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12 }}>
                <Text style={sectionValue}>{exam.examination_notes}</Text>
              </View>
            ) : (
              <Text style={[sectionValue, { fontStyle: 'italic', color: '#9CA3AF' }]}>
                Chưa có nhận định
              </Text>
            )}
          </View>
          <View>
            <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Phân loại bệnh</Text>
            {exam.disease_classification ? (
              <View
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}>
                <Text style={[sectionValue, { fontSize: 14 }]}>{exam.disease_classification}</Text>
              </View>
            ) : (
              <Text style={[sectionValue, { fontStyle: 'italic', color: '#9CA3AF' }]}>
                Chưa phân loại
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* 3. Chăm sóc y tế */}
      <View style={{ marginBottom: 16 }}>
        <Text
          style={[
            sectionLabel,
            { fontSize: 14, fontWeight: '600', color: '#0369A1', fontFamily: 'Mulish' },
          ]}>
          Chăm sóc y tế
        </Text>
        {(() => {
          const items = parseTreatmentItemsStructured(exam.treatment_details, exam.treatment_type);
          if (items.length === 0) {
            return (
              <View
                style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, marginTop: 8 }}>
                <Text
                  style={[
                    sectionValue,
                    { fontStyle: 'italic', color: '#9CA3AF', fontFamily: 'Mulish' },
                  ]}>
                  Chưa có chăm sóc y tế
                </Text>
              </View>
            );
          }
          // Hiển thị giống InitialExamView (SIS): tên × SL + ghi chú trong khối trắng
          return (
            <View style={{ marginTop: 8, gap: 8 }}>
              {items.map((item, idx) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: '#F5F5F5',
                    borderRadius: 12,
                    padding: 12,
                  }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#1F2937',
                      fontFamily: 'Mulish',
                    }}>
                    {item.name}
                    {item.quantity ? ` × ${item.quantity}` : ''}
                  </Text>
                  {item.notes ? (
                    <View
                      style={{
                        marginTop: 8,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 8,
                        padding: 8,
                      }}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: '#6B7280',
                          fontStyle: 'italic',
                          fontFamily: 'Mulish',
                        }}>
                        {item.notes}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          );
        })()}
      </View>

      {/* 4. Kết quả sau khám */}
      {showResult && (
        <View style={{ marginBottom: 16 }}>
          <Text
            style={[
              sectionLabel,
              { fontSize: 14, fontWeight: '600', color: '#0369A1', fontFamily: 'Mulish' },
            ]}>
            Kết quả sau khám
          </Text>
          <View style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, marginTop: 8 }}>
            <View style={{ marginBottom: visit.checkout_notes ? 8 : 0 }}>
              <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Hướng xử trí</Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor:
                    visit.status === 'returned'
                      ? '#047857'
                      : visit.status === 'picked_up'
                        ? '#DB2777'
                        : '#BE123C',
                }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: '#FFFFFF',
                    fontFamily: 'Mulish',
                  }}>
                  {visit.status === 'returned'
                    ? 'Về lớp'
                    : visit.status === 'picked_up'
                      ? 'Phụ huynh đón'
                      : 'Chuyển viện'}
                </Text>
              </View>
            </View>
            {visit.checkout_notes && (
              <View>
                <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
                  Đề xuất của nhân viên y tế
                </Text>
                <View
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 8, marginTop: 4 }}>
                  <Text style={[sectionValue, { fontFamily: 'Mulish' }]}>
                    {visit.checkout_notes}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 5. Thăm khám bổ sung */}
      {hasFollowup ? (
        <View
          style={{
            marginBottom: 16,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
          }}>
          <Text
            style={[
              sectionLabel,
              { fontSize: 14, fontWeight: '600', color: '#0369A1', fontFamily: 'Mulish' },
            ]}>
            Thăm khám bổ sung
          </Text>

          {/* 1. Thông tin khám */}
          <View style={{ marginTop: 12 }}>
            <Text
              style={[
                sectionLabel,
                { fontSize: 14, fontWeight: '600', color: '#0369A1', fontFamily: 'Mulish' },
              ]}>
              Thông tin khám
            </Text>
            <View
              style={{
                marginTop: 8,
                backgroundColor: '#F5F5F5',
                borderRadius: 12,
                padding: 12,
              }}>
              {(isValidTime(exam.followup_clinic_checkin_time) ||
                isValidTime(exam.followup_clinic_checkout_time)) && (
                <View style={{ flexDirection: 'row', gap: 24, marginBottom: 12 }}>
                  {isValidTime(exam.followup_clinic_checkin_time) && (
                    <View>
                      <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Thời gian vào</Text>
                      <Text style={[sectionValue, { fontWeight: '500' }]}>
                        {formatTime(exam.followup_clinic_checkin_time)}
                      </Text>
                    </View>
                  )}
                  {isValidTime(exam.followup_clinic_checkout_time) && (
                    <View>
                      <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Thời gian về</Text>
                      <Text style={[sectionValue, { fontWeight: '500' }]}>
                        {formatTime(exam.followup_clinic_checkout_time)}
                      </Text>
                    </View>
                  )}
                  {!!exam.followup_is_scheduled_recheck && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: '#DBEAFE',
                        alignSelf: 'flex-start',
                      }}>
                      <Text style={{ fontSize: 12, color: '#1D4ED8', fontFamily: 'Mulish' }}>
                        Khám lại theo hẹn
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {exam.followup_medical_staff_name && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
                    Nhân viên Y tế thăm khám
                  </Text>
                  <Text style={[sectionValue, { fontWeight: '500' }]}>
                    {normalizeVietnameseName(exam.followup_medical_staff_name)}
                  </Text>
                </View>
              )}
              <View>
                <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Nhận định ban đầu</Text>
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 8,
                    padding: 12,
                    marginTop: 4,
                  }}>
                  <Text style={[sectionValue, { fontFamily: 'Mulish' }]}>
                    {exam.followup_examination}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 2. Chăm sóc y tế */}
          <View style={{ marginTop: 16 }}>
            <Text
              style={[
                sectionLabel,
                { fontSize: 14, fontWeight: '600', color: '#0369A1', fontFamily: 'Mulish' },
              ]}>
              Chăm sóc y tế
            </Text>
            {(() => {
              const items = parseTreatmentItemsStructured(exam.followup_treatment_details);
              if (items.length === 0) {
                return (
                  <View
                    style={{
                      marginTop: 8,
                      backgroundColor: '#F5F5F5',
                      borderRadius: 12,
                      padding: 12,
                    }}>
                    <Text
                      style={[
                        sectionValue,
                        { fontStyle: 'italic', color: '#9CA3AF', fontFamily: 'Mulish' },
                      ]}>
                      Chưa có chăm sóc y tế
                    </Text>
                  </View>
                );
              }
              return (
                <View style={{ marginTop: 8, gap: 8 }}>
                  {items.map((item, idx) => (
                    <View
                      key={idx}
                      style={{
                        backgroundColor: '#F5F5F5',
                        borderRadius: 12,
                        padding: 12,
                      }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: '#1F2937',
                          fontFamily: 'Mulish',
                        }}>
                        {item.name}
                        {item.quantity ? ` × ${item.quantity}` : ''}
                      </Text>
                      {item.notes ? (
                        <View
                          style={{
                            marginTop: 8,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 8,
                            padding: 8,
                          }}>
                          <Text
                            style={{
                              fontSize: 12,
                              color: '#6B7280',
                              fontStyle: 'italic',
                              fontFamily: 'Mulish',
                            }}>
                            {item.notes}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>

          {/* 3. Kết quả sau chăm sóc */}
          {(exam.followup_outcome || exam.followup_medical_suggestion) && (
            <View style={{ marginTop: 16 }}>
              <Text
                style={[
                  sectionLabel,
                  { fontSize: 14, fontWeight: '600', color: '#0369A1', fontFamily: 'Mulish' },
                ]}>
                Kết quả sau chăm sóc
              </Text>
              <View
                style={{
                  marginTop: 8,
                  backgroundColor: '#F5F5F5',
                  borderRadius: 12,
                  padding: 12,
                }}>
                {exam.followup_outcome && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
                      Hướng xử trí
                    </Text>
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor:
                          exam.followup_outcome === 'return_class' ||
                          exam.followup_outcome === 'returned'
                            ? '#047857'
                            : exam.followup_outcome === 'picked_up'
                              ? '#DB2777'
                              : '#BE123C',
                      }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '500',
                          color: '#FFFFFF',
                          fontFamily: 'Mulish',
                        }}>
                        {exam.followup_outcome === 'return_class' ||
                        exam.followup_outcome === 'returned'
                          ? 'Về lớp'
                          : exam.followup_outcome === 'picked_up'
                            ? 'Phụ huynh đón'
                            : 'Chuyển viện'}
                      </Text>
                    </View>
                  </View>
                )}
                {exam.followup_outcome === 'transferred' &&
                  (exam.followup_transfer_hospital ||
                    exam.followup_accompanying_teacher ||
                    exam.followup_accompanying_health_staff) && (
                    <View
                      style={{
                        marginBottom: 12,
                        padding: 8,
                        backgroundColor: '#FEF2F2',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#FECACA',
                      }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: '#B91C1C',
                          marginBottom: 8,
                          fontFamily: 'Mulish',
                        }}>
                        Thông tin chuyển viện
                      </Text>
                      {exam.followup_transfer_hospital && (
                        <Text
                          style={[
                            sectionValue,
                            {
                              fontSize: 12,
                              marginBottom: 4,
                              color: '#B91C1C',
                              fontFamily: 'Mulish',
                            },
                          ]}>
                          <Text style={{ fontWeight: '600', color: '#B91C1C' }}>Bệnh viện chuyển tới: </Text>
                          {exam.followup_transfer_hospital}
                        </Text>
                      )}
                      {exam.followup_accompanying_teacher && (
                        <Text
                          style={[
                            sectionValue,
                            {
                              fontSize: 12,
                              marginBottom: 4,
                              color: '#B91C1C',
                              fontFamily: 'Mulish',
                            },
                          ]}>
                          <Text style={{ fontWeight: '600', color: '#B91C1C' }}>
                            Thầy/ cô đi cùng:{' '}
                          </Text>
                          {exam.followup_accompanying_teacher}
                        </Text>
                      )}
                      {exam.followup_accompanying_health_staff && (
                        <Text
                          style={[
                            sectionValue,
                            { fontSize: 12, color: '#B91C1C', fontFamily: 'Mulish' },
                          ]}>
                          <Text style={{ fontWeight: '600', color: '#B91C1C' }}>
                            Nhân viên Y tế đi cùng:{' '}
                          </Text>
                          {exam.followup_accompanying_health_staff}
                        </Text>
                      )}
                    </View>
                  )}
                {exam.followup_medical_suggestion && (
                  <View>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
                      Đề xuất của nhân viên y tế
                    </Text>
                    <View
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 8,
                        padding: 8,
                        marginTop: 4,
                      }}>
                      <Text style={[sectionValue, { fontFamily: 'Mulish' }]}>
                        {exam.followup_medical_suggestion}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}
          <TouchableOpacity
            onPress={onEditSupplementary}
            style={{
              marginTop: 16,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#BAE6FD',
              alignSelf: 'flex-start',
            }}>
            <Text
              style={{ fontSize: 12, fontWeight: '500', color: '#0369A1', fontFamily: 'Mulish' }}>
              Chỉnh sửa thăm khám bổ sung
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={{
            marginBottom: 16,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
          }}>
          <TouchableOpacity
            onPress={onAddSupplementary}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#BAE6FD',
            }}>
            <Ionicons name="add" size={16} color="#0369A1" />
            <Text
              style={{
                marginLeft: 8,
                fontSize: 14,
                fontWeight: '500',
                color: '#0369A1',
                fontFamily: 'Mulish',
              }}>
              Thăm khám bổ sung
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 6. Chẩn đoán & điều trị tại bệnh viện - block cố định (giống Thăm khám bổ sung) */}
      {visit.status === 'transferred' && (
        <View
          style={{
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
          }}>
          <Text
            style={[
              sectionLabel,
              { fontSize: 14, fontWeight: '600', color: '#BE123C', fontFamily: 'Mulish' },
            ]}>
            Chẩn đoán & điều trị tại bệnh viện
          </Text>
          {hasHospitalData ? (
            <>
              <View style={{ marginTop: 8 }}>
                {exam.hospital_insurance && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
                      Bảo hiểm sức khỏe tự nguyện
                    </Text>
                    <Text style={sectionValue}>
                      {exam.hospital_insurance === 'student_insured' ? 'HS có mua' : 'HS không mua'}
                    </Text>
                  </View>
                )}
                {/* Bệnh viện chuyển tới - tách khỏi Phối hợp */}
                {visit.transfer_hospital && (
                  <View style={[blockBg, { marginBottom: 12 }]}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Bệnh viện chuyển tới</Text>
                    <Text style={sectionValue}>{visit.transfer_hospital}</Text>
                  </View>
                )}
                {/* Phối hợp từ phía nhà trường */}
                {(visit.accompanying_teacher || visit.accompanying_health_staff) && (
                  <View style={[blockBg, { marginBottom: 12 }]}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
                      Phối hợp từ phía nhà trường
                    </Text>
                    {visit.accompanying_teacher && (
                      <View style={{ marginTop: 4 }}>
                        <Text style={[sectionLabel, { fontFamily: 'Mulish', fontSize: 12 }]}>
                          Thầy/ cô đi cùng
                        </Text>
                        <Text style={sectionValue}>{visit.accompanying_teacher}</Text>
                      </View>
                    )}
                    {visit.accompanying_health_staff && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={[sectionLabel, { fontFamily: 'Mulish', fontSize: 12 }]}>
                          Nhân viên Y tế đi cùng
                        </Text>
                        <Text style={sectionValue}>{visit.accompanying_health_staff}</Text>
                      </View>
                    )}
                  </View>
                )}
                {exam.hospital_medical_staff_name && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
                      Nhân viên Y tế phụ trách
                    </Text>
                    <Text style={sectionValue}>
                      {normalizeVietnameseName(exam.hospital_medical_staff_name || 'N/A')}
                    </Text>
                  </View>
                )}
                {exam.hospital_diagnosis && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
                      Chẩn đoán tại bệnh viện
                    </Text>
                    <Text style={sectionValue}>{exam.hospital_diagnosis}</Text>
                  </View>
                )}
                {exam.hospital_direction && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Hướng xử trí</Text>
                    <Text style={sectionValue}>{exam.hospital_direction}</Text>
                  </View>
                )}
                {exam.hospital_advance_cost != null && exam.hospital_advance_cost > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
                      Chi phí Y tế tạm ứng
                    </Text>
                    <Text style={sectionValue}>
                      {Number(exam.hospital_advance_cost).toLocaleString('vi-VN')} VNĐ
                    </Text>
                  </View>
                )}
                {exam.hospital_payer && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Bên chi trả</Text>
                    <Text style={sectionValue}>
                      {exam.hospital_payer === 'company'
                        ? 'Công ty'
                        : exam.hospital_payer === 'parent'
                          ? 'PHHS'
                          : exam.hospital_payer_other || 'Khác'}
                    </Text>
                  </View>
                )}
                {exam.hospital_transport && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
                      Phương tiện di chuyển
                    </Text>
                    <Text style={sectionValue}>
                      {exam.hospital_transport === 'school_car'
                        ? 'Xe trường'
                        : exam.hospital_transport === 'taxi'
                          ? 'Xe taxi'
                          : exam.hospital_transport === 'parent_car'
                            ? 'Xe PHHS'
                            : exam.hospital_transport_other || 'Khác'}
                    </Text>
                  </View>
                )}
                {exam.hospital_health_monitoring && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>
                      Theo dõi tình trạng SK HS
                    </Text>
                    <Text style={sectionValue}>{exam.hospital_health_monitoring}</Text>
                  </View>
                )}
                {exam.hospital_notes && (
                  <View style={blockBg}>
                    <Text style={[sectionLabel, { fontFamily: 'Mulish' }]}>Ghi chú</Text>
                    <Text style={sectionValue}>{exam.hospital_notes}</Text>
                  </View>
                )}
              </View>
              {/* Thông báo theo dõi sức khoẻ - đồng bộ parent-portal */}
            <Text
              style={{
                marginTop: 12,
                fontSize: 14,
                fontStyle: 'italic',
                color: '#757575',
                fontFamily: 'Mulish',
              }}>
              Bộ phận y tế nhà trường sẽ tiếp tục theo dõi tình trạng sức khoẻ của học sinh tại
              trường cho đến khi ổn định và sẽ kịp thời thông tin đến phụ huynh khi có vấn đề sức
              khoẻ cần lưu ý.
            </Text>
            {onEditHospitalDiagnosis && (
                <TouchableOpacity
                  onPress={onEditHospitalDiagnosis}
                  style={{
                    marginTop: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#BE123C',
                    alignSelf: 'flex-start',
                  }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '500',
                      color: '#BE123C',
                      fontFamily: 'Mulish',
                    }}>
                    Chỉnh sửa chẩn đoán & điều trị
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : onAddHospitalDiagnosis ? (
            <>
              <TouchableOpacity
                onPress={onAddHospitalDiagnosis}
                style={{
                  marginTop: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#BE123C',
                }}>
                <Ionicons name="add" size={16} color="#BE123C" />
                <Text
                  style={{
                    marginLeft: 8,
                    fontSize: 14,
                    fontWeight: '500',
                    color: '#BE123C',
                    fontFamily: 'Mulish',
                  }}>
                  Thêm chẩn đoán & điều trị tại bệnh viện
                </Text>
              </TouchableOpacity>
              <Text
                style={{
                  marginTop: 12,
                  fontSize: 14,
                  fontStyle: 'italic',
                  color: '#757575',
                  fontFamily: 'Mulish',
                }}>
                Bộ phận y tế nhà trường sẽ tiếp tục theo dõi tình trạng sức khoẻ của học sinh tại
                trường cho đến khi ổn định và sẽ kịp thời thông tin đến phụ huynh khi có vấn đề sức
                khoẻ cần lưu ý.
              </Text>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
};

export default TodayExamView;
