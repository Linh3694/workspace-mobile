/**
 * Chuẩn hoá ký tự xuống dòng trước khi render.
 *
 * Vì sao cần: nội dung soạn ở nơi khác rồi dán vào (Word, Zalo, trình soạn thảo web…) hay lẫn
 * LINE SEPARATOR U+2028 / PARAGRAPH SEPARATOR U+2029 / NEL U+0085 thay cho '\n'. CoreText (iOS)
 * coi các ký tự đó là xuống dòng nên bản iOS hiển thị đúng gạch đầu dòng, còn Layout của Android
 * chỉ ngắt dòng ở '\n' — cùng một tin nhắn bị dồn thành một khối chữ liền.
 *
 * Chỉ đổi ký tự ngắt dòng, không đụng nội dung khác. Offset của @nhắc-tên vẫn an toàn vì
 * `syncMentions` neo lại vị trí theo token chứ không tin tuyệt đối vào offset cũ.
 */
const LINE_BREAK_RE = /\r\n|[\r\v\f\u0085\u2028\u2029]/g;

export function normalizeLineBreaks(text?: string | null): string {
  const source = String(text ?? '');
  return source ? source.replace(LINE_BREAK_RE, '\n') : source;
}
