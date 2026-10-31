/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        leaf: {
          50: '#effbf3', 100: '#d8f5e1', 200: '#b3eac6', 300: '#80d9a3', 400: '#4bc07c',
          500: '#27a35f', 600: '#1a844c', 700: '#17693f', 800: '#165435', 900: '#13452d', 950: '#082618',
        },
        ink: { 900: '#06110c', 800: '#0b1a14', 700: '#11241c' },
        cream: { 50: '#fbfaf5', 100: '#f5f2e8', 200: '#ebe5d3' },
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(39,163,95,0.45)',
        soft: '0 10px 40px -12px rgba(6,17,12,0.25)',
      },
      keyframes: {
        drift: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(6%,-8%) scale(1.08)' },
          '66%': { transform: 'translate(-5%,6%) scale(0.95)' },
        },
        ripple: {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        sway: {
          '0%,100%': { transform: 'rotate(-6deg)' },
          '50%': { transform: 'rotate(6deg)' },
        },
      },
      animation: {
        drift: 'drift 22s ease-in-out infinite',
        'drift-slow': 'drift 34s ease-in-out infinite reverse',
        ripple: 'ripple 1.8s cubic-bezier(0,0,0.2,1) infinite',
        sway: 'sway 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
