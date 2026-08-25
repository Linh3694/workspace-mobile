/**
 * Thẻ đối tượng học sinh - Avatar, tên, lớp, mã, Số lần vi phạm, Cấp độ, Điểm trừ.
 * Chuẩn hóa giống frappe-sis-frontend DisciplineTargetCard: điểm trừ CHỈ HIỂN THỊ,
 * do bậc thang cấu hình của vi phạm quyết định — không nhập tay.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { StudentAvatar } from '../../../utils/studentAvatar';
import { getFullImageUrl } from '../../../utils/imageUtils';
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

const PRIMARY = '#002855';
const WARNING = '#B45309';
const MULISH = 'Mulish';

export interface DisciplineTargetCardProps {
  studentId: string;
  studentName: string;
  studentCode: string;
  classTitle?: string;
  avatarUrl?: string | null;
  schoolYearId?: string | null;
  violationId: string;
  referenceDate?: string;
  /** Khi sửa bản ghi — loại trừ chính bản ghi đó khỏi số đếm trong tháng */
  excludeRecordId?: string;
  /** Điểm trừ đã lưu trên bản ghi (chỉ dùng khi server chưa trả điểm gợi ý) */
  deductionPoints?: string;
  onRemove?: () => void;
  showRemove?: boolean;
}

/** Thẻ học sinh vi phạm - Avatar, tên, mã, lớp, thống kê */
export const DisciplineTargetCard: React.FC<DisciplineTargetCardProps> = ({
  studentId,
  studentName,
  studentCode,
  classTitle,
  avatarUrl: propAvatarUrl,
  violationId,
  referenceDate,
  excludeRecordId,
  deductionPoints,
  onRemove,
  showRemove = true,
}) => {
  const [priorCount, setPriorCount] = useState<number | null>(null);
  const [tierLevel, setTierLevel] = useState<string | undefined>();
  const [tierLevelLabel, setTierLevelLabel] = useState<string | undefined>();
  /** Điểm trừ do bậc thang cấu hình quyết định — chỉ hiển thị, không sửa tay */
  const [configuredDp, setConfiguredDp] = useState<string | undefined>();
  const [monthlyCtx, setMonthlyCtx] = useState<{
    prior_level1_count_month: number;
    would_escalate_monthly: boolean;
    escalation_highlight: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Không fetch avatar qua getStudent - API trả 417 khi gọi nhiều request. Dùng avatarUrl từ props.
  useEffect(() => {
    if (!studentId || !violationId) {
      setPriorCount(0);
      setTierLevel('1');
      setTierLevelLabel(levelLabelFromSeverity('1'));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const range = violationStatsRangeFromRecordDate(referenceDate);
    disciplineRecordService
      .getStudentViolationStats(studentId, violationId, range)
      .then((res) => {
        if (!cancelled && res.data) setPriorCount(res.data.count);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, violationId, referenceDate]);

  useEffect(() => {
    if (!studentId || !violationId || !referenceDate) {
      setMonthlyCtx(null);
      setTierLevel(undefined);
      setTierLevelLabel(undefined);
      setConfiguredDp(undefined);
      return;
    }
    let cancelled = false;
    disciplineRecordService
      .getStudentMonthlyDisciplineContext(
        studentId,
        violationId,
        referenceDate.split('T')[0],
        excludeRecordId
      )
      .then((res) => {
        if (cancelled || !res.data) return;
        setMonthlyCtx({
          prior_level1_count_month: res.data.prior_level1_count_month,
          would_escalate_monthly: res.data.would_escalate_monthly,
          escalation_highlight: res.data.escalation_highlight,
        });
        setTierLevel(res.data.suggested_level);
        setTierLevelLabel(res.data.level_label);
        setConfiguredDp(
          res.data.suggested_deduction_points == null
            ? undefined
            : String(res.data.suggested_deduction_points)
        );
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, violationId, referenceDate, excludeRecordId]);

  const displayPhoto = propAvatarUrl ? getFullImageUrl(propAvatarUrl) : undefined;

  const rowHighlight =
    monthlyCtx?.escalation_highlight ||
    (monthlyCtx != null && monthlyCtx.prior_level1_count_month >= 3);

  /**
   * Ưu tiên điểm server suy từ bậc thang cấu hình. Bản ghi cũ đã lưu điểm thì hiện
   * điểm đã lưu — không im lặng đổi số của lịch sử.
   */
  const dpVal = configuredDp ?? (deductionPoints == null ? '' : String(deductionPoints));

  const occurrence = computeOccurrenceCount(priorCount, { addCurrentInList: true });
  const levelView = resolveOccurrenceLevelView(occurrence, {
    statsLevel: tierLevel,
    statsLevelLabel: tierLevelLabel,
  });

  return (
    <View style={[styles.card, rowHighlight && styles.cardHighlight]}>
      {showRemove && onRemove && (
        <TouchableOpacity
          onPress={onRemove}
          style={styles.removeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={24} color="#6B7280" />
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        <StudentAvatar
          name={studentName}
          avatarUrl={displayPhoto}
          size={48}
          backgroundColor={PRIMARY}
          textColor="#fff"
        />
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {studentName || '-'}
        </Text>
        <Text style={styles.code} numberOfLines={1} ellipsizeMode="tail">
          {studentCode || '-'}
        </Text>
        {classTitle ? (
          <Text style={styles.class} numberOfLines={1} ellipsizeMode="tail">
            {classTitle}
          </Text>
        ) : (
          <View style={styles.classPlaceholder} />
        )}
      </View>

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
            {monthlyCtx != null && monthlyCtx.prior_level1_count_month > 0 ? (
              <Text style={styles.escalationNote}>
                {monthlyCtx.prior_level1_count_month} lần cấp 1 trong tháng
                {monthlyCtx.would_escalate_monthly ? ' — sẽ nâng cấp 2 khi lưu' : ''}
              </Text>
            ) : null}
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
  },
  /** Chạm ngưỡng nâng cấp trong tháng — làm nổi để người ghi nhận thấy trước khi lưu */
  cardHighlight: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 1,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  name: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    fontFamily: MULISH,
    textAlign: 'center',
    width: '100%',
  },
  code: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
    fontFamily: MULISH,
    width: '100%',
    textAlign: 'center',
  },
  class: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
    fontFamily: MULISH,
    width: '100%',
    textAlign: 'center',
  },
  classPlaceholder: {
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
  escalationNote: {
    marginTop: 2,
    fontSize: 10,
    color: WARNING,
    fontFamily: MULISH,
  },
});

export default DisciplineTargetCard;
