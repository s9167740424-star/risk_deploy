/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4f46e5',
        'primary-dark': '#4338ca',
        'primary-light': '#6366f1',
        secondary: '#0ea5e9',
        accent: '#f59e0b',
        'accent-dark': '#d97706',
        background: '#f1f5f9',
        surface: '#ffffff',
        'text-primary': '#0f172a',
        'text-secondary': '#334155',
        'text-muted': '#64748b',
        border: '#cbd5e1',
        'border-dark': '#94a3b8',
        'border-light': '#e2e8f0',
        success: '#059669',
        error: '#dc2626',
        warning: '#d97706',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};