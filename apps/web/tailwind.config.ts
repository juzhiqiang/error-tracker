import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2-rgb) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3-rgb) / <alpha-value>)',
        line: 'rgb(var(--line-rgb) / <alpha-value>)',
        muted: 'rgb(var(--ink-muted-rgb) / <alpha-value>)',
        primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
        'primary-hover': 'rgb(var(--primary-hover-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        info: 'rgb(var(--info-rgb) / <alpha-value>)',
        slate: {
          50: 'rgb(var(--slate-50-rgb) / <alpha-value>)',
          100: 'rgb(var(--slate-100-rgb) / <alpha-value>)',
          200: 'rgb(var(--slate-200-rgb) / <alpha-value>)',
          300: 'rgb(var(--slate-300-rgb) / <alpha-value>)',
          400: 'rgb(var(--slate-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--slate-500-rgb) / <alpha-value>)',
          600: 'rgb(var(--slate-600-rgb) / <alpha-value>)',
          700: 'rgb(var(--slate-700-rgb) / <alpha-value>)',
          800: 'rgb(var(--slate-800-rgb) / <alpha-value>)',
          900: 'rgb(var(--slate-900-rgb) / <alpha-value>)',
          950: 'rgb(var(--slate-950-rgb) / <alpha-value>)',
        },
        indigo: {
          100: 'rgb(var(--primary-soft-ink-rgb) / <alpha-value>)',
          200: 'rgb(var(--primary-ink-rgb) / <alpha-value>)',
          300: 'rgb(var(--primary-rgb) / <alpha-value>)',
        },
        red: {
          200: 'rgb(var(--danger-rgb) / <alpha-value>)',
          300: 'rgb(var(--danger-rgb) / <alpha-value>)',
        },
        amber: {
          200: 'rgb(var(--warning-rgb) / <alpha-value>)',
          300: 'rgb(var(--warning-rgb) / <alpha-value>)',
        },
        emerald: {
          200: 'rgb(var(--success-rgb) / <alpha-value>)',
          300: 'rgb(var(--success-rgb) / <alpha-value>)',
          400: 'rgb(var(--success-rgb) / <alpha-value>)',
        },
        sky: {
          200: 'rgb(var(--info-rgb) / <alpha-value>)',
          300: 'rgb(var(--info-rgb) / <alpha-value>)',
        },
        rose: {
          200: 'rgb(var(--danger-rgb) / <alpha-value>)',
          300: 'rgb(var(--danger-rgb) / <alpha-value>)',
          500: 'rgb(var(--danger-rgb) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
