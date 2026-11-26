import { ActivityIndicator, View } from "react-native";
import type { ComponentProps, ReactNode } from "react";
import { Screen } from "./ui/Screen";
import { Label } from "./ui";
import { useApp } from "../state/AppProvider";
import { headerStatus } from "../services/HeaderStatus";
import { StartAt } from "./StartAt";
export function AppScreen(props: ComponentProps<typeof Screen>) {
  const { workspace, busy, syncState, error, reload, data } = useApp();
  if (busy)
    return (
      <Screen>
        <ActivityIndicator />
        <Label>Abriendo tu base local…</Label>
      </Screen>
    );
  if (!workspace) return <StartAt href="/login" />;
  const status = headerStatus({
    demo: workspace.demo,
    sync: syncState.status,
    offlineMode: data.settings.offline === "1",
    pending: data.pending,
  });
  return (
    <Screen onRefresh={reload} {...props} status={status}>
      {error ? (
        <View accessibilityRole="alert">
          <Label tone="warning">{error}</Label>
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
