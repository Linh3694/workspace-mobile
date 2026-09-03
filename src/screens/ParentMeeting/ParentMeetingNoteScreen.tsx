import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import StandardHeader from '../../components/Common/StandardHeader';
import { toast } from '../../utils/toast';
import {
  getMyTeacherSlots,
  getMeetingNotes,
  submitMeetingNote,
} from '../../services/parentMeetingService';
import type { PTTeacherSlot } from '../../types/parentMeeting';
import {
  formatTimeRange,
  formatDateShort,
  getStudentLabel,
  getTeacherGroupLabel,
} from './parentMeetingUtils';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ScreenRoute = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.PARENT_MEETING_NOTE>;

const PRIMARY = '#002855';
const SECONDARY = '#F05023';

/** Ngắn quá thì ghi chú vô dụng với BGH; ngưỡng thấp để không cản GV, chỉ chặn "ghi cho có". */
const MIN_CONTENT_LENGTH = 10;

/**
 * `SIS PT Meeting Note.content` là Text Editor -> backend trả HTML. App này chỉ có ô nhập
 * nhiều dòng, nên khi nạp lại ghi chú cũ (thường do web soạn) phải hạ về plain text, chấp nhận
 * mất định dạng: hiển thị nguyên `<p>...</p>` trong ô nhập thì giáo viên sẽ xoá tay các thẻ đó
 * và vô tình xoá luôn nội dung. Ghi từ app luôn là plain text nên trường hợp này hiếm.
 */
function htmlToPlainText(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function ParentMeetingNoteScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const insets = useSafeAreaInsets();

  const slotId = route.params?.slotId || '';

  const [slot, setSlot] = useState<PTTeacherSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Màn này còn được mở từ push notification (payload chỉ có slotId), nên thông tin ca phải
   * tự tra lại chứ không trông chờ màn trước truyền xuống. Ghi chú cũ cũng được nạp sẵn:
   * `slot_id` là unique ở tầng DB nên lần gửi thứ hai là SỬA — gửi đè bản trắng lên nội dung
   * đã có là mất dữ liệu mà không ai báo.
   */
  const loadSlot = useCallback(async () => {
    if (!slotId) {
      setSlot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const slots = await getMyTeacherSlots();
    const found = slots.find((s) => s.slot_id === slotId) ?? null;
    setSlot(found);

    if (found && found.has_note === 1) {
      const notes = await getMeetingNotes({ eventId: found.event_id });
      const existing = notes.find((n) => n.slot_id === slotId);
      if (existing) {
        setContent(htmlToPlainText(existing.content));
        setIsEditing(true);
      }
    }
    setLoading(false);
  }, [slotId]);

  useEffect(() => {
    void loadSlot();
  }, [loadSlot]);

  const subtitle = useMemo(() => {
    if (!slot) return '';
    return [
      slot.class_title,
      getTeacherGroupLabel(slot.teacher_group, slot.teacher_group_label_vn),
      slot.location,
    ]
      .filter(Boolean)
      .join(' · ');
  }, [slot]);

  const canSubmit = !submitting && !!slotId && content.trim().length >= MIN_CONTENT_LENGTH;

  const submit = async () => {
    if (!slotId) {
      toast.error('Thiếu mã ca họp, không thể lưu meeting note');
      return;
    }
    const body = content.trim();
    if (body.length < MIN_CONTENT_LENGTH) {
      toast.error(`Nội dung tối thiểu ${MIN_CONTENT_LENGTH} ký tự`);
      return;
    }
    setSubmitting(true);
    try {
      await submitMeetingNote(slotId, body);
      toast.success('Đã gửi meeting note tới Ban Giám hiệu');
      navigation.goBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể lưu meeting note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <StandardHeader
        leftButton={
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="h-11 w-11 items-center justify-center">
            <Ionicons name="chevron-back" size={26} color={PRIMARY} />
          </TouchableOpacity>
        }
        center={
          <Text className="text-lg font-bold" style={{ color: PRIMARY }}>
            Meeting note
          </Text>
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 96 + insets.bottom }}>
          {/* Thông tin ca ở đầu màn: giáo viên họp liên tiếp nhiều gia đình, phải thấy ngay
              mình đang ghi cho học sinh nào trước khi gõ chữ đầu tiên. */}
          {slot ? (
            <View className="mb-4 rounded-xl border border-gray-100 bg-white px-3.5 py-3">
              <Text className="text-sm font-bold" style={{ color: SECONDARY }}>
                {[formatDateShort(slot.meeting_date), formatTimeRange(slot.start_time, slot.end_time)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text className="mt-1 text-base font-semibold text-gray-900" numberOfLines={2}>
                {getStudentLabel(slot)}
              </Text>
              {subtitle ? (
                <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
              {slot.note ? (
                <View className="mt-2.5 rounded-lg bg-gray-50 px-2.5 py-2">
                  <Text className="text-[11px] font-semibold text-gray-500">
                    Ghi chú của phụ huynh lúc đăng ký
                  </Text>
                  <Text className="mt-0.5 text-sm text-gray-700">{slot.note}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View className="mb-4 flex-row rounded-xl border border-gray-200 bg-white px-3.5 py-3">
              <Ionicons name="information-circle-outline" size={18} color="#6B7280" />
              <Text className="ml-2 flex-1 text-xs leading-5 text-gray-500">
                Không tra được thông tin ca họp (ca thuộc ngày khác hoặc đã bị huỷ). Nội dung vẫn
                được lưu theo mã ca {slotId || '(trống)'}.
              </Text>
            </View>
          )}

          {/* Ranh giới người đọc phải nói TRƯỚC khi giáo viên gõ: viết cho BGH đọc, không phải
              cho phụ huynh, cũng không phải cho giáo vụ. Biết đúng người đọc mới viết đúng giọng. */}
          <View className="mb-4 flex-row rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3">
            <Ionicons name="lock-closed-outline" size={18} color={PRIMARY} />
            <Text className="ml-2 flex-1 text-xs leading-5" style={{ color: PRIMARY }}>
              Meeting note CHỈ Ban Giám hiệu đọc được. Phụ huynh và giáo vụ không nhìn thấy nội
              dung này. Hãy ghi trung thực những điều nhà trường cần biết sau buổi họp.
            </Text>
          </View>

          <Text className="mb-1.5 text-sm font-semibold text-gray-700">
            Nội dung trao đổi <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Tóm tắt nội dung buổi họp, mong muốn của phụ huynh, đề xuất của giáo viên…"
            placeholderTextColor="#9CA3AF"
            multiline
            className="mb-2 min-h-[180px] rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base text-gray-900"
            style={{ textAlignVertical: 'top' }}
          />
          {content.trim().length > 0 && content.trim().length < MIN_CONTENT_LENGTH ? (
            <Text className="mb-2 text-sm font-semibold text-red-600">
              Nội dung tối thiểu {MIN_CONTENT_LENGTH} ký tự.
            </Text>
          ) : null}
          <Text className="text-xs text-gray-400">
            {isEditing
              ? 'Đang sửa ghi chú đã gửi trước đó — nội dung mới sẽ thay thế bản cũ.'
              : 'Mỗi ca họp chỉ lưu một meeting note.'}
          </Text>
        </ScrollView>
      )}

      <View
        className="absolute inset-x-0 bottom-0 border-t border-gray-100 bg-white px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 10 }}>
        <TouchableOpacity
          disabled={!canSubmit}
          onPress={submit}
          className="items-center justify-center rounded-2xl py-3.5"
          style={{ backgroundColor: canSubmit ? PRIMARY : '#9CA3AF' }}>
          <Text className="text-base font-bold text-white">
            {submitting ? 'Đang gửi…' : isEditing ? 'Cập nhật meeting note' : 'Gửi meeting note'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
