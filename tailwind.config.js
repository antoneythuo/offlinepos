/** @type {import('tailwindcss').Config} */
module.exports = {
  // Enable class-based dark mode strategy (toggled by adding 'dark' class to <html>)
  darkMode: 'class',
  content: [
    './renderer/index.html',
    './renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // POS-specific semantic colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      screens: {
        // Minimum supported resolution: 1024×600
        'pos-sm': '1024px',
        'pos-md': '1280px',
        'pos-lg': '1920px'
      },
      minHeight: {
        'touch': '44px'  // Minimum touch target size (Requirement 30.3)
      },
      minWidth: {
        'touch': '44px'
      }
    }
  },
  plugins: []
}
