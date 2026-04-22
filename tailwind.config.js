/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4F46E5",
          soft:    "#818CF8",
          dark:    "#3730A3",
        },
        surface: {
          DEFAULT: "#0F172A",
          card:    "#1E293B",
          border:  "#334155",
        },
      },
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
