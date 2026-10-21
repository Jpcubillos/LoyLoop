import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101F3C",
        muted: "#7A7D8E",
        cloud: "#FCFAFB",
        line: "#E5E8F0",
        brand: {
          50: "#FFF0F2",
          100: "#FFDDE3",
          500: "#FF6B6B",
          600: "#FA4059",
          700: "#D5314B"
        },
        reward: "#22C55E",
        points: "#F6D65A",
        coral: "#FF6B6B"
      },
      boxShadow: {
        soft: "0 12px 34px rgba(26, 31, 59, 0.06), 0 3px 10px rgba(255, 107, 107, 0.04)"
      }
    }
  },
  plugins: []
};

export default config;
