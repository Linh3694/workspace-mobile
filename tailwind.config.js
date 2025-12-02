/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#002855',
        secondary: '#F05023',
        error: '#FF3B30',
        'text-secondary': '#757575',
      },
      fontFamily: {
        // Base font families
        sans: ['Mulish-Regular'],
        mulish: ['Mulish-Regular'],
        'mulish-medium': ['Mulish-Medium'],
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
