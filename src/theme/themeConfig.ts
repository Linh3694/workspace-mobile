// ============================================
// THEME CONFIG - Cấu hình theme cho app
// ============================================
// Dev enable theme nào thì set ACTIVE_THEME bên dưới
// Sau đó build app là xong, không cần logic runtime

export type ThemeType = 'default' | 'tet' | 'christmas' | 'halloween' | 'mid-autumn' | 'winter';

// ⭐️ DEV: THAY ĐỔI THEME Ở ĐÂY TRƯỚC KHI BUILD ⭐️
// Chỉ việc đổi giá trị này và build lại app
export const ACTIVE_THEME: ThemeType = 'winter'; // Thay đổi thành 'tet', 'christmas', 'winter', v.v.

export interface ThemeColors {
  // Gradient colors cho home screen
  homeGradient: string[];
  homeGradientLocations?: number[];

  // Gradient colors cho menu container
  menuGradient: string[];

  // Gradient cho border
  borderGradient: string[];

  // Gradient cho username text trên Home screen
  usernameGradient: string[];

  // Màu chủ đạo
  primary: string;
  secondary: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;

  // Màu nền solid (cho splash screen, etc.)
  background?: string;

  // Màu cho splash screen
  splashBackground?: string;
  splashText?: string;
  splashSubtitle?: string;
  splashAccent?: string;
}

export interface ThemeAssets {
  // Logo cho splash screen và app
  logo?: any; // require path

  // Splash screen background
  splashBackground?: any;

  // Icon đặc biệt cho các menu items (optional)
  customIcons?: {
    [key: string]: any;
  };
}

export interface Theme {
  id: ThemeType;
  name: string;
  description?: string; // Mô tả theme (cho dev reference)
  colors: ThemeColors;
  assets?: ThemeAssets;
  hasSnowfall?: boolean; // Animation tuyết rơi (cho winter/christmas theme)
}

// ============ THEME DEFINITIONS ============

// Theme mặc định
const defaultTheme: Theme = {
  id: 'default',
  name: 'Default',
  description: 'Theme mặc định của app',
  colors: {
    homeGradient: [
      'rgba(240, 80, 35, 0.03)', // #F05023
      'rgba(255, 206, 2, 0.06)', // #FFCE02
      'rgba(190, 210, 50, 0.04)', // #BED232
      'rgba(0, 148, 131, 0.07)', // #009483
    ],
    homeGradientLocations: [0, 0.22, 0.85, 1],
    menuGradient: [
      'rgba(255, 206, 2, 0.05)', // #FFCE02
      'rgba(190, 210, 50, 0.05)', // #BED232
    ],
    borderGradient: ['#FFCE02', '#BED232'],
    usernameGradient: ['#F05023', '#F5AA1E'], // Cam -> Vàng
    primary: '#002855',
    secondary: '#F05023',
    textPrimary: '#0A2240',
    textSecondary: '#757575',
  },
};

// Theme Tết Nguyên Đán
const tetTheme: Theme = {
  id: 'tet',
  name: 'Tết Nguyên Đán',
  description: 'Theme Tết với màu đỏ vàng truyền thống',
  colors: {
    homeGradient: [
      'rgba(220, 38, 38, 0.05)', // Đỏ
      'rgba(234, 179, 8, 0.08)', // Vàng
      'rgba(220, 38, 38, 0.04)', // Đỏ nhạt
      'rgba(234, 179, 8, 0.06)', // Vàng nhạt
    ],
    homeGradientLocations: [0, 0.25, 0.75, 1],
    menuGradient: ['rgba(220, 38, 38, 0.08)', 'rgba(234, 179, 8, 0.08)'],
    borderGradient: ['#DC2626', '#EAB308'],
    usernameGradient: ['#DC2626', '#EAB308'], // Đỏ -> Vàng
    primary: '#DC2626',
    secondary: '#EAB308',
    textPrimary: '#7F1D1D',
    textSecondary: '#92400E',
  },
};

// Theme Giáng Sinh
const christmasTheme: Theme = {
  id: 'christmas',
  name: 'Christmas',
  description: 'Theme Giáng Sinh với màu đỏ, xanh lá và trắng',
  colors: {
    homeGradient: [
      'rgba(220, 38, 38, 0.05)', // Đỏ
      'rgba(21, 128, 61, 0.06)', // Xanh lá
      'rgba(255, 255, 255, 0.08)', // Trắng
      'rgba(220, 38, 38, 0.04)', // Đỏ nhạt
    ],
    homeGradientLocations: [0, 0.3, 0.6, 1],
    menuGradient: ['rgba(220, 38, 38, 0.08)', 'rgba(21, 128, 61, 0.08)'],
    borderGradient: ['#DC2626', '#15803D'],
    usernameGradient: ['#DC2626', '#15803D'], // Đỏ -> Xanh lá
    primary: '#DC2626',
    secondary: '#15803D',
    textPrimary: '#7F1D1D',
    textSecondary: '#14532D',
  },
};

// Theme Halloween
const halloweenTheme: Theme = {
  id: 'halloween',
  name: 'Halloween',
  description: 'Theme Halloween với màu cam, tím và đen',
  colors: {
    homeGradient: [
      'rgba(249, 115, 22, 0.06)', // Cam
      'rgba(124, 58, 237, 0.05)', // Tím
      'rgba(0, 0, 0, 0.03)', // Đen
      'rgba(249, 115, 22, 0.04)', // Cam nhạt
    ],
    homeGradientLocations: [0, 0.3, 0.7, 1],
    menuGradient: ['rgba(249, 115, 22, 0.08)', 'rgba(124, 58, 237, 0.08)'],
    borderGradient: ['#F97316', '#7C3AED'],
    usernameGradient: ['#F97316', '#7C3AED'], // Cam -> Tím
    primary: '#7C3AED',
    secondary: '#F97316',
    textPrimary: '#581C87',
    textSecondary: '#7C2D12',
  },
};

// Theme Trung Thu
const midAutumnTheme: Theme = {
  id: 'mid-autumn',
  name: 'Trung Thu',
  description: 'Theme Trung Thu với màu vàng cam ấm áp',
  colors: {
    homeGradient: [
      'rgba(234, 179, 8, 0.06)', // Vàng
      'rgba(251, 146, 60, 0.05)', // Cam
      'rgba(239, 68, 68, 0.04)', // Đỏ
      'rgba(234, 179, 8, 0.05)', // Vàng nhạt
    ],
    homeGradientLocations: [0, 0.3, 0.7, 1],
    menuGradient: ['rgba(234, 179, 8, 0.08)', 'rgba(251, 146, 60, 0.08)'],
    borderGradient: ['#EAB308', '#FB923C'],
    usernameGradient: ['#EAB308', '#FB923C'], // Vàng -> Cam
    primary: '#EAB308',
    secondary: '#FB923C',
    textPrimary: '#713F12',
    textSecondary: '#7C2D12',
  },
};

// Theme Mùa Đông/Giáng Sinh - Nền xanh navy đậm với tuyết rơi
// Màu lấy từ icon Giáng sinh: xanh navy, vàng cam, trắng tuyết
const winterTheme: Theme = {
  id: 'winter',
  name: 'Winter Christmas',
  description: 'Theme Giáng sinh với nền xanh navy đậm, accent vàng cam và tuyết rơi',
  hasSnowfall: true,
  colors: {
    // Nền xanh navy đậm như trong ảnh
    homeGradient: ['#1E3A5F', '#152C4A', '#0D1F35', '#1E3A5F'],
    homeGradientLocations: [0, 0.35, 0.7, 1],
    // Menu - trắng trong suốt như quả cầu tuyết (không gradient)
    menuGradient: ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.15)'],
    // Border vàng bóng (gold shiny) cho Giáng sinh
    // NOTE: phối nhiều stop để tạo cảm giác bóng/shine
    borderGradient: [
      'rgba(212, 168, 75, 0.95)', // gold base
      'rgba(245, 209, 122, 1)', // gold highlight
      'rgba(255, 255, 255, 0.9)', // white shine
      'rgba(245, 209, 122, 1)', // gold highlight
      'rgba(212, 168, 75, 0.95)', // gold base
    ],
    // Gradient cho username - vàng cam như chữ W
    usernameGradient: ['#F5D17A', '#D4A84B'],
    // Màu chủ đạo: vàng cam từ logo
    primary: '#F5D17A', // Vàng sáng
    secondary: '#D4A84B', // Vàng cam đậm hơn
    // Text sáng để nổi bật trên nền tối
    textPrimary: '#FFFFFF',
    textSecondary: '#C9D6E3', // Xám xanh nhạt
    // Màu cho splash screen
    background: '#1E3A5F',
    splashBackground: '#1E3A5F',
    splashText: '#FFFFFF',
    splashSubtitle: '#C9D6E3',
    splashAccent: '#F5D17A', // Vàng như chữ W
  },
};

// ============ THEME REGISTRY ============

export const themes: Record<ThemeType, Theme> = {
  default: defaultTheme,
  tet: tetTheme,
  christmas: christmasTheme,
  halloween: halloweenTheme,
  'mid-autumn': midAutumnTheme,
  winter: winterTheme,
};

// ============ THEME SELECTOR ============

/**
 * Lấy theme hiện tại dựa trên ACTIVE_THEME constant
 * Đơn giản và rõ ràng - theme nào được set là dùng theme đó
 */
export const getCurrentTheme = (): Theme => {
  return themes[ACTIVE_THEME];
};

// Alias để dễ sử dụng
export const getActiveTheme = getCurrentTheme;

// ============ HELPER FUNCTIONS ============

/**
 * Check xem có đang dùng theme đặc biệt không (không phải default)
 */
export const hasActiveSpecialTheme = (): boolean => {
  // NOTE: ACTIVE_THEME là hằng số build-time, TS đôi khi suy luận literal type
  return (ACTIVE_THEME as ThemeType) !== 'default';
};

/**
 * Lấy tất cả themes có sẵn (cho dev reference)
 */
export const getAllThemes = (): Theme[] => {
  return Object.values(themes);
};
