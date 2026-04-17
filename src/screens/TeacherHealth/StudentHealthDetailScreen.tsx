import React, { useState, useEffect, useCallback } from 'react';
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import dailyHealthService, {
  ClassHealthExamStudent,
  HealthExamination,
} from '../../services/dailyHealthService';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { API_BASE_URL } from '../../config/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Helpers đồng bộ với web ─────────────────────────────────────────────────

const getOutcomeLabel = (outcome: string | undefined): string => {
  if (!outcome) return '';
  const labels: Record<string, string> = {
    return_class: 'Về lớp',
    picked_up: 'Phụ huynh đón',
    transferred: 'Chuyển viện',
  };
  return labels[outcome] || outcome;
};

// Màu pastel cho outcome badges
const getOutcomeColor = (outcome?: string): { bg: string; text: string } => {
  if (outcome === 'return_class') return { bg: '#ECFDF5', text: '#047857' };
  if (outcome === 'picked_up') return { bg: '#FFF7ED', text: '#C2410C' };
  if (outcome === 'transferred') return { bg: '#FFF1F2', text: '#BE123C' };
  return { bg: '#F8FAFC', text: '#475569' };
};

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
    return `${h}h${m}`;
  }
  const dt = new Date(trimmed);
  if (!isNaN(dt.getTime())) {
    const h = dt.getHours();
    const m = String(dt.getMinutes()).padStart(2, '0');
    return `${h}h${m}`;
  }
  return '-';
};

const isValidTime = (timeStr?: string | null): boolean => {
  if (!timeStr) return false;
  const trimmed = timeStr.trim();
  return trimmed !== '' && trimmed !== '00:00:00' && trimmed !== '00:00';
};

/** Kiểm tra hồ sơ có thăm khám bổ sung - đồng bộ parent-portal */
const hasFollowup = (exam: HealthExamination): boolean => {
  return !!(
    exam.followup_examination ||
    exam.followup_treatment_details ||
    exam.followup_outcome ||
    exam.followup_notes ||
    isValidTime(exam.followup_clinic_checkin_time) ||
    isValidTime(exam.followup_clinic_checkout_time) ||
    !!exam.followup_is_scheduled_recheck ||
    exam.followup_medical_suggestion
  );
};

/** Tính số lượt thăm khám: mỗi hồ sơ = 1 lượt, nếu có thăm khám bổ sung = 2 lượt */
const countExaminationVisits = (exams: HealthExamination[]): number =>
  exams.reduce((sum, exam) => sum + (hasFollowup(exam) ? 2 : 1), 0);

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

const getInitials = (name: string): string => {
  const parts = name
    .trim()
    .split(' ')
    .filter((p) => p.length > 0);
  if (parts.length === 0) return 'HS';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getFullImageUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

// Trạng thái pastel đồng bộ web
const getStatusConfig = (status: string): { label: string; bgColor: string; textColor: string } => {
  const map: Record<string, { label: string; bgColor: string; textColor: string }> = {
    left_class: { label: 'Chờ tiếp nhận', bgColor: '#FFFBEB', textColor: '#B45309' },
    at_clinic: { label: 'Đã tiếp nhận', bgColor: '#F0F9FF', textColor: '#0369A1' },
    examining: { label: 'Đang khám', bgColor: '#FFF7ED', textColor: '#C2410C' },
    returned: { label: 'Đã về lớp', bgColor: '#ECFDF5', textColor: '#047857' },
    picked_up: { label: 'Phụ huynh đón', bgColor: '#F5F3FF', textColor: '#6D28D9' },
    transferred: { label: 'Chuyển viện', bgColor: '#FFF1F2', textColor: '#BE123C' },
  };
  return map[status] || { label: status, bgColor: '#F8FAFC', textColor: '#475569' };
};

const formatDateDisplay = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    return `${weekdays[date.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  } catch {
    return dateStr;
  }
};

// ─── ExamSection: Collapsible section với summary (đồng bộ web) ───────────────

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
        <Text style={{ fontSize: 14, fontWeight: '600', color: titleColor, fontFamily: 'Mulish' }}>
          {title}
        </Text>
        <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color="#9CA3AF" />
      </TouchableOpacity>
      {!isOpen && summaryItems.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 12,
          }}>
          {summaryItems.map((item, idx) => (
            <View key={idx} style={{ flex: 1, minWidth: 80 }}>
              <Text
                style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4, fontFamily: 'Mulish' }}>
                {item.label}
              </Text>
              {item.isBadge && item.badgeColor ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: item.badgeColor.bg,
                  }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '500',
                      color: item.badgeColor.text,
                      fontFamily: 'Mulish',
                    }}>
                    {item.value}
                  </Text>
                </View>
              ) : (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#1F2937',
                    fontFamily: 'Mulish',
                  }}>
                  {item.value}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
      {isOpen && children}
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const StudentHealthDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'StudentHealthDetail'>>();

  const { classId, studentId, date } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentData, setStudentData] = useState<ClassHealthExamStudent | null>(null);
  const [sendingExamId, setSendingExamId] = useState<string | null>(null);
  const [recallingExamId, setRecallingExamId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!classId || !studentId) return;
    setLoading(true);
    try {
      const result = await dailyHealthService.getClassHealthExaminations({
        class_id: classId,
        date: date,
      });
      const safeResult = Array.isArray(result) ? result : [];
      const found = safeResult.find((s) => s.student_id === studentId);
      setStudentData(found || null);
    } catch (error) {
      console.error('Error loading student health detail:', error);
    } finally {
      setLoading(false);
    }
  }, [classId, studentId, date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

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

  const handleSendToParent = (examId: string) => {
    Alert.alert(
      'Gửi hồ sơ đến Phụ huynh',
      'Bạn có chắc chắn muốn gửi hồ sơ thăm khám này đến phụ huynh?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Gửi',
          onPress: async () => {
            setSendingExamId(examId);
            try {
              const res = await dailyHealthService.sendExamToParent([examId]);
              if (res.success) {
                Alert.alert('Thành công', 'Đã gửi hồ sơ đến phụ huynh');
                loadData();
              } else {
                Alert.alert('Lỗi', res.message || 'Gửi hồ sơ thất bại');
              }
            } catch {
              Alert.alert('Lỗi', 'Có lỗi xảy ra');
            } finally {
              setSendingExamId(null);
            }
          },
        },
      ]
    );
  };

  const handleRecall = (examId: string) => {
    Alert.alert(
      'Thu hồi hồ sơ',
      'Bạn có chắc chắn muốn thu hồi hồ sơ thăm khám này? Thông báo đã gửi đến phụ huynh sẽ bị xoá.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Thu hồi',
          style: 'destructive',
          onPress: async () => {
            setRecallingExamId(examId);
            try {
              const res = await dailyHealthService.recallExamFromParent([examId]);
              if (res.success) {
                Alert.alert('Thành công', 'Đã thu hồi hồ sơ');
                loadData();
              } else {
                Alert.alert('Lỗi', res.message || 'Thu hồi thất bại');
              }
            } catch {
              Alert.alert('Lỗi', 'Có lỗi xảy ra');
            } finally {
              setRecallingExamId(null);
            }
          },
        },
      ]
    );
  };

  const examinations = studentData?.examinations || [];
  const sentCount = examinations.filter((e) => e.sent_to_parent).length;
  const notSentCount = examinations.filter((e) => !e.sent_to_parent).length;
  const latestVisit = studentData?.visits?.[0];
  const imageUrl = getFullImageUrl(studentData?.student_photo);

  // Gom nhóm theo phân loại bệnh (đồng bộ web)
  const groupMap = new Map<string, HealthExamination[]>();
  examinations.forEach((exam) => {
    const key = exam.disease_classification?.trim() || 'Chưa phân loại';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(exam);
  });
  const groups = Array.from(groupMap.entries()).map(([classification, items]) => ({
    classification,
    items,
  }));

  // Loading state - hiển thị full màn hình khi chưa có data
  if (loading && !studentData) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0369A1" />
          <Text style={{ marginTop: 12, fontSize: 14, color: '#6B7280', fontFamily: 'Mulish' }}>
            Đang tải...
          </Text>
        </View>
      </View>
    );
  }

  // Không tìm thấy học sinh
  if (!studentData) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <MaterialCommunityIcons name="account-question" size={48} color="#D1D5DB" />
          <Text
            style={{
              marginTop: 12,
              fontSize: 16,
              color: '#6B7280',
              textAlign: 'center',
              fontFamily: 'Mulish',
            }}>
            Không tìm thấy thông tin học sinh
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              marginTop: 16,
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: '#F0F9FF',
              borderWidth: 1,
              borderColor: '#BAE6FD',
              borderRadius: 12,
            }}>
            <Text
              style={{ fontSize: 14, fontWeight: '600', color: '#0369A1', fontFamily: 'Mulish' }}>
              Quay lại
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const sectionStyles = {
    label: { fontSize: 12, fontWeight: '600' as const, color: '#6B7280', marginBottom: 4 },
    value: { fontSize: 14, color: '#1F2937', fontFamily: 'Mulish' },
    block: { backgroundColor: '#F7F8FA', borderRadius: 12, padding: 12, marginTop: 8 },
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      {/* Header - đồng bộ web */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 16,
          paddingVertical: 12,
          elevation: 2,
        }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 8, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#0369A1" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: '#0369A1',
              fontFamily: 'Mulish',
            }}
            numberOfLines={1}>
            Thăm khám hôm nay
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontSize: 13,
              color: '#6B7280',
              fontFamily: 'Mulish',
            }}
            numberOfLines={1}>
            {formatDateDisplay(date)}
          </Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0369A1']} />
        }
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        {/* Student Info Card - đồng bộ web (gradient style) */}
        <View
          style={{
            margin: 16,
            paddingVertical: 24,
            paddingHorizontal: 24,
            borderRadius: 24,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            overflow: 'hidden',
            elevation: 1,
            borderWidth: 1,
            borderColor: '#EAEAEA',
          }}>
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '45%',
            }}
          />
          <View style={{ zIndex: 1, alignItems: 'center', alignSelf: 'stretch' }}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  borderWidth: 4,
                  borderColor: '#FFFFFF',
                  marginBottom: 16,
                }}
              />
            ) : (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  borderWidth: 4,
                  borderColor: '#FFFFFF',
                  backgroundColor: '#F0F9FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: '600',
                    color: '#0369A1',
                    fontFamily: 'Mulish',
                  }}>
                  {getInitials(studentData?.student_name || '')}
                </Text>
              </View>
            )}
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: '#0A7892',
                textAlign: 'center',
                fontFamily: 'Mulish',
              }}>
              {studentData?.student_name}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: '#6B7280',
                fontFamily: 'Mulish',
                marginTop: 4,
              }}>
              {studentData?.student_code}
            </Text>

            {/* Trạng thái Y tế */}
            {latestVisit &&
              (() => {
                const cfg = getStatusConfig(latestVisit.status);
                return (
                  <View
                    style={{
                      marginTop: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: cfg.bgColor,
                    }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: cfg.textColor,
                        fontFamily: 'Mulish',
                      }}>
                      {cfg.label}
                    </Text>
                  </View>
                );
              })()}

            {/* Stats - label bên trái sát lề, thông số đối diện bên phải */}
            <View
              style={{
                marginTop: 20,
                alignSelf: 'stretch',
                borderTopWidth: 1,
                borderTopColor: '#E5E7EB',
                paddingTop: 16,
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'Mulish' }}>
                  Tổng lượt khám:
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#1F2937',
                    fontFamily: 'Mulish',
                  }}>
                  {countExaminationVisits(examinations)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'Mulish' }}>
                  Đã gửi PH:
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#059669',
                    fontFamily: 'Mulish',
                  }}>
                  {sentCount}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'Mulish' }}>
                  Chưa gửi:
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#4B5563',
                    fontFamily: 'Mulish',
                  }}>
                  {notSentCount}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Examinations - nhóm theo phân loại bệnh */}
        {groups.length === 0 ? (
          <View
            style={{
              margin: 16,
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 32,
              elevation: 1,
            }}>
            <MaterialCommunityIcons name="heart-pulse" size={48} color="#D1D5DB" />
            <Text
              style={{
                marginTop: 12,
                fontSize: 16,
                color: '#6B7280',
                fontFamily: 'Mulish',
                textAlign: 'center',
              }}>
              Chưa có hồ sơ thăm khám nào hôm nay
            </Text>
          </View>
        ) : (
          groups.map(({ classification, items }, groupIdx) => {
            const groupKey = classification;
            // Set lưu các nhóm đang đóng; rỗng = tất cả mở
            const isGroupOpen = !expandedGroups.has(groupKey);

            return (
              <View
                key={groupKey}
                style={{
                  marginHorizontal: 16,
                  marginBottom: 12,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#EAEAEA',
                  overflow: 'hidden',
                  backgroundColor: '#FFFFFF',
                  elevation: 1,
                }}>
                {/* Group header - đồng bộ web */}
                <TouchableOpacity
                  onPress={() => toggleGroup(groupKey)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    backgroundColor: '#F7F8FA',
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        color: '#9CA3AF',
                        fontFamily: 'Mulish',
                      }}>
                      Hồ sơ chăm sóc sức khoẻ {groupIdx + 1}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginTop: 4,
                      }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: '#0369A1',
                          fontFamily: 'Mulish',
                        }}
                        numberOfLines={1}>
                        {classification}
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
                          {countExaminationVisits(items)} lượt thăm khám
                        </Text>
                      </View>
                    </View>
                  </View>
                  {/* Send/Recall per exam - đồng bộ web */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}>
                    {items.map((exam) => (
                      <View
                        key={exam.name}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {exam.sent_to_parent ? (
                          <>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 12,
                                backgroundColor: '#D1FAE5',
                                borderWidth: 1,
                                borderColor: '#86EFAC',
                              }}>
                              <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '500',
                                  color: '#166534',
                                  fontFamily: 'Mulish',
                                }}>
                                Đã gửi
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleRecall(exam.name)}
                              disabled={recallingExamId === exam.name}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                              }}>
                              {recallingExamId === exam.name ? (
                                <ActivityIndicator size="small" color="#BE123C" />
                              ) : (
                                <>
                                  <Ionicons name="arrow-undo" size={14} color="#BE123C" />
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontWeight: '500',
                                      color: '#BE123C',
                                      fontFamily: 'Mulish',
                                    }}>
                                    Thu hồi
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleSendToParent(exam.name)}
                            disabled={sendingExamId === exam.name}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 12,
                              backgroundColor: '#F0F9FF',
                              borderWidth: 1,
                              borderColor: '#BAE6FD',
                            }}>
                            {sendingExamId === exam.name ? (
                              <ActivityIndicator size="small" color="#0369A1" />
                            ) : (
                              <>
                                <Ionicons name="send" size={14} color="#0369A1" />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: '500',
                                    color: '#0369A1',
                                    fontFamily: 'Mulish',
                                  }}>
                                  Gửi đến Phụ huynh
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    <Ionicons
                      name={isGroupOpen ? 'chevron-down' : 'chevron-forward'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </View>
                </TouchableOpacity>

                {isGroupOpen && (
                  <View
                    style={{
                      flexDirection: 'column',
                      borderTopWidth: 1,
                      borderTopColor: '#F3F4F6',
                    }}>
                    {items.map((exam) => {
                      const relatedVisit = studentData?.visits?.find(
                        (v) => v.name === exam.visit_id
                      );
                      const outcomeFromStatus: Record<string, string> = {
                        returned: 'return_class',
                        picked_up: 'picked_up',
                        transferred: 'transferred',
                      };
                      const finalOutcome = relatedVisit
                        ? outcomeFromStatus[relatedVisit.status] || exam.outcome
                        : exam.outcome;
                      const checkoutNotes =
                        relatedVisit?.checkout_notes ?? exam.checkout_notes ?? '';

                      const staffName = normalizeVietnameseName(
                        exam.medical_staff_name || exam.examined_by_name || ''
                      );

                      const hasFup = hasFollowup(exam);

                      const hasHospital = !!(
                        finalOutcome === 'transferred' ||
                        exam.followup_outcome === 'transferred' ||
                        exam.followup_transfer_hospital ||
                        relatedVisit?.transfer_hospital ||
                        exam.hospital_diagnosis ||
                        exam.hospital_direction ||
                        exam.hospital_health_monitoring
                      );

                      return (
                        <View key={exam.name} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                          {/* Thăm khám ban đầu */}
                          <ExamSection
                            title="Thăm khám ban đầu"
                            titleColor="#0A7892"
                            sectionKey={`${exam.name}_initial`}
                            expandedSections={expandedSections}
                            toggleSection={toggleSection}
                            summaryItems={[
                              {
                                label: 'Thời gian lưu trú',
                                value: formatStayDuration(
                                  exam.clinic_checkin_time,
                                  exam.clinic_checkout_time,
                                  exam.creation || exam.modified
                                ),
                              },
                              { label: 'NVYT thăm khám', value: staffName || '---' },
                              {
                                label: 'Hướng xử trí',
                                value: finalOutcome ? getOutcomeLabel(finalOutcome) : '---',
                                isBadge: !!finalOutcome,
                                badgeColor: finalOutcome
                                  ? getOutcomeColor(finalOutcome)
                                  : undefined,
                              },
                            ]}>
                            <View style={{ marginTop: 12 }}>
                              <Text style={[sectionStyles.label, { color: '#0A7892' }]}>
                                Thông tin tiếp nhận
                              </Text>
                              <View style={sectionStyles.block}>
                                <Text style={sectionStyles.label}>Thời gian lưu trú</Text>
                                <Text style={[sectionStyles.value, { fontWeight: '600' }]}>
                                  {formatStayDuration(
                                    exam.clinic_checkin_time,
                                    exam.clinic_checkout_time,
                                    exam.creation || exam.modified
                                  )}
                                </Text>
                                {exam.symptoms && (
                                  <>
                                    <Text
                                      style={[
                                        sectionStyles.label,
                                        { marginTop: 8, fontFamily: 'Mulish' },
                                      ]}>
                                      Lý do vào phòng Y tế
                                    </Text>
                                    <Text style={[sectionStyles.value, { fontFamily: 'Mulish' }]}>
                                      {exam.symptoms}
                                    </Text>
                                  </>
                                )}
                                {exam.examination_notes && (
                                  <>
                                    <Text
                                      style={[
                                        sectionStyles.label,
                                        { marginTop: 8, fontFamily: 'Mulish' },
                                      ]}>
                                      Nhận định ban đầu
                                    </Text>
                                    <Text style={[sectionStyles.value, { fontFamily: 'Mulish' }]}>
                                      {exam.examination_notes}
                                    </Text>
                                  </>
                                )}
                                {exam.images && exam.images.length > 0 && (
                                  <View style={{ marginTop: 12 }}>
                                    <Text style={[sectionStyles.label, { fontFamily: 'Mulish' }]}>
                                      Hình ảnh
                                    </Text>
                                    <ScrollView
                                      horizontal
                                      showsHorizontalScrollIndicator={false}
                                      style={{ marginTop: 8 }}>
                                      {exam.images.map((img, idx) => (
                                        <Image
                                          key={idx}
                                          source={{ uri: getFullImageUrl(img.image) }}
                                          style={{
                                            width: 64,
                                            height: 64,
                                            borderRadius: 8,
                                            marginRight: 8,
                                          }}
                                          resizeMode="cover"
                                        />
                                      ))}
                                    </ScrollView>
                                  </View>
                                )}
                              </View>
                            </View>

                            {(() => {
                              const treatmentItems = parseTreatmentItemsStructured(
                                exam.treatment_details,
                                exam.treatment_type
                              );
                              if (treatmentItems.length === 0) return null;
                              return (
                                <View style={{ marginTop: 12 }}>
                                  <Text style={[sectionStyles.label, { color: '#0A7892' }]}>
                                    Chăm sóc y tế
                                  </Text>
                                  {treatmentItems.map((item, idx) => (
                                    <View
                                      key={idx}
                                      style={{
                                        backgroundColor: '#F5F5F5',
                                        borderRadius: 12,
                                        padding: 12,
                                        marginTop: 8,
                                      }}>
                                      <Text style={[sectionStyles.value, { fontFamily: 'Mulish' }]}>
                                        {item.name}
                                        {item.quantity ? ` × ${item.quantity}` : ''}
                                      </Text>
                                      {item.notes && (
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
                                              color: '#212121',
                                              fontFamily: 'Mulish',
                                            }}>
                                            {item.notes}
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                  ))}
                                </View>
                              );
                            })()}

                            {(finalOutcome || checkoutNotes) && (
                              <View style={{ marginTop: 12 }}>
                                <Text style={[sectionStyles.label, { color: '#0A7892' }]}>
                                  Kết quả sau chăm sóc
                                </Text>
                                <View
                                  style={{
                                    backgroundColor: '#F5F5F5',
                                    borderRadius: 12,
                                    padding: 12,
                                    marginTop: 8,
                                  }}>
                                  {finalOutcome && (
                                    <View style={{ marginBottom: checkoutNotes ? 8 : 0 }}>
                                      <Text style={[sectionStyles.label, { fontFamily: 'Mulish' }]}>
                                        Hướng xử trí
                                      </Text>
                                      <View
                                        style={{
                                          alignSelf: 'flex-start',
                                          paddingHorizontal: 10,
                                          paddingVertical: 4,
                                          borderRadius: 12,
                                          backgroundColor: getOutcomeColor(finalOutcome).bg,
                                        }}>
                                        <Text
                                          style={{
                                            fontSize: 12,
                                            fontWeight: '500',
                                            color: getOutcomeColor(finalOutcome).text,
                                            fontFamily: 'Mulish',
                                          }}>
                                          {getOutcomeLabel(finalOutcome)}
                                        </Text>
                                      </View>
                                    </View>
                                  )}
                                  {checkoutNotes && (
                                    <View>
                                      <Text
                                        style={[
                                          sectionStyles.label,
                                          { color: '#757575', fontFamily: 'Mulish' },
                                        ]}>
                                        Đề xuất của Nhân viên Y tế
                                      </Text>
                                      <Text style={[sectionStyles.value, { fontFamily: 'Mulish' }]}>
                                        {checkoutNotes}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            )}
                            {/* Thông báo theo dõi sức khoẻ - đồng bộ parent-portal */}
                            <Text
                              style={{
                                marginTop: 12,
                                fontSize: 14,
                                fontStyle: 'italic',
                                color: '#757575',
                                fontFamily: 'Mulish',
                              }}>
                              Bộ phận y tế nhà trường sẽ tiếp tục theo dõi tình trạng sức khoẻ của
                              học sinh tại trường cho đến khi ổn định và sẽ kịp thời thông tin đến
                              phụ huynh khi có vấn đề sức khoẻ cần lưu ý.
                            </Text>
                          </ExamSection>

                          {/* Thăm khám bổ sung */}
                          {hasFup && (
                            <ExamSection
                              title="Thăm khám bổ sung"
                              titleColor="#0A9D94"
                              sectionKey={`${exam.name}_followup`}
                              expandedSections={expandedSections}
                              toggleSection={toggleSection}
                              summaryItems={[
                                {
                                  label: 'Thời gian lưu trú',
                                  value: formatStayDuration(
                                    exam.followup_clinic_checkin_time,
                                    exam.followup_clinic_checkout_time
                                  ),
                                },
                                {
                                  label: 'NVYT thăm khám',
                                  value:
                                    normalizeVietnameseName(
                                      exam.followup_medical_staff_name || ''
                                    ) || '---',
                                },
                                {
                                  label: 'Hướng xử trí',
                                  value: exam.followup_outcome
                                    ? getOutcomeLabel(exam.followup_outcome)
                                    : '---',
                                  isBadge: !!exam.followup_outcome,
                                  badgeColor: exam.followup_outcome
                                    ? getOutcomeColor(exam.followup_outcome)
                                    : undefined,
                                },
                              ]}>
                              <View style={{ marginTop: 12 }}>
                                <Text style={[sectionStyles.label, { color: '#0A9D94' }]}>
                                  Thông tin tiếp nhận
                                </Text>
                                <View
                                  style={{
                                    backgroundColor: '#F5F5F5',
                                    borderRadius: 12,
                                    padding: 12,
                                    marginTop: 8,
                                  }}>
                                  <Text style={[sectionStyles.label, { fontFamily: 'Mulish' }]}>
                                    Thời gian lưu trú
                                  </Text>
                                  <Text style={[sectionStyles.value, { fontWeight: '600' }]}>
                                    {formatStayDuration(
                                      exam.followup_clinic_checkin_time,
                                      exam.followup_clinic_checkout_time
                                    )}
                                  </Text>
                                  {exam.followup_examination && (
                                    <>
                                      <Text
                                        style={[
                                          sectionStyles.label,
                                          { marginTop: 8, fontFamily: 'Mulish' },
                                        ]}>
                                        Nhận định ban đầu
                                      </Text>
                                      <Text
                                        style={[
                                          sectionStyles.value,
                                          { fontFamily: 'Mulish', fontWeight: '600' },
                                        ]}>
                                        {exam.followup_examination}
                                      </Text>
                                    </>
                                  )}
                                </View>
                              </View>
                              {(() => {
                                const items = parseTreatmentItemsStructured(
                                  exam.followup_treatment_details
                                );
                                if (items.length === 0) return null;
                                return (
                                  <View style={{ marginTop: 12 }}>
                                    <Text style={[sectionStyles.label, { color: '#0A9D94' }]}>
                                      Chăm sóc y tế bổ sung
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
                                        <Text
                                          style={[sectionStyles.value, { fontFamily: 'Mulish' }]}>
                                          {item.name}
                                          {item.quantity ? ` × ${item.quantity}` : ''}
                                        </Text>
                                        {item.notes && (
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
                                                color: '#212121',
                                              }}>
                                              {item.notes}
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                    ))}
                                  </View>
                                );
                              })()}
                              {(exam.followup_outcome ||
                                exam.followup_medical_suggestion ||
                                exam.followup_notes) && (
                                <View style={{ marginTop: 12 }}>
                                  <Text style={[sectionStyles.label, { color: '#0A9D94' }]}>
                                    Kết quả sau chăm sóc
                                  </Text>
                                  <View
                                    style={{
                                      backgroundColor: '#F5F5F5',
                                      borderRadius: 12,
                                      padding: 12,
                                      marginTop: 8,
                                    }}>
                                    {exam.followup_outcome && (
                                      <View style={{ marginBottom: 8 }}>
                                        <Text
                                          style={[sectionStyles.label, { fontFamily: 'Mulish' }]}>
                                          Hướng xử trí
                                        </Text>
                                        <View
                                          style={{
                                            alignSelf: 'flex-start',
                                            paddingHorizontal: 10,
                                            paddingVertical: 4,
                                            borderRadius: 12,
                                            backgroundColor: getOutcomeColor(exam.followup_outcome)
                                              .bg,
                                          }}>
                                          <Text
                                            style={{
                                              fontSize: 12,
                                              fontWeight: '500',
                                              color: getOutcomeColor(exam.followup_outcome).text,
                                              fontFamily: 'Mulish',
                                            }}>
                                            {getOutcomeLabel(exam.followup_outcome)}
                                          </Text>
                                        </View>
                                      </View>
                                    )}
                                    {exam.followup_medical_suggestion && (
                                      <View style={{ marginBottom: 8 }}>
                                        <Text
                                          style={[sectionStyles.label, { fontFamily: 'Mulish' }]}>
                                          Đề xuất Nhân viên Y tế
                                        </Text>
                                        <Text
                                          style={[sectionStyles.value, { fontFamily: 'Mulish' }]}>
                                          {exam.followup_medical_suggestion}
                                        </Text>
                                      </View>
                                    )}
                                    {exam.followup_notes && (
                                      <View>
                                        <Text
                                          style={[sectionStyles.label, { fontFamily: 'Mulish' }]}>
                                          Ghi chú
                                        </Text>
                                        <Text
                                          style={[sectionStyles.value, { fontFamily: 'Mulish' }]}>
                                          {exam.followup_notes}
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              )}
                              {/* Thông báo theo dõi sức khoẻ - đồng bộ parent-portal */}
                              <Text
                                style={{
                                  marginTop: 12,
                                  fontSize: 14,
                                  fontStyle: 'italic',
                                  color: '#757575',
                                  fontFamily: 'Mulish',
                                }}>
                                Bộ phận y tế nhà trường sẽ tiếp tục theo dõi tình trạng sức khoẻ
                                của học sinh tại trường cho đến khi ổn định và sẽ kịp thời thông tin
                                đến phụ huynh khi có vấn đề sức khoẻ cần lưu ý.
                              </Text>
                            </ExamSection>
                          )}

                          {/* Chẩn đoán & điều trị tại bệnh viện */}
                          {hasHospital && (
                            <ExamSection
                              title="Chẩn đoán & điều trị tại bệnh viện chuyển tới"
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
                                  <Text style={[sectionStyles.label, { fontFamily: 'Mulish' }]}>
                                    Bệnh viện chuyển tới
                                  </Text>
                                  <Text
                                    style={[
                                      sectionStyles.value,
                                      { fontWeight: '600', fontFamily: 'Mulish' },
                                    ]}>
                                    {exam.followup_transfer_hospital ||
                                      relatedVisit?.transfer_hospital ||
                                      'Thông tin sẽ được cập nhật sớm đến Phụ huynh'}
                                  </Text>
                                  <Text
                                    style={[
                                      sectionStyles.label,
                                      { marginTop: 8, fontFamily: 'Mulish' },
                                    ]}>
                                    Chẩn đoán tại bệnh viện
                                  </Text>
                                  <Text
                                    style={[
                                      sectionStyles.value,
                                      { fontWeight: '600', fontFamily: 'Mulish' },
                                    ]}>
                                    {exam.hospital_diagnosis ||
                                      'Thông tin sẽ được cập nhật sớm đến Phụ huynh'}
                                  </Text>
                                  <Text
                                    style={[
                                      sectionStyles.label,
                                      { marginTop: 8, fontFamily: 'Mulish' },
                                    ]}>
                                    Hướng xử trí
                                  </Text>
                                  <Text
                                    style={[
                                      sectionStyles.value,
                                      { fontWeight: '600', fontFamily: 'Mulish' },
                                    ]}>
                                    {exam.hospital_direction ||
                                      'Thông tin sẽ được cập nhật sớm đến Phụ huynh'}
                                  </Text>
                                </View>
                                {/* Đoạn text cứng đồng bộ web - hiển thị khi gửi view cho phụ huynh */}
                                <Text
                                  style={{
                                    marginTop: 12,
                                    fontSize: 14,
                                    fontStyle: 'italic',
                                    color: '#757575',
                                    fontFamily: 'Mulish',
                                  }}>
                                  Bộ phận Y tế nhà trường sẽ tiếp tục theo dõi và cập nhật tình
                                  trạng sức khỏe của học sinh tại trường cho đến khi ổn định. Mọi
                                  thông tin cần lưu ý sẽ được thông báo kịp thời tới Quý Phụ huynh.
                                </Text>
                              </View>
                            </ExamSection>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Overlay khi đang refresh (đã có data) */}
      {loading && studentData && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.8)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <ActivityIndicator size="large" color="#0369A1" />
        </View>
      )}
    </View>
  );
};

export default StudentHealthDetailScreen;
