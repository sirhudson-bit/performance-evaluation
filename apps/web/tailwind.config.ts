import type { Config } from 'tailwindcss';

/**
 * Design tokens.
 *
 * A single accent palette (deep corporate blue) with semantic colours reserved
 * for status only, and one consistent corner radius (15px) applied to every
 * non-circular element so the interface reads as one system.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn Variable', 'Vazirmatn', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        surface: '#ffffff',
        canvas: '#f8fafc',
      },
      borderRadius: {
        sm: '15px',
        DEFAULT: '15px',
        md: '15px',
        lg: '15px',
        xl: '15px',
        '2xl': '15px',
        '3xl': '15px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out both',
        'slide-up': 'slideUp 0.3s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
