/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#008CFF',
        secondary: '#1B1B1B',
        surface: '#FFFFFF',
      },
    },
  },
  plugins: [],
};

