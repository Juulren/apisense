import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  createSendPushHandler,
  type SendResult,
} from "../_shared/sendPushHandler.ts";

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
function serviceKey() {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const configured = JSON.parse(keys);
    if (typeof configured.default === "string") return configured.default;
  }
  return required("SUPABASE_SERVICE_ROLE_KEY");
}
const admin = createClient(required("SUPABASE_URL"), serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Firebase service account (JSON) as a function secret: FCM_SERVICE_ACCOUNT.
// Without it the function answers "push_not_configured" and consumes nothing.
type ServiceAccount = { project_id: string; client_email: string; private_key: string };
function account(): ServiceAccount | null {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.project_id && parsed.client_email && parsed.private_key
      ? parsed
      : null;
  } catch {
    return null;
  }
}
const b64url = (data: Uint8Array | string) =>
  btoa(
    typeof data === "string"
      ? data
      : String.fromCharCode(...data),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
let cached: { token: string; until: number } | null = null;
async function accessToken(sa: ServiceAccount) {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(`${header}.${claim}`),
    ),
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error("fcm_auth");
  const data = await res.json();
  cached = { token: data.access_token, until: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

Deno.serve(
  createSendPushHandler({
    cronSecret: () => Deno.env.get("CRON_SECRET"),
    configured: () => account() !== null,
    async pending(limit) {
      // Takes a lease on the events (and expires old ones) atomically.
      const { data, error } = await admin.rpc("claim_pending_alerts", {
        p_limit: limit,
      });
      if (error) throw error;
      return data ?? [];
    },
    async tokensFor(userId) {
      const { data, error } = await admin
        .from("push_tokens")
        .select("token")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.token as string);
    },
    async send(token, message): Promise<SendResult> {
      const sa = account();
      if (!sa) return "error";
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${await accessToken(sa)}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title: message.title, body: message.body },
                data: message.data,
                android: {
                  priority: "HIGH",
                  notification: { channel_id: "alerts" },
                },
              },
            }),
          },
        );
        if (res.ok) return "ok";
        // Only a dead token is deleted. INVALID_ARGUMENT also means "bad message",
        // which must never wipe everyone's tokens, so it counts only when FCM
        // points at the token field itself.
        const detail = await res.text();
        const deadToken =
          res.status === 404 ||
          /UNREGISTERED/.test(detail) ||
          (/INVALID_ARGUMENT/.test(detail) && /message\.token/.test(detail));
        return deadToken ? "invalid" : "error";
      } catch {
        return "error";
      }
    },
    async markSent(id) {
      const { error } = await admin
        .from("alert_events")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    async deleteToken(token) {
      await admin.from("push_tokens").delete().eq("token", token);
    },
  }),
);
