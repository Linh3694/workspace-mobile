/** @type {import('tailwindcss').Config} */

// Nguồn sự thật của màu/khoảng cách/bo góc. ĐỪNG viết hex thẳng vào file này.
// Đổi bộ nhận diện = sửa src/theme/tokens.js, không sửa ở đây.
const { color, radius, space } = require('./src/theme/tokens');

module.exports = {
  content: ['./App.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ── ui-v2: dùng nhóm này cho MỌI code mới ──────────────────────────
        brand: color.brand,
        'brand-secondary': color.brandSecondary,
        accent: color.accent,
        success: color.success,
        danger: color.danger,
        warning: color.warning,
        info: color.info,
        surface: color.surface,
        content: color.content,
        line: color.line,
        neutral: color.neutral,

        // ── LEGACY — đừng dùng trong code mới ──────────────────────────────
        // Ngữ nghĩa NGƯỢC với web và với nhóm `brand-*` ở trên:
        //   primary = navy, secondary = cam.
        // Giữ lại vì ~59 callsite ở màn V1 đang phụ thuộc. Gỡ dần theo từng màn
        // ở GĐ3; khi không còn callsite nào thì xoá cả khối này.
        primary: '#002855',
        secondary: '#F05023',
        error: '#FF3B30',
        'text-secondary': '#757575',
      },
      borderRadius: {
        card: radius[20],
        sheet: radius[24],
      },
      spacing: {
        screen: space[20],
      },
      fontFamily: {
        // Base font families
        sans: ['Mulish-Regular'],
        mulish: ['Mulish-Regular'],
        'mulish-medium': ['Mulish-Medium'],
        /** RN: cần file Mulish-Italic; class italic + Mulish-Medium không nghiêng được */
        'mulish-italic': ['Mulish-Italic'],
        'mulish-semibold': ['Mulish-SemiBold'],
        'mulish-bold': ['Mulish-Bold'],
        'mulish-extrabold': ['Mulish-ExtraBold'],
        'mulish-black': ['Mulish-Black'],
      },
      // Map font weights to Mulish variants for NativeWind
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
    },
  },
  plugins: [],
};
