/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // CSS variable-based tokens for seamless dark/light theming
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        hover: 'var(--hover)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        accent: 'var(--accent)',
        completed: 'var(--completed)',
        border: 'var(--border, rgba(255,255,255,0.08))',
        // Named color palette (for direct usage)
        dark: {
          bg: '#1a1a2e',
          surface: '#22223b',
          hover: '#2a2a4a',
          primary: '#edf2f4',
          secondary: '#8d99ae',
          accent: '#4cc9f0',
          completed: '#4a4e69',
        },
        light: {
          bg: '#f8f9fa',
          surface: '#ffffff',
          hover: '#e9ecef',
          primary: '#212529',
          secondary: '#6c757d',
          accent: '#4361ee',
        },
        priority: {
          urgent: '#f72585',
          high: '#ef476f',
          medium: '#ffd166',
          low: '#06d6a0',
        },
      },
      fontFamily: {
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-in': 'slideIn 150ms ease-out',
        'slide-out': 'slideOut 200ms ease-in',
        'fade-in': 'fadeIn 150ms ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideOut: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
