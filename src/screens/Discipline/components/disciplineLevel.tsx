/**
 * Cấp độ vi phạm + số lần vi phạm dùng chung cho các màn Kỷ luật.
 * Port từ frappe-sis-frontend `Record/v2/disciplineRecordDisplayUtils.ts` + `DisciplineLevelChip`
 * để mobile và web không hiện cùng một dữ liệu theo hai kiểu khác nhau.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MULISH = 'Mulish';

/** Đầu tháng của ngày ghi nhận → ngày ghi nhận (đồng bộ get_student/class_violation_stats) */
export function violationStatsRangeFromRecordDate(
  recordDate: string | undefined
): { date_from: string; date_to: string } | undefined {
  if (!recordDate?.trim()) return undefined;
  const d = recordDate.trim().split('T')[0]?.split(' ')[0] ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return undefined;
  const [y, m] = d.split('-');
  return { date_from: `${y}-${m}-01`, date_to: d };
}

/** priorCount từ API; +1 khi HS/lớp đang nằm trong danh sách soạn thảo */
export function computeOccurrenceCount(
  priorCount: number | undefined | null,
  options: { addCurrentInList: boolean }
): number {
  const prior =
    priorCount != null && !Number.isNaN(Number(priorCount)) ? Math.max(0, Number(priorCount)) : 0;
  return options.addCurrentInList ? prior + 1 : prior;
}

export function formatOccurrenceDisplay(occurrence: number | undefined | null): string {
  if (occurrence == null || Number.isNaN(Number(occurrence)) || Number(occurrence) <= 0) return '-';
  return String(occurrence);
}

export function levelLabelFromSeverity(level: string | undefined): string {
  return `Cấp độ ${level || 1}`;
}

/** Cấp độ hiển thị: ưu tiên cấp đã lưu trên bản ghi, sau đó tới tier từ stats/monthly */
export function resolveOccurrenceLevelView(
  occurrence: number,
  options: {
    appliedLevel?: string;
    appliedLevelLabel?: string;
    statsLevel?: string;
    statsLevelLabel?: string;
  }
): { level?: string; levelLabel?: string } {
  if (occurrence <= 0) return {};
  if (options.appliedLevel) {
    return {
      level: options.appliedLevel,
      levelLabel: options.appliedLevelLabel || levelLabelFromSeverity(options.appliedLevel),
    };
  }
  if (options.statsLevel) {
    return {
      level: options.statsLevel,
      levelLabel: options.statsLevelLabel || levelLabelFromSeverity(options.statsLevel),
    };
  }
  if (options.statsLevelLabel) {
    const m = options.statsLevelLabel.match(/(\d+)/);
    const lv = m?.[1] ?? '1';
    return { level: lv, levelLabel: options.statsLevelLabel };
  }
  return { level: '1', levelLabel: levelLabelFromSeverity('1') };
}

/** Điểm trừ hiển thị — ô trống nghĩa là chưa có số, KHÔNG bịa ra một con số mặc định */
export function formatDeductionDisplay(points: string | number | undefined | null): string {
  if (points == null || points === '') return '-';
  return String(points).replace(/^-/, '');
}

type LevelTone = { bg: string; text: string };

const LEVEL_TONES: Record<string, LevelTone> = {
  '1': { bg: '#E8EDF3', text: '#002855' },
  '2': { bg: '#FEF3C7', text: '#B45309' },
  '3': { bg: '#FEE2E2', text: '#B91C1C' },
};

const NEUTRAL_TONE: LevelTone = { bg: '#F3F4F6', text: '#4B5563' };

export function resolveDisciplineLevelTone(level: string | undefined): LevelTone {
  if (!level) return LEVEL_TONES['1'];
  return LEVEL_TONES[level] ?? NEUTRAL_TONE;
}

export interface DisciplineLevelChipProps {
  level: string | undefined;
  label?: string;
  /** Chip nhỏ dùng trong thẻ đối tượng của form */
  compact?: boolean;
}

/** Chip cấp độ vi phạm — tương đương StatusBadge của web */
export const DisciplineLevelChip: React.FC<DisciplineLevelChipProps> = ({
  level,
  label,
  compact = false,
}) => {
  const tone = resolveDisciplineLevelTone(level);
  return (
    <View
      style={[
        styles.chip,
        compact && styles.chipCompact,
        { backgroundColor: tone.bg },
      ]}>
      <View style={[styles.dot, compact && styles.dotCompact, { backgroundColor: tone.text }]} />
      <Text
        style={[styles.chipText, compact && styles.chipTextCompact, { color: tone.text }]}
        numberOfLines={1}>
        {label || levelLabelFromSeverity(level)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipCompact: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotCompact: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: MULISH,
  },
  chipTextCompact: {
    fontSize: 10,
  },
});

export default DisciplineLevelChip;
