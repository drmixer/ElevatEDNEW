/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          primary: '#8917ED',
          secondary: '#5D0CB2',
          tertiary: '#624CA9',
          accent: '#E9D08F',
          success: '#94C689',
          dark: '#3C4444',
          soft: '#F4EDFF',
          canvas: '#F7F5FF',
          teal: '#5D0CB2',
          blue: '#8917ED',
          violet: '#624CA9',
          'light-teal': '#F4EDFF',
          'light-violet': '#F4EDFF',
          'light-blue': '#E6DBFF',
        },
        teal: {
          50: '#F4EDFF',
          100: '#E6DBFF',
          500: '#5D0CB2',
          600: '#8917ED',
        },
        blue: {
          50: '#F4EDFF',
          100: '#E6DBFF',
          500: '#5D0CB2',
          600: '#8917ED',
          800: '#4B178E',
          900: '#341163',
        },
        violet: {
          50: '#F4EDFF',
          100: '#E6DBFF',
          500: '#7155D9',
          600: '#8917ED',
        },
        pink: {
          500: '#F2E0A8',
          600: '#E9D08F',
        },
        green: {
          50: '#EAF5EC',
          100: '#E0F0E0',
          500: '#94C689',
          600: '#7AAF6E',
          800: '#4B6D48',
        },
        sky: {
          200: '#E6DBFF',
          300: '#D4C3FF',
          500: '#5D0CB2',
        },
        orange: {
          500: '#E9D08F',
          600: '#D1B470',
        }
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      }
    },
  },
  plugins: [],
};
