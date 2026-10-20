import '../global.css';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { ThemeProvider } from '../components/ui/theme';
export default function Layout() {
  const [loaded, error] = useFonts({ Jakarta: PlusJakartaSans_400Regular, JakartaBold: PlusJakartaSans_700Bold, Inter: Inter_500Medium, InterBold: Inter_700Bold });
  if (!loaded && !error) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Cargando tipografía" /></View>;
  return <SafeAreaProvider><ThemeProvider><Stack screenOptions={{ headerShown: false }} /></ThemeProvider></SafeAreaProvider>;
}
