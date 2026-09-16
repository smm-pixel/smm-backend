/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#047857",
          dark: "#065f46",
          light: "#ecfdf5",
        },
      },
    },
  },
  plugins: [],
};
