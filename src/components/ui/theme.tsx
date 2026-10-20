import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export const tokens = {
  honey: '#F59E0B', honeyHover: '#D97706', audio: '#B45309', sync: '#92400E',
  green: '#10B981', blue: '#0284C7', danger: '#DC2626',
  radius: { button: 16, secondary: 12, card: 24 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
};
const palettes = {
  light: { background: '#F8FAFC', card: '#FFFFFF', text: '#1E293B', muted: '#64748B', border: '#E2E8F0', soft: '#F1F5F9', amber: '#FFFBEB', green: '#ECFDF5', blue: '#F0F9FF', amberText: '#92400E', greenText: '#047857', blueText: '#0369A1' },
  dark: { background: '#0B0F17', card: '#162032', text: '#F1F5F9', muted: '#A5B4C8', border: '#2C3A50', soft: '#1E293B', amber: '#382710', green: '#0C332B', blue: '#102F46', amberText: '#FCD34D', greenText: '#6EE7B7', blueText: '#7DD3FC' },
};
export type ThemePreference = 'light' | 'dark' | 'system';
type Theme = { colors: typeof palettes.light; dark: boolean; preference: ThemePreference; setPreference: (value: ThemePreference) => void };
const ThemeContext = createContext<Theme | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const dark = preference === 'dark' || (preference === 'system' && system === 'dark');
  return <ThemeContext.Provider value={{ colors: palettes[dark ? 'dark' : 'light'], dark, preference, setPreference }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const theme = useContext(ThemeContext); if (!theme) throw new Error('ThemeProvider missing'); return theme; }
