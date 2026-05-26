/**
 * 🎭 Emoji Utils - Wislife/Social Module
 * Quản lý emojis cho reactions trong Newsfeed
 * Sử dụng Lottie animations hoặc fallback về text emoji
 * 
 * Pattern giống TicketProcessingGuest.tsx
 */

export interface WislifeEmoji {
  code: string;
  name: string;
  // Source cho Lottie animation (require JSON file)
  lottieSource?: any;
  // Text fallback khi không có animation
  fallbackText: string;
  // Color cho emoji (dùng cho styling)
  color?: string;
}

/**
 * 🎬 Lottie animations cho Wislife reactions
 * Đặt các file JSON trong: assets/wislife-emojis/
 * 
 * Nếu chưa có file lottie, sẽ fallback về text emoji
 * Để thêm animation: 
 * 1. Download lottie JSON từ lottiefiles.com
 * 2. Đặt vào assets/wislife-emojis/
 * 3. Uncomment require tương ứng
 */
const lottieAnimations: Record<string, any> = {
  like: require('../assets/wislife-emojis/like.json'),
  love: require('../assets/wislife-emojis/love.json'),
  haha: require('../assets/wislife-emojis/haha.json'),
  wow: require('../assets/wislife-emojis/wow.json'),
  sad: require('../assets/wislife-emojis/sad.json'),
  angry: require('../assets/wislife-emojis/angry.json'),
};

/**
 * Danh sách emojis cho Wislife reactions
 * Có thể mở rộng thêm sau này
 */
export const WISLIFE_EMOJIS: WislifeEmoji[] = [
  {
    code: 'like',
    name: 'Thích',
    lottieSource: lottieAnimations.like,
    fallbackText: '👍',
    color: '#1877F2',
  },
  {
    code: 'love',
    name: 'Yêu thích',
    lottieSource: lottieAnimations.love,
    fallbackText: '❤️',
    color: '#F33E58',
  },
  {
    code: 'haha',
    name: 'Haha',
    lottieSource: lottieAnimations.haha,
    fallbackText: '😂',
    color: '#F7B125',
  },
  {
    code: 'wow',
    name: 'Wow',
    lottieSource: lottieAnimations.wow,
    fallbackText: '😮',
    color: '#F7B125',
  },
  {
    code: 'sad',
    name: 'Buồn',
    lottieSource: lottieAnimations.sad,
    fallbackText: '😢',
    color: '#F7B125',
  },
  {
    code: 'angry',
    name: 'Tức giận',
    lottieSource: lottieAnimations.angry,
    fallbackText: '😠',
    color: '#E9710F',
  },
];

// Map code -> emoji object để lookup nhanh
const emojiMap = new Map<string, WislifeEmoji>();
WISLIFE_EMOJIS.forEach((emoji) => emojiMap.set(emoji.code, emoji));

/** Tin chat cũ lưu mã legacy — map sang mã Wislife để hiển thị. */
const LEGACY_CHAT_REACTION_TO_WISLIFE: Record<string, string> = {
  clap: 'like',
  joy: 'haha',
  cry: 'sad',
  surprised: 'wow',
  party: 'love',
  sleepy: 'angry',
};

/**
 * Lấy emoji theo code
 * @param code - Emoji code (like, love, haha, wow, sad, angry)
 * @returns WislifeEmoji object hoặc undefined
 */
export function getEmojiByCode(code: string): WislifeEmoji | undefined {
  return emojiMap.get(code);
}

/**
 * Kiểm tra emoji có Lottie animation không
 * @param emoji - WislifeEmoji object
 */
export function hasLottieAnimation(emoji: WislifeEmoji | undefined): boolean {
  return !!emoji?.lottieSource;
}

/**
 * Kiểm tra emoji có phải là fallback (text) không
 * @param emoji - WislifeEmoji object
 */
export function isFallbackEmoji(emoji: WislifeEmoji | undefined): boolean {
  return !emoji?.lottieSource;
}

/**
 * Lấy tất cả emojis
 */
export function getAllEmojis(): WislifeEmoji[] {
  return WISLIFE_EMOJIS;
}

/**
 * Lấy emoji name theo code
 * @param code - Emoji code
 */
export function getEmojiName(code: string): string {
  return emojiMap.get(code)?.name || code;
}

/**
 * Lấy fallback text của emoji
 * @param code - Emoji code
 */
export function getEmojiFallbackText(code: string): string {
  return emojiMap.get(code)?.fallbackText || '👍';
}

/**
 * Lấy Lottie source theo code
 * @param code - Emoji code
 */
export function getLottieSource(code: string): any | undefined {
  return emojiMap.get(code)?.lottieSource;
}

/**
 * Lấy color của emoji
 * @param code - Emoji code
 */
export function getEmojiColor(code: string): string {
  return emojiMap.get(code)?.color || '#1877F2';
}

/** Chuẩn hóa mã reaction (DB có thể còn bản legacy). */
export function resolveChatReactionCode(stored: string): string {
  return LEGACY_CHAT_REACTION_TO_WISLIFE[stored] ?? stored;
}

/** Ký tự fallback hiển thị trên chip reaction trong chat. */
export function getChatReactionGlyph(stored: string): string {
  const code = resolveChatReactionCode(stored);
  return emojiMap.get(code)?.fallbackText ?? '👍';
}

export default {
  getEmojiByCode,
  isFallbackEmoji,
  hasLottieAnimation,
  getAllEmojis,
  getEmojiName,
  getEmojiFallbackText,
  getLottieSource,
  getEmojiColor,
  resolveChatReactionCode,
  getChatReactionGlyph,
  WISLIFE_EMOJIS,
};
