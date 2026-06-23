/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        clay: {
          50: "#fbf3ee",
          100: "#f5e1d3",
          200: "#e8c2a6",
          300: "#d99f73",
          400: "#cc7f4a",
          500: "#bd5f2a",
          600: "#9c4a1f",
          700: "#7a3a1a",
          800: "#5c2c16",
          900: "#3d1d0f",
        },
        sand: {
          50: "#fdfbf7",
          100: "#f8f1e7",
          200: "#efe2cc",
        },
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
      },
    },
  },
  plugins: [],
};
