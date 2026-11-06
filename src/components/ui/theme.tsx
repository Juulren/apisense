import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Appearance, StatusBar, StyleSheet, useColorScheme } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export const tokens = {
  honey: "#F59E0B",
  honeyHover: "#D97706",
  audio: "#B45309",
  sync: "#92400E",
  green: "#10B981",
  blue: "#0284C7",
  danger: "#DC2626",
  radius: { button: 16, secondary: 12, card: 24 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
};
const palettes = {
  light: {
    background: "#F8FAFC",
    card: "#FFFFFF",
    text: "#1E293B",
    muted: "#64748B",
    border: "#E2E8F0",
    soft: "#F1F5F9",
    amber: "#FFFBEB",
    green: "#ECFDF5",
    blue: "#F0F9FF",
    amberText: "#92400E",
    greenText: "#047857",
    blueText: "#0369A1",
    dangerText: "#B91C1C",
  },
  dark: {
    background: "#0B0F17",
    card: "#162032",
    text: "#F1F5F9",
    muted: "#A5B4C8",
    border: "#2C3A50",
    soft: "#1E293B",
    amber: "#382710",
    green: "#0C332B",
    blue: "#102F46",
    amberText: "#FCD34D",
    greenText: "#6EE7B7",
    blueText: "#7DD3FC",
    dangerText: "#FCA5A5",
  },
};
export type ThemePreference = "light" | "dark" | "system";
type Theme = {
  colors: typeof palettes.light;
  dark: boolean;
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
};
const ThemeContext = createContext<Theme | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  // Same model as AppCompatDelegate.setDefaultNightMode: tell the OS layer the
  // chosen night mode so native pieces (keyboard, dialogs, system bar icons)
  // follow it, instead of only recoloring our own views.
  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    Appearance.setColorScheme(value === "system" ? "unspecified" : value);
  }, []);
  const dark =
    preference === "dark" || (preference === "system" && system === "dark");
  // Material cross-fade: cover the swap with the outgoing background and fade
  // it away, rather than an abrupt one-frame flip.
  const previous = useRef(dark);
  const [veil, setVeil] = useState(palettes[dark ? "dark" : "light"].background);
  const fade = useSharedValue(0);
  useEffect(() => {
    if (previous.current === dark) return;
    setVeil(palettes[previous.current ? "dark" : "light"].background);
    previous.current = dark;
    fade.value = 1;
    fade.value = withTiming(0, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [dark, fade]);
  const veilStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  return (
    <ThemeContext.Provider
      value={{
        colors: palettes[dark ? "dark" : "light"],
        dark,
        preference,
        setPreference,
      }}
    >
      <StatusBar
        barStyle={dark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />
      {children}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: veil }, veilStyle]}
      />
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("ThemeProvider missing");
  return theme;
}
