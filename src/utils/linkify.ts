/**
 * Tách văn bản thuần thành đoạn chữ và đoạn link để render thành thẻ bấm được.
 * Dùng chung cho tin nhắn (chat) và bài viết/bình luận (Bảng tin).
 *
 * Bản sao logic này tồn tại ở 4 app (PH web/mobile, GV web/mobile) — sửa thì sửa cả 4.
 */

/**
 * Chỉ bắt `http(s)://…` và `www.…`. CỐ Ý không đoán tên miền trần ("abc.vn"): nội dung
 * tiếng Việt đầy chuỗi kiểu "5A6.Spark" hay "10.000đ" sẽ bị tô nhầm thành link.
 */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"'`]+)/gi;

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
