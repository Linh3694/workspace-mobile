/**
 * Sticker Wislife trong chat — đồng bộ parent-portal-mobile/utils/chatWislifeSticker.ts
 */
export const CHAT_WISLIFE_STICKER_CODES = [
  'like',
  'love',
  'haha',
  'wow',
  'sad',
  'angry',
] as const;

export type ChatWislifeStickerCode = (typeof CHAT_WISLIFE_STICKER_CODES)[number];

const RE = /^\{:wislife:([a-z0-9_]+):\}$/i;

const CODE_SET = new Set<string>(CHAT_WISLIFE_STICKER_CODES);

export function parseChatWislifeStickerContent(
  content: string | undefined | null
): ChatWislifeStickerCode | null {
  const t = String(content ?? '').trim();
  const m = t.match(RE);
  if (!m) return null;
  const code = m[1].toLowerCase();
  return CODE_SET.has(code) ? (code as ChatWislifeStickerCode) : null;
}

export function formatChatWislifeStickerContent(code: string): string | null {
  const c = String(code || '').trim().toLowerCase();
  if (!CODE_SET.has(c)) return null;
  return `{:wislife:${c}:}`;
}

/** Nhãn ngắn cho trích dẫn (ẩn chuỗi wire). */
export function humanizeChatWislifeStickerForPreview(
  content: string | undefined | null
): string | null {
  return parseChatWislifeStickerContent(content) ? '[Emoji]' : null;
}
