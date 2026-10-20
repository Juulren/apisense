module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        honey: "#F59E0B",
        emerald: "#10B981",
        sensor: "#0284C7",
        ink: "#1E293B",
      },
      fontFamily: { sans: ["Jakarta"], label: ["Inter"] },
    },
  },
  plugins: [],
};
