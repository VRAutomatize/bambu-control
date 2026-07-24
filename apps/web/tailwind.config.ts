import type { Config } from 'tailwindcss';

// Identidade Bambu Control: verde (tom próximo ao "system green" da Apple,
// sem copiar a marca oficial da Bambu Lab), visual nativo — tipografia do
// sistema, superfícies neutras, profundidade sutil, claro/escuro automático.
const config: Config = {
  darkMode: 'media',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdf3',
          100: '#d6fae2',
          200: '#aef2c7',
          300: '#78e6a4',
          400: '#42d47a',
          500: '#28c76a', // acento primário
          600: '#1ba656',
          700: '#188548',
          800: '#17693c',
          900: '#145733',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Inter"',
          'ui-sans-serif',
          'system-ui',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 1px 0 rgb(0 0 0 / 0.03)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        popover: '0 12px 32px -8px rgb(0 0 0 / 0.18), 0 4px 12px -4px rgb(0 0 0 / 0.08)',
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;
