/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:        '#213761',
          'blue-mid':  '#2a4a82',
          'blue-light':'#3374B5',
          red:         '#E31E24',
          'red-dark':  '#b81519',
        },
        surface: {
          // Light theme
          dark:   '#f4f6f9',   // page background
          card:   '#ffffff',   // card / panel bg
          hover:  '#eef2f7',   // hover state
          border: '#dde3ec',   // dividers / card borders
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
