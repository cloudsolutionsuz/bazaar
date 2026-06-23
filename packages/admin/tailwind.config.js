/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6f4",
          100: "#d3e8e2",
          500: "#1f7a64",
          600: "#19654f",
          700: "#144f3e",
        },
      },
    },
  },
  plugins: [],
};
