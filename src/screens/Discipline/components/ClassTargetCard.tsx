/**
 * Thẻ đối tượng lớp - hiển thị trong danh sách đối tượng vi phạm (scroll ngang).
 * Chuẩn hóa giống frappe-sis-frontend DisciplineClassTargetCard: Lần vi phạm, Cấp độ,
 * và điểm trừ CHỈ HIỂN THỊ do bậc thang `class_points` của vi phạm quyết định.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import disciplineRecordService from '../../../services/disciplineRecordService';
import {
  DisciplineLevelChip,
  computeOccurrenceCount,
  formatDeductionDisplay,
  formatOccurrenceDisplay,
  levelLabelFromSeverity,
  resolveOccurrenceLevelView,
  violationStatsRangeFromRecordDate,
} from './disciplineLevel';

const MULISH = 'Mulish';

export interface ClassTargetCardProps {
  classId: string;
  classTitle: string;
  classSubtitle?: string;
  violationId: string;
  /** Ngày ghi nhận form: khoảng đếm đầu tháng → ngày này */
  referenceDate?: string;
  /** Điểm trừ đã lưu trên bản ghi; trống nghĩa là chưa lưu nên chưa có số để hiện */
  deductionPoints?: string;
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
  onRemove,
  showRemove = true,
}) => {
  const [priorCount, setPriorCount] = useState<number | null>(null);
  const [tierLevel, setTierLevel] = useState<string | undefined>();
  const [tierLevelLabel, setTierLevelLabel] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !violationId) {
      setPriorCount(0);
      setTierLevel('1');
      setTierLevelLabel(levelLabelFromSeverity('1'));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const range = violationStatsRangeFromRecordDate(referenceDate);

    (async () => {
      try {
        const res = await disciplineRecordService.getClassViolationStats(
          classId,
          violationId,
          range
        );
        if (cancelled || !res.data) return;
        const prior = res.data.count;
        setPriorCount(prior);
        // Tier tính trên lượt vi phạm sau khi lưu bản ghi này (giống web)
        const occurrence = computeOccurrenceCount(prior, { addCurrentInList: true });
        const tierRes = await disciplineRecordService.getClassViolationStats(classId, violationId, {
          ...range,
          tier_count: occurrence,
        });
        if (!cancelled && tierRes.data) {
          setTierLevel(tierRes.data.level);
          setTierLevelLabel(tierRes.data.level_label);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [classId, violationId, referenceDate]);

  const dpVal = deductionPoints == null ? '' : String(deductionPoints);
  const occurrence = computeOccurrenceCount(priorCount, { addCurrentInList: true });
  const levelView = resolveOccurrenceLevelView(occurrence, {
    statsLevel: tierLevel,
    statsLevelLabel: tierLevelLabel,
  });

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
        ) : (
          <>
            <View style={styles.statRow}>
              <Text style={styles.statLabel} numberOfLines={1} ellipsizeMode="tail">
                Lần vi phạm:
              </Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {formatOccurrenceDisplay(occurrence)}
              </Text>
            </View>
            <View style={[styles.statRow, styles.levelRow]}>
              <Text style={styles.statLabel} numberOfLines={1} ellipsizeMode="tail">
                Cấp độ:
              </Text>
              {occurrence > 0 && levelView.level ? (
                <DisciplineLevelChip level={levelView.level} label={levelView.levelLabel} compact />
              ) : (
                <Text style={styles.statValue}>-</Text>
              )}
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel} numberOfLines={1} ellipsizeMode="tail">
                Điểm trừ:
              </Text>
              <Text style={styles.deductionValue} numberOfLines={1}>
                {formatDeductionDisplay(dpVal)}
              </Text>
            </View>
          </>
        )}
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
    backgroundColor: '#E5E7EB',
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
    width: '100%',
    textAlign: 'center',
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
    marginBottom: 4,
    minHeight: 18,
  },
  levelRow: {
    minHeight: 22,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: MULISH,
    flex: 1,
    marginRight: 6,
  },
  statValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
    fontFamily: MULISH,
    minWidth: 24,
    textAlign: 'right',
  },
  deductionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: MULISH,
    minWidth: 24,
    textAlign: 'right',
  },
});

export default ClassTargetCard;
