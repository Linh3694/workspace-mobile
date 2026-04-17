import React from 'react';
import { View, Text } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { StudentAvatar } from '../../../utils/studentAvatar';
import { formatTimeHHMM } from '../../../utils/dateUtils';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

const statusLabel: Record<AttendanceStatus, string> = {
  present: 'Có mặt',
  absent: 'Vắng',
  late: 'Muộn',
  excused: 'Vắng có phép',
};

const statusColors: Record<AttendanceStatus, { bg: string; text: string }> = {
  present: { bg: '#DCFCE7', text: '#166534' },
  absent: { bg: '#FEE2E2', text: '#991B1B' },
  late: { bg: '#FEF3C7', text: '#92400E' },
  excused: { bg: '#F3F4F6', text: '#4B5563' },
};

// Trạng thái Y tế đồng bộ với web
type HealthVisitStatus = 'left_class' | 'at_clinic' | 'examining' | 'returned' | 'picked_up' | 'transferred';

const healthStatusConfig: Record<HealthVisitStatus, { label: string; bg: string; text: string }> = {
  left_class: { label: 'Chờ Y tế tiếp nhận', bg: '#F3F4F6', text: '#6B7280' },
  at_clinic: { label: 'Đang ở Y tế', bg: '#DBEAFE', text: '#2563EB' },
  examining: { label: 'Đang khám', bg: '#FFEDD5', text: '#EA580C' },
  returned: { label: 'Đã về lớp', bg: '#DCFCE7', text: '#16A34A' },
  picked_up: { label: 'Phụ huynh đón', bg: '#FCE7F3', text: '#DB2777' },
  transferred: { label: 'Chuyển viện', bg: '#FEE2E2', text: '#DC2626' },
};

interface StudentClassLogCardProps {
  student: {
    name: string;
    student_id?: string;
    student_name: string;
    student_code?: string;
    user_image?: string;
    avatar_url?: string;
    photo?: string;
  };
  attendanceStatus: AttendanceStatus;
  isAtClinic?: boolean;
  healthVisitInfo?: {
    visit_id: string;
    status: string;
    leave_class_time?: string;
  };
  classLogData?: {
    homework_status?: string;
    behavior?: string;
    participation?: string;
    issue?: string;
    top_performance?: string;
  };
  onPress: () => void;
}

const StudentClassLogCard: React.FC<StudentClassLogCardProps> = ({
  student,
  attendanceStatus,
  isAtClinic,
  healthVisitInfo,
  classLogData,
  onPress,
}) => {
  const statusStyle = statusColors[attendanceStatus];
  const hasNotes =
    classLogData &&
    (classLogData.homework_status ||
      classLogData.behavior ||
      classLogData.participation ||
      classLogData.issue ||
      classLogData.top_performance);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        opacity: attendanceStatus === 'excused' ? 0.7 : 1,
      }}>
      <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
        {/* Avatar */}
        <View style={{ position: 'relative' }}>
          <StudentAvatar
            name={student.student_name}
            avatarUrl={student.user_image || student.avatar_url || student.photo}
            size={64}
            style={{ objectFit: 'cover', objectPosition: 'top' }}
          />
          {/* Health badge */}
          {isAtClinic && (
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#DC2626',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#FFFFFF',
              }}>
              <Ionicons name="medkit" size={12} color="#fff" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', fontFamily: 'Mulish' }}
            numberOfLines={1}>
            {student.student_name}
          </Text>
          {student.student_code && (
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2, fontFamily: 'Mulish' }}>
              {student.student_code}
            </Text>
          )}

          {/* Quick notes preview */}
          {hasNotes && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 }}>
              {classLogData?.top_performance && (
                <View
                  style={{
                    backgroundColor: '#FEF3C7',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                  }}>
                  <Text style={{ fontSize: 12, color: '#92400E', fontFamily: 'Mulish' }}>
                    ⭐ Biểu dương
                  </Text>
                </View>
              )}
              {classLogData?.issue && (
                <View
                  style={{
                    backgroundColor: '#FEE2E2',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                  }}>
                  <Text style={{ fontSize: 12, color: '#991B1B', fontFamily: 'Mulish' }}>
                    ⚠️ Vấn đề
                  </Text>
                </View>
              )}
              {classLogData?.homework_status && (
                <View
                  style={{
                    backgroundColor: '#DBEAFE',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                  }}>
                  <Text style={{ fontSize: 12, color: '#1E40AF', fontFamily: 'Mulish' }}>
                    📝 Bài tập
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Status badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              marginRight: 8,
              backgroundColor: statusStyle.bg,
            }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '500',
                color: statusStyle.text,
                fontFamily: 'Mulish',
              }}>
              {statusLabel[attendanceStatus]}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} />
        </View>
      </View>

      {/* Health visit warning */}
      {isAtClinic && healthVisitInfo && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {(() => {
            const visitStatus = (healthVisitInfo.status as HealthVisitStatus) || 'left_class';
            const statusConfig = healthStatusConfig[visitStatus] || healthStatusConfig.left_class;
            return (
              <View
                style={{
                  backgroundColor: statusConfig.bg,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                <Ionicons name="medkit-outline" size={18} color={statusConfig.text} />
                <Text
                  style={{
                    marginLeft: 8,
                    fontSize: 13,
                    color: statusConfig.text,
                    flex: 1,
                    fontFamily: 'Mulish',
                    fontWeight: '500',
                  }}>
                  {statusConfig.label}
                  {healthVisitInfo.leave_class_time &&
                    ` từ ${formatTimeHHMM(healthVisitInfo.leave_class_time)}`}
                </Text>
              </View>
            );
          })()}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default StudentClassLogCard;
