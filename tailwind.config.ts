import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        matte: {
          DEFAULT: "#171715",
          950: "#10100F",
        },
        charcoal: {
          DEFAULT: "#24231F",
          light: "#2C2926",
          lighter: "#35312C",
        },
        gold: {
          DEFAULT: "#C58D5F",
          bright: "#D9A06F",
          dim: "#A65A2E",
        },
        ivory: "#F5F1E8",
        emerald: {
          DEFAULT: "#3FBF8F",
        },
        amber: {
          DEFAULT: "#E0A845",
        },
        crimson: {
          DEFAULT: "#D8455F",
        },
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(23, 23, 21, 0.28)",
        "gold-glow": "0 0 40px -8px rgba(197, 141, 95, 0.32)",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #D9A06F 0%, #C58D5F 45%, #A65A2E 100%)",
        "grain-radial": "radial-gradient(circle at 50% 0%, rgba(197,141,95,0.11), transparent 60%)",
      },
      animation: {
        "scan-line": "scan-line 3s ease-in-out infinite",
        "pulse-slow": "pulse-slow 3.5s ease-in-out infinite",
        "fade-up": "fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        "scan-line": {
          "0%, 100%": { transform: "translateY(-100%)", opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { transform: "translateY(100%)", opacity: "0" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
