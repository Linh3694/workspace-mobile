/**
 * Định dạng chữ trong chat (in đậm / nghiêng / gạch chân / màu) — logic thuần, không React.
 *
 * Mô hình giống hệt `chatMentions.ts`: `content` VẪN là TEXT THUẦN, mảng `formats` chỉ neo vị trí
 * theo offset. Nhờ vậy offset của mention không lệch, preview/push/reply/tìm kiếm ở server vẫn
 * chạy nguyên trên `content`, client cũ chưa cập nhật hiển thị text thuần (không phải migrate),
 * và không có HTML do người dùng nhập nên không mở bề mặt XSS nào.
 *
 * LƯU Ý: bản sao của file này tồn tại ở 5 app — PHẦN THÂN phải giống hệt nhau, chỉ khác dòng
 * `import`. Lệch nhau sẽ ra tin nhắn tô định dạng sai chỗ ở app này mà đúng ở app kia:
 *   - frappe-sis-frontend/src/pages/Teaching/Class/tabs/chat/chatFormats.ts   (GV web — bản gốc)
 *   - workspace-mobile/src/screens/Exchange/lib/chatFormats.ts                (GV app)
 *   - parent-portal/packages/core/src/utils/chatFormats.ts                    (PH web)
 *   - parent-portal-mobile/utils/chatFormats.ts                               (PH app)
 *   - student-portal/packages/core/src/utils/chatFormats.ts                   (HS web)
 * Bản chuẩn phía server: frappe-backend/social-service/utils/chatFormats.js — `normalizeFormats`
 * dưới đây phải cho ra CÙNG kết quả với `sanitizeFormats` bên đó.
 */
import type { ChatFormat, ChatHighlight, ChatMention, ChatTextColor } from '../../../types/chat';

import { syncMentions } from './chatMentions';

/** Các mark boolean — liệt kê một chỗ để thêm mark mới không phải sửa rải rác. */
export const CHAT_FORMAT_FLAGS = ['bold', 'italic', 'underline'] as const;

export type ChatFormatFlag = (typeof CHAT_FORMAT_FLAGS)[number];

/** Bộ định dạng của một mảnh chữ (không kèm vị trí). */
export type ChatFormatMarks = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: ChatTextColor;
  highlight?: ChatHighlight;
};

/** Trần số dải một tin — khớp `MAX_FORMATS_PER_MESSAGE` của server. */
export const MAX_FORMATS_PER_MESSAGE = 50;

/**
 * Bảng màu — HEX LẤY NGUYÊN từ bộ nhận diện Wellspring, không chế biến.
 *
 * Mỗi token chỉ có MỘT hex (không còn cặp sáng/đậm như bản trước): từ khi bong bóng tin của
 * mình chuyển sang nền sáng, MỌI tin có định dạng đều nằm trên nền sáng — bong bóng của mình
 * (#FFF6F1 web / #F0FDFA app) lẫn bong bóng nhận được (trắng / #F3F4F6).
 *
 * Chỉ có hai màu ở đây vì bộ Wellspring chia làm hai nhóm độ sáng, và chỉ nhóm đậm đủ tương
 * phản để làm CHỮ ở cỡ 14px. Nhóm màu tươi nằm ở `CHAT_HIGHLIGHTS` bên dưới.
 */
export const CHAT_TEXT_COLORS: Record<ChatTextColor, string> = {
  /** Oxford Blue — 13.30:1 trên nền sáng tối nhất. */
  'oxford-blue': '#002855',
  /** Teal — 5.81:1. */
  teal: '#00687F',
};

/**
 * Nền TÔ SÁNG — cũng là hex Wellspring nguyên bản, chỉ đổi vai trò.
 *
 * Amber / Lime / Honey làm màu chữ chỉ đạt 1.36–1.79:1 (không đọc nổi), nhưng làm nền với chữ
 * tối đè lên thì đạt 7.9–10.5:1. Nhờ vậy dùng được đúng màu thương hiệu mà vẫn qua WCAG AA.
 */
export const CHAT_HIGHLIGHTS: Record<ChatHighlight, string> = {
  /** Amber — 10.50:1 với chữ CHAT_HIGHLIGHT_TEXT. */
  amber: '#FFCE02',
  /** Lime — 9.28:1. */
  lime: '#BED232',
  /** Honey — 7.94:1. */
  honey: '#F5AA1E',
};

/**
 * Màu chữ BẮT BUỘC khi có nền tô sáng.
 *
 * Không dùng màu chữ mặc định của bong bóng: nếu người gửi vừa tô nền vừa chọn màu chữ đậm
 * (Oxford Blue trên Amber = 2.3:1) thì không đọc được. Có nền tô sáng ⇒ chữ luôn về tông tối này.
 */
export const CHAT_HIGHLIGHT_TEXT = '#1F2330';

/** Thứ tự hiện trong bảng chọn màu chữ. */
export const CHAT_TEXT_COLOR_ORDER: ChatTextColor[] = ['oxford-blue', 'teal'];

/** Thứ tự hiện trong bảng chọn nền tô sáng. */
export const CHAT_HIGHLIGHT_ORDER: ChatHighlight[] = ['amber', 'lime', 'honey'];

/**
 * Màu chữ thực tế của một mảnh; `undefined` = dùng màu chữ mặc định của bong bóng.
 * Có nền tô sáng thì màu chữ do nền quyết định, không phải do token `color`.
 */
export function chatFormatColorHex(marks: ChatFormatMarks | undefined): string | undefined {
  if (marks?.highlight && CHAT_HIGHLIGHTS[marks.highlight]) return CHAT_HIGHLIGHT_TEXT;
  const token = marks?.color;
  if (!token) return undefined;
  return CHAT_TEXT_COLORS[token];
}

/** Màu nền tô sáng của một mảnh; `undefined` = không tô. */
export function chatHighlightHex(marks: ChatFormatMarks | undefined): string | undefined {
  const token = marks?.highlight;
  if (!token) return undefined;
  return CHAT_HIGHLIGHTS[token];
}

function isEmptyMarks(marks: ChatFormatMarks): boolean {
  return !marks.color && !marks.highlight && CHAT_FORMAT_FLAGS.every((flag) => !marks[flag]);
}

function marksKey(marks: ChatFormatMarks): string {
  const flags = CHAT_FORMAT_FLAGS.map((f) => (marks[f] ? '1' : '0')).join('');
  return `${flags}|${marks.color || ''}|${marks.highlight || ''}`;
}

function pickMarks(source: ChatFormat | ChatFormatMarks): ChatFormatMarks {
  const marks: ChatFormatMarks = {};
  for (const flag of CHAT_FORMAT_FLAGS) {
    if (source[flag]) marks[flag] = true;
  }
  if (source.color) marks.color = source.color;
  if (source.highlight) marks.highlight = source.highlight;
  return marks;
}

/**
 * Trải `formats` thành mảng mark theo từng ký tự.
 *
 * Đây là dạng trung gian của mọi phép biến đổi bên dưới: dải chồng lấn / lồng nhau / gỡ mark
 * đều quy về "ghi lên từng ô" nên không phải xét từng cặp dải — chỗ dễ sai nhất của mô hình này.
 * Tin nhắn tối đa 5000 ký tự nên chi phí không đáng kể, và các hàm này chỉ chạy khi bấm nút
 * định dạng hoặc khi render, không chạy theo từng phím gõ.
 */
function toCharMarks(formats: ChatFormat[] | null | undefined, length: number): (ChatFormatMarks | undefined)[] {
  const cells: (ChatFormatMarks | undefined)[] = new Array(length).fill(undefined);
  for (const format of formats || []) {
    if (!format) continue;
    const rawStart = Math.trunc(Number(format.start));
    const rawLength = Math.trunc(Number(format.length));
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawLength) || rawLength <= 0) continue;
    // Suy `end` từ start GỐC rồi mới clamp hai đầu — clamp start trước sẽ NỚI dải ra.
    const start = Math.max(0, rawStart);
    const end = Math.min(length, rawStart + rawLength);
    const marks = pickMarks(format);
    if (isEmptyMarks(marks)) continue;
    for (let i = start; i < end; i += 1) {
      const current = cells[i] || {};
      for (const flag of CHAT_FORMAT_FLAGS) {
        if (marks[flag]) current[flag] = true;
      }
      // Chồng màu: dải khai báo SAU thắng — giống server.
      if (marks.color) current.color = marks.color;
      if (marks.highlight) current.highlight = marks.highlight;
      cells[i] = current;
    }
  }
  return cells;
}

/** Gom mảng mark theo ký tự thành các dải rời nhau, đã gộp đoạn liền kề trùng mark. */
function fromCharMarks(cells: (ChatFormatMarks | undefined)[]): ChatFormat[] {
  const out: ChatFormat[] = [];
  let start = -1;
  let key = '';

  const flush = (end: number) => {
    if (start < 0) return;
    const marks = cells[start] as ChatFormatMarks;
    out.push({ start, length: end - start, ...marks });
    start = -1;
    key = '';
  };

  for (let i = 0; i < cells.length; i += 1) {
    const marks = cells[i];
    if (!marks || isEmptyMarks(marks)) {
      flush(i);
      continue;
    }
    const nextKey = marksKey(marks);
    if (start < 0) {
      start = i;
      key = nextKey;
    } else if (nextKey !== key) {
      flush(i);
      start = i;
      key = nextKey;
    }
  }
  flush(cells.length);

  return out.slice(0, MAX_FORMATS_PER_MESSAGE);
}

/**
 * Chuẩn hoá danh sách dải: clamp về độ dài nội dung, bỏ dải rỗng, gộp chồng lấn thành các run
 * RỜI NHAU, gộp đoạn liền kề trùng mark, sắp theo `start`.
 *
 * Phải cho ra cùng kết quả với `sanitizeFormats` của server — lệch nhau thì tin hiển thị một kiểu
 * lúc vừa gửi (optimistic) và một kiểu sau khi server trả về.
 */
export function normalizeFormats(formats: ChatFormat[] | null | undefined, contentLength: number): ChatFormat[] {
  if (!formats?.length || contentLength <= 0) return [];
  return fromCharMarks(toCharMarks(formats, contentLength));
}

/**
 * Neo lại offset theo chuỗi ĐÃ trim — bắt buộc gọi trước khi gửi.
 *
 * Server `trim()` `content` rồi mới đối chiếu offset (giống mention, xem chatController
 * `appendMessageToConversation`). Ô soạn để lại khoảng trắng đầu dòng là mọi dải lệch đúng bấy
 * nhiêu ký tự ⇒ định dạng nhảy sang chữ khác ở phía người nhận.
 *
 * KHÔNG dùng `shiftFormats` cho việc này: trim cắt cả hai đầu nên tiền tố/hậu tố chung bằng 0,
 * hàm đó sẽ coi như toàn bộ chuỗi bị thay và xoá sạch định dạng.
 */
export function trimFormats(text: string, formats: ChatFormat[] | null | undefined): ChatFormat[] {
  const raw = text || '';
  const trimmed = raw.trim();
  if (!formats?.length || !trimmed) return [];
  const lead = raw.length - raw.trimStart().length;
  if (!lead) return normalizeFormats(formats, trimmed.length);
  return normalizeFormats(formats.map((f) => ({ ...f, start: f.start - lead })), trimmed.length);
}

/**
 * Bật/tắt một mark trên vùng chọn `[start, end)`.
 *
 * Toggle như mọi editor: cả vùng đã mang mark rồi thì bấm lần nữa là GỠ. Với màu thì luôn ghi đè
 * (người dùng chọn màu từ bảng chọn), truyền `color: null` để xoá màu.
 */
export function applyMarkToRange(
  formats: ChatFormat[] | null | undefined,
  start: number,
  end: number,
  mark: { flag?: ChatFormatFlag; color?: ChatTextColor | null; highlight?: ChatHighlight | null },
  contentLength: number,
): ChatFormat[] {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.min(contentLength, Math.max(start, end));
  if (to <= from) return normalizeFormats(formats, contentLength);

  const cells = toCharMarks(formats, contentLength);

  if (mark.flag) {
    const flag = mark.flag;
    let allSet = true;
    for (let i = from; i < to; i += 1) {
      if (!cells[i]?.[flag]) {
        allSet = false;
        break;
      }
    }
    for (let i = from; i < to; i += 1) {
      const current = { ...(cells[i] || {}) };
      if (allSet) delete current[flag];
      else current[flag] = true;
      cells[i] = current;
    }
  }

  if (mark.color !== undefined) {
    for (let i = from; i < to; i += 1) {
      const current = { ...(cells[i] || {}) };
      if (mark.color === null) delete current.color;
      else current.color = mark.color;
      cells[i] = current;
    }
  }

  if (mark.highlight !== undefined) {
    for (let i = from; i < to; i += 1) {
      const current = { ...(cells[i] || {}) };
      if (mark.highlight === null) delete current.highlight;
      else current.highlight = mark.highlight;
      cells[i] = current;
    }
  }

  return fromCharMarks(cells);
}

/** Vùng chọn đã mang sẵn mark này chưa (để tô sáng nút trên thanh công cụ). */
export function isMarkActiveInRange(
  formats: ChatFormat[] | null | undefined,
  start: number,
  end: number,
  flag: ChatFormatFlag,
  contentLength: number,
): boolean {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.min(contentLength, Math.max(start, end));
  if (to <= from) return false;
  const cells = toCharMarks(formats, contentLength);
  for (let i = from; i < to; i += 1) {
    if (!cells[i]?.[flag]) return false;
  }
  return true;
}

/** Nền tô sáng đang áp cho cả vùng chọn (khác nhau giữa các ký tự ⇒ null). */
export function activeHighlightInRange(
  formats: ChatFormat[] | null | undefined,
  start: number,
  end: number,
  contentLength: number,
): ChatHighlight | null {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.min(contentLength, Math.max(start, end));
  if (to <= from) return null;
  const cells = toCharMarks(formats, contentLength);
  const first = cells[from]?.highlight ?? null;
  for (let i = from + 1; i < to; i += 1) {
    if ((cells[i]?.highlight ?? null) !== first) return null;
  }
  return first;
}

/** Màu chữ đang áp cho cả vùng chọn (khác nhau giữa các ký tự ⇒ null). */
export function activeColorInRange(
  formats: ChatFormat[] | null | undefined,
  start: number,
  end: number,
  contentLength: number,
): ChatTextColor | null {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.min(contentLength, Math.max(start, end));
  if (to <= from) return null;
  const cells = toCharMarks(formats, contentLength);
  const first = cells[from]?.color ?? null;
  for (let i = from + 1; i < to; i += 1) {
    if ((cells[i]?.color ?? null) !== first) return null;
  }
  return first;
}

/**
 * Neo lại offset sau khi nội dung đổi (gõ thêm/xoá/dán ở giữa).
 *
 * Đây là bản tương đương `syncMentions` cho định dạng. Mention neo lại được bằng cách TÌM token
 * `@Tên`; định dạng không có token nào để tìm nên phải suy vùng bị thay từ tiền tố/hậu tố chung
 * rồi dịch offset theo.
 *
 * Quy ước ở ranh giới (giống mọi editor): gõ thêm chữ ngay SAU một đoạn in đậm thì chữ mới cũng
 * đậm; gõ ngay TRƯỚC đoạn đó thì không. Vì vậy nhánh `pos >= removedEnd` phải xét TRƯỚC.
 *
 * Hệ quả CÓ Ý: gõ/dán đè lên một vùng chọn đang in đậm thì chữ mới vẫn đậm — đúng như Word hay
 * tiptap. Không đặt luật riêng kiểu "thay 100% nội dung thì bỏ định dạng": luật đó bật/tắt tuỳ
 * theo có sót một ký tự chung hay không, khó đoán hơn hẳn quy tắc dịch offset đồng nhất ở đây.
 * Xoá trắng ô soạn (`newText` rỗng) vẫn trả về [] nên soạn tin mới không dính định dạng cũ.
 */
export function shiftFormats(
  oldText: string,
  newText: string,
  formats: ChatFormat[] | null | undefined,
): ChatFormat[] {
  if (!formats?.length) return [];
  const before = oldText || '';
  const after = newText || '';
  if (before === after) return normalizeFormats(formats, after.length);
  if (!after.length) return [];

  const maxCommon = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < maxCommon && before[prefix] === after[prefix]) prefix += 1;

  let suffix = 0;
  const maxSuffix = maxCommon - prefix;
  while (
    suffix < maxSuffix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix += 1;

  const removedStart = prefix;
  const removedEnd = before.length - suffix;
  const insertedLength = after.length - suffix - prefix;
  const delta = insertedLength - (removedEnd - removedStart);

  const mapPos = (pos: number): number => {
    if (pos >= removedEnd) return pos + delta;
    if (pos <= removedStart) return pos;
    return removedStart; // nằm trong vùng bị thay → co về đầu vùng
  };

  const shifted: ChatFormat[] = [];
  for (const format of formats) {
    if (!format) continue;
    const start = mapPos(format.start);
    const end = mapPos(format.start + format.length);
    if (end <= start) continue; // dải bị xoá sạch
    shifted.push({ ...format, start, length: end - start });
  }

  return normalizeFormats(shifted, after.length);
}

/** Một mảnh nội dung khi render: chữ thường, chữ được nhắc tên, và/hoặc chữ có định dạng. */
export type ChatFormattedPart = {
  text: string;
  mention?: ChatMention;
  marks?: ChatFormatMarks;
};

/**
 * Cắt nội dung thành các mảnh để render — thay `splitMentionParts` ở tầng hiển thị.
 *
 * Trộn hai loại dải (mention + định dạng) thành MỘT danh sách mảnh rời nhau, nên một đoạn vừa
 * được tag vừa in đậm chỉ ra một mảnh mang cả hai thuộc tính. Mention vẫn đi qua `syncMentions`
 * để neo lại như cũ.
 */
export function splitFormattedParts(
  text: string | null | undefined,
  mentions?: ChatMention[] | null,
  formats?: ChatFormat[] | null,
): ChatFormattedPart[] {
  const content = text || '';
  const anchoredMentions = syncMentions(content, (mentions || []).filter(Boolean));
  const runs = normalizeFormats(formats, content.length);

  if (!anchoredMentions.length && !runs.length) return [{ text: content }];

  const points = new Set<number>([0, content.length]);
  for (const mention of anchoredMentions) {
    points.add(mention.start);
    points.add(mention.start + mention.length);
  }
  for (const run of runs) {
    points.add(run.start);
    points.add(run.start + run.length);
  }

  const sorted = [...points]
    .filter((p) => p >= 0 && p <= content.length)
    .sort((a, b) => a - b);

  const parts: ChatFormattedPart[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) continue;
    const mention = anchoredMentions.find((m) => m.start <= start && m.start + m.length >= end);
    const run = runs.find((r) => r.start <= start && r.start + r.length >= end);
    parts.push({
      text: content.slice(start, end),
      ...(mention ? { mention } : {}),
      ...(run ? { marks: pickMarks(run) } : {}),
    });
  }
  return parts;
}
