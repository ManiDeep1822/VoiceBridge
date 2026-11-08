/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#07090C',
        surface: {
          DEFAULT: '#0B0D11',
          elevated: '#13171F',
          muted: '#181C26',
        },
        border: {
          subtle: '#1E232E',
          active: '#2E3547',
          focus: '#3B82F6',
        },
        status: {
          synced: '#10B981',
          buffering: '#F59E0B',
          drift: '#EF4444',
          host: '#8B5CF6',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', '"Courier New"', 'monospace'],
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
    },
  },
  plugins: [],
}
