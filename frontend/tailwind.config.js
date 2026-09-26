/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17201c",
        civic: "#0f766e",
        river: "#2563eb",
        saffron: "#d97706",
        paper: "#f7f8f4",
      },
      boxShadow: {
        soft: "0 16px 50px rgba(23, 32, 28, 0.12)",
        card: "0 8px 24px rgba(23, 32, 28, 0.08)",
        lift: "0 20px 45px -12px rgba(23, 32, 28, 0.22)",
        glow: "0 0 0 1px rgba(15, 118, 110, 0.12), 0 12px 30px -10px rgba(15, 118, 110, 0.35)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};
