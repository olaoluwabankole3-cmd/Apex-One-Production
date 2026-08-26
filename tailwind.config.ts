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
          DEFAULT: "#0A0A0B",
          950: "#050506",
        },
        charcoal: {
          DEFAULT: "#16161A",
          light: "#1C1C22",
          lighter: "#232329",
        },
        gold: {
          DEFAULT: "#C9A961",
          bright: "#E8CD8A",
          dim: "#8A7440",
        },
        ivory: "#F7F5F0",
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
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.45)",
        "gold-glow": "0 0 40px -8px rgba(201, 169, 97, 0.35)",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #E8CD8A 0%, #C9A961 45%, #8A7440 100%)",
        "grain-radial": "radial-gradient(circle at 50% 0%, rgba(201,169,97,0.08), transparent 60%)",
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
