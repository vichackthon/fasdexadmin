/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ─────────────────────────────────────────
      // FONTS (Matching Flutter ui_kit)
      // ─────────────────────────────────────────
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },

      // ─────────────────────────────────────────
      // TYPOGRAPHY SCALE (Design Guide)
      // ─────────────────────────────────────────
      fontSize: {
        'h1': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        'h2': ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        'subheader': ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'small': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        'caption': ['10px', { lineHeight: '1.4', fontWeight: '400' }],
      },

      // ─────────────────────────────────────────
      // COLORS (Matching Flutter AppColors)
      // ─────────────────────────────────────────
      colors: {
        primary: {
          DEFAULT: '#FF6E15',
          light: '#FFEAD9',
          50: '#FFF0E6',
          100: '#FFD8BF',
          200: '#FFBE99',
          300: '#FFA573',
          400: '#FF8B4D',
          500: '#FF6E15',
          600: '#E65A00',
          700: '#CC4D00',
          800: '#993A00',
          900: '#662700',
        },
        secondary: {
          DEFAULT: '#00AA13',
          light: '#E5F7E8',
        },
        gray: {
          50: '#F9F9F9',
          100: '#F0F0F0',
          200: '#D9D9D9',
          300: '#AAAAAA',
          400: '#9A9A9A',
          500: '#6A6A6A',
          700: '#4A4A4A',
          900: '#101010',
        },
        error: '#E53935',
        success: '#00AA13',
        warning: '#FFB300',
      },

      // ─────────────────────────────────────────
      // SPACING (Design Guide: 4,8,12,16,20,24,32,40)
      // ─────────────────────────────────────────
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'base': '16px',
        'lg': '20px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '40px',
      },

      // ─────────────────────────────────────────
      // BORDER RADIUS
      // ─────────────────────────────────────────
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
      },
    },
  },
  plugins: [],
}
