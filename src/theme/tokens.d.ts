/**
 * Kiểu cho `tokens.js`. Giá trị thật nằm ở file `.js` bên cạnh — sửa màu thì sửa ở đó.
 * File này chỉ mô tả hình dạng để phía TypeScript có gợi ý và bắt lỗi gõ sai tên token.
 */
import type { TextStyle, ViewStyle } from 'react-native';

type Scale = { DEFAULT: string; [key: string]: string };

export declare const color: {
  brand: { DEFAULT: string; hover: string; active: string; 50: string; 100: string; foreground: string };
  brandSecondary: { DEFAULT: string; hover: string; 50: string; foreground: string };
  accent: { DEFAULT: string; hover: string; 50: string; bright: string; foreground: string };
  success: Scale;
  danger: Scale;
  warning: Scale;
  info: Scale;
  surface: { page: string; DEFAULT: string; subtle: string; muted: string; inset: string };
  content: {
    emphasized: string;
    DEFAULT: string;
    normal: string;
    description: string;
    disabled: string;
    inverse: string;
  };
  line: { subtle: string; DEFAULT: string; strong: string };
  overlay: { onBrand: string; scrim: string };
  neutral: Record<0 | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;
};

export declare const space: Record<2 | 4 | 6 | 8 | 10 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64, number>;

export declare const radius: Record<4 | 6 | 8 | 12 | 14 | 16 | 20 | 24 | 28, number> & { full: number };

export type TypographyVariant =
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'footnote'
  | 'caption';

export declare const typography: Record<
  TypographyVariant,
  Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontFamily'>
>;

export declare const fontFamily: {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  extrabold: string;
};

export declare const layout: {
  minTouch: number;
  controlHeight: number;
  controlHeightSm: number;
  screenPadding: number;
};

export declare const elevation: {
  floating: ViewStyle;
  overlay: ViewStyle;
};
