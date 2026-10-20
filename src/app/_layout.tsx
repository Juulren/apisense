import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View, Platform } from "react-native";
import { ThemeProvider } from "../components/ui/theme";
import { AppProvider } from "../state/AppProvider";
export default function Layout() {
  useEffect(() => {
    if (Platform.OS === "web" && !__DEV__ && "serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw.js")
        .catch((error) =>
          console.warn(
            "Preparación offline pendiente",
            error instanceof Error ? error.name : "Error",
          ),
        );
  }, []);
  const [loaded, error] = useFonts({
    Jakarta: require("@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf"),
    JakartaBold: require("@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf"),
    Inter: require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"),
    InterBold: require("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"),
  });
  if (!loaded && !error)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator accessibilityLabel="Cargando tipografía" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
