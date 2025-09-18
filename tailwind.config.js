/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./popup.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 使用纯黑白灰色阶
        gray: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#eeeeee',
          300: '#e0e0e0',
          400: '#bdbdbd',
          500: '#9e9e9e',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#212121',
        }
      },
      boxShadow: {
        'embossed': 'inset 1px 1px 2px rgba(0, 0, 0, 0.1), 1px 1px 2px rgba(255, 255, 255, 0.8)',
        'embossed-light': 'inset 1px 1px 1px rgba(0, 0, 0, 0.05), 1px 1px 1px rgba(255, 255, 255, 0.5)',
        'embossed-strong': 'inset 2px 2px 4px rgba(0, 0, 0, 0.1), 2px 2px 4px rgba(255, 255, 255, 0.9)',
      }
    },
  },
  plugins: [],
}