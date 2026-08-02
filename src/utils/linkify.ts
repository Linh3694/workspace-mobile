/**
 * Tách văn bản thuần thành đoạn chữ và đoạn link để render thành thẻ bấm được.
 * Dùng chung cho tin nhắn (chat) và bài viết/bình luận (Bảng tin).
 *
 * Bản sao logic này tồn tại ở 4 app (PH web/mobile, GV web/mobile) — sửa thì sửa cả 4.
 */

/**
 * Tên miền trần ("google.com") chỉ được nhận khi đuôi nằm trong whitelist dưới đây.
 * CỐ Ý không chấp nhận đuôi bất kỳ: nội dung tiếng Việt đầy chuỗi kiểu "5A6.Spark",
 * "10.000đ", "file.docx" — đuôi tự do sẽ tô nhầm hết thành link.
 *
 * Whitelist cũng CỐ Ý bỏ các TLD trùng từ thông dụng (.co .it .me .in .app .dev .online…):
 * chúng hợp lệ về kỹ thuật nhưng dễ dính nhầm khi người dùng quên khoảng trắng sau dấu chấm.
 * Người dùng vẫn gõ được các miền đó bằng "https://" hoặc "www." như trước.
 */
const BARE_TLDS = [
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'info', 'biz',
  'io', 'ai', 'vn', 'us', 'uk', 'jp', 'kr', 'cn', 'sg', 'au', 'fr', 'de', 'ca',
].join('|');

/** Một nhãn tên miền: bắt đầu/kết thúc bằng chữ-số, cho phép gạch nối ở giữa. */
const LABEL = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?';

/**
 * Nhánh 1: `http(s)://…` và `www.…` (như cũ, đuôi tự do).
 * Nhánh 2: tên miền trần — ≥1 nhãn, đuôi thuộc whitelist, kèm port/path/query/hash tuỳ chọn.
 * `(?![a-z0-9-])` chặn "abc.vnese" bị cắt thành "abc.vn".
 */
const URL_RE = new RegExp(
  '((?:https?:\\/\\/|www\\.)[^\\s<>"\'`]+' +
    `|${LABEL}(?:\\.${LABEL})*\\.(?:${BARE_TLDS})(?![a-z0-9-])` +
    '(?::\\d{2,5})?(?:[\\/?#][^\\s<>"\'`]*)?)',
  'gi',
);

/**
 * Ký tự đứng ngay trước tên miền trần mà khiến nó KHÔNG phải link độc lập:
 * `@` (phần sau email), `.`/chữ/số/gạch (đang cắt giữa một chuỗi dài hơn).
 * Kiểm tra bằng code thay vì lookbehind vì Hermes (React Native) không hỗ trợ đầy đủ.
 */
function isBoundaryBefore(source: string, start: number): boolean {
  if (start === 0) return true;
  return !/[@.\w-]/.test(source[start - 1]);
}

/** Dấu câu thường dính đuôi link trong câu tiếng Việt — trả về phần văn bản để render lại. */
const TRAILING_PUNCT = '.,;:!?…"\'’”)]}>';

/**
 * Cắt dấu câu ở cuối link. Dấu đóng ngoặc chỉ cắt khi KHÔNG có ngoặc mở tương ứng trong link,
 * để URL kiểu Wikipedia `...(disambiguation)` không bị mất ký tự cuối.
 */
function splitTrailingPunctuation(raw: string): { url: string; trail: string } {
  let end = raw.length;
  while (end > 0) {
    const ch = raw[end - 1];
    if (!TRAILING_PUNCT.includes(ch)) break;
    if (ch === ')' || ch === ']' || ch === '}') {
      const open = ch === ')' ? '(' : ch === ']' ? '[' : '{';
      const head = raw.slice(0, end);
      const opens = head.split(open).length - 1;
      const closes = head.split(ch).length - 1;
      if (opens >= closes) break;
    }
    end -= 1;
  }
  return { url: raw.slice(0, end), trail: raw.slice(end) };
}

export type LinkifySegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string };

/** URL đầy đủ để mở: `www.abc.vn` thiếu scheme, trình duyệt sẽ hiểu là đường dẫn tương đối. */
export function linkHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Chia text thành các đoạn; đoạn `link` có `value` để hiện và `href` để mở. */
export function splitTextWithLinks(text?: string | null): LinkifySegment[] {
  const source = String(text ?? '');
  if (!source) return [];

  const segments: LinkifySegment[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(URL_RE)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const { url, trail } = splitTrailingPunctuation(raw);

    // Chỉ còn "www." hoặc "https://" trơ trọi sau khi cắt ⇒ không phải link, để nguyên làm chữ.
    if (!url || /^(?:https?:\/\/|www\.)$/i.test(url)) continue;

    // Tên miền trần: bỏ qua nếu dính vào chuỗi trước đó (email, đường dẫn, số nhiều đoạn).
    const isBare = !/^(?:https?:\/\/|www\.)/i.test(url);
    if (isBare && !isBoundaryBefore(source, start)) continue;

    if (start > lastIndex) segments.push({ type: 'text', value: source.slice(lastIndex, start) });
    segments.push({ type: 'link', value: url, href: linkHref(url) });
    if (trail) segments.push({ type: 'text', value: trail });
    lastIndex = start + raw.length;
  }

  if (lastIndex < source.length) {
    segments.push({ type: 'text', value: source.slice(lastIndex) });
  }
  return segments;
}

/** Có ít nhất một link trong text? Dùng để bỏ qua nhánh render nặng khi không cần. */
export function hasLink(text?: string | null): boolean {
  return splitTextWithLinks(text).some((s) => s.type === 'link');
}
