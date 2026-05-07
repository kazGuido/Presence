/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#004628',
        'on-primary': '#ffffff',
        'primary-container': '#006039',
        'on-primary-container': '#88d8a7',
        secondary: '#9a4600',
        'secondary-container': '#fd8535',
        'on-secondary-container': '#642b00',
        surface: '#f9f9fc',
        'surface-container': '#eeeef0',
        'surface-container-low': '#f3f3f6',
        'surface-container-lowest': '#ffffff',
        'surface-variant': '#e2e2e5',
        'on-surface': '#1a1c1e',
        'on-surface-variant': '#3f4942',
        outline: '#6f7a71',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
      },
      fontFamily: {
        sans: ['Lexend', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
