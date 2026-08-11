/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#008CFF',
          50: '#EFF8FF',
          100: '#DCEEFF',
          200: '#B9DDFF',
          300: '#85C6FF',
          400: '#4AABFF',
          500: '#008CFF',
          600: '#0070CC',
          700: '#005599',
          800: '#003D6B',
          900: '#002644',
        },
        secondary: '#15181D',
        surface: '#FFFFFF',
        // Slate-tinted neutrals: reads calmer next to the brand blue than pure gray.
        ink: {
          DEFAULT: '#15181D',
          soft: '#4A5462',
          faint: '#78828F',
        },
        line: {
          DEFAULT: '#E4E8ED',
          strong: '#CFD5DD',
        },
        canvas: '#F6F8FA',
        // Semantic status colors, kept separate from the brand accent.
        success: { DEFAULT: '#0F7B4F', soft: '#E8F5EE', ink: '#0A5A39' },
        warning: { DEFAULT: '#B45309', soft: '#FDF3E4', ink: '#8A3F07' },
        danger: { DEFAULT: '#C0342B', soft: '#FCECEA', ink: '#96261F' },
      },
      borderRadius: {
        control: '0.5rem',
        card: '0.75rem',
        panel: '1rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(21, 24, 29, 0.04)',
        raised: '0 1px 3px rgba(21, 24, 29, 0.06), 0 8px 24px -12px rgba(21, 24, 29, 0.14)',
        panel: '0 24px 60px -20px rgba(21, 24, 29, 0.32), 0 8px 20px -12px rgba(21, 24, 29, 0.18)',
      },
      keyframes: {
        'panel-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'panel-in': 'panel-in 160ms cubic-bezier(0.2, 0, 0.2, 1)',
        'fade-in': 'fade-in 140ms ease-out',
        'toast-in': 'toast-in 180ms cubic-bezier(0.2, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
