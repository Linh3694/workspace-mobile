/**
 * Tách nội dung issue và khối file góp ý phụ huynh nhúng HTML — đồng bộ web IssueDetail
 */
export const FEEDBACK_FILES_MARKER = '<p><strong>File đính kèm (góp ý phụ huynh):</strong></p>';

export type EmbeddedFileRef = { url: string; label: string };

/** Regex lấy href / src — không dùng DOMParser (React Native) */
export function splitIssueContentAndFeedbackFiles(html: string): {
  displayHtml: string;
  embeddedFiles: EmbeddedFileRef[];
} {
  if (!html?.trim()) {
    return { displayHtml: '', embeddedFiles: [] };
  }
  const idx = html.indexOf(FEEDBACK_FILES_MARKER);
  if (idx === -1) {
    return { displayHtml: html, embeddedFiles: [] };
  }
  const displayHtml = html.slice(0, idx).trim();
  const tail = html.slice(idx + FEEDBACK_FILES_MARKER.length);
  const embeddedFiles: EmbeddedFileRef[] = [];
  const seen = new Set<string>();

  const push = (url: string, label: string) => {
    const u = (url || '').trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    embeddedFiles.push({ url: u, label: (label || '').trim() });
  };

  const hrefRe = /href="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(tail)) !== null) {
    push(m[1], '');
  }
  const srcRe = /src="([^"]+)"/gi;
  while ((m = srcRe.exec(tail)) !== null) {
    push(m[1], '');
  }

  return { displayHtml, embeddedFiles };
}
