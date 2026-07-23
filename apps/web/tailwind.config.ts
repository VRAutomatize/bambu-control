import type { Config } from 'tailwindcss';

// Identidade Bambu Control: verde como destaque (sem copiar a marca oficial),
// visual técnico/industrial leve, modo claro e escuro.
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf3',
          100: '#d1fadf',
          200: '#a6f4c5',
          300: '#6ce9a6',
          400: '#32d583',
          500: '#12b76a',
          600: '#039855',
          700: '#027a48',
          800: '#05603a',
          900: '#054f31',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;
