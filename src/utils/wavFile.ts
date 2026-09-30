/**
 * Dựng file WAV từ luồng PCM thô, ghi thẳng ra đĩa theo kiểu suối.
 *
 * Vì sao phải tự dựng WAV thay vì dùng bộ ghi âm có sẵn
 * -----------------------------------------------------
 * `expo-audio` có hai đường thu micro và chúng KHÔNG chạy song song được trong cùng một
 * app: `useAudioStream` mở `AudioRecord(MediaRecorder.AudioSource.MIC)` trên Android và
 * `AVAudioEngine.installTap` trên iOS, còn `useAudioRecorder` dùng `MediaRecorder` /
 * `AVAudioRecorder`. Trên Android cái start sau chết hẳn ở `STATE_INITIALIZED`; trên iOS
 * `AudioStream.stop()` còn gọi `AVAudioSession.setActive(false)` nên dừng phiên phiên âm
 * có thể cắt luôn bản ghi đang chạy — mất đúng thứ không ghi lại được.
 *
 * Nên khi bật phiên âm trực tiếp, ta chỉ mở MỘT luồng PCM rồi đẩy nó đi hai nơi: dịch vụ
 * phiên âm, và file WAV này để còn bản ghi âm nghe lại.
 *
 * Vì sao ghi theo suối chứ không gom rồi ghi một lần
 * --------------------------------------------------
 * PCM 16 bit / 16kHz / mono là 32 KB mỗi giây, tức một đoạn 5 phút ≈ 9,6 MB. Gom trong
 * mảng JS rồi nối lại lúc cuối là giữ ngần ấy byte trong heap của máy điện thoại giữa
 * buổi họp, và còn nhân đôi lúc `concat`. `FileHandle.writeBytes` ghi thẳng xuống đĩa nên
 * bộ nhớ chỉ giữ đúng mẩu 100ms vừa nhận.
 *
 * Kích thước thật nằm ở HEADER, mà header lại đứng đầu file trong khi ta chưa biết tổng
 * số byte cho tới lúc dừng. Cách xử lý: ghi 44 byte giữ chỗ trước, ghi dữ liệu, rồi kéo
 * con trỏ về 0 và ghi đè header thật. Đây cũng là lý do phải mở `FileMode.ReadWrite` chứ
 * không phải `Append` — chế độ append không lùi con trỏ được.
 */
import { Directory, File, FileMode, Paths } from 'expo-file-system';

/** PCM 16 bit. Đổi số này là phải đổi cả `bitsPerSample` trong header. */
const BYTES_PER_SAMPLE = 2;
const WAV_HEADER_BYTES = 44;

export interface WavFormat {
  sampleRate: number;
  channels: number;
}

/**
 * 44 byte header WAV chuẩn cho PCM không nén.
 *
 * Mọi số nhiều byte đều LITTLE-ENDIAN — tham số `true` ở mỗi lời gọi `setUint32`/
 * `setUint16`. Bỏ quên một chỗ là file mở ra thành tiếng rè hoặc dài sai hàng giờ.
 */
export function buildWavHeader(dataBytes: number, format: WavFormat): Uint8Array {
  const { sampleRate, channels } = format;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  // Kích thước phần còn lại của file sau 8 byte đầu.
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');

  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // độ dài khối fmt cho PCM
  view.setUint16(20, 1, true); // 1 = PCM không nén
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * BYTES_PER_SAMPLE, true); // byte/giây
  view.setUint16(32, channels * BYTES_PER_SAMPLE, true); // block align
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true); // bits per sample

  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);

  return new Uint8Array(buffer);
}

/**
 * Một file WAV đang được ghi dở.
 *
 * Vòng đời: `WavStreamWriter.create()` → `append()` nhiều lần → `finish()` trả URI, hoặc
 * `discard()` nếu không cần nữa. Gọi `append()` sau `finish()` là lỗi lập trình, không
 * phải tình huống cần xử lý — bộ ghi đã đóng.
 */
export class WavStreamWriter {
  private handle: ReturnType<File['open']> | null;
  private dataBytes = 0;

  private constructor(
    private readonly file: File,
    private readonly format: WavFormat,
    handle: ReturnType<File['open']>,
  ) {
    this.handle = handle;
  }

  /** Mở file mới trong thư mục cache và ghi sẵn header giữ chỗ. */
  static create(fileName: string, format: WavFormat): WavStreamWriter {
    // Thư mục cache: đoạn ghi âm chỉ sống tới lúc upload xong, không phải dữ liệu người
    // dùng cần giữ. Hệ điều hành dọn hộ khi máy hết chỗ.
    const dir = new Directory(Paths.cache, 'pt-meeting-audio');
    if (!dir.exists) dir.create({ intermediates: true });

    const file = new File(dir, fileName);
    file.create({ overwrite: true, intermediates: true });

    const handle = file.open(FileMode.ReadWrite);
    // Header giữ chỗ: kích thước thật chỉ biết lúc `finish()`.
    handle.writeBytes(buildWavHeader(0, format));
    return new WavStreamWriter(file, format, handle);
  }

  /** Nối một mẩu PCM. `bytes` phải là PCM 16 bit đúng `format` đã khai. */
  append(bytes: Uint8Array): void {
    if (!this.handle) return;
    this.handle.writeBytes(bytes);
    this.dataBytes += bytes.byteLength;
  }

  /** Số giây đã ghi được tính tới lúc này. */
  get seconds(): number {
    const { sampleRate, channels } = this.format;
    return this.dataBytes / (sampleRate * channels * BYTES_PER_SAMPLE);
  }

  get isEmpty(): boolean {
    return this.dataBytes === 0;
  }

  /**
   * Ghi đè header thật rồi đóng file. Trả `uri` để đem đi upload.
   *
   * Kéo `offset` về 0 chứ không mở lại file: mở lại bằng `Truncate` thì mất dữ liệu, mở
   * bằng `Append` thì header thật bị nối vào ĐUÔI file và trình phát đọc ra file hỏng.
   */
  finish(): { uri: string; seconds: number; bytes: number } {
    const handle = this.handle;
    const result = { uri: this.file.uri, seconds: this.seconds, bytes: this.dataBytes };
    if (!handle) return result;

    this.handle = null;
    try {
      handle.offset = 0;
      handle.writeBytes(buildWavHeader(this.dataBytes, this.format));
    } finally {
      handle.close();
    }
    return result;
  }

  /** Đóng và xoá file — dùng khi đoạn ghi không còn cần (vd người dùng huỷ). */
  discard(): void {
    try {
      this.handle?.close();
    } catch {
      // Đã đóng rồi — không còn gì để dọn.
    }
    this.handle = null;
    try {
      if (this.file.exists) this.file.delete();
    } catch {
      // Xoá hụt chỉ để lại một file rác trong cache, hệ điều hành sẽ dọn.
    }
  }
}
