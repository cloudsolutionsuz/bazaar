/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        clay: {
          50: "#eef6f4",
          100: "#d3e8e2",
          200: "#aed7c8",
          300: "#7fc0aa",
          400: "#4da388",
          500: "#1f7a64",
          600: "#19654f",
          700: "#144f3e",
          800: "#0f3c30",
          900: "#0a2820",
        },
        sand: {
          50: "#f5faf8",
          100: "#e8f3ef",
          200: "#d6e9e2",
        },
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
      },
    },
  },
  plugins: [],
};
