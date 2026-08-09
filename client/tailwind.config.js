/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#008CFF',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#008CFF',
          600: '#0070CC',
          700: '#005599',
          800: '#003D6B',
          900: '#002644',
        },
        secondary: '#1B1B1B',
        surface: '#FFFFFF',
      },
    },
  },
  plugins: [],
};

