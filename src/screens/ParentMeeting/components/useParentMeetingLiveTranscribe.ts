/**
 * Phiên âm TRỰC TIẾP trong lúc gặp phụ huynh — bản app giáo viên.
 *
 * Cùng hợp đồng với bản web (`useParentMeetingLiveTranscribe` ở frappe-sis-frontend):
 * cùng ba endpoint, cùng cách đánh số mẻ, cùng giao thức chống mất chữ. Nhưng KHÔNG chép
 * được logic, vì nguồn tiếng khác hẳn:
 *
 *   • web  — `MediaRecorder` thứ hai bám vào `MediaStream` đang có, tự phát ra webm/opus
 *   • app  — `useAudioStream` của `expo-audio` trả PCM THÔ, và cả app chỉ mở được MỘT
 *            luồng micro (xem `utils/wavFile.ts` về vì sao)
 *
 * Nên hook này KHÔNG tự mở micro và cũng không tự đóng gói tiếng. Màn ghi âm nhận PCM rồi
 * đẩy vào đây bằng `pushAudio()`, đồng thời đẩy chính mẩu đó sang bộ dựng file WAV. Một
 * luồng, hai người tiêu thụ.
 *
 * Ba chỗ dễ mất chữ, và cách xử lý — giống hệt bản web:
 * 1. **Đóng kết nối quá sớm.** Câu đang nói dở chỉ được chốt sau khi gửi `CloseStream`,
 *    nên `detach()` gửi lệnh đó rồi CHỜ nhà cung cấp tự đóng.
 * 2. **Mạng chập chờn giữa buổi.** Đứt thì xin token MỚI và nối lại, tối đa
 *    `MAX_RECONNECT` lần; mốc thời gian phiên mới cộng `connectionOffsetRef`, nếu không
 *    mọi câu sau khi nối lại đều quay về 00:00.
 * 3. **Lưu lên máy chủ hỏng.** Mẻ đang gửi được GIỮ NGUYÊN và thử lại y hệt, câu mới dồn
 *    vào đệm riêng. Gộp hai thứ lại là chắc chắn mất chữ: máy chủ thấy số mẻ trùng sẽ bỏ
 *    qua cả cụm.
 *
 * Sửa một lỗi ở giao thức này thì phải sửa cả bản web.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  appendMeetingLiveTranscript,
  finishMeetingLiveTranscript,
  getMeetingLiveToken,
} from '../../../services/parentMeetingService';

/** Một câu đã được nhà cung cấp chốt. */
export interface PTLiveLine {
  /** Giây tính từ lúc bắt đầu ghi, đã cộng bù các lần nối lại. */
  t: number;
  /** "Người 1", "Người 2"… từ tách người nói. Rỗng khi không tách được. */
  speaker: string;
  text: string;
}

export type PTLiveStatus = 'idle' | 'connecting' | 'listening' | 'reconnecting' | 'closing';

/** Gom chữ rồi lưu theo mẻ — lưu từng câu một là mỗi buổi vài nghìn request. */
const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_MAX_LINES = 15;

/**
 * Trần ký tự mỗi mẻ, đặt THẤP HƠN trần 20.000 của máy chủ. Mất sóng vài phút là đệm
 * phình lên hàng chục nghìn ký tự; gửi nguyên khối thì máy chủ trả 400, mà lỗi 400 không
 * tự hết — mẻ đó nằm lại và chặn vĩnh viễn mọi mẻ sau.
 */
const FLUSH_MAX_CHARS = 15_000;

/** Nhà cung cấp đóng kết nối khi im lặng quá lâu — tự nhắc để giữ kết nối. */
const KEEPALIVE_MS = 5_000;
/** Chờ câu cuối sau khi gửi `CloseStream`, rồi đóng cứng dù chưa thấy hồi âm. */
const FINAL_WAIT_MS = 5_000;

const MAX_RECONNECT = 5;
const RECONNECT_DELAY_MS = 2_000;
const MAX_CHUNK_ATTEMPTS = 5;

interface InflightChunk {
  index: number;
  lines: string[];
  failures: number;
}

function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function renderLine(line: PTLiveLine): string {
  const who = line.speaker ? `${line.speaker}: ` : '';
  return `[${clock(line.t)}] ${who}${line.text}`;
}

interface Options {
  slotId: string;
  /** Phải khớp đúng cấu hình của `useAudioStream` bên màn ghi âm. */
  sampleRate: number;
  channels: number;
}

export function useParentMeetingLiveTranscribe({ slotId, sampleRate, channels }: Options) {
  const [status, setStatus] = useState<PTLiveStatus>('idle');
  const [lines, setLines] = useState<PTLiveLine[]>([]);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingLines, setPendingLines] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<string[]>([]);
  const inflightRef = useRef<InflightChunk | null>(null);
  const chunkIndexRef = useRef(0);
  /** Nối chuỗi các lượt đẩy: chỉ một mẻ bay trên đường, `await` chờ đúng lượt. */
  const flushChainRef = useRef<Promise<void>>(Promise.resolve());

  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepAliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wantLiveRef = useRef(false);
  const reconnectsRef = useRef(0);
  const connectionOffsetRef = useRef(0);
  const sessionStartedAtRef = useRef(0);

  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());
  /**
   * `connect` phải gọi lại CHÍNH NÓ khi mạng đứt giữa buổi, nhưng nối vòng qua REF chứ
   * không tham chiếu thẳng: tham chiếu thẳng thì bản `connect` của lần render đầu ôm mãi
   * closure của lần đó, và mọi lần nối lại sau đều dùng `slotId`/handler cũ. Cùng mô-típ
   * với `rotateRef` ở `ParentMeetingRecorder`.
   */
  const connectRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const slotIdRef = useRef(slotId);
  useEffect(() => {
    slotIdRef.current = slotId;
  }, [slotId]);

  const syncPending = useCallback(() => {
    setPendingLines(bufferRef.current.length + (inflightRef.current?.lines.length ?? 0));
  }, []);

  const flushOnce = useCallback(async () => {
    if (!inflightRef.current && bufferRef.current.length === 0) return;

    if (!inflightRef.current) {
      // Cắt mẻ theo trần ký tự, phần thừa ở lại đệm cho lượt sau.
      const batch: string[] = [];
      let size = 0;
      while (bufferRef.current.length > 0) {
        const next = bufferRef.current[0];
        if (batch.length > 0 && size + next.length + 1 > FLUSH_MAX_CHARS) break;
        batch.push(bufferRef.current.shift() as string);
        size += next.length + 1;
      }
      inflightRef.current = { index: chunkIndexRef.current + 1, lines: batch, failures: 0 };
    }

    const chunk = inflightRef.current;
    try {
      const result = await appendMeetingLiveTranscript(
        slotIdRef.current,
        chunk.index,
        chunk.lines.join('\n')
      );
      // Máy chủ trả số mẻ nó đang giữ. Mẻ trùng (lần trước timeout nhưng thực ra đã lưu)
      // trả về số cũ — vẫn coi là xong, không gửi lại nữa.
      chunkIndexRef.current = Math.max(chunk.index, result?.live_chunk_index ?? chunk.index);
      inflightRef.current = null;
    } catch (e: unknown) {
      chunk.failures += 1;
      if (chunk.failures >= MAX_CHUNK_ATTEMPTS) {
        // Bỏ mẻ này để hàng đợi chạy tiếp. Mất một mẻ còn hơn mất toàn bộ phần còn lại
        // của buổi gặp vì bị nó chắn.
        inflightRef.current = null;
        chunkIndexRef.current = chunk.index;
        setError(
          `Không lưu được ${chunk.lines.length} câu lên hệ thống. ` +
            'Phần sau vẫn được ghi tiếp; bản ghi âm vẫn đầy đủ.'
        );
      } else if (bufferRef.current.length + chunk.lines.length > FLUSH_MAX_LINES * 3) {
        // Chỉ báo khi đã dồn nhiều — nhấp nháy lỗi mỗi lần sóng yếu là làm phiền giữa
        // lúc giáo viên đang nói chuyện với phụ huynh.
        setError(
          e instanceof Error
            ? `Chưa lưu được nội dung lên hệ thống: ${e.message}`
            : 'Chưa lưu được nội dung lên hệ thống'
        );
      }
    } finally {
      syncPending();
    }
  }, [syncPending]);

  const flush = useCallback((): Promise<void> => {
    flushChainRef.current = flushChainRef.current.then(flushOnce, flushOnce);
    return flushChainRef.current;
  }, [flushOnce]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const drain = useCallback(
    async (maxAttempts = 5) => {
      for (let i = 0; i < maxAttempts; i += 1) {
        if (!inflightRef.current && bufferRef.current.length === 0) return;
        await flush();
      }
    },
    [flush]
  );

  const clearTimers = useCallback(() => {
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    flushTimerRef.current = null;
    if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
    keepAliveTimerRef.current = null;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }, []);

  const handleMessage = useCallback(
    (event: { data: unknown }) => {
      let msg: {
        type?: string;
        is_final?: boolean;
        start?: number;
        channel?: { alternatives?: { transcript?: string; words?: { speaker?: number }[] }[] };
      };
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (msg.type !== 'Results') return;

      const alt = msg.channel?.alternatives?.[0];
      const text = (alt?.transcript || '').trim();
      if (!text) return;

      if (!msg.is_final) {
        setInterim(text);
        return;
      }

      const words = alt?.words ?? [];
      const speakerIndex = words.length > 0 ? words[0]?.speaker : undefined;
      const line: PTLiveLine = {
        t: connectionOffsetRef.current + (msg.start ?? 0),
        speaker: speakerIndex === undefined ? '' : `Người ${speakerIndex + 1}`,
        text,
      };

      setLines((prev) => [...prev, line]);
      setInterim('');
      bufferRef.current.push(renderLine(line));
      syncPending();
      if (bufferRef.current.length >= FLUSH_MAX_LINES) void flush();
    },
    [flush, syncPending]
  );

  /** Mở một kết nối mới. Dùng cho cả lần đầu lẫn các lần nối lại. */
  const connect = useCallback(async () => {
    if (!wantLiveRef.current) return;
    setStatus(reconnectsRef.current > 0 ? 'reconnecting' : 'connecting');

    let token: Awaited<ReturnType<typeof getMeetingLiveToken>>;
    try {
      token = await getMeetingLiveToken(slotIdRef.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lấy được quyền phiên âm trực tiếp');
      wantLiveRef.current = false;
      setStatus('idle');
      return;
    }
    if (!wantLiveRef.current) return;

    // Nối tiếp số mẻ của máy chủ ở lần mở đầu tiên. Đánh lại từ 1 sau khi mở lại màn là
    // mọi mẻ sau đó bị coi là trùng và bị bỏ qua trong im lặng.
    if (chunkIndexRef.current === 0) {
      chunkIndexRef.current = token.live_chunk_index || 0;
    }

    // KHÁC BẢN WEB: ở đây ta gửi PCM thô chứ không phải webm, nên phải khai rõ định dạng
    // cho nhà cung cấp. Sai `sample_rate` là chữ ra đúng nhưng méo hết tốc độ.
    const params = new URLSearchParams({
      model: token.model,
      language: token.language,
      encoding: 'linear16',
      sample_rate: String(sampleRate),
      channels: String(channels),
      punctuate: 'true',
      interim_results: 'true',
      smart_format: 'true',
      diarize: 'true',
      endpointing: '300',
      utterance_end_ms: '1000',
    });

    // Token đi bằng WebSocket subprotocol, KHÔNG phải query string — nhà cung cấp trả 401
    // cho `?access_token=`. Cách này cũng an toàn hơn: token không nằm trong URL.
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`, [
      'bearer',
      token.access_token,
    ]);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      if (!wantLiveRef.current) {
        ws.close();
        return;
      }
      connectionOffsetRef.current = (Date.now() - sessionStartedAtRef.current) / 1000;
      reconnectsRef.current = 0;
      setStatus('listening');
      setError(null);

      keepAliveTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      }, KEEPALIVE_MS);
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
      if (wsRef.current === ws) wsRef.current = null;
      if (!wantLiveRef.current) return;

      if (reconnectsRef.current >= MAX_RECONNECT) {
        wantLiveRef.current = false;
        setStatus('idle');
        setError(
          'Mất kết nối tới dịch vụ phiên âm. Bản ghi âm vẫn đang chạy, có thể tạo biên bản sau khi gặp xong.'
        );
        return;
      }
      reconnectsRef.current += 1;
      setStatus('reconnecting');
      reconnectTimerRef.current = setTimeout(() => void connectRef.current(), RECONNECT_DELAY_MS);
    };
  }, [channels, handleMessage, sampleRate]);

  // Gán trong effect chứ không lúc render: gán lúc render là tác dụng phụ, và StrictMode
  // render hai lần sẽ chạy nó hai lượt.
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  /**
   * Đẩy một mẩu PCM lên nhà cung cấp.
   *
   * Mất kết nối thì BỎ mẩu này chứ không xếp hàng: tiếng cũ gửi muộn sau khi nối lại sẽ
   * chen vào giữa câu đang nói và làm hỏng cả đoạn. Bản ghi âm vẫn giữ đủ phần tiếng đó —
   * mất là mất chữ của vài giây, không mất tiếng.
   */
  const pushAudio = useCallback((bytes: Uint8Array) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(bytes.buffer as ArrayBuffer);
    } catch {
      // Kết nối vừa đóng giữa chừng — `onclose` sẽ lo việc nối lại.
    }
  }, []);

  /** Bắt đầu phiên. Gọi SAU khi micro đã mở, để mốc thời gian khớp bản ghi âm. */
  const attach = useCallback(async () => {
    if (wantLiveRef.current) return;
    wantLiveRef.current = true;
    reconnectsRef.current = 0;
    sessionStartedAtRef.current = Date.now();
    connectionOffsetRef.current = 0;
    setLines([]);
    setInterim('');
    setError(null);

    flushTimerRef.current = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    await connect();
  }, [connect, flush]);

  /**
   * Kết thúc: chốt câu cuối, đẩy nốt chữ còn trong đệm, rồi báo máy chủ.
   *
   * `onStreamClosed` được gọi NGAY khi nhà cung cấp đã chốt xong câu cuối — tức lúc sớm
   * nhất mà micro không còn cần thiết. Phần lưu chữ chạy tiếp sau đó. Không tách ra thì
   * mạng chậm là micro vẫn sáng thêm cả phút sau khi giáo viên đã tiễn phụ huynh.
   */
  const detach = useCallback(
    async (onStreamClosed?: () => void) => {
      if (!wantLiveRef.current && status === 'idle') {
        onStreamClosed?.();
        return;
      }
      wantLiveRef.current = false;
      setStatus('closing');
      clearTimers();

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          ws.onclose = finish;
          try {
            ws.send(JSON.stringify({ type: 'CloseStream' }));
          } catch {
            finish();
            return;
          }
          // Không chờ vô hạn: mất sóng thì `close` không bao giờ tới.
          setTimeout(finish, FINAL_WAIT_MS);
        });
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Đã đóng rồi.
        }
        wsRef.current = null;
      }

      onStreamClosed?.();

      // Đẩy cho tới khi sạch đệm. Một hai lượt cố định là không đủ: mẻ cuối có thể vừa bị
      // cắt theo trần ký tự, phần thừa nằm lại chờ lượt sau.
      await drain();

      setInterim('');
      setStatus('idle');

      try {
        await finishMeetingLiveTranscript(slotIdRef.current);
      } catch {
        // Trạng thái trên máy chủ tự về `uploaded` ở lần xử lý sau; chữ đã lưu rồi.
      }
    },
    [clearTimers, drain, status]
  );

  // Rời màn giữa buổi: đóng kết nối và cố đẩy nốt phần chữ chưa lưu. Không `await` được
  // trong hàm dọn dẹp, nhưng request đã phát đi thì vẫn chạy tiếp — đủ để không mất chữ
  // và không để biên bản kẹt ở trạng thái «đang ghi trực tiếp».
  useEffect(() => {
    return () => {
      const wasLive = wantLiveRef.current;
      wantLiveRef.current = false;
      clearTimers();
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Đã đóng rồi.
        }
        wsRef.current = null;
      }
      if (wasLive) {
        const id = slotIdRef.current;
        void flushRef.current().finally(() => {
          void finishMeetingLiveTranscript(id).catch(() => undefined);
        });
      }
    };
  }, [clearTimers]);

  return {
    status,
    isLive: status === 'listening' || status === 'connecting' || status === 'reconnecting',
    lines,
    interim,
    pendingLines,
    error,
    clearError: useCallback(() => setError(null), []),
    attach,
    detach,
    pushAudio,
  };
}
