/**
 * Tóm tắt AI của ca họp — bản app giáo viên.
 *
 * Tách khỏi `ParentMeetingRecorder` chứ không nhét chung như bản web: trên điện thoại,
 * khối ghi âm đã chiếm gần hết màn hình đầu, và hai việc này xảy ra ở hai thời điểm khác
 * nhau (ghi trong lúc gặp, tóm tắt sau khi tiễn phụ huynh). Ghép lại là bắt giáo viên cuộn
 * qua danh sách đoạn ghi âm mỗi lần chỉ muốn đọc tóm tắt.
 *
 * Làm mới theo `media`: màn cha đã tải lại `get_meeting_media` sau mỗi thay đổi, nên chỉ
 * cần bám vào đó là khối này tự cập nhật khi vừa ghi âm xong. Chỉ POLL khi máy chủ đang
 * thật sự chạy — xong rồi mà vẫn hỏi mỗi 5 giây thì mỗi màn đang mở đều đập vào backend.
 *
 * KHÔNG render HTML bằng WebView. Tóm tắt do CHÍNH prompt của ta sinh ra nên khuôn cố định
 * (bốn `<h3>` + `<ul><li>`); bóc thành cấu trúc rồi vẽ bằng `Text` của RN thì nhẹ hơn, cuộn
 * chung với trang được, và không phải đo chiều cao WebView — thứ luôn sai trong `ScrollView`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from '../../../components/Common';
import { color } from '../../../theme/tokens';
import { toast } from '../../../utils/toast';
import {
  downloadMeetingMinutesDocx,
  getMeetingProcessingStatus,
  startMeetingAiProcessing,
} from '../../../services/parentMeetingService';
import type {
  PTMeetingMedia,
  PTMeetingProcessingState,
  PTMeetingProcessingStatus,
} from '../../../types/parentMeeting';

/*
  Lấy từ `src/theme/tokens` chứ không viết hex thẳng như các file cũ cùng thư mục.
  `tokens.js` tự nhận là nguồn sự thật của màu và dặn code MỚI chỉ dùng nhóm `brand-*`;
  các file lân cận khai `const PRIMARY = '#002855'` là dấu vết trước khi có bộ token đó
  (và đang bị eslint cảnh báo). File này viết mới nên theo luật mới.
*/
const PRIMARY = color.brandSecondary.DEFAULT;
const DANGER = color.danger.DEFAULT;

/** Các trạng thái còn đang chạy — dùng để quyết định có poll tiếp không. */
const IN_FLIGHT: PTMeetingProcessingStatus[] = [
  'queued',
  'transcribing',
  'rate_limited',
  'summarizing',
];

function isInFlight(status?: PTMeetingProcessingStatus): boolean {
  return !!status && IN_FLIGHT.includes(status);
}

const STATUS_LABEL: Record<PTMeetingProcessingStatus, string> = {
  idle: 'Chưa ghi âm',
  uploaded: 'Đã có bản ghi âm',
  live: 'Đang ghi biên bản trực tiếp',
  queued: 'Đang chờ tới lượt',
  transcribing: 'Đang chuyển lời nói thành chữ',
  rate_limited: 'Đang chờ hạn mức',
  summarizing: 'Đang tóm tắt',
  done: 'Đã xong',
  failed: 'Lỗi xử lý',
};

export interface SummarySection {
  heading: string;
  items: string[];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');
}

/**
 * Bóc HTML tóm tắt thành các mục để vẽ bằng component RN.
 *
 * Cố ý KHÔNG viết bộ phân tích HTML tổng quát: đầu vào là thứ prompt của chính ta ra lệnh
 * sinh (`<h3>` + `<ul><li>`), nên chỉ cần bắt đúng khuôn đó. Không khớp — LLM trả khác
 * khuôn, hoặc ai đó sửa prompt — thì trả mảng rỗng để người gọi rơi về hiển thị text trần.
 * Thà mất định dạng còn hơn nuốt mất nội dung.
 */
export function parseSummarySections(html: string): SummarySection[] {
  if (!html) return [];
  const sections: SummarySection[] = [];
  const blockRe = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;

  let match = blockRe.exec(html);
  while (match !== null) {
    const heading = decodeEntities(match[1].replace(/<[^>]+>/g, '').trim());
    const body = match[2] || '';
    const items: string[] = [];

    const itemRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let item = itemRe.exec(body);
    while (item !== null) {
      const text = decodeEntities(item[1].replace(/<[^>]+>/g, '').trim());
      if (text) items.push(text);
      item = itemRe.exec(body);
    }

    // Mục không có `<li>` nào vẫn giữ lại phần chữ trần của nó, nếu có.
    if (!items.length) {
      const loose = decodeEntities(body.replace(/<[^>]+>/g, '').trim());
      if (loose) items.push(loose);
    }

    if (heading) sections.push({ heading, items });
    match = blockRe.exec(html);
  }
  return sections;
}

/** HTML -> text trần, dùng khi tóm tắt không khớp khuôn bốn mục. */
function htmlToPlainText(html: string): string {
  return decodeEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface Props {
  slotId: string;
  /** Màn cha tải lại sau mỗi thay đổi — dùng làm mốc để khối này tự làm mới. */
  media: PTMeetingMedia | null;
  /** Cùng cổng với ghi âm: ca chưa bắt đầu thì chưa có biên bản để xử lý. */
  disabled?: boolean;
  /** Chép bản ghi lời toàn văn sang ô biên bản. Nối thêm, không ghi đè. */
  onAppendToNote?: (text: string) => void;
}

export function ParentMeetingAiPanel({ slotId, media, disabled = false, onAppendToNote }: Props) {
  const [state, setState] = useState<PTMeetingProcessingState | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const refresh = useCallback(async () => {
    if (!slotId) return;
    setState(await getMeetingProcessingStatus(slotId));
  }, [slotId]);

  /*
    Nạp lại mỗi khi `media` đổi — tức sau mỗi lần ghi âm xong, vì màn cha tải lại
    `get_meeting_media` rồi truyền xuống.

    Đặt `setState` trong `.then` kèm cờ `cancelled` chứ không `void refresh()`: hai thay
    đổi `media` sát nhau sẽ có hai request bay song song, và cái về SAU chưa chắc là cái
    mới hơn — không huỷ thì trạng thái cũ ghi đè trạng thái mới. Đây cũng là dạng mà
    `react-hooks/set-state-in-effect` chấp nhận: cập nhật từ callback của hệ thống ngoài.
  */
  useEffect(() => {
    if (!slotId) return undefined;
    let cancelled = false;
    void getMeetingProcessingStatus(slotId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [slotId, media]);

  const status = state?.processing_status ?? 'idle';

  useEffect(() => {
    if (!isInFlight(status)) return undefined;
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [status, refresh]);

  const hasLiveTranscript = state?.has_live_transcript ?? false;
  const hasParts = (media?.audio_parts?.length ?? 0) > 0;
  const hasAnything = hasParts || hasLiveTranscript || (state?.has_transcript ?? false);

  const startAi = useCallback(async () => {
    setIsStarting(true);
    try {
      // Đã có chữ ghi trực tiếp ⇒ chỉ chạy lượt tóm tắt. Phiên âm lại file ghi âm khi đó là
      // nhân đôi nội dung biên bản và đốt hai lần hạn mức.
      await startMeetingAiProcessing(slotId, !hasLiveTranscript);
      toast.success('Đã đưa vào hàng đợi xử lý');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không bắt đầu xử lý được');
    } finally {
      setIsStarting(false);
    }
  }, [hasLiveTranscript, refresh, slotId]);

  const downloadDocx = useCallback(async () => {
    setIsDownloading(true);
    try {
      const uri = await downloadMeetingMinutesDocx(slotId);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dialogTitle: 'Biên bản ca họp',
          UTI: 'org.openxmlformats.wordprocessingml.document',
        });
      } else {
        // Máy không có bảng chia sẻ (hiếm, chủ yếu là giả lập): nói thẳng chỗ file nằm chứ
        // đừng im lặng coi như xong.
        toast.success('Đã tải biên bản về máy');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải được biên bản');
    } finally {
      setIsDownloading(false);
    }
  }, [slotId]);

  const sections = useMemo(
    () => parseSummarySections(state?.ai_summary || ''),
    [state?.ai_summary]
  );

  // Không có gì để xử lý và cũng chưa có kết quả ⇒ ẩn hẳn. Một khối trống với nút mờ chỉ
  // làm màn hình dài thêm.
  if (disabled || (!hasAnything && !state?.has_summary)) return null;

  const busy = isInFlight(status);

  return (
    <View className="mb-4 rounded-xl border border-gray-100 bg-white px-3.5 py-3">
      <View className="flex-row items-center">
        <Text className="flex-1 text-sm font-bold" style={{ color: PRIMARY }}>
          Biên bản AI
        </Text>
        {status !== 'idle' ? (
          <View className="flex-row items-center">
            {busy ? <ActivityIndicator size="small" color={PRIMARY} /> : null}
            <Text
              className="ml-1.5 text-[11px]"
              style={{ color: status === 'failed' ? DANGER : '#6B7280' }}>
              {STATUS_LABEL[status]}
            </Text>
          </View>
        ) : null}
      </View>

      {busy && (state?.parts_total ?? 0) > 0 ? (
        <Text className="mt-1 text-[11px] tabular-nums text-gray-500">
          Đã xử lý {state?.parts_done ?? 0}/{state?.parts_total ?? 0} đoạn
        </Text>
      ) : null}

      {status === 'rate_limited' ? (
        <View className="mt-2 flex-row rounded-lg bg-amber-50 px-2.5 py-2">
          <Ionicons name="time-outline" size={15} color="#B45309" />
          <Text className="ml-1.5 flex-1 text-[11px] leading-4" style={{ color: '#92400E' }}>
            Dịch vụ phiên âm đã đủ lượt trong giờ này. Hệ thống sẽ tự chạy tiếp, không cần
            bấm lại.
          </Text>
        </View>
      ) : null}

      {status === 'failed' && state?.processing_error ? (
        <View className="mt-2 flex-row rounded-lg bg-red-50 px-2.5 py-2">
          <Ionicons name="alert-circle-outline" size={15} color={DANGER} />
          <Text className="ml-1.5 flex-1 text-[11px] leading-4" style={{ color: '#991B1B' }}>
            {state.processing_error}
          </Text>
        </View>
      ) : null}

      <View className="mt-2.5 flex-row flex-wrap">
        <TouchableOpacity
          disabled={isStarting || busy || !hasAnything}
          onPress={() => void startAi()}
          className="mr-2 flex-row items-center rounded-lg px-3 py-2"
          style={{
            backgroundColor: '#E8EEF5',
            opacity: isStarting || busy || !hasAnything ? 0.5 : 1,
          }}>
          {isStarting ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : (
            <Ionicons name="sparkles-outline" size={15} color={PRIMARY} />
          )}
          <Text className="ml-1.5 text-xs font-semibold" style={{ color: PRIMARY }}>
            {state?.has_summary
              ? 'Tạo lại biên bản'
              : hasLiveTranscript
                ? 'Tóm tắt biên bản bằng AI'
                : 'Tạo biên bản bằng AI'}
          </Text>
        </TouchableOpacity>

        {state?.has_transcript || state?.has_summary ? (
          <TouchableOpacity
            disabled={isDownloading}
            onPress={() => void downloadDocx()}
            className="flex-row items-center rounded-lg border border-gray-200 px-3 py-2"
            style={{ opacity: isDownloading ? 0.5 : 1 }}>
            {isDownloading ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Ionicons name="download-outline" size={15} color={PRIMARY} />
            )}
            <Text className="ml-1.5 text-xs font-semibold" style={{ color: PRIMARY }}>
              Tải bản Word
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {state?.ai_summary ? (
        <View className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5">
          {sections.length ? (
            sections.map((section) => (
              <View key={section.heading} className="mb-2.5">
                <Text className="text-[13px] font-bold text-gray-900">{section.heading}</Text>
                {section.items.map((item, index) => (
                  <View key={index} className="mt-1 flex-row">
                    <Text className="text-[13px] leading-5 text-gray-500">• </Text>
                    <Text className="flex-1 text-[13px] leading-5 text-gray-800">{item}</Text>
                  </View>
                ))}
              </View>
            ))
          ) : (
            // Không khớp khuôn bốn mục — vẫn phải cho đọc được nội dung.
            <Text className="text-[13px] leading-5 text-gray-800">
              {htmlToPlainText(state.ai_summary)}
            </Text>
          )}
          <Text className="mt-1 text-[11px] leading-4 text-gray-500">
            Bản tóm tắt do máy tạo, cần người soát lại trước khi dùng chính thức.
          </Text>
        </View>
      ) : null}

      {state?.transcript ? (
        <View className="mt-3 border-t border-gray-100 pt-2.5">
          {/* Hai vùng bấm nằm CẠNH nhau, không lồng nhau: `TouchableOpacity` lồng trong
              `TouchableOpacity` thì trên Android cái ngoài nuốt press của cái trong —
              nút «Chép» hiện ra mà bấm chỉ thu gọn danh sách. */}
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => setShowTranscript((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showTranscript }}
              className="flex-1 flex-row items-center py-1">
              <Ionicons
                name={showTranscript ? 'chevron-down' : 'chevron-forward'}
                size={15}
                color="#6B7280"
              />
              <Text className="ml-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Bản ghi lời toàn văn
              </Text>
            </TouchableOpacity>
            {onAppendToNote ? (
              <TouchableOpacity
                onPress={() => onAppendToNote(state.transcript || '')}
                accessibilityLabel="Chép vào biên bản"
                className="ml-2 rounded-lg bg-[#E8EEF5] px-2.5 py-1.5">
                <Text className="text-[11px] font-semibold" style={{ color: PRIMARY }}>
                  Chép vào biên bản
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {showTranscript ? (
            <Text className="mt-2 text-[12px] leading-5 text-gray-700">{state.transcript}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default ParentMeetingAiPanel;
