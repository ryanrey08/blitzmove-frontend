import type { Config } from "tailwindcss";

// Tailwind v4 reads this file through the `@config` directive in src/styles/globals.css.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff1f1",
          100: "#ffdfdf",
          200: "#ffc5c5",
          300: "#ff9d9d",
          400: "#ff6464",
          500: "#f83232",
          600: "#e30613",
          700: "#c00510",
          800: "#9e0a13",
          900: "#830f16",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5d9e0",
          300: "#b0b7c3",
          400: "#858fa0",
          500: "#667085",
          600: "#4f5869",
          700: "#3f4655",
          800: "#272b33",
          900: "#16181d",
          950: "#0d0e11",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
      },
    },
  },
};

export default config;
