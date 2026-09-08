/**
 * Hai phép biến đổi văn bản của module PM: mô tả HTML và nhắc tên trong bình luận.
 */

// ============================ NHẮC TÊN ============================

/**
 * `@[Tên hiển thị](email@domain)`.
 *
 * Phải KHỚP TỪNG KÝ TỰ với `MENTION_PATTERN` ở
 * `erp/api/erp_sis/project_management/mentions.py` — chính regex đó quyết định
 * ai nhận thông báo. Gõ lệch một dấu là mention hiện đẹp trên app nhưng người
 * được nhắc không nhận được gì, và không có lỗi nào báo ra.
 *
 * Tên hiển thị không được chứa `]`; email không được chứa khoảng trắng, `(`, `)`.
 */
export const MENTION_PATTERN = /@\[([^\]]{1,120})\]\(([^\s()]{3,160})\)/g;

/** Số mention tối đa server xử lý trong một bình luận. */
export const MAX_MENTIONS_PER_COMMENT = 20;

export interface MentionSegment {
  type: 'text' | 'mention';
  /** Với `mention`: tên hiển thị. Với `text`: nguyên đoạn. */
  text: string;
  /** Chỉ có ở `mention`. */
  email?: string;
}

/** Tách nội dung bình luận thành đoạn thường và đoạn mention, để render. */
export function parseMentionSegments(text: string): MentionSegment[] {
  if (!text) return [];
  const out: MentionSegment[] = [];
  let last = 0;

  // `lastIndex` là trạng thái của chính regex — dùng bản sao để hàm này gọi lại
  // được nhiều lần mà không bỏ sót kết quả.
  const re = new RegExp(MENTION_PATTERN.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    out.push({ type: 'mention', text: m[1], email: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

/** `@[Tên](email)` → `@Tên`. Dùng khi cần một dòng gọn (preview, thông báo). */
export function stripMentionMarkup(text: string): string {
  if (!text) return '';
  return text.replace(new RegExp(MENTION_PATTERN.source, 'g'), (_all, display) => `@${display}`);
}

/** Dựng chuỗi mention đúng định dạng backend parse được. */
export function formatMention(displayName: string, email: string): string {
  // `]` trong tên sẽ cắt cụt mention ở phía server — thay bằng khoảng trắng.
  const safeName = (displayName || email).replace(/]/g, ' ').slice(0, 120);
  return `@[${safeName}](${email})`;
}

// ============================ MÔ TẢ HTML ============================

const BLOCK_TAGS = 'p|div|section|article|header|footer|blockquote|pre|figure';

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&hellip;': '…',
  '&ndash;': '–',
  '&mdash;': '—',
};

function decodeEntities(input: string): string {
  let out = input.replace(/&[a-zA-Z#0-9]+;/g, (e) => ENTITIES[e] ?? e);
  out = out.replace(/&#(\d+);/g, (_all, code) => String.fromCharCode(Number(code)));
  return out;
}

/**
 * HTML (field Text Editor của Frappe) → Markdown để `react-native-markdown-display` render.
 *
 * Vì sao không dùng thư viện HTML renderer hay WebView: app này white-label và
 * cố ý giữ số dependency thấp; mô tả task là HTML rất hẹp do một trình soạn thảo
 * duy nhất sinh ra (đậm, nghiêng, danh sách, liên kết, tiêu đề, bảng đơn giản),
 * nên một phép đổi có kiểm soát rẻ hơn nhiều so với nhúng cả một engine. Đổi lại:
 * thẻ lạ bị bỏ đi thay vì render — chấp nhận được cho một khối mô tả.
 *
 * KHÔNG dùng cho nội dung do người ngoài gửi lên: hàm này chỉ bóc thẻ, không
 * phải bộ khử độc HTML.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  // Không có thẻ nào ⇒ vốn đã là plain text, giữ nguyên.
  if (!/<[a-z!/]/i.test(html)) return html.trim();

  let s = html;

  // Bỏ hẳn phần không hiển thị. Làm TRƯỚC mọi bước khác để nội dung bên trong
  // <script>/<style> không lọt ra thành chữ.
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  // Xuống dòng và đường kẻ
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Tiêu đề
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_all, level: string, inner: string) => {
    return `\n${'#'.repeat(Number(level))} ${inner.trim()}\n`;
  });

  // Nhấn mạnh
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '_$2_');
  s = s.replace(/<(s|del|strike)\b[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~');
  s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Liên kết và ảnh
  s = s.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  s = s.replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*>/gi, '![$1]($2)');
  s = s.replace(/<img\b[^>]*src=["']([^"']*)["'][^>]*>/gi, '![]($1)');

  // Danh sách. Đánh dấu mục bằng ký tự tạm rồi mới đánh số ở bước sau — làm
  // trong một lượt replace thì không biết mục đang ở danh sách có thứ tự hay không.
  s = s.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_all, inner: string) => {
    let i = 0;
    const body = inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_l, item: string) => {
      i += 1;
      return `\n${i}. ${item.trim()}`;
    });
    return `\n${body}\n`;
  });
  s = s.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_all, inner: string) => {
    const body = inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_l, item: string) => `\n- ${item.trim()}`);
    return `\n${body}\n`;
  });
  // <li> lạc ngoài <ul>/<ol> — trình soạn thảo dán từ Word hay sinh ra.
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');

  // Bảng: một hàng thành một dòng phân cách bằng " | ". Không dựng bảng Markdown
  // thật vì bảng rộng trên màn hẹp còn khó đọc hơn.
  s = s.replace(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi, '$1 | ');
  s = s.replace(/<\/tr>/gi, '\n');

  // Khối
  s = s.replace(new RegExp(`</(${BLOCK_TAGS})>`, 'gi'), '\n\n');
  s = s.replace(new RegExp(`<(${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '');

  // Thẻ còn lại: bỏ, giữ chữ bên trong.
  s = s.replace(/<[^>]+>/g, '');

  s = decodeEntities(s);

  // Gom dòng trống: HTML của trình soạn thảo đầy <p></p> rỗng, để nguyên thì mô
  // tả ngắn cũng chiếm cả màn hình.
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Bản một dòng, dùng cho preview trong danh sách. */
export function htmlToPlainText(html: string, maxLength = 160): string {
  const text = htmlToMarkdown(html).replace(/[#*_~`>]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}
