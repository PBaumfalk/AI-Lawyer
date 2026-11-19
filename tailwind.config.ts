import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // shadcn/ui-Variablen; Werte leiten sich aus den Persimmon-Tokens (--al-*) in globals.css ab
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          foreground: "var(--primary-foreground)",
          strong: "var(--al-brand-strong)",
          soft: "var(--al-brand-soft)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        // Persimmon-Markenskala (Werte in globals.css, --brand-*): 500 = Persimmon,
        // 600 = Burnt Orange für Text, Links und Akzente auf hellen Flächen.
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
          950: "rgb(var(--brand-950) / <alpha-value>)",
        },
        // Semantische Statusfarben (CI-Contract §7)
        success: { DEFAULT: "var(--al-success)", soft: "var(--al-success-soft)" },
        warning: { DEFAULT: "var(--al-warning)", soft: "var(--al-warning-soft)" },
        danger: { DEFAULT: "var(--al-danger)", soft: "var(--al-danger-soft)" },
        info: { DEFAULT: "var(--al-info)", soft: "var(--al-info-soft)" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "var(--al-radius-card)",
        "3xl": "var(--al-radius-panel)",
      },
      fontFamily: {
        // Systemschrift, keine Webfonts (CI-Contract §4)
        heading: ["var(--al-font)"],
        sans: ["var(--al-font)"],
      },
      boxShadow: {
        glass: "var(--glass-shadow)",
        "glass-lg": "var(--glass-shadow-lg)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
