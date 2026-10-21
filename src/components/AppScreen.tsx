import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { Screen } from "./ui/Screen";
import { Label } from "./ui";
import { useApp } from "../state/AppProvider";
export function AppScreen(props: ComponentProps<typeof Screen>) {
  const { workspace, busy, syncState, error } = useApp();
  if (busy)
    return (
      <Screen nav={false}>
        <ActivityIndicator />
        <Label>Abriendo tu base local…</Label>
      </Screen>
    );
  if (!workspace) return <Redirect href="/login" />;
  const status = workspace.demo
    ? "Demo · local"
    : syncState.status === "syncing"
      ? "Sincronizando"
      : syncState.status === "error"
        ? "Sync pendiente"
        : syncState.status === "offline"
          ? "Sin conexión"
          : "En línea";
  return (
    <Screen {...props} status={status}>
      {error ? (
        <View accessibilityRole="alert">
          <Label color="#B45309">{error}</Label>
        </View>
      ) : null}
      {props.children}
    </Screen>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <View style={{ paddingVertical: 24, gap: 8 }}>
      <Label muted>{children}</Label>
    </View>
  );
}
