/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        ui: ['Inter', 'sans-serif'],
      },
      colors: {
        base: 'var(--bg-base)',
        glass: 'var(--bg-glass)',
        'border-glass': 'var(--border-glass)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        brand: {
          DEFAULT: 'var(--color-brand)',
          hover: 'var(--color-brand-hover)',
        },
        house: {
          jal: 'var(--color-jal)',
          aakash: 'var(--color-aakash)',
          vayu: 'var(--color-vayu)',
          prudhvi: 'var(--color-prudhvi)',
          agni: 'var(--color-agni)',
        }
      },
      fontSize: {
        'display-xl': ['8rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
        'display-lg': ['5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      },
      spacing: {
        '128': '32rem',
      }
    },
  },
  plugins: [],
}
