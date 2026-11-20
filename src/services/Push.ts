// Push notifications for node alerts. Everything here is optional: without
// Firebase configured (EXPO_PUBLIC_PUSH_ENABLED unset) the app behaves exactly
// as before and alerts stay inside the app.
export const PUSH_ENABLED = process.env.EXPO_PUBLIC_PUSH_ENABLED === "1";

export type PushOutcome = "disabled" | "denied" | "registered" | "failed";
export interface PushDeps {
  enabled: boolean;
  platform: string;
  /** Asks the user for permission when needed; true if notifications are allowed. */
  allowed(): Promise<boolean>;
  /** The device's FCM token. */
  token(): Promise<string | null>;
  /** Stores the token for the signed-in account (RPC claim_push_token). */
  claim(token: string, platform: string): Promise<void>;
}

/** Registers this phone for push. Never throws: a failure just means no push. */
export async function registerForPush(
  deps: PushDeps,
): Promise<{ outcome: PushOutcome; token?: string }> {
  if (!deps.enabled || deps.platform !== "android") return { outcome: "disabled" };
  try {
    if (!(await deps.allowed())) return { outcome: "denied" };
    const token = await deps.token();
    if (!token) return { outcome: "failed" };
    await deps.claim(token, deps.platform);
    return { outcome: "registered", token };
  } catch {
    return { outcome: "failed" };
  }
}

/** Where tapping a notification should go. Unknown kinds fall back to the alerts list. */
export function routeForNotification(data: Record<string, unknown> | undefined) {
  const kind = data?.kind;
  const hive = typeof data?.hive_id === "string" ? data.hive_id : null;
  if (kind === "node_silent" && hive) return `/hive/${hive}`;
  return "/alerts";
}
