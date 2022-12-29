/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true,
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
    },
    extend: {
      fontFamily: {
        sans: [
          "DM Sans",
          "-apple-system",
          "system-ui",
          "Inter",
          "Helvetica Neue",
          "Helvetica",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          DEFAULT: "#005f4b",
          hover: "#005444",
          muted: {
            DEFAULT: "#009980",
            light: "#00bba3",
            dark: "#007a5f",
            extra: "#9adacc",
            super: "#e6f7f4",
            red: {
              DEFAULT: "#FF5F59",
              lighter: "#FFBFBF",
            },
            yellow: {
              DEFAULT: "#FFFF99",
              darker: "#F5D76E",
            },
          },
          offwhite: "#efefef",
          slate: "#333333",
          slate_dark: "#222222",
          blue: {
            DEFAULT: "#1473e6",
            hover: "#1267cf",
          },
          gold: {
            DEFAULT: "#c1a173",
            hover: "#b49662",
            // DEFAULT: "#b49662",
            // hover: "#a88a52",
          },
        },
        mono: {
          25: "#f8fafc",
          50: "#f3f3f3",
          100: "#e7e7e7",
          150: "#d4d4d4",
          175: "#bababa",
          200: "#c4c4c4",
          300: "#a0a0a0",
          400: "#585858",
          500: "#111111",
          600: "#0f0f0f",
          700: "#0d0d0d",
          800: "#0a0a0a",
          900: "#080808",
          DEFAULT: "#111111",
        },
      },
    },
  },
  plugins: [],
};
