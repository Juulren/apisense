import "../global.css";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View } from "react-native";
import { BottomNav } from "../components/ui/BottomNav";
import { ThemeProvider, useTheme } from "../components/ui/theme";
import { AppProvider } from "../state/AppProvider";

// Peer destinations (the bottom bar) cross-fade, like Material "fade through".
// Drill-in screens slide in. The bar lives here, outside the Stack, so it stays
// put while only the content animates.
function Shell() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            animationDuration: 200,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen
            name="hive/[id]"
            options={{ animation: "slide_from_right", animationDuration: 250 }}
          />
          <Stack.Screen
            name="inspection"
            options={{ animation: "slide_from_right", animationDuration: 250 }}
          />
          <Stack.Screen
            name="pairing"
            options={{ animation: "slide_from_right", animationDuration: 250 }}
          />
          <Stack.Screen
            name="ui-catalog"
            options={{ animation: "slide_from_right", animationDuration: 250 }}
          />
        </Stack>
      </View>
      <BottomNav />
    </View>
  );
}

export default function Layout() {
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
          <Shell />
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
