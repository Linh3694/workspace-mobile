import React, { useState, useMemo } from 'react';
import { View, Text, Image } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { HealthExamination } from '../../../services/dailyHealthService';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';

interface ExaminationHistoryListProps {
  examinations: HealthExamination[];
  visitReason?: string;
  onViewDetail?: (exam: HealthExamination) => void;
}

const UNCLASSIFIED_VALUE = '__unclassified__';

// Helper: Parse treatment_details thành mảng { type, name, quantity, notes }
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

const formatStayDuration = (
  checkin?: string | null,
  checkout?: string | null,
  fallback?: string
): string => {
  const parts = [
    isValidTime(checkin) ? formatTime(checkin || undefined) : '',
    isValidTime(checkout) ? formatTime(checkout || undefined) : '',
  ].filter(Boolean);
  if (parts.length === 2) return `${parts[0]} - ${parts[1]}`;
  if (parts.length === 1) return parts[0];
  if (fallback) return formatTime(fallback);
  return '---';
};

const getExamClassificationValue = (exam: HealthExamination): string =>
  exam.disease_classification?.trim() || UNCLASSIFIED_VALUE;

const getExamClassificationLabel = (value: string): string =>
  value === UNCLASSIFIED_VALUE ? 'Chưa phân loại' : value;

const getOutcomeLabel = (outcome: string | undefined): string => {
  if (!outcome) return '';
  const labels: Record<string, string> = {
    return_class: 'Về lớp',
    returned: 'Về lớp',
    picked_up: 'Phụ huynh đón',
    transferred: 'Chuyển viện',
  };
  return labels[outcome] || outcome;
};

const getOutcomeColor = (outcome?: string): { bg: string; text: string } => {
  if (outcome === 'return_class' || outcome === 'returned')
    return { bg: '#0A7892', text: '#FFFFFF' };
  if (outcome === 'picked_up') return { bg: '#F5AA1E', text: '#FFFFFF' };
  if (outcome === 'transferred') return { bg: '#E45757', text: '#FFFFFF' };
  return { bg: '#EEF2F7', text: '#4B5563' };
};

const formatDateDisplay = (dateValue: string): string => {
  try {
    const date = new Date(dateValue);
    const weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    return `${weekdays[date.getDay()]}, ${d}/${m}/${y}`;
  } catch {
    return dateValue;
  }
};

const ExaminationHistoryList: React.FC<ExaminationHistoryListProps> = ({
  examinations,
  visitReason,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groupedByDate = useMemo(() => {
    const byDate: Record<string, HealthExamination[]> = {};
    examinations.forEach((exam) => {
      const date = exam.examination_date;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(exam);
    });
    return Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a));
  }, [examinations]);

  if (examinations.length === 0) {
    return (
      <View className="items-center py-12">
        <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
        <Text className="mt-2 text-gray-500">Chưa có lịch sử thăm khám</Text>
      </View>
    );
  }

  const sectionStyles = {
    label: { fontSize: 12, fontWeight: '600' as const, color: '#6B7280', marginBottom: 4 },
    value: { fontSize: 14, color: '#1F2937' },
    block: { backgroundColor: '#F7F8FA', borderRadius: 12, padding: 12, marginTop: 8 },
  };

  return (
    <View style={{ paddingBottom: 24 }}>
      {groupedByDate.map(([date, exams], dayIndex) => {
        const groupMap = new Map<string, HealthExamination[]>();
        exams.forEach((exam) => {
          const key = getExamClassificationValue(exam);
          if (!groupMap.has(key)) groupMap.set(key, []);
          groupMap.get(key)!.push(exam);
        });
        const groups = Array.from(groupMap.entries()).map(([classification, examsInGroup]) => ({
          classification,
          exams: examsInGroup,
        }));

        return (
          <View key={date} style={{ marginBottom: 24, paddingLeft: 28 }}>
            {/* Timeline line */}
            {dayIndex < groupedByDate.length - 1 && (
              <View
                style={{
                  position: 'absolute',
                  left: 11,
                  top: 24,
                  bottom: -24,
                  width: 1,
                  backgroundColor: '#D9E3E8',
                }}
              />
            )}
            {/* Timeline dot */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 4,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#E6F7F4',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#0A9D94',
                }}
              />
            </View>

            <Text
              style={{
                fontSize: 18,
                fontWeight: '500',
                color: '#5B6470',
                marginBottom: 16,
                fontFamily: 'Mulish',
              }}>
              {formatDateDisplay(date)}
            </Text>

            {groups.map((group, groupIdx) => {
              const groupKey = `${date}__${group.classification}`;
              const isGroupOpen = expandedGroups.has(groupKey);

              return (
                <View
                  key={group.classification}
                  style={{
                    marginBottom: 12,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#EAEAEA',
                    overflow: 'hidden',
                  }}>
                  {/* Group header */}
                  <TouchableOpacity
                    onPress={() => toggleGroup(groupKey)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 16,
                      backgroundColor: '#F7F8FA',
                    }}>
                    <View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '500',
                          color: '#9CA3AF',
                          fontFamily: 'Mulish',
                        }}>
                        Hồ sơ {groupIdx + 1}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 4,
                        }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: '#002855',
                            fontFamily: 'Mulish',
                          }}
                          numberOfLines={1}>
                          {getExamClassificationLabel(group.classification)}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 2,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            backgroundColor: '#FFFFFF',
                          }}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '500',
                              color: '#6B7280',
                              fontFamily: 'Mulish',
                            }}>
                            {group.exams.length} lượt khám
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons
                      name={isGroupOpen ? 'chevron-down' : 'chevron-forward'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>

                  {isGroupOpen && (
                    <View
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderTopWidth: 1,
                        borderTopColor: '#F3F4F6',
                      }}>
                      {group.exams.map((exam, examIdx) => {
                        const staffName = normalizeVietnameseName(
                          exam.medical_staff_name || exam.examined_by_name || ''
                        );
                        const visitReasonVal = visitReason || exam.symptoms || '-';
                        const checkoutNotes = exam.checkout_notes ?? '';

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

                        const hasHospital = !!(
                          exam.outcome === 'transferred' ||
                          exam.followup_outcome === 'transferred' ||
                          exam.followup_transfer_hospital ||
                          exam.hospital_diagnosis ||
                          exam.hospital_direction ||
                          exam.hospital_health_monitoring
                        );

                        return (
                          <View key={exam.name}>
                            {examIdx > 0 && (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginVertical: 24,
                                  paddingHorizontal: 16,
                                }}>
                                <View style={{ flex: 1, height: 4, backgroundColor: '#D9E3E8' }} />
                                <Text
                                  style={{
                                    fontSize: 14,
                                    fontWeight: '600',
                                    color: '#5B6470',
                                    fontFamily: 'Mulish',
                                    marginHorizontal: 8,
                                  }}>
                                  Lượt khám {examIdx + 1}
                                </Text>
                                <View style={{ flex: 1, height: 4, backgroundColor: '#D9E3E8' }} />
                              </View>
                            )}

                            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                              {/* === Thăm khám ban đầu === */}
                              <ExamSection
                                title="Thăm khám ban đầu"
                                titleColor="#0A7892"
                                sectionKey={`${exam.name}_initial`}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                summaryItems={[
                                  {
                                    label: 'Thời gian lưu',
                                    value: formatStayDuration(
                                      exam.clinic_checkin_time,
                                      exam.clinic_checkout_time,
                                      exam.creation || exam.modified
                                    ),
                                  },
                                  {
                                    label: 'NVYT phụ trách',
                                    value: staffName || '---',
                                  },
                                  {
                                    label: 'Trạng thái HS',
                                    value: exam.outcome ? getOutcomeLabel(exam.outcome) : '---',
                                    isBadge: !!exam.outcome,
                                    badgeColor: exam.outcome
                                      ? getOutcomeColor(exam.outcome)
                                      : undefined,
                                  },
                                ]}>
                                <View>
                                  <View style={{ marginTop: 12 }}>
                                    <Text style={[sectionStyles.label, { color: '#0A7892' }]}>
                                      {'Thông tin tiếp nhận'}
                                    </Text>
                                    <View style={sectionStyles.block}>
                                      <Text style={sectionStyles.label}>Thời gian lưu</Text>
                                      <Text style={[sectionStyles.value, { fontWeight: '600' }]}>
                                        {formatStayDuration(
                                          exam.clinic_checkin_time,
                                          exam.clinic_checkout_time,
                                          exam.creation || exam.modified
                                        )}
                                      </Text>
                                      <Text style={[sectionStyles.label, { marginTop: 8 }]}>
                                        Lý do vào y tế
                                      </Text>
                                      <Text style={sectionStyles.value}>{visitReasonVal}</Text>
                                      {exam.symptoms && (
                                        <View>
                                          <Text style={[sectionStyles.label, { marginTop: 8 }]}>
                                            Triệu chứng
                                          </Text>
                                          <Text style={sectionStyles.value}>{exam.symptoms}</Text>
                                        </View>
                                      )}
                                      {exam.diet_history && (
                                        <View>
                                          <Text style={[sectionStyles.label, { marginTop: 8 }]}>
                                            Lịch sử ăn uống
                                          </Text>
                                          <Text style={sectionStyles.value}>{exam.diet_history}</Text>
                                        </View>
                                      )}
                                      {exam.examination_notes && (
                                        <View>
                                          <Text style={[sectionStyles.label, { marginTop: 8 }]}>
                                            Nhận định ban đầu
                                          </Text>
                                          <Text style={sectionStyles.value}>
                                            {exam.examination_notes}
                                          </Text>
                                        </View>
                                      )}
                                      {exam.disease_classification && (
                                        <View>
                                          <Text style={[sectionStyles.label, { marginTop: 8 }]}>
                                            Phân loại bệnh
                                          </Text>
                                          <Text style={[sectionStyles.value, { fontWeight: '600' }]}>
                                            {exam.disease_classification}
                                          </Text>
                                        </View>
                                      )}
                                      {exam.images && exam.images.length > 0 && (
                                        <View style={{ marginTop: 12 }}>
                                          <Text style={sectionStyles.label}>Hình ảnh</Text>
                                          <View
                                            style={{
                                              flexDirection: 'row',
                                              flexWrap: 'wrap',
                                              gap: 8,
                                              marginTop: 8,
                                            }}>
                                            {exam.images.map((img, idx) => (
                                              <Image
                                                key={idx}
                                                source={{ uri: img.image }}
                                                style={{ width: 64, height: 64, borderRadius: 8 }}
                                                resizeMode="cover"
                                              />
                                            ))}
                                          </View>
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                  {(() => {
                                    const items = parseTreatmentItemsStructured(
                                      exam.treatment_details,
                                      exam.treatment_type
                                    );
                                    if (items.length === 0) return null;
                                    return (
                                      <View style={{ marginTop: 12 }}>
                                        <Text style={[sectionStyles.label, { color: '#0A7892' }]}>
                                          Chăm sóc y tế
                                        </Text>
                                        {items.map((item, idx) => (
                                          <View
                                            key={idx}
                                            style={{
                                              backgroundColor: '#F5F5F5',
                                              borderRadius: 12,
                                              padding: 12,
                                              marginTop: 8,
                                            }}>
                                            <Text style={[sectionStyles.value, { fontWeight: '600' }]}>
                                              {item.name}
                                              {item.quantity ? ` × ${item.quantity}` : ''}
                                            </Text>
                                            {item.notes ? (
                                              <View
                                                style={{
                                                  backgroundColor: '#FFFFFF',
                                                  borderRadius: 12,
                                                  padding: 8,
                                                  marginTop: 8,
                                                }}>
                                                <Text
                                                  style={{
                                                    fontSize: 12,
                                                    fontStyle: 'italic',
                                                    color: '#6B7280',
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
                                  {(exam.outcome || checkoutNotes) && (
                                    <View style={{ marginTop: 12 }}>
                                      <Text style={[sectionStyles.label, { color: '#0A7892' }]}>
                                        Hướng xử trí sau thăm khám
                                      </Text>
                                      <View
                                        style={{
                                          backgroundColor: '#F5F5F5',
                                          borderRadius: 12,
                                          padding: 12,
                                          marginTop: 8,
                                        }}>
                                        {exam.outcome && (
                                          <View style={{ marginBottom: checkoutNotes ? 8 : 0 }}>
                                            <Text style={sectionStyles.label}>
                                              Trạng thái học sinh
                                            </Text>
                                            <View
                                              style={{
                                                alignSelf: 'flex-start',
                                                paddingHorizontal: 10,
                                                paddingVertical: 4,
                                                borderRadius: 12,
                                                backgroundColor: getOutcomeColor(exam.outcome).bg,
                                              }}>
                                              <Text
                                                style={{
                                                  fontSize: 12,
                                                  fontWeight: '500',
                                                  color: getOutcomeColor(exam.outcome).text,
                                                }}>
                                                {getOutcomeLabel(exam.outcome)}
                                              </Text>
                                            </View>
                                          </View>
                                        )}
                                        {checkoutNotes && (
                                          <View>
                                            <Text style={[sectionStyles.label, { color: '#757575' }]}>
                                              Đề xuất của nhân viên y tế
                                            </Text>
                                            <Text style={sectionStyles.value}>{checkoutNotes}</Text>
                                          </View>
                                        )}
                                      </View>
                                    </View>
                                  )}
                                </View>
                              </ExamSection>

                              {/* === Thăm khám bổ sung === */}
                              {hasFollowup && (
                                <ExamSection
                                  title="Thăm khám bổ sung"
                                  titleColor="#0A9D94"
                                  sectionKey={`${exam.name}_followup`}
                                  expandedSections={expandedSections}
                                  toggleSection={toggleSection}
                                  summaryItems={[
                                    {
                                      label: 'Thời gian lưu',
                                      value: formatStayDuration(
                                        exam.followup_clinic_checkin_time,
                                        exam.followup_clinic_checkout_time
                                      ),
                                    },
                                    {
                                      label: 'NVYT phụ trách',
                                      value:
                                        normalizeVietnameseName(
                                          exam.followup_medical_staff_name || ''
                                        ) || '---',
                                    },
                                    {
                                      label: 'Trạng thái HS',
                                      value: exam.followup_outcome
                                        ? getOutcomeLabel(exam.followup_outcome)
                                        : '---',
                                      isBadge: !!exam.followup_outcome,
                                      badgeColor: exam.followup_outcome
                                        ? getOutcomeColor(exam.followup_outcome)
                                        : undefined,
                                    },
                                  ]}>
                                  <View>
                                    <View style={{ marginTop: 12 }}>
                                      <Text style={[sectionStyles.label, { color: '#0A9D94' }]}>
                                        {'Thông tin tiếp nhận'}
                                      </Text>
                                      <View style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, marginTop: 8 }}>
                                        <Text style={sectionStyles.label}>
                                          {'Thời gian lưu'}
                                        </Text>
                                        <Text style={[sectionStyles.value, { fontWeight: '600' }]}>
                                          {formatStayDuration(
                                            exam.followup_clinic_checkin_time,
                                            exam.followup_clinic_checkout_time
                                          )}
                                        </Text>
                                        {exam.followup_is_scheduled_recheck ? (
                                          <View
                                            style={{
                                              marginTop: 8,
                                              alignSelf: 'flex-start',
                                              paddingHorizontal: 8,
                                              paddingVertical: 4,
                                              borderRadius: 8,
                                              backgroundColor: '#DBEAFE',
                                            }}>
                                            <Text style={{ fontSize: 12, color: '#1D4ED8' }}>
                                              {'Khám lại theo hẹn'}
                                            </Text>
                                          </View>
                                        ) : null}
                                        {exam.followup_examination ? (
                                          <View>
                                            <Text style={[sectionStyles.label, { marginTop: 8 }]}>
                                              {'Nhận định ban đầu'}
                                            </Text>
                                            <Text style={sectionStyles.value}>
                                              {exam.followup_examination}
                                            </Text>
                                          </View>
                                        ) : null}
                                      </View>
                                    </View>
                                    {parseTreatmentItemsStructured(exam.followup_treatment_details).length > 0 ? (
                                      <View style={{ marginTop: 12 }}>
                                        <Text style={[sectionStyles.label, { color: '#0A9D94' }]}>
                                          {'Chăm sóc y tế'}
                                        </Text>
                                        {parseTreatmentItemsStructured(exam.followup_treatment_details).map((item, idx) => (
                                            <View key={idx} style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, marginTop: 8 }}>
                                              <Text style={[sectionStyles.value, { fontWeight: '600' }]}>
                                                {item.name}
                                                {item.quantity ? ` × ${item.quantity}` : ''}
                                              </Text>
                                              {item.notes ? (
                                                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 8, marginTop: 8 }}>
                                                  <Text style={{ fontSize: 12, fontStyle: 'italic', color: '#6B7280' }}>
                                                    {item.notes}
                                                  </Text>
                                                </View>
                                              ) : null}
                                            </View>
                                          ))}
                                      </View>
                                    ) : null}
                                    {(exam.followup_outcome || exam.followup_medical_suggestion || exam.followup_notes) ? (
                                      <View style={{ marginTop: 12 }}>
                                        <Text style={[sectionStyles.label, { color: '#0A9D94' }]}>
                                          {'Hướng xử trí sau thăm khám'}
                                        </Text>
                                        <View style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, marginTop: 8 }}>
                                          {exam.followup_outcome ? (
                                            <View style={{ marginBottom: 8 }}>
                                              <Text style={sectionStyles.label}>
                                                {'Trạng thái học sinh'}
                                              </Text>
                                              <View
                                                style={{
                                                  alignSelf: 'flex-start',
                                                  paddingHorizontal: 10,
                                                  paddingVertical: 4,
                                                  borderRadius: 12,
                                                  backgroundColor: getOutcomeColor(exam.followup_outcome).bg,
                                                }}>
                                                <Text style={{ fontSize: 12, fontWeight: '500', color: getOutcomeColor(exam.followup_outcome).text }}>
                                                  {getOutcomeLabel(exam.followup_outcome)}
                                                </Text>
                                              </View>
                                            </View>
                                          ) : null}
                                          {exam.followup_medical_suggestion ? (
                                            <View style={{ marginBottom: 8 }}>
                                              <Text style={sectionStyles.label}>
                                                {'Đề xuất của NVYT'}
                                              </Text>
                                              <Text style={sectionStyles.value}>
                                                {exam.followup_medical_suggestion}
                                              </Text>
                                            </View>
                                          ) : null}
                                          {exam.followup_notes ? (
                                            <View>
                                              <Text style={sectionStyles.label}>
                                                {'Ghi chú'}
                                              </Text>
                                              <Text style={sectionStyles.value}>
                                                {exam.followup_notes}
                                              </Text>
                                            </View>
                                          ) : null}
                                        </View>
                                      </View>
                                    ) : null}
                                  </View>
                                </ExamSection>
                              )}

                              {/* === Chẩn đoán & điều trị tại bệnh viện === */}
                              {hasHospital && (
                                <ExamSection
                                  title="Chẩn đoán & điều trị tại bệnh viện"
                                  titleColor="#E45757"
                                  sectionKey={`${exam.name}_hospital`}
                                  expandedSections={expandedSections}
                                  toggleSection={toggleSection}>
                                  <View style={{ marginTop: 12 }}>
                                    <View
                                      style={{
                                        backgroundColor: '#F7F8FA',
                                        borderRadius: 12,
                                        padding: 12,
                                      }}>
                                      <Text style={sectionStyles.label}>Bệnh viện chuyển tới</Text>
                                      <Text style={[sectionStyles.value, { fontWeight: '600' }]}>
                                        {exam.followup_transfer_hospital ||
                                          'Chưa cập nhật'}
                                      </Text>
                                      <Text style={[sectionStyles.label, { marginTop: 8 }]}>
                                        Chẩn đoán tại bệnh viện
                                      </Text>
                                      <Text style={[sectionStyles.value, { fontWeight: '600' }]}>
                                        {exam.hospital_diagnosis || 'Chưa cập nhật'}
                                      </Text>
                                      <Text style={[sectionStyles.label, { marginTop: 8 }]}>
                                        Hướng xử trí
                                      </Text>
                                      <Text style={[sectionStyles.value, { fontWeight: '600' }]}>
                                        {exam.hospital_direction || 'Chưa cập nhật'}
                                      </Text>
                                    </View>
                                    {exam.hospital_health_monitoring && (
                                      <View style={{ marginTop: 12 }}>
                                        <Text style={sectionStyles.label}>
                                          Theo dõi tình trạng SK HS
                                        </Text>
                                        <Text style={sectionStyles.value}>
                                          {exam.hospital_health_monitoring}
                                        </Text>
                                      </View>
                                    )}
                                    <Text
                                      style={{
                                        marginTop: 12,
                                        fontSize: 14,
                                        fontStyle: 'italic',
                                        color: '#757575',
                                      }}>
                                      Nhà trường sẽ theo dõi tình trạng sức khỏe học sinh và thông
                                      báo cho phụ huynh khi có thông tin mới.
                                    </Text>
                                  </View>
                                </ExamSection>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

// Sub-component: Collapsible section với summary
interface ExamSectionProps {
  title: string;
  titleColor: string;
  sectionKey: string;
  expandedSections: Set<string>;
  toggleSection: (key: string) => void;
  summaryItems?: {
    label: string;
    value: string;
    isBadge?: boolean;
    badgeColor?: { bg: string; text: string };
  }[];
  children: React.ReactNode;
}

const ExamSection: React.FC<ExamSectionProps> = ({
  title,
  titleColor,
  sectionKey,
  expandedSections,
  toggleSection,
  summaryItems = [],
  children,
}) => {
  const isOpen = expandedSections.has(sectionKey);

  return (
    <View
      style={{
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
      }}>
      <TouchableOpacity
        onPress={() => toggleSection(sectionKey)}
        style={{
          paddingVertical: 16,
          paddingHorizontal: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: titleColor }}>{title}</Text>
        <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color="#9CA3AF" />
      </TouchableOpacity>
      {!isOpen && summaryItems.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 12,
          }}>{summaryItems.map((item, idx) => (
            <View key={idx} style={{ flex: 1, minWidth: 80 }}><Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4, fontFamily: 'Mulish' }}>{item.label}</Text>{item.isBadge && item.badgeColor ? (
                <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: item.badgeColor.bg }}><Text style={{ fontSize: 12, fontWeight: '500', color: item.badgeColor.text }}>{item.value}</Text></View>
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937', fontFamily: 'Mulish' }}>{item.value}</Text>
              )}</View>
          ))}
        </View>
      )}
      {isOpen && <View>{children}</View>}
    </View>
  );
};

export default ExaminationHistoryList;
