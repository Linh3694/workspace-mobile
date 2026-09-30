/**
 * Ghi âm cuộc gặp với phụ huynh — bản app giáo viên.
 *
 * Cùng hợp đồng với bản web (`ParentMeetingRecorderCard`) nhưng KHÔNG chép được logic:
 * web dựng trên `MediaRecorder` + `AnalyserNode` của trình duyệt, ở đây là `expo-audio`.
 * Bốn quyết định dưới đây là phần khác nhau thật sự, không phải khác biệt hình thức.
 *
 * CHIA ĐOẠN, KHÔNG MỘT FILE
 * -------------------------
 * Cứ `PART_SECONDS` là dừng bản ghi hiện tại, gửi lên, rồi mở bản mới. Máy chủ không có
 * `ffmpeg` để cắt ghép nên mỗi đoạn phải là một file hợp lệ độc lập; đổi lại, app chết
 * giữa buổi thì chỉ mất đoạn đang ghi chứ không mất cả cuộc gặp.
 *
 * ⚠️ Khác web ở một điểm không giấu được: `stop()` rồi `prepareToRecordAsync()` cho đoạn kế
 * có khe hở vài trăm mili giây giữa hai đoạn, trong khi web giữ nguyên luồng micro và chỉ
 * khởi động lại bộ mã hoá. Không có API nào của `expo-audio` xoá được khe này. 5 phút một
 * đoạn là để khe đó hiếm nhất có thể — đừng rút ngắn `PART_SECONDS` cho "an toàn hơn",
 * càng chia nhỏ càng mất nhiều lần.
 *
 * SÓNG ÂM LÀ SÓNG THẬT
 * --------------------
 * Chiều cao mỗi vạch đọc từ `metering` của chính bản ghi đang chạy. Một hoạt hoạ giả vẫn
 * nhảy khi micro đã chết — và giáo viên sẽ yên tâm suốt buổi để rồi phát hiện không có gì
 * được ghi. Vì thế `isMeteringEnabled` là bắt buộc, không phải tuỳ chọn cho đẹp.
 *
 * Khác `expo-av`: `expo-audio` KHÔNG đẩy `metering`/`durationMillis` về qua callback —
 * `recordingStatusUpdate` chỉ bắn lúc bản ghi kết thúc hoặc lỗi. Nên nhịp `METER_INTERVAL_MS`
 * ở đây là ta tự hỏi `recorder.getStatus()`; nguồn số liệu vẫn là bản ghi thật, không đổi.
 *
 * DỪNG LÀ GỬI NGAY
 * ----------------
 * Không giữ file chờ người dùng bấm lưu: thoát app là mất sạch, mà đây là thứ không ghi
 * lại được.
 *
 * CHẠY TIẾP KHI KHOÁ MÀN HÌNH
 * ---------------------------
 * `allowsBackgroundRecording` + `UIBackgroundModes: ["audio"]` trong `app.json`. Buổi họp
 * 1:1 là ngồi đối diện phụ huynh, giáo viên úp máy xuống bàn hoặc để màn hình tự tắt là
 * chuyện bình thường; không có cờ này thì iOS cắt ghi âm ngay lúc đó mà không báo gì.
 * Trên Android, tiến trình vẫn có thể bị hệ thống thu hồi khi app ở nền lâu — đó là giới
 * hạn thật, nên đồng hồ và trạng thái phải luôn nói đúng những gì ĐÃ gửi lên.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  AppState,
  Platform,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  AudioQuality,
  IOSOutputFormat,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioStream,
  type AudioPlayer,
  type AudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import Slider from '@react-native-community/slider';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from '../../../components/Common';
import { toast } from '../../../utils/toast';
import {
  deleteMeetingAudio,
  getMeetingAudioPartSource,
  uploadMeetingAudioPart,
} from '../../../services/parentMeetingService';
import { WavStreamWriter } from '../../../utils/wavFile';
import {
  useParentMeetingLiveTranscribe,
  type PTLiveLine,
  type PTLiveStatus,
} from './useParentMeetingLiveTranscribe';
import { color } from '../../../theme/tokens';
import type { PTMeetingAudioPart, PTMeetingMedia } from '../../../types/parentMeeting';

const PRIMARY = color.brandSecondary.DEFAULT;
const DANGER = '#DC2626';

/** Độ dài một đoạn. 5 phút: đủ ngắn để mất ít khi sập, đủ dài để không băm nhỏ một ca 15 phút. */
const PART_SECONDS = 300;
/** Số vạch sóng âm. Vừa đủ kín chiều ngang điện thoại mà không tốn quá nhiều lần render. */
const BAR_COUNT = 28;
const BAR_FLOOR = 0.08;
/** Nhịp đọc `metering`. 200ms cho sóng mượt mà không làm nghẽn cầu JS. */
const METER_INTERVAL_MS = 200;

/**
 * Cấu hình luồng PCM của ĐƯỜNG PHIÊN ÂM TRỰC TIẾP.
 *
 * 16kHz mono là chuẩn của mọi dịch vụ phiên âm — cao hơn không làm chữ đúng hơn, chỉ làm
 * file to hơn. Ở mức này PCM 16 bit là 32 KB/giây, tức một đoạn 5 phút ≈ 9,6 MB (đổi lại
 * so với ~2,4 MB của m4a ở đường thường). Đó là cái giá phải trả để chỉ mở MỘT luồng
 * micro — xem `utils/wavFile.ts`.
 */
const LIVE_SAMPLE_RATE = 16000;
const LIVE_CHANNELS = 1;

/** Cứ ngần này mẩu PCM mới vẽ lại sóng một lần (~5 lần/giây, bằng đường thường). */
const LIVE_METER_EVERY = 2;

/**
 * Mức sóng từ PCM thô: RMS của mẩu vừa nhận.
 *
 * Đường ghi âm thường có sẵn `metering` tính bằng dBFS; luồng PCM thì không có gì cả, nên
 * phải tự tính. Nhân 3 rồi chặn ở 1 vì giọng nói bình thường chỉ quanh RMS 0,05–0,2 —
 * không khuếch đại thì dải vạch gần như nằm im và trông hệt như micro đã chết.
 */
function levelOfPcm(bytes: Uint8Array): number {
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  if (!samples.length) return BAR_FLOOR;
  let sum = 0;
  // Lấy mẫu thưa: một mẩu 100ms ở 16kHz là 1.600 số, duyệt hết 5 lần mỗi giây là phí.
  const step = Math.max(1, Math.floor(samples.length / 64));
  let count = 0;
  for (let i = 0; i < samples.length; i += step) {
    const v = samples[i] / 32768;
    sum += v * v;
    count += 1;
  }
  const rms = Math.sqrt(sum / Math.max(1, count));
  return Math.min(1, Math.max(BAR_FLOOR, rms * 3));
}

/**
 * Tuỳ chọn ghi âm — TIẾNG NÓI, không phải nhạc.
 *
 * Mono 64kbps AAC: một ca 45 phút ≈ 21MB. Preset `HIGH_QUALITY` của `expo-audio` là stereo
 * 128kbps, tức gấp đôi dung lượng cho thứ không ai nghe ra khác biệt ở giọng người — mà
 * cả trường họp một ngày là hàng trăm ca nằm trên đĩa.
 *
 * `.m4a` ở cả hai nền tảng vì đó là định dạng `AUDIO_CONTENT_TYPES` của backend nhận sẵn;
 * đổi sang thứ khác là phải sửa cả máy chủ.
 */
const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  isMeteringEnabled: true,
  // `expo-audio` đưa bốn khoá này lên gốc thay vì lặp trong từng nền tảng như `expo-av`.
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  // Không chạy trên web, nhưng kiểu `RecordingOptions` bắt buộc có khoá này.
  web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
};

/**
 * Ghi âm ở NỀN có chạy được trên máy này không.
 *
 * iOS: có, nhờ `UIBackgroundModes: ["audio"]`.
 *
 * Android: `expo-audio` hiện thực bằng một FOREGROUND SERVICE, và service đó bắt buộc phải
 * có thông báo — `AudioRecorder.prepareRecording` ném `NotificationPermissionsException`
 * ngay từ đầu nếu `POST_NOTIFICATIONS` chưa được cấp (Android 13+). Nghĩa là một giáo viên
 * đã tắt thông báo của app sẽ KHÔNG ghi âm được gì cả, chứ không phải chỉ mất phần chạy nền.
 *
 * Nên hỏi trước rồi HẠ CẤP: chưa có quyền thông báo thì ghi âm ở tiền cảnh thôi. Ghi được
 * mà không chạy nền vẫn hơn hẳn không ghi được gì — và đó cũng là tình huống duy nhất mà
 * cảnh báo "Android dừng ghi khi rời ứng dụng" bên dưới còn đúng.
 *
 * KHÔNG tự xin quyền thông báo ở đây: người dùng tắt thông báo là một quyết định có chủ ý
 * về app nói chung, cướp lấy đúng lúc họ sắp bấm ghi âm là hỏi sai chỗ và sai thời điểm.
 */
async function canRecordInBackground(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    return granted;
  } catch {
    // Không hỏi được thì coi như không có: hạ cấp về tiền cảnh vẫn ghi âm được,
    // còn đoán bừa là "có" thì `prepareToRecordAsync` bị từ chối và mất cả tính năng.
    return false;
  }
}

/** `-160..0` dBFS -> `0..1`. Giọng nói thật nằm khoảng -40..-5 nên lấy -50 làm đáy. */
function levelOfMetering(metering: number | undefined): number {
  if (typeof metering !== 'number' || Number.isNaN(metering)) return BAR_FLOOR;
  return Math.min(1, Math.max(BAR_FLOOR, (metering + 50) / 50));
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

interface Props {
  slotId: string;
  media: PTMeetingMedia | null;
  /** Gọi sau mỗi lần dữ liệu đổi ở máy chủ để màn cha tải lại `get_meeting_media`. */
  onChanged: () => void;
  disabled?: boolean;
  disabledReason?: string;
  /**
   * Chép phần chữ đã phiên âm sang ô biên bản của giáo viên.
   *
   * Cố ý KHÔNG tự động chép: ô đó là chỗ người ta tự gõ, máy ghi đè vào là xoá mất ý
   * người ta đang viết dở.
   */
  onAppendToNote?: (text: string) => void;
}

export function ParentMeetingRecorder({
  slotId,
  media,
  onChanged,
  disabled = false,
  disabledReason,
  onAppendToNote,
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(BAR_FLOOR));
  const [isBusy, setIsBusy] = useState(false);
  /** Đang phát lại hay không. Ref đi kèm để vòng poll đọc mà không phải khai phụ thuộc. */
  const [isPlaying, setIsPlaying] = useState(false);
  /** Đang nạp một đoạn (đổi đoạn hoặc lần bấm play đầu tiên). */
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  /** Ngón tay đang trượt trên thanh kéo — vòng poll phải nhường quyền vẽ. */
  const [isSeeking, setIsSeeking] = useState(false);
  /** Vị trí trên dòng thời gian GỘP của cả ca, tính bằng giây. */
  const [playPosition, setPlayPosition] = useState(0);
  /** Android vừa cắt bản ghi vì app rời tiền cảnh — xem effect `AppState` bên dưới. */
  const [stoppedByBackground, setStoppedByBackground] = useState(false);
  /** Phiên ghi hiện tại có giữ được micro khi rời tiền cảnh không — quyết định câu trạng thái. */
  const [backgroundCapable, setBackgroundCapable] = useState(true);
  /**
   * Ô tick phiên âm trực tiếp. MẶC ĐỊNH TẮT và luôn bắt đầu ở TẮT mỗi lần mở màn.
   *
   * Đây là trao đổi riêng về một học sinh; tiếng chỉ rời hệ thống khi giáo viên tự tick ở
   * đúng ca đó. Đừng nhớ lựa chọn này vào AsyncStorage — tick một lần rồi mặc nhiên bật
   * cho mọi buổi gặp sau là đúng thứ quyết định ban đầu muốn tránh.
   */
  const [liveEnabled, setLiveEnabled] = useState(false);

  /**
   * MỘT recorder cho cả vòng đời component. `expo-audio` cho dùng lại instance —
   * `prepareToRecordAsync()` mở file mới mỗi lần — nên không phải dựng `Recording` mới từng
   * đoạn như `expo-av`. Hook tự giải phóng khi component bị gỡ.
   */
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);

  /** Khác `recorder`: chỉ khác null KHI đang có một đoạn chạy dở. */
  const recordingRef = useRef<AudioRecorder | null>(null);
  /** Vòng đọc `metering` — xem chú thích ở `startPart`. */
  const meterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const partIndexRef = useRef(0);
  /** Đang dừng hẳn — để callback trạng thái không mở đoạn mới sau khi người dùng bấm Dừng. */
  const stoppingRef = useRef(false);
  /** Đang xoay vòng sang đoạn kế — chặn callback gọi `rotate` chồng lên nhau. */
  const rotatingRef = useRef(false);
  /** Lần dừng này là do rời tiền cảnh (Android), không phải do người dùng bấm. */
  const backgroundStopRef = useRef(false);
  /**
   * Phiên này có chạy nền được không (xem `canRecordInBackground`). Ref để effect `AppState`
   * đọc mà không phải khai thêm phụ thuộc; state đi kèm chỉ để vẽ câu trạng thái.
   */
  const backgroundCapableRef = useRef(true);
  const playerRef = useRef<AudioPlayer | null>(null);
  /** Đoạn đang nạp trong trình phát — chỉ số trong `timeline`. */
  const segmentRef = useRef(0);
  const playPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayingRef = useRef(false);
  const isSeekingRef = useRef(false);
  /** Tổng giây của các đoạn ĐÃ ghi trong phiên này, không kể đoạn đang chạy. */
  const sessionBaseRef = useRef(0);
  /**
   * Bản ref của `elapsed`. Có cả hai vì hai mục đích khác nhau: state để vẽ đồng hồ, ref
   * để `stop` đọc mà KHÔNG phải khai `elapsed` là phụ thuộc — `elapsed` đổi mỗi 200ms, mà
   * `stop` đổi theo thì listener `AppState` bên dưới bị gắn lại liên tục.
   */
  const elapsedRef = useRef(0);

  // `useMemo`: `parts` nằm trong dependency của `start`, mà `?? []` tạo mảng MỚI mỗi lần
  // render — không memo thì `start` được dựng lại liên tục.
  const parts = useMemo(() => media?.audio_parts ?? [], [media]);
  const savedSeconds = media?.audio_duration ?? 0;

  // ----- Đường PHIÊN ÂM TRỰC TIẾP -------------------------------------------
  //
  // Hai đường ghi âm KHÔNG chạy cùng lúc, và đó không phải lựa chọn thiết kế mà là giới
  // hạn của nền tảng: `useAudioStream` và `useAudioRecorder` tranh nhau micro (xem
  // `utils/wavFile.ts`). Nên bật tick là đổi hẳn sang luồng PCM, còn tắt tick thì mọi thứ
  // chạy y như trước khi có tính năng này.

  /** File WAV đang được dựng cho đoạn hiện tại của đường trực tiếp. */
  const wavWriterRef = useRef<WavStreamWriter | null>(null);
  /** Đường trực tiếp có đang chạy không — để listener `AppState` đọc mà không phụ thuộc state. */
  const liveActiveRef = useRef(false);
  /** Đếm mẩu PCM để vẽ sóng thưa hơn nhịp `onBuffer`. */
  const liveTickRef = useRef(0);
  /** Chặn hai lượt xoay vòng chồng nhau khi mẩu PCM về dồn dập. */
  const liveRotatingRef = useRef(false);

  const liveAvailable = media?.live_available ?? false;
  const live = useParentMeetingLiveTranscribe({
    slotId,
    sampleRate: LIVE_SAMPLE_RATE,
    channels: LIVE_CHANNELS,
  });

  /** Trả micro và khôi phục chế độ âm thanh. Gọi được nhiều lần. */
  const releaseAudioMode = useCallback(async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        allowsBackgroundRecording: false,
        shouldPlayInBackground: false,
        playsInSilentMode: true,
      });
    } catch {
      // Không có gì để làm tiếp — bản ghi đã gửi xong rồi, và báo lỗi ở đây chỉ gây hoang mang.
    }
  }, []);

  /**
   * Gửi một file đoạn lên máy chủ.
   *
   * Hỏng thì BÁO RÕ kèm số thứ tự đoạn rồi đi tiếp: đoạn sau vẫn ghi và vẫn gửi được, mà
   * dừng cả buổi vì một lần rớt mạng là mất phần còn lại của cuộc gặp. Không tự thử lại —
   * `part_index` đã tiến, thử lại đúng chỗ cần một hàng đợi mà giá trị không bù nổi độ phức tạp.
   */
  const uploadPart = useCallback(
    async (
      uri: string | null,
      index: number,
      seconds: number,
      format: 'm4a' | 'wav' = 'm4a'
    ) => {
      if (!uri || seconds < 1) return;
      try {
        await uploadMeetingAudioPart({
          slotId,
          partIndex: index,
          durationSec: seconds,
          uri,
          format,
        });
        onChanged();
      } catch (e) {
        toast.error(
          e instanceof Error
            ? `Không gửi được đoạn ${index + 1}: ${e.message}`
            : `Không gửi được đoạn ${index + 1}`
        );
      }
    },
    [onChanged, slotId]
  );

  /** Chốt file WAV hiện tại, gửi đi, và mở file mới nếu còn ghi tiếp. */
  const rotateWavPart = useCallback(
    (openNext: boolean) => {
      const writer = wavWriterRef.current;
      wavWriterRef.current = null;
      if (writer) {
        const index = partIndexRef.current;
        partIndexRef.current = index + 1;
        const { uri, seconds } = writer.finish();
        sessionBaseRef.current += seconds;
        // Gửi ở nền: mỗi mili giây chờ mạng ở đây là một mili giây cuộc trò chuyện không
        // được ghi. Đoạn mới phải mở NGAY.
        void uploadPart(uri, index, seconds, 'wav');
      }
      if (openNext) {
        wavWriterRef.current = WavStreamWriter.create(
          `ca-${slotId}-${Date.now()}.wav`,
          { sampleRate: LIVE_SAMPLE_RATE, channels: LIVE_CHANNELS }
        );
      }
    },
    [slotId, uploadPart]
  );

  /**
   * Mỗi mẩu PCM từ micro đi tới HAI nơi.
   *
   * Thứ tự cố ý: đẩy sang dịch vụ phiên âm TRƯỚC, ghi đĩa sau. Ghi đĩa là thao tác đồng
   * bộ; đặt nó trước thì mỗi mẩu tiếng tới muộn thêm đúng ngần ấy và chữ trên màn hình
   * lệch dần khỏi lời nói.
   */
  const handleLiveBuffer = useCallback(
    (buffer: { data: ArrayBuffer }) => {
      if (!liveActiveRef.current) return;
      const bytes = new Uint8Array(buffer.data);

      live.pushAudio(bytes);
      wavWriterRef.current?.append(bytes);

      const writer = wavWriterRef.current;
      if (!writer) return;

      elapsedRef.current = sessionBaseRef.current + writer.seconds;

      liveTickRef.current += 1;
      if (liveTickRef.current % LIVE_METER_EVERY === 0) {
        setElapsed(elapsedRef.current);
        setLevels((prev) => [...prev.slice(1), levelOfPcm(bytes)]);
      }

      if (writer.seconds >= PART_SECONDS && !liveRotatingRef.current && !stoppingRef.current) {
        liveRotatingRef.current = true;
        try {
          rotateWavPart(true);
        } finally {
          liveRotatingRef.current = false;
        }
      }
    },
    [live, rotateWavPart]
  );

  // Hook phải gọi vô điều kiện dù đường trực tiếp có bật hay không; `stream.start()` mới là
  // chỗ thật sự chạm vào micro. `onBuffer` được `expo-audio` giữ trong ref nên đổi callback
  // KHÔNG dựng lại luồng.
  const { stream: audioStream } = useAudioStream({
    sampleRate: LIVE_SAMPLE_RATE,
    channels: LIVE_CHANNELS,
    encoding: 'int16',
    onBuffer: handleLiveBuffer,
  });

  /**
   * `rotatePart` gọi `startPart` và ngược lại. Nối vòng qua REF chứ không để hai
   * `useCallback` tham chiếu chéo: tham chiếu chéo thì bản `startPart` tạo ở lần render
   * đầu ôm mãi bản `rotatePart` của lần render đó, kéo theo cả `onChanged` cũ — nghĩa là
   * đoạn ghi xong không làm màn hình tải lại, mà không có lỗi nào phát sinh.
   */
  const rotateRef = useRef<() => Promise<void>>(async () => {});

  /** Dừng vòng đọc `metering`. Gọi được nhiều lần, gọi khi chưa chạy cũng không sao. */
  const stopMeterLoop = useCallback(() => {
    if (meterTimerRef.current) {
      clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
    }
  }, []);

  /**
   * Mở bản ghi cho đoạn kế tiếp.
   *
   * `expo-av` tự đẩy `durationMillis` + `metering` về theo nhịp đặt sẵn. `expo-audio` thì
   * không: `recordingStatusUpdate` chỉ bắn khi bản ghi kết thúc hoặc lỗi. Nên vòng lặp dưới
   * đây là ta CHỦ ĐỘNG hỏi `getStatus()` mỗi `METER_INTERVAL_MS` — vẫn là số liệu của bản
   * ghi thật, chỉ đổi chiều lấy dữ liệu. Cả đồng hồ lẫn mốc xoay vòng đều bám vào nhịp này,
   * nên nó dừng là hai thứ kia đứng theo: mọi lối thoát khỏi một đoạn phải gọi `stopMeterLoop`.
   */
  const startPart = useCallback(async () => {
    await recorder.prepareToRecordAsync();
    recorder.record();
    recordingRef.current = recorder;

    stopMeterLoop();
    meterTimerRef.current = setInterval(() => {
      const status = recorder.getStatus();
      if (!status.isRecording) return;
      const seconds = (status.durationMillis ?? 0) / 1000;
      elapsedRef.current = sessionBaseRef.current + seconds;
      setElapsed(elapsedRef.current);
      setLevels((prev) => [...prev.slice(1), levelOfMetering(status.metering)]);
      if (seconds >= PART_SECONDS && !rotatingRef.current && !stoppingRef.current) {
        void rotateRef.current();
      }
    }, METER_INTERVAL_MS);
  }, [recorder, stopMeterLoop]);

  /** Đủ `PART_SECONDS`: chốt đoạn hiện tại, gửi đi, mở đoạn mới NGAY. */
  const rotatePart = useCallback(async () => {
    if (rotatingRef.current) return;
    rotatingRef.current = true;
    try {
      const current = recordingRef.current;
      recordingRef.current = null;
      const index = partIndexRef.current;
      partIndexRef.current = index + 1;
      sessionBaseRef.current += PART_SECONDS;

      let uri: string | null = null;
      let seconds = PART_SECONDS;
      if (current) {
        // Độ dài phải đọc TRƯỚC khi dừng: `stop()` của `expo-audio` trả `void`, và
        // `getStatus()` sau đó không còn giữ `durationMillis` của đoạn vừa chốt.
        const before = current.getStatus();
        if (typeof before.durationMillis === 'number' && before.durationMillis > 0) {
          seconds = before.durationMillis / 1000;
        }
        stopMeterLoop();
        await current.stop().catch(() => undefined);
        // Ngược lại, `uri` chỉ trỏ tới file hoàn chỉnh SAU khi đã dừng.
        uri = current.uri;
      }
      // Mở đoạn mới TRƯỚC khi chờ upload xong: upload đi qua mạng, mà mỗi mili giây chờ ở
      // đây là một mili giây cuộc trò chuyện không được ghi.
      if (!stoppingRef.current) await startPart();
      void uploadPart(uri, index, seconds);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ghi âm bị gián đoạn');
      setIsRecording(false);
    } finally {
      rotatingRef.current = false;
    }
  }, [startPart, stopMeterLoop, uploadPart]);

  // Cập nhật trong effect chứ không gán thẳng lúc render — gán lúc render là tác dụng phụ,
  // và StrictMode render hai lần sẽ làm nó chạy hai lượt.
  useEffect(() => {
    rotateRef.current = rotatePart;
  }, [rotatePart]);

  const start = useCallback(async () => {
    if (disabled || isBusy || isRecording) return;
    setIsBusy(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        // Nói thẳng chứ đừng để nút bấm xong không có gì xảy ra. Từ chối vĩnh viễn thì chỉ
        // mở được lại trong Cài đặt hệ thống — app không hỏi lại được nữa.
        Alert.alert(
          'Chưa có quyền ghi âm',
          'Vào Cài đặt > ứng dụng này > Micro để bật quyền, rồi quay lại thử lại.'
        );
        return;
      }
      const useLive = liveEnabled && liveAvailable;

      // Hỏi TRƯỚC khi đặt chế độ: trên Android, xin chạy nền mà máy chưa cho phép thông báo
      // thì `prepareToRecordAsync` bị từ chối thẳng, mất luôn cả ghi âm tiền cảnh.
      //
      // Đường TRỰC TIẾP thì khác: nó chạy trên `AudioRecord` / `AVAudioEngine` trần, KHÔNG
      // dựng foreground service nào, nên Android chắc chắn cắt micro lúc rời tiền cảnh —
      // quyền thông báo có hay không cũng vậy. Nói đúng ngay từ đầu để câu trạng thái bên
      // dưới không hứa thứ máy không làm được.
      const background = useLive ? Platform.OS === 'ios' : await canRecordInBackground();
      backgroundCapableRef.current = background;
      setBackgroundCapable(background);

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        // Điểm mấu chốt của cả tính năng: khoá màn hình giữa buổi vẫn ghi tiếp.
        // `expo-audio` tách riêng cờ cho GHI ÂM ở nền, không dùng chung với phát như trước —
        // thiếu `allowsBackgroundRecording` là iOS vẫn cắt micro dù có `UIBackgroundModes`.
        allowsBackgroundRecording: background,
        shouldPlayInBackground: true,
        // Một cờ cho cả hai nền tảng, thay cặp `interruptionModeIOS`/`Android` của `expo-av`.
        interruptionMode: 'doNotMix',
        shouldRouteThroughEarpiece: false,
      });

      // Đang nghe lại mà bấm ghi tiếp: tắt trình phát trước. Để cả hai cùng chạy là micro
      // thu luôn tiếng loa đang phát lại đoạn cũ.
      if (isPlayingRef.current) {
        playerRef.current?.pause();
        isPlayingRef.current = false;
        setIsPlaying(false);
        if (playPollRef.current) clearInterval(playPollRef.current);
        playPollRef.current = null;
      }

      stoppingRef.current = false;
      rotatingRef.current = false;
      backgroundStopRef.current = false;
      sessionBaseRef.current = 0;
      elapsedRef.current = 0;
      setStoppedByBackground(false);
      setElapsed(0);
      setLevels(Array(BAR_COUNT).fill(BAR_FLOOR));
      // Đoạn mới nối SAU các đoạn đã có, không đè lên: một ca ghi được nhiều lần (dừng rồi ghi tiếp).
      partIndexRef.current = parts.length
        ? Math.max(...parts.map((p) => p.part_index)) + 1
        : 0;

      if (useLive) {
        liveTickRef.current = 0;
        liveActiveRef.current = true;
        // Mở file WAV TRƯỚC khi mở micro: mẩu PCM đầu tiên có thể về ngay trong lời gọi
        // `start()`, và không có chỗ ghi thì mẩu đó rơi mất.
        wavWriterRef.current = WavStreamWriter.create(`ca-${slotId}-${Date.now()}.wav`, {
          sampleRate: LIVE_SAMPLE_RATE,
          channels: LIVE_CHANNELS,
        });
        try {
          await audioStream.start();
        } catch (e) {
          // Dọn sạch rồi mới ném lên: để `liveActiveRef` bật và file WAV mở dở là lần bấm
          // sau thấy trạng thái nửa vời.
          liveActiveRef.current = false;
          wavWriterRef.current?.discard();
          wavWriterRef.current = null;
          throw e;
        }
        // `attach` SAU khi micro đã mở, để mốc thời gian của chữ khớp bản ghi âm.
        await live.attach();
      } else {
        await startPart();
      }
      setIsRecording(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không bắt đầu ghi âm được');
      await releaseAudioMode();
    } finally {
      setIsBusy(false);
    }
  }, [
    audioStream,
    disabled,
    isBusy,
    isRecording,
    live,
    liveAvailable,
    liveEnabled,
    parts,
    releaseAudioMode,
    slotId,
    startPart,
  ]);

  const stop = useCallback(async () => {
    if (!isRecording) return;
    stoppingRef.current = true;
    setIsRecording(false);
    setIsBusy(true);
    try {
      if (liveActiveRef.current) {
        /*
          THỨ TỰ Ở ĐÂY QUYẾT ĐỊNH CÓ MẤT CÂU CUỐI HAY KHÔNG.

          Nhà cung cấp chỉ chốt câu đang nói dở sau khi nhận `CloseStream`, mà lệnh đó cần
          tiếng vẫn đang chảy tới. Tắt micro trước là mất hẳn câu chốt cuối cùng — thường
          lại đúng là câu kết luận của buổi gặp.

          `detach` gọi lại hàm dưới đây NGAY khi nhà cung cấp đóng xong, tức lúc sớm nhất
          micro không còn cần thiết; phần lưu chữ lên máy chủ chạy tiếp sau đó. Không tách
          ra thì mạng chậm là đèn micro vẫn sáng cả phút sau khi giáo viên đã tiễn khách.
        */
        await live.detach(() => {
          liveActiveRef.current = false;
          try {
            audioStream.stop();
          } catch {
            // Luồng đã đóng sẵn — không còn gì để tắt.
          }
        });
        // Chốt file WAV SAU khi micro tắt hẳn, chắc chắn không còn mẩu nào ghi thêm.
        rotateWavPart(false);
        return;
      }

      const current = recordingRef.current;
      recordingRef.current = null;
      if (current) {
        const before = current.getStatus();
        const seconds =
          typeof before.durationMillis === 'number' && before.durationMillis > 0
            ? before.durationMillis / 1000
            : Math.max(0, elapsedRef.current - sessionBaseRef.current);
        stopMeterLoop();
        await current.stop().catch(() => undefined);
        await uploadPart(current.uri, partIndexRef.current, seconds);
      }
    } finally {
      await releaseAudioMode();
      setLevels(Array(BAR_COUNT).fill(BAR_FLOOR));
      elapsedRef.current = 0;
      setElapsed(0);
      setIsBusy(false);
    }
  }, [
    audioStream,
    isRecording,
    live,
    releaseAudioMode,
    rotateWavPart,
    stopMeterLoop,
    uploadPart,
  ]);

  // Rời màn giữa buổi vẫn phải nhả micro. KHÔNG cố gửi nốt đoạn dở ở đây: component đang bị
  // gỡ nên không còn chỗ báo kết quả, và một upload chạy mồ côi thì hỏng cũng không ai biết.
  useEffect(
    () => () => {
      stoppingRef.current = true;
      if (meterTimerRef.current) clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
      void recordingRef.current?.stop().catch(() => undefined);
      recordingRef.current = null;
      // Đường trực tiếp cũng phải nhả micro. File WAV dở thì BỎ chứ không gửi: hook phiên
      // âm đã đẩy nốt phần chữ của nó, còn một đoạn tiếng cụt gửi lên từ component đang bị
      // gỡ thì hỏng cũng không ai biết — cùng lý do với đoạn m4a ở trên.
      liveActiveRef.current = false;
      try {
        audioStream.stop();
      } catch {
        // Luồng chưa từng mở hoặc đã đóng.
      }
      wavWriterRef.current?.discard();
      wavWriterRef.current = null;
      if (playPollRef.current) clearInterval(playPollRef.current);
      playPollRef.current = null;
      // `remove()` thay `unloadAsync()`: `AudioPlayer` là SharedObject, gỡ là trả tài nguyên luôn.
      try {
        playerRef.current?.remove();
      } catch {
        // Đã bị gỡ trước đó — không còn gì để dọn.
      }
      playerRef.current = null;
      void setAudioModeAsync({
        allowsRecording: false,
        allowsBackgroundRecording: false,
        shouldPlayInBackground: false,
      }).catch(() => undefined);
    },
    // `audioStream` là SharedObject ổn định theo cấu hình luồng (sampleRate/channels/
    // encoding đều là hằng ở đây), nên effect này vẫn chỉ chạy dọn đúng một lần lúc gỡ.
    [audioStream]
  );

  /**
   * ANDROID CẮT MICRO KHI APP RỜI TIỀN CẢNH — kể cả chỉ là khoá màn hình.
   *
   * `UIBackgroundModes: audio` chỉ cứu được iOS. Từ Android 9, app không chạy foreground
   * service thì mất quyền micro ngay khi activity dừng, mà `expo-audio` không dựng service
   * nào (app đang target SDK 36). Không xử lý thì bản ghi tiếp tục "chạy" trên màn hình
   * trong khi thứ thu được là im lặng — đúng loại hỏng mà cả module này cố tránh: nói dối
   * người dùng cho tới lúc không sửa được nữa.
   *
   * Nên: chốt đoạn đang ghi NGAY lúc rời tiền cảnh (phần đã thu vẫn nguyên vẹn và được
   * gửi đi), rồi báo thẳng khi giáo viên quay lại. Thà bắt họ bấm ghi tiếp còn hơn để họ
   * tin là đang ghi.
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !isRecording) return undefined;
    // Có foreground service thì micro KHÔNG bị cắt — tự dừng ở đây mới là thứ làm hỏng
    // tính năng. Chỉ can thiệp ở nhánh đã hạ cấp vì thiếu quyền thông báo.
    if (backgroundCapableRef.current) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (backgroundStopRef.current) {
          backgroundStopRef.current = false;
          setStoppedByBackground(true);
          toast.error('Android đã dừng ghi âm khi rời ứng dụng. Phần đã ghi vẫn được lưu.');
          onChanged();
        }
        return;
      }
      // Cả HAI đường đều phải bắt: đường trực tiếp không có `recordingRef`, chỉ có
      // `liveActiveRef`. Bỏ sót nó là bản ghi vẫn "chạy" trên màn hình trong khi Android
      // đã cắt micro — đúng kiểu nói dối người dùng mà cả module này cố tránh.
      if ((!recordingRef.current && !liveActiveRef.current) || stoppingRef.current) return;
      backgroundStopRef.current = true;
      void stop();
    });
    return () => sub.remove();
  }, [isRecording, onChanged, stop]);

  /**
   * DÒNG THỜI GIAN GỘP của cả ca: các đoạn nối đuôi nhau thành một thanh kéo duy nhất.
   *
   * Chia đoạn là chuyện của LƯU TRỮ (máy chủ không có `ffmpeg` để ghép), không phải chuyện
   * của người nghe: BGH mở biên bản ra là muốn kéo tới phút thứ 7, chứ không nghĩ theo
   * «đoạn 2 giây thứ 40». Mỗi đoạn một nút play rời cũng làm một ca họp trông như nhiều
   * bản ghi khác nhau, trong khi mỗi ca chỉ có đúng một biên bản.
   *
   * `duration` do client đo lúc ghi và gửi lên; máy chủ không giải mã file để tính lại. Sai
   * số vài trăm mili giây mỗi đoạn là chấp nhận được với thanh kéo, nhưng đừng dùng con số
   * này cho việc gì cần chính xác tuyệt đối.
   */
  const timeline = useMemo(() => {
    // Vòng `for` chứ không `map` với biến tích luỹ bên ngoài: React Compiler cấm closure
    // ghi vào biến của render, và ở đây nó đúng — cộng dồn là việc thuần tuý tuần tự.
    const segments: { part: PTMeetingAudioPart; start: number; duration: number }[] = [];
    let start = 0;
    for (const part of parts) {
      const duration = Math.max(0, part.duration || 0);
      segments.push({ part, start, duration });
      start += duration;
    }
    return segments;
  }, [parts]);

  // Ghi ref trong effect chứ không lúc render: React Compiler cấm đụng ref khi đang render,
  // và vòng poll chỉ cần giá trị này ở lần chạy kế tiếp chứ không cần ngay trong render.
  useEffect(() => {
    isSeekingRef.current = isSeeking;
  }, [isSeeking]);

  const totalSeconds = useMemo(
    () => timeline.reduce((sum, seg) => sum + seg.duration, 0),
    [timeline]
  );

  /** Đoạn chứa mốc giây này trên dòng thời gian gộp. */
  const segmentIndexAt = useCallback(
    (seconds: number) => {
      let index = 0;
      for (let i = 0; i < timeline.length; i += 1) {
        if (seconds >= timeline[i].start) index = i;
      }
      return index;
    },
    [timeline]
  );

  const stopPlayPoll = useCallback(() => {
    if (playPollRef.current) {
      clearInterval(playPollRef.current);
      playPollRef.current = null;
    }
  }, []);

  const setPlaying = useCallback((next: boolean) => {
    isPlayingRef.current = next;
    setIsPlaying(next);
  }, []);

  /**
   * Nạp một đoạn vào trình phát.
   *
   * `replace()` thay vì dựng `AudioPlayer` mới mỗi lần đổi đoạn: dựng mới thì đoạn cũ phải
   * `remove()` đúng lúc, quên một nhịp là để lại một trình phát còn sống và hai đoạn kêu
   * chồng lên nhau.
   */
  const loadSegment = useCallback(
    async (index: number, offsetWithin: number, autoplay: boolean) => {
      const seg = timeline[index];
      if (!seg) return;
      setIsLoadingAudio(true);
      try {
        const source = await getMeetingAudioPartSource(seg.part.playback_url);
        if (playerRef.current) {
          playerRef.current.replace(source);
        } else {
          playerRef.current = createAudioPlayer(source);
        }
        segmentRef.current = index;
        if (offsetWithin > 0.05) {
          await playerRef.current.seekTo(offsetWithin).catch(() => undefined);
        }
        if (autoplay) playerRef.current.play();
      } finally {
        setIsLoadingAudio(false);
      }
    },
    [timeline]
  );

  /**
   * Vòng theo dõi vị trí phát.
   *
   * `expo-audio` có `playbackStatusUpdate` nhưng type public không lộ `addListener`, và ta
   * còn cần tự phát hiện «hết đoạn thì sang đoạn kế» — nên hỏi thẳng `currentTime` theo
   * nhịp, cùng cách vòng đọc `metering` ở trên đang làm.
   */
  const startPlayPoll = useCallback(() => {
    stopPlayPoll();
    playPollRef.current = setInterval(() => {
      const player = playerRef.current;
      const seg = timeline[segmentRef.current];
      if (!player || !seg) return;
      // Ngón tay đang kéo thì thanh trượt do người dùng làm chủ, đừng giật nó về.
      if (!isSeekingRef.current) {
        setPlayPosition(Math.min(seg.start + player.currentTime, totalSeconds));
      }
      // Hết đoạn: `playing` tắt trong khi con trỏ đã tới cuối. Kiểm CẢ HAI vì lúc đang nạp
      // đoạn mới thì `playing` cũng tắt mà `currentTime` còn ở 0.
      const nearEnd =
        player.duration > 0 && player.currentTime >= player.duration - 0.35;
      if (isPlayingRef.current && !player.playing && nearEnd) {
        const next = segmentRef.current + 1;
        if (next < timeline.length) {
          void loadSegment(next, 0, true);
        } else {
          setPlaying(false);
          stopPlayPoll();
          setPlayPosition(totalSeconds);
        }
      }
    }, 250);
  }, [loadSegment, setPlaying, stopPlayPoll, timeline, totalSeconds]);

  const togglePlayback = useCallback(async () => {
    try {
      if (isPlayingRef.current) {
        playerRef.current?.pause();
        setPlaying(false);
        stopPlayPoll();
        return;
      }
      // Nghe hết rồi bấm lại thì quay về đầu, đừng đứng im ở mốc cuối.
      const from = playPosition >= totalSeconds - 0.3 ? 0 : playPosition;
      const index = segmentIndexAt(from);
      const offset = from - (timeline[index]?.start ?? 0);
      if (!playerRef.current || segmentRef.current !== index) {
        await loadSegment(index, offset, true);
      } else {
        if (offset > 0.05) await playerRef.current.seekTo(offset).catch(() => undefined);
        playerRef.current.play();
      }
      setPlayPosition(from);
      setPlaying(true);
      startPlayPoll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không phát được ghi âm');
      setPlaying(false);
      stopPlayPoll();
    }
  }, [
    loadSegment,
    playPosition,
    segmentIndexAt,
    setPlaying,
    startPlayPoll,
    stopPlayPoll,
    timeline,
    totalSeconds,
  ]);

  /** Thả tay khỏi thanh kéo: nhảy tới mốc đó, nạp đoạn khác nếu cần. */
  const seekToOverall = useCallback(
    async (value: number) => {
      const target = Math.min(Math.max(value, 0), totalSeconds);
      const index = segmentIndexAt(target);
      const offset = target - (timeline[index]?.start ?? 0);
      try {
        if (playerRef.current && segmentRef.current === index) {
          await playerRef.current.seekTo(offset).catch(() => undefined);
        } else {
          await loadSegment(index, offset, isPlayingRef.current);
        }
        setPlayPosition(target);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Không tua được tới vị trí này');
      } finally {
        // Nhả cờ SAU khi đã nhảy xong, nếu không vòng poll sẽ kéo thanh trượt về chỗ cũ
        // trong lúc lệnh seek còn đang chạy.
        setIsSeeking(false);
      }
    },
    [loadSegment, segmentIndexAt, timeline, totalSeconds]
  );

  const confirmDeleteAll = useCallback(() => {
    Alert.alert(
      'Xoá toàn bộ ghi âm?',
      `Ca này có ${parts.length} đoạn. Xoá rồi không khôi phục được, và cuộc gặp đã diễn ra thì không ghi lại được nữa.`,
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: async () => {
            setIsBusy(true);
            try {
              await deleteMeetingAudio(slotId);
              toast.success('Đã xoá ghi âm');
              onChanged();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Không xoá được ghi âm');
            } finally {
              setIsBusy(false);
            }
          },
        },
      ]
    );
  }, [onChanged, parts.length, slotId]);

  const shownSeconds = isRecording ? savedSeconds + elapsed : savedSeconds;

  return (
    <View className="mb-4 rounded-xl border border-gray-100 bg-white px-3.5 py-3">
      <Text className="text-sm font-bold" style={{ color: PRIMARY }}>
        Ghi âm cuộc gặp
      </Text>

      <View className="mt-3 flex-row items-center">
        <TouchableOpacity
          disabled={disabled || isBusy}
          onPress={() => (isRecording ? void stop() : void start())}
          accessibilityLabel={isRecording ? 'Dừng ghi âm' : 'Ghi âm'}
          className="h-[52px] w-[52px] items-center justify-center rounded-full border"
          style={{
            backgroundColor: isRecording ? DANGER : '#FFFFFF',
            borderColor: disabled || isBusy ? '#E5E7EB' : DANGER,
            opacity: disabled || isBusy ? 0.5 : 1,
          }}>
          {isBusy ? (
            <ActivityIndicator color={isRecording ? '#FFFFFF' : DANGER} />
          ) : (
            <View
              style={
                isRecording
                  ? { width: 15, height: 15, borderRadius: 3, backgroundColor: '#FFFFFF' }
                  : { width: 17, height: 17, borderRadius: 999, backgroundColor: DANGER }
              }
            />
          )}
        </TouchableOpacity>

        <View className="ml-3 flex-1">
          <Text className="text-lg font-bold tabular-nums text-gray-900">
            {formatClock(shownSeconds)}
          </Text>
          <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
            {disabled
              ? disabledReason
              : isRecording
                ? // Câu này bám theo NĂNG LỰC THẬT của phiên đang chạy, không theo nền tảng:
                  // Android có foreground service thì khoá màn hình vẫn ghi, còn máy đã tắt
                  // thông báo thì không. Hứa chung một câu là sai với một trong hai nhóm.
                  backgroundCapable
                  ? 'Đang ghi âm · tự lưu vào biên bản, khoá màn hình vẫn chạy'
                  : 'Đang ghi âm · tự lưu vào biên bản, hãy giữ màn hình ở ứng dụng này'
                : parts.length
                  ? `${parts.length} đoạn đã lưu · bấm để ghi tiếp`
                  : 'Chưa ghi âm · bấm để bắt đầu'}
          </Text>
        </View>

        {parts.length && !isRecording ? (
          <TouchableOpacity
            disabled={isBusy}
            onPress={confirmDeleteAll}
            accessibilityLabel="Xoá ghi âm"
            className="ml-2 h-10 w-10 items-center justify-center rounded-xl bg-red-50">
            <Ionicons name="trash-outline" size={18} color={DANGER} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Nói rõ vì sao bản ghi dừng — không thì giáo viên đọc ra là app tự tắt lung tung.
          Chỉ ẩn khi họ bấm ghi tiếp, không tự biến mất sau vài giây: đây là thứ quyết định
          họ có phải ghi lại phần vừa nói hay không. */}
      {stoppedByBackground && !isRecording ? (
        <View className="mt-3 flex-row rounded-lg bg-amber-50 px-2.5 py-2">
          <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
          <Text className="ml-1.5 flex-1 text-xs leading-5" style={{ color: '#92400E' }}>
            Ghi âm đã dừng khi bạn rời khỏi ứng dụng — Android không cho ghi tiếp ở nền.
            Phần trước đó đã lưu. Bấm nút đỏ để ghi tiếp, và giữ màn hình ở lại ứng dụng này.
          </Text>
        </View>
      ) : null}

      {/* Sóng âm: chỉ vẽ khi đang ghi. Một dải vạch đứng yên lúc không ghi trông như hỏng. */}
      {isRecording ? (
        <View className="mt-3 h-10 flex-row items-center">
          {levels.map((level, index) => (
            <View
              key={index}
              className="mx-[1.5px] flex-1 rounded-sm"
              style={{ height: `${Math.round(level * 100)}%`, backgroundColor: DANGER }}
            />
          ))}
        </View>
      ) : null}

      {/* Ô tick phiên âm. Chỉ hiện khi máy chủ THẬT SỰ cấp được token, và ẩn khi đang ghi:
          gạt giữa chừng không dừng được luồng đã mở, hiện ra chỉ gây hiểu nhầm. */}
      {liveAvailable && !disabled && !isRecording ? (
        <TouchableOpacity
          onPress={() => setLiveEnabled((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: liveEnabled }}
          className="mt-3 flex-row items-start">
          <Ionicons
            name={liveEnabled ? 'checkbox' : 'square-outline'}
            size={18}
            color={liveEnabled ? PRIMARY : '#9CA3AF'}
          />
          <View className="ml-2 flex-1">
            <Text className="text-xs font-semibold text-gray-900">Ghi biên bản trực tiếp</Text>
            <Text className="mt-0.5 text-[11px] leading-4 text-gray-500">
              Chữ hiện ngay trong lúc nói. Tiếng của buổi gặp sẽ được gửi tới dịch vụ phiên
              âm bên ngoài.
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {live.error ? (
        <View className="mt-3 flex-row rounded-lg bg-red-50 px-2.5 py-2">
          <Ionicons name="alert-circle-outline" size={16} color={DANGER} />
          <Text className="ml-1.5 flex-1 text-xs leading-5" style={{ color: '#991B1B' }}>
            {live.error}
          </Text>
          <TouchableOpacity onPress={live.clearError} accessibilityLabel="Bỏ qua">
            <Text className="text-xs underline" style={{ color: '#991B1B' }}>
              Bỏ qua
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {live.isLive || live.status === 'closing' || live.lines.length > 0 ? (
        <LiveTranscriptBox
          status={live.status}
          lines={live.lines}
          interim={live.interim}
          pendingLines={live.pendingLines}
          onCopyToNote={
            onAppendToNote && !live.isLive && live.lines.length > 0
              ? () => onAppendToNote(live.lines.map((line) => line.text).join('\n'))
              : undefined
          }
        />
      ) : null}

      {/*
        MỘT trình phát cho CẢ ca họp, không phải mỗi đoạn một nút.
        Chia đoạn là chuyện của lưu trữ (máy chủ không có `ffmpeg` để ghép), còn với người
        nghe thì đây là một cuộc gặp — họ kéo tới phút thứ 7 chứ không nghĩ theo «đoạn 2».
      */}
      {timeline.length ? (
        <View className="mt-3 border-t border-gray-100 pt-3">
          <View className="flex-row items-center">
            <TouchableOpacity
              disabled={isRecording || isLoadingAudio}
              onPress={() => void togglePlayback()}
              accessibilityLabel={isPlaying ? 'Tạm dừng' : 'Nghe lại'}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: '#E8EEF5', opacity: isRecording ? 0.5 : 1 }}>
              {isLoadingAudio ? (
                <ActivityIndicator size="small" color={PRIMARY} />
              ) : (
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={PRIMARY} />
              )}
            </TouchableOpacity>

            <View className="ml-2 flex-1">
              <Slider
                disabled={isRecording}
                minimumValue={0}
                maximumValue={Math.max(totalSeconds, 0.1)}
                value={playPosition}
                onSlidingStart={() => setIsSeeking(true)}
                // Kéo tới đâu vẽ tới đó, nhưng CHƯA nhảy: mỗi lần nhảy có thể phải nạp một
                // file khác, làm liên tục trong lúc ngón tay còn trượt là đơ máy.
                onValueChange={setPlayPosition}
                onSlidingComplete={(value) => void seekToOverall(value)}
                minimumTrackTintColor={PRIMARY}
                maximumTrackTintColor="#D1D5DB"
                thumbTintColor={PRIMARY}
              />
            </View>
          </View>

          <View className="mt-0.5 flex-row justify-between px-1">
            <Text className="text-[11px] tabular-nums text-gray-500">
              {formatClock(playPosition)}
            </Text>
            <Text className="text-[11px] tabular-nums text-gray-500">
              {formatClock(totalSeconds)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Khung chữ chạy trong lúc gặp.
 *
 * Tự cuộn xuống dòng mới nhất, nhưng NGỪNG tự cuộn khi giáo viên đang kéo lên đọc lại —
 * giật màn hình về cuối giữa lúc người ta đang đọc là mất chỗ đang xem. Trên điện thoại
 * điều này còn đáng kể hơn bản web: màn hình nhỏ, chỉ nhìn được vài dòng một lúc.
 */
function LiveTranscriptBox({
  status,
  lines,
  interim,
  pendingLines,
  onCopyToNote,
}: {
  status: PTLiveStatus;
  lines: PTLiveLine[];
  interim: string;
  pendingLines: number;
  onCopyToNote?: () => void;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const stickToBottomRef = useRef(true);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    stickToBottomRef.current =
      contentSize.height - contentOffset.y - layoutMeasurement.height < 40;
  }, []);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [lines.length, interim]);

  const hint =
    status === 'connecting'
      ? 'Đang kết nối dịch vụ phiên âm…'
      : status === 'reconnecting'
        ? 'Mất kết nối, đang nối lại. Bản ghi âm vẫn đang chạy.'
        : status === 'closing'
          ? 'Đang chốt câu cuối và lưu lại…'
          : 'Nội dung tự lưu vào ca họp. Máy nghe có thể sai tên riêng, cần soát lại.';

  return (
    <View className="mt-3 border-t border-gray-100 pt-3">
      <View className="flex-row items-center">
        <Text className="flex-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Biên bản đang ghi
          {lines.length > 0 ? ` · ${lines.length} câu` : ''}
        </Text>
        {onCopyToNote ? (
          <TouchableOpacity
            onPress={onCopyToNote}
            accessibilityLabel="Chép vào biên bản"
            className="flex-row items-center rounded-lg bg-[#E8EEF5] px-2.5 py-1.5">
            <Ionicons name="copy-outline" size={14} color={PRIMARY} />
            <Text className="ml-1 text-xs font-semibold" style={{ color: PRIMARY }}>
              Chép vào biên bản
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        scrollEventThrottle={64}
        className="mt-2 max-h-56 rounded-lg bg-gray-50 px-2.5 py-2"
        // Khung này nằm trong màn cuộn dọc của cả trang: `nestedScrollEnabled` là thứ duy
        // nhất cho Android cuộn được ở lớp trong, không có nó thì ngón tay kéo cả trang.
        nestedScrollEnabled>
        {lines.length === 0 && !interim ? (
          <Text className="text-xs text-gray-400">Chữ sẽ hiện ở đây khi có người nói.</Text>
        ) : null}
        {lines.map((line, index) => (
          <Text key={`${line.t}-${index}`} className="mb-1 text-[13px] leading-5 text-gray-800">
            <Text className="text-[11px] tabular-nums text-gray-400">
              {formatClock(line.t)}{' '}
            </Text>
            {line.speaker ? (
              <Text className="font-semibold text-gray-900">{line.speaker}: </Text>
            ) : null}
            {line.text}
          </Text>
        ))}
        {interim ? (
          <Text className="mb-1 text-[13px] italic leading-5 text-gray-400">{interim}</Text>
        ) : null}
      </ScrollView>

      <View className="mt-1.5 flex-row items-center justify-between">
        <Text className="flex-1 text-[11px] leading-4 text-gray-500">{hint}</Text>
        {pendingLines > 0 ? (
          <Text className="ml-2 text-[11px] tabular-nums text-gray-500">
            {pendingLines} câu chờ lưu
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default ParentMeetingRecorder;
