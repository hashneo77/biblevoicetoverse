/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        verse: ['Lora', 'Georgia', 'serif'],
        malayalam: ['"Noto Serif Malayalam"', 'serif'],
      },
      colors: {
        amber: {
          250: '#fde8a0',
        },
      },
      animation: {
        'pulse-rec': 'pulseRec 1.2s ease-in-out infinite',
        'spin-slow': 'spin 1.5s linear infinite',
        'shake': 'shake 0.5s ease-in-out',
      },
      keyframes: {
        pulseRec: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(220,38,38,0.4)' },
          '50%': { transform: 'scale(1.08)', boxShadow: '0 0 0 8px rgba(220,38,38,0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%':       { transform: 'translateX(-10px)' },
          '40%':       { transform: 'translateX(10px)' },
          '60%':       { transform: 'translateX(-8px)' },
          '80%':       { transform: 'translateX(8px)' },
        },
      },
    },
  },
  plugins: [],
}
