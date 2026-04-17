/**
 * Thẻ đối tượng lớp - hiển thị trong danh sách đối tượng vi phạm (scroll ngang)
 * Chuẩn hóa giống frappe-sis-frontend DisciplineClassTargetCard: có thống kê Số lần đã vi phạm, Cấp độ hiện tại, Điểm đã trừ
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import disciplineRecordService from '../../../services/disciplineRecordService';

const MULISH = 'Mulish';
const PRIMARY = '#002855';

const DEDUCTION_OPTIONS = ['1', '5', '10', '15'] as const;

/** Đầu tháng của ngày ghi nhận → ngày ghi nhận (đồng bộ get_class_violation_stats / student_points) */
function violationStatsRangeFromRecordDate(recordDate: string | undefined): { date_from: string; date_to: string } | undefined {
  if (!recordDate?.trim()) return undefined;
  const d = recordDate.trim().split('T')[0]?.split(' ')[0] ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return undefined;
  const [y, m] = d.split('-');
  const date_from = `${y}-${m}-01`;
  return { date_from, date_to: d };
}

export interface ClassTargetCardProps {
  classId: string;
  classTitle: string;
  classSubtitle?: string;
  violationId: string;
  /** Ngày ghi nhận form: khoảng đếm đầu tháng → ngày này */
  referenceDate?: string;
  deductionPoints: string;
  onDeductionPointsChange: (value: string) => void;
  onRemove?: () => void;
  showRemove?: boolean;
}

export const ClassTargetCard: React.FC<ClassTargetCardProps> = ({
  classId,
  classTitle,
  classSubtitle,
  violationId,
  referenceDate,
  deductionPoints,
  onDeductionPointsChange,
  onRemove,
  showRemove = true,
}) => {
  const [stats, setStats] = useState<{
    count: number;
    level: string;
    level_label: string;
    points: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !violationId) {
      setStats({ count: 0, level: '1', level_label: 'Cấp độ 1', points: 0 });
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const range = violationStatsRangeFromRecordDate(referenceDate);
    disciplineRecordService
      .getClassViolationStats(classId, violationId, range)
      .then((res) => {
        if (!cancelled && res.data) setStats(res.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId, violationId, referenceDate]);

  return (
    <View style={styles.card}>
      {showRemove && onRemove && (
        <TouchableOpacity
          onPress={onRemove}
          style={styles.removeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={24} color="#6B7280" />
        </TouchableOpacity>
      )}
      <View style={styles.iconWrap}>
        <Ionicons name="school-outline" size={28} color="#3F4246" />
      </View>
      <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
        {classTitle}
      </Text>
      {/* Placeholder tương đương mã học sinh - giữ chiều cao content bằng thẻ student */}
      <View style={styles.codePlaceholder} />
      {classSubtitle ? (
        <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
          {classSubtitle}
        </Text>
      ) : (
        <View style={styles.subtitlePlaceholder} />
      )}

      <View style={styles.stats}>
        {loading ? (
          <View style={styles.statRow}>
            <Text style={styles.statLabel} numberOfLines={1}>
              Đang tải...
            </Text>
          </View>
        ) : stats ? (
          <>
            <View style={styles.statRow}>
              <Text style={styles.statLabel} numberOfLines={1} ellipsizeMode="tail">
                Số lần đã vi phạm:
              </Text>
              <Text style={styles.statValue} numberOfLines={1} ellipsizeMode="tail">
                {stats.count}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel} numberOfLines={1} ellipsizeMode="tail">
                Cấp độ hiện tại:
              </Text>
              <Text style={styles.statValue} numberOfLines={1} ellipsizeMode="tail">
                {stats.count === 0 ? '-' : stats.level_label || `Cấp độ ${stats.level}`}
              </Text>
            </View>
            <View style={[styles.statRow, styles.deductionRow]}>
              <Text style={[styles.statLabel, styles.deductionStatLabel]} numberOfLines={2} ellipsizeMode="tail">
                Điểm trừ:
              </Text>
              <View style={styles.chipsWrap}>
                {DEDUCTION_OPTIONS.map((opt) => {
                  const selected = String(deductionPoints) === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => onDeductionPointsChange(opt)}
                      style={[styles.chip, selected && styles.chipSelected]}
                      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
};

const CARD_WIDTH = 210;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    minWidth: CARD_WIDTH,
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginRight: 10,
    alignItems: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 1,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EDEDED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    fontFamily: MULISH,
    textAlign: 'center',
    width: '100%',
  },
  codePlaceholder: {
    height: 14,
    marginTop: 2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
    fontFamily: MULISH,
    textAlign: 'center',
    width: '100%',
  },
  subtitlePlaceholder: {
    height: 14,
    marginTop: 2,
  },
  stats: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    width: '100%',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    minHeight: 18,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: MULISH,
    flex: 1,
    marginRight: 6,
  },
  statValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
    fontFamily: MULISH,
    minWidth: 24,
  },
  deductionRow: {
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  deductionStatLabel: {
    flex: 0,
    maxWidth: 86,
  },
  chipsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 4,
    minWidth: 0,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  chipSelected: {
    borderColor: PRIMARY,
    backgroundColor: '#E8EDF3',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    fontFamily: MULISH,
  },
  chipTextSelected: {
    color: PRIMARY,
  },
});

export default ClassTargetCard;
