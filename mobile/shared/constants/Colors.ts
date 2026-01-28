const tintColorLight = "#3366aa";
const tintColorDark = "#FFCC00";

export const Colors = {
  light: {
    text: "#11181C",
    subtext: "#687076",
    textInverted: "#fff",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
    border: "#ECEDEE",
  },
  dark: {
    text: "#ECEDEE",
    subtext: "#878792",
    textInverted: "#000000",
    background: "#09090b",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    border: "#333333",
  },
};

// Global Theme Colors
export const THEME_COLORS = {
  primary: "#FFCC00",
  background: "#121212",
  cardBackground: "#1A1A1C",
  inputBackground: "#2A2A2C",
  border: "#333",
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  textMuted: "#666",
  success: "#22C55E",
  error: "#EF4444",
} as const;
