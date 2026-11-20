import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { supabase } from "../services/supabase";
import {
  PUSH_ENABLED,
  registerForPush,
  routeForNotification,
} from "../services/Push";
import { rememberPushToken } from "../services/pushToken";
import { useApp } from "./AppProvider";

/**
 * Registers the phone for node alerts once a real account is open, and opens the
 * right screen when a notification is tapped. Inert unless push is configured.
 */
export function usePushRegistration() {
  const { workspace } = useApp();
  const real = Boolean(workspace && !workspace.demo);
  useEffect(() => {
    if (!PUSH_ENABLED || !real || !supabase) return;
    let cancelled = false;
    const subscriptions: { remove(): void }[] = [];
    void (async () => {
      try {
        const Notifications = await import("expo-notifications");
        await Notifications.setNotificationChannelAsync("alerts", {
          name: "Alertas del nodo",
          importance: Notifications.AndroidImportance.HIGH,
        });
        const claim = async (token: string, platform: string) => {
          const { error } = await supabase!.rpc("claim_push_token", {
            p_token: token,
            p_platform: platform,
          });
          if (error) throw error;
        };
        const result = await registerForPush({
          enabled: PUSH_ENABLED,
          platform: Platform.OS,
          allowed: async () => {
            const current = await Notifications.getPermissionsAsync();
            if (current.granted) return true;
            return (await Notifications.requestPermissionsAsync()).granted;
          },
          token: async () =>
            ((await Notifications.getDevicePushTokenAsync()).data as string) ??
            null,
          claim,
        });
        // Remember it even if this screen already unmounted: the server has the claim.
        if (result.token) rememberPushToken(result.token);
        if (cancelled) return;
        subscriptions.push(
          Notifications.addPushTokenListener((t) => {
            const next = String(t.data);
            rememberPushToken(next);
            void claim(next, Platform.OS).catch(() => {});
          }),
          Notifications.addNotificationResponseReceivedListener((response) => {
            router.push(
              routeForNotification(
                response.notification.request.content.data,
              ) as never,
            );
          }),
        );
        // A tap that launched the app arrived before the listener existed.
        const launch = await Notifications.getLastNotificationResponseAsync();
        if (launch && !cancelled)
          router.push(
            routeForNotification(launch.notification.request.content.data) as never,
          );
      } catch {
        // Push is a convenience; the in-app alerts keep working.
      }
    })();
    return () => {
      cancelled = true;
      subscriptions.forEach((s) => s.remove());
    };
  }, [real]);
}
