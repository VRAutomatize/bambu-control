import type { Config } from 'tailwindcss';

// Identidade Bambu Control: verde alinhado ao tom característico da Bambu
// Lab (~#00AE42), aplicado com padrões de interface nativos da Apple —
// tipografia do sistema, superfícies neutras, profundidade sutil,
// claro/escuro automático. Não usamos o logo/wordmark oficial da Bambu Lab
// em nenhum lugar (aviso de "não afiliado" no rodapé/Integrações).
const config: Config = {
  darkMode: 'media',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e6f9ec',
          100: '#c3f0d1',
          200: '#8ee0ac',
          300: '#52cb80',
          400: '#22b862',
          500: '#00ae42', // acento primário — verde Bambu Lab
          600: '#009138',
          700: '#00752e',
          800: '#005f26',
          900: '#004d1f',
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
