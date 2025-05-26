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
        sans: ['Mulish-Regular'],
        medium: ['Mulish-Medium'],
        semibold: ['Mulish-SemiBold'],
        bold: ['Mulish-Bold'],
      },
    },
  },
  plugins: [],
};
