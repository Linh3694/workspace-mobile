import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import StandardHeader from '../../components/Common/StandardHeader';
import { toast } from '../../utils/toast';
import {
  getMyTeacherSlots,
  getMeetingNotes,
  getMeetingMedia,
  submitMeetingNote,
} from '../../services/parentMeetingService';
import type { PTMeetingMedia, PTTeacherSlot } from '../../types/parentMeeting';
import {
  formatTimeRange,
  formatDateShort,
  getStudentLabel,
  getTeacherGroupLabel,
  canWriteNote,
} from './parentMeetingUtils';
import { ParentMeetingRecorder } from './components/ParentMeetingRecorder';
import { ParentMeetingAiPanel } from './components/ParentMeetingAiPanel';

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

/**
 * Chiều ngược lại: text trần của ô nhập -> HTML để lưu vào `SIS PT Meeting Note.content`.
 *
 * BẮT BUỘC, không phải trang trí. Bên đọc là `ParentMeetingNoteViewModal` của web, nó đổ
 * nội dung bằng `dangerouslySetInnerHTML` — mà HTML thì nuốt sạch ký tự xuống dòng. Gửi text
 * trần nghĩa là biên bản gõ trên điện thoại tới tay BGH thành MỘT KHỐI chữ liền, đúng lúc
 * người đọc cần lướt nhanh giữa nhiều ca.
 *
 * ESCAPE TRƯỚC, bọc thẻ SAU. Giáo viên gõ "<" hay "&" trong câu là chuyện bình thường
 * ("phụ huynh hỏi A&B", "điểm < 5"); để nguyên thì trình duyệt đọc phần sau đó thành thẻ và
 * nuốt mất một đoạn. Web có sanitize ở đường đọc nhưng sanitize chỉ bỏ thẻ nguy hiểm, không
 * trả lại được chữ đã bị hiểu nhầm thành thẻ.
 *
 * Dòng trắng = đoạn mới, xuống dòng đơn = `<br>` — khớp với cách `htmlToPlainText` đọc ngược
 * lại, nên nội dung soạn từ app lưu rồi mở lại vẫn y nguyên.
 */
function plainTextToHtml(text: string): string {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Bản ghi chú đang có mang định dạng mà ô nhập của app KHÔNG giữ được (danh sách, in đậm,
 * tiêu đề, bảng, ảnh) — tức là nó được soạn trên web bằng trình soạn thảo đầy đủ.
 *
 * Cần biết để CẢNH BÁO trước: app hạ nội dung về text trần lúc nạp, nên bấm lưu ở đây là
 * ghi đè mất định dạng của bản web, và không có bước hoàn tác nào. Chỉ đếm thẻ có ý nghĩa
 * trình bày — `<p>`/`<br>` thì chính app cũng sinh ra, cảnh báo vì chúng là báo động giả.
 */
function hasRichFormatting(html: string): boolean {
  return /<(ul|ol|li|strong|b|em|i|u|h[1-6]|table|img|a|blockquote|pre|code)\b/i.test(
    String(html || '')
  );
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
  /** Bản đang có được soạn trên web và có định dạng — lưu từ app sẽ làm phẳng nó. */
  const [richNoteWarning, setRichNoteWarning] = useState(false);
  /** Ghi âm + đính kèm của biên bản. `null` = chưa tải xong hoặc không đọc được. */
  const [media, setMedia] = useState<PTMeetingMedia | null>(null);
  /**
   * Giáo viên đã gõ vào ô biên bản trong phiên này chưa.
   *
   * Ref chứ không state: chỉ dùng để `loadSlot` quyết định có nạp đè hay không, mà vẽ lại
   * màn hình theo nó thì không đổi gì cả.
   */
  const contentDirtyRef = useRef(false);

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
    // Hỏi ĐÚNG ca này, không hỏi "lịch hôm nay rồi lọc": màn này mở được từ thông báo đẩy
    // và ca trong đó có thể thuộc ngày khác — lọc từ danh sách hôm nay là tra không ra.
    const slots = await getMyTeacherSlots({ slotId });
    const found = slots.find((s) => s.slot_id === slotId) ?? null;
    setSlot(found);

    if (found && found.has_note === 1) {
      const notes = await getMeetingNotes({ eventId: found.event_id });
      const existing = notes.find((n) => n.slot_id === slotId);
      if (existing) {
        // KHÔNG đè lên chữ giáo viên đang gõ. Hàm này chạy lại mỗi lần màn được focus
        // (xem `useFocusEffect`), mà bản trên máy chủ là bản CŨ hơn những gì họ vừa gõ —
        // nạp đè là xoá công viết ngay trước mắt, không có bước hoàn tác nào.
        if (!contentDirtyRef.current) {
          setContent(htmlToPlainText(existing.content));
          setRichNoteWarning(hasRichFormatting(existing.content));
        }
        setIsEditing(true);
      }
    }
    setLoading(false);
  }, [slotId]);

  /**
   * Tư liệu tải RIÊNG, không gộp vào `loadSlot`: mỗi lần gửi xong một đoạn ghi âm là phải
   * làm mới danh sách đoạn, mà kéo luôn cả ca + biên bản về sẽ ghi đè nội dung giáo viên
   * đang gõ dở trong ô bên dưới.
   */
  const loadMedia = useCallback(async () => {
    if (!slotId) return;
    setMedia(await getMeetingMedia(slotId));
  }, [slotId]);

  /**
   * Tải lại mỗi lần quay về màn này.
   *
   * `status` của ca là thứ mở/khoá nút ghi âm (`canWriteNote`), mà nó đổi ở NƠI KHÁC: bấm
   * «Bắt đầu họp» ở màn lịch, hoặc cron tự huỷ ca. Chỉ nạp một lần lúc mở thì người dùng
   * quay lại vẫn thấy nút ghi âm xám, bấm không ăn, không có lời giải thích nào — đọc ra
   * đúng thành «app không ghi âm được».
   *
   * KHÔNG nạp lại nội dung biên bản ở đây: `loadSlot` chỉ đặt lại `content` khi ca đã có
   * ghi chú cũ, nhưng giáo viên có thể đang gõ dở — nên nó chỉ chạy khi ô còn trống.
   */
  useFocusEffect(
    useCallback(() => {
      void loadSlot();
      void loadMedia();
    }, [loadMedia, loadSlot])
  );

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

  /**
   * Chép phần chữ đã phiên âm xuống CUỐI ô biên bản.
   *
   * Nối thêm chứ không thay: giáo viên có thể đã gõ vài ý trong lúc gặp, ghi đè lên là xoá
   * mất chữ của họ. Ô này là `TextInput` không điều khiển con trỏ nên không chèn được tại
   * chỗ con trỏ như bản web — nối cuối là hành vi đoán được và không mất gì.
   */
  const appendTranscriptToNote = useCallback((text: string) => {
    const addition = text.trim();
    if (!addition) return;
    setContent((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${addition}` : addition));
  }, []);

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
      // Kiểm độ dài trên TEXT TRẦN ở trên, gửi đi bản HTML: đếm ký tự sau khi bọc thẻ thì
      // `<p></p>` tự nó đã qua ngưỡng tối thiểu.
      await submitMeetingNote(slotId, plainTextToHtml(body));
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
              {/* Ai cùng dự ca này — biên bản gửi BGH nên phải rõ đây là ghi chép của một
                  cuộc gặp có mấy thầy cô, không phải cuộc trao đổi tay đôi. */}
              {slot.co_teacher_names?.length ? (
                <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
                  Cùng dự: {slot.co_teacher_names.join(', ')}
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

          {/*
            BU bỏ khối «Meeting note CHỈ Ban Giám hiệu đọc được» (18/09/2026).

            ⚠️ LUẬT QUYỀN KHÔNG ĐỔI, chỉ bỏ câu chữ trên màn hình: `get_meeting_notes` vẫn chỉ
            trả biên bản cho chính người viết và BGH, giáo vụ vẫn không đọc được. Đừng đọc chỗ
            trống này thành "biên bản nay ai cũng xem được" rồi nới quyền ở backend theo.
          */}

          {/*
            Ghi âm đặt TRÊN ô gõ: giáo viên bấm ghi ngay khi phụ huynh ngồi xuống, còn
            biên bản thì gõ sau hoặc gõ dở trong lúc nói chuyện. Để dưới là phải cuộn qua
            cả ô nhập mới tới nút — đúng lúc không rảnh tay nhất.

            Cổng mở đúng bằng cổng của biên bản (`canWriteNote`): backend treo file lên
            BIÊN BẢN nên ca chưa bắt đầu thì cũng chưa có chỗ hợp lệ để treo.
          */}
          {slot ? (
            <ParentMeetingRecorder
              slotId={slotId}
              media={media}
              onChanged={() => void loadMedia()}
              disabled={!canWriteNote(slot)}
              disabledReason={
                slot.allow_meeting_note === 0
                  ? 'Đợt này không bật biên bản sau họp nên không ghi âm được.'
                  : 'Bấm «Bắt đầu họp» ở màn lịch trước đã — chưa vào ca thì chưa ghi âm được.'
              }
              onAppendToNote={appendTranscriptToNote}
            />
          ) : null}

          {/* Tóm tắt AI đứng RIÊNG dưới khối ghi âm: hai việc xảy ra ở hai thời điểm khác
              nhau (ghi trong lúc gặp, tóm tắt sau khi tiễn phụ huynh), và trên điện thoại
              gộp lại là bắt cuộn qua cả danh sách đoạn ghi âm mỗi lần muốn đọc tóm tắt. */}
          {slot ? (
            <ParentMeetingAiPanel
              slotId={slotId}
              media={media}
              disabled={!canWriteNote(slot)}
              onAppendToNote={appendTranscriptToNote}
            />
          ) : null}

          {/* Bản trên web có định dạng mà ô nhập này không giữ được. Báo TRƯỚC khi gõ:
              lưu từ app là làm phẳng bản cũ, và không có bước hoàn tác nào. */}
          {richNoteWarning ? (
            <View className="mb-4 flex-row rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
              <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
              <Text className="ml-2 flex-1 text-xs leading-5" style={{ color: '#92400E' }}>
                Biên bản này được soạn trên web và có định dạng (danh sách, in đậm…). Ứng dụng chỉ
                hiển thị được phần chữ, nên nếu lưu ở đây thì định dạng cũ sẽ mất. Muốn giữ nguyên
                thì hãy sửa trên web.
              </Text>
            </View>
          ) : null}

          <Text className="mb-1.5 text-sm font-semibold text-gray-700">
            Nội dung trao đổi <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={content}
            onChangeText={(next) => {
              // Đánh dấu «đã gõ» ngay từ ký tự đầu để lần tải lại khi focus không nạp đè.
              contentDirtyRef.current = true;
              setContent(next);
            }}
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
