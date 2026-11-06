/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#090a0f',
          900: '#0f121d',
          850: '#151928',
          800: '#1b2034',
          700: '#272e4a',
        },
        brand: {
          cyan: '#00f2fe',
          blue: '#4facfe',
          violet: '#7f00ff',
          pink: '#e100ff',
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.5s infinite ease-in-out',
        'ripple': 'ripple 2s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(0.98)' },
          '50%': { opacity: '0.9', transform: 'scale(1.03)' },
        },
        ripple: {
          '0%': { transform: 'scale(0.95)', opacity: '0.8' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}
