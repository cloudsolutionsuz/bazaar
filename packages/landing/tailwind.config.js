/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6f4",
          100: "#d3e8e2",
          200: "#a7d1c5",
          300: "#7bb9a8",
          400: "#4f9c87",
          500: "#1f7a64",
          600: "#19654f",
          700: "#144f3e",
          800: "#0f3a2e",
          900: "#0a261f",
        },
      },
    },
  },
  plugins: [],
};
